import type { Knex } from 'knex'
import { createKnexExecutor, qSchema, qSchemaTable } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import { ensureWorkspaceSupportTables } from '../../ddl/applicationWorkspacesSchema'

export const createInterpretationNetworkWorkspaceSettingsFixture = (databaseTestUrl: string | undefined) => {
    const schemaName = `app_${generateUuidV7().replaceAll('-', '')}`
    const layoutId = generateUuidV7()
    const widgetId = generateUuidV7()
    const secondWidgetId = generateUuidV7()
    const workspaceIds = Array.from({ length: 7 }, () => generateUuidV7())
    const actorUserId = generateUuidV7()
    const applicationId = generateUuidV7()
    const globalSettingKey = 'sectionLinksEnabled'
    const settingKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
    const widgetTarget = { kind: 'widget' as const, instanceKey: 'matrix-main' }
    const applicationSettings = {
        workspaceOverrides: {
            allowedAddresses: [
                { key: globalSettingKey, target: { kind: 'global' as const } },
                { key: settingKey, target: widgetTarget },
                { key: settingKey, target: { kind: 'widget' as const, instanceKey: 'matrix-secondary' } }
            ],
            lockedAddresses: []
        }
    }

    let knex: Knex | undefined
    let competingKnex: Knex | undefined

    return {
        schemaName,
        layoutId,
        widgetId,
        secondWidgetId,
        workspaceIds,
        actorUserId,
        applicationId,
        globalSettingKey,
        settingKey,
        widgetTarget,
        applicationSettings,
        async setup() {
            if (!databaseTestUrl) {
                throw new Error('DATABASE_TEST_URL is required for Interpretation Network PostgreSQL integration tests')
            }
            const knexModule = await import('knex')
            const primaryConnection = knexModule.default({ client: 'pg', connection: databaseTestUrl, pool: { min: 1, max: 3 } })
            const competingConnection = knexModule.default({ client: 'pg', connection: databaseTestUrl, pool: { min: 1, max: 2 } })
            knex = primaryConnection
            competingKnex = competingConnection

            await primaryConnection.raw(`CREATE SCHEMA ${qSchema(schemaName)}`)
            await primaryConnection.raw(`CREATE TABLE ${qSchemaTable(schemaName, '_app_objects')} (id UUID PRIMARY KEY)`)
            await ensureWorkspaceSupportTables(createKnexExecutor(primaryConnection), schemaName)

            await primaryConnection.raw(`
                CREATE TABLE ${qSchemaTable(schemaName, '_app_layouts')} (
                    id UUID PRIMARY KEY,
                    scope_entity_id UUID NULL,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    is_default BOOLEAN NOT NULL DEFAULT true,
                    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                    _app_deleted BOOLEAN NOT NULL DEFAULT false,
                    _upl_version BIGINT NOT NULL DEFAULT 1
                )
            `)
            await primaryConnection.raw(`
                CREATE TABLE ${qSchemaTable(schemaName, '_app_widgets')} (
                    id UUID PRIMARY KEY,
                    layout_id UUID NOT NULL,
                    instance_key TEXT NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                    _app_deleted BOOLEAN NOT NULL DEFAULT false
                )
            `)
            await primaryConnection.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_layouts')} (id) VALUES (?)`, [layoutId])
            await primaryConnection.raw(
                `INSERT INTO ${qSchemaTable(schemaName, '_app_widgets')} (id, layout_id, instance_key) VALUES (?, ?, ?)`,
                [widgetId, layoutId, widgetTarget.instanceKey]
            )
            await primaryConnection.raw(
                `INSERT INTO ${qSchemaTable(schemaName, '_app_widgets')} (id, layout_id, instance_key) VALUES (?, ?, ?)`,
                [secondWidgetId, layoutId, 'matrix-secondary']
            )
            for (const workspaceId of workspaceIds) {
                await primaryConnection.raw(
                    `INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id, name, description, workspace_type)
                     VALUES (?, ?::jsonb, ?::jsonb, 'shared')`,
                    [workspaceId, JSON.stringify({ en: `Workspace ${workspaceId}` }), JSON.stringify({ en: 'Integration fixture' })]
                )
            }

            return { knex: primaryConnection, competingKnex: competingConnection }
        },
        async teardown() {
            try {
                if (knex) await knex.raw(`DROP SCHEMA IF EXISTS ${qSchema(schemaName)} CASCADE`)
            } finally {
                if (knex) await knex.destroy()
                if (competingKnex) await competingKnex.destroy()
            }
        }
    }
}
