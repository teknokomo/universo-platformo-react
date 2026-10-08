import {
    dashboardWidgetConfigSchemaByKey,
    getDashboardWidgetDefinition,
    getLayoutWidgetDefinition,
    layoutInstanceKeySchema,
    validateWidgetBindings,
    type DashboardLayoutWidgetKey,
    type DashboardLayoutZone,
    type TemplateSeedZoneWidget,
    type WidgetBindingSlotDefinition,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'

type DashboardSeedPlacementInput = {
    zone: DashboardLayoutZone
    widgetKey: DashboardLayoutWidgetKey
    instanceKey: string
    sortOrder: number
    rendererConfig?: Record<string, unknown>
    bindings?: WidgetEntityBindingEnvelope
    parentInstanceKey?: string | null
    slotKey?: string | null
    isActive?: boolean
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const resolveDashboardSeedBindingSlots = (
    definition: NonNullable<ReturnType<typeof getDashboardWidgetDefinition>>,
    rendererConfig: Record<string, unknown>
): readonly WidgetBindingSlotDefinition[] => {
    const resolvedDefinition = getLayoutWidgetDefinition(definition.key, rendererConfig)
    if (resolvedDefinition) return resolvedDefinition.bindingSlots ?? []
    const variant = typeof rendererConfig.variant === 'string' ? rendererConfig.variant : undefined
    return (variant && definition.bindingVariants?.[variant]) || definition.bindingSlots || []
}

/** Build one Dashboard manifest placement and validate its renderer/source contracts immediately. */
export const makeDashboardSeedPlacement = (input: DashboardSeedPlacementInput): TemplateSeedZoneWidget => {
    const definition = getDashboardWidgetDefinition(input.widgetKey)
    if (!definition || !definition.allowedZones.includes(input.zone)) {
        throw new Error(`Dashboard widget is not registered in zone ${input.zone}: ${input.widgetKey}`)
    }

    const rendererConfig = dashboardWidgetConfigSchemaByKey[input.widgetKey].parse(input.rendererConfig ?? {}) as Record<string, unknown>
    const resolvedDefinition = getLayoutWidgetDefinition(input.widgetKey, rendererConfig)
    const bindingSlots = resolvedDefinition?.bindingSlots ?? resolveDashboardSeedBindingSlots(definition, rendererConfig)
    const definitionForBindings = resolvedDefinition ?? { ...definition, bindingSlots }
    const bindings = validateWidgetBindings(definitionForBindings, input.bindings ?? { version: 1, slots: [] })
    const parentInstanceKey = input.parentInstanceKey ?? null
    const slotKey = input.slotKey ?? null
    if ((parentInstanceKey === null) !== (slotKey === null)) {
        throw new Error('Dashboard root placements must omit both parent and slot; child placements require both.')
    }

    const placement = {
        zone: input.zone,
        widgetKey: input.widgetKey,
        instanceKey: layoutInstanceKeySchema.parse(input.instanceKey),
        sortOrder: input.sortOrder,
        rendererConfig,
        ...(bindings.slots.length > 0 ? { bindings } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
    }
    if (parentInstanceKey === null) return { ...placement, parentInstanceKey: null, slotKey: null }
    if (slotKey === null) throw new Error('Dashboard child placements require both a parent and a slot.')
    return { ...placement, parentInstanceKey, slotKey }
}

/** Build a parent record-set plus related child panels from the widget's resolved semantic binding contract. */
export const buildDashboardRelationBindings = (
    parentEntityCodename: string,
    panels: readonly { slotKey: string; entityCodename: string }[],
    rendererConfig: Record<string, unknown>
): WidgetEntityBindingEnvelope => {
    const parsedConfig = dashboardWidgetConfigSchemaByKey.relationBuilder.parse(rendererConfig) as Record<string, unknown>
    const definition = getLayoutWidgetDefinition('relationBuilder', parsedConfig)
    if (!definition) throw new Error('Dashboard relationBuilder is not registered')
    const parentSlot = definition.bindingSlots?.find(({ key }) => key === 'parent')
    if (!parentSlot || !parentSlot.selectorKinds.includes('record-set')) {
        throw new Error('Dashboard relationBuilder has no parent record-set binding slot')
    }
    const parentEntityKind = parentSlot.requirements.entityKinds?.[0]
    if (!parentEntityKind) throw new Error('Dashboard relationBuilder parent slot has no registered Entity kind')

    const childSlots = panels.map(({ slotKey, entityCodename }) => {
        const slot = definition.bindingSlots?.find(({ key }) => key === slotKey)
        if (!slot || !slot.selectorKinds.includes('relation-set') || slot.relation?.parentSlot !== 'parent') {
            throw new Error(`Dashboard relationBuilder has no relation-set binding slot: ${slotKey}`)
        }
        const entityKind = slot.requirements.entityKinds?.[0]
        if (!entityKind) throw new Error(`Dashboard relationBuilder slot has no registered Entity kind: ${slotKey}`)
        return {
            slot: slotKey,
            targets: [
                {
                    entityKind,
                    entityCodename,
                    selector: { kind: 'relation-set' as const, parentSlot: 'parent' },
                    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                }
            ]
        }
    })

    return validateWidgetBindings(definition, {
        version: 1,
        slots: [
            {
                slot: 'parent',
                targets: [
                    {
                        entityKind: parentEntityKind,
                        entityCodename: parentEntityCodename,
                        selector: { kind: 'record-set' as const },
                        projection: parentSlot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            },
            ...childSlots
        ]
    })
}

/** Build the bounded parent/items bindings required by one learner-player variant. */
export const buildDashboardLearnerPlayerBindings = (
    variant: 'course' | 'track',
    parentEntityCodename: string,
    itemEntityCodename: string
): WidgetEntityBindingEnvelope => {
    const definition = getDashboardWidgetDefinition('learnerPlayer')
    if (!definition) throw new Error('Dashboard learnerPlayer is not registered')
    const rendererConfig = dashboardWidgetConfigSchemaByKey.learnerPlayer.parse({ variant }) as Record<string, unknown>
    const bindingSlots = resolveDashboardSeedBindingSlots(definition, rendererConfig)
    const parentSlot = bindingSlots.find(({ key }) => key === 'parent')
    const itemSlot = bindingSlots.find(({ key }) => key === 'items')
    if (!parentSlot || !itemSlot) throw new Error(`Dashboard learnerPlayer ${variant} binding contract is incomplete`)

    const parentEntityKind = parentSlot.requirements.entityKinds?.[0]
    const itemEntityKind = itemSlot.requirements.entityKinds?.[0]
    if (!parentEntityKind || !itemEntityKind) throw new Error(`Dashboard learnerPlayer ${variant} binding Entity kind is missing`)

    return validateWidgetBindings(
        { ...definition, bindingSlots },
        {
            version: 1,
            slots: [
                {
                    slot: 'parent',
                    targets: [
                        {
                            entityKind: parentEntityKind,
                            entityCodename: parentEntityCodename,
                            selector: { kind: 'record-set' },
                            projection: parentSlot.requirements.components.map(({ field, componentCodename }) => ({
                                field,
                                componentCodename
                            }))
                        }
                    ]
                },
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: itemEntityKind,
                            entityCodename: itemEntityCodename,
                            selector: { kind: 'relation-set', parentSlot: 'parent' },
                            projection: itemSlot.requirements.components.map(({ field, componentCodename }) => ({
                                field,
                                componentCodename
                            }))
                        }
                    ]
                }
            ]
        }
    )
}

/** Build a complete record-set projection using only a registered widget slot. */
export const buildDashboardRecordSetBinding = (
    widgetKey: DashboardLayoutWidgetKey,
    slotKey: string,
    entityCodename: string,
    rendererConfig: Record<string, unknown> = {}
): WidgetEntityBindingEnvelope => {
    const definition = getDashboardWidgetDefinition(widgetKey)
    if (!definition) throw new Error(`Dashboard widget is not registered: ${widgetKey}`)
    const parsedConfig = dashboardWidgetConfigSchemaByKey[widgetKey].parse(rendererConfig) as Record<string, unknown>
    const slotDefinitions = resolveDashboardSeedBindingSlots(definition, parsedConfig)
    const slot = slotDefinitions.find(({ key }) => key === slotKey)
    if (!slot || !slot.selectorKinds.includes('record-set')) {
        throw new Error(`Dashboard widget has no record-set binding slot: ${widgetKey}/${slotKey}`)
    }
    const entityKind = slot.requirements.entityKinds?.[0]
    if (!entityKind) throw new Error(`Dashboard binding slot has no registered Entity kind: ${widgetKey}/${slotKey}`)

    return validateWidgetBindings(
        { ...definition, bindingSlots: slotDefinitions },
        {
            version: 1,
            slots: [
                {
                    slot: slotKey,
                    targets: [
                        {
                            entityKind,
                            entityCodename,
                            selector: { kind: 'record-set' },
                            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                        }
                    ]
                }
            ]
        }
    )
}

/** Build one record-set binding slot with multiple semantic Entity targets. */
export const buildDashboardRecordSetBindings = (
    widgetKey: DashboardLayoutWidgetKey,
    slotKey: string,
    entityCodenames: readonly string[],
    rendererConfig: Record<string, unknown> = {}
): WidgetEntityBindingEnvelope => {
    const definition = getDashboardWidgetDefinition(widgetKey)
    if (!definition) throw new Error(`Dashboard widget is not registered: ${widgetKey}`)
    const parsedConfig = dashboardWidgetConfigSchemaByKey[widgetKey].parse(rendererConfig) as Record<string, unknown>
    const slotDefinitions = resolveDashboardSeedBindingSlots(definition, parsedConfig)
    const slot = slotDefinitions.find(({ key }) => key === slotKey)
    if (!slot || !slot.selectorKinds.includes('record-set')) {
        throw new Error(`Dashboard widget has no record-set binding slot: ${widgetKey}/${slotKey}`)
    }
    const entityKind = slot.requirements.entityKinds?.[0]
    if (!entityKind) throw new Error(`Dashboard binding slot has no registered Entity kind: ${widgetKey}/${slotKey}`)
    const codenames = [...new Set(entityCodenames.map((value) => value.trim()).filter(Boolean))]
    if (codenames.length === 0) throw new Error(`Dashboard record-set binding requires at least one Entity target: ${widgetKey}/${slotKey}`)

    return validateWidgetBindings(
        { ...definition, bindingSlots: slotDefinitions },
        {
            version: 1,
            slots: [
                {
                    slot: slotKey,
                    targets: codenames.map((entityCodename) => ({
                        entityKind,
                        entityCodename,
                        selector: { kind: 'record-set' as const },
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }))
                }
            ]
        }
    )
}

const comparePlacements = (left: TemplateSeedZoneWidget, right: TemplateSeedZoneWidget): number =>
    left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey)

/** Validate Dashboard seed identities/composition and return a deterministic parent-first insertion order. */
export const orderDashboardSeedPlacements = (widgets: readonly TemplateSeedZoneWidget[]): TemplateSeedZoneWidget[] => {
    const byInstanceKey = new Map<string, TemplateSeedZoneWidget>()
    const singletonKeys = new Set<string>()
    const declaredInstanceKeys = new Set(widgets.map(({ instanceKey }) => instanceKey))

    for (const widget of widgets) {
        if (widget.parentInstanceKey !== null && !declaredInstanceKeys.has(widget.parentInstanceKey)) {
            throw new Error(`Dashboard seed parent placement is missing: ${widget.parentInstanceKey}`)
        }
        if ((widget.parentInstanceKey === null) !== (widget.slotKey === null)) {
            throw new Error('Dashboard root placements must omit both parent and slot; child placements require both.')
        }
    }

    const pending = [...widgets].sort(comparePlacements)
    const ordered: TemplateSeedZoneWidget[] = []
    const emitted = new Set<string>()
    while (pending.length > 0) {
        const readyIndex = pending.findIndex((widget) => widget.parentInstanceKey === null || emitted.has(widget.parentInstanceKey))
        if (readyIndex === -1) throw new Error('Dashboard seed placement graph cannot contain cycles.')
        const [ready] = pending.splice(readyIndex, 1)
        if (!ready) continue
        ordered.push(ready)
        emitted.add(ready.instanceKey)
    }

    for (const widget of widgets) {
        const widgetKey = widget.widgetKey as DashboardLayoutWidgetKey
        const definition = getDashboardWidgetDefinition(widgetKey)
        if (!definition) throw new Error(`Dashboard seed uses an unregistered widget: ${widget.widgetKey}`)
        if (!definition.allowedZones.includes(widget.zone as DashboardLayoutZone)) {
            throw new Error(`Dashboard seed widget is not allowed in zone: ${widget.widgetKey}/${widget.zone}`)
        }
        const instanceKey = layoutInstanceKeySchema.parse(widget.instanceKey)
        if (byInstanceKey.has(instanceKey)) throw new Error(`Dashboard seed instanceKey is duplicated: ${instanceKey}`)
        byInstanceKey.set(instanceKey, widget)
        if (!definition.multiInstance && singletonKeys.has(widget.widgetKey)) {
            throw new Error(`Dashboard seed duplicates single-instance widget: ${widget.widgetKey}`)
        }
        if (!definition.multiInstance) singletonKeys.add(widget.widgetKey)

        const rendererConfig = dashboardWidgetConfigSchemaByKey[widgetKey].parse(widget.rendererConfig) as Record<string, unknown>
        const bindingDefinition = getLayoutWidgetDefinition(widgetKey, rendererConfig) ?? {
            ...definition,
            bindingSlots: resolveDashboardSeedBindingSlots(definition, rendererConfig)
        }
        validateWidgetBindings(bindingDefinition, widget.bindings ?? { version: 1, slots: [] })

        const hasParent = widget.parentInstanceKey !== null
        if (hasParent !== (widget.slotKey !== null)) {
            throw new Error('Dashboard root placements must omit both parent and slot; child placements require both.')
        }
    }

    for (const widget of widgets) {
        if (widget.parentInstanceKey === null) continue
        const parent = byInstanceKey.get(widget.parentInstanceKey)
        if (!parent) throw new Error(`Dashboard seed parent placement is missing: ${widget.parentInstanceKey}`)
        if (parent.zone !== widget.zone) throw new Error('Dashboard child and parent placements must use the same zone.')

        const parentDefinition = getDashboardWidgetDefinition(parent.widgetKey as DashboardLayoutWidgetKey)
        const childDefinition = getDashboardWidgetDefinition(widget.widgetKey as DashboardLayoutWidgetKey)
        const container = parentDefinition?.composition?.container
        const parentConfig = asRecord(parent.rendererConfig)
        const slotCollection = container ? parentConfig[container.kind] : undefined
        const configuredSlotKeys = Array.isArray(slotCollection)
            ? slotCollection.flatMap((entry) => {
                  const slotKey = asRecord(entry).slotKey
                  return typeof slotKey === 'string' ? [slotKey] : []
              })
            : []
        const matchedSlot = container?.slots.find((slot) => {
            if (!widget.slotKey?.startsWith(slot.slotPrefix)) return false
            const suffix = widget.slotKey.slice(slot.slotPrefix.length)
            return new RegExp(slot.slotKeyPattern, 'u').test(suffix) && configuredSlotKeys.includes(widget.slotKey)
        })
        const compatibleCapability = (childDefinition?.capabilities ?? []).some((capability) =>
            matchedSlot?.allowedChildCapabilities.includes(capability)
        )
        if (childDefinition?.placementPolicy.parent !== 'root-or-compatible-container-slot' || !matchedSlot || !compatibleCapability) {
            throw new Error(`Dashboard child placement is incompatible with parent slot: ${widget.parentInstanceKey}/${widget.slotKey}`)
        }
    }

    return ordered
}
