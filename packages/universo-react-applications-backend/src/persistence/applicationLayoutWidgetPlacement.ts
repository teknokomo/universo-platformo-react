import { z } from 'zod'
import {
    decodeLayoutWidgetConfigEnvelope,
    getDashboardWidgetDefinition,
    getLayoutWidgetDefinition,
    getPlacementSourcePolicy,
    getPlacementLineageState,
    layoutInstanceKeySchema,
    parseApplicationLayoutWidgetConfig,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'

const physicalWidgetIdSchema = z.string().refine(isUuidV7, 'Expected a UUID v7 widget id')
const applicationLayoutWidgetPlacementFieldsSchema = z.object({
    instanceKey: layoutInstanceKeySchema,
    parentWidgetId: physicalWidgetIdSchema.nullable(),
    slotKey: z.string().trim().min(1).max(128).nullable()
})

export const applicationLayoutWidgetPlacementSchema = applicationLayoutWidgetPlacementFieldsSchema
    .strict()
    .superRefine((placement, context) => {
        if ((placement.parentWidgetId === null) !== (placement.slotKey === null)) {
            context.addIssue({ code: z.ZodIssueCode.custom, message: 'Parent and slot must either both be set or both be null' })
        }
    })

export type ApplicationLayoutWidgetPlacement = z.infer<typeof applicationLayoutWidgetPlacementSchema>

export interface PlacementGraphNode extends ApplicationLayoutWidgetPlacement {
    id: string
    layoutId: string
    templateKey: ApplicationTemplateKey
    widgetKey: string
    zone: string
    rendererConfig: Record<string, unknown>
}

export interface PlacementRegistryDefinition {
    key: string
    supportedTemplates: readonly string[]
    allowedZonesByTemplate: Readonly<Record<string, readonly string[] | undefined>>
    capabilities: readonly string[]
    sourcePolicy?: ReturnType<typeof getPlacementSourcePolicy>
    composition?: {
        container?: {
            kind: 'columns' | 'tabs'
            slots: readonly {
                slotPrefix: string
                slotKeyPattern: string
                minSlots: number
                maxSlots: number
                allowedChildCapabilities: readonly string[]
            }[]
            childrenAreFirstClassPlacements: true
        }
    }
}

export type PlacementRegistryResolver = (widgetKey: string) => PlacementRegistryDefinition | undefined

export const resolvePlacementRegistryDefinition: PlacementRegistryResolver = (widgetKey) => {
    const dashboardDefinition = getDashboardWidgetDefinition(widgetKey)
    if (dashboardDefinition) {
        return { ...dashboardDefinition, sourcePolicy: getPlacementSourcePolicy(dashboardDefinition) }
    }

    const templateDefinition = getLayoutWidgetDefinition(widgetKey)
    if (!templateDefinition) return undefined
    return {
        key: templateDefinition.key,
        supportedTemplates: templateDefinition.supportedTemplates,
        allowedZonesByTemplate: templateDefinition.allowedZonesByTemplate,
        capabilities: [],
        composition: undefined
    }
}

export type PlacementBindingMode = 'none' | 'optional' | 'required' | 'specialized'

export interface PlacementBindingPolicy {
    sourceMode: PlacementBindingMode
    inheritBindings: boolean
    sourceAuthority: 'local' | 'metahub-source'
}

export const resolvePlacementBindingPolicy = (widgetKey: string, rendererConfig: unknown = {}): PlacementBindingPolicy => {
    const dashboardDefinition = getDashboardWidgetDefinition(widgetKey)
    if (dashboardDefinition) {
        const sourcePolicy =
            getLayoutWidgetDefinition(widgetKey, rendererConfig)?.sourcePolicy ?? getPlacementSourcePolicy(dashboardDefinition)
        return {
            sourceMode: sourcePolicy.sourceMode,
            inheritBindings: sourcePolicy.inheritBindings,
            sourceAuthority: sourcePolicy.authority
        }
    }

    const templateDefinition = getLayoutWidgetDefinition(widgetKey, rendererConfig)
    if (!templateDefinition) throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_INVALID')
    const slots = templateDefinition.bindingSlots ?? []
    const sourceMode: PlacementBindingMode =
        slots.length === 0 ? 'none' : slots.some((slot) => slot.cardinality.min > 0) ? 'required' : 'optional'
    return { sourceMode, inheritBindings: sourceMode !== 'none', sourceAuthority: 'metahub-source' }
}

export const classifyPlacementLineage = (sourceWidgetId: string | null | undefined, sourceBaseWidgetId: string | null | undefined) => {
    const sourceId = sourceWidgetId ?? null
    const baseId = sourceBaseWidgetId ?? null
    return getPlacementLineageState({ sourceBaseWidgetId: baseId ?? sourceId })
}

export const resolvePlacementBindingValidation = (
    widgetKey: string,
    rendererConfig: unknown,
    sourceLinked: boolean,
    bindingsInheritedFromBase = false
): { requireBindings: boolean; rejectBindings: boolean } => {
    const policy = resolvePlacementBindingPolicy(widgetKey, rendererConfig)
    if (sourceLinked && (policy.sourceAuthority !== 'metahub-source' || !policy.inheritBindings)) {
        return { requireBindings: false, rejectBindings: true }
    }
    return {
        requireBindings: policy.sourceMode === 'required' && !bindingsInheritedFromBase,
        rejectBindings: bindingsInheritedFromBase || policy.sourceMode === 'none' || policy.sourceMode === 'specialized'
    }
}

export interface PlacementGraphValidationOptions {
    effectiveGraph?: boolean
    resolveRegistryDefinition?: PlacementRegistryResolver
}

export interface DecodedPlacementWidgetConfig {
    rendererConfig: Record<string, unknown>
    neutral: ReturnType<typeof decodeLayoutWidgetConfigEnvelope>['neutral']
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const placementGraphIdentifierSchema = z.string().trim().min(1)

const parseRendererConfig = (widgetKey: string, rendererConfig: Record<string, unknown>): Record<string, unknown> => {
    if (Object.prototype.hasOwnProperty.call(rendererConfig, 'instanceKey')) {
        throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_IDENTITY_FORBIDDEN')
    }
    return parseApplicationLayoutWidgetConfig(widgetKey, rendererConfig)
}

export const parsePlacementRendererConfig = (widgetKey: string, rendererConfig: unknown): Record<string, unknown> => {
    if (!isRecord(rendererConfig)) throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_INVALID')
    return parseRendererConfig(widgetKey, rendererConfig)
}

export const decodePlacementWidgetConfigEnvelope = (
    value: unknown,
    options: {
        templateKey: ApplicationTemplateKey
        widgetKey: string
        zone: string
        instanceKey: string
        requireBindings?: boolean
    }
): DecodedPlacementWidgetConfig => {
    if (!isRecord(value)) throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_INVALID')
    if (Object.prototype.hasOwnProperty.call(value, 'instanceKey')) {
        throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_IDENTITY_FORBIDDEN')
    }
    applicationLayoutWidgetPlacementFieldsSchema.shape.instanceKey.parse(options.instanceKey)
    const decoded = decodeLayoutWidgetConfigEnvelope(value, {
        templateKey: options.templateKey,
        widgetKey: options.widgetKey,
        zone: options.zone,
        requireBindings: options.requireBindings
    })
    return {
        rendererConfig: parseRendererConfig(options.widgetKey, decoded.rendererConfig),
        neutral: decoded.neutral
    }
}

const readContainerSlots = (
    node: PlacementGraphNode,
    definition: PlacementRegistryDefinition,
    container: NonNullable<NonNullable<PlacementRegistryDefinition['composition']>['container']>
): Set<string> => {
    const field = container.kind === 'columns' ? 'columns' : 'tabs'
    const rawSlots = node.rendererConfig[field]
    if (!Array.isArray(rawSlots)) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
    const declared = new Set<string>()
    const matchingDefinition = container.slots
    for (const slot of rawSlots) {
        if (!isRecord(slot) || typeof slot.slotKey !== 'string') throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        const slotKey = slot.slotKey
        if (declared.has(slotKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        const policy = matchingDefinition.find((candidate) => slotKey.startsWith(candidate.slotPrefix))
        if (!policy) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        const suffix = slotKey.slice(policy.slotPrefix.length)
        let validSuffix = false
        try {
            validSuffix = new RegExp(policy.slotKeyPattern).test(suffix)
        } catch {
            throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_INVALID')
        }
        if (!validSuffix) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        declared.add(slotKey)
    }
    const limits = matchingDefinition.reduce((total, slot) => ({ min: total.min + slot.minSlots, max: total.max + slot.maxSlots }), {
        min: 0,
        max: 0
    })
    if (declared.size < limits.min || declared.size > limits.max) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
    if (definition.key !== node.widgetKey) throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_INVALID')
    return declared
}

export const validatePlacementGraph = (nodes: readonly PlacementGraphNode[], options: PlacementGraphValidationOptions = {}): void => {
    const nodeById = new Map<string, PlacementGraphNode>()
    const instanceKeysByLayout = new Map<string, Set<string>>()
    const effectiveInstanceKeys = new Set<string>()

    for (const node of nodes) {
        const id = placementGraphIdentifierSchema.parse(node.id)
        const layoutId = placementGraphIdentifierSchema.parse(node.layoutId)
        const placement = applicationLayoutWidgetPlacementSchema.parse({
            instanceKey: node.instanceKey,
            parentWidgetId: node.parentWidgetId,
            slotKey: node.slotKey
        })
        if (nodeById.has(id)) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        if (!isRecord(node.rendererConfig) || Object.prototype.hasOwnProperty.call(node.rendererConfig, 'instanceKey')) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_IDENTITY_FORBIDDEN')
        }
        const normalizedNode = { ...node, id, layoutId, ...placement }
        nodeById.set(id, normalizedNode)
        const keys = instanceKeysByLayout.get(layoutId) ?? new Set<string>()
        if (keys.has(placement.instanceKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
        keys.add(placement.instanceKey)
        instanceKeysByLayout.set(layoutId, keys)
        if (options.effectiveGraph) {
            if (effectiveInstanceKeys.has(placement.instanceKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
            effectiveInstanceKeys.add(placement.instanceKey)
        }
        const registryDefinition = options.resolveRegistryDefinition?.(node.widgetKey)
        if (registryDefinition) {
            if (
                registryDefinition.key !== node.widgetKey ||
                !registryDefinition.supportedTemplates.includes(node.templateKey) ||
                !registryDefinition.allowedZonesByTemplate[node.templateKey]?.includes(node.zone)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_INVALID')
            }
        } else if (options.resolveRegistryDefinition && normalizedNode.parentWidgetId === null && !registryDefinition) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_INVALID')
        }
    }

    for (const node of nodeById.values()) {
        if (node.parentWidgetId === null) continue
        const parent = nodeById.get(node.parentWidgetId)
        if (!parent || parent.layoutId !== node.layoutId || parent.id === node.id) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        }
        const resolveDefinition = options.resolveRegistryDefinition
        const parentDefinition = resolveDefinition?.(parent.widgetKey)
        const childDefinition = resolveDefinition?.(node.widgetKey)
        if (!parentDefinition || !childDefinition) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_REGISTRY_POLICY_UNAVAILABLE')
        }
        const container = parentDefinition.composition?.container
        if (!container || container.childrenAreFirstClassPlacements !== true) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_PARENT_NOT_CONTAINER')
        }
        const parentSlots = readContainerSlots(parent, parentDefinition, container)
        if (!node.slotKey || !parentSlots.has(node.slotKey)) throw new Error('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')
        const slotPolicy = container.slots.find((candidate) => node.slotKey?.startsWith(candidate.slotPrefix))
        if (!slotPolicy || !childDefinition.capabilities.some((capability) => slotPolicy.allowedChildCapabilities.includes(capability))) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_CHILD_INCOMPATIBLE')
        }
        if (parent.templateKey !== node.templateKey || parent.zone !== node.zone) {
            throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        }
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string): void => {
        if (visiting.has(id)) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
        if (visited.has(id)) return
        visiting.add(id)
        const parentId = nodeById.get(id)?.parentWidgetId
        if (parentId !== null && parentId !== undefined) visit(parentId)
        visiting.delete(id)
        visited.add(id)
    }
    for (const id of nodeById.keys()) visit(id)
}

export const semanticParentInstanceKey = (
    node: Pick<PlacementGraphNode, 'parentWidgetId'>,
    instanceKeyById: ReadonlyMap<string, string>
): string | null => {
    if (node.parentWidgetId === null) return null
    const parentInstanceKey = instanceKeyById.get(node.parentWidgetId)
    if (!parentInstanceKey) throw new Error('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
    return parentInstanceKey
}
