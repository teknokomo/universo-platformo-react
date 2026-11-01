import { OptimisticLockError, type SqlQueryable } from '@universo-react/utils'
import type { MessengerBotPlatform } from '../shared/messengerBotBindingIdentity'

export type ApplicationBotBindingStatus = 'draft' | 'active' | 'disabled'

export interface ApplicationBotBindingRecord {
    id: string
    applicationId: string
    platform: MessengerBotPlatform
    botUsername: string
    displayName: string | null
    status: ApplicationBotBindingStatus
    shortId: string
    releasedAt: Date | null
    version: number
    createdAt: Date
    updatedAt: Date
}

export interface CreateApplicationBotBindingInput {
    applicationId: string
    platform: MessengerBotPlatform
    botUsername: string
    displayName: string | null
}

export interface UpdateApplicationBotBindingInput {
    applicationId: string
    bindingId: string
    expectedVersion: number
    botUsername?: string
    displayName?: string | null
    status?: ApplicationBotBindingStatus
}

const activeRowPredicate = (alias: string): string => `
    ${alias}._upl_archived = false
    AND ${alias}._upl_deleted = false
    AND ${alias}._app_archived = false
    AND ${alias}._app_deleted = false
`

const APPLICATION_BOT_BINDING_COLUMNS = `
    b.id,
    b.application_id AS "applicationId",
    b.platform,
    b.bot_username AS "botUsername",
    b.display_name AS "displayName",
    b.status,
    b.short_id AS "shortId",
    b.released_at AS "releasedAt",
    COALESCE(b._upl_version, 1) AS "version",
    b._upl_created_at AS "createdAt",
    b._upl_updated_at AS "updatedAt"
`

const assertExpectedVersion = (binding: ApplicationBotBindingRecord, expectedVersion: number): void => {
    if (binding.version === expectedVersion) return

    throw new OptimisticLockError({
        entityId: binding.id,
        entityType: 'application_bot_binding',
        expectedVersion,
        actualVersion: binding.version,
        updatedAt: binding.updatedAt,
        updatedBy: null
    })
}

const mapDatabaseVersionConflict = (
    error: unknown,
    binding: ApplicationBotBindingRecord,
    expectedVersion: number
): OptimisticLockError | null => {
    const databaseError = error as { code?: unknown; detail?: unknown }
    if (databaseError.code !== '40001') return null

    let detail: Record<string, unknown> = {}
    if (typeof databaseError.detail === 'string') {
        try {
            detail = JSON.parse(databaseError.detail) as Record<string, unknown>
        } catch {
            detail = {}
        }
    }

    const actualVersion = Number(detail.actualVersion)
    const updatedAt = typeof detail.updatedAt === 'string' ? new Date(detail.updatedAt) : binding.updatedAt

    return new OptimisticLockError({
        entityId: binding.id,
        entityType: 'application_bot_binding',
        expectedVersion,
        actualVersion: Number.isSafeInteger(actualVersion) ? actualVersion : binding.version,
        updatedAt: Number.isFinite(updatedAt.getTime()) ? updatedAt : binding.updatedAt,
        updatedBy: null
    })
}

export async function listApplicationBotBindings(executor: SqlQueryable, applicationId: string): Promise<ApplicationBotBindingRecord[]> {
    return executor.query<ApplicationBotBindingRecord>(
        `
        SELECT ${APPLICATION_BOT_BINDING_COLUMNS}
        FROM applications.rel_application_bot_bindings b
        WHERE b.application_id = $1
          AND ${activeRowPredicate('b')}
        ORDER BY b._upl_created_at DESC, b.id DESC
        `,
        [applicationId]
    )
}

export async function findApplicationBotBindingById(
    executor: SqlQueryable,
    applicationId: string,
    bindingId: string
): Promise<ApplicationBotBindingRecord | null> {
    const rows = await executor.query<ApplicationBotBindingRecord>(
        `
        SELECT ${APPLICATION_BOT_BINDING_COLUMNS}
        FROM applications.rel_application_bot_bindings b
        WHERE b.application_id = $1
          AND b.id = $2
          AND b.released_at IS NULL
          AND ${activeRowPredicate('b')}
        LIMIT 1
        `,
        [applicationId, bindingId]
    )

    return rows[0] ?? null
}

