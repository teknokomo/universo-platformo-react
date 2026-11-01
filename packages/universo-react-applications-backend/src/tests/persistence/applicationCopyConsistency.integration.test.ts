import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import type { DbExecutor } from '@universo-react/utils'
import { copyApplicationWithOptions } from '../../persistence/applicationCopyStore'
import { acquireApplicationCopyMutationLock, withApplicationCopyMutationLock } from '../../persistence/applicationCopyLocking'
import { deleteApplicationWithSchema, findApplicationCopySource } from '../../persistence/applicationsStore'
import { touchApplicationSchemaSyncedIfUpdateAvailable, updateConnector } from '../../persistence/connectorsStore'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Application copy consistency PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const localized = (content: string) => ({ _schema: '1', _primary: 'en', locales: { en: { content } } })

const insertCommittedApplication = async (knex: Knex): Promise<string> => {
    const applicationId = generateUuidV7()
    await knex.raw(`INSERT INTO applications.obj_applications (id, name, is_public) VALUES (?, ?::jsonb, true)`, [
        applicationId,
        JSON.stringify(localized(`Copy source ${applicationId}`))
    ])
    return applicationId
}

const insertCommittedAuthUser = async (knex: Knex, userId: string): Promise<void> => {
    await knex.raw(
        `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, confirmation_token, created_at, updated_at)
         VALUES (?, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ?, '', '', now(), now())`,
        [userId, `copy-consistency-${userId}@example.test`]
    )
}

const insertCommittedMembership = async (knex: Knex, applicationId: string, userId: string): Promise<void> => {
    await knex.raw(
        `INSERT INTO applications.rel_application_users (
            id, application_id, user_id, role, _upl_created_by, _upl_updated_by
         ) VALUES (?, ?, ?, 'owner', ?, ?)`,
        [generateUuidV7(), applicationId, userId, userId, userId]
    )
}

const softDeleteCommittedApplicationIfActive = async (knex: Knex, applicationId: string, userId?: string): Promise<void> => {
    const activeRows = await knex.raw(
        `SELECT id
         FROM applications.obj_applications
         WHERE id = ?
           AND _upl_archived = false
           AND _upl_deleted = false
           AND _app_archived = false
           AND _app_deleted = false`,
        [applicationId]
    )
    if (activeRows.rows.length === 0) return

    if (!userId) throw new Error('An owner is required to clean up a committed Application fixture')
    const executor = createKnexExecutor(knex)
    await executor.transaction(async (transaction) => {
        await transaction.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId })])
        await deleteApplicationWithSchema(transaction, { applicationId, schemaName: null, userId })
    })
}

const insertCommittedConnector = async (knex: Knex, applicationId: string, name: string): Promise<string> => {
    const connectorId = generateUuidV7()
    await knex.raw(
        `INSERT INTO applications.obj_connectors (id, application_id, name, sort_order, is_single_metahub, is_required_metahub)
         VALUES (?, ?, ?::jsonb, 0, false, false)`,
        [connectorId, applicationId, JSON.stringify(localized(name))]
    )
    return connectorId
}

const copyInput = async (knex: Knex, sourceApplicationId: string, newApplicationId: string, actorUserId: string) => {
    const sourceApplication = await findApplicationCopySource(createKnexExecutor(knex), sourceApplicationId)
    if (!sourceApplication) throw new Error('The Application copy consistency source was not found')
    return {
        newApplicationId,
        sourceApplicationId,
        sourceApplication,
        copiedName: localized(`Copy of ${sourceApplicationId}`),
        copiedDescription: null,
        settings: {},
        isPublic: false,
        workspacesEnabled: false,
        schemaName: `app_${newApplicationId.replace(/-/gu, '')}`,
        schemaStatus: 'draft',
        copyAccess: false,
        copyConnector: true,
        actorUserId
    }
}

const waitForAdvisoryLockWait = async (knex: Knex, pid: number, timeoutMs = 5000): Promise<boolean> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const result = await knex.raw(`SELECT wait_event_type, wait_event FROM pg_stat_activity WHERE pid = ?`, [pid])
        if (result.rows[0]?.wait_event_type === 'Lock' && result.rows[0]?.wait_event === 'advisory') return true
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return false
}

