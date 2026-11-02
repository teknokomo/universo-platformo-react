import type { Knex } from 'knex'
import {
    describeIntegration,
    createTestShortId,
    createIntegrationKnex,
    withRollback,
    expectPostgresError,
    insertApplication,
    insertBinding
} from './applicationBotBindings.integrationSupport'
import { generateUuidV7 } from '@universo-react/utils'

describeIntegration('Application bot binding retention constraints PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('rejects non-v7 primary keys for bot bindings and control audits', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)

            await expectPostgresError(trx, '23514', (savepoint) =>
                insertBinding(savepoint, {
                    id: '00000000-0000-4000-8000-000000000001',
                    applicationId,
                    platform: 'telegram',
                    botUsername: 'uuidversionbot',
                    shortId: createTestShortId()
                })
            )

            const bindingId = await insertBinding(trx, {
                applicationId,
                platform: 'telegram',
                botUsername: 'uuidversionvalidbot',
                shortId: createTestShortId()
            })
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(
                    `INSERT INTO applications.rel_application_control_audits (
                        id, application_id, binding_id, event_type, changed_fields,
                        previous_show_in_app_list, new_show_in_app_list
                     ) VALUES (?, ?, ?, 'bot_binding_created', '["platform"]'::jsonb, NULL, NULL)`,
                    ['00000000-0000-4000-8000-000000000002', applicationId, bindingId]
                )
            )
        })
    })

    it('rejects physical deletion, truncation, short_id changes, audit mutation, and Application deletion while bindings are retained', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const bindingId = await insertBinding(trx, {
                applicationId,
                platform: 'telegram',
                botUsername: 'test_bot',
                shortId: 'DDDDDDDDDDDDDDDDDDDDDD'
            })
            await expectPostgresError(trx, '23514', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId,
                    platform: 'telegram',
                    botUsername: 'contactbot',
                    displayName: 'support@example.com',
                    shortId: 'EEEEEEEEEEEEEEEEEEEEEE'
                })
            )
            for (const [botUsername, shortId, displayName] of [
                ['arabicdigitsbot', 'FFFFFFFFFFFFFFFFFFFFFF', `Телефон ${'١'.repeat(7)}`],
                ['devanagaridigitbot', 'GGGGGGGGGGGGGGGGGGGGGG', `Телефон ${'१'.repeat(7)}`],
                ['fullwidthdigitbot', 'HHHHHHHHHHHHHHHHHHHHHH', `Телефон ${'１'.repeat(7)}`]
            ]) {
                await expectPostgresError(trx, '23514', (savepoint) =>
                    insertBinding(savepoint, {
                        applicationId,
                        platform: 'telegram',
                        botUsername,
                        displayName,
                        shortId
                    })
                )
            }
            await insertBinding(trx, {
                applicationId,
                platform: 'telegram',
                botUsername: 'unicodeunderlimitbot',
                displayName: `${'😀'.repeat(120)}`,
                shortId: 'IIIIIIIIIIIIIIIIIIIIII'
            })
            const auditId = generateUuidV7()
            await trx.raw(
                `INSERT INTO applications.rel_application_control_audits (
                    id, application_id, binding_id, event_type, changed_fields,
                    previous_show_in_app_list, new_show_in_app_list
                 ) VALUES (?, ?, ?, 'bot_binding_created', '["platform"]'::jsonb, NULL, NULL)`,
                [auditId, applicationId, bindingId]
            )

            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`UPDATE applications.rel_application_bot_bindings SET short_id = ? WHERE id = ?`, [
                    'EEEEEEEEEEEEEEEEEEEEEE',
                    bindingId
                ])
            )
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`DELETE FROM applications.rel_application_bot_bindings WHERE id = ?`, [bindingId])
            )
            const truncateTrigger = await trx.raw(
                `SELECT tgname, tgenabled
                 FROM pg_trigger
                 WHERE tgrelid = 'applications.rel_application_bot_bindings'::regclass
                   AND tgname = 'application_bot_bindings_reject_truncate'
                   AND (tgtype & 32) = 32
                   AND NOT tgisinternal`
            )
            expect(truncateTrigger.rows).toEqual([{ tgname: 'application_bot_bindings_reject_truncate', tgenabled: 'O' }])
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`TRUNCATE TABLE applications.rel_application_bot_bindings CASCADE`)
            )
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`UPDATE applications.rel_application_control_audits SET changed_fields = '[]'::jsonb WHERE id = ?`, [auditId])
            )
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`DELETE FROM applications.rel_application_control_audits WHERE id = ?`, [auditId])
            )
            await expectPostgresError(trx, '23503', (savepoint) =>
                savepoint.raw(`DELETE FROM applications.obj_applications WHERE id = ?`, [applicationId])
            )
        })
    })
})
