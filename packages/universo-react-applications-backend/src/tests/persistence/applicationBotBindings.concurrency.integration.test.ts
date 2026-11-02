import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    expectPostgresError,
    insertApplication,
    insertApplicationMember,
    insertBinding,
    insertCommittedApplication,
    deleteCommittedApplicationFixture,
    waitForLockWait,
    runConflictingBindingInsertRace,
    createTestShortId,
    withDatabaseRole,
    withRequestClaims
} from './applicationBotBindings.integrationSupport'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import { createApplicationBotBindingInTransaction } from '../../persistence/applicationBotBindingsStore'
import { deleteApplicationWithSchema } from '../../persistence/applicationsStore'

describeIntegration('Application bot binding concurrency PostgreSQL invariants', () => {
    jest.setTimeout(30_000)

    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('serializes concurrent duplicate bot-identity inserts through the PostgreSQL unique index', async () => {
        const applicationIds: string[] = []
        try {
            const applicationId = await insertCommittedApplication(knex)
            applicationIds.push(applicationId)
            const botUsername = `race_${generateUuidV7().slice(0, 8)}`

            await runConflictingBindingInsertRace(
                knex,
                {
                    applicationId,
                    platform: 'telegram',
                    botUsername,
                    shortId: createTestShortId()
                },
                {
                    applicationId,
                    platform: 'telegram',
                    botUsername,
                    shortId: createTestShortId()
                },
                'bot_username',
                botUsername
            )

            const persisted = await knex.raw(
                `SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ? AND bot_username = ?`,
                [applicationId, botUsername]
            )
            expect(persisted.rows).toHaveLength(0)
        } finally {
            for (const applicationId of applicationIds) await deleteCommittedApplicationFixture(knex, applicationId)
        }
    })

    it('serializes concurrent globally duplicate short_id inserts through the PostgreSQL unique index', async () => {
        const applicationIds: string[] = []
        try {
            const firstApplicationId = await insertCommittedApplication(knex)
            applicationIds.push(firstApplicationId)
            const secondApplicationId = await insertCommittedApplication(knex)
            applicationIds.push(secondApplicationId)
            const shortId = createTestShortId()

            await runConflictingBindingInsertRace(
                knex,
                {
                    applicationId: firstApplicationId,
                    platform: 'max',
                    botUsername: 'mabcdefghijbot',
                    shortId
                },
                {
                    applicationId: secondApplicationId,
                    platform: 'telegram',
                    botUsername: 'short_id_race_bot',
                    shortId
                },
                'short_id',
                shortId
            )

            const persisted = await knex.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE short_id = ?`, [shortId])
            expect(persisted.rows).toHaveLength(0)
        } finally {
            for (const applicationId of applicationIds) await deleteCommittedApplicationFixture(knex, applicationId)
        }
    })

    it('uses the production store while keeping short_id generation inside PostgreSQL', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const executor = createKnexExecutor(trx)
            const actorUserId = generateUuidV7()
            const occupiedShortId = createTestShortId()
            await insertApplicationMember(trx, applicationId, actorUserId)
            await insertBinding(trx, {
                applicationId,
                platform: 'telegram',
                botUsername: 'store_collision_bot',
                shortId: occupiedShortId
            })

            const created = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createApplicationBotBindingInTransaction(executor, {
                    applicationId,
                    platform: 'max',
                    botUsername: 'mstorecollisionbot',
                    displayName: null
                })
            )

            expect(created.shortId).toMatch(/^[A-Za-z0-9_-]{22}$/)
            expect(created.shortId).not.toBe(occupiedShortId)
            const collisionRows = await trx.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE short_id = ?`, [
                occupiedShortId
            ])
            expect(collisionRows.rows).toHaveLength(1)

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () =>
                expectPostgresError(trx, '23505', (savepoint) =>
                    createApplicationBotBindingInTransaction(createKnexExecutor(savepoint), {
                        applicationId,
                        platform: 'telegram',
                        botUsername: 'store_collision_bot',
                        displayName: null
                    })
                )
            )
        })
    })

    it('serializes Application deletion against concurrent binding creation', async () => {
        const applicationId = await insertCommittedApplication(knex)
        const ownerUserId = generateUuidV7()
        await knex.transaction((trx) => insertApplicationMember(trx, applicationId, ownerUserId))
        let deleting: Knex.Transaction | undefined
        let deletingFinished = false
        let creating: Knex.Transaction | undefined
        let creatingFinished = false
        let competingCreate: Promise<{ id: string } | { error: unknown }> | undefined

        try {
            deleting = await knex.transaction()
            await expect(
                withRequestClaims(deleting, ownerUserId, () =>
                    deleteApplicationWithSchema(createKnexExecutor(deleting!), {
                        applicationId,
                        schemaName: null,
                        userId: ownerUserId
                    })
                )
            ).resolves.toBe(true)

            creating = await knex.transaction()
            const pidResult = await creating.raw(`SELECT pg_backend_pid() AS pid`)
            const competingPid = Number(pidResult.rows[0]?.pid)
            competingCreate = withRequestClaims(creating, ownerUserId, () =>
                createApplicationBotBindingInTransaction(createKnexExecutor(creating!), {
                    applicationId,
                    platform: 'telegram',
                    botUsername: 'delete_race_bot',
                    displayName: null
                })
            ).then(
                (binding) => ({ id: binding.id }),
                (error: unknown) => ({ error })
            )

            expect(await waitForLockWait(knex, competingPid)).toBe(true)
            await deleting.commit()
            deletingFinished = true

            const outcome = await competingCreate
            expect(outcome).toHaveProperty('error')
            if ('error' in outcome) {
                expect(outcome.error).toBeInstanceOf(Error)
                expect((outcome.error as Error).message).toMatch(/Application was not found or is already deleted/u)
            }

            const activeApplication = await knex.raw(
                `SELECT id FROM applications.obj_applications
                 WHERE id = ? AND _upl_deleted = false AND _app_deleted = false`,
                [applicationId]
            )
            expect(activeApplication.rows).toHaveLength(0)
            const bindings = await knex.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ?`, [
                applicationId
            ])
            expect(bindings.rows).toHaveLength(0)

            await creating.rollback()
            creatingFinished = true
        } finally {
            if (deleting && !deletingFinished) await deleting.rollback().catch(() => undefined)
            if (creating) {
                if (competingCreate) await Promise.allSettled([competingCreate])
                if (!creatingFinished) await creating.rollback().catch(() => undefined)
            }
            await deleteCommittedApplicationFixture(knex, applicationId, ownerUserId)
        }
    })

    it('serializes Application deletion after a binding create transaction has locked the Application', async () => {
        const applicationId = await insertCommittedApplication(knex)
        const ownerUserId = generateUuidV7()
        await knex.transaction((trx) => insertApplicationMember(trx, applicationId, ownerUserId))
        let creating: Knex.Transaction | undefined
        let deleting: Knex.Transaction | undefined
        let creatingFinished = false
        let deletingFinished = false
        let deleteOutcome: Promise<{ deleted: boolean } | { error: unknown }> | undefined

        try {
            creating = await knex.transaction()
            await withRequestClaims(creating, ownerUserId, () =>
                createApplicationBotBindingInTransaction(createKnexExecutor(creating!), {
                    applicationId,
                    platform: 'telegram',
                    botUsername: `create_first_${generateUuidV7().slice(0, 8)}`,
                    displayName: null
                })
            )

            deleting = await knex.transaction()
            const pidResult = await deleting.raw(`SELECT pg_backend_pid() AS pid`)
            const deletingPid = Number(pidResult.rows[0]?.pid)
            deleteOutcome = withRequestClaims(deleting, ownerUserId, () =>
                deleteApplicationWithSchema(createKnexExecutor(deleting!), {
                    applicationId,
                    schemaName: null,
                    userId: ownerUserId
                })
            ).then(
                (deleted) => ({ deleted }),
                (error: unknown) => ({ error })
            )
            expect(await waitForLockWait(knex, deletingPid)).toBe(true)

            await creating.rollback()
            creatingFinished = true
            const deletion = await deleteOutcome
            expect(deletion).toEqual({ deleted: true })
            await deleting.commit()
            deletingFinished = true

            const deletedApplication = await knex.raw(
                `SELECT id FROM applications.obj_applications WHERE id = ? AND _upl_deleted = true AND _app_deleted = true`,
                [applicationId]
            )
            expect(deletedApplication.rows).toHaveLength(1)
            const persistedBindings = await knex.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ?`, [
                applicationId
            ])
            expect(persistedBindings.rows).toHaveLength(0)
        } finally {
            if (creating && !creatingFinished) await creating.rollback().catch(() => undefined)
            if (deleting) {
                if (deleteOutcome) await Promise.allSettled([deleteOutcome])
                if (!deletingFinished) await deleting.rollback().catch(() => undefined)
            }
            await deleteCommittedApplicationFixture(knex, applicationId, ownerUserId)
        }
    })
})
