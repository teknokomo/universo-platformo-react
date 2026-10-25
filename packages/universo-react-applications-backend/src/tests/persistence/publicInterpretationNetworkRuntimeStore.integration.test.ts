import type { Knex } from 'knex'
import { createKnexExecutor, qSchema, qSchemaTable } from '@universo-react/database'
import { generateUuidV7 } from '@universo-react/utils'
import {
    findPublicInterpretationNetworkRuntimeRecord,
    listPublicInterpretationNetworkMatrixRows,
    listPublicInterpretationNetworkRuntimeRows
} from '../../persistence/publicInterpretationNetworkRuntimeStore'
import {
    PublicInterpretationNetworkUnavailableError,
    MAX_PUBLIC_BODY_BYTES,
    type PublicInterpretationNetworkReadInput
} from '../../services/publicInterpretationNetwork/contracts'
import { issueHandle } from '../../services/publicInterpretationNetwork/handles'
import { readInterpretations } from '../../services/publicInterpretationNetwork/interpretationsReader'
import { readMaterials } from '../../services/publicInterpretationNetwork/materialsReader'
import type { RuntimeSurfaceReady } from '../../shared/interpretationNetworkRuntimeContracts'

const DATABASE_TEST_URL = process.env.DATABASE_TEST_URL?.trim()
if (process.env.REQUIRE_DATABASE_TESTS === '1' && !DATABASE_TEST_URL) {
    throw new Error('DATABASE_TEST_URL is required for Interpretation Network public runtime store PostgreSQL integration tests')
}

const describeIntegration = DATABASE_TEST_URL ? describe : describe.skip
const schemaName = `app_${generateUuidV7().replaceAll('-', '')}`
const structureTable = 'obj_structure_public_runtime_test'
const interpretationTable = 'obj_interpretation_public_runtime_test'
const matrixTable = 'obj_interpretation_public_runtime_test_matrix'
const materialTable = 'obj_material_public_runtime_test'
const applicationId = generateUuidV7()
const workspaceId = generateUuidV7()
const otherWorkspaceId = generateUuidV7()
const layoutId = generateUuidV7()
const widgetId = generateUuidV7()

const field = (codename: string, columnName: string) => ({
    id: generateUuidV7(),
    codename,
    column_name: columnName,
    data_type: 'STRING' as const
})

const structureContract = {
    object: { id: generateUuidV7(), codename: 'Structure', table_name: structureTable },
    fields: {
        Name: field('Name', 'name'),
        Description: field('Description', 'description')
    },
    childFields: {}
}

const interpretationContract = {
    object: { id: generateUuidV7(), codename: 'Interpretation', table_name: interpretationTable },
    fields: {
        Title: field('Title', 'title'),
        ParentStructure: field('ParentStructure', 'parent_structure_id')
    },
    childFields: {
        CellId: field('CellId', 'cell_id'),
        CellValue: field('CellValue', 'cell_value')
    },
    childTableName: matrixTable
}

const emptyContract = (codename: 'Material' | 'TableTemplate') => ({
    object: { id: generateUuidV7(), codename, table_name: `obj_${codename.toLowerCase()}_public_runtime_test` },
    fields: {},
    childFields: {}
})

const materialContract = {
    object: { id: generateUuidV7(), codename: 'Material', table_name: materialTable },
    fields: {
        Title: field('Title', 'title'),
        Body: field('Body', 'body'),
        InterpretationId: field('InterpretationId', 'interpretation_id'),
        CellId: field('CellId', 'cell_id'),
        TemplateOwnerId: field('TemplateOwnerId', 'template_owner_id')
    },
    childFields: {}
}

const surface: RuntimeSurfaceReady = {
    applicationId,
    schemaName,
    workspaceId,
    layoutId,
    widgetId,
    widgetKey: 'interpretationNetworkWorkspace',
    widgetConfig: {},
    structureMode: 'multiple',
    featureState: 'ready',
    missing: [],
    contracts: {
        Structure: structureContract,
        Interpretation: interpretationContract,
        Material: materialContract,
        TableTemplate: emptyContract('TableTemplate')
    },
    resolvedObjects: {
        Structure: structureContract.object.id,
        Interpretation: interpretationContract.object.id,
        Material: generateUuidV7(),
        TableTemplate: generateUuidV7()
    }
}

