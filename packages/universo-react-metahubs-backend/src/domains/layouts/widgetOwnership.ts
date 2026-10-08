import { getLayoutWidgetDefinition, type ApplicationTemplateKey, type LayoutWidgetDefinition } from '@universo-react/types'
import { MetahubValidationError } from '../shared/domainErrors'

/** Registry metadata consumed by layout lifecycle and binding services. */
export type LayoutWidgetOwnershipDefinition = Omit<LayoutWidgetDefinition, 'sourcePolicy'> & {
    readonly sourcePolicy: {
        readonly authority: 'local' | 'metahub-source'
        readonly sourceMode: 'none' | 'optional' | 'required' | 'specialized'
        readonly inheritBindings: boolean
        readonly inheritComposition: boolean
    }
    readonly identity: { readonly instanceKey: 'required' }
    readonly copyPolicy: {
        readonly placement: 'none' | 'copy'
        readonly binding: 'none' | 'share-bindings' | 'clone-record'
    }
    readonly bindingSlotFamilies?: readonly {
        readonly familyKey: string
        readonly slotPrefix: string
        readonly memberKeyPattern: string
        readonly maxMembers: number
    }[]
    readonly capabilities: readonly string[]
    readonly composition?: {
        readonly sourceOwned: boolean
        readonly container?: {
            readonly kind: 'columns' | 'tabs'
            readonly slots: readonly {
                readonly slotPrefix: string
                readonly slotKeyPattern: string
                readonly minSlots: number
                readonly maxSlots: number
                readonly allowedChildCapabilities: readonly string[]
            }[]
            readonly childrenAreFirstClassPlacements: true
        }
    }
}

export type LayoutWidgetSourceAuthority = 'local' | 'metahub-source' | 'specialized-runtime'

export interface LayoutWidgetPlacementPolicy {
    readonly canDeactivate: boolean
    readonly canExclude: boolean
    readonly canChangeZone: boolean
    readonly canReorder: boolean
    readonly canChangeParentSlot: boolean
}

export interface LayoutWidgetLineage {
    readonly scopeEntityId: string | null
    readonly baseLayoutId: string | null
    readonly sourceWidgetId?: string | null
    readonly sourceBaseWidgetId?: string | null
}

/**
 * Resolve the canonical widget definition and fail closed if source ownership
 * metadata is missing. Callers must not infer ownership from template names.
 */
export const requireLayoutWidgetOwnership = (
    templateKey: ApplicationTemplateKey,
    widgetKey: string,
    config?: Record<string, unknown>
): LayoutWidgetOwnershipDefinition => {
    const definition = getLayoutWidgetDefinition(widgetKey, config)
    if (!definition || !definition.supportedTemplates.includes(templateKey)) {
        throw new MetahubValidationError('Widget is not registered for this layout template', { widgetKey, templateKey })
    }

    const ownership = definition as LayoutWidgetOwnershipDefinition
    if (
        !ownership.sourcePolicy ||
        !ownership.identity ||
        !ownership.copyPolicy ||
        ownership.identity.instanceKey !== 'required' ||
        !['local', 'metahub-source'].includes(ownership.sourcePolicy.authority) ||
        !['none', 'optional', 'required', 'specialized'].includes(ownership.sourcePolicy.sourceMode) ||
        !['none', 'copy'].includes(ownership.copyPolicy.placement) ||
        !['none', 'share-bindings', 'clone-record'].includes(ownership.copyPolicy.binding)
    ) {
        throw new MetahubValidationError('Widget source ownership metadata is invalid', { widgetKey, templateKey })
    }
    return ownership
}

/**
 * Resolve placement mutation capabilities from the canonical registry. Renderer
 * config is never an authority for inherited placement behavior.
 */
export const resolveLayoutWidgetPlacementPolicy = (definition: LayoutWidgetOwnershipDefinition): LayoutWidgetPlacementPolicy => {
    const policy = definition.applicationPlacementOverrides
    return {
        canDeactivate: policy.active,
        canExclude:
            definition.composition?.sourceOwned !== true && (policy.active || policy.order !== 'none' || policy.zone || policy.parentSlot),
        canChangeZone: policy.zone,
        canReorder: policy.order !== 'none',
        canChangeParentSlot: policy.parentSlot
    }
}

