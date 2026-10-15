import type {
    WidgetBindingEntityCompatibilityContext,
    WidgetBindingEntityComponentMetadata,
    WidgetBindingPolicyRequirement,
    WidgetBindingPolicySlot
} from './widgetBindingPolicyTypes'

export const matchesWidgetBindingRelationParent = (
    slot: WidgetBindingPolicySlot,
    requirement: WidgetBindingPolicyRequirement,
    component: WidgetBindingEntityComponentMetadata,
    context: WidgetBindingEntityCompatibilityContext
): boolean => {
    const parent = context.relationParent
    return Boolean(
        slot.relation &&
            slot.selectorKinds.length === 1 &&
            slot.selectorKinds[0] === 'relation-set' &&
            slot.relation.field === requirement.field &&
            requirement.valueType === 'ref' &&
            parent?.kind === 'object' &&
            parent.id.length > 0 &&
            component.targetObjectId === parent.id &&
            component.targetObjectKind === parent.kind &&
            component.targetObjectCodename === parent.codename
    )
}

export const isWidgetBindingRelationTargetCompatible = (
    slot: WidgetBindingPolicySlot,
    componentsByCodename: ReadonlyMap<string, WidgetBindingEntityComponentMetadata>,
    context: WidgetBindingEntityCompatibilityContext
): boolean => {
    if (!slot.relation) return true
    const requirement = slot.requirements.components.find(({ field }) => field === slot.relation?.field)
    const component = requirement ? componentsByCodename.get(requirement.componentCodename) : undefined
    return Boolean(requirement && component && matchesWidgetBindingRelationParent(slot, requirement, component, context))
}

const serverOwnedStructuralComponentCodenamesByEntityAndRole: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
    Courses: { order: ['SortOrder'] },
    LearningTracks: { order: ['SortOrder'] },
    Quizzes: { order: ['SortOrder'] },
    AccessLinks: { parent: ['TargetId'], order: ['SortOrder'] },
    CourseItems: { parent: ['CourseId'], order: ['SortOrder'] },
    CourseSections: { parent: ['CourseId'], order: ['SortOrder'] },
    TrackStages: { parent: ['TrackId'], order: ['SortOrder'] },
    TrackSteps: { parent: ['TrackId'], order: ['SortOrder'] }
}

export const isTrustedServerOwnedStructuralComponent = (
    slot: WidgetBindingPolicySlot,
    requirement: WidgetBindingPolicyRequirement,
    entityCodename: string,
    component: WidgetBindingEntityComponentMetadata,
    context: WidgetBindingEntityCompatibilityContext
): boolean => {
    const uiConfigValue = component.uiConfig
    if (
        requirement.allowServerOwnedRead !== true ||
        typeof uiConfigValue !== 'object' ||
        uiConfigValue === null ||
        Array.isArray(uiConfigValue)
    ) {
        return false
    }

    const uiConfig = uiConfigValue as Record<string, unknown>
    if (uiConfig.serverOwned !== true) return false

    const isRegisteredStructuralField =
        serverOwnedStructuralComponentCodenamesByEntityAndRole[entityCodename]?.[requirement.field]?.includes(
            requirement.componentCodename
        ) ?? false
    const isRelationParentRequirement =
        requirement.field === 'parent' && matchesWidgetBindingRelationParent(slot, requirement, component, context)
    const isRelationScopedOrderRequirement =
        requirement.field === 'order' &&
        requirement.valueType === 'number' &&
        requirement.requireServerOwned === true &&
        slot.selectorKinds.length === 1 &&
        slot.selectorKinds[0] === 'relation-set' &&
        slot.relation !== undefined &&
        slot.orderByField === requirement.field

    if (requirement.field === 'parent' && requirement.valueType === 'ref') {
        return isRelationParentRequirement && (isRegisteredStructuralField || requirement.requireServerOwned === true)
    }
    if (requirement.field === 'order' && requirement.valueType === 'number') {
        return isRegisteredStructuralField || isRelationScopedOrderRequirement
    }

    return isRegisteredStructuralField
}

export const isSafeWidgetBindingComponentUiConfig = (
    component: WidgetBindingEntityComponentMetadata,
    requirement: WidgetBindingPolicyRequirement,
    entityCodename: string,
    slot: WidgetBindingPolicySlot,
    context: WidgetBindingEntityCompatibilityContext
): boolean => {
    const value = component.uiConfig
    if (value === undefined || value === null) return requirement.requireServerOwned !== true
    if (typeof value !== 'object' || Array.isArray(value)) return false

    const uiConfig = value as Record<string, unknown>
    return (
        uiConfig.sensitive !== true &&
        uiConfig.private !== true &&
        (uiConfig.serverOwned !== true || isTrustedServerOwnedStructuralComponent(slot, requirement, entityCodename, component, context))
    )
}
