import { z } from 'zod'
import {
    DASHBOARD_LAYOUT_WIDGETS,
    dashboardWidgetConfigSchemaByKey,
    effectiveWidgetRuntimeDataSchema,
    effectiveLayoutParentageSchema,
    type EffectiveWidgetRuntimeData,
    uuidV7Schema
} from '@universo-react/types'

export const runtimeWidgetDataSchema = effectiveWidgetRuntimeDataSchema
export type RuntimeWidgetData = EffectiveWidgetRuntimeData
export type RuntimeWidgetPayload = Extract<EffectiveWidgetRuntimeData, { status: 'ready' }>['data']

export const runtimePlacementSchema = z
    .object({
        id: uuidV7Schema,
        instanceKey: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u),
        layoutId: z.string().uuid().optional(),
        widgetKey: z.string().trim().min(1).max(128),
        zone: z.enum(['left', 'top', 'right', 'bottom', 'center']),
        sortOrder: z.number().int(),
        config: z.record(z.string(), z.unknown()),
        isActive: z.boolean(),
        parentInstanceKey: z.string().trim().min(1).max(128).nullable(),
        slotKey: z.string().trim().min(1).max(64).nullable(),
        runtimeData: runtimeWidgetDataSchema.optional()
    })
    .strict()
    .superRefine((placement, context) => {
        if (
            !effectiveLayoutParentageSchema.safeParse({ parentInstanceKey: placement.parentInstanceKey, slotKey: placement.slotKey })
                .success
        ) {
            context.addIssue({ code: z.ZodIssueCode.custom, path: ['slotKey'], message: 'Nested placements require both parent and slot.' })
        }
        const configSchema = dashboardWidgetConfigSchemaByKey[placement.widgetKey as keyof typeof dashboardWidgetConfigSchemaByKey]
        if (!configSchema || !configSchema.safeParse(placement.config).success) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config'],
                message: 'Widget configuration does not match its registered contract.'
            })
        }
    })

export type RuntimePlacement = z.infer<typeof runtimePlacementSchema>

const widgetDefinition = (key: string) => DASHBOARD_LAYOUT_WIDGETS.find((widget) => widget.key === key)

function getDeclaredSlot(parent: RuntimePlacement, slotKey: string | null) {
    const definition = widgetDefinition(parent.widgetKey)
    const container = definition?.composition?.container
    if (!slotKey || !container) return undefined
    return container.slots.find((slot) => {
        if (!slotKey.startsWith(slot.slotPrefix)) return false
        const suffix = slotKey.slice(slot.slotPrefix.length)
        if (!new RegExp(slot.slotKeyPattern, 'u').test(suffix)) return false
        const descriptors = parent.config[container.kind === 'columns' ? 'columns' : 'tabs']
        return Boolean(
            Array.isArray(descriptors) &&
                descriptors.some(
                    (item) =>
                        item !== null &&
                        typeof item === 'object' &&
                        !Array.isArray(item) &&
                        (item as { slotKey?: unknown }).slotKey === slotKey
                )
        )
    })
}

export function hasDeclaredSlot(parent: RuntimePlacement, slotKey: string | null): boolean {
    return getDeclaredSlot(parent, slotKey) !== undefined
}

export const runtimePlacementGraphSchema = z
    .array(runtimePlacementSchema)
    .max(512)
    .superRefine((placements, context) => {
        const byInstanceKey = new Map<string, number>()
        placements.forEach((placement, index) => {
            if (byInstanceKey.has(placement.instanceKey)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'instanceKey'],
                    message: 'Placement instance keys must be unique.'
                })
            }
            byInstanceKey.set(placement.instanceKey, index)
        })

        placements.forEach((placement, index) => {
            if (placement.parentInstanceKey === null) return
            const parentIndex = byInstanceKey.get(placement.parentInstanceKey)
            if (parentIndex === undefined) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'parentInstanceKey'],
                    message: 'Placement parent is unavailable.'
                })
                return
            }
            const parent = placements[parentIndex]
            const childDefinition = widgetDefinition(placement.widgetKey)
            const declaredSlot = getDeclaredSlot(parent, placement.slotKey)
            const compatible = (childDefinition?.capabilities ?? []).some((capability) =>
                declaredSlot?.allowedChildCapabilities.includes(capability)
            )
            if (parent.zone !== placement.zone || !compatible || !declaredSlot) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: [index, 'parentInstanceKey'],
                    message: 'Placement parent or slot is incompatible.'
                })
            }

            const visited = new Set([placement.instanceKey])
            let current: RuntimePlacement | undefined = parent
            while (current) {
                if (visited.has(current.instanceKey)) {
                    context.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [index, 'parentInstanceKey'],
                        message: 'Placement graph cannot contain cycles.'
                    })
                    break
                }
                visited.add(current.instanceKey)
                current = current.parentInstanceKey === null ? undefined : placements[byInstanceKey.get(current.parentInstanceKey) ?? -1]
            }
        })
    })

export function childrenForSlot(graph: readonly RuntimePlacement[], parentInstanceKey: string, slotKey: string): RuntimePlacement[] {
    return graph
        .filter((placement) => placement.isActive && placement.parentInstanceKey === parentInstanceKey && placement.slotKey === slotKey)
        .sort((left, right) => left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey))
}

export function rootPlacements(graph: readonly RuntimePlacement[], zone: RuntimePlacement['zone']): RuntimePlacement[] {
    const roots = graph
        .filter(
            (placement) =>
                placement.isActive &&
                placement.zone === zone &&
                placement.parentInstanceKey === null &&
                widgetDefinition(placement.widgetKey)?.allowedZones.includes(placement.zone)
        )
        .sort((left, right) => left.sortOrder - right.sortOrder || left.instanceKey.localeCompare(right.instanceKey))

    const allRoots = graph.filter(
        (placement) =>
            placement.isActive &&
            placement.parentInstanceKey === null &&
            widgetDefinition(placement.widgetKey)?.allowedZones.includes(placement.zone)
    )
    const singletonWinners = new Map<string, RuntimePlacement>()
    allRoots.forEach((placement) => {
        const definition = widgetDefinition(placement.widgetKey)
        if (definition?.multiInstance !== false) return

        const current = singletonWinners.get(placement.widgetKey)
        const placementAllowedZoneIndex = definition.allowedZones.indexOf(placement.zone)
        const allowedZoneRank = placementAllowedZoneIndex < 0 ? definition.allowedZones.length : placementAllowedZoneIndex
        const currentAllowedZoneIndex = current ? definition.allowedZones.indexOf(current.zone) : -1
        const currentAllowedZoneRank = currentAllowedZoneIndex < 0 ? definition.allowedZones.length : currentAllowedZoneIndex
        if (
            !current ||
            allowedZoneRank < currentAllowedZoneRank ||
            (allowedZoneRank === currentAllowedZoneRank &&
                (placement.sortOrder < current.sortOrder ||
                    (placement.sortOrder === current.sortOrder && placement.instanceKey.localeCompare(current.instanceKey) < 0)))
        ) {
            singletonWinners.set(placement.widgetKey, placement)
        }
    })

    return roots.filter((placement) => {
        const definition = widgetDefinition(placement.widgetKey)
        return definition?.multiInstance !== false || singletonWinners.get(placement.widgetKey)?.id === placement.id
    })
}
