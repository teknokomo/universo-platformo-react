import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import { revokeGuestSessionIdempotencyForWorkspace } from '../persistence/guestSessionIdempotencyStore'
import {
    listStartedGuestAssessmentAttemptIdentities,
    listStartedGuestAssessmentAttemptIdentitiesForAccessLink
} from '../persistence/guestAssessmentAttemptStore'
import { finalizeGuestAssessmentAttempt } from './guestAssessmentAttemptLifecycleService'
import { resolveGuestAssessmentRuntimeTables } from './guestAssessmentRuntimeTables'
import { resolvePublicGuestRuntimeConfig } from './publicGuestRuntimeConfig'
import {
    listActivePublicWorkspaceIds,
    lockPublicWorkspaceForMutation,
    resolvePublicRuntimeObject,
    resolveTopLevelComponents,
    setPublicWorkspaceContext
} from '../shared/publicRuntimeAccess'
import { IDENTIFIER_REGEX, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'

const REVOCATION_BATCH_SIZE = 500
const ASSESSMENT_OBJECT_KEYS = ['assessments', 'quizzes', 'assessmentResponses', 'quizResponses', 'assessmentAttempts', 'quizAttempts']
const ASSESSMENT_FIELD_KEYS = [
    'assessment',
    'quiz',
    'assessmentQuestion',
    'quizQuestion',
    'assessmentResponse',
    'quizResponse',
    'assessmentAttempt',
    'quizAttempt'
]

const revokeStartedAttemptsForWorkspace = async (
    executor: DbExecutor,
    schemaName: string,
    config: NonNullable<ReturnType<typeof resolvePublicGuestRuntimeConfig>>,
    workspaceId: string | null,
    now: Date
): Promise<number> => {
    const persistence = await resolveGuestAssessmentRuntimeTables(executor, schemaName, config, workspaceId)
    if (!persistence) throw new Error('Guest assessment storage is unavailable during access withdrawal')

    let revokedCount = 0
    let afterId: string | undefined
    for (;;) {
        const attempts = await listStartedGuestAssessmentAttemptIdentities(
            executor,
            persistence.attemptTable,
            REVOCATION_BATCH_SIZE,
            afterId
        )
        if (attempts.length === 0) break

        for (const attempt of attempts) {
            const finalized = await finalizeGuestAssessmentAttempt(
                executor,
                persistence.attemptTable,
                persistence.responseTable,
                attempt.id,
                attempt.studentId,
                'revoked',
                now
            )
            if (String(finalized?.status ?? '').toLowerCase() === 'revoked') revokedCount += 1
        }

        afterId = attempts[attempts.length - 1]?.id
        if (attempts.length < REVOCATION_BATCH_SIZE) break
    }

    return revokedCount
}

/** Finalize active attempts belonging to one revoked access link before the caller commits. */
export const revokeGuestAssessmentAttemptsForAccessLink = async (
    executor: DbExecutor,
    schemaName: string,
    settings: unknown,
    workspaceId: string | null,
    accessLinkId: string,
    now = new Date()
): Promise<number> => {
    const normalizedSettings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
    const config = resolvePublicGuestRuntimeConfig(normalizedSettings as Record<string, unknown>)
    if (!config) {
        if (hasAssessmentMapping(normalizedSettings as Record<string, unknown>)) {
            throw new Error('Guest assessment mapping is incomplete during access-link revocation')
        }
        return 0
    }
    if (!config.assessment) return 0

    const persistence = await resolveGuestAssessmentRuntimeTables(executor, schemaName, config, workspaceId)
    if (!persistence) throw new Error('Guest assessment storage is unavailable during access-link revocation')

    let revokedCount = 0
    let afterId: string | undefined
    for (;;) {
        const attempts = await listStartedGuestAssessmentAttemptIdentitiesForAccessLink(
            executor,
            persistence.attemptTable,
            accessLinkId,
            REVOCATION_BATCH_SIZE,
            afterId
        )
        if (attempts.length === 0) break

        for (const attempt of attempts) {
            const finalized = await finalizeGuestAssessmentAttempt(
                executor,
                persistence.attemptTable,
                persistence.responseTable,
                attempt.id,
                attempt.studentId,
                'revoked',
                now
            )
            if (String(finalized?.status ?? '').toLowerCase() === 'revoked') revokedCount += 1
        }

        afterId = attempts[attempts.length - 1]?.id
        if (attempts.length < REVOCATION_BATCH_SIZE) break
    }

    return revokedCount
}

const revokeGuestSessionsForWorkspace = async (
    executor: DbExecutor,
    schemaName: string,
    config: NonNullable<ReturnType<typeof resolvePublicGuestRuntimeConfig>>,
    workspaceId: string | null
): Promise<void> => {
    const participantBinding = await resolvePublicRuntimeObject(executor, schemaName, config.objects.participants)
    if (!participantBinding) throw new Error('Guest participant storage is unavailable during access withdrawal')

    const participantFields = Object.fromEntries(
        resolveTopLevelComponents(participantBinding).map((component) => [resolveRuntimeCodenameText(component.codename), component])
    )
    const isGuestColumn = participantFields[config.fields.participant.isGuest]?.column_name
    const sessionTokenColumn = participantFields[config.fields.participant.guestSessionToken]?.column_name
    if (!isGuestColumn || !sessionTokenColumn || !IDENTIFIER_REGEX.test(isGuestColumn) || !IDENTIFIER_REGEX.test(sessionTokenColumn)) {
        throw new Error('Guest participant session fields are unavailable during access withdrawal')
    }

    const participantTable = qSchemaTable(schemaName, participantBinding.tableName)
    await executor.query(
        `
        UPDATE ${participantTable}
        SET ${qColumn(sessionTokenColumn)} = NULL,
            ${qColumn('_upl_updated_at')} = NOW()
        WHERE ${qColumn(isGuestColumn)} = TRUE
          AND ${qColumn(sessionTokenColumn)} IS NOT NULL
          ${workspaceId ? 'AND "workspace_id" = $1' : ''}
        RETURNING id
        `,
        workspaceId ? [workspaceId] : []
    )
}

const hasAssessmentMapping = (settings: Record<string, unknown>): boolean => {
    const publicRuntime = settings.publicRuntime && typeof settings.publicRuntime === 'object' ? settings.publicRuntime : null
    const guest =
        publicRuntime && 'guest' in publicRuntime && publicRuntime.guest && typeof publicRuntime.guest === 'object'
            ? publicRuntime.guest
            : settings.guestRuntime && typeof settings.guestRuntime === 'object'
            ? settings.guestRuntime
            : null
    if (!guest || Array.isArray(guest)) return false

    const guestRecord = guest as Record<string, unknown>
    const objects = guestRecord.objects && typeof guestRecord.objects === 'object' ? (guestRecord.objects as Record<string, unknown>) : {}
    const fields = guestRecord.fields && typeof guestRecord.fields === 'object' ? (guestRecord.fields as Record<string, unknown>) : {}
    return [...ASSESSMENT_OBJECT_KEYS].some((key) => key in objects) || ASSESSMENT_FIELD_KEYS.some((key) => key in fields)
}

const hasGuestSessionMapping = (settings: Record<string, unknown>): boolean => {
    const publicRuntime = settings.publicRuntime && typeof settings.publicRuntime === 'object' ? settings.publicRuntime : null
    const guest =
        publicRuntime && 'guest' in publicRuntime && publicRuntime.guest && typeof publicRuntime.guest === 'object'
            ? publicRuntime.guest
            : settings.guestRuntime && typeof settings.guestRuntime === 'object'
            ? settings.guestRuntime
            : null
    if (!guest || Array.isArray(guest)) return false

    const guestRecord = guest as Record<string, unknown>
    const objects = guestRecord.objects && typeof guestRecord.objects === 'object' ? (guestRecord.objects as Record<string, unknown>) : {}
    const fields = guestRecord.fields && typeof guestRecord.fields === 'object' ? (guestRecord.fields as Record<string, unknown>) : {}
    const participantFields = fields.participant ?? fields.student
    return (
        (typeof objects.participants === 'string' || typeof objects.students === 'string') &&
        Boolean(participantFields && typeof participantFields === 'object' && 'guestSessionToken' in participantFields)
    )
}

/** Invalidate guest sessions and finalize every active quiz attempt before application withdrawal commits. */
export const revokeGuestAssessmentAttemptsForApplication = async (
    executor: DbExecutor,
    schemaName: string | null,
    workspacesEnabled: boolean,
    settings: unknown,
    now = new Date()
): Promise<number> => {
    const normalizedSettings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
    const config = resolvePublicGuestRuntimeConfig(normalizedSettings as Record<string, unknown>)
    if (!config) {
        if (
            hasAssessmentMapping(normalizedSettings as Record<string, unknown>) ||
            hasGuestSessionMapping(normalizedSettings as Record<string, unknown>)
        ) {
            throw new Error('Guest runtime mapping is incomplete during application access withdrawal')
        }
        return 0
    }
    if (!schemaName) throw new Error('Guest assessment application schema is unavailable during access withdrawal')

    const workspaceIds: Array<string | null> = workspacesEnabled ? await listActivePublicWorkspaceIds(executor, schemaName) : [null]
    let revokedCount = 0

    for (const workspaceId of workspaceIds) {
        if (workspacesEnabled && !(await lockPublicWorkspaceForMutation(executor, schemaName, workspaceId))) {
            throw new Error('Guest assessment workspace changed during application access withdrawal')
        }
        if (workspacesEnabled && !(await setPublicWorkspaceContext(executor, schemaName, workspaceId))) {
            throw new Error('Guest assessment workspace changed during application access withdrawal')
        }
        await revokeGuestSessionsForWorkspace(executor, schemaName, config, workspaceId)
        if (config.assessment) {
            revokedCount += await revokeStartedAttemptsForWorkspace(executor, schemaName, config, workspaceId, now)
        }
    }

    if (workspacesEnabled && !(await setPublicWorkspaceContext(executor, schemaName, null))) {
        throw new Error('Guest assessment workspace context could not be cleared during application access withdrawal')
    }
    return revokedCount
}

/** Clear workspace-scoped guest session secrets before its business rows are archived. */
export const revokeGuestSessionSecretsForWorkspace = async (
    executor: DbExecutor,
    schemaName: string,
    applicationId: string,
    settings: unknown,
    workspaceId: string
): Promise<number> => {
    const normalizedSettings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
    const config = resolvePublicGuestRuntimeConfig(normalizedSettings as Record<string, unknown>)
    if (!config && hasGuestSessionMapping(normalizedSettings as Record<string, unknown>)) {
        throw new Error('Guest runtime mapping is incomplete during workspace deletion')
    }

    if (config) {
        if (!(await setPublicWorkspaceContext(executor, schemaName, workspaceId))) {
            throw new Error('Guest session workspace changed during workspace deletion')
        }
        await revokeGuestSessionsForWorkspace(executor, schemaName, config, workspaceId)
    }

    return revokeGuestSessionIdempotencyForWorkspace(executor, applicationId, workspaceId, schemaName)
}

/** Finalize workspace-scoped attempts from saved answers before the caller archives their rows. */
export const revokeGuestAssessmentAttemptsForWorkspace = async (
    executor: DbExecutor,
    schemaName: string,
    settings: unknown,
    workspaceId: string,
    now = new Date()
): Promise<number> => {
    const normalizedSettings = settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}
    const config = resolvePublicGuestRuntimeConfig(normalizedSettings as Record<string, unknown>)
    if (!config) {
        if (hasAssessmentMapping(normalizedSettings as Record<string, unknown>)) {
            throw new Error('Guest assessment mapping is incomplete during workspace deletion')
        }
        return 0
    }
    if (!config.assessment) return 0
    if (!(await setPublicWorkspaceContext(executor, schemaName, workspaceId))) {
        throw new Error('Guest assessment workspace changed during workspace deletion')
    }

    return revokeStartedAttemptsForWorkspace(executor, schemaName, config, workspaceId, now)
}
