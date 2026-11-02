import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    expectPostgresError,
    insertApplication,
    insertApplicationMember,
    insertBinding,
    withDatabaseRole,
    withRequestClaims
} from './applicationBotBindings.integrationSupport'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import {
    createApplicationBotBindingInTransaction,
    resolveMessengerBindingAttribution,
    updateApplicationBotBindingInTransaction,
    releaseApplicationBotBindingInTransaction
} from '../../persistence/applicationBotBindingsStore'
import { copyApplicationWithOptions } from '../../persistence/applicationCopyStore'
import { deleteApplicationWithSchema, findApplicationCopySource } from '../../persistence/applicationsStore'

describeIntegration('Application bot binding lifecycle PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('resolves attribution only for the requested public Application and hides disabled or released rows', async () => {
        await withRollback(knex, async (trx) => {
            const publicApplicationId = await insertApplication(trx, generateUuidV7(), true)
            const otherApplicationId = await insertApplication(trx, generateUuidV7(), true)
            const privateApplicationId = await insertApplication(trx, generateUuidV7(), false)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, publicApplicationId, actorUserId)
            const executor = createKnexExecutor(trx)

            const binding = await withDatabaseRole(trx, 'authenticated', actorUserId, async () => {
                const created = await createApplicationBotBindingInTransaction(executor, {
                    applicationId: publicApplicationId,
                    platform: 'telegram',
                    botUsername: 'launch_bot',
                    displayName: null
                })
                await updateApplicationBotBindingInTransaction(executor, {
                    applicationId: publicApplicationId,
                    bindingId: created.id,
                    expectedVersion: 1,
                    status: 'active'
                })
                return created
            })

            await expect(resolveMessengerBindingAttribution(executor, publicApplicationId, binding.shortId)).resolves.toEqual({
                platform: 'telegram'
            })
            await expect(resolveMessengerBindingAttribution(executor, otherApplicationId, binding.shortId)).resolves.toBeNull()
            await expect(resolveMessengerBindingAttribution(executor, publicApplicationId, 'AAAAAAAAAAAAAAAAAAAAAA')).resolves.toBeNull()

            const privateBindingId = await insertBinding(trx, {
                applicationId: privateApplicationId,
                platform: 'max',
                botUsername: 'mabcdefghijbot',
                shortId: 'BBBBBBBBBBBBBBBBBBBBBB',
                status: 'active'
            })
            expect(privateBindingId).toBeTruthy()
            await expect(resolveMessengerBindingAttribution(executor, privateApplicationId, 'BBBBBBBBBBBBBBBBBBBBBB')).resolves.toBeNull()

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () =>
                updateApplicationBotBindingInTransaction(executor, {
                    applicationId: publicApplicationId,
                    bindingId: binding.id,
                    expectedVersion: 2,
                    status: 'disabled'
                })
            )
            await expect(resolveMessengerBindingAttribution(executor, publicApplicationId, binding.shortId)).resolves.toBeNull()

            await withDatabaseRole(trx, 'authenticated', actorUserId, async () =>
                releaseApplicationBotBindingInTransaction(executor, {
                    applicationId: publicApplicationId,
                    bindingId: binding.id,
                    expectedVersion: 3
                })
            )
            await expect(resolveMessengerBindingAttribution(executor, publicApplicationId, binding.shortId)).resolves.toBeNull()

            await expectPostgresError(trx, '23505', (savepoint) =>
                insertBinding(savepoint, {
                    applicationId: publicApplicationId,
                    platform: 'telegram',
                    botUsername: 'launch_bot',
                    shortId: 'CCCCCCCCCCCCCCCCCCCCCC'
                })
            )
        })
    })

    it('does not copy bot bindings and audits their release when the source Application is deleted', async () => {
        await withRollback(knex, async (trx) => {
            const executor = createKnexExecutor(trx)
            const sourceApplicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, sourceApplicationId, actorUserId)
            const binding = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createApplicationBotBindingInTransaction(executor, {
                    applicationId: sourceApplicationId,
                    platform: 'telegram',
                    botUsername: 'copy_lifecycle_bot',
                    displayName: null
                })
            )
            const sourceApplication = await findApplicationCopySource(executor, sourceApplicationId)
            if (!sourceApplication) throw new Error('The Application copy lifecycle source was not found')

            const copiedApplicationId = generateUuidV7()
            const copied = await withRequestClaims(trx, actorUserId, () =>
                copyApplicationWithOptions(executor, {
                    newApplicationId: copiedApplicationId,
                    sourceApplicationId,
                    sourceApplication,
                    copiedName: sourceApplication.name,
                    copiedDescription: sourceApplication.description,
                    settings: sourceApplication.settings,
                    isPublic: sourceApplication.isPublic,
                    workspacesEnabled: sourceApplication.workspacesEnabled,
                    schemaName: `app_${copiedApplicationId.replace(/-/gu, '')}`,
                    schemaStatus: 'draft',
                    copyAccess: false,
                    copyConnector: false,
                    actorUserId
                })
            )
            expect(copied.id).toBe(copiedApplicationId)
            const copiedInitializationAudits = await trx.raw(
                `SELECT new_show_in_app_list
                 FROM applications.rel_application_control_audits
                 WHERE application_id = ? AND event_type = 'catalog_visibility_initialized'`,
                [copiedApplicationId]
            )
            expect(copiedInitializationAudits.rows).toHaveLength(1)
            const copiedVisibility = copiedInitializationAudits.rows[0]?.new_show_in_app_list
            if (typeof copiedVisibility !== 'boolean') {
                throw new Error('The copied Application visibility audit has no initial value')
            }
            await withDatabaseRole(trx, 'authenticated', actorUserId, async () => {
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `SELECT applications.record_application_catalog_visibility_audit(
                            ?, 'catalog_visibility_initialized', NULL, NULL, NULL, ?
                        )`,
                        [copiedApplicationId, copiedVisibility]
                    )
                )
                await expectPostgresError(trx, '23505', (savepoint) =>
                    savepoint.raw(
                        `SELECT applications.record_application_catalog_visibility_audit(
                            ?, 'catalog_visibility_initialized', NULL, 1, NULL, ?
                        )`,
                        [copiedApplicationId, copiedVisibility]
                    )
                )
            })
            const copiedBindings = await trx.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ?`, [
                copiedApplicationId
            ])
            expect(copiedBindings.rows).toHaveLength(0)

            await withRequestClaims(trx, actorUserId, () =>
                deleteApplicationWithSchema(executor, { applicationId: sourceApplicationId, schemaName: null, userId: actorUserId })
            )
            const releasedBinding = await trx.raw(
                `SELECT status, released_at, _upl_deleted, _app_deleted
                 FROM applications.rel_application_bot_bindings
                 WHERE id = ?`,
                [binding.id]
            )
            expect(releasedBinding.rows[0]).toMatchObject({ status: 'disabled', _upl_deleted: true, _app_deleted: true })
            expect(releasedBinding.rows[0]?.released_at).not.toBeNull()
            const deletionAudit = await trx.raw(
                `SELECT event_type FROM applications.rel_application_control_audits WHERE binding_id = ? ORDER BY event_type`,
                [binding.id]
            )
            expect(deletionAudit.rows.map((row: { event_type: string }) => row.event_type)).toEqual([
                'bot_binding_application_deleted',
                'bot_binding_created'
            ])
        })
    })
})
