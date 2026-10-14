import type { Request, Response } from 'express'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { globalShortLinkQuizAccessOptionsResponseSchema } from '@universo-react/types'
import { listActivePublicWorkspaceIds, resolveTopLevelComponents } from '../../shared/publicRuntimeAccess'
import { setPublicWorkspaceContext } from '../../shared/publicRuntimeAccess'
import { resolveLocalizedContent, IDENTIFIER_REGEX, UUID_REGEX } from '../../shared/runtimeHelpers'
import { ACTIVE_ROW_SQL, indexByCodename, normalizeAccessLinkDate, normalizeAccessLinkNumber } from './shared'
import type { RuntimeGuestServices } from './services'

export const createEligiblePublicQuizAccessLinksHandler = (services: RuntimeGuestServices) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        resolveAccessLinksBinding,
        assertAccessLinkAvailable,
        loadAccessLinkRecord,
        resolveAllowedRuntimeTarget,
        buildQuizPayload
    } = services
    const listEligiblePublicQuizAccessLinks = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const locale = typeof req.query.locale === 'string' ? req.query.locale : 'en'

        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const config = requirePublicGuestRuntimeConfig(ctx, res, { allowUnconfigured: true })
            if (!config) {
                res.json({ items: [] })
                return
            }

            const binding = await resolveAccessLinksBinding(ctx.manager, ctx.schemaName, config)
            if (!binding) {
                res.json({ items: [] })
                return
            }

            const attrByCodename = indexByCodename(resolveTopLevelComponents(binding))
            const fields = config.fields.accessLink
            const columns = {
                slug: attrByCodename[fields.slug]?.column_name,
                targetType: attrByCodename[fields.targetType]?.column_name,
                targetId: attrByCodename[fields.targetId]?.column_name,
                isActive: attrByCodename[fields.isActive]?.column_name,
                expiresAt: attrByCodename[fields.expiresAt]?.column_name,
                maxUses: attrByCodename[fields.maxUses]?.column_name,
                useCount: attrByCodename[fields.useCount]?.column_name,
                title: attrByCodename[fields.title]?.column_name
            }
            const requiredColumns = [columns.slug, columns.targetType, columns.targetId, columns.isActive]
            if (
                requiredColumns.some((column) => !column || !IDENTIFIER_REGEX.test(column)) ||
                Object.values(columns).some((column) => column !== undefined && !IDENTIFIER_REGEX.test(column))
            ) {
                res.json({ items: [] })
                return
            }

            const selectedColumn = (column: string | undefined, alias: string, fallback = 'NULL') =>
                `${column ? qColumn(column) : fallback} AS ${qColumn(alias)}`
            const accessLinksTable = qSchemaTable(ctx.schemaName, binding.tableName)
            const workspaceIds: Array<string | null> = ctx.workspacesEnabled
                ? await listActivePublicWorkspaceIds(ctx.manager, ctx.schemaName)
                : [null]
            const workspaceLabels = new Map<string, string>()
            if (ctx.workspacesEnabled && workspaceIds.length > 0) {
                const workspaceRows = await ctx.manager.query<{ id: string; name: unknown }>(
                    `SELECT id, name FROM ${qSchemaTable(ctx.schemaName, '_app_workspaces')} WHERE id = ANY($1::uuid[])`,
                    [workspaceIds]
                )
                for (const workspace of workspaceRows) {
                    if (UUID_REGEX.test(workspace.id)) {
                        const label = resolveLocalizedContent(workspace.name, locale, '').trim()
                        if (label) workspaceLabels.set(workspace.id, label)
                    }
                }
            }
            const candidates: Array<{
                id: string
                slug: string
                workspaceId: string | null
            }> = []

            for (const workspaceId of workspaceIds) {
                if (ctx.workspacesEnabled && !(await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, workspaceId))) continue
                const workspaceClause = workspaceId ? `AND ${qColumn('workspace_id')} = $1` : ''
                const rows = await ctx.manager.query<{
                    id: string
                    slug: unknown
                    target_type: unknown
                    target_id: unknown
                    is_active: unknown
                    expires_at: unknown
                    max_uses: unknown
                    use_count: unknown
                }>(
                    `
                        SELECT id,
                               ${selectedColumn(columns.slug, 'slug')},
                               ${selectedColumn(columns.targetType, 'target_type')},
                               ${selectedColumn(columns.targetId, 'target_id')},
                               ${selectedColumn(columns.isActive, 'is_active', 'FALSE')},
                               ${selectedColumn(columns.expiresAt, 'expires_at')},
                               ${selectedColumn(columns.maxUses, 'max_uses')},
                               ${selectedColumn(columns.useCount, 'use_count')}
                        FROM ${accessLinksTable}
                        WHERE ${ACTIVE_ROW_SQL}
                          ${workspaceClause}
                        ORDER BY ${qColumn(columns.slug as string)} ASC, id ASC
                        LIMIT 500
                        `,
                    workspaceId ? [workspaceId] : []
                )

                for (const row of rows) {
                    const slug = typeof row.slug === 'string' ? row.slug : ''
                    const expiresAt = normalizeAccessLinkDate(row.expires_at)
                    const maxUses = normalizeAccessLinkNumber(row.max_uses)
                    const useCount = normalizeAccessLinkNumber(row.use_count)
                    const expirationIsValid = row.expires_at == null || expiresAt !== null
                    const maxUsesIsValid = row.max_uses == null || (maxUses !== null && maxUses >= 0)
                    const useCountIsValid = row.use_count == null || (useCount !== null && useCount >= 0)
                    const hasCapacity = maxUses === null || (useCountIsValid && (useCount ?? 0) < maxUses)
                    if (
                        !UUID_REGEX.test(row.id) ||
                        !slug ||
                        slug !== slug.trim() ||
                        slug.length > 255 ||
                        !['quiz', 'assessment'].includes(String(row.target_type).toLowerCase()) ||
                        typeof row.target_id !== 'string' ||
                        !UUID_REGEX.test(row.target_id) ||
                        row.is_active !== true ||
                        !expirationIsValid ||
                        !maxUsesIsValid ||
                        !useCountIsValid ||
                        (expiresAt !== null && Date.parse(expiresAt) <= Date.now()) ||
                        !hasCapacity
                    ) {
                        continue
                    }
                    candidates.push({ id: row.id, slug, workspaceId })
                }
            }

            const workspaceLabelCounts = new Map<string, number>()
            for (const label of workspaceLabels.values()) {
                workspaceLabelCounts.set(label, (workspaceLabelCounts.get(label) ?? 0) + 1)
            }

            const items: Array<{ id: string; slug: string; label: string; workspaceId: string | null; workspaceLabel: string | null }> = []
            for (const candidate of candidates) {
                if (ctx.workspacesEnabled && !(await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, candidate.workspaceId))) {
                    continue
                }

                const link = await loadAccessLinkRecord(
                    ctx.manager,
                    ctx.schemaName,
                    config,
                    ctx.workspacesEnabled,
                    candidate.slug,
                    true,
                    candidate.workspaceId
                )
                if (
                    !link ||
                    link.id !== candidate.id ||
                    link.workspaceId !== candidate.workspaceId ||
                    !assertAccessLinkAvailable(link, { enforceQuota: true }).ok
                ) {
                    continue
                }

                const target = await resolveAllowedRuntimeTarget(ctx.manager, ctx.schemaName, config, link, 'quiz', link.targetId)
                if (!target || target.type !== 'quiz') continue

                const quiz = await buildQuizPayload(ctx.manager, ctx.schemaName, config, target.id, true, locale, link.workspaceId)
                if (
                    !quiz ||
                    quiz.type !== 'quiz' ||
                    quiz.questions.length === 0 ||
                    !quiz.questions.every(
                        (question) =>
                            question.options.length >= 2 &&
                            question.options.filter((option) => 'isCorrect' in option && option.isCorrect).length === 1
                    )
                ) {
                    continue
                }

                const quizTitle = quiz.title.trim()
                const title = resolveLocalizedContent(link.title, locale, '').trim() || quizTitle
                if (!title) continue
                let workspaceLabel = candidate.workspaceId ? workspaceLabels.get(candidate.workspaceId) ?? null : null
                if (workspaceLabel && (workspaceLabelCounts.get(workspaceLabel) ?? 0) > 1) {
                    const workspaceOrdinal = workspaceIds.indexOf(candidate.workspaceId) + 1
                    workspaceLabel = `${workspaceLabel} · ${workspaceOrdinal}`
                }
                if (candidate.workspaceId && !workspaceLabel) continue
                items.push({ id: link.id, slug: link.slug, label: title, workspaceId: candidate.workspaceId, workspaceLabel })
            }

            items.sort(
                (left, right) =>
                    left.label.localeCompare(right.label) ||
                    (left.workspaceLabel ?? '').localeCompare(right.workspaceLabel ?? '') ||
                    left.slug.localeCompare(right.slug)
            )
            res.json(globalShortLinkQuizAccessOptionsResponseSchema.parse({ items: items.slice(0, 100) }))
        })
    }

    return listEligiblePublicQuizAccessLinks
}
