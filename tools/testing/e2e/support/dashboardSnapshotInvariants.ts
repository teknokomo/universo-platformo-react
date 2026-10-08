import {
    decodeWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    layoutInstanceKeySchema,
    parseApplicationLayoutConfig,
    parseApplicationLayoutWidgetConfig,
    uuidV7Schema
} from '@universo-react/types'

type JsonRecord = Record<string, unknown>
type WidgetRow = JsonRecord & {
    id: string
    layoutId: string
    widgetKey: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    zone: string
    config: JsonRecord
}

const asRecord = (value: unknown): JsonRecord | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null

const asWidgetRow = (value: unknown): WidgetRow | null => {
    const row = asRecord(value)
    if (!row) return null
    if (
        typeof row.id !== 'string' ||
        typeof row.layoutId !== 'string' ||
        typeof row.widgetKey !== 'string' ||
        typeof row.instanceKey !== 'string' ||
        !Object.prototype.hasOwnProperty.call(row, 'parentWidgetId') ||
        !Object.prototype.hasOwnProperty.call(row, 'slotKey') ||
        typeof row.zone !== 'string' ||
        !asRecord(row.config)
    ) {
        throw new Error('Dashboard snapshot placement is missing its first-class identity, parent, slot, zone, or config fields.')
    }
    uuidV7Schema.parse(row.id)
    uuidV7Schema.parse(row.layoutId)
    if (row.parentWidgetId !== null) uuidV7Schema.parse(row.parentWidgetId)
    for (const field of ['sourceWidgetId', 'sourceBaseWidgetId']) {
        const sourceId = row[field]
        if (sourceId !== undefined && sourceId !== null) uuidV7Schema.parse(sourceId)
    }
    return row as WidgetRow
}

const assertParentSlotPair = (widget: WidgetRow): void => {
    const root = widget.parentWidgetId === null && widget.slotKey === null
    const nested = typeof widget.parentWidgetId === 'string' && typeof widget.slotKey === 'string' && widget.slotKey.trim().length > 0
    if (!root && !nested) throw new Error(`Dashboard placement ${widget.instanceKey} has an invalid parent/slot pair.`)
}

const assertNoPlacementCycles = (widgetsById: ReadonlyMap<string, WidgetRow>): void => {
    for (const widget of widgetsById.values()) {
        const visited = new Set<string>([widget.id])
        let current: WidgetRow | undefined = widget
        while (current?.parentWidgetId) {
            if (visited.has(current.parentWidgetId)) {
                throw new Error(`Dashboard placement graph contains a cycle at ${widget.instanceKey}.`)
            }
            visited.add(current.parentWidgetId)
            current = widgetsById.get(current.parentWidgetId)
        }
    }
}

const assertConfiguredContainerSlot = (parent: WidgetRow, child: WidgetRow): void => {
    const slotKey = child.slotKey
    if (!slotKey) throw new Error(`Dashboard placement ${child.instanceKey} is missing a container slot.`)
    const parentDefinition = getLayoutWidgetDefinition(parent.widgetKey, parent.config)
    const childDefinition = getLayoutWidgetDefinition(child.widgetKey, child.config)
    const container = parentDefinition?.composition?.container
    const slot = container?.slots.find(
        (candidate) =>
            slotKey.startsWith(candidate.slotPrefix) &&
            new RegExp(candidate.slotKeyPattern, 'u').test(slotKey.slice(candidate.slotPrefix.length))
    )
    const descriptors = container ? parent.config[container.kind === 'columns' ? 'columns' : 'tabs'] : undefined
    const slotIsConfigured = Array.isArray(descriptors) && descriptors.some((descriptor) => asRecord(descriptor)?.slotKey === slotKey)
    const childCapabilityIsAllowed = (childDefinition?.capabilities ?? []).some((capability) =>
        (slot?.allowedChildCapabilities ?? []).includes(capability)
    )

    if (
        parent.zone !== child.zone ||
        childDefinition?.placementPolicy.parent !== 'root-or-compatible-container-slot' ||
        !slot ||
        !slotIsConfigured ||
        !childCapabilityIsAllowed
    ) {
        throw new Error(`Dashboard placement ${child.instanceKey} uses an incompatible parent or slot.`)
    }
}

