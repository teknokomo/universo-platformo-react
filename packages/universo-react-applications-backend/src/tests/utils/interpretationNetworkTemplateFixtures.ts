import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from './dbMocks'
export const schemaName = 'app_018f8a787b8f7c1da111222233334440'
export const workspaceId = '019f2000-0000-7000-8000-000000000010'
const userId = '019f2000-0000-7000-8000-000000000011'
type RuntimeDataTypeFixture = 'BOOLEAN' | 'STRING' | 'NUMBER' | 'DATE' | 'REF' | 'JSON' | 'TABLE'

const makeField = (
    codename: string,
    columnName: string,
    dataType: RuntimeDataTypeFixture = 'STRING',
    parentComponentId?: string | null
) => ({
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
    childFields: Array<ReturnType<typeof makeField>> = [],
    config?: Record<string, unknown>
) => ({
    object: { id: `${codename}-object`, codename, table_name: tableName, ...(config ? { config } : {}) },
    fields: Object.fromEntries(fields.map((field) => [field.codename, field])),
    table: childFields.length > 0 ? makeField(`${codename}Table`, `${codename.toLowerCase()}_rows`, 'TABLE') : undefined,
    childFields: Object.fromEntries(childFields.map((field) => [field.codename, field])),
    childTableName: childFields.length > 0 ? `${tableName}_rows` : undefined
})

export const makeSurface = (structureMode: 'multiple' | 'singleSystem') => ({
    applicationId: 'app-1',
    schemaName,
    workspaceId,
    layoutId: 'layout-1',
    widgetId: 'widget-1',
    widgetKey: 'interpretationNetworkWorkspace' as const,
    widgetConfig: { structureMode },
    structureMode,
    featureState: 'ready' as const,
    missing: [] as [],
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
        Material: makeContract(
            'Material',
            'material',
            [
                makeField('Title', 'title'),
                makeField('Description', 'description'),
                makeField('Body', 'body', 'JSON'),
                makeField('CellId', 'cell_id'),
                makeField('InterpretationId', 'interpretation_id', 'REF'),
                makeField('TemplateOwnerId', 'template_owner_id')
            ],
            [],
            {
                recordPolicy: {
                    version: 1,
                    runtimeMutation: 'deny',
                    workspaceCopy: 'exclude',
                    denyDeleteWhenBound: false,
                    immutableSemanticKeyWhenBound: false
                }
            }
        ),
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
})

export const makeCtx = (executor: ReturnType<typeof createMockDbExecutor>['executor']): RuntimeSchemaContext => ({
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
