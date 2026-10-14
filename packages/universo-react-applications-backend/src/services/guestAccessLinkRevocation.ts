import { isUuidV7, type DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { revokeGuestSessionIdempotencyForAccessLink } from '../persistence/guestSessionIdempotencyStore'
import { revokeGuestAssessmentAttemptsForAccessLink } from './guestAssessmentApplicationRevocation'
import { resolvePublicGuestRuntimeConfig } from './publicGuestRuntimeConfig'
import { lockPublicWorkspaceForMutation, resolvePublicRuntimeObject, resolveTopLevelComponents } from '../shared/publicRuntimeAccess'
import { IDENTIFIER_REGEX, UpdateFailure, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const hasGuestRuntimeConfiguration = (settings: Record<string, unknown>): boolean => {
    const publicRuntime = isRecord(settings.publicRuntime) ? settings.publicRuntime : null
    const guest = publicRuntime && isRecord(publicRuntime.guest) ? publicRuntime.guest : settings.guestRuntime
    return isRecord(guest)
}

/** Serialize access-link mutation with workspace deletion before either flow locks child rows. */
export const lockGuestAccessLinkWorkspace = async (input: {
    executor: DbExecutor
    schemaName: string
    workspacesEnabled: boolean
    workspaceId: string | null
}): Promise<void> => {
    if (!input.workspacesEnabled) return
    if (!isUuidV7(input.workspaceId ?? '')) throw new UpdateFailure(404, { error: 'Workspace not found' })

    if (!(await lockPublicWorkspaceForMutation(input.executor, input.schemaName, input.workspaceId))) {
        throw new UpdateFailure(404, { error: 'Workspace not found' })
    }
}

/** Revoke all copied or active guest sessions bound to one access link inside the caller's transaction. */
export const revokeGuestSessionsForAccessLink = async (input: {
    executor: DbExecutor
    applicationId: string
    schemaName: string
    settings: Record<string, unknown>
    workspacesEnabled: boolean
    workspaceId: string | null
    accessLinkId: string
    actorUserId: string
}): Promise<number> => {
    if (!isUuidV7(input.applicationId)) throw new Error('Application identity is invalid during guest session revocation')
    if (!isUuidV7(input.accessLinkId)) throw new Error('Access link identity is invalid during guest session revocation')
    if (input.workspacesEnabled && !isUuidV7(input.workspaceId ?? '')) {
        throw new Error('Access link workspace is unavailable during guest session revocation')
    }

    await revokeGuestSessionIdempotencyForAccessLink(
        input.executor,
        input.applicationId,
        input.accessLinkId,
        input.workspacesEnabled ? input.workspaceId : null
    )
    await revokeGuestAssessmentAttemptsForAccessLink(
        input.executor,
        input.schemaName,
        input.settings,
        input.workspacesEnabled ? input.workspaceId : null,
        input.accessLinkId
    )

    const config = resolvePublicGuestRuntimeConfig(input.settings)
    if (!config) {
        if (hasGuestRuntimeConfiguration(input.settings)) {
            throw new Error('Guest runtime mapping is incomplete during access-link revocation')
        }
        return 0
    }

    const participantBinding = await resolvePublicRuntimeObject(input.executor, input.schemaName, config.objects.participants)
    if (!participantBinding) throw new Error('Guest participant storage is unavailable during access-link revocation')

    const participantFields = Object.fromEntries(
        resolveTopLevelComponents(participantBinding).map((component) => [resolveRuntimeCodenameText(component.codename), component])
    )
    const isGuestColumn = participantFields[config.fields.participant.isGuest]?.column_name
    const sessionTokenColumn = participantFields[config.fields.participant.guestSessionToken]?.column_name
    if (!isGuestColumn || !sessionTokenColumn || !IDENTIFIER_REGEX.test(isGuestColumn) || !IDENTIFIER_REGEX.test(sessionTokenColumn)) {
        throw new Error('Guest participant session fields are unavailable during access-link revocation')
    }

    const participantTable = qSchemaTable(input.schemaName, participantBinding.tableName)
    const workspacePredicate = input.workspacesEnabled ? `AND ${qColumn('workspace_id')} = $2` : `AND ${qColumn('workspace_id')} IS NULL`
    const parameters: unknown[] = [`"linkId":"${input.accessLinkId.toLowerCase()}"`]
    if (input.workspacesEnabled) parameters.push(input.workspaceId)
    parameters.push(input.actorUserId)

    const rows = await input.executor.query<{ id: string }>(
        `
        UPDATE ${participantTable}
        SET ${qColumn(sessionTokenColumn)} = NULL,
            ${qColumn('_upl_updated_at')} = NOW(),
            ${qColumn('_upl_updated_by')} = $${parameters.length},
            ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1
        WHERE ${qColumn(isGuestColumn)} = TRUE
          AND ${qColumn(sessionTokenColumn)} IS NOT NULL
          AND POSITION($1 IN ${qColumn(sessionTokenColumn)}) > 0
          ${workspacePredicate}
          AND ${qColumn('_upl_deleted')} = false
          AND ${qColumn('_app_deleted')} = false
        RETURNING ${qColumn('id')}
        `,
        parameters
    )

    return rows.length
}
