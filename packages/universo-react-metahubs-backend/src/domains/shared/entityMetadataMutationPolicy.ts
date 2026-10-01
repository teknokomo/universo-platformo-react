import {
    ComponentDefinitionDataType,
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_SEMANTIC_KEY_PATTERN,
    MARKETING_TEMPLATE_ENTITY_CODENAMES,
    getLayoutWidgetDefinition,
    matchesWidgetBindingComponentValidationRules,
    resolveEntityRecordPolicy,
    sameEntityRecordPolicyConditionalRequired,
    type WidgetBindingComponentRequirement,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import { MetahubConflictError, MetahubDomainError } from './domainErrors'

type WidgetBindingComponentState = {
    codename: string
    dataType: string
    isRequired: boolean
    validationRules: unknown
    parentComponentId?: string | null
    targetEntityId?: string | null
    targetEntityKind?: string | null
}

type TemplateBindingSlotReference = {
    readonly widgetKey: string
    readonly slotKey: string
    readonly variant?: string
}

const MARKETING_TEMPLATE_PREFIX = 'MarketingPage'
const MARKETING_TEMPLATE_ROLE_BY_CODENAME = new Map<string, string>(
    MARKETING_TEMPLATE_ENTITY_CODENAMES.map((codename) => [
        codename,
        codename.slice(MARKETING_TEMPLATE_PREFIX.length, MARKETING_TEMPLATE_PREFIX.length + 1).toLowerCase() +
            codename.slice(MARKETING_TEMPLATE_PREFIX.length + 1)
    ])
)
const MARKETING_TEMPLATE_CODENAME_BY_ROLE = new Map(
    Array.from(MARKETING_TEMPLATE_ROLE_BY_CODENAME, ([codename, role]) => [role, codename] as const)
)

/** Resolve the built-in source Entities to their applicable registry slots. */
const MARKETING_TEMPLATE_BINDING_SLOTS_BY_ROLE: Readonly<Record<string, readonly TemplateBindingSlotReference[]>> = {
    hero: [{ widgetKey: 'marketing.hero', slotKey: 'content' }],
    image: [{ widgetKey: 'marketing.image', slotKey: 'content' }],
    section: [{ widgetKey: 'marketing.collection', slotKey: 'section', variant: 'logos' }],
    siteSettings: [
        { widgetKey: 'marketing.brand', slotKey: 'site' },
        { widgetKey: 'marketing.footer', slotKey: 'site' }
    ],
    logo: [{ widgetKey: 'marketing.collection', slotKey: 'items', variant: 'logos' }],
    feature: [{ widgetKey: 'marketing.collection', slotKey: 'items', variant: 'features' }],
    testimonial: [{ widgetKey: 'marketing.collection', slotKey: 'items', variant: 'testimonials' }],
    highlight: [{ widgetKey: 'marketing.collection', slotKey: 'items', variant: 'highlights' }],
    pricing: [{ widgetKey: 'marketing.pricing', slotKey: 'tiers' }],
    pricingBenefit: [{ widgetKey: 'marketing.pricing', slotKey: 'benefits' }],
    faq: [{ widgetKey: 'marketing.collection', slotKey: 'items', variant: 'faq' }],
    navigation: [{ widgetKey: 'marketing.navigation', slotKey: 'items' }],
    footerLink: [{ widgetKey: 'marketing.footer', slotKey: 'links' }]
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const getAllWidgetBindingSlots = (): WidgetBindingSlotDefinition[] =>
    LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => [
        ...(definition.bindingSlots ?? []),
        ...Object.values(definition.bindingVariants ?? {}).flat()
    ])

const REGISTERED_WIDGET_BINDING_SLOTS = getAllWidgetBindingSlots()
const REGISTERED_WIDGET_COMPONENT_REQUIREMENTS = REGISTERED_WIDGET_BINDING_SLOTS.flatMap(({ requirements }) => requirements.components)
const REGISTERED_WIDGET_COMPONENT_REQUIREMENTS_BY_CODENAME = new Map<string, WidgetBindingComponentRequirement[]>(
    REGISTERED_WIDGET_COMPONENT_REQUIREMENTS.reduce((result, requirement) => {
        const existing = result.get(requirement.componentCodename) ?? []
        existing.push(requirement)
        result.set(requirement.componentCodename, existing)
        return result
    }, new Map<string, WidgetBindingComponentRequirement[]>())
)

const getTemplateBindingSlotsForRole = (role: string): WidgetBindingSlotDefinition[] =>
    (MARKETING_TEMPLATE_BINDING_SLOTS_BY_ROLE[role] ?? []).flatMap(({ widgetKey, slotKey, variant }) => {
        const slot = getLayoutWidgetDefinition(widgetKey, variant ? { variant } : undefined)?.bindingSlots?.find(
            (candidate) => candidate.key === slotKey
        )
        return slot ? [slot] : []
    })

const sameStringSet = (left: readonly string[], right: readonly string[]): boolean =>
    left.length === right.length && left.every((value) => right.includes(value))

const sameStringGroups = (left: readonly (readonly string[])[] = [], right: readonly (readonly string[])[] = []): boolean => {
    const normalize = (groups: readonly (readonly string[])[]): string[] => groups.map((group) => [...group].sort().join('\u0000')).sort()
    const normalizedLeft = normalize(left)
    const normalizedRight = normalize(right)
    return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((group, index) => group === normalizedRight[index])
}

const policiesMatch = (
    left: NonNullable<WidgetBindingSlotDefinition['requirements']['recordPolicy']>,
    right: NonNullable<WidgetBindingSlotDefinition['requirements']['recordPolicy']>
): boolean => {
    const leftSemantic = left.semanticKey
    const rightSemantic = right.semanticKey
    return (
        left.runtimeMutation === right.runtimeMutation &&
        left.denyDeleteWhenBound === right.denyDeleteWhenBound &&
        left.immutableSemanticKeyWhenBound === right.immutableSemanticKeyWhenBound &&
        leftSemantic?.componentCodename === rightSemantic?.componentCodename &&
        leftSemantic?.creationPrefix === rightSemantic?.creationPrefix &&
        sameStringSet(leftSemantic?.protectedValues ?? [], rightSemantic?.protectedValues ?? []) &&
        sameStringSet(left.requiredLocales ?? [], right.requiredLocales ?? []) &&
        sameStringGroups(left.coRequiredGroups, right.coRequiredGroups) &&
        sameEntityRecordPolicyConditionalRequired(left.conditionalRequired, right.conditionalRequired)
    )
}

const getExpectedPoliciesForRole = (role: string): NonNullable<WidgetBindingSlotDefinition['requirements']['recordPolicy']>[] => {
    const policies = getTemplateBindingSlotsForRole(role).flatMap(({ requirements }) =>
        requirements.recordPolicy ? [requirements.recordPolicy] : []
    )

    return policies.filter((policy, index) => policies.findIndex((candidate) => policiesMatch(candidate, policy)) === index)
}

const isEntityPolicyCompatibleWithRequirement = (
    policy: ReturnType<typeof resolveEntityRecordPolicy>,
    requirement: NonNullable<WidgetBindingSlotDefinition['requirements']['recordPolicy']>
): boolean => {
    if (!policy || policy.version !== 1 || policy.runtimeMutation !== requirement.runtimeMutation) return false
    if (requirement.denyDeleteWhenBound !== undefined && policy.denyDeleteWhenBound !== requirement.denyDeleteWhenBound) {
        return false
    }
    if (
        requirement.immutableSemanticKeyWhenBound !== undefined &&
        policy.immutableSemanticKeyWhenBound !== requirement.immutableSemanticKeyWhenBound
    ) {
        return false
    }

    const expectedSemanticKey = requirement.semanticKey
    const actualSemanticKey = policy.semanticKey
    if (
        expectedSemanticKey?.componentCodename !== actualSemanticKey?.componentCodename ||
        expectedSemanticKey?.creationPrefix !== actualSemanticKey?.creationPrefix ||
        !sameStringSet(expectedSemanticKey?.protectedValues ?? [], actualSemanticKey?.protectedValues ?? [])
    ) {
        return false
    }
    if (!sameStringSet(requirement.requiredLocales ?? [], policy.requiredLocales ?? [])) return false
    return (
        sameStringGroups(requirement.coRequiredGroups, policy.coRequiredGroups) &&
        sameEntityRecordPolicyConditionalRequired(requirement.conditionalRequired, policy.conditionalRequired)
    )
}

const getTemplateBindingSlotsForPolicy = (config: unknown): WidgetBindingSlotDefinition[] => {
    try {
        const policy = resolveEntityRecordPolicy(config)
        if (!policy) return []
        return REGISTERED_WIDGET_BINDING_SLOTS.filter(({ requirements }) => {
            const requirement = requirements.recordPolicy
            return requirement !== undefined && isEntityPolicyCompatibleWithRequirement(policy, requirement)
        })
    } catch {
        return []
    }
}

const getTemplateRole = (codename: string, config: unknown): string | null => {
    const roleFromCodename = MARKETING_TEMPLATE_ROLE_BY_CODENAME.get(codename)
    if (roleFromCodename) return roleFromCodename

    const roleFromConfig = asRecord(config).marketingRole
    return typeof roleFromConfig === 'string' && MARKETING_TEMPLATE_CODENAME_BY_ROLE.has(roleFromConfig) ? roleFromConfig : null
}

const hasRegisteredBindingPolicy = (config: unknown): boolean => {
    const configured = asRecord(config)
    return Object.prototype.hasOwnProperty.call(configured, 'recordPolicy') && getTemplateBindingSlotsForPolicy(config).length > 0
}

const expectedComponentDataTypes: Readonly<Record<WidgetBindingComponentRequirement['valueType'], readonly string[]>> = {
    string: [ComponentDefinitionDataType.STRING, 'TEXT', 'VARCHAR'],
    number: [ComponentDefinitionDataType.NUMBER, 'NUMERIC', 'INTEGER', 'DECIMAL'],
    boolean: [ComponentDefinitionDataType.BOOLEAN],
    json: [ComponentDefinitionDataType.JSON, 'JSONB'],
    ref: [ComponentDefinitionDataType.REF, 'UUID']
}

const isComponentCompatibleWithRequirement = (
    component: WidgetBindingComponentState,
    requirement: WidgetBindingComponentRequirement
): boolean => {
    const dataType = component.dataType.trim().toUpperCase()
    const rules = asRecord(component.validationRules)

    return (
        expectedComponentDataTypes[requirement.valueType].includes(dataType) &&
        component.isRequired === requirement.required &&
        matchesWidgetBindingComponentValidationRules(requirement, component.validationRules) &&
        (requirement.semanticKey !== true || rules.pattern === MARKETING_SEMANTIC_KEY_PATTERN.source)
    )
}

const rejectWidgetBindingComponentMutation = (): never => {
    throw new MetahubDomainError({
        message: 'This Component is part of a registered widget binding contract and cannot be changed in a way that invalidates bindings.',
        statusCode: 409,
        code: 'ENTITY_COMPONENT_SCHEMA_PROTECTED'
    })
}

/** True when the codename is required by any registered widget source slot. */
export const isWidgetBindingComponentCodename = (codename: string): boolean =>
    REGISTERED_WIDGET_COMPONENT_REQUIREMENTS_BY_CODENAME.has(codename)

/** True for seeded Marketing Page source Entities and Entities using a registered source policy. */
export const isWidgetBindingEntityMetadata = (codename: string, config: unknown): boolean =>
    getTemplateRole(codename, config) !== null || hasRegisteredBindingPolicy(config)

export const isMarketingTemplateEntityMetadata = (codename: string, config: unknown): boolean => getTemplateRole(codename, config) !== null

/** Keep bound Entity Components compatible with every registry-declared source contract. */
export const assertWidgetBindingComponentMutation = ({
    entityCodename,
    entityConfig,
    isBound,
    bindingSlots,
    current,
    next,
    operation
}: {
    entityCodename: string
    entityConfig: unknown
    isBound: boolean
    bindingSlots?: readonly WidgetBindingSlotDefinition[]
    current: WidgetBindingComponentState
    next?: WidgetBindingComponentState
    operation: 'update' | 'delete' | 'set-display' | 'move'
}): void => {
    const templateManaged = getTemplateRole(entityCodename, entityConfig) !== null
    if (!templateManaged && !isBound) return

    if (templateManaged) {
        assertEntityMetadataSecurityUpdate({ codename: entityCodename, config: entityConfig })
    }

    const effectiveSlots = templateManaged
        ? getTemplateBindingSlotsForRole(getTemplateRole(entityCodename, entityConfig)!)
        : bindingSlots && bindingSlots.length > 0
        ? [...bindingSlots]
        : getTemplateBindingSlotsForPolicy(entityConfig)
    if (effectiveSlots.length === 0) {
        throw new MetahubConflictError('The Entity source binding contract could not be resolved safely.')
    }

    const relationReferenceComponent = effectiveSlots.some(
        ({ relation, requirements }) =>
            relation &&
            requirements.components.some(
                (requirement) => requirement.componentCodename === current.codename && requirement.valueType === 'ref'
            )
    )
    if (
        operation === 'update' &&
        next &&
        relationReferenceComponent &&
        (current.targetEntityId !== next.targetEntityId || current.targetEntityKind !== next.targetEntityKind)
    ) {
        rejectWidgetBindingComponentMutation()
    }

    const requirementsByCodename = new Map<string, WidgetBindingComponentRequirement[]>()
    for (const requirement of effectiveSlots.flatMap(({ requirements }) => requirements.components)) {
        const requirementsForComponent = requirementsByCodename.get(requirement.componentCodename) ?? []
        requirementsForComponent.push(requirement)
        requirementsByCodename.set(requirement.componentCodename, requirementsForComponent)
    }
    const currentRequirements = requirementsByCodename.get(current.codename) ?? []
    const nextRequirements = next
        ? (requirementsByCodename.get(next.codename) ?? []).filter((requirement) => isComponentCompatibleWithRequirement(next, requirement))
        : []

    if (operation === 'delete' && currentRequirements.length > 0) rejectWidgetBindingComponentMutation()
    if (currentRequirements.length > 0 && (next?.codename !== current.codename || nextRequirements.length !== currentRequirements.length)) {
        rejectWidgetBindingComponentMutation()
    }
    if (!next || nextRequirements.length === 0) {
        if (currentRequirements.length > 0 && operation !== 'delete') rejectWidgetBindingComponentMutation()
        return
    }

    if (
        nextRequirements.length !== (requirementsByCodename.get(next.codename)?.length ?? 0) ||
        ((operation === 'move' || operation === 'update') && next.parentComponentId != null) ||
        (operation === 'set-display' && nextRequirements.every(({ required }) => !required))
    ) {
        rejectWidgetBindingComponentMutation()
    }
}

export const isEntityMetadataPolicyManaged = (codename: string, config: unknown): boolean => {
    const values = asRecord(config)
    return Object.prototype.hasOwnProperty.call(values, 'recordPolicy') || getTemplateRole(codename, config) !== null
}

/**
 * Protect server-owned record policies and stable source identities from the
 * generic Entity metadata endpoint. Content editors can still update names
 * and descriptions; policy and binding changes require dedicated operations.
 */
export const assertEntityMetadataSecurityUpdate = ({
    codename,
    config,
    nextCodename,
    configPatch
}: {
    codename: string
    config: unknown
    nextCodename?: string
    configPatch?: unknown
}): void => {
    const currentConfig = asRecord(config)
    const patch = asRecord(configPatch)
    const templateRole = getTemplateRole(codename, config)
    const expectedTemplateCodename = templateRole ? MARKETING_TEMPLATE_CODENAME_BY_ROLE.get(templateRole) : undefined
    const changesRecordPolicy = Object.prototype.hasOwnProperty.call(patch, 'recordPolicy')

    if (!isEntityMetadataPolicyManaged(codename, config) && !changesRecordPolicy) return

    if (templateRole) {
        if (expectedTemplateCodename && nextCodename !== undefined && nextCodename !== expectedTemplateCodename) {
            throw new MetahubConflictError('The Entity codename is fixed while it provides a built-in Marketing Page source.')
        }
        if (currentConfig.marketingRole !== templateRole) {
            throw new MetahubConflictError('The Marketing Page source role is managed by the template.')
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'marketingRole') && patch.marketingRole !== templateRole) {
            throw new MetahubConflictError('The Marketing Page source role is managed by the template.')
        }

        const expectedPolicies = getExpectedPoliciesForRole(templateRole)
        if (expectedPolicies.length > 0 || Object.prototype.hasOwnProperty.call(currentConfig, 'recordPolicy')) {
            let currentPolicy
            try {
                currentPolicy = resolveEntityRecordPolicy(config)
            } catch {
                throw new MetahubConflictError('The Marketing Page source record policy is invalid and cannot be edited here.')
            }

            if (
                (expectedPolicies.length > 0 &&
                    (!currentPolicy ||
                        !expectedPolicies.some((policy) => isEntityPolicyCompatibleWithRequirement(currentPolicy, policy)))) ||
                (expectedPolicies.length === 0 && currentPolicy !== undefined)
            ) {
                throw new MetahubConflictError('The Marketing Page source record policy is managed by the template.')
            }
        }
    }

    if (!changesRecordPolicy) return

    let currentPolicy
    let nextPolicy
    try {
        currentPolicy = resolveEntityRecordPolicy(config)
        nextPolicy = resolveEntityRecordPolicy({ recordPolicy: patch.recordPolicy })
    } catch {
        throw new MetahubConflictError('Entity record policies are managed by the platform.')
    }

    if (!currentPolicy || !nextPolicy || JSON.stringify(currentPolicy) !== JSON.stringify(nextPolicy)) {
        throw new MetahubConflictError('Entity record policies are managed by the platform.')
    }
}
