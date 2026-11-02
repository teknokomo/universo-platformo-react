import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    expectPostgresError,
    insertApplication,
    insertApplicationMember,
    insertBinding,
    withDatabaseRole
} from './applicationBotBindings.integrationSupport'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import {
    createApplicationBotBindingInTransaction,
    updateApplicationBotBindingInTransaction
} from '../../persistence/applicationBotBindingsStore'
import { updateApplicationInTransaction } from '../../persistence/applicationMutationStore'

describeIntegration('Application bot binding schema and audit PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('uses the fresh-schema catalog default and records binding creation without bot values in audit', async () => {
        await withRollback(knex, async (trx) => {
            const column = await trx.raw(
                `SELECT is_nullable, column_default
                 FROM information_schema.columns
                 WHERE table_schema = 'applications'
                   AND table_name = 'obj_applications'
                   AND column_name = 'show_in_app_list'`
            )
            expect(column.rows[0]).toMatchObject({ is_nullable: 'NO', column_default: 'true' })

            const usernameColumn = await trx.raw(
                `SELECT data_type, character_maximum_length
                 FROM information_schema.columns
                 WHERE table_schema = 'applications'
                   AND table_name = 'rel_application_bot_bindings'
                   AND column_name = 'bot_username'`
            )
            expect(usernameColumn.rows[0]).toEqual({ data_type: 'text', character_maximum_length: null })

            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)
            const binding = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createApplicationBotBindingInTransaction(executor, {
                    applicationId,
                    platform: 'max',
                    botUsername: 'mabcdefghijbot',
                    displayName: 'Launch bot'
                })
            )

            expect(binding.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
            expect(binding.shortId).toMatch(/^[A-Za-z0-9_-]{22}$/)
            expect(Buffer.from(binding.shortId, 'base64url')).toHaveLength(16)

            const audits = await trx.raw(
                `SELECT event_type, changed_fields, previous_show_in_app_list, new_show_in_app_list
                 FROM applications.rel_application_control_audits
                 WHERE application_id = ? AND binding_id = ?`,
                [applicationId, binding.id]
            )
            expect(audits.rows).toHaveLength(1)
            expect(audits.rows[0]).toMatchObject({
                event_type: 'bot_binding_created',
                changed_fields: ['platform', 'bot_username', 'display_name'],
                previous_show_in_app_list: null,
                new_show_in_app_list: null
            })
            expect(JSON.stringify(audits.rows)).not.toContain('mabcdefghijbot')

            await expectPostgresError(trx, '22023', (savepoint) =>
                withDatabaseRole(savepoint, 'authenticated', actorUserId, () =>
                    createApplicationBotBindingInTransaction(createKnexExecutor(savepoint), {
                        applicationId,
                        platform: 'telegram',
                        botUsername: 'contactbot',
                        displayName: 'support@example.com'
                    })
                )
            )
            await expectPostgresError(trx, '22023', (savepoint) =>
                withDatabaseRole(savepoint, 'authenticated', actorUserId, () =>
                    updateApplicationBotBindingInTransaction(createKnexExecutor(savepoint), {
                        applicationId,
                        bindingId: binding.id,
                        expectedVersion: binding.version,
                        displayName: 'Bearer unsafecredentialvalue'
                    })
                )
            )
            const unchangedBinding = await trx.raw(
                `SELECT display_name, _upl_version FROM applications.rel_application_bot_bindings WHERE id = ?`,
                [binding.id]
            )
            expect(unchangedBinding.rows).toEqual([{ display_name: 'Launch bot', _upl_version: 1 }])

            await expectPostgresError(trx, '23514', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId,
                    platform: 'max',
                    botUsername: 'mabcdefghij',
                    shortId: 'EEEEEEEEEEEEEEEEEEEEEE'
                })
            )
            await insertBinding(trx, {
                applicationId,
                platform: 'max',
                botUsername: 'mabcdefghij_bot',
                shortId: 'FFFFFFFFFFFFFFFFFFFFFF'
            })
            await insertBinding(trx, {
                applicationId,
                platform: 'max',
                botUsername: 'mabcdefgbot',
                shortId: 'GGGGGGGGGGGGGGGGGGGGGG'
            })
            await insertBinding(trx, {
                applicationId,
                platform: 'max',
                botUsername: `m${'a'.repeat(56)}bot`,
                shortId: 'HHHHHHHHHHHHHHHHHHHHHH'
            })
            await expectPostgresError(trx, '23514', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId,
                    platform: 'max',
                    botUsername: 'mabcdefbot',
                    shortId: 'IIIIIIIIIIIIIIIIIIIIII'
                })
            )
            await expectPostgresError(trx, '23514', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId,
                    platform: 'max',
                    botUsername: `m${'a'.repeat(57)}bot`,
                    shortId: 'JJJJJJJJJJJJJJJJJJJJJJ'
                })
            )

            await expectPostgresError(trx, '23505', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId,
                    platform: 'max',
                    botUsername: 'mabcdefghijbot',
                    shortId: 'AAAAAAAAAAAAAAAAAAAAAA'
                })
            )

            const secondApplicationId = await insertApplication(trx)
            await expectPostgresError(trx, '23505', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId: secondApplicationId,
                    platform: 'telegram',
                    botUsername: 'test_bot',
                    shortId: binding.shortId
                })
            )
        })
    })

    it('derives visibility audit values from the row transition and rejects forged events or actors', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            const forgedActorId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: actorUserId })])

            const renamed = await updateApplicationInTransaction(executor, {
                applicationId,
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Renamed application' } } },
                userId: actorUserId
            })
            expect(renamed?.version).toBe(2)

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () => {
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `SELECT applications.record_application_catalog_visibility_audit(
                            ?, 'catalog_visibility_changed', 1, 2, false, true
                        )`,
                        [applicationId]
                    )
                )
            })

            const changed = await updateApplicationInTransaction(executor, {
                applicationId,
                showInAppList: false,
                userId: actorUserId,
                expectedVersion: 2
            })
            expect(changed?.version).toBe(3)

            const audits = await trx.raw(
                `SELECT event_type, previous_version, new_version,
                        previous_show_in_app_list, new_show_in_app_list,
                        _upl_created_by::text AS actor
                 FROM applications.rel_application_control_audits
                 WHERE application_id = ? AND event_type = 'catalog_visibility_changed'`,
                [applicationId]
            )
            expect(audits.rows).toEqual([
                {
                    event_type: 'catalog_visibility_changed',
                    previous_version: 2,
                    new_version: 3,
                    previous_show_in_app_list: true,
                    new_show_in_app_list: false,
                    actor: actorUserId
                }
            ])

            await expectPostgresError(trx, '42501', (savepoint) =>
                updateApplicationInTransaction(createKnexExecutor(savepoint), {
                    applicationId,
                    showInAppList: true,
                    userId: forgedActorId,
                    expectedVersion: 3
                })
            )

            const unchanged = await trx.raw(`SELECT show_in_app_list, _upl_version FROM applications.obj_applications WHERE id = ?`, [
                applicationId
            ])
            expect(unchanged.rows).toEqual([{ show_in_app_list: false, _upl_version: 3 }])
        })
    })

    it('rolls back bot binding and catalog visibility changes when the audit write fails', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            await trx.raw(`
                CREATE FUNCTION applications.reject_messenger_audit_fixture() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'Messenger audit failure fixture' USING ERRCODE = 'P0001';
                END;
                $$
            `)
            await trx.raw(`
                CREATE TRIGGER reject_messenger_audit_fixture
                BEFORE INSERT ON applications.rel_application_control_audits
                FOR EACH ROW EXECUTE FUNCTION applications.reject_messenger_audit_fixture()
            `)
            await trx.raw(`SELECT set_config('request.jwt.claims', ?, true)`, [JSON.stringify({ sub: actorUserId })])

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () => {
                await expectPostgresError(trx, 'P0001', (savepoint) =>
                    createApplicationBotBindingInTransaction(createKnexExecutor(savepoint), {
                        applicationId,
                        platform: 'telegram',
                        botUsername: 'audit_testbot',
                        displayName: null
                    })
                )
            })

            const bindingRows = await trx.raw(
                `SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ? AND bot_username = ?`,
                [applicationId, 'audit_testbot']
            )
            expect(bindingRows.rows).toHaveLength(0)

            const applicationVersionRows = await trx.raw(
                `SELECT COALESCE(_upl_version, 1) AS version
                 FROM applications.obj_applications
                 WHERE id = ?`,
                [applicationId]
            )
            await expectPostgresError(trx, 'P0001', (savepoint) =>
                updateApplicationInTransaction(createKnexExecutor(savepoint), {
                    applicationId,
                    showInAppList: false,
                    userId: actorUserId,
                    expectedVersion: Number(applicationVersionRows.rows[0]?.version)
                })
            )

            const visibilityRows = await trx.raw(
                `SELECT show_in_app_list AS "showInAppList"
                 FROM applications.obj_applications
                 WHERE id = ?`,
                [applicationId]
            )
            expect(visibilityRows.rows[0]?.showInAppList).toBe(true)
        })
    })
})
