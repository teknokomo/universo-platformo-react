import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    expectPostgresError,
    insertApplication,
    insertApplicationMember,
    insertBinding,
    insertAuditAsCurrentActor,
    withDatabaseRole,
    createTestShortId,
    inactiveApplicationMembershipColumns
} from './applicationBotBindings.integrationSupport'
import {
    createApplicationBotBindingInTransaction,
    updateApplicationBotBindingInTransaction
} from '../../persistence/applicationBotBindingsStore'

describeIntegration('Application bot binding role access PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
    })

    afterAll(async () => {
        await knex?.destroy()
    })

    it('denies direct authenticated writes and permits only authorized atomic binding mutations', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const ownerUserId = generateUuidV7()
            const adminUserId = generateUuidV7()
            const memberUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, ownerUserId, 'owner')
            await insertApplicationMember(trx, applicationId, adminUserId, 'admin')
            await insertApplicationMember(trx, applicationId, memberUserId, 'member')
            const partialReleaseBindingId = await insertBinding(trx, {
                applicationId,
                platform: 'telegram',
                botUsername: 'partial_release_bot',
                shortId: createTestShortId()
            })
            await expectPostgresError(trx, '23514', (savepoint) =>
                savepoint.raw(`UPDATE applications.rel_application_bot_bindings SET released_at = now() WHERE id = ?`, [
                    partialReleaseBindingId
                ])
            )

            const effectivePrivileges = await trx.raw(`
                SELECT
                    has_table_privilege('authenticated', 'applications.rel_application_bot_bindings', 'SELECT') AS binding_select,
                    has_table_privilege('authenticated', 'applications.rel_application_bot_bindings', 'INSERT') AS binding_table_insert,
                    has_any_column_privilege('authenticated', 'applications.rel_application_bot_bindings', 'INSERT') AS binding_column_insert,
                    has_table_privilege('authenticated', 'applications.rel_application_bot_bindings', 'UPDATE') AS binding_table_update,
                    has_any_column_privilege('authenticated', 'applications.rel_application_bot_bindings', 'UPDATE') AS binding_column_update,
                    has_column_privilege('authenticated', 'applications.rel_application_bot_bindings', 'status', 'UPDATE') AS binding_status_update,
                    has_column_privilege('authenticated', 'applications.rel_application_bot_bindings', 'released_at', 'UPDATE') AS binding_release_update,
                    has_column_privilege('authenticated', 'applications.rel_application_bot_bindings', 'short_id', 'UPDATE') AS binding_short_id_update,
                    has_table_privilege('authenticated', 'applications.rel_application_bot_bindings', 'DELETE') AS binding_delete,
                    has_table_privilege('authenticated', 'applications.rel_application_bot_bindings', 'TRUNCATE') AS binding_truncate,
                    has_table_privilege('authenticated', 'applications.rel_application_control_audits', 'SELECT') AS audit_select,
                    has_table_privilege('authenticated', 'applications.rel_application_control_audits', 'INSERT') AS audit_table_insert,
                    has_any_column_privilege('authenticated', 'applications.rel_application_control_audits', 'INSERT') AS audit_column_insert,
                    has_table_privilege('authenticated', 'applications.rel_application_control_audits', 'UPDATE') AS audit_update,
                    has_table_privilege('authenticated', 'applications.rel_application_control_audits', 'DELETE') AS audit_delete,
                    has_table_privilege('authenticated', 'applications.rel_application_control_audits', 'TRUNCATE') AS audit_truncate,
                    has_function_privilege('authenticated', 'applications.create_application_bot_binding(uuid,text,text,text)', 'EXECUTE') AS create_rpc,
                    has_function_privilege('authenticated', 'applications.update_application_bot_binding(uuid,uuid,integer,jsonb)', 'EXECUTE') AS update_rpc,
                    has_function_privilege('anon', 'applications.create_application_bot_binding(uuid,text,text,text)', 'EXECUTE') AS anon_create_rpc,
                    has_function_privilege('authenticated', 'applications.require_application_control_manager(uuid)', 'EXECUTE') AS helper_rpc
            `)
            expect(effectivePrivileges.rows[0]).toEqual({
                binding_select: true,
                binding_table_insert: false,
                binding_column_insert: false,
                binding_table_update: false,
                binding_column_update: false,
                binding_status_update: false,
                binding_release_update: false,
                binding_short_id_update: false,
                binding_delete: false,
                binding_truncate: false,
                audit_select: true,
                audit_table_insert: false,
                audit_column_insert: false,
                audit_update: false,
                audit_delete: false,
                audit_truncate: false,
                create_rpc: true,
                update_rpc: true,
                anon_create_rpc: false,
                helper_rpc: false
            })

            let ownerBindingId = ''
            await withDatabaseRole(trx, 'authenticated', ownerUserId, async () => {
                const created = await trx.raw(
                    `SELECT "id", "shortId" FROM applications.create_application_bot_binding(?, 'telegram', 'owner_bot', NULL)`,
                    [applicationId]
                )
                ownerBindingId = created.rows[0]?.id
                expect(ownerBindingId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
                expect(created.rows[0]?.shortId).toMatch(/^[A-Za-z0-9_-]{22}$/)

                const generatedValues = await trx.raw(
                    `SELECT b._upl_created_by::text AS actor, a._upl_created_by::text AS audit_actor
                     FROM applications.rel_application_bot_bindings AS b
                     JOIN applications.rel_application_control_audits AS a ON a.binding_id = b.id
                     WHERE b.id = ?`,
                    [ownerBindingId]
                )
                expect(generatedValues.rows).toEqual([{ actor: ownerUserId, audit_actor: ownerUserId }])

                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `INSERT INTO applications.rel_application_bot_bindings (
                            id, application_id, platform, bot_username, status, short_id, _upl_created_by, _upl_updated_by
                         ) VALUES (?, ?, 'telegram', 'spoofed_bot', 'draft', ?, ?, ?)`,
                        [generateUuidV7(), applicationId, createTestShortId(), memberUserId, memberUserId]
                    )
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `UPDATE applications.rel_application_bot_bindings
                         SET short_id = ?, _upl_updated_by = ? WHERE id = ?`,
                        [createTestShortId(), memberUserId, ownerBindingId]
                    )
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    insertAuditAsCurrentActor(savepoint, {
                        applicationId,
                        bindingId: ownerBindingId,
                        actorUserId: memberUserId
                    })
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(
                        `SELECT applications.record_application_catalog_visibility_audit(
                            ?, 'bot_binding_released', 1, 2, NULL, NULL
                         )`,
                        [applicationId]
                    )
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(`UPDATE applications.rel_application_bot_bindings SET released_at = now() WHERE id = ?`, [ownerBindingId])
                )

                const updated = await trx.raw(
                    `SELECT status, version FROM applications.update_application_bot_binding(?, ?, 1, '{"status":"active"}'::jsonb)`,
                    [applicationId, ownerBindingId]
                )
                expect(updated.rows).toEqual([{ status: 'active', version: 2 }])
                await expectPostgresError(trx, '40001', (savepoint) =>
                    savepoint.raw(`SELECT * FROM applications.update_application_bot_binding(?, ?, 1, '{"status":"disabled"}'::jsonb)`, [
                        applicationId,
                        ownerBindingId
                    ])
                )

                const released = await trx.raw(
                    `SELECT status, version, "releasedAt" FROM applications.release_application_bot_binding(?, ?, 2)`,
                    [applicationId, ownerBindingId]
                )
                expect(released.rows[0]).toMatchObject({ status: 'disabled', version: 3 })
                expect(released.rows[0]?.releasedAt).toBeTruthy()

                const canonicalRelease = await trx.raw(
                    `SELECT released_by::text AS released_by, _upl_updated_by::text AS updated_by,
                            _upl_deleted_by::text AS upl_deleted_by, _app_deleted_by::text AS app_deleted_by,
                            released_at = _upl_deleted_at AND released_at = _app_deleted_at
                                AND released_at = _upl_updated_at AS timestamps_match,
                            (SELECT event_type FROM applications.rel_application_control_audits
                             WHERE binding_id = ? AND new_version = 3) AS audit_event
                     FROM applications.rel_application_bot_bindings WHERE id = ?`,
                    [ownerBindingId, ownerBindingId]
                )
                expect(canonicalRelease.rows[0]).toEqual({
                    released_by: ownerUserId,
                    updated_by: ownerUserId,
                    upl_deleted_by: ownerUserId,
                    app_deleted_by: ownerUserId,
                    timestamps_match: true,
                    audit_event: 'bot_binding_released'
                })

                const postReleaseMutation = await trx.raw(
                    `SELECT * FROM applications.update_application_bot_binding(?, ?, 3, '{"status":"active"}'::jsonb)`,
                    [applicationId, ownerBindingId]
                )
                expect(postReleaseMutation.rows).toHaveLength(0)
            })

            let adminBindingId = ''
            await withDatabaseRole(trx, 'authenticated', adminUserId, async () => {
                const created = await trx.raw(
                    `SELECT "id" FROM applications.create_application_bot_binding(?, 'telegram', 'admin_bot', NULL)`,
                    [applicationId]
                )
                adminBindingId = created.rows[0]?.id
                expect(adminBindingId).toMatch(/^[0-9a-f-]{36}$/i)
                const visibleBindings = await trx.raw(
                    `SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ? ORDER BY id`,
                    [applicationId]
                )
                expect(visibleBindings.rows.map((row: { id: string }) => row.id)).toContain(adminBindingId)
            })

            await withDatabaseRole(trx, 'authenticated', memberUserId, async () => {
                const visibleBindings = await trx.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ?`, [
                    applicationId
                ])
                expect(visibleBindings.rows).toHaveLength(0)
                const visibleAudits = await trx.raw(`SELECT id FROM applications.rel_application_control_audits WHERE application_id = ?`, [
                    applicationId
                ])
                expect(visibleAudits.rows).toHaveLength(0)
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(`SELECT * FROM applications.create_application_bot_binding(?, 'telegram', 'member_bot', NULL)`, [
                        applicationId
                    ])
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(`UPDATE applications.rel_application_bot_bindings SET status = 'disabled' WHERE id = ?`, [adminBindingId])
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    insertAuditAsCurrentActor(savepoint, {
                        applicationId,
                        bindingId: adminBindingId,
                        actorUserId: memberUserId
                    })
                )
            })

            for (const userId of [ownerUserId, adminUserId]) {
                for (const inactiveColumn of inactiveApplicationMembershipColumns) {
                    await trx.raw(
                        `UPDATE applications.rel_application_users SET ${inactiveColumn} = true WHERE application_id = ? AND user_id = ?`,
                        [applicationId, userId]
                    )
                    await withDatabaseRole(trx, 'authenticated', userId, async () => {
                        await expectPostgresError(trx, '42501', (savepoint) =>
                            savepoint.raw(
                                `SELECT * FROM applications.create_application_bot_binding(?, 'telegram', 'inactive_bot', NULL)`,
                                [applicationId]
                            )
                        )
                    })
                    await trx.raw(
                        `UPDATE applications.rel_application_users SET ${inactiveColumn} = false WHERE application_id = ? AND user_id = ?`,
                        [applicationId, userId]
                    )
                }
            }

            await withDatabaseRole(trx, 'anon', undefined, async () => {
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(`SELECT id FROM applications.rel_application_bot_bindings WHERE application_id = ?`, [applicationId])
                )
                await expectPostgresError(trx, '42501', (savepoint) =>
                    savepoint.raw(`SELECT * FROM applications.create_application_bot_binding(?, 'telegram', 'anon_bot', NULL)`, [
                        applicationId
                    ])
                )
            })
        })
    })

    it('keeps no-op updates version-stable and rejects stale versions at the PostgreSQL boundary', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const ownerUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, ownerUserId, 'owner')
            const executor = createKnexExecutor(trx)

            await withDatabaseRole(trx, 'authenticated', ownerUserId, async () => {
                const created = await createApplicationBotBindingInTransaction(executor, {
                    applicationId,
                    platform: 'telegram',
                    botUsername: 'no_op_bot',
                    displayName: null
                })

                const unchanged = await updateApplicationBotBindingInTransaction(executor, {
                    applicationId,
                    bindingId: created.id,
                    expectedVersion: created.version,
                    botUsername: created.botUsername
                })

                expect(unchanged).toMatchObject({
                    id: created.id,
                    botUsername: created.botUsername,
                    version: created.version
                })

                const persistedState = await trx.raw(
                    `SELECT b._upl_version AS version, count(a.id)::integer AS audit_count
                     FROM applications.rel_application_bot_bindings AS b
                     LEFT JOIN applications.rel_application_control_audits AS a ON a.binding_id = b.id
                     WHERE b.id = ?
                     GROUP BY b.id`,
                    [created.id]
                )
                expect(persistedState.rows).toEqual([{ version: created.version, audit_count: 1 }])

                await expectPostgresError(trx, '40001', (savepoint) =>
                    savepoint.raw(
                        `SELECT * FROM applications.update_application_bot_binding(?, ?, ?, '{"botUsername":"no_op_bot"}'::jsonb)`,
                        [applicationId, created.id, created.version + 1]
                    )
                )
            })
        })
    })
})
