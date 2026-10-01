import {
    isKnownMarketingInternalRoute,
    marketingActionSchema,
    marketingMediaReferenceSchema,
    normalizeWidgetBindingDataType,
    resolveEntityRecordPolicy,
    type EntityRecordPolicy
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'

type RecordPolicyComponent = {
    codename: string
    dataType?: string
    isRequired: boolean
    validationRules?: Record<string, unknown>
}

type RecordPolicyValidation = {
    valid: boolean
    errors: string[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasActiveLocalizedText = (value: unknown): boolean => {
    if (!isRecord(value) || !isRecord(value.locales)) return false
    return Object.values(value.locales).some(
        (entry) => isRecord(entry) && entry.isActive !== false && typeof entry.content === 'string' && entry.content.trim().length > 0
    )
}

const hasPolicyValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return false
    if (typeof value === 'string') return value.trim().length > 0
    if (isRecord(value) && isRecord(value.locales)) return hasActiveLocalizedText(value)
    return true
}

const hasRequiredPolicyValue = (value: unknown, component: RecordPolicyComponent): boolean => {
    if (value === undefined || value === null) return false

    switch (normalizeWidgetBindingDataType(component.dataType)) {
        case 'STRING':
        case 'DATE':
        case 'REF':
            return typeof value === 'string' && value.trim().length > 0
        case 'NUMBER':
            return typeof value === 'number' && Number.isFinite(value)
        case 'BOOLEAN':
            return typeof value === 'boolean'
        case 'TABLE':
            return Array.isArray(value) && value.length > 0
        case 'JSON':
            return true
        default:
            return hasPolicyValue(value)
    }
}

const matchesConditionalValueType = (component: RecordPolicyComponent | undefined, value: string | number | boolean): boolean => {
    if (!component?.dataType) return false
    const normalizedType = normalizeWidgetBindingDataType(component.dataType)
    const expectedType = typeof value === 'boolean' ? 'BOOLEAN' : typeof value === 'number' ? 'NUMBER' : 'STRING'
    return normalizedType === expectedType
}

const validateLocalizedString = (value: unknown, field: string, required: boolean, requiredLocales: readonly string[]): string[] => {
    if (!hasActiveLocalizedText(value)) return required ? [`${field}.required`] : []
    if (!isRecord(value) || !isRecord(value.locales)) return [`${field}.invalid_localized_content`]

    const errors: string[] = []
    for (const locale of requiredLocales) {
        const entry = value.locales[locale]
        if (!isRecord(entry) || entry.isActive === false || typeof entry.content !== 'string' || entry.content.trim().length === 0) {
            errors.push(`${field}.${locale}.required`)
        }
    }
    return errors
}

const validateAction = (value: unknown, field: string, required: boolean): string[] => {
    if (value === undefined || value === null || value === '') return required ? [`${field}.required`] : []

    const parsed = marketingActionSchema.safeParse(value)
    if (!parsed.success) return [`${field}.invalid_action`]

    const target = (() => {
        switch (parsed.data.kind) {
            case 'internal':
                return parsed.data.path
            case 'external':
                return parsed.data.url
            case 'anchor':
                return parsed.data.href
            case 'email':
                return `${parsed.data.address}${parsed.data.subject ?? ''}`
            case 'tel':
                return parsed.data.number
        }
    })()
    if (target.length > 500) return [`${field}.target_too_long`]
    if (parsed.data.kind === 'internal' && !isKnownMarketingInternalRoute(parsed.data.path)) return [`${field}.unknown_route`]
    return []
}

/** Replace client-provided semantic IDs with a server-generated UUID v7 key. */
export const prepareEntityRecordCreationData = (
    policy: EntityRecordPolicy | undefined,
    data: Record<string, unknown>
): Record<string, unknown> => {
    if (!policy?.semanticKey) return data
    return {
        ...data,
        [policy.semanticKey.componentCodename]: `${policy.semanticKey.creationPrefix}-${generateUuidV7()}`
    }
}

/** Validate generic record-policy constraints and component-declared Marketing formats. */
export const validateEntityRecordPolicyData = (
    policy: EntityRecordPolicy | undefined,
    data: Record<string, unknown>,
    components: readonly RecordPolicyComponent[]
): RecordPolicyValidation => {
    if (!policy) return { valid: true, errors: [] }

    const errors: string[] = []
    if (policy.semanticKey) {
        const key = data[policy.semanticKey.componentCodename]
        if (typeof key !== 'string' || key.trim().length === 0) errors.push(`${policy.semanticKey.componentCodename}.required`)
    }

    const componentCodenames = new Set(components.map(({ codename }) => codename))
    const componentsByCodename = new Map(components.map((component) => [component.codename, component]))
    const groupRequiredCodenames = new Set<string>()
    for (const group of policy.coRequiredGroups ?? []) {
        if (group.some((codename) => !componentCodenames.has(codename))) {
            errors.push('recordPolicy.invalid_co_required_group')
            continue
        }
        if (group.some((codename) => hasPolicyValue(data[codename]))) {
            group.forEach((codename) => groupRequiredCodenames.add(codename))
        }
    }

    const requiredLocales = policy.requiredLocales ?? []
    const conditionallyRequiredCodenames = new Set<string>()
    for (const rule of policy.conditionalRequired ?? []) {
        const target = componentsByCodename.get(rule.componentCodename)
        const condition = componentsByCodename.get(rule.when.componentCodename)
        if (
            !target ||
            target.isRequired ||
            !condition ||
            condition.validationRules?.localized === true ||
            !matchesConditionalValueType(condition, rule.when.equals)
        ) {
            errors.push('recordPolicy.invalid_conditional_requirement')
            continue
        }
        if (data[condition.codename] === rule.when.equals) conditionallyRequiredCodenames.add(target.codename)
    }

    for (const component of components) {
        const value = data[component.codename]
        const required =
            component.isRequired || groupRequiredCodenames.has(component.codename) || conditionallyRequiredCodenames.has(component.codename)
        if (component.validationRules?.localized === true) {
            if (required || hasActiveLocalizedText(value)) {
                errors.push(...validateLocalizedString(value, component.codename, required, requiredLocales))
            }
            continue
        }

        if (required && !hasRequiredPolicyValue(value, component)) errors.push(`${component.codename}.required`)

        const format = component.validationRules?.format
        if (format === 'marketingAction') {
            errors.push(...validateAction(value, component.codename, required))
        } else if (
            format === 'marketingMediaReference' &&
            hasPolicyValue(value) &&
            !marketingMediaReferenceSchema.safeParse(value).success
        ) {
            errors.push(`${component.codename}.invalid_media_reference`)
        }
    }

    return { valid: errors.length === 0, errors: Array.from(new Set(errors)) }
}

/** Parse the persisted record policy at every server-owned object boundary. */
export const readEntityRecordPolicy = (objectConfig: unknown): EntityRecordPolicy | undefined => resolveEntityRecordPolicy(objectConfig)
