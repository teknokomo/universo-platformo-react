import type { Knex } from 'knex'
import { generateUuidV7 } from '@universo-react/utils'
import { createMessengerBotBindingShortId } from '../../shared/messengerBotBindingIdentity'

export const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Application bot binding PostgreSQL integration tests')
}

export const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const databaseTestRole = DATABASE_TEST_URL ? decodeURIComponent(new URL(DATABASE_TEST_URL).username) : undefined
const rollbackSignal = new Error('rollback Application bot binding integration fixture')
export const createTestShortId = (): string => createMessengerBotBindingShortId()
export const inactiveApplicationMembershipColumns = ['_upl_archived', '_upl_deleted', '_app_archived', '_app_deleted'] as const

export const withRollback = async <T>(knex: Knex, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> => {
    let result!: T
    try {
        await knex.transaction(async (trx) => {
            result = await callback(trx)
            throw rollbackSignal
        })
    } catch (error) {
        if (error !== rollbackSignal) throw error
    }
    return result
}

export const expectPostgresError = async (
    trx: Knex.Transaction,
    code: string,
    operation: (savepoint: Knex.Transaction) => Promise<unknown>
): Promise<void> => {
    await expect(trx.transaction(operation)).rejects.toMatchObject({ code })
}

export const insertApplication = async (trx: Knex.Transaction, applicationId = generateUuidV7(), isPublic = true): Promise<string> => {
    await trx.raw(
        `INSERT INTO applications.obj_applications (id, name, is_public)
         VALUES (?, ?::jsonb, ?)`,
        [
            applicationId,
            JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `Binding test ${applicationId}` } } }),
            isPublic
        ]
    )
    return applicationId
}

export const insertApplicationMember = async (
    trx: Knex.Transaction,
    applicationId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' = 'owner'
): Promise<void> => {
    await trx.raw(
        `INSERT INTO auth.users (
            id, instance_id, aud, role, email, encrypted_password, confirmation_token, created_at, updated_at
         ) VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', '', now(), now())`,
        [userId, `bot-binding-${userId}@example.test`]
    )
    await trx.raw(
        `INSERT INTO applications.rel_application_users (
            id, application_id, user_id, role, _upl_created_by, _upl_updated_by
         ) VALUES (?, ?, ?, ?, ?, ?)`,
        [generateUuidV7(), applicationId, userId, role, userId, userId]
    )
}

