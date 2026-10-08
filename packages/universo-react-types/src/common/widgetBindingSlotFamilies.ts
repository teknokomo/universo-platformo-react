import { z } from 'zod'

import type {
    WidgetBindingDefinitionContract,
    WidgetBindingSelector,
    WidgetBindingSlotDefinition,
    WidgetEntityBindingEnvelope
} from './widgetBindings'

export interface WidgetBindingSlotFamilyDefinitionContract {
    readonly familyKey: string
    readonly slotPrefix: string
    readonly memberKeyPattern: string
    readonly selectorKinds: readonly WidgetBindingSelector['kind'][]
    readonly cardinality: WidgetBindingSlotDefinition['cardinality']
    readonly maxMembers: number
    readonly requirements: WidgetBindingSlotDefinition['requirements']
    readonly relation: NonNullable<WidgetBindingSlotDefinition['relation']>
}

interface WidgetBindingSlotFamilyDependencies {
    readonly parseSlotKey: (slotKey: string) => unknown
    readonly parseSlotDefinition: (input: unknown) => WidgetBindingSlotDefinition
    readonly parseBindingEnvelope: (input: unknown) => WidgetEntityBindingEnvelope
    readonly maxMembers: number
}

type ExpandedFamilySlotDefinition = WidgetBindingSlotDefinition & {
    readonly [expandedFamilySlotMarker]?: string
}

const expandedFamilySlotMarker = Symbol('expandedWidgetBindingFamilySlot')

const bindingContractError = (path: (string | number)[], message: string): z.ZodError =>
    new z.ZodError([{ code: z.ZodIssueCode.custom, path, message }])

/** Create family slot operations using the binding schemas owned by widgetBindings. */
export const createWidgetBindingSlotFamilyHandlers = (dependencies: WidgetBindingSlotFamilyDependencies) => {
    const matchingBindingSlotFamilies = (
        definition: WidgetBindingDefinitionContract,
        slotKey: string
    ): readonly WidgetBindingSlotFamilyDefinitionContract[] =>
        (definition.bindingSlotFamilies ?? []).filter((family) => slotKey.startsWith(family.slotPrefix))

    const validateBindingSlotFamily = (
        definition: WidgetBindingDefinitionContract,
        family: WidgetBindingSlotFamilyDefinitionContract,
        slotKey: string
    ): WidgetBindingSlotDefinition => {
        const memberKey = slotKey.slice(family.slotPrefix.length)
        let memberPattern: RegExp
        try {
            memberPattern = new RegExp(`^(?:${family.memberKeyPattern})$`, 'u')
        } catch {
            throw bindingContractError(
                ['bindingSlotFamilies', family.familyKey, 'memberKeyPattern'],
                'Binding slot family pattern is invalid.'
            )
        }
        if (!memberKey || !memberPattern.test(memberKey)) {
            throw bindingContractError(['slot', slotKey], 'Binding slot family member key is invalid.')
        }
        if (!Number.isInteger(family.maxMembers) || family.maxMembers < 1 || family.maxMembers > dependencies.maxMembers) {
            throw bindingContractError(
                ['bindingSlotFamilies', family.familyKey, 'maxMembers'],
                'Binding slot family member limit is invalid.'
            )
        }
        const base = definition.bindingSlots?.find((slot) => slot.key === family.familyKey)
        if (!base) {
            throw bindingContractError(
                ['bindingSlotFamilies', family.familyKey, 'familyKey'],
                'Binding slot family has no registered base slot contract.'
            )
        }
        const resolvedBase = dependencies.parseSlotDefinition({
            ...base,
            key: family.familyKey,
            selectorKinds: [...family.selectorKinds],
            cardinality: family.cardinality,
            requirements: family.requirements,
            relation: family.relation
        })
        const resolved = { ...resolvedBase, key: slotKey } as ExpandedFamilySlotDefinition
        Object.defineProperty(resolved, expandedFamilySlotMarker, { value: family.familyKey, enumerable: false })
        return resolved
    }

    const parseBindingSlotDefinition = (slot: WidgetBindingSlotDefinition): WidgetBindingSlotDefinition => {
        const expandedFamilyKey = (slot as ExpandedFamilySlotDefinition)[expandedFamilySlotMarker]
        if (!expandedFamilyKey) return dependencies.parseSlotDefinition(slot)
        const parsed = dependencies.parseSlotDefinition({ ...slot, key: expandedFamilyKey })
        return { ...parsed, key: slot.key }
    }

    /** Resolve one static or family member slot from the shared widget binding contract. */
    const resolveWidgetBindingSlotDefinition = (
        definition: WidgetBindingDefinitionContract,
        slotKey: string
    ): WidgetBindingSlotDefinition | undefined => {
        dependencies.parseSlotKey(slotKey)
        const explicit = definition.bindingSlots?.find((slot) => slot.key === slotKey) as ExpandedFamilySlotDefinition | undefined
        const families = matchingBindingSlotFamilies(definition, slotKey)
        if (families.length > 1) {
            throw bindingContractError(['slot', slotKey], 'Binding slot matches more than one registered family.')
        }
        if (families.length === 0) return explicit

        const family = families[0]
        if (explicit) {
            if (explicit[expandedFamilySlotMarker] === family.familyKey) return explicit
            throw bindingContractError(['slot', slotKey], 'Binding slot collides with a registered family member.')
        }
        return validateBindingSlotFamily(definition, family, slotKey)
    }

    /**
     * Expand only family members that are present in the persisted binding envelope.
     * The operation is idempotent for definitions previously expanded by this helper.
     */
    const expandWidgetBindingSlotFamilies = <Definition extends WidgetBindingDefinitionContract>(
        definition: Definition,
        input: unknown
    ): Definition & { readonly bindingSlots: readonly WidgetBindingSlotDefinition[] } => {
        const bindings = dependencies.parseBindingEnvelope(input)
        const familyCounts = new Map<WidgetBindingSlotFamilyDefinitionContract, number>()
        const expanded: WidgetBindingSlotDefinition[] = []

        for (const binding of bindings.slots) {
            const families = matchingBindingSlotFamilies(definition, binding.slot)
            if (families.length === 0) continue
            if (families.length > 1) {
                throw bindingContractError(['slot', binding.slot], 'Binding slot matches more than one registered family.')
            }
            const family = families[0]
            const count = (familyCounts.get(family) ?? 0) + 1
            familyCounts.set(family, count)
            if (count > family.maxMembers) {
                throw bindingContractError(
                    ['bindingSlotFamilies', family.familyKey],
                    'Binding slot family exceeds its registered member limit.'
                )
            }
            const slot = resolveWidgetBindingSlotDefinition(definition, binding.slot)
            if (!slot) {
                throw bindingContractError(['slot', binding.slot], 'Binding slot family member is not registered.')
            }
            if (!(definition.bindingSlots ?? []).some(({ key }) => key === slot.key)) expanded.push(slot)
        }

        return { ...definition, bindingSlots: [...(definition.bindingSlots ?? []), ...expanded] }
    }

    return {
        expandWidgetBindingSlotFamilies,
        parseBindingSlotDefinition,
        resolveWidgetBindingSlotDefinition
    }
}