/** Reject old Dashboard composition and renderer blobs in exported snapshots. */
export const assertDashboardSnapshotInvariants = (snapshotValue: unknown): void => {
    const snapshot = asRecord(snapshotValue)
    if (!snapshot) throw new Error('Snapshot payload must be an object.')
    if (!Array.isArray(snapshot.layouts)) throw new Error('Snapshot is missing its layout collection.')

    const layouts = snapshot.layouts.map((value) => {
        const layout = asRecord(value)
        if (!layout) throw new Error('Snapshot layout entries must be objects.')
        return layout
    })
    const scopedLayouts = Array.isArray(snapshot.scopedLayouts)
        ? snapshot.scopedLayouts.map((value) => {
              const layout = asRecord(value)
              if (!layout) throw new Error('Snapshot scoped layout entries must be objects.')
              return layout
          })
        : []
    const dashboardLayouts = new Map<string, JsonRecord>()
    const layoutIds = new Set<string>()
    for (const layout of [...layouts, ...scopedLayouts]) {
        if (typeof layout.id !== 'string') throw new Error('Dashboard layout snapshot is missing its stable id.')
        uuidV7Schema.parse(layout.id)
        if (layoutIds.has(layout.id)) throw new Error(`Snapshot duplicates layout id "${layout.id}".`)
        layoutIds.add(layout.id)
        if (layout.templateKey !== 'dashboard') continue
        parseApplicationLayoutConfig('dashboard', layout.config ?? {})
        dashboardLayouts.set(layout.id, layout)
    }

    const snapshotLayoutConfig = asRecord(snapshot.layoutConfig)
    if (snapshotLayoutConfig && Object.keys(snapshotLayoutConfig).some((key) => /^show[A-Z]/u.test(key))) {
        throw new Error('Dashboard snapshot still contains retired show* layout authority.')
    }

    if (!Array.isArray(snapshot.layoutZoneWidgets)) throw new Error('Snapshot is missing its layout widget collection.')
    const widgetValues = snapshot.layoutZoneWidgets
    const dashboardWidgets: WidgetRow[] = []
    const keysByLayout = new Set<string>()
    const singleInstanceKeysByLayout = new Set<string>()
    const rowsById = new Map<string, WidgetRow>()

    for (const value of widgetValues) {
        const candidate = asRecord(value)
        if (!candidate || typeof candidate.layoutId !== 'string') throw new Error('Snapshot widget entries must reference a layout.')
        if (!layoutIds.has(candidate.layoutId)) throw new Error('Snapshot widget references an unavailable layout.')
        if (!dashboardLayouts.has(candidate.layoutId)) continue
        const widget = asWidgetRow(value)
        if (!widget) throw new Error('Dashboard layout widget must be an object.')
        const definition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
        if (!definition?.supportedTemplates.includes('dashboard')) {
            throw new Error(`Dashboard snapshot contains retired or unsupported widget "${widget.widgetKey}".`)
        }
        if (!definition.allowedZonesByTemplate.dashboard?.includes(widget.zone)) {
            throw new Error(`Dashboard widget "${widget.widgetKey}" is not allowed in zone "${widget.zone}".`)
        }
        const widgetTypeKey = `${widget.layoutId}:${widget.widgetKey}`
        if (!definition.multiInstance && singleInstanceKeysByLayout.has(widgetTypeKey)) {
            throw new Error(`Dashboard widget "${widget.widgetKey}" does not allow duplicate placements.`)
        }
        if (!definition.multiInstance) singleInstanceKeysByLayout.add(widgetTypeKey)
        layoutInstanceKeySchema.parse(widget.instanceKey)
        assertParentSlotPair(widget)
        const uniqueKey = `${widget.layoutId}:${widget.instanceKey}`
        if (keysByLayout.has(uniqueKey)) throw new Error(`Dashboard snapshot duplicates instance key "${widget.instanceKey}".`)
        keysByLayout.add(uniqueKey)
        const layout = dashboardLayouts.get(widget.layoutId)
        if (!layout) throw new Error(`Dashboard placement ${widget.instanceKey} references a non-Dashboard layout.`)
        const envelopeContext = {
            templateKey: 'dashboard',
            widgetKey: widget.widgetKey,
            zone: widget.zone,
            requireBindings: false
        } as const
        const decodedConfig = decodeWidgetConfigEnvelope(widget.config, envelopeContext)
        parseApplicationLayoutWidgetConfig(widget.widgetKey, decodedConfig.rendererConfig)
        if (candidate.sourceConfig !== undefined && candidate.sourceConfig !== null) {
            const decodedSourceConfig = decodeWidgetConfigEnvelope(candidate.sourceConfig, envelopeContext)
            parseApplicationLayoutWidgetConfig(widget.widgetKey, decodedSourceConfig.rendererConfig)
        }
        if (rowsById.has(widget.id)) throw new Error(`Dashboard snapshot duplicates placement id "${widget.id}".`)
        rowsById.set(widget.id, widget)
        dashboardWidgets.push(widget)
    }

    for (const widget of dashboardWidgets) {
        if (widget.parentWidgetId === null) continue
        const parent = rowsById.get(widget.parentWidgetId)
        if (!parent || parent.layoutId !== widget.layoutId || parent.id === widget.id) {
            throw new Error(`Dashboard placement ${widget.instanceKey} references a missing, foreign, or self parent.`)
        }
        assertConfiguredContainerSlot(parent, widget)
    }

    assertNoPlacementCycles(rowsById)
}
