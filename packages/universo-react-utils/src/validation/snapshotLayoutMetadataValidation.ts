import {
    MissingRequiredWidgetBindingsError,
    applicationTemplateKeySchema,
    decodeLayoutConfigEnvelope,
    decodeWidgetConfigEnvelope
} from '@universo-react/types'

type SnapshotMetadataFailure = (message: string, details: Record<string, unknown>) => never

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readSnapshotArray = (value: unknown, field: string, failSnapshotLayout: SnapshotMetadataFailure): unknown[] => {
    if (value === undefined) return []
    if (!Array.isArray(value)) failSnapshotLayout(`Snapshot ${field} must be an array`, {})
    return value
}

export const readSnapshotRecordArray = (
    value: unknown,
    field: string,
    failSnapshotLayout: SnapshotMetadataFailure
): Record<string, unknown>[] =>
    readSnapshotArray(value, field, failSnapshotLayout).map((entry, index) => {
        if (!isRecord(entry)) failSnapshotLayout(`Snapshot ${field} entry is invalid`, { index })
        return entry
    })

export const readSnapshotTemplateKey = (value: unknown, scope: string, failSnapshotLayout: SnapshotMetadataFailure) => {
    const parsed = applicationTemplateKeySchema.safeParse(value)
    if (!parsed.success) failSnapshotLayout(`Snapshot ${scope} template key is invalid`, { scope })
    return parsed.data
}

export const decodeSnapshotLayoutRendererConfig = (config: unknown, templateKey: string): Record<string, unknown> => {
    const decoded = decodeLayoutConfigEnvelope(config === undefined ? {} : config, { templateKey })
    return decoded.rendererConfig
}

/**
 * Validate the neutral `__layout` transport envelope without weakening the
 * renderer-owned marketing config validator. Snapshot composition remains a
 * top-level transport concern and application-only source settings are never
 * accepted in a published snapshot.
 */
export const validateSnapshotLayoutNeutralMetadata = (snapshot: unknown, failSnapshotLayout: SnapshotMetadataFailure): void => {
    if (!isRecord(snapshot)) failSnapshotLayout('Snapshot must be an object', {})

    const layouts = [
        ...readSnapshotRecordArray(snapshot.layouts, 'layouts', failSnapshotLayout),
        ...readSnapshotRecordArray(snapshot.scopedLayouts, 'scoped layouts', failSnapshotLayout)
    ]
    const layoutsById = new Map<string, Record<string, unknown>>()
    for (const layout of layouts) {
        const layoutId = typeof layout.id === 'string' ? layout.id : String(layout.id)
        const templateKey = readSnapshotTemplateKey(layout.templateKey, `layout:${layoutId}`, failSnapshotLayout)
        let decoded: ReturnType<typeof decodeLayoutConfigEnvelope>
        try {
            decoded = decodeLayoutConfigEnvelope(layout.config === undefined ? {} : layout.config, { templateKey })
        } catch {
            failSnapshotLayout('Snapshot layout neutral metadata is invalid', { layoutId })
        }
        if (decoded.neutral.sourceZoneSettings !== undefined) {
            failSnapshotLayout('Snapshot layout metadata contains application-only source zone settings', { layoutId })
        }
        if (decoded.neutral.composition !== undefined) {
            failSnapshotLayout('Snapshot layout config must not duplicate top-level composition metadata', { layoutId })
        }
        if (layout.baseLayoutId !== null && layout.compositionMode !== 'overlay') {
            failSnapshotLayout('Snapshot scoped layout composition is invalid', { layoutId })
        }
        if (layout.baseLayoutId === null && layout.compositionMode !== 'independent') {
            failSnapshotLayout('Snapshot layout composition is invalid', { layoutId })
        }
        if (typeof layout.id === 'string') layoutsById.set(layout.id, layout)
    }

    const defaultLayout = typeof snapshot.defaultLayoutId === 'string' ? layoutsById.get(snapshot.defaultLayoutId) : undefined
    if (snapshot.layoutConfig !== undefined && defaultLayout) {
        const templateKey = readSnapshotTemplateKey(defaultLayout.templateKey, `layout:${String(defaultLayout.id)}`, failSnapshotLayout)
        let decoded: ReturnType<typeof decodeLayoutConfigEnvelope>
        try {
            decoded = decodeLayoutConfigEnvelope(snapshot.layoutConfig, { templateKey })
        } catch {
            failSnapshotLayout('Snapshot default layout neutral metadata is invalid', { defaultLayoutId: snapshot.defaultLayoutId })
        }
        if (decoded.neutral.composition !== undefined || decoded.neutral.sourceZoneSettings !== undefined) {
            failSnapshotLayout('Snapshot default layout config contains forbidden composition or source metadata', {
                defaultLayoutId: snapshot.defaultLayoutId
            })
        }
    }

    const widgets = readSnapshotRecordArray(snapshot.layoutZoneWidgets, 'layout widgets', failSnapshotLayout)
    const widgetsById = new Map<string, Record<string, unknown>>()
    for (const widget of widgets) {
        const layout = typeof widget.layoutId === 'string' ? layoutsById.get(widget.layoutId) : undefined
        if (!layout) failSnapshotLayout('Snapshot widget references an unknown layout', { widgetId: widget.id })
        const templateKey = readSnapshotTemplateKey(layout.templateKey, `layout:${String(layout.id)}`, failSnapshotLayout)
        try {
            decodeWidgetConfigEnvelope(widget.config === undefined ? {} : widget.config, {
                templateKey,
                widgetKey: String(widget.widgetKey),
                zone: String(widget.zone),
                requireBindings: true
            })
        } catch (error) {
            if (error instanceof MissingRequiredWidgetBindingsError) {
                failSnapshotLayout('Snapshot widget binding is invalid', { widgetId: widget.id })
            }
            failSnapshotLayout('Snapshot widget configuration is invalid', { widgetId: widget.id })
        }
        if (typeof widget.id === 'string') widgetsById.set(widget.id, widget)
    }

    for (const override of readSnapshotRecordArray(snapshot.layoutWidgetOverrides, 'widget overrides', failSnapshotLayout)) {
        if (override.config === null || override.config === undefined) continue
        const baseWidget = typeof override.baseWidgetId === 'string' ? widgetsById.get(override.baseWidgetId) : undefined
        const layout = typeof override.layoutId === 'string' ? layoutsById.get(override.layoutId) : undefined
        if (!baseWidget || !layout) {
            failSnapshotLayout('Snapshot widget override references an unknown layout or base widget', { overrideId: override.id })
        }
        const templateKey = readSnapshotTemplateKey(layout.templateKey, `layout:${String(layout.id)}`, failSnapshotLayout)
        try {
            decodeWidgetConfigEnvelope(override.config, {
                templateKey,
                widgetKey: String(baseWidget.widgetKey),
                zone: String(override.zone ?? baseWidget.zone),
                requireBindings: true
            })
        } catch (error) {
            if (error instanceof MissingRequiredWidgetBindingsError) {
                failSnapshotLayout('Snapshot widget override binding is invalid', { overrideId: override.id })
            }
            failSnapshotLayout('Snapshot widget override configuration is invalid', { overrideId: override.id })
        }
    }
}
