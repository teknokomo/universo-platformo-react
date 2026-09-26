import {
    ComponentDefinitionDataType,
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_HERO_ENTITY_CODENAME,
    MARKETING_SEMANTIC_KEY_PATTERN,
    resolveEntityRecordPolicy
} from '@universo-react/types'
import { MetahubConflictError, MetahubDomainError } from './domainErrors'
import { isAuthoritativeMarketingHeroRecordPolicy } from './entityRecordPolicy'

const MARKETING_HERO_ROLE = 'hero'
const MARKETING_HERO_POLICY_VALIDATOR = 'marketing.hero.v1'
const MARKETING_HERO_BINDING_COMPONENTS =
    LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')?.bindingSlots?.flatMap(
        ({ requirements }) => requirements.components ?? []
    ) ?? []
const MARKETING_HERO_BINDING_CODENAMES = new Set(MARKETING_HERO_BINDING_COMPONENTS.map(({ componentCodename }) => componentCodename))

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readPolicyValidatorKey = (value: unknown): string | null => {
    try {
        return resolveEntityRecordPolicy({ recordPolicy: value })?.validatorKey ?? null
    } catch {
        return asRecord(value).validatorKey === MARKETING_HERO_POLICY_VALIDATOR ? MARKETING_HERO_POLICY_VALIDATOR : null
    }
}

export const isMarketingHeroBindingComponentCodename = (codename: string): boolean => MARKETING_HERO_BINDING_CODENAMES.has(codename)

export const isMarketingHeroEntityMetadata = (codename: string, config: unknown): boolean => {
    const values = asRecord(config)
    return (
        codename === MARKETING_HERO_ENTITY_CODENAME ||
        values.marketingRole === MARKETING_HERO_ROLE ||
        readPolicyValidatorKey(values.recordPolicy) === MARKETING_HERO_POLICY_VALIDATOR
    )
}

type MarketingHeroComponentState = {
    codename: string
    dataType: string
    isRequired: boolean
    validationRules: unknown
    parentComponentId?: string | null
}

const expectedComponentDataType = (valueType: string): string | undefined => {
    switch (valueType) {
        case 'string':
            return ComponentDefinitionDataType.STRING
        case 'json':
            return ComponentDefinitionDataType.JSON
        case 'number':
            return ComponentDefinitionDataType.NUMBER
        case 'boolean':
            return ComponentDefinitionDataType.BOOLEAN
        default:
            return undefined
    }
}

const rejectMarketingHeroComponentMutation = (): never => {
    throw new MetahubDomainError({
        message:
            'This component is part of the Marketing Hero binding schema and cannot be changed in a way that invalidates its bindings.',
        statusCode: 409,
        code: 'ENTITY_COMPONENT_SCHEMA_PROTECTED'
    })
}

/** Keep generic component metadata mutations compatible with the registered Hero binding contract. */
export const assertMarketingHeroComponentMutation = ({
    entityCodename,
    entityConfig,
    current,
    next,
    operation
}: {
    entityCodename: string
    entityConfig: unknown
    current: MarketingHeroComponentState
    next?: MarketingHeroComponentState
    operation: 'update' | 'delete' | 'set-display' | 'move'
}): void => {
    const config = asRecord(entityConfig)
    if (!isMarketingHeroEntityMetadata(entityCodename, config)) return

    assertEntityMetadataSecurityUpdate({ codename: entityCodename, config })

    const currentRequirement = MARKETING_HERO_BINDING_COMPONENTS.find(({ componentCodename }) => componentCodename === current.codename)
    const nextRequirement = next
        ? MARKETING_HERO_BINDING_COMPONENTS.find(({ componentCodename }) => componentCodename === next.codename)
        : undefined

    if (operation === 'delete' && currentRequirement) rejectMarketingHeroComponentMutation()
    if (currentRequirement && (!nextRequirement || current.codename !== next?.codename)) rejectMarketingHeroComponentMutation()
    if (!nextRequirement || !next) return

    const expectedDataType = expectedComponentDataType(nextRequirement.valueType)
    const rules = asRecord(next.validationRules)
    if (
        !expectedDataType ||
        next.dataType !== expectedDataType ||
        next.isRequired !== nextRequirement.required ||
        (nextRequirement.localized !== undefined && rules.localized !== nextRequirement.localized) ||
        (nextRequirement.maxLength !== undefined && rules.maxLength !== nextRequirement.maxLength) ||
        (nextRequirement.semanticKey === true && (rules.unique !== true || rules.pattern !== MARKETING_SEMANTIC_KEY_PATTERN.source)) ||
        (nextRequirement.format !== undefined && rules.format !== nextRequirement.format) ||
        ((operation === 'move' || operation === 'update') && next.parentComponentId != null)
    ) {
        rejectMarketingHeroComponentMutation()
    }

    if (operation === 'set-display' && !nextRequirement.required) rejectMarketingHeroComponentMutation()
}

export const isEntityMetadataPolicyManaged = (codename: string, config: unknown): boolean => {
    const values = asRecord(config)
    return (
        Object.prototype.hasOwnProperty.call(values, 'recordPolicy') ||
        codename === MARKETING_HERO_ENTITY_CODENAME ||
        values.marketingRole === MARKETING_HERO_ROLE ||
        readPolicyValidatorKey(values.recordPolicy) === MARKETING_HERO_POLICY_VALIDATOR
    )
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
    const isHero =
        codename === MARKETING_HERO_ENTITY_CODENAME ||
        currentConfig.marketingRole === MARKETING_HERO_ROLE ||
        readPolicyValidatorKey(currentConfig.recordPolicy) === MARKETING_HERO_POLICY_VALIDATOR

    const changesRecordPolicy = Object.prototype.hasOwnProperty.call(patch, 'recordPolicy')
    if (!isEntityMetadataPolicyManaged(codename, config) && !isHero && !changesRecordPolicy) return

    if (isHero) {
        if (nextCodename !== undefined && nextCodename !== codename) {
            throw new MetahubConflictError('The Marketing Hero Object codename is fixed while it provides layout bindings.')
        }
        if (currentConfig.marketingRole !== MARKETING_HERO_ROLE) {
            throw new MetahubConflictError('The Marketing Hero Object role is managed by the template.')
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'marketingRole') && patch.marketingRole !== MARKETING_HERO_ROLE) {
            throw new MetahubConflictError('The Marketing Hero Object role is managed by the template.')
        }

        let currentHeroPolicy
        try {
            currentHeroPolicy = resolveEntityRecordPolicy(config)
        } catch {
            throw new MetahubConflictError('The Marketing Hero Object record policy is invalid and cannot be edited here.')
        }
        if (!isAuthoritativeMarketingHeroRecordPolicy(currentHeroPolicy)) {
            throw new MetahubConflictError('The Marketing Hero Object record policy is managed by the template.')
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