/** Reject policy values that were previously embedded in renderer config. */
export const assertNoWidgetSharedBehaviorConfig = (rendererConfig: Record<string, unknown>): void => {
    if (Object.prototype.hasOwnProperty.call(rendererConfig, 'sharedBehavior')) {
        throw new MetahubValidationError('Widget placement policy must be supplied by placement metadata')
    }
}

/**
 * Resolve which graph owns bindings and children for one placement. A scoped
 * overlay can display source-owned state, but it never becomes a second
 * binding/composition authority.
 */
export const classifyLayoutWidgetSourceAuthority = (
    definition: LayoutWidgetOwnershipDefinition,
    lineage: LayoutWidgetLineage
): LayoutWidgetSourceAuthority => {
    if (definition.sourcePolicy.sourceMode === 'specialized') return 'specialized-runtime'
    if (definition.sourcePolicy.authority === 'local') return 'local'
    if (lineage.baseLayoutId && definition.sourcePolicy.inheritBindings) return 'metahub-source'
    if (lineage.sourceWidgetId || lineage.sourceBaseWidgetId) return 'metahub-source'
    return 'metahub-source'
}

const hasSourcePlacementLineage = (lineage: LayoutWidgetLineage): boolean =>
    Boolean(lineage.baseLayoutId || lineage.sourceWidgetId || lineage.sourceBaseWidgetId)

export const layoutWidgetOwnsBindings = (definition: LayoutWidgetOwnershipDefinition, lineage: LayoutWidgetLineage): boolean =>
    definition.sourcePolicy.sourceMode !== 'none' &&
    definition.sourcePolicy.sourceMode !== 'specialized' &&
    !(hasSourcePlacementLineage(lineage) && definition.sourcePolicy.inheritBindings)

export const assertLayoutWidgetCanAuthorBindings = (definition: LayoutWidgetOwnershipDefinition, lineage: LayoutWidgetLineage): void => {
    if (
        definition.sourcePolicy.sourceMode === 'none' ||
        definition.sourcePolicy.sourceMode === 'specialized' ||
        (hasSourcePlacementLineage(lineage) && definition.sourcePolicy.inheritBindings)
    ) {
        throw new MetahubValidationError('This placement inherits or specializes its Entity bindings')
    }
}

export const assertLayoutWidgetBindingAuthority = (input: {
    readonly definition: LayoutWidgetOwnershipDefinition
    readonly lineage: LayoutWidgetLineage
    readonly hasBindings: boolean
}): void => {
    if (input.hasBindings && !layoutWidgetOwnsBindings(input.definition, input.lineage)) {
        throw new MetahubValidationError('This layout inherits Entity bindings from its source placement')
    }
}

export const layoutWidgetOwnsComposition = (definition: LayoutWidgetOwnershipDefinition, lineage: LayoutWidgetLineage): boolean =>
    definition.composition?.sourceOwned === true && !(hasSourcePlacementLineage(lineage) && definition.sourcePolicy.inheritComposition)

export const assertAllowedLayoutWidgetChild = (
    parent: LayoutWidgetOwnershipDefinition,
    child: LayoutWidgetOwnershipDefinition,
    slotKey: string
): void => {
    const slot = parent.composition?.container?.slots.find((candidate) => slotKey.startsWith(candidate.slotPrefix))
    if (!slot) throw new MetahubValidationError('Parent widget does not declare this child slot')
    const memberKey = slotKey.slice(slot.slotPrefix.length)
    if (!memberKey || !new RegExp(slot.slotKeyPattern, 'u').test(memberKey)) {
        throw new MetahubValidationError('Child placement slot key is invalid')
    }
    if (!child.capabilities.some((capability) => slot.allowedChildCapabilities.includes(capability))) {
        throw new MetahubValidationError('Child widget capability is not allowed by this parent slot')
    }
}
