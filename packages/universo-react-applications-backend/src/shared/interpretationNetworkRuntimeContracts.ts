import type { InterpretationNetworkStructureMode } from '@universo-react/types'
import type { RuntimeDataType } from './runtimeHelpers'

export const INTERPRETATION_NETWORK_WIDGET_KEY = 'interpretationNetworkWorkspace'

export type WidgetRow = {
    id: string
    layout_id: string
    widget_key: string
    config: Record<string, unknown> | null
    scope_rank?: number
}

export type ObjectRow = {
    id: string
    codename: string
    table_name: string
    config?: Record<string, unknown> | null
}

export type ComponentRow = {
    id: string
    codename: string
    column_name: string
    data_type: RuntimeDataType
    parent_component_id?: string | null
    validation_rules?: Record<string, unknown> | null
    ui_config?: Record<string, unknown> | null
    is_required?: boolean | null
}

export type ObjectContract = {
    object: ObjectRow
    fields: Record<string, ComponentRow>
    table?: ComponentRow
    childFields: Record<string, ComponentRow>
    childTableName?: string
}

export type RuntimeSurfaceReady = {
    applicationId: string
    schemaName: string
    workspaceId: string | null
    layoutId: string
    widgetId: string
    widgetKey: typeof INTERPRETATION_NETWORK_WIDGET_KEY
    widgetConfig: Record<string, unknown>
    structureMode: InterpretationNetworkStructureMode
    featureState: 'ready'
    missing: []
    contracts: {
        Structure: ObjectContract
        Interpretation: ObjectContract
        Material: ObjectContract
        TableTemplate: ObjectContract
    }
    resolvedObjects: {
        Structure: string
        Interpretation: string
        Material: string
        TableTemplate: string
    }
}

export type InterpretationNetworkRuntimeSurface =
    | RuntimeSurfaceReady
    | {
          applicationId: string
          schemaName: string
          workspaceId: string | null
          layoutId: string | null
          widgetId: string | null
          widgetKey: typeof INTERPRETATION_NETWORK_WIDGET_KEY
          widgetConfig: Record<string, unknown>
          structureMode: InterpretationNetworkStructureMode
          featureState: 'missing-widget' | 'missing-metadata' | 'ambiguous-widget'
          missing: string[]
          resolvedObjects: Record<string, string>
      }
