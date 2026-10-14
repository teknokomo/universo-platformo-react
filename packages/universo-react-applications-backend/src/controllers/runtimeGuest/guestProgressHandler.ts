import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { resolveTopLevelComponents } from '../../shared/publicRuntimeAccess'
import { denyRuntimeEntityMutation } from '../../shared/entityMutationPolicy'
import { IDENTIFIER_REGEX } from '../../shared/runtimeHelpers'
import { lockGuestAccessLinkWorkspace } from '../../services/guestAccessLinkRevocation'
import { ACTIVE_ROW_SQL, deriveGuestContentProgress, guestProgressSchema, indexByCodename, lockPublicGuestRuntimeKey } from './shared'
import type { RuntimeGuestServices } from './services'

export const createGuestProgressHandler = (services: RuntimeGuestServices) => {
    const {
        withPublicRuntimeContext,
        requirePublicGuestRuntimeConfig,
        validateGuestSession,
        setPublicWorkspaceContext,
        loadAccessLinkRecordBy,
        assertAccessLinkAvailable,
        resolveAllowedRuntimeTarget,
        buildContentPayload,
        resolveContentProgressBinding,
        createUuidV7
    } = services
    const updateGuestProgress = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        let committedProgressResponse = false
        await withPublicRuntimeContext(applicationId, res, async (ctx) => {
            const runtimeConfig = requirePublicGuestRuntimeConfig(ctx, res)
            if (!runtimeConfig) return
            const parsed = guestProgressSchema.safeParse(req.body)
            if (!parsed.success) {
                res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() })
                return
            }
            const session = await validateGuestSession(
                ctx.manager,
                ctx.schemaName,
                ctx.workspacesEnabled,
                runtimeConfig,
                parsed.data.participantId,
                parsed.data.sessionToken
            )
            if (!session.isValid || !session.accessLinkId) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            if (ctx.workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(ctx.manager, ctx.schemaName, session.workspaceId)
                if (!hasWorkspace) {
                    res.status(403).json({ error: 'Guest session workspace is not available' })
                    return
                }
            }

            await lockGuestAccessLinkWorkspace({
                executor: ctx.manager,
                schemaName: ctx.schemaName,
                workspacesEnabled: ctx.workspacesEnabled,
                workspaceId: session.workspaceId
            })

            const link = await loadAccessLinkRecordBy(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                { type: 'id', value: session.accessLinkId },
                session.workspaceId
            )
            if (!link) {
                res.status(403).json({ error: 'Guest session is invalid or expired' })
                return
            }

            const availability = assertAccessLinkAvailable(link, { enforceQuota: false })
            if (!availability.ok) {
                res.status(availability.status).json({ error: availability.error })
                return
            }

            const allowedContentTarget = await resolveAllowedRuntimeTarget(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                link,
                'content',
                parsed.data.contentNodeId
            )
            if (!allowedContentTarget || allowedContentTarget.type !== 'content') {
                res.status(403).json({ error: 'Content is not available for this guest session' })
                return
            }

            const contentPayload = await buildContentPayload(
                ctx.manager,
                ctx.schemaName,
                runtimeConfig,
                parsed.data.contentNodeId,
                'en',
                session.workspaceId
            )
            if (!contentPayload || contentPayload.type !== 'content') {
                res.status(404).json({ error: 'Content is not available for this guest session' })
                return
            }

            if (
                typeof parsed.data.contentItemId === 'string' &&
                !contentPayload.contentItems.some((item) => item.id === parsed.data.contentItemId)
            ) {
                res.status(400).json({ error: 'Content item is not available for this guest session' })
                return
            }

            const progressBinding = await resolveContentProgressBinding(ctx.manager, ctx.schemaName, runtimeConfig)
            if (!progressBinding) {
                res.status(500).json({ error: 'Content progress object is not available' })
                return
            }
            if (denyRuntimeEntityMutation(res, progressBinding.config)) return

            const attrs = resolveTopLevelComponents(progressBinding)
            const attrByCodename = indexByCodename(attrs)
            const progressFields = runtimeConfig.fields.contentProgress
            const columns = {
                studentId: attrByCodename[progressFields.studentId]?.column_name,
                contentNodeId: attrByCodename[progressFields.contentNodeId]?.column_name,
                status: attrByCodename[progressFields.status]?.column_name,
                progressPercent: attrByCodename[progressFields.progressPercent]?.column_name,
                startedAt: attrByCodename[progressFields.startedAt]?.column_name,
                completedAt: attrByCodename[progressFields.completedAt]?.column_name,
                lastAccessedItemIndex: attrByCodename[progressFields.lastAccessedItemIndex]?.column_name
            }
            if (Object.values(columns).some((column) => !column)) {
                res.status(500).json({ error: 'Content progress object is missing required fields' })
                return
            }

            for (const col of Object.values(columns)) {
                if (!IDENTIFIER_REGEX.test(col)) {
                    res.status(400).json({ error: 'Content progress object has invalid column names' })
                    return
                }
            }
            const qColumns = {
                studentId: qColumn(columns.studentId as string),
                contentNodeId: qColumn(columns.contentNodeId as string),
                status: qColumn(columns.status as string),
                progressPercent: qColumn(columns.progressPercent as string),
                completedAt: qColumn(columns.completedAt as string),
                lastAccessedItemIndex: qColumn(columns.lastAccessedItemIndex as string)
            }

            const tableQt = qSchemaTable(ctx.schemaName, progressBinding.tableName)

            let progressUpdateFailed = false
            await ctx.manager.transaction(async (tx: DbExecutor) => {
                await lockPublicGuestRuntimeKey(
                    tx,
                    `${ctx.schemaName}:guest-progress:${session.workspaceId ?? ''}:${parsed.data.participantId}:${
                        parsed.data.contentNodeId
                    }`
                )

                const progressWhereClauses = [
                    `${qColumns.studentId} = $1`,
                    `${qColumns.contentNodeId} = $2`,
                    ACTIVE_ROW_SQL,
                    ctx.workspacesEnabled && session.workspaceId ? `${qColumn('workspace_id')} = $3` : ''
                ].filter(Boolean)
                const existingRows = await tx.query<{ id: string; lastAccessedItemIndex: number | null }>(
                    `
                    SELECT id, ${qColumns.lastAccessedItemIndex} AS "lastAccessedItemIndex"
                    FROM ${tableQt}
                    WHERE ${progressWhereClauses.join(' AND ')}
                    LIMIT 1
                    `,
                    ctx.workspacesEnabled && session.workspaceId
                        ? [parsed.data.participantId, parsed.data.contentNodeId, session.workspaceId]
                        : [parsed.data.participantId, parsed.data.contentNodeId]
                )
                const existingLastAccessedItemIndex =
                    typeof existingRows[0]?.lastAccessedItemIndex === 'number' ? existingRows[0].lastAccessedItemIndex : undefined
                const derivedProgress = deriveGuestContentProgress(
                    contentPayload.contentItems,
                    parsed.data.action,
                    parsed.data.contentItemId,
                    existingLastAccessedItemIndex
                )
                if (!derivedProgress) {
                    progressUpdateFailed = true
                    return
                }

                if (existingRows[0]?.id) {
                    const updateParams = [
                        parsed.data.participantId,
                        parsed.data.contentNodeId,
                        derivedProgress.status,
                        derivedProgress.progressPercent,
                        derivedProgress.lastAccessedItemIndex,
                        existingRows[0].id
                    ]
                    const workspaceUpdateClause =
                        ctx.workspacesEnabled && session.workspaceId
                            ? `AND ${qColumn('workspace_id')} = $${updateParams.push(session.workspaceId)}`
                            : ''
                    const updatedRows = await tx.query<{ id: string }>(
                        `
                        UPDATE ${tableQt}
                        SET ${qColumns.status} = $3,
                            ${qColumns.progressPercent} = $4,
                            ${qColumns.lastAccessedItemIndex} = $5,
                            ${qColumns.completedAt} = CASE WHEN $4 >= 100 THEN NOW() ELSE ${qColumns.completedAt} END,
                            ${qColumn('_upl_updated_at')} = NOW(),
                            ${qColumn('_upl_updated_by')} = $1
                        WHERE id = $6
                          AND ${ACTIVE_ROW_SQL}
                          ${workspaceUpdateClause}
                        RETURNING id
                        `,
                        updateParams
                    )
                    if (!updatedRows[0]?.id) {
                        progressUpdateFailed = true
                        return
                    }
                } else {
                    const insertColumns = [
                        'id',
                        qColumn(columns.studentId),
                        qColumn(columns.contentNodeId),
                        qColumn(columns.status),
                        qColumn(columns.progressPercent),
                        qColumn(columns.startedAt),
                        qColumn(columns.completedAt),
                        qColumn(columns.lastAccessedItemIndex)
                    ]
                    const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5', 'NOW()', 'CASE WHEN $5 >= 100 THEN NOW() ELSE NULL END', '$6']
                    const insertValues = [
                        await createUuidV7(tx),
                        parsed.data.participantId,
                        parsed.data.contentNodeId,
                        derivedProgress.status,
                        derivedProgress.progressPercent,
                        derivedProgress.lastAccessedItemIndex
                    ]

                    if (ctx.workspacesEnabled && session.workspaceId) {
                        insertColumns.push(qColumn('workspace_id'))
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(session.workspaceId)
                    }

                    insertColumns.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(parsed.data.participantId, parsed.data.participantId)

                    await tx.query(
                        `
                        INSERT INTO ${tableQt} (${insertColumns.join(', ')})
                        VALUES (${insertPlaceholders.join(', ')})
                    `,
                        insertValues
                    )
                }
            })

            if (progressUpdateFailed) {
                res.status(409).json({ error: 'Guest progress row was not updated', code: 'GUEST_PROGRESS_UPDATE_FAILED' })
                return
            }

            committedProgressResponse = true
        })

        if (committedProgressResponse && !res.headersSent) {
            res.json({ ok: true })
        }
    }

    return updateGuestProgress
}
