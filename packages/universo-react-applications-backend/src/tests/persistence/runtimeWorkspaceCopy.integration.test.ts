import type { Knex } from 'knex'
import { createKnexExecutor, qColumn, qSchema, qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { generateUuidV7, isUuidV7 } from '@universo-react/utils'
import { copyWorkspaceOperation, materializeWorkspaceCopySourceSnapshot } from '../../services/runtimeWorkspaceCopyService'
import { setRuntimeWorkspaceContext } from '../../services/runtimeWorkspaceContext'
import { setDefaultWorkspace } from '../../services/runtimeWorkspaceMembershipService'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Interpretation Network workspace-copy PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const schemaName = `app_${generateUuidV7().replaceAll('-', '')}`
const workspaceCopyParentTable = 'obj_workspace_copy_fk_test'
const structureTable = workspaceCopyParentTable
const workspaceCopyGlobalTargetTable = 'cfg_workspace_copy_global_targets'
const resetReferenceSourceTable = 'obj_access_links'
const resetReferenceTargetTable = 'obj_quizzes'
const workspaceCopyTableComponentId = generateUuidV7()
const workspaceCopyChildTable = generateChildTableName(workspaceCopyTableComponentId)
const tableTemplateTable = 'obj_table_templates'
const materialTable = 'obj_materials'
const interpretationTable = 'obj_interpretations'
const tableTemplateComponentId = generateUuidV7()
const tableTemplateChildTable = generateChildTableName(tableTemplateComponentId)
const matrixTable = workspaceCopyChildTable
const applicationId = generateUuidV7()
const workspaceId = generateUuidV7()
const otherWorkspaceId = generateUuidV7()
const layoutId = generateUuidV7()
const widgetId = generateUuidV7()

describeIntegration('runtimeWorkspaceCopyService PostgreSQL integration', () => {
    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 4 } })
        await knex.raw(`CREATE SCHEMA ${qSchema(schemaName)}`)

        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_workspace_settings')} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                target_kind TEXT NOT NULL,
                target_owner_id UUID NOT NULL,
                target_key TEXT NOT NULL,
                key TEXT NOT NULL,
                value JSONB NULL,
                _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_created_by UUID NULL,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_updated_by UUID NULL,
                _upl_version INTEGER NOT NULL DEFAULT 1,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_layouts')} (
                id UUID PRIMARY KEY,
                scope_entity_id UUID NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                is_default BOOLEAN NOT NULL DEFAULT true,
                is_source_excluded BOOLEAN NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_widgets')} (
                id UUID PRIMARY KEY,
                layout_id UUID NOT NULL,
                instance_key TEXT NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT true,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_layouts')} (id) VALUES (?)`, [layoutId])
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_widgets')} (id, layout_id, instance_key) VALUES (?, ?, ?)`, [
            widgetId,
            layoutId,
            'matrix-main'
        ])
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_workspaces')} (
                id UUID PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'active',
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_workspace_user_roles')} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                user_id UUID NOT NULL,
                role_id UUID NOT NULL,
                is_default_workspace BOOLEAN NOT NULL DEFAULT false,
                _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                _upl_updated_by UUID NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_objects')} (
                id UUID PRIMARY KEY,
                kind TEXT NOT NULL,
                codename JSONB NOT NULL,
                table_name TEXT NOT NULL,
                config JSONB NOT NULL DEFAULT '{}'::jsonb,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, '_app_components')} (
                id UUID PRIMARY KEY,
                object_id UUID NOT NULL,
                parent_component_id UUID NULL,
                codename JSONB NOT NULL,
                data_type TEXT NOT NULL,
                column_name TEXT NOT NULL,
                target_object_id UUID NULL,
                is_required BOOLEAN NOT NULL DEFAULT false,
                ui_config JSONB NOT NULL DEFAULT '{}'::jsonb,
                sort_order INTEGER NOT NULL DEFAULT 0,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, workspaceCopyGlobalTargetTable)} (
                id UUID PRIMARY KEY
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, resetReferenceTargetTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                name TEXT NOT NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, resetReferenceSourceTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                quiz_ref UUID NOT NULL REFERENCES ${qSchemaTable(schemaName, resetReferenceTargetTable)} (id),
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, structureTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                name TEXT NOT NULL,
                related_id UUID NULL,
                shared_target_id UUID NULL,
                untyped_reference UUID NULL,
                kind TEXT NULL,
                amount NUMERIC(30, 10) NULL,
                metadata JSONB NULL,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, workspaceCopyChildTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                _tp_parent_id UUID NOT NULL REFERENCES ${qSchemaTable(schemaName, workspaceCopyParentTable)} (id) ON DELETE CASCADE,
                _tp_sort_order INTEGER NOT NULL,
                cell_value TEXT NOT NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, materialTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                body TEXT NOT NULL,
                interpretation_id TEXT NULL,
                template_owner_id TEXT NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, interpretationTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                title TEXT NOT NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, tableTemplateTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                name TEXT NOT NULL,
                material_policy TEXT NOT NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, tableTemplateChildTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NOT NULL,
                _tp_parent_id UUID NOT NULL REFERENCES ${qSchemaTable(schemaName, tableTemplateTable)} (id) ON DELETE CASCADE,
                _tp_sort_order INTEGER NOT NULL,
                cell_id UUID NOT NULL,
                material_ref UUID NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false
            )
        `)
        await knex.raw(
            `CREATE UNIQUE INDEX workspace_copy_test_unique_child_value
             ON ${qSchemaTable(schemaName, workspaceCopyChildTable)} (workspace_id, cell_value)`
        )
    })
    beforeEach(async () => {
        await knex.raw(
            `TRUNCATE TABLE ${qSchemaTable(schemaName, resetReferenceSourceTable)}, ${qSchemaTable(
                schemaName,
                resetReferenceTargetTable
            )}, ${qSchemaTable(schemaName, matrixTable)}, ${qSchemaTable(schemaName, structureTable)}, ${qSchemaTable(
                schemaName,
                workspaceCopyGlobalTargetTable
            )}, ${qSchemaTable(schemaName, tableTemplateChildTable)}, ${qSchemaTable(schemaName, tableTemplateTable)}, ${qSchemaTable(
                schemaName,
                materialTable
            )}, ${qSchemaTable(schemaName, interpretationTable)}, ${qSchemaTable(schemaName, '_app_components')}, ${qSchemaTable(
                schemaName,
                '_app_objects'
            )}, ${qSchemaTable(schemaName, '_app_workspaces')}, ${qSchemaTable(schemaName, '_app_workspace_settings')}, ${qSchemaTable(
                schemaName,
                '_app_workspace_user_roles'
            )}`
        )
    })

    afterAll(async () => {
        try {
            if (knex) await knex.raw(`DROP SCHEMA IF EXISTS ${qSchema(schemaName)} CASCADE`)
        } finally {
            if (knex) await knex.destroy()
        }
    })

    const seedWorkspaceCopySource = async (
        cellValue: string,
        options: { duplicateParentChildId?: boolean; ambiguousUntypedReference?: boolean } = {}
    ) => {
        const objectId = generateUuidV7()
        const globalTargetObjectId = generateUuidV7()
        const sourceParentId = generateUuidV7()
        const sourceChildId = options.duplicateParentChildId ? sourceParentId : generateUuidV7()
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name)
             VALUES (?, 'object', ?::jsonb, ?), (?, 'object', ?::jsonb, ?)`,
            [
                objectId,
                JSON.stringify('Copy parent'),
                workspaceCopyParentTable,
                globalTargetObjectId,
                JSON.stringify('Shared copy target'),
                workspaceCopyGlobalTargetTable
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')} (id, object_id, codename, data_type, column_name)
             VALUES (?, ?, ?::jsonb, 'TABLE', 'cells')`,
            [workspaceCopyTableComponentId, objectId, JSON.stringify('Cells')]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name, target_object_id)
             VALUES (?, ?, ?::jsonb, 'REF', 'related_id', ?)`,
            [generateUuidV7(), objectId, JSON.stringify('Related row'), objectId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name, target_object_id, is_required)
             VALUES (?, ?, ?::jsonb, 'REF', 'shared_target_id', ?, true)`,
            [generateUuidV7(), objectId, JSON.stringify('Shared target'), globalTargetObjectId]
        )
        // The shared target intentionally uses the same UUID as a workspace
        // row. Its REF must keep targeting this global table during copying.
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, workspaceCopyGlobalTargetTable)} (id) VALUES (?)`, [sourceParentId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, workspaceCopyParentTable)}
                (id, workspace_id, name, related_id, shared_target_id, untyped_reference)
             VALUES (?, ?, 'Source parent', ?, ?, ?)`,
            [sourceParentId, workspaceId, sourceParentId, sourceParentId, options.ambiguousUntypedReference ? sourceParentId : null]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, workspaceCopyChildTable)}
                (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_value)
             VALUES (?, ?, ?, 1, ?)`,
            [sourceChildId, workspaceId, sourceParentId, cellValue]
        )
        return { sourceParentId, sourceChildId }
    }

    const executeWorkspaceCopy = (
        targetWorkspaceId: string,
        createWorkspace: Parameters<typeof copyWorkspaceOperation>[2]['createWorkspace'] = async (transaction) => {
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            return { id: targetWorkspaceId }
        },
        applicationSettings?: Record<string, unknown>
    ) =>
        copyWorkspaceOperation(
            createKnexExecutor(knex),
            {
                schemaName,
                applicationId,
                sourceWorkspaceId: workspaceId,
                name: { en: 'Workspace copy' },
                description: { en: 'PostgreSQL workspace-copy integration test' },
                userId: applicationId,
                ...(applicationSettings ? { applicationSettings } : {}),
                actorUserId: applicationId
            },
            {
                createWorkspace,
                createError: (code, message) => Object.assign(new Error(message), { code })
            }
        )

    const seedMaterialInterpretationReference = async (includeInterpretation = true) => {
        const materialObjectId = generateUuidV7()
        const interpretationObjectId = generateUuidV7()
        const sourceMaterialId = generateUuidV7()
        const sourceInterpretationId = generateUuidV7()

        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name)
             VALUES (?, 'object', ?::jsonb, ?), (?, 'object', ?::jsonb, ?)`,
            [
                materialObjectId,
                JSON.stringify('Material'),
                materialTable,
                interpretationObjectId,
                JSON.stringify('Interpretation'),
                interpretationTable
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name)
             VALUES (?, ?, ?::jsonb, 'STRING', 'interpretation_id')`,
            [generateUuidV7(), materialObjectId, JSON.stringify('InterpretationId')]
        )
        if (includeInterpretation) {
            await knex.raw(
                `INSERT INTO ${qSchemaTable(schemaName, interpretationTable)} (id, workspace_id, title)
                 VALUES (?, ?, 'Source interpretation')`,
                [sourceInterpretationId, workspaceId]
            )
        }
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, materialTable)} (id, workspace_id, body, interpretation_id)
             VALUES (?, ?, 'Source material', ?)`,
            [sourceMaterialId, workspaceId, sourceInterpretationId]
        )

        return { sourceMaterialId, sourceInterpretationId }
    }

    it('remaps Material.InterpretationId to the copied Interpretation record', async () => {
        const { sourceMaterialId, sourceInterpretationId } = await seedMaterialInterpretationReference()
        const targetWorkspaceId = generateUuidV7()

        const copiedWorkspace = await executeWorkspaceCopy(targetWorkspaceId)
        const copiedInterpretations = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, interpretationTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const copiedMaterials = await knex.raw(
            `SELECT id, interpretation_id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const sourceMaterial = await knex.raw(`SELECT interpretation_id FROM ${qSchemaTable(schemaName, materialTable)} WHERE id = ?`, [
            sourceMaterialId
        ])

        expect(copiedWorkspace.id).toBe(targetWorkspaceId)
        expect(copiedInterpretations.rows).toHaveLength(1)
        expect(copiedMaterials.rows).toHaveLength(1)
        expect(isUuidV7(copiedInterpretations.rows[0].id)).toBe(true)
        expect(isUuidV7(copiedMaterials.rows[0].id)).toBe(true)
        expect(copiedInterpretations.rows[0].id).not.toBe(sourceInterpretationId)
        expect(copiedMaterials.rows[0].interpretation_id).toBe(copiedInterpretations.rows[0].id)
        expect(copiedMaterials.rows[0].interpretation_id).not.toBe(sourceInterpretationId)
        expect(sourceMaterial.rows).toEqual([{ interpretation_id: sourceInterpretationId }])
    }, 30_000)

    it('rejects and rolls back a copied Material with an unresolved non-empty InterpretationId', async () => {
        await seedMaterialInterpretationReference(false)
        const targetWorkspaceId = generateUuidV7()

        await expect(executeWorkspaceCopy(targetWorkspaceId)).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains a Material InterpretationId reference that cannot be resolved'
        })

        const targetWorkspace = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const copiedMaterials = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        expect(targetWorkspace.rows).toHaveLength(0)
        expect(copiedMaterials.rows).toHaveLength(0)
    }, 30_000)

    it('remaps resetOnCopy REF defaults after later-sorting targets are copied without violating real foreign keys', async () => {
        const quizObjectId = generateUuidV7()
        const accessLinkObjectId = generateUuidV7()
        const sourceQuizId = generateUuidV7()
        const sourceAccessLinkId = generateUuidV7()
        const targetWorkspaceId = generateUuidV7()

        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name)
             VALUES (?, 'object', ?::jsonb, ?), (?, 'object', ?::jsonb, ?)`,
            [
                accessLinkObjectId,
                JSON.stringify('AccessLink'),
                resetReferenceSourceTable,
                quizObjectId,
                JSON.stringify('Quiz'),
                resetReferenceTargetTable
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name, target_object_id, is_required, ui_config)
             VALUES (?, ?, ?::jsonb, 'REF', 'quiz_ref', ?, true, ?::jsonb)`,
            [
                generateUuidV7(),
                accessLinkObjectId,
                JSON.stringify('Quiz'),
                quizObjectId,
                JSON.stringify({ resetOnCopy: true, defaultValue: sourceQuizId })
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, resetReferenceTargetTable)} (id, workspace_id, name)
             VALUES (?, ?, 'Source quiz')`,
            [sourceQuizId, workspaceId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, resetReferenceSourceTable)} (id, workspace_id, quiz_ref)
             VALUES (?, ?, ?)`,
            [sourceAccessLinkId, workspaceId, sourceQuizId]
        )

        const copiedWorkspace = await executeWorkspaceCopy(targetWorkspaceId)
        const copiedQuizzes = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, resetReferenceTargetTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const copiedAccessLinks = await knex.raw(
            `SELECT id, quiz_ref FROM ${qSchemaTable(schemaName, resetReferenceSourceTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const sourceAccessLinks = await knex.raw(
            `SELECT id, quiz_ref FROM ${qSchemaTable(schemaName, resetReferenceSourceTable)} WHERE workspace_id = ?`,
            [workspaceId]
        )

        expect(copiedWorkspace.id).toBe(targetWorkspaceId)
        expect(copiedQuizzes.rows).toHaveLength(1)
        expect(copiedAccessLinks.rows).toHaveLength(1)
        expect(isUuidV7(copiedQuizzes.rows[0].id)).toBe(true)
        expect(isUuidV7(copiedAccessLinks.rows[0].id)).toBe(true)
        expect(copiedAccessLinks.rows[0].quiz_ref).toBe(copiedQuizzes.rows[0].id)
        expect(copiedAccessLinks.rows[0].quiz_ref).not.toBe(sourceQuizId)
        expect(sourceAccessLinks.rows).toEqual([{ id: sourceAccessLinkId, quiz_ref: sourceQuizId }])
    }, 30_000)

    const seedTemplateOwnerMaterial = async (
        materialWorkspaceCopyPolicy: 'include' | 'exclude',
        templateWorkspaceCopyPolicy: 'include' | 'exclude' = 'include'
    ) => {
        const templateObjectId = generateUuidV7()
        const materialObjectId = generateUuidV7()
        const templateId = generateUuidV7()
        const materialId = generateUuidV7()
        const childId = generateUuidV7()

        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name, config)
             VALUES (?, 'object', ?::jsonb, ?, ?::jsonb), (?, 'object', ?::jsonb, ?, ?::jsonb)`,
            [
                templateObjectId,
                JSON.stringify('TableTemplate'),
                tableTemplateTable,
                JSON.stringify({
                    recordPolicy: {
                        version: 1,
                        runtimeMutation: 'deny',
                        workspaceCopy: templateWorkspaceCopyPolicy
                    }
                }),
                materialObjectId,
                JSON.stringify('Material'),
                materialTable,
                JSON.stringify({
                    recordPolicy: {
                        version: 1,
                        runtimeMutation: 'deny',
                        workspaceCopy: materialWorkspaceCopyPolicy
                    }
                })
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name)
             VALUES (?, ?, ?::jsonb, 'TABLE', 'template_matrix')`,
            [tableTemplateComponentId, templateObjectId, JSON.stringify('TemplateMatrix')]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name)
             VALUES (?, ?, ?::jsonb, 'STRING', 'template_owner_id')`,
            [generateUuidV7(), materialObjectId, JSON.stringify('TemplateOwnerId')]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, tableTemplateTable)} (id, workspace_id, name, material_policy)
             VALUES (?, ?, 'Source template', 'withMaterials')`,
            [templateId, workspaceId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, materialTable)} (id, workspace_id, body, template_owner_id)
             VALUES (?, ?, 'Source material', ?)`,
            [materialId, workspaceId, templateId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, tableTemplateChildTable)}
                (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, material_ref)
             VALUES (?, ?, ?, 1, ?, NULL)`,
            [childId, workspaceId, templateId, generateUuidV7()]
        )

        return { templateId, materialId }
    }

    it('copies rows under the destination workspace RLS context as the authenticated database role', async () => {
        const { sourceParentId, sourceChildId } = await seedWorkspaceCopySource('RLS workspace copy')
        const targetWorkspaceId = generateUuidV7()
        const unrelatedWorkspaceId = generateUuidV7()
        const workspaceTables = [structureTable, matrixTable]

        await knex.raw(`GRANT USAGE ON SCHEMA ${qSchema(schemaName)} TO authenticated`)
        await knex.raw(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${qSchema(schemaName)} TO authenticated`)
        for (const tableName of workspaceTables) {
            const tableIdent = qSchemaTable(schemaName, tableName)
            await knex.raw(`ALTER TABLE ${tableIdent} ENABLE ROW LEVEL SECURITY`)
            await knex.raw(`
                CREATE POLICY workspace_copy_context_test
                ON ${tableIdent}
                FOR ALL
                USING (${qColumn('workspace_id')} = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
                WITH CHECK (${qColumn('workspace_id')} = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid)
            `)
        }

        const executor = createKnexExecutor(knex)
        const copiedWorkspace = await executor.transaction(async (transaction) => {
            await transaction.query('SET LOCAL ROLE authenticated')
            const [databaseRole] = await transaction.query<{ currentRole: string; bypassRls: boolean }>(
                `SELECT current_user AS "currentRole", role.rolbypassrls AS "bypassRls"
                 FROM pg_roles role
                 WHERE role.rolname = current_user`
            )
            expect(databaseRole).toEqual({ currentRole: 'authenticated', bypassRls: false })
            // Start under an unrelated RLS context so the service must select
            // the source context itself before reading and the destination
            // context itself before inserting copied rows.
            await setRuntimeWorkspaceContext(transaction, unrelatedWorkspaceId)

            const copied = await copyWorkspaceOperation(
                transaction,
                {
                    schemaName,
                    applicationId,
                    sourceWorkspaceId: workspaceId,
                    name: { en: 'RLS workspace copy' },
                    description: { en: 'Copy under authenticated RLS' },
                    userId: applicationId,
                    actorUserId: applicationId
                },
                {
                    createWorkspace: async (tx) => {
                        await tx.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
                        return { id: targetWorkspaceId }
                    },
                    createError: (code, message) => Object.assign(new Error(message), { code })
                }
            )
            const targetRows = await transaction.query<{ id: string }>(
                `SELECT id FROM ${qSchemaTable(schemaName, structureTable)} WHERE workspace_id = $1`,
                [targetWorkspaceId]
            )
            expect(targetRows).toHaveLength(1)
            const sourceRowsAreHidden = await transaction.query<{ visible: boolean }>(
                `SELECT EXISTS (
                    SELECT 1 FROM ${qSchemaTable(schemaName, structureTable)} WHERE workspace_id = $1
                ) AS visible`,
                [workspaceId]
            )
            expect(sourceRowsAreHidden[0]?.visible).toBe(false)
            return copied
        })

        const copiedParent = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, structureTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const copiedChild = await knex.raw(
            `SELECT id, _tp_parent_id FROM ${qSchemaTable(schemaName, matrixTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        expect(copiedWorkspace.id).toBe(targetWorkspaceId)
        expect(copiedParent.rows).toHaveLength(1)
        expect(copiedChild.rows).toHaveLength(1)
        expect(isUuidV7(copiedParent.rows[0].id)).toBe(true)
        expect(copiedParent.rows[0].id).not.toBe(sourceParentId)
        expect(isUuidV7(copiedChild.rows[0].id)).toBe(true)
        expect(copiedChild.rows[0].id).not.toBe(sourceChildId)
        expect(copiedChild.rows[0]._tp_parent_id).toBe(copiedParent.rows[0].id)
    }, 30_000)

    it('fails before workspace creation when excluded Materials are referenced by copied TableTemplates', async () => {
        const templateObjectId = generateUuidV7()
        const materialObjectId = generateUuidV7()
        const templateId = generateUuidV7()
        const materialId = generateUuidV7()
        const childId = generateUuidV7()
        const targetWorkspaceId = generateUuidV7()
        const createWorkspace: Parameters<typeof copyWorkspaceOperation>[2]['createWorkspace'] = jest.fn(async (transaction) => {
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            return { id: targetWorkspaceId }
        })

        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_objects')} (id, kind, codename, table_name, config)
             VALUES (?, 'object', ?::jsonb, ?, '{}'::jsonb), (?, 'object', ?::jsonb, ?, ?::jsonb)`,
            [
                templateObjectId,
                JSON.stringify('TableTemplate'),
                tableTemplateTable,
                materialObjectId,
                JSON.stringify('Material'),
                materialTable,
                JSON.stringify({ recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' } })
            ]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, codename, data_type, column_name)
             VALUES (?, ?, ?::jsonb, 'TABLE', 'template_matrix')`,
            [tableTemplateComponentId, templateObjectId, JSON.stringify('TemplateMatrix')]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_components')}
                (id, object_id, parent_component_id, codename, data_type, column_name, target_object_id)
             VALUES (?, ?, ?, ?::jsonb, 'REF', 'material_ref', ?)`,
            [generateUuidV7(), templateObjectId, tableTemplateComponentId, JSON.stringify('MaterialRef'), materialObjectId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, tableTemplateTable)} (id, workspace_id, name, material_policy)
             VALUES (?, ?, 'Source template', 'withMaterials')`,
            [templateId, workspaceId]
        )
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, materialTable)} (id, workspace_id, body) VALUES (?, ?, 'Source material')`, [
            materialId,
            workspaceId
        ])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, tableTemplateChildTable)}
                (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, material_ref)
             VALUES (?, ?, ?, 1, ?, ?)`,
            [childId, workspaceId, templateId, generateUuidV7(), materialId]
        )

        await expect(executeWorkspaceCopy(targetWorkspaceId, createWorkspace)).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
            message: 'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
        })

        expect(createWorkspace).not.toHaveBeenCalled()
        const targetWorkspace = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const targetTemplates = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, tableTemplateTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const targetMaterials = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const sourceAggregate = await knex.raw(
            `SELECT template_row.id AS template_id, child_row.material_ref
             FROM ${qSchemaTable(schemaName, tableTemplateTable)} template_row
             INNER JOIN ${qSchemaTable(schemaName, tableTemplateChildTable)} child_row ON child_row._tp_parent_id = template_row.id
             WHERE template_row.workspace_id = ?`,
            [workspaceId]
        )
        expect(targetWorkspace.rows).toHaveLength(0)
        expect(targetTemplates.rows).toHaveLength(0)
        expect(targetMaterials.rows).toHaveLength(0)
        expect(sourceAggregate.rows).toEqual([{ template_id: templateId, material_ref: materialId }])
    }, 30_000)

    it('fails before workspace creation when a copied TableTemplate owns an excluded Material without a child MaterialRef', async () => {
        const { templateId, materialId } = await seedTemplateOwnerMaterial('exclude')
        const targetWorkspaceId = generateUuidV7()
        const createWorkspace: Parameters<typeof copyWorkspaceOperation>[2]['createWorkspace'] = jest.fn(async (transaction) => {
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            return { id: targetWorkspaceId }
        })

        const materialRefComponents = await knex.raw(
            `SELECT component.id
             FROM ${qSchemaTable(schemaName, '_app_components')} component
             INNER JOIN ${qSchemaTable(schemaName, '_app_objects')} object_row ON object_row.id = component.object_id
             WHERE object_row.table_name = ? AND component.codename = ?::jsonb`,
            [tableTemplateTable, JSON.stringify('MaterialRef')]
        )
        expect(materialRefComponents.rows).toHaveLength(0)

        await expect(executeWorkspaceCopy(targetWorkspaceId, createWorkspace)).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
            message: 'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
        })

        expect(createWorkspace).not.toHaveBeenCalled()
        const targetWorkspace = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const targetTemplates = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, tableTemplateTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const targetMaterials = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const sourceAggregate = await knex.raw(
            `SELECT template_row.id AS template_id,
                    material_row.id AS material_id,
                    material_row.template_owner_id,
                    material_row.body AS material_body,
                    child_row.material_ref
             FROM ${qSchemaTable(schemaName, tableTemplateTable)} template_row
             INNER JOIN ${qSchemaTable(schemaName, materialTable)} material_row
                ON LOWER(material_row.template_owner_id) = LOWER(template_row.id::text)
             INNER JOIN ${qSchemaTable(schemaName, tableTemplateChildTable)} child_row
                ON child_row._tp_parent_id = template_row.id
             WHERE template_row.workspace_id = ?`,
            [workspaceId]
        )

        expect(targetWorkspace.rows).toHaveLength(0)
        expect(targetTemplates.rows).toHaveLength(0)
        expect(targetMaterials.rows).toHaveLength(0)
        expect(sourceAggregate.rows).toEqual([
            {
                template_id: templateId,
                material_id: materialId,
                template_owner_id: templateId,
                material_body: 'Source material',
                material_ref: null
            }
        ])
    }, 30_000)

    it('fails before workspace creation when an included Material points to an excluded TableTemplate', async () => {
        const { templateId, materialId } = await seedTemplateOwnerMaterial('include', 'exclude')
        const targetWorkspaceId = generateUuidV7()
        const createWorkspace: Parameters<typeof copyWorkspaceOperation>[2]['createWorkspace'] = jest.fn(async (transaction) => {
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            return { id: targetWorkspaceId }
        })

        await expect(executeWorkspaceCopy(targetWorkspaceId, createWorkspace)).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED',
            message: 'Workspace copy cannot preserve TableTemplate Material relationships across excluded records'
        })

        expect(createWorkspace).not.toHaveBeenCalled()
        const targetWorkspace = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const targetTemplates = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, tableTemplateTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const targetMaterials = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const sourceAggregate = await knex.raw(
            `SELECT template_row.id AS template_id,
                    material_row.id AS material_id,
                    material_row.template_owner_id,
                    material_row.body AS material_body,
                    child_row.material_ref
             FROM ${qSchemaTable(schemaName, tableTemplateTable)} template_row
             INNER JOIN ${qSchemaTable(schemaName, materialTable)} material_row
                ON LOWER(material_row.template_owner_id) = LOWER(template_row.id::text)
             INNER JOIN ${qSchemaTable(schemaName, tableTemplateChildTable)} child_row
                ON child_row._tp_parent_id = template_row.id
             WHERE template_row.workspace_id = ?`,
            [workspaceId]
        )

        expect(targetWorkspace.rows).toHaveLength(0)
        expect(targetTemplates.rows).toHaveLength(0)
        expect(targetMaterials.rows).toHaveLength(0)
        expect(sourceAggregate.rows).toEqual([
            {
                template_id: templateId,
                material_id: materialId,
                template_owner_id: templateId,
                material_body: 'Source material',
                material_ref: null
            }
        ])
    }, 30_000)

    it('remaps an included Material TemplateOwnerId to the copied TableTemplate UUID v7 and preserves source data', async () => {
        const { templateId, materialId } = await seedTemplateOwnerMaterial('include')
        const targetWorkspaceId = generateUuidV7()

        const copiedWorkspace = await executeWorkspaceCopy(targetWorkspaceId)
        const copiedTemplates = await knex.raw(
            `SELECT id, name FROM ${qSchemaTable(schemaName, tableTemplateTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const copiedMaterials = await knex.raw(
            `SELECT id, body, template_owner_id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const sourceTemplates = await knex.raw(
            `SELECT id, name FROM ${qSchemaTable(schemaName, tableTemplateTable)} WHERE workspace_id = ?`,
            [workspaceId]
        )
        const sourceMaterials = await knex.raw(
            `SELECT id, body, template_owner_id FROM ${qSchemaTable(schemaName, materialTable)} WHERE workspace_id = ?`,
            [workspaceId]
        )
        const copiedTemplate = copiedTemplates.rows[0]
        const copiedMaterial = copiedMaterials.rows[0]

        expect(copiedWorkspace.id).toBe(targetWorkspaceId)
        expect(copiedTemplates.rows).toHaveLength(1)
        expect(copiedMaterials.rows).toHaveLength(1)
        expect(isUuidV7(copiedTemplate.id)).toBe(true)
        expect(copiedTemplate.id).not.toBe(templateId)
        expect(copiedTemplate.name).toBe('Source template')
        expect(isUuidV7(copiedMaterial.id)).toBe(true)
        expect(copiedMaterial.body).toBe('Source material')
        expect(copiedMaterial.template_owner_id).toBe(copiedTemplate.id)
        expect(isUuidV7(copiedMaterial.template_owner_id)).toBe(true)
        expect(sourceTemplates.rows).toEqual([{ id: templateId, name: 'Source template' }])
        expect(sourceMaterials.rows).toEqual([{ id: materialId, body: 'Source material', template_owner_id: templateId }])
    }, 30_000)

    it('keeps one source snapshot while same- and cross-workspace writes proceed without table locks', async () => {
        const executor = createKnexExecutor(knex)
        const sourceStructureId = generateUuidV7()
        const sourceCellId = generateUuidV7()
        const sourceSettingId = generateUuidV7()
        const insertedSourceSettingId = generateUuidV7()
        const insertedSourceStructureId = generateUuidV7()
        const insertedOtherWorkspaceStructureId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, structureTable)} (id, workspace_id, name, kind, amount, metadata, _upl_created_at)
             VALUES (?, ?, 'Snapshot source', 'structure', ?::numeric, ?::jsonb, NOW())`,
            [sourceStructureId, workspaceId, '9007199254740993.0000000001', JSON.stringify({ locale: 'en', enabled: true })]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, matrixTable)} (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_value)
             VALUES (?, ?, ?, 1, 'Before deletion')`,
            [sourceCellId, workspaceId, sourceStructureId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                '_app_workspace_settings'
            )} (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
             VALUES (?, ?, 'global', ?, '', 'copyMode', ?::jsonb)`,
            [sourceSettingId, workspaceId, workspaceId, JSON.stringify(true)]
        )

        let resolveSnapshotReady!: () => void
        let releaseSnapshot!: () => void
        const snapshotReady = new Promise<void>((resolve) => {
            resolveSnapshotReady = resolve
        })
        const snapshotReleased = new Promise<void>((resolve) => {
            releaseSnapshot = resolve
        })
        const snapshotTransaction = executor.transaction(async (transaction) => {
            await materializeWorkspaceCopySourceSnapshot(transaction, schemaName, workspaceId, [matrixTable, structureTable])
            resolveSnapshotReady()
            await snapshotReleased
            const rows = await transaction.query<{ source_table_name: string; id: string; row_data: Record<string, unknown> }>(
                `SELECT source_table_name, id, row_data
                 FROM workspace_copy_source_rows
                 ORDER BY source_table_name ASC, id ASC`
            )
            const [typedStructure] = await transaction.query<{ amount: string; metadata: Record<string, unknown> }>(
                `SELECT restored.amount::text AS amount, restored.metadata
                 FROM workspace_copy_source_rows source_snapshot
                 CROSS JOIN LATERAL jsonb_populate_record(
                     NULL::${qSchemaTable(schemaName, structureTable)},
                     source_snapshot.row_data
                 ) AS restored
                 WHERE source_snapshot.source_table_name = $1
                   AND source_snapshot.id = $2`,
                [structureTable, sourceStructureId]
            )
            const settings = await transaction.query<{ id: string; key: string; value: unknown }>(
                `SELECT id, key, value
                 FROM workspace_copy_source_settings
                 WHERE workspace_id = $1
                 ORDER BY id ASC`,
                [workspaceId]
            )
            return { rows, typedStructure, settings }
        })
        await snapshotReady

        let writerSettled = false
        let writerError: unknown
        const writer = knex
            .transaction(async (transaction) => {
                // Match the child-before-parent mutation order used by aggregate deletion.
                await transaction.raw(`UPDATE ${qSchemaTable(schemaName, matrixTable)} SET _upl_deleted = true WHERE id = ?`, [
                    sourceCellId
                ])
                await transaction.raw(`UPDATE ${qSchemaTable(schemaName, structureTable)} SET name = 'Deleted source' WHERE id = ?`, [
                    sourceStructureId
                ])
                await transaction.raw(
                    `INSERT INTO ${qSchemaTable(
                        schemaName,
                        structureTable
                    )} (id, workspace_id, name, kind, _upl_created_at) VALUES (?, ?, ?, ?, NOW())`,
                    [insertedSourceStructureId, workspaceId, 'Concurrent source insert', 'structure']
                )
                await transaction.raw(
                    `INSERT INTO ${qSchemaTable(
                        schemaName,
                        structureTable
                    )} (id, workspace_id, name, kind, _upl_created_at) VALUES (?, ?, ?, ?, NOW())`,
                    [insertedOtherWorkspaceStructureId, otherWorkspaceId, 'Other workspace write', 'structure']
                )
                await transaction.raw(`UPDATE ${qSchemaTable(schemaName, '_app_workspace_settings')} SET value = ?::jsonb WHERE id = ?`, [
                    JSON.stringify(false),
                    sourceSettingId
                ])
                await transaction.raw(
                    `INSERT INTO ${qSchemaTable(
                        schemaName,
                        '_app_workspace_settings'
                    )} (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
                     VALUES (?, ?, 'global', ?, '', 'concurrentSetting', ?::jsonb)`,
                    [insertedSourceSettingId, workspaceId, workspaceId, JSON.stringify(true)]
                )
            })
            .then(
                () => {
                    writerSettled = true
                },
                (error: unknown) => {
                    writerError = error
                    writerSettled = true
                }
            )

        let writerCompletedBeforeSnapshotRelease = false
        try {
            const deadline = Date.now() + 5_000
            while (!writerSettled && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
            writerCompletedBeforeSnapshotRelease = writerSettled
        } finally {
            releaseSnapshot()
            await Promise.all([snapshotTransaction, writer])
        }

        if (writerError) throw writerError
        expect(writerCompletedBeforeSnapshotRelease).toBe(true)
        const { rows: snapshotRows, typedStructure, settings: snapshotSettings } = await snapshotTransaction
        const snapshotStructure = snapshotRows.find((row) => row.source_table_name === structureTable && row.id === sourceStructureId)
        const snapshotCell = snapshotRows.find((row) => row.source_table_name === matrixTable && row.id === sourceCellId)
        expect(snapshotRows).toHaveLength(2)
        expect(snapshotStructure?.row_data).toMatchObject({ name: 'Snapshot source', workspace_id: workspaceId })
        expect(snapshotCell?.row_data).toMatchObject({ cell_value: 'Before deletion', _upl_deleted: false })
        expect(typedStructure).toEqual({ amount: '9007199254740993.0000000001', metadata: { locale: 'en', enabled: true } })
        expect(snapshotSettings).toEqual([{ id: sourceSettingId, key: 'copyMode', value: true }])
        expect(snapshotRows.some((row) => row.id === insertedSourceStructureId)).toBe(false)
        expect(snapshotRows.some((row) => row.id === insertedOtherWorkspaceStructureId)).toBe(false)
    })

    it('keeps the source workspace lock compatible with a concurrent runtime writer', async () => {
        await seedWorkspaceCopySource('copy-lock-source')
        const targetWorkspaceId = generateUuidV7()
        let signalCopyAtCreate!: () => void
        let releaseCopy!: () => void
        const copyAtCreate = new Promise<void>((resolve) => {
            signalCopyAtCreate = resolve
        })
        const copyMayCreate = new Promise<void>((resolve) => {
            releaseCopy = resolve
        })
        const copy = executeWorkspaceCopy(targetWorkspaceId, async (transaction) => {
            signalCopyAtCreate()
            await copyMayCreate
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            return { id: targetWorkspaceId }
        })

        let writerSettled = false
        let writerError: unknown
        const writer = knex
            .transaction(async (transaction) => {
                await transaction.raw('SELECT pg_advisory_xact_lock_shared(hashtextextended(?::text, 0))', [
                    `workspace-baseline:${schemaName}:${applicationId}`
                ])
                const locked = await transaction.raw(
                    `SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ? FOR SHARE`,
                    [workspaceId]
                )
                expect(locked.rows).toHaveLength(1)
                await transaction.raw(`UPDATE ${qSchemaTable(schemaName, workspaceCopyParentTable)} SET name = ? WHERE workspace_id = ?`, [
                    'Writer completed during copy',
                    workspaceId
                ])
            })
            .then(
                () => {
                    writerSettled = true
                },
                (error: unknown) => {
                    writerError = error
                    writerSettled = true
                }
            )

        let writerCompletedBeforeCopyRelease = false
        try {
            await copyAtCreate
            const lifecycleLockProbe = await knex.raw('SELECT pg_try_advisory_xact_lock(hashtextextended(?::text, 0)) AS acquired', [
                `workspace-baseline:${schemaName}:${applicationId}`
            ])
            expect(lifecycleLockProbe.rows[0]?.acquired).toBe(false)
            const deadline = Date.now() + 5_000
            while (!writerSettled && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25))
            writerCompletedBeforeCopyRelease = writerSettled
        } finally {
            releaseCopy()
            await Promise.all([copy, writer])
        }

        if (writerError) throw writerError
        expect(writerCompletedBeforeCopyRelease).toBe(true)
        const lifecycleLockAfterCopy = await knex.raw('SELECT pg_try_advisory_xact_lock(hashtextextended(?::text, 0)) AS acquired', [
            `workspace-baseline:${schemaName}:${applicationId}`
        ])
        expect(lifecycleLockAfterCopy.rows[0]?.acquired).toBe(true)
    }, 30_000)

    it('takes the schema lock before the shared baseline lock during a concurrent schema sync', async () => {
        await seedWorkspaceCopySource('schema lock ordering')
        let signalSchemaLocked!: () => void
        let allowSchemaSyncToAcquireBaseline!: () => void
        let signalSyncBaselineLocked!: () => void
        let releaseSchemaSync!: () => void
        const schemaLocked = new Promise<void>((resolve) => (signalSchemaLocked = resolve))
        const allowBaseline = new Promise<void>((resolve) => (allowSchemaSyncToAcquireBaseline = resolve))
        const syncBaselineLocked = new Promise<void>((resolve) => (signalSyncBaselineLocked = resolve))
        const releaseSync = new Promise<void>((resolve) => (releaseSchemaSync = resolve))

        const schemaSync = knex.transaction(async (transaction) => {
            await transaction.raw('SELECT pg_advisory_xact_lock(hashtextextended(?::text, 0))', [schemaName])
            signalSchemaLocked()
            await allowBaseline
            await transaction.raw('SELECT pg_advisory_xact_lock(hashtextextended(?::text, 0))', [
                `workspace-baseline:${schemaName}:${applicationId}`
            ])
            signalSyncBaselineLocked()
            await releaseSync
        })

        let copyError: unknown
        const copy = executeWorkspaceCopy(generateUuidV7()).catch((error: unknown) => {
            copyError = error
        })

        const probeAdvisoryWaiter = async (lockKey: string): Promise<boolean> => {
            const deadline = Date.now() + 5_000
            while (Date.now() < deadline) {
                const result = await knex.raw(
                    `SELECT count(*)::int AS waiting
                     FROM pg_locks
                     WHERE locktype = 'advisory'
                       AND NOT granted
                       AND objsubid = 1
                       AND classid::bigint = ((hashtextextended(?::text, 0) >> 32) & 4294967295)
                       AND objid::bigint = (hashtextextended(?::text, 0) & 4294967295)`,
                    [lockKey, lockKey]
                )
                if (Number(result.rows[0]?.waiting ?? 0) > 0) return true
                await new Promise((resolve) => setTimeout(resolve, 20))
            }
            return false
        }

        try {
            await schemaLocked
            const copyWaitsForSchemaMetadata = await probeAdvisoryWaiter(schemaName)
            expect(copyWaitsForSchemaMetadata).toBe(true)
            const baselineAvailable = await knex.raw('SELECT pg_try_advisory_xact_lock(hashtextextended(?::text, 0)) AS acquired', [
                `workspace-baseline:${schemaName}:${applicationId}`
            ])
            expect(baselineAvailable.rows[0]?.acquired).toBe(true)

            allowSchemaSyncToAcquireBaseline()
            await syncBaselineLocked
        } finally {
            allowSchemaSyncToAcquireBaseline()
            releaseSchemaSync()
            await Promise.allSettled([schemaSync, copy])
        }

        if (copyError) throw copyError
    }, 30_000)

    it('serializes concurrent default-workspace changes for one user', async () => {
        const userId = generateUuidV7()
        const firstWorkspaceId = generateUuidV7()
        const secondWorkspaceId = generateUuidV7()
        const actorUserId = generateUuidV7()
        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?), (?)`, [
            firstWorkspaceId,
            secondWorkspaceId
        ])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, '_app_workspace_user_roles')}
                (id, workspace_id, user_id, role_id, is_default_workspace)
             VALUES (?, ?, ?, ?, true), (?, ?, ?, ?, false)`,
            [generateUuidV7(), firstWorkspaceId, userId, generateUuidV7(), generateUuidV7(), secondWorkspaceId, userId, generateUuidV7()]
        )

        const executor = createKnexExecutor(knex)
        await Promise.all([
            setDefaultWorkspace(executor, { schemaName, userId, workspaceId: firstWorkspaceId, actorUserId }),
            setDefaultWorkspace(executor, { schemaName, userId, workspaceId: secondWorkspaceId, actorUserId })
        ])

        const defaults = await knex.raw(
            `SELECT workspace_id FROM ${qSchemaTable(schemaName, '_app_workspace_user_roles')}
             WHERE user_id = ? AND is_default_workspace = true AND _upl_deleted = false AND _app_deleted = false`,
            [userId]
        )
        expect(defaults.rows).toHaveLength(1)
        expect([firstWorkspaceId, secondWorkspaceId]).toContain(defaults.rows[0]?.workspace_id)
    }, 30_000)

    it('copies duplicate UUIDs across tables with table-correct REF and parent links and isolates copies from source deletion', async () => {
        const { sourceParentId, sourceChildId } = await seedWorkspaceCopySource('source child', { duplicateParentChildId: true })
        expect(sourceChildId).toBe(sourceParentId)
        const targetWorkspaceId = generateUuidV7()

        const copiedWorkspace = await executeWorkspaceCopy(targetWorkspaceId)

        expect(copiedWorkspace.id).toBe(targetWorkspaceId)
        const targetParents = await knex.raw(
            `SELECT id, workspace_id, related_id, shared_target_id
             FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const targetChildren = await knex.raw(
            `SELECT id, workspace_id, _tp_parent_id, cell_value
             FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        expect(targetParents.rows).toHaveLength(1)
        expect(targetChildren.rows).toHaveLength(1)
        const copiedParentId = targetParents.rows[0].id as string
        const copiedChildId = targetChildren.rows[0].id as string
        expect(copiedParentId).not.toBe(sourceParentId)
        expect(copiedChildId).not.toBe(sourceChildId)
        expect(copiedParentId).not.toBe(copiedChildId)
        expect(isUuidV7(copiedParentId)).toBe(true)
        expect(isUuidV7(copiedChildId)).toBe(true)
        expect(targetParents.rows[0].related_id).toBe(copiedParentId)
        expect(targetParents.rows[0].shared_target_id).toBe(sourceParentId)
        expect(targetChildren.rows[0]).toEqual({
            id: copiedChildId,
            workspace_id: targetWorkspaceId,
            _tp_parent_id: copiedParentId,
            cell_value: 'source child'
        })

        await knex.raw(`DELETE FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE id = ?`, [sourceParentId])
        const sourceChildrenAfterDelete = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [workspaceId]
        )
        const targetChildrenAfterDelete = await knex.raw(
            `SELECT id, _tp_parent_id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        expect(sourceChildrenAfterDelete.rows).toHaveLength(0)
        expect(targetChildrenAfterDelete.rows).toEqual([{ id: copiedChildId, _tp_parent_id: copiedParentId }])
        const targetParentsAfterDelete = await knex.raw(
            `SELECT id, related_id, shared_target_id FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        expect(targetParentsAfterDelete.rows).toEqual([
            { id: copiedParentId, related_id: copiedParentId, shared_target_id: sourceParentId }
        ])
    })

    it('rolls back a copy when an untyped UUID reference ambiguously matches duplicate table IDs', async () => {
        const { sourceParentId, sourceChildId } = await seedWorkspaceCopySource('ambiguous untyped reference', {
            duplicateParentChildId: true,
            ambiguousUntypedReference: true
        })
        const targetWorkspaceId = generateUuidV7()

        await expect(executeWorkspaceCopy(targetWorkspaceId)).rejects.toMatchObject({
            code: 'WORKSPACE_COPY_REFERENCE_UNRESOLVED',
            message: 'Workspace copy contains an ambiguous UUID reference without target metadata'
        })

        const targetWorkspace = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const targetRows = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE workspace_id = ?`, [
            targetWorkspaceId
        ])
        const targetChildren = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const targetMemberships = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, '_app_workspace_user_roles')} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const preservedSourceParent = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE workspace_id = ? AND id = ?`,
            [workspaceId, sourceParentId]
        )
        const preservedSourceChild = await knex.raw(
            `SELECT id, _tp_parent_id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ? AND id = ?`,
            [workspaceId, sourceChildId]
        )
        expect(targetWorkspace.rows).toHaveLength(0)
        expect(targetRows.rows).toHaveLength(0)
        expect(targetChildren.rows).toHaveLength(0)
        expect(targetMemberships.rows).toHaveLength(0)
        expect(preservedSourceParent.rows).toEqual([{ id: sourceParentId }])
        expect(preservedSourceChild.rows).toEqual([{ id: sourceChildId, _tp_parent_id: sourceParentId }])
    })

    it('persists copied widget settings against the current application layout owner and drops stale layout owners', async () => {
        const targetWorkspaceId = generateUuidV7()
        const widgetSettingKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        const widgetInstanceKey = 'matrix-main'
        const staleLayoutId = generateUuidV7()
        const settingIds = [generateUuidV7(), generateUuidV7()]

        await knex.raw(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES (?)`, [workspaceId])
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                '_app_workspace_settings'
            )} (id, workspace_id, target_kind, target_owner_id, target_key, key, value)
             VALUES (?, ?, 'widget', ?, ?, ?, ?::jsonb), (?, ?, 'widget', ?, ?, ?, ?::jsonb)`,
            [
                settingIds[0],
                workspaceId,
                layoutId,
                widgetInstanceKey,
                widgetSettingKey,
                JSON.stringify(true),
                settingIds[1],
                workspaceId,
                staleLayoutId,
                widgetInstanceKey,
                widgetSettingKey,
                JSON.stringify(false)
            ]
        )

        await executeWorkspaceCopy(targetWorkspaceId, undefined, {
            workspaceOverrides: {
                allowedAddresses: [{ key: widgetSettingKey, target: { kind: 'widget', instanceKey: widgetInstanceKey } }]
            }
        })

        const copiedSettings = await knex.raw(
            `SELECT id, target_owner_id, target_key, key, value
             FROM ${qSchemaTable(schemaName, '_app_workspace_settings')}
             WHERE workspace_id = ?
             ORDER BY id ASC`,
            [targetWorkspaceId]
        )
        expect(copiedSettings.rows).toEqual([
            {
                id: expect.any(String),
                target_owner_id: layoutId,
                target_key: widgetInstanceKey,
                key: widgetSettingKey,
                value: true
            }
        ])
        expect(isUuidV7(copiedSettings.rows[0].id as string)).toBe(true)
        expect(copiedSettings.rows[0].id).not.toBe(settingIds[0])
    })

    it('rolls back the target workspace and copied parent when PostgreSQL rejects a copied child row', async () => {
        const { sourceChildId } = await seedWorkspaceCopySource('duplicate value')
        const targetWorkspaceId = generateUuidV7()
        const targetSeedParentId = generateUuidV7()
        const targetSeedChildId = generateUuidV7()
        const createTargetWithConflictingChild: Parameters<typeof copyWorkspaceOperation>[2]['createWorkspace'] = async (transaction) => {
            await transaction.query(`INSERT INTO ${qSchemaTable(schemaName, '_app_workspaces')} (id) VALUES ($1)`, [targetWorkspaceId])
            await transaction.query(
                `INSERT INTO ${qSchemaTable(schemaName, workspaceCopyParentTable)} (id, workspace_id, name)
                 VALUES ($1, $2, 'Target seed')`,
                [targetSeedParentId, targetWorkspaceId]
            )
            await transaction.query(
                `INSERT INTO ${qSchemaTable(schemaName, workspaceCopyChildTable)}
                    (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_value)
                 VALUES ($1, $2, $3, 0, 'duplicate value')`,
                [targetSeedChildId, targetWorkspaceId, targetSeedParentId]
            )
            return { id: targetWorkspaceId }
        }

        await expect(executeWorkspaceCopy(targetWorkspaceId, createTargetWithConflictingChild)).rejects.toMatchObject({ code: '23505' })

        const targetWorkspaces = await knex.raw(`SELECT id FROM ${qSchemaTable(schemaName, '_app_workspaces')} WHERE id = ?`, [
            targetWorkspaceId
        ])
        const targetParents = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyParentTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const targetChildren = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [targetWorkspaceId]
        )
        const sourceChildren = await knex.raw(
            `SELECT id FROM ${qSchemaTable(schemaName, workspaceCopyChildTable)} WHERE workspace_id = ?`,
            [workspaceId]
        )
        expect(targetWorkspaces.rows).toHaveLength(0)
        expect(targetParents.rows).toHaveLength(0)
        expect(targetChildren.rows).toHaveLength(0)
        expect(sourceChildren.rows).toEqual([{ id: sourceChildId }])
    })
})
