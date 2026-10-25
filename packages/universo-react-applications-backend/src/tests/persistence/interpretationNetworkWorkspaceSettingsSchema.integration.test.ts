import type { Knex } from 'knex'
import { createKnexExecutor, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import { findActiveWorkspaceSetting, type WorkspaceSettingPersistenceAddress } from '../../persistence/workspaceSettingsStore'
import { insertWorkspaceSettingsForCopy } from '../../persistence/workspaceSettingsCopyStore'
import { upsertWorkspaceSettingOverride, WORKSPACE_SETTINGS_ERROR_CODES } from '../../services/workspaceSettingsService'
import { createInterpretationNetworkWorkspaceSettingsFixture } from './interpretationNetworkWorkspaceSettingsFixture'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Interpretation Network PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const fixture = createInterpretationNetworkWorkspaceSettingsFixture(DATABASE_TEST_URL)
const { schemaName, layoutId, workspaceIds, actorUserId, globalSettingKey, settingKey, widgetTarget, applicationSettings } = fixture
describeIntegration('Interpretation Network workspace settings schema and address PostgreSQL invariants', () => {
    let knex: Knex

    beforeAll(async () => {
        ;({ knex } = await fixture.setup())
    })

    afterAll(async () => {
        await fixture.teardown()
    })

    it('enforces setting target kinds and keeps widget setting keys distinct across targets', async () => {
        const executor = createKnexExecutor(knex)

        await expect(
            upsertWorkspaceSettingOverride(executor, {
                schemaName,
                workspaceId: workspaceIds[5]!,
                applicationSettings,
                key: settingKey,
                target: { kind: 'global' },
                value: true,
                actorUserId
            })
        ).rejects.toMatchObject({ code: WORKSPACE_SETTINGS_ERROR_CODES.settingNotAllowed })

        const globalWrite = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[5]!,
            applicationSettings,
            key: globalSettingKey,
            target: { kind: 'global' },
            value: true,
            actorUserId
        })
        expect(globalWrite).toMatchObject({ key: globalSettingKey, target: { kind: 'global' }, value: true, version: 1 })

        const firstWidgetWrite = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[5]!,
            applicationSettings,
            key: settingKey,
            target: widgetTarget,
            value: false,
            actorUserId
        })
        expect(firstWidgetWrite).toMatchObject({ key: settingKey, target: widgetTarget, value: false, version: 1 })

        const secondWidgetWrite = await upsertWorkspaceSettingOverride(executor, {
            schemaName,
            workspaceId: workspaceIds[5]!,
            applicationSettings,
            key: settingKey,
            target: { kind: 'widget', instanceKey: 'matrix-secondary' },
            value: true,
            actorUserId
        })
        expect(secondWidgetWrite).toMatchObject({
            key: settingKey,
            target: { kind: 'widget', instanceKey: 'matrix-secondary' },
            value: true,
            version: 1
        })
    })

    it('uses the active target-address index for exact Workspace setting lookups', async () => {
        const address: WorkspaceSettingPersistenceAddress = {
            workspaceId: workspaceIds[6]!,
            targetKind: 'widget',
            targetOwnerId: layoutId,
            targetKey: 'matrix-index-lookup-2048',
            key: settingKey
        }
        const settingsTable = qSchemaTable(schemaName, '_app_workspace_settings')
        await knex.raw(
            `INSERT INTO ${settingsTable} (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
             SELECT public.uuid_generate_v7(), ?, 'widget', ?, 'matrix-index-lookup-' || row_number, ?, 'true'::jsonb
             FROM generate_series(1, 2048) AS rows(row_number)`,
            [address.workspaceId, layoutId, settingKey]
        )
        await knex.raw(`ANALYZE ${settingsTable}`)

        let productionQuery: { sql: string; parameters?: unknown[] } | undefined
        let captureExecutor: DbExecutor
        captureExecutor = {
            query: async <T = unknown>(sql: string, parameters?: unknown[]) => {
                productionQuery = { sql, parameters: parameters ? [...parameters] : undefined }
                return [] as T[]
            },
            transaction: async (callback) => callback(captureExecutor),
            isReleased: () => false
        }

        await findActiveWorkspaceSetting(captureExecutor, schemaName, address)
        expect(productionQuery).toBeDefined()
        const query = productionQuery!
        expect(query.parameters).toEqual([address.workspaceId, address.targetKind, address.targetOwnerId, address.targetKey, address.key])
        const rows = await createKnexExecutor(knex).query<{ 'QUERY PLAN': unknown }>(`EXPLAIN (FORMAT JSON) ${query.sql}`, query.parameters)

        type ExplainNode = { 'Index Name'?: string; Plans?: ExplainNode[] }
        const rawPlan = rows[0]?.['QUERY PLAN']
        const planRows = (typeof rawPlan === 'string' ? JSON.parse(rawPlan) : rawPlan) as Array<{ Plan?: ExplainNode }> | undefined
        const indexNames = (node: ExplainNode | undefined): string[] =>
            node ? [node['Index Name'], ...(node.Plans ?? []).flatMap(indexNames)].filter((name): name is string => Boolean(name)) : []

        expect(planRows?.[0]?.Plan).toBeDefined()
        expect(indexNames(planRows?.[0]?.Plan)).toContain('_app_workspace_settings_target_active_uidx')
    })

    it('stores global and widget settings with the same key in the fresh target-aware schema', async () => {
        const executor = createKnexExecutor(knex)
        const targetWorkspaceId = generateUuidV7()
        const widgetOwnerId = generateUuidV7()
        const copyKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'

        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id, name, description, workspace_type)
             VALUES (?, ?::jsonb, ?::jsonb, 'shared')`,
            [targetWorkspaceId, JSON.stringify({ en: 'Workspace settings copy target' }), JSON.stringify({ en: 'Integration fixture' })]
        )

        await insertWorkspaceSettingsForCopy(executor, {
            schemaName,
            targetWorkspaceId,
            actorUserId,
            settings: [
                {
                    targetKind: 'global',
                    targetOwnerId: targetWorkspaceId,
                    targetKey: '',
                    key: copyKey,
                    value: false
                },
                {
                    targetKind: 'widget',
                    targetOwnerId: widgetOwnerId,
                    targetKey: 'matrix-copy',
                    key: copyKey,
                    value: true
                }
            ]
        })

        const copiedRows = await knex.raw(
            `SELECT id, workspace_id, target_kind, target_owner_id, target_key, value
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ? AND key = ? AND _upl_deleted = false AND _app_deleted = false
             ORDER BY target_kind`,
            [targetWorkspaceId, copyKey]
        )
        expect(copiedRows.rows).toHaveLength(2)
        expect(copiedRows.rows).toEqual([
            {
                id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
                workspace_id: targetWorkspaceId,
                target_kind: 'global',
                target_owner_id: targetWorkspaceId,
                target_key: '',
                value: false
            },
            {
                id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
                workspace_id: targetWorkspaceId,
                target_kind: 'widget',
                target_owner_id: widgetOwnerId,
                target_key: 'matrix-copy',
                value: true
            }
        ])
        expect(new Set(copiedRows.rows.map((row: { id: string }) => row.id)).size).toBe(2)
    })

    it('creates workspace support foreign keys in the fresh schema', async () => {
        const constraints = await knex.raw(
            `SELECT conname
             FROM pg_constraint
             WHERE contype = 'f'
               AND connamespace = ?::regnamespace
               AND conrelid IN (
                   SELECT c.oid
                   FROM pg_class c
                   INNER JOIN pg_namespace n ON n.oid = c.relnamespace
                   WHERE n.nspname = ?
                     AND c.relname = ANY(?::text[])
               )
             ORDER BY conname`,
            [
                schemaName,
                schemaName,
                ['_app_workspace_user_roles', '_app_limits', '_app_workspace_settings', '_app_workspace_operation_audit']
            ]
        )

        expect(constraints.rows.map((row: { conname: string }) => row.conname)).toEqual([
            '_app_limits_object_fk',
            '_app_workspace_operation_audit_workspace_fk',
            '_app_workspace_settings_workspace_fk',
            '_app_workspace_user_roles_role_fk',
            '_app_workspace_user_roles_workspace_fk'
        ])
    })

    it('creates workspace columns and public-entry constraints in the fresh schema', async () => {
        const workspacesQt = qSchemaTable(schemaName, '_app_workspaces')

        const columns = await knex.raw(
            `SELECT column_name, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = ? AND table_name = '_app_workspaces'
               AND column_name IN ('codename', 'converted_from_user_id', 'is_public_entry')
             ORDER BY column_name`,
            [schemaName]
        )
        expect(columns.rows).toEqual([
            { column_name: 'codename', is_nullable: 'YES', column_default: null },
            { column_name: 'converted_from_user_id', is_nullable: 'YES', column_default: null },
            { column_name: 'is_public_entry', is_nullable: 'NO', column_default: 'false' }
        ])

        const publicEntryConstraint = await knex.raw(
            `SELECT convalidated FROM pg_constraint
             WHERE conrelid = ?::regclass AND conname = '_app_workspaces_public_entry_ck'`,
            [`${schemaName}._app_workspaces`]
        )
        expect(publicEntryConstraint.rows).toEqual([{ convalidated: true }])

        await expect(
            knex.raw(
                `INSERT INTO ${workspacesQt} (id, name, description, workspace_type, personal_user_id, is_public_entry)
                 VALUES (?, '{}'::jsonb, '{}'::jsonb, 'personal', ?, true)`,
                [generateUuidV7(), actorUserId]
            )
        ).rejects.toThrow()
        await knex.raw(
            `INSERT INTO ${workspacesQt} (id, name, description, workspace_type, is_public_entry)
             VALUES (?, '{}'::jsonb, '{}'::jsonb, 'shared', true)`,
            [generateUuidV7()]
        )
    })
})
