import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    insertApplication,
    withDatabaseRole
} from './applicationBotBindings.integrationSupport'
import { generateUuidV7 } from '@universo-react/utils'
import { createKnexExecutor } from '@universo-react/database'
import {
    findEconomyIdempotency,
    purgeExpiredEconomyIdempotency,
    saveEconomyIdempotency,
    type NewEconomyIdempotencyRecord
} from '../../persistence/economyIdempotencyStore'

/**
 * PostgreSQL invariants for the runtime economy idempotency store (plan D7/B8).
 * The table lives in the platform `applications` schema (guest-session
 * precedent), so it cannot use a temporary application schema: every test runs
 * inside `withRollback` and relies on the platform migration being applied by
 * the integration runner (`ensurePlatformMigrations`).
 */

const FINGERPRINT_A = 'a'.repeat(64)
const FINGERPRINT_B = 'b'.repeat(64)

/** Deterministic sha256-shaped hex digest stand-in (the store validates the format). */
const keyHashFor = (key: string) => key.replace(/-/g, '').padEnd(64, '0').slice(0, 64)

const buildRecord = (overrides: Partial<NewEconomyIdempotencyRecord> = {}): NewEconomyIdempotencyRecord => ({
    applicationId: overrides.applicationId ?? generateUuidV7(),
    userId: overrides.userId ?? generateUuidV7(),
    workspaceId: overrides.workspaceId ?? null,
    keyHash: overrides.keyHash ?? keyHashFor(generateUuidV7()),
    bodyFingerprint: overrides.bodyFingerprint ?? FINGERPRINT_A,
    response: overrides.response ?? { operationId: generateUuidV7(), walletBalance: 1000, cargo: [] },
    statusCode: overrides.statusCode ?? 200,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()
})

