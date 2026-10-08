import {
    canAddApplicationLayoutWidget,
    getLayoutWidgetDefinition,
    type ApplicationTemplateKey,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'
import { isApplicationLayoutSyncRecord } from './applicationLayoutSyncGuards'
import {
    classifyPlacementLineage,
    decodePlacementWidgetConfigEnvelope,
    resolvePlacementBindingPolicy,
    resolvePlacementBindingValidation
} from './applicationLayoutWidgetPlacement'

type JsonRecord = Record<string, unknown>

interface EntityBackedWidgetCopyInput {
    widgetKey: string
    zone: string
    instanceKey: string
    config: unknown
    sourceBindings?: WidgetEntityBindingEnvelope
}

interface PersistedEntityBackedWidgetInput {
    id: string
    instance_key: string
    zone: string
    widget_key: string
    config: unknown
    source_config: unknown
    source_widget_id: string | null
    source_base_widget_id: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
}

const requireRecord = (value: unknown, context: string): JsonRecord => {
    if (!isApplicationLayoutSyncRecord(value)) throw new Error(`[SchemaSync] ${context} must be an object`)
    return value
}

const hasRequiredEntityBackedBindings = (widgetKey: string, rendererConfig: unknown): boolean =>
    resolvePlacementBindingPolicy(widgetKey, rendererConfig).sourceMode === 'required'

const decodeWidgetCopyRendererConfig = (templateKey: ApplicationTemplateKey, widget: EntityBackedWidgetCopyInput) => {
    const decoded = decodePlacementWidgetConfigEnvelope(widget.config, {
        templateKey,
        widgetKey: widget.widgetKey,
        zone: widget.zone,
        instanceKey: widget.instanceKey,
        requireBindings: false
    })
    const validation = resolvePlacementBindingValidation(widget.widgetKey, decoded.rendererConfig, false)
    const authoritativeBindings = widget.sourceBindings ?? decoded.neutral.bindings
    if (validation.rejectBindings && authoritativeBindings !== undefined) {
        throw new Error('[SchemaSync] Widget bindings violate the registered source policy')
    }
    return decoded.rendererConfig
}

/** Classify source widgets whose required Entity bindings cannot transfer to application-owned content. */
export const containsEntityBackedWidgetCopyConflict = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly EntityBackedWidgetCopyInput[]
): boolean =>
    widgets.some((widget) => {
        const rendererConfig = decodeWidgetCopyRendererConfig(templateKey, widget)
        return hasRequiredEntityBackedBindings(widget.widgetKey, rendererConfig)
    })

/** Reject layouts that would copy any widget the application cannot own under its structural-only policy. */
export const containsApplicationOwnedWidgetCopyConflict = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly EntityBackedWidgetCopyInput[]
): boolean =>
    widgets.some((widget) => {
        const rendererConfig = decodeWidgetCopyRendererConfig(templateKey, widget)
        const definition = getLayoutWidgetDefinition(widget.widgetKey, rendererConfig)
        return !canAddApplicationLayoutWidget(definition, 'application')
    })

/** Classify persisted, active widgets that retain required Entity bindings when their source layout is removed. */
export const containsPersistedRequiredEntityBackedWidget = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly PersistedEntityBackedWidgetInput[]
): boolean =>
    widgets.some((widget) => {
        if (widget._upl_deleted || widget._app_deleted) return false
        const lineage = classifyPlacementLineage(widget.source_widget_id, widget.source_base_widget_id)
        const bindingsInheritedFromBase = widget.source_base_widget_id !== null && widget.source_base_widget_id !== undefined
        const widgetConfig = requireRecord(widget.source_config ?? widget.config, `Persisted widget ${widget.id} source config`)
        const validation = resolvePlacementBindingValidation(
            widget.widget_key,
            widgetConfig,
            lineage.kind === 'source-linked',
            bindingsInheritedFromBase
        )
        const decoded = decodePlacementWidgetConfigEnvelope(widgetConfig, {
            templateKey,
            widgetKey: widget.widget_key,
            zone: widget.zone,
            instanceKey: widget.instance_key,
            requireBindings: validation.requireBindings
        })
        if (validation.rejectBindings && decoded.neutral.bindings !== undefined) {
            throw new Error(`[SchemaSync] Persisted widget ${widget.id} violates its registry source policy`)
        }
        return hasRequiredEntityBackedBindings(widget.widget_key, decoded.rendererConfig)
    })
