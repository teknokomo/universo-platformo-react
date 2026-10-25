import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { RuntimeSurfaceReady } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { createMockDbExecutor } from '../utils/dbMocks'

export const schemaName = 'app_018f8a787b8f7c1da111222233334440'
export const workspaceId = '019f2000-0000-7000-8000-000000000010'
export const userId = '019f2000-0000-7000-8000-000000000011'
export const interpretationId = '019f2000-0000-7000-8000-000000000012'
export const matrixRowId = '019f2000-0000-7000-8000-000000000013'
export const cellId = '019f2000-0000-7000-8000-000000000021'

export const field = (codename: string, columnName: string, uiConfig: Record<string, unknown> = {}) => ({
    id: `${codename}-id`,
    codename,
    column_name: columnName,
    data_type: 'STRING' as const,
    parent_component_id: 'matrix-id',
    validation_rules: undefined,
    ui_config: uiConfig
})

export const localizedField = (codename: string, columnName: string) => ({
    ...field(codename, columnName, { widget: 'textarea' }),
    validation_rules: { localized: true, versioned: true }
})

export const plainStringField = (codename: string, columnName: string) => field(codename, columnName, { widget: 'textfield' })

export const interpretationContract = {
    object: { id: 'interpretation-object', codename: 'Interpretation', table_name: 'interpretation' },
    fields: {},
    table: {
        ...field('InterpretationMatrix', 'interpretation_matrix'),
        data_type: 'TABLE' as const,
        validation_rules: { maxRows: 5000 }
    },
    childFields: Object.fromEntries(
        [
            field('CellId', 'cell_id', { serverOwned: true }),
            field('ParentCellId', 'parent_cell_id', { serverOwned: true }),
            field('RowKey', 'row_key', { serverOwned: true }),
            field('ColKey', 'col_key', { serverOwned: true }),
            localizedField('RowLabel', 'row_label'),
            localizedField('ColLabel', 'col_label'),
            localizedField('CellValue', 'cell_value'),
            plainStringField('PlainNote', 'plain_note'),
            plainStringField('CellFillColor', 'cell_fill_color'),
            plainStringField('TextColor', 'text_color'),
            plainStringField('BorderTopColor', 'border_top_color'),
            plainStringField('BorderTopWidth', 'border_top_width'),
            plainStringField('BorderTopStyle', 'border_top_style')
        ].map((item) => [item.codename, item])
    ),
    childTableName: 'interpretation_matrix_rows'
}

export const emptyContract = (codename: string) => ({
    object: { id: `${codename}-object`, codename, table_name: codename.toLowerCase() },
    fields: {},
    childFields: {}
})

export const surface = {
    applicationId: 'application-id',
    schemaName,
    workspaceId,
    layoutId: 'layout-id',
    widgetId: 'widget-id',
    widgetKey: 'interpretationNetworkWorkspace',
    widgetConfig: { structureMode: 'multiple' },
    structureMode: 'multiple',
    featureState: 'ready',
    missing: [],
    contracts: {
        Structure: emptyContract('Structure'),
        Interpretation: interpretationContract,
        Material: emptyContract('Material'),
        TableTemplate: emptyContract('TableTemplate')
    },
    resolvedObjects: {
        Structure: 'Structure-object',
        Interpretation: 'interpretation-object',
        Material: 'Material-object',
        TableTemplate: 'TableTemplate-object'
    }
} as unknown as RuntimeSurfaceReady

export const deniedInterpretationSurface = (): RuntimeSurfaceReady =>
    ({
        ...surface,
        contracts: {
            ...surface.contracts,
            Interpretation: {
                ...interpretationContract,
                object: {
                    ...interpretationContract.object,
                    config: {
                        recordPolicy: {
                            version: 1,
                            denyDeleteWhenBound: false,
                            immutableSemanticKeyWhenBound: false,
                            runtimeMutation: 'deny'
                        }
                    }
                }
            }
        }
    } as unknown as RuntimeSurfaceReady)

export const cellStyleSurface = (cellStylePolicy: Record<string, unknown>): RuntimeSurfaceReady =>
    ({
        ...surface,
        widgetConfig: { ...surface.widgetConfig, cellStylePolicy }
    } as unknown as RuntimeSurfaceReady)

export const makeContext = (permissions = { createContent: true, editContent: true, deleteContent: true }) => {
    const { executor, txExecutor } = createMockDbExecutor()
    return {
        executor,
        txExecutor,
        ctx: {
            schemaName,
            schemaIdent: `"${schemaName}"`,
            manager: executor,
            userId,
            permissions,
            currentWorkspaceId: workspaceId,
            workspacesEnabled: true
        } as unknown as RuntimeSchemaContext
    }
}
