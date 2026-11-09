import type { Knex } from 'knex'
import {
    describeIntegration,
    createIntegrationKnex,
    withRollback,
    insertApplication,
    insertApplicationMember,
    withDatabaseRole
} from './applicationBotBindings.integrationSupport'
import { createKnexExecutor } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import { themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset } from '@universo-react/theme'

import {
    countActiveThemePresets,
    countThemePresetUsages,
    createThemePresetInTransaction,
    deleteThemePresetInTransaction,
    getThemePreset,
    listThemePresets,
    recordThemePresetAuditInTransaction,
    ThemePresetCodenameConflictError,
    updateThemePresetInTransaction
} from '../../persistence/themePresetsStore'

const tokens = () => themeTokensSchema.parse(findFileThemePreset('universo-default')!.tokens)

const TEST_LAYOUT_SCHEMA = 'app_c0ffee'

describeIntegration('Application theme presets PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        knex = await createIntegrationKnex()
        await knex.raw(`CREATE SCHEMA IF NOT EXISTS "${TEST_LAYOUT_SCHEMA}"`)
        await knex.raw(`
            CREATE TABLE IF NOT EXISTS "${TEST_LAYOUT_SCHEMA}"._app_layouts (
                id UUID PRIMARY KEY,
                template_key VARCHAR(40) NOT NULL,
                config JSONB NOT NULL DEFAULT '{}'::jsonb,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
    })

    afterAll(async () => {
        await knex?.raw(`DROP SCHEMA IF EXISTS "${TEST_LAYOUT_SCHEMA}" CASCADE`)
        await knex?.destroy()
    })

    it('round-trips a preset with the TZ §10.1 column defaults and audit trail', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)

            const created = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createThemePresetInTransaction(executor, {
                    applicationId,
                    codename: 'corp-brand',
                    name: { en: 'Corp brand' },
                    description: {},
                    tokens: tokens(),
                    basePresetId: null,
                    basePresetCodename: null,
                    actor: actorUserId
                })
            )
            expect(created.codename).toBe('corp-brand')
            expect(created.version).toBe(1)
            expect(created.archived).toBe(false)

            const schemaRow = await trx.raw(
                `SELECT column_default FROM information_schema.columns
                 WHERE table_schema = 'applications' AND table_name = 'obj_theme_presets' AND column_name = 'id'`
            )
            expect(schemaRow.rows[0]?.column_default).toContain('uuid_generate_v7')

            await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                recordThemePresetAuditInTransaction(executor, {
                    applicationId,
                    presetId: created.id,
                    eventType: 'theme_preset_created',
                    changedFields: ['tokens'],
                    previousVersion: null,
                    newVersion: created.version,
                    actor: actorUserId
                })
            )
            const audits = await trx.raw(`SELECT event_type, actor FROM applications.rel_theme_preset_audits WHERE preset_id = ?`, [
                created.id
            ])
            expect(audits.rows).toHaveLength(1)
            expect(audits.rows[0]).toMatchObject({ event_type: 'theme_preset_created', actor: actorUserId })
        })
    })

    it('enforces the unique active codename and lists active presets only', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)

            await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createThemePresetInTransaction(executor, {
                    applicationId,
                    codename: 'dup-check',
                    name: { en: 'First' },
                    description: {},
                    tokens: tokens(),
                    basePresetId: null,
                    basePresetCodename: null,
                    actor: actorUserId
                })
            )

            // The duplicate insert aborts only its own savepoint.
            await expect(
                trx.transaction(async (trx2) =>
                    withDatabaseRole(trx2, 'authenticated', actorUserId, () =>
                        createThemePresetInTransaction(createKnexExecutor(trx2), {
                            applicationId,
                            codename: 'dup-check',
                            name: { en: 'Second' },
                            description: {},
                            tokens: tokens(),
                            basePresetId: null,
                            basePresetCodename: null,
                            actor: actorUserId
                        })
                    )
                )
            ).rejects.toThrow(ThemePresetCodenameConflictError)

            const activeList = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                listThemePresets(executor, applicationId, false)
            )
            expect(activeList).toHaveLength(1)
        })
    })

    it('bumps _upl_version on update and refuses stale expected versions', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)

            const created = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createThemePresetInTransaction(executor, {
                    applicationId,
                    codename: 'optimistic',
                    name: { en: 'Original' },
                    description: {},
                    tokens: tokens(),
                    basePresetId: null,
                    basePresetCodename: null,
                    actor: actorUserId
                })
            )

            const updated = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                updateThemePresetInTransaction(executor, {
                    applicationId,
                    presetId: created.id,
                    expectedVersion: 1,
                    name: { en: 'Renamed' },
                    actor: actorUserId
                })
            )
            expect(updated.version).toBe(2)

            await expect(
                trx.transaction(async (trx2) =>
                    withDatabaseRole(trx2, 'authenticated', actorUserId, () =>
                        updateThemePresetInTransaction(createKnexExecutor(trx2), {
                            applicationId,
                            presetId: created.id,
                            expectedVersion: 1,
                            name: { en: 'Stale' },
                            actor: actorUserId
                        })
                    )
                )
            ).rejects.toThrow()
        })
    })

    it('counts layout usages by appearance preset id', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            await trx.raw(`UPDATE applications.obj_applications SET schema_name = ? WHERE id = ?`, [TEST_LAYOUT_SCHEMA, applicationId])
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)

            const created = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createThemePresetInTransaction(executor, {
                    applicationId,
                    codename: 'usage-counted',
                    name: { en: 'Counted' },
                    description: {},
                    tokens: tokens(),
                    basePresetId: null,
                    basePresetCodename: null,
                    actor: actorUserId
                })
            )

            const layoutId = generateUuidV7()
            await trx.raw(
                `INSERT INTO "${TEST_LAYOUT_SCHEMA}"._app_layouts (id, template_key, config)
                 VALUES (?, 'dashboard', ?::jsonb)`,
                [
                    layoutId,
                    JSON.stringify({
                        appearance: { mode: 'dark', preset: { source: 'application', id: created.id, version: 1 }, overrides: {} }
                    })
                ]
            )

            const usageCount = await countThemePresetUsages(executor, [TEST_LAYOUT_SCHEMA], created.id)
            expect(usageCount).toBe(1)

            const deleted = await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                deleteThemePresetInTransaction(executor, {
                    applicationId,
                    presetId: created.id,
                    expectedVersion: created.version,
                    actor: actorUserId
                })
            )
            expect(deleted.archived).toBe(false)
            const gone = await getThemePreset(executor, applicationId, created.id)
            expect(gone).toBeNull()
        })
    })

    it('denies anonymous reads at the RLS/schema boundary (fail closed)', async () => {
        await withRollback(knex, async (trx) => {
            const applicationId = await insertApplication(trx)
            const actorUserId = generateUuidV7()
            await insertApplicationMember(trx, applicationId, actorUserId)
            const executor = createKnexExecutor(trx)
            await withDatabaseRole(trx, 'authenticated', actorUserId, () =>
                createThemePresetInTransaction(executor, {
                    applicationId,
                    codename: 'anon-probe',
                    name: { en: 'Anon probe' },
                    description: {},
                    tokens: tokens(),
                    basePresetId: null,
                    basePresetCodename: null,
                    actor: actorUserId
                })
            )

            // The anon role holds no USAGE on the applications schema and no
            // table grants: any access fails closed with a permission error.
            await expect(withDatabaseRole(trx, 'anon', undefined, () => countActiveThemePresets(executor, applicationId))).rejects.toThrow(
                /permission denied/
            )
        })
    })
})