describeIntegration('publicInterpretationNetworkRuntimeStore PostgreSQL integration', () => {
    let knex: Knex

    beforeAll(async () => {
        const knexModule = await import('knex')
        knex = knexModule.default({ client: 'pg', connection: DATABASE_TEST_URL, pool: { min: 1, max: 2 } })

        await knex.raw(`CREATE SCHEMA ${qSchema(schemaName)}`)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, structureTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NULL,
                name TEXT NULL,
                description TEXT NULL,
                kind TEXT NULL,
                amount NUMERIC(30, 10) NULL,
                metadata JSONB NULL,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_published BOOLEAN NOT NULL DEFAULT true
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, interpretationTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NULL,
                title TEXT NULL,
                parent_structure_id UUID NULL,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_published BOOLEAN NOT NULL DEFAULT true
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, materialTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NULL,
                title TEXT NULL,
                body JSONB NULL,
                interpretation_id UUID NULL,
                cell_id TEXT NULL,
                template_owner_id UUID NULL,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_published BOOLEAN NOT NULL DEFAULT true
            )
        `)
        await knex.raw(`
            CREATE TABLE ${qSchemaTable(schemaName, matrixTable)} (
                id UUID PRIMARY KEY,
                workspace_id UUID NULL,
                _tp_parent_id UUID NOT NULL,
                _tp_sort_order INTEGER NOT NULL,
                cell_id TEXT NULL,
                cell_value TEXT NULL,
                _upl_created_at TIMESTAMPTZ NULL,
                _upl_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_deleted BOOLEAN NOT NULL DEFAULT false,
                _app_published BOOLEAN NOT NULL DEFAULT true
            )
        `)
    })

    beforeEach(async () => {
        await knex.raw(
            `TRUNCATE TABLE ${qSchemaTable(schemaName, matrixTable)}, ${qSchemaTable(schemaName, materialTable)}, ${qSchemaTable(
                schemaName,
                interpretationTable
            )}, ${qSchemaTable(schemaName, structureTable)}`
        )
    })

    afterAll(async () => {
        try {
            if (knex) await knex.raw(`DROP SCHEMA IF EXISTS ${qSchema(schemaName)} CASCADE`)
        } finally {
            if (knex) await knex.destroy()
        }
    })

    it('finds only an active record from the selected Workspace and projects requested aliases', async () => {
        const visibleId = generateUuidV7()
        const otherWorkspaceRowId = generateUuidV7()
        const deletedRowId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                structureTable
            )} (id, workspace_id, name, description, _upl_created_at, _upl_deleted, _app_deleted)
             VALUES
                (?, ?, ?, ?, ?::timestamptz, false, false),
                (?, ?, ?, ?, ?::timestamptz, false, false),
                (?, ?, ?, ?, ?::timestamptz, true, false)`,
            [
                visibleId,
                workspaceId,
                'Visible',
                'Selected workspace',
                '2026-01-01T00:00:00Z',
                otherWorkspaceRowId,
                otherWorkspaceId,
                'Other',
                'Other workspace',
                '2026-01-01T00:00:01Z',
                deletedRowId,
                workspaceId,
                'Deleted',
                'Soft deleted',
                '2026-01-01T00:00:02Z'
            ]
        )

        const executor = createKnexExecutor(knex)
        const visible = await findPublicInterpretationNetworkRuntimeRecord(executor, surface, structureContract, visibleId, [
            { field: 'name', alias: 'displayName' },
            { field: 'description', alias: 'displayDescription' }
        ])

        expect(visible).toEqual({ id: visibleId, displayName: 'Visible', displayDescription: 'Selected workspace' })
        await expect(
            findPublicInterpretationNetworkRuntimeRecord(executor, surface, structureContract, otherWorkspaceRowId, [
                { field: 'name', alias: 'displayName' }
            ])
        ).resolves.toBeNull()
        await expect(
            findPublicInterpretationNetworkRuntimeRecord(executor, surface, structureContract, deletedRowId, [
                { field: 'name', alias: 'displayName' }
            ])
        ).resolves.toBeNull()
    })

    it('excludes unpublished Structures, Interpretations, Materials, Matrix cells, and unpublished Matrix parents', async () => {
        const executor = createKnexExecutor(knex)
        const readInput = {
            executor,
            surface,
            applicationId,
            layoutId,
            widgetId,
            instanceKey: 'public-runtime-regression',
            target: { applicationId, targetKind: null, locale: 'en' },
            locale: 'en',
            view: 'interpretations',
            offset: 0
        } satisfies PublicInterpretationNetworkReadInput
        const publishedStructureId = generateUuidV7()
        const unpublishedStructureId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, structureTable)} (id, workspace_id, name, _app_published)
             VALUES (?, ?, 'Published Structure', true), (?, ?, 'Unpublished Structure', false)`,
            [publishedStructureId, workspaceId, unpublishedStructureId, workspaceId]
        )

        const structures = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: structureContract,
            columns: [{ field: 'name', alias: 'name' }],
            filters: [],
            limit: 10,
            offset: 0
        })
        expect(structures).toEqual([{ id: publishedStructureId, name: 'Published Structure' }])
        await expect(
            findPublicInterpretationNetworkRuntimeRecord(executor, surface, structureContract, unpublishedStructureId, [])
        ).resolves.toBeNull()

        const publishedInterpretationId = generateUuidV7()
        const unpublishedInterpretationId = generateUuidV7()
        const interpretationUnderUnpublishedStructureId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, interpretationTable)}
                (id, workspace_id, title, parent_structure_id, _app_published)
             VALUES (?, ?, 'Published Interpretation', ?, true),
                    (?, ?, 'Unpublished Interpretation', ?, false),
                    (?, ?, 'Interpretation under unpublished Structure', ?, true)`,
            [
                publishedInterpretationId,
                workspaceId,
                publishedStructureId,
                unpublishedInterpretationId,
                workspaceId,
                publishedStructureId,
                interpretationUnderUnpublishedStructureId,
                workspaceId,
                unpublishedStructureId
            ]
        )
        const interpretations = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: interpretationContract,
            columns: [{ field: 'title', alias: 'title' }],
            filters: [{ field: 'parent_structure_id', operator: 'equals', value: publishedStructureId }],
            limit: 10,
            offset: 0
        })
        expect(interpretations).toEqual([{ id: publishedInterpretationId, title: 'Published Interpretation' }])
        await expect(
            findPublicInterpretationNetworkRuntimeRecord(executor, surface, interpretationContract, unpublishedInterpretationId, [])
        ).resolves.toBeNull()
        const visibleInterpretations = await readInterpretations({
            ...readInput,
            parentHandle: issueHandle(readInput, { kind: 'structure', recordId: publishedStructureId })
        })
        expect(visibleInterpretations.items).toEqual([expect.objectContaining({ title: 'Published Interpretation' })])
        await expect(
            readInterpretations({
                ...readInput,
                parentHandle: issueHandle(readInput, { kind: 'structure', recordId: unpublishedStructureId })
            })
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)

        const publishedMaterialId = generateUuidV7()
        const unpublishedMaterialId = generateUuidV7()
        const materialUnderUnpublishedInterpretationId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, materialTable)}
                (id, workspace_id, title, interpretation_id, cell_id, _app_published)
             VALUES (?, ?, 'Published Material', ?, 'cell-public', true),
                    (?, ?, 'Unpublished Material', ?, 'cell-public', false),
                    (?, ?, 'Published Material under unpublished Interpretation', ?, 'cell-hidden-parent', true)`,
            [
                publishedMaterialId,
                workspaceId,
                publishedInterpretationId,
                unpublishedMaterialId,
                workspaceId,
                publishedInterpretationId,
                materialUnderUnpublishedInterpretationId,
                workspaceId,
                unpublishedInterpretationId
            ]
        )
        const materials = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: materialContract,
            columns: [{ field: 'title', alias: 'title' }],
            filters: [{ field: 'interpretation_id', operator: 'equals', value: publishedInterpretationId }],
            limit: 10,
            offset: 0
        })
        expect(materials).toEqual([{ id: publishedMaterialId, title: 'Published Material' }])

        const publishedCellId = generateUuidV7()
        const unpublishedCellId = generateUuidV7()
        const cellUnderUnpublishedInterpretationId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, matrixTable)}
                (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, cell_value, _app_published)
             VALUES (?, ?, ?, 1, 'cell-public', 'Published cell', true),
                    (?, ?, ?, 2, 'cell-unpublished', 'Unpublished cell', false),
                    (?, ?, ?, 3, 'cell-hidden-parent', 'Cell under unpublished Interpretation', true)`,
            [
                publishedCellId,
                workspaceId,
                publishedInterpretationId,
                unpublishedCellId,
                workspaceId,
                publishedInterpretationId,
                cellUnderUnpublishedInterpretationId,
                workspaceId,
                unpublishedInterpretationId
            ]
        )
        const publishedCells = await listPublicInterpretationNetworkMatrixRows({
            executor,
            surface,
            columns: [{ field: 'cell_value', alias: 'value' }],
            parentId: publishedInterpretationId,
            limit: 10,
            offset: 0
        })
        expect(publishedCells).toEqual([{ id: publishedCellId, _tp_sort_order: 1, value: 'Published cell' }])
        await expect(
            listPublicInterpretationNetworkMatrixRows({
                executor,
                surface,
                columns: [{ field: 'cell_value', alias: 'value' }],
                parentId: unpublishedInterpretationId,
                limit: 10,
                offset: 0
            })
        ).resolves.toEqual([])

        const materialReadInput: PublicInterpretationNetworkReadInput = { ...readInput, view: 'materials' }
        const visibleMaterials = await readMaterials({
            ...materialReadInput,
            parentHandle: issueHandle(materialReadInput, {
                kind: 'cell',
                recordId: publishedInterpretationId,
                cellId: 'cell-public'
            })
        })
        expect(visibleMaterials.items).toEqual([expect.objectContaining({ title: 'Published Material' })])
        await expect(
            readMaterials({
                ...materialReadInput,
                parentHandle: issueHandle(materialReadInput, {
                    kind: 'cell',
                    recordId: unpublishedInterpretationId,
                    cellId: 'cell-hidden-parent'
                })
            })
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)
    })

    it('applies equals/is-null filters, active Workspace scope, ordering, offset, and the limit-plus-one contract', async () => {
        const rows = [
            { id: generateUuidV7(), name: 'Alpha', description: null, kind: 'keep', createdAt: '2026-02-01T00:00:00Z' },
            { id: generateUuidV7(), name: 'Beta', description: null, kind: 'keep', createdAt: '2026-02-01T00:00:01Z' },
            { id: generateUuidV7(), name: 'Gamma', description: null, kind: 'keep', createdAt: '2026-02-01T00:00:02Z' },
            { id: generateUuidV7(), name: 'Wrong kind', description: null, kind: 'drop', createdAt: '2026-02-01T00:00:03Z' },
            { id: generateUuidV7(), name: 'Has description', description: 'not null', kind: 'keep', createdAt: '2026-02-01T00:00:04Z' }
        ]
        for (const row of rows) {
            await knex.raw(
                `INSERT INTO ${qSchemaTable(
                    schemaName,
                    structureTable
                )} (id, workspace_id, name, description, kind, _upl_created_at) VALUES (?, ?, ?, ?, ?, ?::timestamptz)`,
                [row.id, workspaceId, row.name, row.description, row.kind, row.createdAt]
            )
        }
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                structureTable
            )} (id, workspace_id, name, description, kind, _upl_created_at) VALUES (?, ?, ?, NULL, 'keep', ?::timestamptz)`,
            [generateUuidV7(), otherWorkspaceId, 'Other workspace', '2026-02-01T00:00:00Z']
        )

        const result = await listPublicInterpretationNetworkRuntimeRows({
            executor: createKnexExecutor(knex),
            surface,
            contract: structureContract,
            columns: [{ field: 'name', alias: 'displayName' }],
            filters: [
                { field: 'kind', operator: 'equals', value: 'keep' },
                { field: 'description', operator: 'is-null' }
            ],
            limit: 1,
            offset: 1
        })

        expect(result).toEqual([
            { id: rows[1]!.id, displayName: 'Beta' },
            { id: rows[2]!.id, displayName: 'Gamma' }
        ])
    })

    it('keeps a late-created Primary Material on the first visible page without duplicating later pages', async () => {
        const materials = Array.from({ length: 26 }, (_, index) => ({
            id: generateUuidV7(),
            title: `Material ${String(index + 1).padStart(2, '0')}`,
            createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
        }))
        const primaryMaterial = materials[materials.length - 1]!
        const values = materials.flatMap((material) => [material.id, workspaceId, material.title, 'material', material.createdAt])
        const rowsSql = materials.map(() => '(?, ?, ?, ?, ?::timestamptz)').join(', ')
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, structureTable)} (id, workspace_id, name, kind, _upl_created_at) VALUES ${rowsSql}`,
            values
        )

        const executor = createKnexExecutor(knex)
        const firstPage = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: structureContract,
            columns: [{ field: 'name', alias: 'title' }],
            filters: [{ field: 'kind', operator: 'equals', value: 'material' }],
            limit: 25,
            offset: 0,
            priorityId: primaryMaterial.id
        })
        const nextPage = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: structureContract,
            columns: [{ field: 'name', alias: 'title' }],
            filters: [{ field: 'kind', operator: 'equals', value: 'material' }],
            limit: 25,
            offset: 25,
            priorityId: primaryMaterial.id
        })
        const firstVisiblePage = firstPage.slice(0, 25)
        const nextVisiblePage = nextPage.slice(0, 25)
        const visibleIds = [...firstVisiblePage, ...nextVisiblePage].map((row) => String(row.id))

        expect(firstPage).toHaveLength(26)
        expect(firstVisiblePage[0]?.id).toBe(primaryMaterial.id)
        expect(firstVisiblePage).toHaveLength(25)
        expect(nextVisiblePage).toHaveLength(1)
        expect(new Set(visibleIds).size).toBe(materials.length)
        expect(visibleIds).toContain(primaryMaterial.id)
    })

    it('lists active Matrix child rows by parent and optional CellId with deterministic paging', async () => {
        const parentId = generateUuidV7()
        const otherParentId = generateUuidV7()
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, interpretationTable)} (id, workspace_id, title)
             VALUES (?, ?, 'Parent'), (?, ?, 'Other parent')`,
            [parentId, workspaceId, otherParentId, workspaceId]
        )
        const rows = [
            { id: generateUuidV7(), sort: 20, cellId: 'cell-a', value: 'Second', createdAt: '2026-03-01T00:00:00Z' },
            { id: generateUuidV7(), sort: 10, cellId: 'cell-a', value: 'First', createdAt: '2026-03-01T00:00:02Z' },
            { id: generateUuidV7(), sort: 30, cellId: 'cell-b', value: 'Third', createdAt: '2026-03-01T00:00:01Z' }
        ]
        for (const row of rows) {
            await knex.raw(
                `INSERT INTO ${qSchemaTable(
                    schemaName,
                    matrixTable
                )} (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, cell_value, _upl_created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?::timestamptz)`,
                [row.id, workspaceId, parentId, row.sort, row.cellId, row.value, row.createdAt]
            )
        }
        await knex.raw(
            `INSERT INTO ${qSchemaTable(
                schemaName,
                matrixTable
            )} (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, cell_value, _upl_created_at)
             VALUES
                (?, ?, ?, 1, 'cell-a', 'Other parent', ?::timestamptz),
                (?, ?, ?, 1, 'cell-a', 'Other workspace', ?::timestamptz),
                (?, ?, ?, 1, 'cell-a', 'Deleted', ?::timestamptz)`,
            [
                generateUuidV7(),
                workspaceId,
                otherParentId,
                '2026-03-01T00:00:00Z',
                generateUuidV7(),
                otherWorkspaceId,
                parentId,
                '2026-03-01T00:00:00Z',
                generateUuidV7(),
                workspaceId,
                parentId,
                '2026-03-01T00:00:00Z'
            ]
        )
        await knex.raw(`UPDATE ${qSchemaTable(schemaName, matrixTable)} SET _upl_deleted = true WHERE cell_value = 'Deleted'`)

        const executor = createKnexExecutor(knex)
        const allForParent = await listPublicInterpretationNetworkMatrixRows({
            executor,
            surface,
            columns: [
                { field: 'cell_id', alias: 'cellId' },
                { field: 'cell_value', alias: 'cellValue' }
            ],
            parentId,
            limit: 1,
            offset: 1
        })
        expect(allForParent).toEqual([
            { id: rows[0]!.id, _tp_sort_order: 20, cellId: 'cell-a', cellValue: 'Second' },
            { id: rows[2]!.id, _tp_sort_order: 30, cellId: 'cell-b', cellValue: 'Third' }
        ])

        const cellA = await listPublicInterpretationNetworkMatrixRows({
            executor,
            surface,
            columns: [{ field: 'cell_value', alias: 'cellValue' }],
            parentId,
            cellIdentity: 'cell-a',
            cellIdentityColumn: interpretationContract.childFields.CellId.column_name,
            limit: 10,
            offset: 0
        })
        expect(cellA).toEqual([
            { id: rows[1]!.id, _tp_sort_order: 10, cellValue: 'First' },
            { id: rows[0]!.id, _tp_sort_order: 20, cellValue: 'Second' }
        ])
    })

    it('keeps seeded oversized Material Body bytes inside PostgreSQL and fails the public page closed', async () => {
        const executor = createKnexExecutor(knex)
        const interpretationId = generateUuidV7()
        const materialId = generateUuidV7()
        const cellId = 'cell-with-oversized-material'
        const bodyMarker = 'must-not-leave-the-database-'
        const body = {
            format: 'editorjs',
            data: { blocks: [{ type: 'paragraph', data: { text: bodyMarker + 'x'.repeat(MAX_PUBLIC_BODY_BYTES + 100) } }] }
        }
        const serializedBody = JSON.stringify(body)
        expect(Buffer.byteLength(serializedBody, 'utf8')).toBeGreaterThan(MAX_PUBLIC_BODY_BYTES)

        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, interpretationTable)} (id, workspace_id, title)
             VALUES (?, ?, 'Oversized Body parent')`,
            [interpretationId, workspaceId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, matrixTable)}
                (id, workspace_id, _tp_parent_id, _tp_sort_order, cell_id, cell_value)
             VALUES (?, ?, ?, 1, ?, 'Oversized Body cell')`,
            [generateUuidV7(), workspaceId, interpretationId, cellId]
        )
        await knex.raw(
            `INSERT INTO ${qSchemaTable(schemaName, materialTable)}
                (id, workspace_id, title, body, interpretation_id, cell_id, template_owner_id)
             VALUES (?, ?, 'Oversized Material', ?::jsonb, ?, ?, NULL)`,
            [materialId, workspaceId, serializedBody, interpretationId, cellId]
        )

        const boundedRows = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: materialContract,
            columns: [{ field: 'body', alias: 'body', maxBytes: MAX_PUBLIC_BODY_BYTES, oversizedAlias: 'bodyOversized' }],
            filters: [
                { field: 'interpretation_id', operator: 'equals', value: interpretationId },
                { field: 'cell_id', operator: 'equals', value: cellId },
                { field: 'template_owner_id', operator: 'is-null' }
            ],
            limit: 25,
            offset: 0
        })
        expect(boundedRows).toEqual([{ id: materialId, body: null, bodyOversized: true }])
        expect(JSON.stringify(boundedRows)).not.toContain(bodyMarker)

        const readInput: PublicInterpretationNetworkReadInput = {
            executor,
            surface,
            applicationId,
            layoutId,
            widgetId,
            instanceKey: 'oversized-material-body',
            target: { applicationId, targetKind: null, locale: 'en' },
            locale: 'en',
            view: 'materials',
            offset: 0
        }
        await expect(
            readMaterials({
                ...readInput,
                parentHandle: issueHandle(readInput, { kind: 'cell', recordId: interpretationId, cellId })
            })
        ).rejects.toBeInstanceOf(PublicInterpretationNetworkUnavailableError)
    })
})