describeIntegration('Application copy relation consistency PostgreSQL behavior', () => {
    jest.setTimeout(30_000)

    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 3 } })
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('blocks connector writers until a copy has read and committed its consistent relation state', async () => {
        const applicationIds: string[] = []
        const actorUserId = generateUuidV7()
        let releaseCopy!: () => void
        let signalCopyReady!: () => void
        const copyReady = new Promise<void>((resolve) => {
            signalCopyReady = resolve
        })
        const copyGate = new Promise<void>((resolve) => {
            releaseCopy = resolve
        })
        let copyOperation: Promise<{ application?: unknown; error?: unknown }> | undefined
        let writerOperation: Promise<unknown> | undefined

        try {
            const sourceApplicationId = await insertCommittedApplication(knex)
            applicationIds.push(sourceApplicationId)
            await insertCommittedAuthUser(knex, actorUserId)
            await insertCommittedMembership(knex, sourceApplicationId, actorUserId)
            const sourceConnectorId = await insertCommittedConnector(knex, sourceApplicationId, 'Original connector')
            const copiedApplicationId = generateUuidV7()
            applicationIds.push(copiedApplicationId)

            const baseExecutor = createKnexExecutor(knex)
            const gatedCopyExecutor: DbExecutor = {
                query: baseExecutor.query,
                isReleased: baseExecutor.isReleased,
                transaction: <T>(work: (executor: DbExecutor) => Promise<T>) =>
                    baseExecutor.transaction(async (trx) => {
                        await trx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: actorUserId })])
                        const result = await work(trx)
                        signalCopyReady()
                        await copyGate
                        return result
                    })
            }
            copyOperation = copyApplicationWithOptions(
                gatedCopyExecutor,
                await copyInput(knex, sourceApplicationId, copiedApplicationId, actorUserId)
            ).then(
                (application) => ({ application }),
                (error: unknown) => ({ error })
            )

            await Promise.race([
                copyReady,
                copyOperation.then((outcome) => {
                    if (outcome.error) throw outcome.error
                    throw new Error('Application copy completed before its transaction gate was reached')
                })
            ])

            let resolveWriterPid!: (pid: number) => void
            const writerPidReady = new Promise<number>((resolve) => {
                resolveWriterPid = resolve
            })
            writerOperation = baseExecutor.transaction(async (trx) => {
                const pidRows = await trx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                resolveWriterPid(Number(pidRows[0]?.pid))
                await acquireApplicationCopyMutationLock(trx, sourceApplicationId)
                return updateConnector(trx, {
                    connectorId: sourceConnectorId,
                    applicationId: sourceApplicationId,
                    name: localized('Updated connector'),
                    sortOrder: 0,
                    userId: actorUserId
                })
            })
            const writerPid = await writerPidReady
            expect(await waitForAdvisoryLockWait(knex, writerPid)).toBe(true)

            releaseCopy()
            const copyOutcome = await copyOperation
            if (!copyOutcome.application) throw copyOutcome.error
            await writerOperation

            const copiedRows = await knex.raw(
                `SELECT name FROM applications.obj_connectors WHERE application_id = ? AND _upl_deleted = false AND _app_deleted = false`,
                [copiedApplicationId]
            )
            const sourceRows = await knex.raw(
                `SELECT name FROM applications.obj_connectors WHERE id = ? AND _upl_deleted = false AND _app_deleted = false`,
                [sourceConnectorId]
            )
            expect(copiedRows.rows).toHaveLength(1)
            expect(copiedRows.rows[0]?.name).toEqual(localized('Original connector'))
            expect(sourceRows.rows[0]?.name).toEqual(localized('Updated connector'))
        } finally {
            releaseCopy()
            if (copyOperation) await Promise.allSettled([copyOperation])
            if (writerOperation) await Promise.allSettled([writerOperation])
            for (const applicationId of applicationIds) await softDeleteCommittedApplicationIfActive(knex, applicationId, actorUserId)
            await knex.raw(`DELETE FROM auth.users WHERE id = ?`, [actorUserId])
        }
    })

    it('rolls back the copied Application, membership, audit, and connector after a late transaction failure', async () => {
        const applicationIds: string[] = []
        const actorUserId = generateUuidV7()

        try {
            const sourceApplicationId = await insertCommittedApplication(knex)
            applicationIds.push(sourceApplicationId)
            await insertCommittedAuthUser(knex, actorUserId)
            await insertCommittedMembership(knex, sourceApplicationId, actorUserId)
            await insertCommittedConnector(knex, sourceApplicationId, 'Rollback connector')
            const copiedApplicationId = generateUuidV7()
            applicationIds.push(copiedApplicationId)
            const baseExecutor = createKnexExecutor(knex)
            const failingCopyExecutor: DbExecutor = {
                query: baseExecutor.query,
                isReleased: baseExecutor.isReleased,
                transaction: <T>(work: (executor: DbExecutor) => Promise<T>) =>
                    baseExecutor.transaction(async (trx) => {
                        await trx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: actorUserId })])
                        const guardedExecutor: DbExecutor = {
                            query: async <TRow = unknown>(sql: string, params?: unknown[]) => {
                                const rows = await trx.query<TRow>(sql, params)
                                if (sql.includes('WITH source_connectors AS')) throw new Error('injected failure after connector copy')
                                return rows
                            },
                            transaction: async <TInner>(innerWork: (executor: DbExecutor) => Promise<TInner>) => innerWork(guardedExecutor),
                            isReleased: () => false
                        }
                        return work(guardedExecutor)
                    })
            }

            await expect(
                copyApplicationWithOptions(
                    failingCopyExecutor,
                    await copyInput(knex, sourceApplicationId, copiedApplicationId, actorUserId)
                )
            ).rejects.toThrow('injected failure after connector copy')

            const persistedRows = await knex.raw(
                `SELECT
                    (SELECT COUNT(*)::int FROM applications.obj_applications WHERE id = ?) AS applications,
                    (SELECT COUNT(*)::int FROM applications.rel_application_users WHERE application_id = ?) AS memberships,
                    (SELECT COUNT(*)::int FROM applications.rel_application_control_audits WHERE application_id = ?) AS audits,
                    (SELECT COUNT(*)::int FROM applications.obj_connectors WHERE application_id = ?) AS connectors`,
                [copiedApplicationId, copiedApplicationId, copiedApplicationId, copiedApplicationId]
            )
            expect(persistedRows.rows[0]).toEqual({ applications: 0, memberships: 0, audits: 0, connectors: 0 })
        } finally {
            for (const applicationId of applicationIds) await softDeleteCommittedApplicationIfActive(knex, applicationId, actorUserId)
            await knex.raw(`DELETE FROM auth.users WHERE id = ?`, [actorUserId])
        }
    })

    it('serializes Application deletion after a child writer that also updates the parent row', async () => {
        const applicationIds: string[] = []
        const actorUserId = generateUuidV7()
        let releaseWriter!: () => void
        let signalWriterReady!: () => void
        let signalDeleteTransactionReady!: (pid: number) => void
        const writerGate = new Promise<void>((resolve) => {
            releaseWriter = resolve
        })
        const writerReady = new Promise<void>((resolve) => {
            signalWriterReady = resolve
        })
        const deleteTransactionReady = new Promise<number>((resolve) => {
            signalDeleteTransactionReady = resolve
        })
        const baseExecutor = createKnexExecutor(knex)
        let writerOperation: Promise<unknown> | undefined
        let deleteOperation: Promise<boolean> | undefined

        try {
            const applicationId = await insertCommittedApplication(knex)
            applicationIds.push(applicationId)
            await insertCommittedAuthUser(knex, actorUserId)
            await insertCommittedMembership(knex, applicationId, actorUserId)
            const connectorId = await insertCommittedConnector(knex, applicationId, 'Concurrent connector')
            await knex.raw(
                `UPDATE applications.obj_applications
                 SET schema_status = 'update_available'
                 WHERE id = ?`,
                [applicationId]
            )

            writerOperation = baseExecutor.transaction((trx) =>
                withApplicationCopyMutationLock(trx, applicationId, async () => {
                    await updateConnector(trx, {
                        connectorId,
                        applicationId,
                        name: localized('Updated while deleting'),
                        sortOrder: 0
                    })
                    signalWriterReady()
                    await writerGate
                    // The production publication-link deletion flow performs this parent-row touch.
                    await touchApplicationSchemaSyncedIfUpdateAvailable(trx, applicationId)
                })
            )
            await writerReady

            const deleteExecutor: DbExecutor = {
                query: baseExecutor.query,
                isReleased: baseExecutor.isReleased,
                transaction: <T>(work: (executor: DbExecutor) => Promise<T>) =>
                    baseExecutor.transaction(async (trx) => {
                        await trx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: actorUserId })])
                        const rows = await trx.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
                        signalDeleteTransactionReady(Number(rows[0]?.pid))
                        return work(trx)
                    })
            }
            deleteOperation = deleteApplicationWithSchema(deleteExecutor, { applicationId, schemaName: null, userId: actorUserId })
            const deletePid = await deleteTransactionReady
            expect(deletePid).toBeGreaterThan(0)
            expect(await waitForAdvisoryLockWait(knex, deletePid)).toBe(true)

            releaseWriter()
            await writerOperation
            await expect(deleteOperation).resolves.toBe(true)

            const deletedRows = await knex.raw(
                `SELECT a._upl_deleted AS application_deleted, c._upl_deleted AS connector_deleted
                 FROM applications.obj_applications a
                 JOIN applications.obj_connectors c ON c.application_id = a.id
                 WHERE a.id = ? AND c.id = ?`,
                [applicationId, connectorId]
            )
            expect(deletedRows.rows[0]).toEqual({ application_deleted: true, connector_deleted: true })
        } finally {
            releaseWriter()
            if (writerOperation) await Promise.allSettled([writerOperation])
            if (deleteOperation) await Promise.allSettled([deleteOperation])
            for (const applicationId of applicationIds) await softDeleteCommittedApplicationIfActive(knex, applicationId, actorUserId)
            await knex.raw(`DELETE FROM auth.users WHERE id = ?`, [actorUserId])
        }
    })
})