const countScopedRows = async (
    executor: { query: (sql: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>> },
    scope: { applicationId: string; userId: string; keyHash: string }
): Promise<number> => {
    const rows = await executor.query(
        `SELECT COUNT(*)::int AS count FROM applications.obj_economy_idempotency
         WHERE application_id = $1 AND user_id = $2 AND key_hash = $3`,
        [scope.applicationId, scope.userId, scope.keyHash]
    )
    return Number(rows[0]?.count ?? 0)
}

describeIntegration('Economy idempotency store PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('round-trips a stored trade response and keeps the first winner under the scoped unique key', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const executor = createKnexExecutor(trx)
            const record = buildRecord({ applicationId })
            const userId = record.userId
            const keyHash = record.keyHash

            expect(await saveEconomyIdempotency(executor, record)).toBe(true)

            const stored = await findEconomyIdempotency(executor, { applicationId, userId, keyHash })
            expect(stored).not.toBeNull()
            expect(stored).toMatchObject({
                bodyFingerprint: FINGERPRINT_A,
                response: record.response,
                statusCode: 200
            })
            expect(Date.parse(stored!.expiresAt)).toBeGreaterThan(Date.now())

            // Lost the scoped-unique race: DO NOTHING keeps the winner's row verbatim
            // (a different fingerprint must never overwrite the stored response).
            const loser = await saveEconomyIdempotency(executor, {
                ...record,
                bodyFingerprint: FINGERPRINT_B,
                response: { operationId: generateUuidV7(), walletBalance: 0, cargo: [] }
            })
            expect(loser).toBe(false)
            const winnerAfterRace = await findEconomyIdempotency(executor, { applicationId, userId, keyHash })
            expect(winnerAfterRace?.bodyFingerprint).toBe(FINGERPRINT_A)
            expect(winnerAfterRace?.response).toEqual(record.response)
        })
    })

    it('replaces an EXPIRED row on the scoped-unique conflict instead of failing open (fail-closed re-record)', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const executor = createKnexExecutor(trx)
            const keyHash = keyHashFor(generateUuidV7())

            const expired = buildRecord({
                applicationId,
                keyHash,
                expiresAt: new Date(Date.now() - 1000).toISOString()
            })
            expect(await saveEconomyIdempotency(executor, expired)).toBe(true)
            expect(await findEconomyIdempotency(executor, { applicationId, userId: expired.userId, keyHash })).toBeNull()

            // The stale row still occupies the scoped-unique slot: the retry's save
            // must REPLACE it (not silently drop the record and commit unrecorded).
            // The retry reuses the SAME (application, user, key) scope — a fresh
            // userId would insert a separate row and exercise nothing.
            const retry = buildRecord({ applicationId, userId: expired.userId, keyHash, response: { retried: true } })
            expect(await saveEconomyIdempotency(executor, retry)).toBe(true)
            const stored = await findEconomyIdempotency(executor, { applicationId, userId: retry.userId, keyHash })
            expect(stored).not.toBeNull()
            expect(stored?.response).toEqual({ retried: true })

            // Exactly one row remains for the replaced scope.
            expect(await countScopedRows(executor, { applicationId, userId: expired.userId, keyHash })).toBe(1)

            // A LIVE row is still immutable for race losers (no overwrite).
            const loser = await saveEconomyIdempotency(executor, {
                ...retry,
                userId: retry.userId,
                response: { shouldNotOverwrite: true }
            })
            expect(loser).toBe(false)
            expect(await findEconomyIdempotency(executor, { applicationId, userId: retry.userId, keyHash })).toMatchObject({
                response: { retried: true }
            })
        })
    })

    it('scopes (application, user, key hash) triples independently of other applications and users', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const executor = createKnexExecutor(trx)
            const keyHash = keyHashFor(generateUuidV7())
            const userA = generateUuidV7()
            const userB = generateUuidV7()

            const base = buildRecord({ applicationId, keyHash })
            const recordA = { ...base, userId: userA, response: { wallet: 'A' } }
            const recordB = { ...base, userId: userB, response: { wallet: 'B' } }

            expect(await saveEconomyIdempotency(executor, recordA)).toBe(true)
            expect(await saveEconomyIdempotency(executor, recordB)).toBe(true)

            const storedA = await findEconomyIdempotency(executor, { applicationId, userId: userA, keyHash })
            const storedB = await findEconomyIdempotency(executor, { applicationId, userId: userB, keyHash })
            expect(storedA?.response).toEqual({ wallet: 'A' })
            expect(storedB?.response).toEqual({ wallet: 'B' })
        })
    })

    it('stops serving replays after expiry and purges only expired rows (RETURNING counts)', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const executor = createKnexExecutor(trx)

            const expired = buildRecord({
                applicationId,
                keyHash: keyHashFor(generateUuidV7()),
                expiresAt: new Date(Date.now() - 1000).toISOString()
            })
            const fresh = buildRecord({ applicationId, keyHash: keyHashFor(generateUuidV7()) })
            await saveEconomyIdempotency(executor, expired)
            await saveEconomyIdempotency(executor, fresh)

            // The read predicate (expires_at > NOW()) hides expired rows fail-closed.
            expect(await findEconomyIdempotency(executor, { applicationId, userId: expired.userId, keyHash: expired.keyHash })).toBeNull()
            expect(await findEconomyIdempotency(executor, { applicationId, userId: fresh.userId, keyHash: fresh.keyHash })).not.toBeNull()

            const deletedCount = await purgeExpiredEconomyIdempotency(executor)
            expect(deletedCount).toBe(1)
            expect(await findEconomyIdempotency(executor, { applicationId, userId: fresh.userId, keyHash: fresh.keyHash })).not.toBeNull()

            const remaining = await trx.raw(`SELECT COUNT(*)::int AS count FROM applications.obj_economy_idempotency WHERE key_hash = ?`, [
                fresh.keyHash
            ])
            expect(remaining.rows[0]?.count).toBe(1)
        })
    })

    it('fails closed on malformed scope inputs instead of issuing SQL', async () => {
        await withRollback(knex, async (trx) => {
            const executor = createKnexExecutor(trx)
            const applicationId = generateUuidV7()

            // The store functions are async: scope validation rejects rather than throws synchronously.
            await expect(
                findEconomyIdempotency(executor, { applicationId, userId: 'not-a-uuid', keyHash: keyHashFor('x') })
            ).rejects.toThrow(TypeError)
            await expect(findEconomyIdempotency(executor, { applicationId, userId: generateUuidV7(), keyHash: 'short' })).rejects.toThrow(
                TypeError
            )
            await expect(
                saveEconomyIdempotency(
                    executor,
                    buildRecord({ applicationId: '00000000-0000-4000-8000-000000000000', keyHash: keyHashFor('x') })
                )
            ).rejects.toThrow(TypeError)
            await expect(
                saveEconomyIdempotency(executor, buildRecord({ keyHash: keyHashFor('x'), bodyFingerprint: 'nothex' }))
            ).rejects.toThrow(TypeError)
            await expect(saveEconomyIdempotency(executor, buildRecord({ statusCode: 199 }))).rejects.toThrow(TypeError)
            await expect(saveEconomyIdempotency(executor, buildRecord({ workspaceId: 'nope' }))).rejects.toThrow(TypeError)
        })
    })

    it('keeps the table private to the service role through RLS grants', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const record = buildRecord({ applicationId })

            // The authenticated request role holds no grants on the platform
            // idempotency table: any write fails closed with a permission error.
            // The savepoint keeps the outer rollback transaction usable afterwards.
            await expect(
                trx.transaction(async (savepoint) =>
                    withDatabaseRole(savepoint, 'authenticated', record.userId, () =>
                        saveEconomyIdempotency(createKnexExecutor(savepoint), record)
                    )
                )
            ).rejects.toThrow(/permission denied/)
        })
    })
})