export const insertBinding = async (
    trx: Knex.Transaction,
    input: {
        applicationId: string
        platform: 'max' | 'telegram'
        botUsername: string
        shortId: string
        id?: string
        status?: 'draft' | 'active' | 'disabled'
        displayName?: string | null
    }
): Promise<string> => {
    const id = input.id ?? generateUuidV7()
    await trx.raw(
        `INSERT INTO applications.rel_application_bot_bindings (
            id, application_id, platform, bot_username, display_name, status, short_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, input.applicationId, input.platform, input.botUsername, input.displayName ?? null, input.status ?? 'draft', input.shortId]
    )
    return id
}

export const insertAuditAsCurrentActor = async (
    trx: Knex.Transaction,
    input: { applicationId: string; bindingId: string; actorUserId: string }
): Promise<void> => {
    await trx.raw(
        `INSERT INTO applications.rel_application_control_audits (
            id, application_id, binding_id, event_type, changed_fields, previous_version, new_version,
            previous_show_in_app_list, new_show_in_app_list,
            _upl_created_by, _upl_updated_by
         ) VALUES (?, ?, ?, 'bot_binding_updated', '[]'::jsonb, 1, 2, NULL, NULL, ?, ?)`,
        [generateUuidV7(), input.applicationId, input.bindingId, input.actorUserId, input.actorUserId]
    )
}

/** Simulates direct authenticated/anonymous SQL privileges; backend request flows use the configured login role. */
export const withDatabaseRole = async <T>(
    trx: Knex.Transaction,
    role: 'authenticated' | 'anon',
    userId: string | undefined,
    callback: () => Promise<T>
): Promise<T> => {
    await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify(userId ? { sub: userId } : {})])
    await trx.raw(`SET LOCAL ROLE ${role}`)
    try {
        const result = await callback()
        await trx.raw('RESET ROLE')
        return result
    } catch (error) {
        // A PostgreSQL error aborts this transaction until its savepoint rolls back, so RESET ROLE
        // can itself fail with 25P02. Preserve the operation's SQLSTATE; rollback restores the
        // transaction-local role in that case.
        await trx.raw('RESET ROLE').catch(() => undefined)
        throw error
    }
}

export const withRequestClaims = async <T>(trx: Knex.Transaction, userId: string | undefined, callback: () => Promise<T>): Promise<T> => {
    // ensureAuthWithRls applies JWT claims on the pinned connection without SET ROLE. The integration runner derives
    // DATABASE_TEST_URL from the same generated database environment as the backend, so this checks that the test
    // exercises the configured request role rather than accidentally impersonating PostgREST's authenticated role.
    const roleResult = await trx.raw('SELECT current_user::text AS "currentUser", session_user::text AS "sessionUser"')
    const roleRow = roleResult.rows[0] as { currentUser: string; sessionUser: string } | undefined
    expect(roleRow).toBeDefined()
    expect(roleRow?.currentUser).toBe(databaseTestRole)
    expect(roleRow?.currentUser).toBe(roleRow?.sessionUser)
    await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify(userId ? { sub: userId } : {})])
    return callback()
}

export const insertCommittedApplication = async (knex: Knex): Promise<string> => {
    const applicationId = generateUuidV7()
    await knex.raw(
        `INSERT INTO applications.obj_applications (id, name, is_public)
         VALUES (?, ?::jsonb, true)`,
        [applicationId, JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: `Binding race ${applicationId}` } } })]
    )
    return applicationId
}

export const deleteCommittedApplicationFixture = async (knex: Knex, applicationId: string, ownerUserId?: string): Promise<void> => {
    if (ownerUserId) {
        await knex.raw(`DELETE FROM applications.rel_application_users WHERE application_id = ?`, [applicationId])
        await knex.raw(`DELETE FROM auth.users WHERE id = ?`, [ownerUserId])
    }
    await knex.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])
}

export const waitForLockWait = async (knex: Knex, pid: number, timeoutMs = 5000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const result = await knex.raw(`SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?`, [pid])
        if (result.rows[0]?.wait_event_type === 'Lock') return true
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return false
}

export const runConflictingBindingInsertRace = async (
    knex: Knex,
    winner: Parameters<typeof insertBinding>[1],
    contender: Parameters<typeof insertBinding>[1],
    conflictColumn: 'bot_username' | 'short_id',
    conflictValue: string
): Promise<void> => {
    const first = await knex.transaction()
    let second: Knex.Transaction | undefined
    let firstFinished = false
    let secondFinished = false
    let competingInsert: Promise<{ id: string } | { error: unknown }> | undefined

    try {
        await insertBinding(first, winner)
        second = await knex.transaction()
        const pidResult = await second.raw(`SELECT pg_backend_pid() AS pid`)
        const competingPid = Number(pidResult.rows[0]?.pid)
        competingInsert = insertBinding(second, contender).then(
            (id) => ({ id }),
            (error: unknown) => ({ error })
        )

        expect(await waitForLockWait(knex, competingPid)).toBe(true)
        await first.rollback()
        firstFinished = true

        const outcome = await competingInsert
        expect(outcome).toHaveProperty('id')
        const rows = await second.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE ${conflictColumn} = ?`, [
            conflictValue
        ])
        expect(rows.rows).toHaveLength(1)
    } finally {
        if (!firstFinished) await first.rollback().catch(() => undefined)
        if (second) {
            if (competingInsert) await Promise.allSettled([competingInsert])
            if (!secondFinished) {
                await second.rollback().catch(() => undefined)
                secondFinished = true
            }
        }
    }
}

export const createIntegrationKnex = async (): Promise<Knex> => {
    const knexModule = await import('knex')
    return knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 3 } })
}
