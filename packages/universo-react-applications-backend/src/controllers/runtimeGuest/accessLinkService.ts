import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import {
    listActivePublicWorkspaceIds,
    resolvePublicRuntimeObject,
    resolveTopLevelComponents,
    setPublicWorkspaceContext
} from '../../shared/publicRuntimeAccess'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import type { AccessLinkRecord } from './shared'
import {
    ACTIVE_ROW_SQL,
    indexByCodename,
    normalizeAccessLinkDate,
    normalizeAccessLinkNumber,
    decodeGuestSessionToken,
    decodeStoredGuestSessionState,
    isSameSecretHash
} from './shared'
import { IDENTIFIER_REGEX, UUID_REGEX } from '../../shared/runtimeHelpers'
import { guestIntakePolicySchema } from '@universo-react/types'

export const createGuestAccessLinkService = () => {
    const resolveAccessLinksBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.accessLinks)

    const resolveStudentsBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.participants)

    const resolveQuizBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        config.assessment ? resolvePublicRuntimeObject(executor, schemaName, config.assessment.objects.assessments) : null

    const resolveContentNodeBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.contentNodes)

    const resolveContentProgressBinding = async (executor: DbExecutor, schemaName: string, config: PublicGuestRuntimeConfig) =>
        resolvePublicRuntimeObject(executor, schemaName, config.objects.contentProgress)

    const loadAccessLinkRecordBy = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        lookup: { type: 'slug'; value: string } | { type: 'id'; value: string },
        workspaceId: string | null,
        forUpdate = false
    ): Promise<AccessLinkRecord | null> => {
        const binding = await resolveAccessLinksBinding(executor, schemaName, config)
        if (!binding) return null
        if (workspaceId !== null && !UUID_REGEX.test(workspaceId)) return null

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const fields = config.fields.accessLink
        const slugColumn = attrByCodename[fields.slug]?.column_name
        const targetTypeColumn = attrByCodename[fields.targetType]?.column_name
        const targetIdColumn = attrByCodename[fields.targetId]?.column_name
        const contentNodeIdRefColumn = fields.contentNodeIdRef ? attrByCodename[fields.contentNodeIdRef]?.column_name : undefined
        const isActiveColumn = attrByCodename[fields.isActive]?.column_name
        const expiresAtColumn = attrByCodename[fields.expiresAt]?.column_name
        const maxUsesColumn = attrByCodename[fields.maxUses]?.column_name
        const useCountColumn = attrByCodename[fields.useCount]?.column_name
        const titleColumn = attrByCodename[fields.title]?.column_name
        const classIdColumn = attrByCodename[fields.classId]?.column_name
        const showFirstNameColumn = attrByCodename[fields.showFirstName]?.column_name
        const requireFirstNameColumn = attrByCodename[fields.requireFirstName]?.column_name
        const showLastNameColumn = attrByCodename[fields.showLastName]?.column_name
        const requireLastNameColumn = attrByCodename[fields.requireLastName]?.column_name
        const showEmailColumn = attrByCodename[fields.showEmail]?.column_name
        const requireEmailColumn = attrByCodename[fields.requireEmail]?.column_name
        const showPhoneColumn = attrByCodename[fields.showPhone]?.column_name
        const requirePhoneColumn = attrByCodename[fields.requirePhone]?.column_name
        const captchaEnabledColumn = attrByCodename[fields.captchaEnabled]?.column_name

        if (!slugColumn || !targetTypeColumn || !targetIdColumn || !isActiveColumn) return null

        const safeColumns = {
            slug: slugColumn,
            targetType: targetTypeColumn,
            targetId: targetIdColumn,
            contentNodeIdRef: contentNodeIdRefColumn,
            isActive: isActiveColumn,
            expiresAt: expiresAtColumn,
            maxUses: maxUsesColumn,
            useCount: useCountColumn,
            title: titleColumn,
            classId: classIdColumn,
            showFirstName: showFirstNameColumn,
            requireFirstName: requireFirstNameColumn,
            showLastName: showLastNameColumn,
            requireLastName: requireLastNameColumn,
            showEmail: showEmailColumn,
            requireEmail: requireEmailColumn,
            showPhone: showPhoneColumn,
            requirePhone: requirePhoneColumn,
            captchaEnabled: captchaEnabledColumn
        }
        for (const col of Object.values(safeColumns)) {
            if (col && !IDENTIFIER_REGEX.test(col)) return null
        }

        const tableQt = qSchemaTable(schemaName, binding.tableName)
        const matchColumnSql = lookup.type === 'slug' ? `"${safeColumns.slug}"` : 'id'
        const rows = await executor.query<Record<string, unknown>>(
            `
            SELECT id,
                   "${safeColumns.slug}" AS slug,
                   "${safeColumns.targetType}" AS target_type,
                   "${safeColumns.targetId}" AS target_id,
                   ${safeColumns.contentNodeIdRef ? `"${safeColumns.contentNodeIdRef}"` : 'NULL'} AS content_node_id_ref,
                   "${safeColumns.isActive}" AS is_active,
                   ${safeColumns.expiresAt ? `"${safeColumns.expiresAt}"` : 'NULL'} AS expires_at,
                   ${safeColumns.maxUses ? `"${safeColumns.maxUses}"` : 'NULL'} AS max_uses,
                   ${safeColumns.useCount ? `"${safeColumns.useCount}"` : 'NULL'} AS use_count,
                   ${safeColumns.title ? `"${safeColumns.title}"` : 'NULL'} AS title,
                   ${safeColumns.classId ? `"${safeColumns.classId}"` : 'NULL'} AS class_id,
                   ${safeColumns.showFirstName ? `"${safeColumns.showFirstName}"` : 'FALSE'} AS shows_first_name,
                   ${safeColumns.requireFirstName ? `"${safeColumns.requireFirstName}"` : 'FALSE'} AS requires_first_name,
                   ${safeColumns.showLastName ? `"${safeColumns.showLastName}"` : 'FALSE'} AS shows_last_name,
                   ${safeColumns.requireLastName ? `"${safeColumns.requireLastName}"` : 'FALSE'} AS requires_last_name,
                   ${safeColumns.showEmail ? `"${safeColumns.showEmail}"` : 'FALSE'} AS shows_email,
                   ${safeColumns.requireEmail ? `"${safeColumns.requireEmail}"` : 'FALSE'} AS requires_email,
                   ${safeColumns.showPhone ? `"${safeColumns.showPhone}"` : 'FALSE'} AS shows_phone,
                   ${safeColumns.requirePhone ? `"${safeColumns.requirePhone}"` : 'FALSE'} AS requires_phone,
                   ${safeColumns.captchaEnabled ? `"${safeColumns.captchaEnabled}"` : 'FALSE'} AS captcha_enabled
            FROM ${tableQt}
            WHERE ${matchColumnSql} = $1
              ${workspaceId ? 'AND "workspace_id" = $2' : ''}
              AND ${ACTIVE_ROW_SQL}
            ORDER BY ${qColumn('_upl_created_at')} ASC, id ASC
            LIMIT ${lookup.type === 'slug' ? 2 : 1}
            ${forUpdate ? 'FOR UPDATE' : ''}
            `,
            workspaceId ? [lookup.value, workspaceId] : [lookup.value]
        )

        if (lookup.type === 'slug' && rows.length > 1) {
            return null
        }

        const row = rows[0]
        if (!row) return null

        const intake = guestIntakePolicySchema.safeParse({
            showFirstName: row.shows_first_name === true || row.requires_first_name === true,
            requireFirstName: row.requires_first_name === true,
            showLastName: row.shows_last_name === true || row.requires_last_name === true,
            requireLastName: row.requires_last_name === true,
            showEmail: row.shows_email === true || row.requires_email === true,
            requireEmail: row.requires_email === true,
            showPhone: row.shows_phone === true || row.requires_phone === true,
            requirePhone: row.requires_phone === true,
            captchaEnabled: row.captcha_enabled === true
        })
        if (!intake.success) return null

        return {
            id: String(row.id),
            slug: String(row.slug ?? ''),
            title: row.title ?? null,
            targetType: String(row.target_type ?? ''),
            targetId: String(row.target_id ?? ''),
            contentNodeIdRef: typeof row.content_node_id_ref === 'string' ? row.content_node_id_ref : null,
            isActive: row.is_active === true,
            expiresAt: normalizeAccessLinkDate(row.expires_at),
            maxUses: normalizeAccessLinkNumber(row.max_uses),
            useCount: normalizeAccessLinkNumber(row.use_count),
            classId: typeof row.class_id === 'string' ? row.class_id : null,
            intake: intake.data,
            workspaceId,
            binding,
            columns: {
                slug: safeColumns.slug,
                targetType: safeColumns.targetType,
                targetId: safeColumns.targetId,
                contentNodeIdRef: safeColumns.contentNodeIdRef ?? null,
                isActive: safeColumns.isActive,
                expiresAt: safeColumns.expiresAt ?? null,
                maxUses: safeColumns.maxUses ?? null,
                useCount: safeColumns.useCount ?? null,
                title: safeColumns.title ?? null,
                classId: safeColumns.classId ?? null,
                showFirstName: safeColumns.showFirstName ?? null,
                requireFirstName: safeColumns.requireFirstName ?? null,
                showLastName: safeColumns.showLastName ?? null,
                requireLastName: safeColumns.requireLastName ?? null,
                showEmail: safeColumns.showEmail ?? null,
                requireEmail: safeColumns.requireEmail ?? null,
                showPhone: safeColumns.showPhone ?? null,
                requirePhone: safeColumns.requirePhone ?? null,
                captchaEnabled: safeColumns.captchaEnabled ?? null
            }
        }
    }

    const resolveAccessLinkRecordBy = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        lookup: { type: 'slug'; value: string } | { type: 'id'; value: string },
        forUpdate = false,
        workspaceId?: string | null
    ): Promise<AccessLinkRecord | null> => {
        if (workspaceId !== undefined) {
            if (!workspacesEnabled) {
                if (workspaceId !== null) return null
                await setPublicWorkspaceContext(executor, schemaName, null)
                return loadAccessLinkRecordBy(executor, schemaName, config, lookup, null, forUpdate)
            }

            if (!workspaceId || !(await setPublicWorkspaceContext(executor, schemaName, workspaceId))) return null
            return loadAccessLinkRecordBy(executor, schemaName, config, lookup, workspaceId, forUpdate)
        }

        if (!workspacesEnabled) {
            await setPublicWorkspaceContext(executor, schemaName, null)
            return loadAccessLinkRecordBy(executor, schemaName, config, lookup, null, forUpdate)
        }

        const workspaceIds = await listActivePublicWorkspaceIds(executor, schemaName)
        const matchingLinks: AccessLinkRecord[] = []
        for (const workspaceId of workspaceIds) {
            const hasWorkspace = await setPublicWorkspaceContext(executor, schemaName, workspaceId)
            if (!hasWorkspace) {
                continue
            }

            const link = await loadAccessLinkRecordBy(executor, schemaName, config, lookup, workspaceId, forUpdate)
            if (link) {
                matchingLinks.push(link)
            }
        }

        if (matchingLinks.length === 1) {
            await setPublicWorkspaceContext(executor, schemaName, matchingLinks[0].workspaceId)
            return matchingLinks[0]
        }

        await setPublicWorkspaceContext(executor, schemaName, null)
        return null
    }

    const loadAccessLinkRecord = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        slug: string,
        forUpdate = false,
        workspaceId?: string | null
    ): Promise<AccessLinkRecord | null> =>
        resolveAccessLinkRecordBy(executor, schemaName, config, workspacesEnabled, { type: 'slug', value: slug }, forUpdate, workspaceId)

    const loadAccessLinkRecordById = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        linkId: string,
        forUpdate = false,
        workspaceId?: string | null
    ): Promise<AccessLinkRecord | null> =>
        resolveAccessLinkRecordBy(executor, schemaName, config, workspacesEnabled, { type: 'id', value: linkId }, forUpdate, workspaceId)

    const loadCurrentAccessLinkRecordForUpdate = async (
        executor: DbExecutor,
        schemaName: string,
        config: PublicGuestRuntimeConfig,
        workspacesEnabled: boolean,
        link: AccessLinkRecord
    ): Promise<AccessLinkRecord | null> => {
        if (workspacesEnabled && !(await setPublicWorkspaceContext(executor, schemaName, link.workspaceId))) return null
        return loadAccessLinkRecordBy(executor, schemaName, config, { type: 'id', value: link.id }, link.workspaceId, true)
    }

    const assertAccessLinkAvailable = (
        link: AccessLinkRecord,
        options: { enforceQuota: boolean }
    ): { ok: true } | { ok: false; status: number; error: string } => {
        if (!link.isActive) {
            return { ok: false, status: 403, error: 'Access link is inactive' }
        }
        if (link.expiresAt && new Date(link.expiresAt).getTime() <= Date.now()) {
            return { ok: false, status: 403, error: 'Access link has expired' }
        }
        if (options.enforceQuota && typeof link.maxUses === 'number' && !link.columns.useCount) {
            return { ok: false, status: 503, error: 'Access link usage limit cannot be enforced' }
        }
        if (
            options.enforceQuota &&
            typeof link.maxUses === 'number' &&
            typeof link.useCount === 'number' &&
            link.useCount >= link.maxUses
        ) {
            return { ok: false, status: 403, error: 'Access link usage limit reached' }
        }

        return { ok: true }
    }

    const consumeAccessLinkUse = async (executor: DbExecutor, schemaName: string, link: AccessLinkRecord): Promise<boolean> => {
        const useCountColumn = link.columns.useCount
        if (!useCountColumn) {
            return link.maxUses === null
        }

        if (!IDENTIFIER_REGEX.test(useCountColumn) || !IDENTIFIER_REGEX.test(link.columns.isActive)) return false
        if (link.columns.expiresAt && !IDENTIFIER_REGEX.test(link.columns.expiresAt)) return false
        if (link.columns.maxUses && !IDENTIFIER_REGEX.test(link.columns.maxUses)) return false

        const tableQt = qSchemaTable(schemaName, link.binding.tableName)
        const useCountColumnQt = qColumn(useCountColumn)
        const isActiveColumnQt = qColumn(link.columns.isActive)
        const expiresAtCondition = link.columns.expiresAt
            ? `(${qColumn(link.columns.expiresAt)} IS NULL OR ${qColumn(link.columns.expiresAt)} >= NOW())`
            : 'TRUE'
        const maxUsesCondition =
            link.columns.maxUses && link.columns.useCount
                ? `(${qColumn(link.columns.maxUses)} IS NULL OR COALESCE(${qColumn(link.columns.useCount)}, 0) < ${qColumn(
                      link.columns.maxUses
                  )})`
                : 'TRUE'
        const result = await executor.query<{ id: string }>(
            `
            UPDATE ${tableQt}
            SET ${useCountColumnQt} = COALESCE(${useCountColumnQt}, 0) + 1,
                ${qColumn('_upl_updated_at')} = NOW()
            WHERE id = $1
              ${link.workspaceId ? 'AND "workspace_id" = $2' : ''}
              AND ${isActiveColumnQt} = true
              AND ${expiresAtCondition}
              AND ${maxUsesCondition}
              AND ${ACTIVE_ROW_SQL}
            RETURNING id
            `,
            link.workspaceId ? [link.id, link.workspaceId] : [link.id]
        )

        return result.length > 0
    }

    const validateGuestSession = async (
        executor: DbExecutor,
        schemaName: string,
        workspacesEnabled: boolean,
        config: PublicGuestRuntimeConfig,
        studentId: string,
        sessionToken: string
    ): Promise<{ isValid: boolean; accessLinkId: string | null; workspaceId: string | null; quizIntakeVerified: boolean }> => {
        const invalidSession = () => ({ isValid: false, accessLinkId: null, workspaceId: null, quizIntakeVerified: false })
        const tokenPayload = decodeGuestSessionToken(sessionToken)
        if (!tokenPayload || tokenPayload.participantId.toLowerCase() !== studentId.toLowerCase()) {
            return invalidSession()
        }

        const binding = await resolveStudentsBinding(executor, schemaName, config)
        if (!binding) return invalidSession()

        const attrs = resolveTopLevelComponents(binding)
        const attrByCodename = indexByCodename(attrs)
        const studentFields = config.fields.participant
        const tokenColumn = attrByCodename[studentFields.guestSessionToken]?.column_name
        const isGuestColumn = attrByCodename[studentFields.isGuest]?.column_name
        const consentColumns = {
            termsVersion: attrByCodename[studentFields.termsVersion]?.column_name,
            termsAcceptedAt: attrByCodename[studentFields.termsAcceptedAt]?.column_name,
            privacyVersion: attrByCodename[studentFields.privacyVersion]?.column_name,
            privacyAcceptedAt: attrByCodename[studentFields.privacyAcceptedAt]?.column_name
        }
        if (!tokenColumn || !isGuestColumn) return invalidSession()

        if (!IDENTIFIER_REGEX.test(tokenColumn) || !IDENTIFIER_REGEX.test(isGuestColumn)) {
            return invalidSession()
        }

        const hasConsentColumns = Object.values(consentColumns).every(
            (column): column is string => typeof column === 'string' && IDENTIFIER_REGEX.test(column)
        )
        const consentProjection = hasConsentColumns
            ? [
                  `${qColumn(consentColumns.termsVersion)} AS terms_version`,
                  `${qColumn(consentColumns.termsAcceptedAt)} AS terms_accepted_at`,
                  `${qColumn(consentColumns.privacyVersion)} AS privacy_version`,
                  `${qColumn(consentColumns.privacyAcceptedAt)} AS privacy_accepted_at`
              ].join(', ')
            : 'NULL::text AS terms_version, NULL::text AS terms_accepted_at, NULL::text AS privacy_version, NULL::text AS privacy_accepted_at'

        const tableQt = qSchemaTable(schemaName, binding.tableName)
        const candidateWorkspaceIds = workspacesEnabled
            ? tokenPayload.workspaceId
                ? [tokenPayload.workspaceId]
                : await listActivePublicWorkspaceIds(executor, schemaName)
            : [null]

        for (const workspaceId of candidateWorkspaceIds) {
            if (workspacesEnabled) {
                const hasWorkspace = await setPublicWorkspaceContext(executor, schemaName, workspaceId)
                if (!hasWorkspace) {
                    continue
                }
            } else {
                await setPublicWorkspaceContext(executor, schemaName, null)
            }

            const rows = await executor.query<{
                id: string
                guest_session_token: string | null
                terms_version: unknown
                terms_accepted_at: unknown
                privacy_version: unknown
                privacy_accepted_at: unknown
            }>(
                `
                SELECT id,
                       ${qColumn(tokenColumn)} AS guest_session_token,
                       ${consentProjection}
                FROM ${tableQt}
                WHERE id = $1
                  AND ${qColumn(isGuestColumn)} = true
                  AND ${ACTIVE_ROW_SQL}
                LIMIT 1
                `,
                [studentId]
            )

            const storedState = decodeStoredGuestSessionState(rows[0]?.guest_session_token ?? null)
            const isExpired = !storedState || new Date(storedState.expiresAt).getTime() <= Date.now()
            const isTokenBoundToStoredSession =
                storedState?.participantId.toLowerCase() === studentId.toLowerCase() &&
                storedState.participantId.toLowerCase() === tokenPayload.participantId.toLowerCase() &&
                storedState?.linkId === tokenPayload.linkId &&
                (storedState.workspaceId ?? null) === (tokenPayload.workspaceId ?? null) &&
                isSameSecretHash(storedState.secretHash, tokenPayload.secret)
            if (rows.length > 0 && !isExpired && isTokenBoundToStoredSession) {
                const consentRow = rows[0]
                const hasLegalConsentEvidence =
                    hasConsentColumns &&
                    [consentRow.terms_version, consentRow.privacy_version].every(
                        (value) => typeof value === 'string' && value.trim().length > 0
                    ) &&
                    [consentRow.terms_accepted_at, consentRow.privacy_accepted_at].every((value) =>
                        Number.isFinite(value instanceof Date ? value.getTime() : Date.parse(String(value)))
                    )
                return {
                    isValid: true,
                    accessLinkId: tokenPayload.linkId,
                    workspaceId: workspaceId ?? null,
                    quizIntakeVerified: Boolean(storedState.quizIntakeIdempotencyKeyHash && hasLegalConsentEvidence)
                }
            }
        }

        return invalidSession()
    }

    return {
        setPublicWorkspaceContext,
        resolveAccessLinksBinding,
        resolveStudentsBinding,
        resolveQuizBinding,
        resolveContentNodeBinding,
        resolveContentProgressBinding,
        loadAccessLinkRecordBy,
        resolveAccessLinkRecordBy,
        loadAccessLinkRecord,
        loadAccessLinkRecordById,
        loadCurrentAccessLinkRecordForUpdate,
        assertAccessLinkAvailable,
        consumeAccessLinkUse,
        validateGuestSession
    }
}

export type GuestAccessLinkService = ReturnType<typeof createGuestAccessLinkService>
