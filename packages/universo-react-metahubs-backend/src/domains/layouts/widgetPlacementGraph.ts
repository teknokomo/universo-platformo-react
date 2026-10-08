import {
    getDashboardWidgetDefinition,
    getLayoutWidgetDefinition,
    layoutInstanceKeySchema,
    type ApplicationTemplateKey
} from '@universo-react/types'

type PlacementGraphRow = {
    id: string
    instanceKey?: unknown
    instance_key?: unknown
    parentWidgetId?: unknown
    parent_widget_id?: unknown
    slotKey?: unknown
    slot_key?: unknown
    widgetKey?: unknown
    widget_key?: unknown
    zone?: unknown
    config?: unknown
}

type PlacementNode = {
    id: string
    instanceKey: string
    parentWidgetId: string | null
    slotKey: string | null
    widgetKey: string
    zone: string
    rendererConfig: Record<string, unknown>
    row: PlacementGraphRow
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const readField = (row: PlacementGraphRow, camelCase: keyof PlacementGraphRow, snakeCase: keyof PlacementGraphRow): unknown =>
    camelCase in row ? row[camelCase] : row[snakeCase]

const resolveDefinition = (widgetKey: string, rendererConfig: Record<string, unknown>) =>
    getDashboardWidgetDefinition(widgetKey) ?? getLayoutWidgetDefinition(widgetKey, rendererConfig)

const readRendererConfig = (value: unknown): Record<string, unknown> => {
    if (!isRecord(value)) return {}
    if (isRecord(value.rendererConfig)) return value.rendererConfig
    const { __layout: _layoutMetadata, ...rendererConfig } = value
    return rendererConfig
}

const getConfiguredSlots = (node: PlacementNode, kind: 'columns' | 'tabs'): { declared: Set<string>; count: number } => {
    const raw = node.rendererConfig[kind]
    if (!Array.isArray(raw)) return { declared: new Set(), count: 0 }
    const keys = raw.map((entry) => (isRecord(entry) ? entry.slotKey : undefined)).filter((key): key is string => typeof key === 'string')
    return { declared: new Set(keys), count: keys.length }
}

const assertPlacementParentCapability = (child: PlacementNode, parent: PlacementNode): void => {
    const childDefinition = resolveDefinition(child.widgetKey, child.rendererConfig)
    const parentDefinition = resolveDefinition(parent.widgetKey, parent.rendererConfig)
    const container = parentDefinition?.composition?.container
    const compatibleChild =
        childDefinition?.placementPolicy.parent === 'root-or-compatible-container-slot' &&
        (childDefinition.capabilities ?? []).some((capability) =>
            (container?.slots ?? []).some((slot) => slot.allowedChildCapabilities.includes(capability))
        )
    const matchingSlot = container?.slots.find((slot) => {
        if (!child.slotKey?.startsWith(slot.slotPrefix)) return false
        const suffix = child.slotKey.slice(slot.slotPrefix.length)
        if (!new RegExp(slot.slotKeyPattern, 'u').test(suffix)) return false
        return getConfiguredSlots(parent, container.kind).declared.has(child.slotKey)
    })

    if (!container || !compatibleChild || !matchingSlot || parent.zone !== child.zone) {
        throw new Error('Layout widget parent, container slot, or child capability is incompatible')
    }

    for (const slot of container.slots) {
        const configured = getConfiguredSlots(parent, container.kind)
        const count = [...configured.declared].filter((key) => key.startsWith(slot.slotPrefix)).length
        if (count < slot.minSlots || count > slot.maxSlots || configured.count !== configured.declared.size) {
            throw new Error('Layout widget container slot configuration is invalid')
        }
    }
}

/** Validate persisted placements using the shared widget ownership/composition registry. */
export const validateLayoutWidgetPlacementGraph = (templateKey: ApplicationTemplateKey, rows: readonly PlacementGraphRow[]): void => {
    const byId = new Map<string, PlacementNode>()
    const instanceKeys = new Set<string>()

    for (const row of rows) {
        if (!row || typeof row.id !== 'string' || row.id.length === 0) {
            throw new Error('Layout widget identity is invalid')
        }

        const instanceKey = readField(row, 'instanceKey', 'instance_key')
        const parsedInstanceKey = layoutInstanceKeySchema.safeParse(instanceKey)
        if (!parsedInstanceKey.success || instanceKeys.has(parsedInstanceKey.data)) {
            throw new Error('Layout widget instance keys must be present and unique within a layout')
        }
        instanceKeys.add(parsedInstanceKey.data)

        const parentWidgetId = readField(row, 'parentWidgetId', 'parent_widget_id')
        const slotKey = readField(row, 'slotKey', 'slot_key')
        if ((parentWidgetId === null) !== (slotKey === null)) {
            throw new Error('Root widgets must omit both parent and slot; nested widgets require both')
        }
        if (parentWidgetId !== null && typeof parentWidgetId !== 'string') {
            throw new Error('Layout widget parent identity is invalid')
        }
        if (slotKey !== null && typeof slotKey !== 'string') {
            throw new Error('Layout widget slot identity is invalid')
        }

        const widgetKey = readField(row, 'widgetKey', 'widget_key')
        const zone = row.zone
        if (typeof widgetKey !== 'string' || typeof zone !== 'string') {
            throw new Error('Layout widget registry identity is invalid')
        }
        const rendererConfig = readRendererConfig(row.config)
        const definition = resolveDefinition(widgetKey, rendererConfig)
        if (!definition?.supportedTemplates.includes(templateKey)) {
            throw new Error('Layout widget is not registered for its template')
        }

        const node: PlacementNode = {
            id: row.id,
            instanceKey: parsedInstanceKey.data,
            parentWidgetId: parentWidgetId as string | null,
            slotKey: slotKey as string | null,
            widgetKey,
            zone,
            rendererConfig,
            row
        }
        if (byId.has(node.id)) throw new Error('Layout widget row ids must be unique')
        byId.set(node.id, node)
    }

    const parentById = new Map<string, string>()
    for (const node of byId.values()) {
        if (node.parentWidgetId === null) continue
        if (node.parentWidgetId === node.id) throw new Error('Layout widget cannot be its own parent')
        const parent = byId.get(node.parentWidgetId)
        if (!parent) throw new Error('Layout widget parent must exist in the resolved placement graph')
        parentById.set(node.id, parent.id)
    }

    const completed = new Set<string>()
    for (const node of byId.values()) {
        const currentPath = new Set<string>()
        let current: string | undefined = node.id
        while (current !== undefined && !completed.has(current)) {
            if (currentPath.has(current)) throw new Error('Layout widget placement graph cannot contain cycles')
            currentPath.add(current)
            current = parentById.get(current)
        }
        for (const id of currentPath) completed.add(id)
    }

    for (const node of byId.values()) {
        if (node.parentWidgetId === null) continue
        const parent = byId.get(node.parentWidgetId)
        if (parent) assertPlacementParentCapability(node, parent)
    }
}
