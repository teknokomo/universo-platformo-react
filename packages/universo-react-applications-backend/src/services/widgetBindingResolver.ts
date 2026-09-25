import {
    validateWidgetBindings,
    type WidgetBindingTarget,
    type WidgetBindingDefinitionContract,
    type WidgetEntityBindingEnvelope
} from '@universo-react/types'

export type WidgetBindingRecord = Record<string, unknown>

/** Runtime record access is injected so the resolver never constructs SQL. */
export type WidgetBindingRecordLoader = (target: WidgetBindingTarget) => readonly WidgetBindingRecord[]

export type ResolvedWidgetBindingTarget = {
    slot: string
    entityKind: WidgetBindingTarget['entityKind']
    entityCodename: string
    semanticKey: string
    data: WidgetBindingRecord
}

export class WidgetBindingResolutionError extends Error {
    constructor(
        public readonly reason: 'invalid-contract' | 'target-unavailable' | 'projection-invalid',
        message = 'Widget Entity binding could not be resolved'
    ) {
        super(message)
        this.name = 'WidgetBindingResolutionError'
    }
}

/**
 * Resolve registry-declared bindings to bounded semantic data. Persistence,
 * authorization, metadata checks, and physical table access stay in loaders.
 */
export const resolveWidgetBindingTargets = (
    definition: WidgetBindingDefinitionContract,
    rawBindings: unknown,
    loadRecords: WidgetBindingRecordLoader
): ResolvedWidgetBindingTarget[] => {
    let bindings: ReturnType<typeof validateWidgetBindings>
    try {
        bindings = validateWidgetBindings(definition, rawBindings)
    } catch {
        throw new WidgetBindingResolutionError('invalid-contract')
    }

    return resolveValidatedWidgetBindingTargets(definition, bindings, loadRecords)
}

/** Resolve bindings already validated at the caller's trust boundary. */
export const resolveValidatedWidgetBindingTargets = (
    definition: WidgetBindingDefinitionContract,
    bindings: WidgetEntityBindingEnvelope,
    loadRecords: WidgetBindingRecordLoader
): ResolvedWidgetBindingTarget[] => {
    const slotDefinitions = new Map((definition.bindingSlots ?? []).map((slot) => [slot.key, slot]))
    return bindings.slots.flatMap((slot) => {
        const slotDefinition = slotDefinitions.get(slot.slot)
        if (!slotDefinition) throw new WidgetBindingResolutionError('invalid-contract')

        return slot.targets.map((target) => {
            const selectorProjection = target.projection.find(({ field }) => field === target.selector.field)
            if (!selectorProjection) throw new WidgetBindingResolutionError('projection-invalid')

            const rows = loadRecords(target)
            const matches = rows.filter((row) => row[selectorProjection.componentCodename] === target.selector.value)
            if (matches.length !== 1) throw new WidgetBindingResolutionError('target-unavailable')

            const row = matches[0]
            const data: WidgetBindingRecord = {}
            for (const projection of target.projection) {
                const value = row[projection.componentCodename]
                const requirement = slotDefinition.requirements.components.find(({ field }) => field === projection.field)
                if (value === undefined || value === null) {
                    if (requirement?.required) throw new WidgetBindingResolutionError('target-unavailable')
                    continue
                }
                data[projection.field] = value
            }
            if (data[target.selector.field] !== target.selector.value) {
                throw new WidgetBindingResolutionError('target-unavailable')
            }

            return {
                slot: slot.slot,
                entityKind: target.entityKind,
                entityCodename: target.entityCodename,
                semanticKey: target.selector.value,
                data
            }
        })
    })
}
