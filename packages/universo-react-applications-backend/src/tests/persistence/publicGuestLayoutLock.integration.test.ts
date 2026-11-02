import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import { ApplicationSchemaStatus } from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { lockApplicationLayoutMutationFamily, applicationLayoutMutationLockKey } from '../../persistence/applicationLayoutStoreSupport'
import { lockPublicApplicationForGuestAssessment, lockPublicGuestRuntimeLayoutState } from '../../persistence/publicGuestApplicationStore'
import { persistApplicationSchemaSyncState } from '../../services/ApplicationSchemaSyncStateStore'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for public guest layout-lock PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip

const createGate = () => {
    let release!: () => void
    const promise = new Promise<void>((resolve) => {
        release = resolve
    })
    return { promise, release }
}

describeIntegration('Public guest runtime layout-lock PostgreSQL behavior', () => {
    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 3 } })
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('lets publication sync update the application while guest runtime waits on its shared layout lock', async () => {
        const applicationId = generateUuidV7()
        const schemaName = `app_${generateUuidV7().replaceAll('-', '')}`
        const lockKey = applicationLayoutMutationLockKey(schemaName)
        const publisherLockReady = createGate()
        const allowPublisherUpdate = createGate()
        const guestBackendPidReady = createGate()
        let guestBackendPid = 0
        let publisherTransaction: Promise<void> | undefined
        let guestTransaction: Promise<boolean> | undefined

        await knex.raw(
            `INSERT INTO applications.obj_applications (id, name, schema_name, is_public)
             VALUES (?, ?::jsonb, ?, true)`,
            [
                applicationId,
                JSON.stringify({ _schema: '1', _primary: 'en', locales: { en: { content: 'Guest layout-lock integration' } } }),
                schemaName
            ]
        )

        try {
            publisherTransaction = knex.transaction(async (trx) => {
                const executor = createKnexExecutor(trx)
                await lockApplicationLayoutMutationFamily(executor, schemaName)
                publisherLockReady.release()
                await allowPublisherUpdate.promise
                await persistApplicationSchemaSyncState(executor, {
                    applicationId,
                    schemaStatus: ApplicationSchemaStatus.SYNCED,
                    schemaError: null,
                    schemaSyncedAt: new Date(),
                    schemaSnapshot: null,
                    lastSyncedPublicationVersionId: null,
                    appStructureVersion: null,
                    workspacesEnabled: false
                })
            })
            await publisherLockReady.promise

            guestTransaction = knex.transaction(async (trx) => {
                const executor = createKnexExecutor(trx)
                const backendRows = await trx.raw('SELECT pg_backend_pid() AS pid')
                guestBackendPid = Number(backendRows.rows[0]?.pid)
                guestBackendPidReady.release()
                await lockPublicGuestRuntimeLayoutState(executor, schemaName)
                return lockPublicApplicationForGuestAssessment(executor, applicationId)
            })
            await guestBackendPidReady.promise

            const deadline = Date.now() + 5000
            let guestWaitingOnLayoutLock = false
            while (Date.now() < deadline) {
                const waitingResult = await knex.raw(
                    `SELECT EXISTS (
                         SELECT 1 FROM pg_locks
                         WHERE pid = ? AND locktype = 'advisory' AND granted = false
                     ) AS waiting`,
                    [guestBackendPid]
                )
                if (waitingResult.rows[0]?.waiting === true) {
                    guestWaitingOnLayoutLock = true
                    break
                }
                await new Promise((resolve) => setTimeout(resolve, 20))
            }

            expect(guestWaitingOnLayoutLock).toBe(true)
            allowPublisherUpdate.release()
            await publisherTransaction
            await expect(guestTransaction).resolves.toBe(true)

            const updateResult = await knex.raw(
                `SELECT schema_status
                 FROM applications.obj_applications
                 WHERE id = ?`,
                [applicationId]
            )
            expect(updateResult.rows[0]?.schema_status).toBe(ApplicationSchemaStatus.SYNCED)

            const sharedAttempt = await knex.raw('SELECT pg_try_advisory_xact_lock_shared(hashtextextended(?::text, 0)) AS acquired', [
                lockKey
            ])
            expect(sharedAttempt.rows[0]?.acquired).toBe(true)
        } finally {
            allowPublisherUpdate.release()
            await Promise.all([publisherTransaction?.catch(() => undefined), guestTransaction?.catch(() => undefined)])
            await knex.raw('DELETE FROM applications.obj_applications WHERE id = ?', [applicationId])
        }
    })
})
