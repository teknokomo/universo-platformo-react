import { decodeLayoutWidgetConfigEnvelope, getLayoutWidgetDefinition, type ApplicationTemplateKey } from '@universo-react/types'
import { isApplicationLayoutSyncRecord } from './applicationLayoutSyncGuards'

type JsonRecord = Record<string, unknown>

interface EntityBackedWidgetCopyInput {
    widgetKey: string
    zone: string
    config: unknown
}

interface PersistedEntityBackedWidgetInput {
    id: string
    zone: string
    widget_key: string
    config: unknown
    source_config: unknown
    source_base_widget_id: string | null
    _upl_deleted: boolean
    _app_deleted: boolean
}

const requireRecord = (value: unknown, context: string): JsonRecord => {
    if (!isApplicationLayoutSyncRecord(value)) throw new Error(`[SchemaSync] ${context} must be an object`)
    return value
}

const hasRequiredEntityBackedBindings = (widgetKey: string, rendererConfig: unknown): boolean => {
    const definition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    return (
        definition?.authoring?.application.presentationOnly === true &&
        (definition.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)
    )
}

/** Classify source widgets whose required Entity bindings cannot transfer to application-owned content. */
export const containsEntityBackedWidgetCopyConflict = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly EntityBackedWidgetCopyInput[]
): boolean =>
    widgets.some((widget) => {
        const decoded = decodeLayoutWidgetConfigEnvelope(widget.config, {
            templateKey,
            widgetKey: widget.widgetKey,
            zone: widget.zone
        })
        return hasRequiredEntityBackedBindings(widget.widgetKey, decoded.rendererConfig)
    })

/** Classify persisted, active widgets that retain required Entity bindings when their source layout is removed. */
export const containsPersistedRequiredEntityBackedWidget = (
    templateKey: ApplicationTemplateKey,
    widgets: readonly PersistedEntityBackedWidgetInput[]
): boolean =>
    widgets.some((widget) => {
        if (widget._upl_deleted || widget._app_deleted) return false
        const inheritsMarketingBindings =
            templateKey === 'marketing-page' && widget.source_base_widget_id !== null && widget.source_base_widget_id !== undefined
        const widgetConfig = requireRecord(widget.source_config ?? widget.config, `Persisted widget ${widget.id} source config`)
        const decoded = decodeLayoutWidgetConfigEnvelope(widgetConfig, {
            templateKey,
            widgetKey: widget.widget_key,
            zone: widget.zone,
            requireBindings: !inheritsMarketingBindings
        })
        if (inheritsMarketingBindings && decoded.neutral.bindings !== undefined) {
            throw new Error(`[SchemaSync] Persisted Marketing overlay widget ${widget.id} cannot contain entity bindings`)
        }
        return hasRequiredEntityBackedBindings(widget.widget_key, decoded.rendererConfig)
    })
