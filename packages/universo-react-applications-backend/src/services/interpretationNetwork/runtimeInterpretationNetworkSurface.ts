import { qSchemaTable } from '@universo-react/database'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { parseInterpretationNetworkStructureMode } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { IDENTIFIER_REGEX, runtimeCodenameTextSql } from '../../shared/runtimeHelpers'
import {
    INTERPRETATION_NETWORK_WIDGET_KEY,
    getChildField,
    getField,
    isRecord,
    type ComponentRow,
    type InterpretationNetworkRuntimeSurface,
    type ObjectRow,
    type RuntimeSurfaceReady,
    type WidgetRow
} from './runtimeInterpretationNetworkCore'

export const resolveInterpretationNetworkRuntimeSurface = async (
    executor: DbExecutor,
    params: {
        applicationId: string
        schemaName: string
        workspaceId: string | null
        layoutId?: string | null
        widgetId?: string | null
    }
): Promise<InterpretationNetworkRuntimeSurface> => {
    const widgetRows = await executor.query<WidgetRow>(
        `
        SELECT widget.id, widget.layout_id, widget.widget_key, widget.config,
               CASE WHEN layout.scope_entity_id = $2 THEN 0 ELSE 1 END AS scope_rank
        FROM ${qSchemaTable(params.schemaName, '_app_widgets')} widget
        INNER JOIN ${qSchemaTable(params.schemaName, '_app_layouts')} layout
            ON layout.id = widget.layout_id
        WHERE widget._upl_deleted = false
          AND widget._app_deleted = false
          AND widget.is_active = true
          AND widget.widget_key = $1
          AND layout._upl_deleted = false
          AND layout._app_deleted = false
          AND layout.is_active = true
          AND (
              $2::uuid IS NULL
              OR layout.scope_entity_id IS NULL
              OR layout.scope_entity_id = $2
          )
          AND ($3::uuid IS NULL OR widget.layout_id = $3)
          AND ($4::uuid IS NULL OR widget.id = $4)
        ORDER BY scope_rank ASC, layout.is_default DESC, layout.sort_order ASC, widget.sort_order ASC, widget.id ASC
        LIMIT 2
        `,
        [INTERPRETATION_NETWORK_WIDGET_KEY, params.workspaceId ?? null, params.layoutId ?? null, params.widgetId ?? null]
    )
    // Without an explicit runtime widget identity, more than one active widget
    // is ambiguous. Failing closed prevents settings or aggregate commands from
    // silently using an unrelated scoped layout.
    const effectiveScopeRank = widgetRows[0]?.scope_rank
    const effectiveWidgetRows = widgetRows.filter((row) => row.scope_rank === effectiveScopeRank)
    const widget = effectiveWidgetRows.length === 1 ? effectiveWidgetRows[0] : null
    const widgetConfig = isRecord(widget?.config) ? widget.config : {}
    const structureMode = parseInterpretationNetworkStructureMode(widgetConfig.structureMode)

    if (!widget) {
        return {
            applicationId: params.applicationId,
            schemaName: params.schemaName,
            workspaceId: params.workspaceId,
            layoutId: null,
            widgetId: null,
            widgetKey: INTERPRETATION_NETWORK_WIDGET_KEY,
            widgetConfig,
            structureMode,
            featureState: effectiveWidgetRows.length > 1 ? 'ambiguous-widget' : 'missing-widget',
            missing:
                effectiveWidgetRows.length > 1 ? [`${INTERPRETATION_NETWORK_WIDGET_KEY}:ambiguous`] : [INTERPRETATION_NETWORK_WIDGET_KEY],
            resolvedObjects: {}
        }
    }

    const objectRows = await executor.query<ObjectRow>(
        `
        SELECT id, ${runtimeCodenameTextSql('codename')} AS codename, table_name, config
        FROM ${qSchemaTable(params.schemaName, '_app_objects')}
        WHERE _upl_deleted = false
          AND _app_deleted = false
        `
    )
    const objectsByCodename = new Map(objectRows.map((row) => [row.codename, row]))
    const configuredCodenames = {
        Structure: typeof widgetConfig.conceptCodename === 'string' ? widgetConfig.conceptCodename : 'Structure',
        Interpretation: typeof widgetConfig.interpretationCodename === 'string' ? widgetConfig.interpretationCodename : 'Interpretation',
        Material: typeof widgetConfig.materialCodename === 'string' ? widgetConfig.materialCodename : 'Material',
        TableTemplate: typeof widgetConfig.tableTemplateCodename === 'string' ? widgetConfig.tableTemplateCodename : 'TableTemplate'
    }

    const missing: string[] = []
    const contracts: Partial<RuntimeSurfaceReady['contracts']> = {}
    const resolvedObjects: Record<string, string> = {}

    for (const [key, codename] of Object.entries(configuredCodenames) as Array<[keyof RuntimeSurfaceReady['contracts'], string]>) {
        const object = objectsByCodename.get(codename)
        if (!object?.table_name || !IDENTIFIER_REGEX.test(object.table_name)) {
            missing.push(key)
            continue
        }
        const fields = await executor.query<ComponentRow>(
            `
            SELECT id, ${runtimeCodenameTextSql('codename')} AS codename, column_name, data_type, parent_component_id,
                   is_required, validation_rules, ui_config
            FROM ${qSchemaTable(params.schemaName, '_app_components')}
            WHERE object_id = $1
              AND _upl_deleted = false
              AND _app_deleted = false
            ORDER BY sort_order ASC, id ASC
            `,
            [object.id]
        )
        const topLevel = fields.filter((field) => !field.parent_component_id)
        const table = topLevel.find((field) => field.data_type === 'TABLE')
        const childFields = table ? fields.filter((field) => field.parent_component_id === table.id) : []
        contracts[key] = {
            object,
            fields: Object.fromEntries(topLevel.map((field) => [field.codename, field])),
            table,
            childFields: Object.fromEntries(childFields.map((field) => [field.codename, field])),
            childTableName:
                table && typeof table.column_name === 'string' && IDENTIFIER_REGEX.test(table.column_name)
                    ? table.column_name
                    : table
                    ? generateChildTableName(table.id)
                    : undefined
        }
        resolvedObjects[key] = object.id
    }

    const requiredFields: Array<[string, ComponentRow | undefined]> = [
        ['Structure.Name', contracts.Structure && getField(contracts.Structure, 'Name')],
        ['Structure.SystemKey', contracts.Structure && getField(contracts.Structure, 'SystemKey')],
        ['Interpretation.Title', contracts.Interpretation && getField(contracts.Interpretation, 'Title')],
        ['Interpretation.ParentStructure', contracts.Interpretation && getField(contracts.Interpretation, 'ParentStructure')],
        ['Interpretation.InterpretationMatrix', contracts.Interpretation?.table],
        ['Interpretation.InterpretationMatrix.CellId', contracts.Interpretation && getChildField(contracts.Interpretation, 'CellId')],
        [
            'Interpretation.InterpretationMatrix.MaterialRef',
            contracts.Interpretation && getChildField(contracts.Interpretation, 'MaterialRef')
        ],
        ['Material.CellId', contracts.Material && getField(contracts.Material, 'CellId')],
        ['Material.TemplateOwnerId', contracts.Material && getField(contracts.Material, 'TemplateOwnerId')],
        ['TableTemplate.Name', contracts.TableTemplate && getField(contracts.TableTemplate, 'Name')],
        ['TableTemplate.MaterialPolicy', contracts.TableTemplate && getField(contracts.TableTemplate, 'MaterialPolicy')],
        ['TableTemplate.TemplateMatrix', contracts.TableTemplate?.table],
        ['TableTemplate.TemplateMatrix.CellId', contracts.TableTemplate && getChildField(contracts.TableTemplate, 'CellId')],
        ['TableTemplate.TemplateMatrix.MaterialRef', contracts.TableTemplate && getChildField(contracts.TableTemplate, 'MaterialRef')]
    ]
    for (const [label, field] of requiredFields) {
        if (!field) missing.push(label)
    }

    if (missing.length > 0 || !contracts.Structure || !contracts.Interpretation || !contracts.Material || !contracts.TableTemplate) {
        return {
            applicationId: params.applicationId,
            schemaName: params.schemaName,
            workspaceId: params.workspaceId,
            layoutId: widget.layout_id,
            widgetId: widget.id,
            widgetKey: INTERPRETATION_NETWORK_WIDGET_KEY,
            widgetConfig,
            structureMode,
            featureState: 'missing-metadata',
            missing,
            resolvedObjects
        }
    }

    return {
        applicationId: params.applicationId,
        schemaName: params.schemaName,
        workspaceId: params.workspaceId,
        layoutId: widget.layout_id,
        widgetId: widget.id,
        widgetKey: INTERPRETATION_NETWORK_WIDGET_KEY,
        widgetConfig,
        structureMode,
        featureState: 'ready',
        missing: [],
        contracts: contracts as RuntimeSurfaceReady['contracts'],
        resolvedObjects: resolvedObjects as RuntimeSurfaceReady['resolvedObjects']
    }
}
