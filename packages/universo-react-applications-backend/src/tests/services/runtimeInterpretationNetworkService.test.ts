import { createMockDbExecutor } from '../utils/dbMocks'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    ensureSingleSystemStructure,
    createMaterialForCell,
    createStructureAggregate,
    deleteInterpretationNetworkTemplate,
    deleteStructureAggregate,
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkMaterialCreateRequestSchema,
    InterpretationNetworkCommandError,
    instantiateStructureFromTemplate,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    resolveInterpretationNetworkRuntimeSurface,
    saveStructureAsTemplate
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { planMatrixRowsCopy } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCopy'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'

describe('runtimeInterpretationNetworkService', () => {
    const schemaName = 'app_018f8a787b8f7c1da111222233334440'
    const workspaceId = '019f2000-0000-7000-8000-000000000010'
    const userId = '019f2000-0000-7000-8000-000000000011'

    it('rejects extra keys in strict command schemas', () => {
        expect(interpretationNetworkEnsureSystemStructureRequestSchema.safeParse({ extra: true }).success).toBe(false)
        expect(
            interpretationNetworkTemplateSaveRequestSchema.safeParse({
                sourceStructureId: '019f2000-0000-7000-8000-000000000001',
                templateName: 'Template',
                includeMaterials: false,
                extra: true
            }).success
        ).toBe(false)
        expect(
            interpretationNetworkTemplateInstantiateRequestSchema.safeParse({
                structureName: 'From template',
                expectedVersion: 1,
                extra: true
            }).success
        ).toBe(false)
    })

    it('returns missing-shared-contract when structureMode is absent', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        id: 'widget-1',
                        layout_id: 'layout-1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: {}
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('missing-metadata')
        expect(surface.structureMode).toBe('multiple')
    })

    it('returns missing-widget when the interpretation network widget is absent', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return []
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('missing-widget')
        expect(surface.missing).toEqual(['interpretationNetworkWorkspace'])
    })

    it('fails closed for multiple active widgets unless the runtime identity scopes the surface', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                expect(params).toEqual(['interpretationNetworkWorkspace', null, null])
                return [
                    {
                        id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                        layout_id: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' }
                    },
                    {
                        id: '018f8a78-7b8f-7c1d-a111-2222333344a2',
                        layout_id: '018f8a78-7b8f-7c1d-a111-2222333345a2',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'multiple' }
                    }
                ]
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('ambiguous-widget')
        expect(surface.widgetId).toBeNull()
    })

    it('resolves ready surface only when the required metadata is present', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        id: 'widget-1',
                        layout_id: 'layout-1',
                        widget_key: 'interpretationNetworkWorkspace',
                        config: { structureMode: 'singleSystem' }
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    { id: 'structure-1', codename: 'Structure', table_name: 'structure' },
                    { id: 'interpretation-1', codename: 'Interpretation', table_name: 'interpretation' },
                    { id: 'material-1', codename: 'Material', table_name: 'material' },
                    { id: 'table-template-1', codename: 'TableTemplate', table_name: 'table_template' }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                const objectId = params?.[0]
                if (objectId === 'structure-1') {
                    return [
                        { codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { codename: 'Description', column_name: 'description', data_type: 'STRING' },
                        { codename: 'SystemKey', column_name: 'system_key', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'interpretation-1') {
                    return [
                        { id: 'interpretation-title', codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { id: 'interpretation-parent', codename: 'ParentStructure', column_name: 'parent_structure', data_type: 'REF' },
                        {
                            id: 'interpretation-matrix',
                            codename: 'InterpretationMatrix',
                            column_name: 'interpretation_matrix',
                            data_type: 'TABLE'
                        },
                        {
                            id: 'interpretation-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'interpretation-matrix'
                        },
                        {
                            id: 'interpretation-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'interpretation-matrix'
                        }
                    ]
                }
                if (objectId === 'material-1') {
                    return [
                        { codename: 'Title', column_name: 'title', data_type: 'STRING' },
                        { codename: 'Description', column_name: 'description', data_type: 'STRING' },
                        { codename: 'Body', column_name: 'body', data_type: 'JSON' },
                        { codename: 'CellId', column_name: 'cell_id', data_type: 'STRING' },
                        { codename: 'TemplateOwnerId', column_name: 'template_owner_id', data_type: 'STRING' }
                    ]
                }
                if (objectId === 'table-template-1') {
                    return [
                        { id: 'template-name', codename: 'Name', column_name: 'name', data_type: 'STRING' },
                        { id: 'template-policy', codename: 'MaterialPolicy', column_name: 'material_policy', data_type: 'STRING' },
                        { id: 'template-matrix', codename: 'TemplateMatrix', column_name: 'template_matrix', data_type: 'TABLE' },
                        {
                            id: 'template-cell-id',
                            codename: 'CellId',
                            column_name: 'cell_id',
                            data_type: 'STRING',
                            parent_component_id: 'template-matrix'
                        },
                        {
                            id: 'template-material-ref',
                            codename: 'MaterialRef',
                            column_name: 'material_ref',
                            data_type: 'REF',
                            parent_component_id: 'template-matrix'
                        }
                    ]
                }
            }
            return []
        })

        const surface = await resolveInterpretationNetworkRuntimeSurface(executor, {
            applicationId: 'app-1',
            schemaName,
            workspaceId
        })

        expect(surface.featureState).toBe('ready')
        expect(surface.structureMode).toBe('singleSystem')
        expect(surface.missing).toEqual([])
        expect(surface.resolvedObjects).toEqual({
            Structure: 'structure-1',
            Interpretation: 'interpretation-1',
            Material: 'material-1',
            TableTemplate: 'table-template-1'
        })
    })

    const makeField = (codename: string, columnName: string, dataType = 'STRING', parentComponentId?: string | null) => ({
        id: `${codename}-id`,
        codename,
        column_name: columnName,
        data_type: dataType,
        parent_component_id: parentComponentId ?? null
    })

    const makeContract = (
        codename: 'Structure' | 'Interpretation' | 'Material' | 'TableTemplate',
        tableName: string,
        fields: Array<ReturnType<typeof makeField>>,
        childFields: Array<ReturnType<typeof makeField>> = []
    ) => ({
        object: { id: `${codename}-object`, codename, table_name: tableName },
        fields: Object.fromEntries(fields.map((field) => [field.codename, field])),
        table: childFields.length > 0 ? makeField(`${codename}Table`, `${codename.toLowerCase()}_rows`, 'TABLE') : undefined,
        childFields: Object.fromEntries(childFields.map((field) => [field.codename, field])),
        childTableName: childFields.length > 0 ? `${tableName}_rows` : undefined
    })

    const makeSurface = (structureMode: 'multiple' | 'singleSystem') =>
        ({
            applicationId: 'app-1',
            schemaName,
            workspaceId,
            layoutId: 'layout-1',
            widgetId: 'widget-1',
            widgetKey: 'interpretationNetworkWorkspace',
            widgetConfig: { structureMode },
            structureMode,
            featureState: 'ready',
            missing: [],
            contracts: {
                Structure: makeContract('Structure', 'structure', [
                    makeField('Name', 'name'),
                    makeField('Description', 'description'),
                    makeField('SystemKey', 'system_key')
                ]),
                Interpretation: makeContract(
                    'Interpretation',
                    'interpretation',
                    [makeField('Title', 'title'), makeField('ParentStructure', 'parent_structure', 'REF')],
                    [
                        makeField('CellId', 'cell_id'),
                        makeField('ParentCellId', 'parent_cell_id'),
                        makeField('RowKey', 'row_key'),
                        makeField('ColKey', 'col_key'),
                        makeField('CellValue', 'cell_value'),
                        makeField('CellDescription', 'cell_description'),
                        makeField('MaterialRef', 'material_ref', 'REF')
                    ]
                ),
                Material: makeContract('Material', 'material', [
                    makeField('Title', 'title'),
                    makeField('Description', 'description'),
                    makeField('Body', 'body', 'JSON'),
                    makeField('CellId', 'cell_id'),
                    makeField('TemplateOwnerId', 'template_owner_id')
                ]),
                TableTemplate: makeContract(
                    'TableTemplate',
                    'table_template',
                    [makeField('Name', 'name'), makeField('Description', 'description'), makeField('MaterialPolicy', 'material_policy')],
                    [
                        makeField('CellId', 'cell_id'),
                        makeField('ParentCellId', 'parent_cell_id'),
                        makeField('RowKey', 'row_key'),
                        makeField('ColKey', 'col_key'),
                        makeField('CellValue', 'cell_value'),
                        makeField('CellDescription', 'cell_description'),
                        makeField('MaterialRef', 'material_ref', 'REF')
                    ]
                )
            },
            resolvedObjects: {
                Structure: 'Structure-object',
                Interpretation: 'Interpretation-object',
                Material: 'Material-object',
                TableTemplate: 'TableTemplate-object'
            }
        } as never)

    const makeCtx = (executor: ReturnType<typeof createMockDbExecutor>['executor']): RuntimeSchemaContext => ({
        schemaName,
        schemaIdent: `"${schemaName}"`,
        manager: executor,
        userId,
        role: 'editor',
        permissions: {
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: true,
            manageApplication: false,
            manageMembers: false
        },
        workflowCapabilities: {},
        currentWorkspaceId: workspaceId,
        workspacesEnabled: true,
        baseApplicationSettings: {},
        applicationSettings: {}
    })

    let lifecycleSpy: jest.SpyInstance

    beforeEach(() => {
        lifecycleSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })

    afterEach(() => {
        lifecycleSpy.mockRestore()
    })

    it('creates a named Structure, Interpretation, and root cell as one aggregate', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let insertId = 0
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO') && sql.includes('"structure"')) {
                expect(params).toEqual(expect.arrayContaining([workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000101', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000103' }]
            }
            return []
        })

        const result = await createStructureAggregate(makeCtx(executor), makeSurface('multiple'), {
            name: { locales: { en: { content: 'Structure' } }, _primary: 'en' },
            description: { locales: { en: { content: 'Description' } }, _primary: 'en' },
            locale: 'en'
        })

        expect(result).toMatchObject({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            created: true
        })
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual([
            'beforeCreate',
            'beforeCreate',
            'afterCreate',
            'afterCreate'
        ])
    })

    it('rolls back the aggregate and does not emit afterCreate hooks when root creation fails', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('INSERT INTO') && sql.includes('"structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000102' }]
            }
            if (sql.includes('INSERT INTO') && sql.includes('"interpretation_rows"')) return []
            return []
        })

        await expect(
            createStructureAggregate(makeCtx(executor), makeSurface('multiple'), {
                name: { locales: { en: { content: 'Structure' } }, _primary: 'en' },
                locale: 'en'
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_CHILD_INSERT_FAILED' })
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual(['beforeCreate', 'beforeCreate'])
    })

    it('creates a single system structure transactionally with a hidden SystemKey and a root cell', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let insertId = 0
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) return []
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                expect(params).toEqual(expect.arrayContaining(['primary', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000101', workspaceId, userId]))
                return [{ id: `019f2000-0000-7000-8000-00000000010${++insertId}` }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                expect(params).toEqual(expect.arrayContaining(['019f2000-0000-7000-8000-000000000102', workspaceId, userId]))
                return [{ id: '019f2000-0000-7000-8000-000000000103' }]
            }
            return []
        })

        const result = await ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), { locale: 'en' })

        expect(result).toMatchObject({
            structureId: '019f2000-0000-7000-8000-000000000101',
            interpretationId: '019f2000-0000-7000-8000-000000000102',
            created: true
        })
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock')
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual([
            'beforeCreate',
            'beforeCreate',
            'afterCreate',
            'afterCreate'
        ])
        expect(lifecycleSpy.mock.calls.map(([call]) => call.attachmentId)).toEqual([
            'Structure-object',
            'Interpretation-object',
            'Structure-object',
            'Interpretation-object'
        ])
        expect(lifecycleSpy.mock.calls[3]?.[0].payload.metadata).toMatchObject({
            aggregateCommand: 'ensureSingleSystemStructure',
            childRowCount: 1
        })
    })

    it('fails closed when ordinary structures exist before single-system ensure', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"') && sql.includes('"system_key" = $1')) {
                return []
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000120', system_key: null }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
        })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')
            )
        ).toBe(false)
    })

    it('fails closed when a primary system structure coexists with ordinary structures', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"') && sql.includes('"system_key" = $1')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101', system_key: 'primary' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [
                    { id: '019f2000-0000-7000-8000-000000000101', system_key: 'primary' },
                    { id: '019f2000-0000-7000-8000-000000000121', system_key: null }
                ]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
        })
    })

    it('fails closed when multiple system structures already exist', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }, { id: '019f2000-0000-7000-8000-000000000102' }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_DUPLICATE_SYSTEM_STRUCTURE'
        })
    })

    it('fails closed when the existing system structure has duplicate matrices', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000201' }, { id: '019f2000-0000-7000-8000-000000000202' }]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE'
        })
    })

    it('fails closed when the existing system matrix has duplicate root cells', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000101' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000201' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    { id: 'row-1', cell_id: 'root-a', parent_cell_id: null },
                    { id: 'row-2', cell_id: 'root-b', parent_cell_id: null }
                ]
            }
            return []
        })

        await expect(ensureSingleSystemStructure(makeCtx(executor), makeSurface('singleSystem'), {})).rejects.toMatchObject({
            code: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE'
        })
    })

    it('copies materials with remapped cell ids when saving a structure as a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000201'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000202'
        const sourceMaterialId = '019f2000-0000-7000-8000-000000000203'
        let insertCount = 0
        let clonedMaterialCellId: unknown = null
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 2 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-1',
                        cell_id: 'cell-root',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: sourceMaterialId
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: sourceMaterialId, title: 'Material', description: 'D', body: { blocks: [] }, cell_id: 'cell-root' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                clonedMaterialCellId = params?.[3]
                return [{ id: '019f2000-0000-7000-8000-000000000301' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000302' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                insertCount += 1
                expect(params).toContain('019f2000-0000-7000-8000-000000000301')
                expect(params).not.toContain('cell-root')
                return [{ id: '019f2000-0000-7000-8000-000000000401' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('singleSystem'), {
            sourceStructureId,
            templateName: 'Reusable',
            includeMaterials: true,
            expectedVersion: 2
        })

        expect(insertCount).toBe(1)
        expect(clonedMaterialCellId).not.toBe('cell-root')
    })

    it('copies materials linked only by Material.CellId when saving a structure as a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000211'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000212'
        const sourceMaterialId = '019f2000-0000-7000-8000-000000000213'
        let materialLookupParams: unknown[] | undefined
        let materialInsertParams: unknown[] | undefined
        let templateRowParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-cell-only-material',
                        cell_id: 'cell-with-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: null
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialLookupParams = params
                return [
                    {
                        id: sourceMaterialId,
                        title: 'Cell-only material',
                        description: 'Linked by Material.CellId',
                        body: { blocks: [] },
                        cell_id: 'cell-with-material'
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000313' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000312' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000411' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
            sourceStructureId,
            templateName: 'Reusable from CellId',
            includeMaterials: true
        })

        expect(materialLookupParams).toContainEqual(['cell-with-material'])
        expect(materialInsertParams).not.toContain('cell-with-material')
        expect(templateRowParams).toContain('019f2000-0000-7000-8000-000000000313')
    })

    it('fails closed when a matrix MaterialRef points to a missing material', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000221'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000222'
        const missingMaterialId = '019f2000-0000-7000-8000-000000000223'

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-missing-material',
                        cell_id: 'cell-missing-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: missingMaterialId
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) return []
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000322' }]
            }
            return []
        })

        await expect(
            saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
                sourceStructureId,
                templateName: 'Broken material',
                includeMaterials: true
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')
            )
        ).toBe(false)
    })

    it('fails closed when a matrix MaterialRef is not a valid UUID', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000231'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000232'

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-invalid-material',
                        cell_id: 'cell-invalid-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: 'not-a-material-id'
                    }
                ]
            }
            return []
        })

        await expect(
            saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
                sourceStructureId,
                templateName: 'Invalid material',
                includeMaterials: true
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')
            )
        ).toBe(false)
    })

    it('fails closed when multiple materials match the same CellId', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000241'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000242'

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-duplicate-cell-material',
                        cell_id: 'cell-duplicate-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: null
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    { id: '019f2000-0000-7000-8000-000000000243', title: 'A', cell_id: 'cell-duplicate-material' },
                    { id: '019f2000-0000-7000-8000-000000000244', title: 'B', cell_id: 'cell-duplicate-material' }
                ]
            }
            return []
        })

        await expect(
            saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
                sourceStructureId,
                templateName: 'Duplicate material',
                includeMaterials: true
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
    })

    it('copies materials linked only by Material.CellId when instantiating a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const templateId = '019f2000-0000-7000-8000-000000000251'
        const templateMaterialId = '019f2000-0000-7000-8000-000000000252'
        let materialLookupParams: unknown[] | undefined
        let materialInsertParams: unknown[] | undefined
        let matrixRowParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: templateId, name: 'Template', material_policy: 'withMaterials', _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                return [
                    {
                        id: 'template-row-cell-material',
                        cell_id: 'template-cell-with-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: null
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000351' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialLookupParams = params
                return [
                    {
                        id: templateMaterialId,
                        title: 'Template material',
                        description: 'Linked by CellId',
                        body: { blocks: [] },
                        cell_id: 'template-cell-with-material',
                        template_owner_id: templateId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000352' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000353' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000354' }]
            }
            return []
        })

        await instantiateStructureFromTemplate(makeCtx(executor), makeSurface('multiple'), {
            templateId,
            structureName: 'From template'
        })

        expect(materialLookupParams).toContainEqual(['template-cell-with-material'])
        expect(materialInsertParams).not.toContain('template-cell-with-material')
        expect(matrixRowParams).toContain('019f2000-0000-7000-8000-000000000352')
    })

    it('does not copy unknown matching child fields into template rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000261'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000262'
        let templateRowSql = ''
        let templateRowParams: unknown[] | undefined

        const surfaceWithInternalField = makeSurface('multiple') as ReturnType<typeof makeSurface> & {
            contracts: {
                Interpretation: { childFields: Record<string, ReturnType<typeof makeField>> }
                TableTemplate: { childFields: Record<string, ReturnType<typeof makeField>> }
            }
        }
        surfaceWithInternalField.contracts.Interpretation.childFields.InternalRef = makeField('InternalRef', 'internal_ref', 'REF')
        surfaceWithInternalField.contracts.TableTemplate.childFields.InternalRef = makeField('InternalRef', 'internal_ref', 'REF')

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-with-internal-ref',
                        cell_id: 'cell-with-internal-ref',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        internal_ref: '019f2000-0000-7000-8000-000000000999'
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000362' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowSql = sql
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000363' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), surfaceWithInternalField, {
            sourceStructureId,
            templateName: 'Allowlisted fields',
            includeMaterials: false
        })

        expect(templateRowSql).not.toContain('"internal_ref"')
        expect(templateRowParams).not.toContain('019f2000-0000-7000-8000-000000000999')
    })

    it('creates a material with server-owned CellId and links it to the selected matrix cell transactionally', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let materialInsertParams: unknown[] | undefined
        let matrixUpdateParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000701', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000702', _upl_version: 7, cell_id: 'cell-selected', material_ref: null }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000703' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixUpdateParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000702' }]
            }
            return []
        })

        const result = await createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
            interpretationId: '019f2000-0000-7000-8000-000000000701',
            matrixRowId: '019f2000-0000-7000-8000-000000000702',
            cellId: 'cell-selected',
            data: {
                title: 'Material title',
                description: 'Material description',
                cell_id: 'client-forged-cell'
            },
            expectedVersion: 7
        })

        expect(result.id).toBe('019f2000-0000-7000-8000-000000000703')
        expect(materialInsertParams).toContain('cell-selected')
        expect(materialInsertParams).not.toContain('client-forged-cell')
        expect(matrixUpdateParams).toEqual(
            expect.arrayContaining([
                '019f2000-0000-7000-8000-000000000703',
                userId,
                '019f2000-0000-7000-8000-000000000702',
                '019f2000-0000-7000-8000-000000000701',
                'cell-selected',
                workspaceId,
                7
            ])
        )
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual(['beforeCreate', 'afterCreate'])
        expect(lifecycleSpy.mock.calls.every(([call]) => call.attachmentId === 'Material-object')).toBe(true)
        expect(lifecycleSpy.mock.calls[1]?.[0].payload.metadata).toMatchObject({
            aggregateCommand: 'createMaterialForCell',
            matrixRowId: '019f2000-0000-7000-8000-000000000702',
            cellId: 'cell-selected'
        })
    })

    it('fails closed when aggregate material creation receives a server-owned field by codename', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const surface = makeSurface('multiple')
        surface.contracts.Material.fields.CellId.ui_config = { serverOwned: true }

        await expect(
            createMaterialForCell(makeCtx(executor), surface, {
                interpretationId: '019f2000-0000-7000-8000-000000000711',
                matrixRowId: '019f2000-0000-7000-8000-000000000712',
                cellId: 'cell-selected',
                data: { CellId: 'client-forged-cell' }
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL' })
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('fails closed without creating material when the matrix cell version changed', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000721', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000722', _upl_version: 8, cell_id: 'cell-selected', material_ref: null }]
            }
            return []
        })

        await expect(
            createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
                interpretationId: '019f2000-0000-7000-8000-000000000721',
                matrixRowId: '019f2000-0000-7000-8000-000000000722',
                cellId: 'cell-selected',
                data: { title: 'Material title' },
                expectedVersion: 7
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')
            )
        ).toBe(false)
    })

    it('rejects template instantiation in single-system mode', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            instantiateStructureFromTemplate(makeCtx(executor), makeSurface('singleSystem'), {
                templateId: '019f2000-0000-7000-8000-000000000999',
                structureName: 'New'
            })
        ).rejects.toBeInstanceOf(InterpretationNetworkCommandError)
    })

    it.each([
        {
            label: 'duplicate CellId',
            rows: [
                { cell_id: 'duplicate', parent_cell_id: null },
                { cell_id: 'duplicate', parent_cell_id: null }
            ]
        },
        {
            label: 'dangling parent',
            rows: [{ cell_id: 'child', parent_cell_id: 'missing-parent' }]
        },
        {
            label: 'hierarchy cycle',
            rows: [
                { cell_id: 'a', parent_cell_id: 'b' },
                { cell_id: 'b', parent_cell_id: 'a' }
            ]
        }
    ])('rejects a source matrix with $label before copying', ({ rows }) => {
        const surface = makeSurface('multiple') as never
        expect(() =>
            planMatrixRowsCopy(
                rows,
                (surface as ReturnType<typeof makeSurface>).contracts.Interpretation,
                (surface as ReturnType<typeof makeSurface>).contracts.TableTemplate,
                new Map(),
                false
            )
        ).toThrow(expect.objectContaining({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' }))
    })

    it('remaps matrix MaterialRef by source material row id when the source row has both MaterialRef and CellId ownership', () => {
        const surface = makeSurface('multiple')
        const materialIdMap = new Map([
            ['019f2000-0000-7000-8000-000000000a01', '019f2000-0000-7000-8000-000000000b01'],
            ['source-cell-1', '019f2000-0000-7000-8000-000000000b02']
        ])

        const plan = planMatrixRowsCopy(
            [
                {
                    id: 'row-1',
                    cell_id: 'source-cell-1',
                    parent_cell_id: null,
                    row_key: 'source-row',
                    col_key: 'source-col',
                    cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                    material_ref: '019f2000-0000-7000-8000-000000000a01'
                }
            ],
            surface.contracts.Interpretation,
            surface.contracts.TableTemplate,
            materialIdMap,
            true
        )

        expect(plan.rows[0].material_ref).toBe('019f2000-0000-7000-8000-000000000b01')
        expect(plan.rows[0].material_ref).not.toBe('019f2000-0000-7000-8000-000000000b02')
        expect(plan.rows[0].cell_id).toMatch(/^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('rechecks template mutation permissions inside the service boundary', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const ctx = makeCtx(executor)
        ctx.permissions.createContent = false

        await expect(
            saveStructureAsTemplate(ctx, makeSurface('multiple'), {
                sourceStructureId: '019f2000-0000-7000-8000-000000000901',
                templateName: 'Denied',
                includeMaterials: false
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'INTERPRETATION_NETWORK_PERMISSION_DENIED' })
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects browser-supplied physical metadata identifiers in material commands', () => {
        const result = interpretationNetworkMaterialCreateRequestSchema.safeParse({
            interpretationId: '019f2000-0000-7000-8000-000000000701',
            matrixRowId: '019f2000-0000-7000-8000-000000000702',
            cellId: 'cell-selected',
            data: { title: 'Material' },
            materialObjectCollectionId: '019f2000-0000-7000-8000-000000000703'
        })
        expect(result.success).toBe(false)
    })

    it('deletes template rows and only provenance-owned materials in one transaction', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const templateId = '019f2000-0000-7000-8000-000000000911'
        const materialId = '019f2000-0000-7000-8000-000000000912'
        const updateSql: string[] = []
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                return [{ id: 'row-1', cell_id: 'template-cell', parent_cell_id: null, material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: templateId, material_policy: 'withMaterials', _upl_version: 2 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, cell_id: 'template-cell', template_owner_id: templateId }]
            }
            if (sql.includes('UPDATE ')) {
                updateSql.push(sql)
                if (sql.includes('"table_template_rows"')) return [{ id: 'row-1' }]
                if (sql.includes('"material"')) return [{ id: materialId }]
                return [{ id: templateId }]
            }
            return []
        })

        await deleteInterpretationNetworkTemplate(makeCtx(executor), makeSurface('multiple'), { templateId, expectedVersion: 2 })

        expect(updateSql.some((sql) => sql.includes('"table_template_rows"') && sql.includes('_tp_parent_id = ANY'))).toBe(true)
        expect(updateSql.some((sql) => sql.includes('"material"') && sql.includes('"template_owner_id" = $2'))).toBe(true)
        expect(updateSql.some((sql) => sql.includes('"table_template"') && sql.includes('WHERE id = $2'))).toBe(true)
    })

    it('deletes Structure, Matrix children, attached Materials, and Interpretation transactionally', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const structureId = '019f2000-0000-7000-8000-000000000921'
        const interpretationId = '019f2000-0000-7000-8000-000000000922'
        const materialId = '019f2000-0000-7000-8000-000000000923'
        const updateSql: string[] = []
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: structureId, system_key: null, _upl_version: 4 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: 'row-1', cell_id: 'cell-1', parent_cell_id: null, material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, cell_id: 'cell-1' }]
            }
            if (sql.includes('UPDATE ')) {
                updateSql.push(sql)
                return [{ id: 'updated' }]
            }
            return []
        })

        await deleteStructureAggregate(makeCtx(executor), makeSurface('multiple'), structureId, { expectedVersion: 4 })

        expect(updateSql.map((sql) => sql.match(/"(interpretation_rows|material|interpretation|structure)"/)?.[1])).toEqual([
            'interpretation_rows',
            'material',
            'interpretation',
            'structure'
        ])
    })

    it('deletes the union of Materials referenced by row id or owned only by Matrix CellId exactly once', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const structureId = '019f2000-0000-7000-8000-000000000931'
        const interpretationId = '019f2000-0000-7000-8000-000000000932'
        const referencedMaterialId = '019f2000-0000-7000-8000-000000000933'
        const cellOnlyMaterialId = '019f2000-0000-7000-8000-000000000934'
        const deletedMaterialIds: string[] = []
        txExecutor.query.mockImplementation(async (sql: string, values?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: structureId, system_key: null, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    { id: 'row-1', cell_id: 'cell-1', parent_cell_id: null, material_ref: referencedMaterialId },
                    { id: 'row-2', cell_id: 'cell-2', parent_cell_id: 'cell-1', material_ref: null }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    { id: referencedMaterialId, cell_id: 'cell-1' },
                    { id: cellOnlyMaterialId, cell_id: 'cell-2' }
                ]
            }
            if (sql.includes('UPDATE ') && sql.includes('"material"')) {
                deletedMaterialIds.push(String(values?.[1] ?? ''))
                return [{ id: String(values?.[1] ?? '') }]
            }
            if (sql.includes('UPDATE ')) return [{ id: 'updated' }]
            return []
        })

        await deleteStructureAggregate(makeCtx(executor), makeSurface('multiple'), structureId, { expectedVersion: 1 })

        expect(deletedMaterialIds).toEqual([referencedMaterialId, cellOnlyMaterialId])
    })
})