export async function createApplicationBotBindingInTransaction(
    executor: SqlQueryable,
    input: CreateApplicationBotBindingInput
): Promise<ApplicationBotBindingRecord> {
    const rows = await executor.query<ApplicationBotBindingRecord>(
        `
        SELECT *
        FROM applications.create_application_bot_binding($1, $2, $3, $4)
        `,
        [input.applicationId, input.platform, input.botUsername, input.displayName]
    )

    const created = rows[0]
    if (!created) throw new Error('Application bot binding was not created')
    return created
}

export async function updateApplicationBotBindingInTransaction(
    executor: SqlQueryable,
    input: UpdateApplicationBotBindingInput
): Promise<ApplicationBotBindingRecord | null> {
    const current = await findApplicationBotBindingById(executor, input.applicationId, input.bindingId)
    if (!current) return null
    assertExpectedVersion(current, input.expectedVersion)

    const patch: Record<string, string | null> = {}
    if (input.botUsername !== undefined && input.botUsername !== current.botUsername) patch.botUsername = input.botUsername
    if (input.displayName !== undefined && input.displayName !== current.displayName) patch.displayName = input.displayName
    if (input.status !== undefined && input.status !== current.status) patch.status = input.status
    if (Object.keys(patch).length === 0) {
        // Keep the atomic database boundary in the flow so it can lock the row
        // and validate expectedVersion even when the requested values are unchanged.
        patch.botUsername = current.botUsername
    }

    try {
        const rows = await executor.query<ApplicationBotBindingRecord>(
            `
            SELECT *
            FROM applications.update_application_bot_binding($1, $2, $3, $4::jsonb)
            `,
            [input.applicationId, input.bindingId, input.expectedVersion, JSON.stringify(patch)]
        )
        return rows[0] ?? null
    } catch (error) {
        const conflict = mapDatabaseVersionConflict(error, current, input.expectedVersion)
        if (conflict) throw conflict
        throw error
    }
}

export async function releaseApplicationBotBindingInTransaction(
    executor: SqlQueryable,
    input: { applicationId: string; bindingId: string; expectedVersion: number }
): Promise<ApplicationBotBindingRecord | null> {
    const current = await findApplicationBotBindingById(executor, input.applicationId, input.bindingId)
    if (!current) return null
    assertExpectedVersion(current, input.expectedVersion)

    try {
        const rows = await executor.query<ApplicationBotBindingRecord>(
            `
            SELECT *
            FROM applications.release_application_bot_binding($1, $2, $3)
            `,
            [input.applicationId, input.bindingId, input.expectedVersion]
        )
        return rows[0] ?? null
    } catch (error) {
        const conflict = mapDatabaseVersionConflict(error, current, input.expectedVersion)
        if (conflict) throw conflict
        throw error
    }
}

export async function releaseActiveApplicationBotBindingsForApplication(executor: SqlQueryable, applicationId: string): Promise<number> {
    const rows = await executor.query<{ releasedCount: number }>(
        `SELECT applications.release_application_bot_bindings_for_application($1) AS "releasedCount"`,
        [applicationId]
    )

    return Number(rows[0]?.releasedCount ?? 0)
}

export interface MessengerBindingAttribution {
    platform: MessengerBotPlatform
}

export async function resolveMessengerBindingAttribution(
    executor: SqlQueryable,
    applicationId: string,
    shortId: string
): Promise<MessengerBindingAttribution | null> {
    if (!/^[A-Za-z0-9_-]{22}$/.test(shortId)) return null

    const rows = await executor.query<MessengerBindingAttribution>(
        `
        SELECT b.platform
        FROM applications.rel_application_bot_bindings b
        INNER JOIN applications.obj_applications a ON a.id = b.application_id
        WHERE b.application_id = $1
          AND b.short_id = $2
          AND b.status = 'active'
          AND b.released_at IS NULL
          AND ${activeRowPredicate('b')}
          AND ${activeRowPredicate('a')}
          AND a.is_public = true
        LIMIT 1
        `,
        [applicationId, shortId]
    )

    return rows[0] ?? null
}
