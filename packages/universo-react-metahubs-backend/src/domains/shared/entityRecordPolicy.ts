import {
    isKnownMarketingInternalRoute,
    marketingActionSchema,
    resolveEntityRecordPolicy,
    type EntityRecordPolicy
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'

type RecordPolicyComponent = {
    codename: string
    isRequired: boolean
    validationRules?: Record<string, unknown>
}

type RecordPolicyValidation = {
    valid: boolean
    errors: string[]
}

type PolicyValidator = (data: Record<string, unknown>, policy: EntityRecordPolicy) => string[]

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const hasActiveLocalizedText = (value: unknown): boolean => {
    if (!isRecord(value) || !isRecord(value.locales)) return false
    return Object.values(value.locales).some(
        (entry) => isRecord(entry) && entry.isActive !== false && typeof entry.content === 'string' && entry.content.trim().length > 0
    )
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

const validateAction = (data: Record<string, unknown>, field: string, required: boolean): string[] => {
    const value = data[field]
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

const validateMarketingHeroV1: PolicyValidator = (data, policy) => {
    const locales = policy.requiredLocales ?? []
    const errors = [
        ...validateLocalizedString(data.Title, 'Title', true, locales),
        ...validateLocalizedString(data.Description, 'Description', true, locales),
        ...validateLocalizedString(data.EmailLabel, 'EmailLabel', true, locales),
        ...validateLocalizedString(data.EmailPlaceholder, 'EmailPlaceholder', true, locales),
        ...validateLocalizedString(data.PrimaryActionLabel, 'PrimaryActionLabel', true, locales),
        ...validateLocalizedString(data.Accent, 'Accent', false, locales),
        ...validateAction(data, 'PrimaryAction', true)
    ]

    const hasTerms = ['TermsText', 'TermsLinkLabel', 'TermsAction'].some((field) => data[field] !== undefined && data[field] !== null)
    if (hasTerms) {
        errors.push(...validateLocalizedString(data.TermsText, 'TermsText', true, locales))
        errors.push(...validateLocalizedString(data.TermsLinkLabel, 'TermsLinkLabel', true, locales))
        errors.push(...validateAction(data, 'TermsAction', true))
    }

    return errors
}

const policyValidators: Readonly<Record<string, PolicyValidator>> = {
    'marketing.hero.v1': validateMarketingHeroV1
}

/** Check the full server-owned Hero policy before authoring, binding, or publication. */
export const isAuthoritativeMarketingHeroRecordPolicy = (policy: EntityRecordPolicy | undefined): policy is EntityRecordPolicy => {
    const semanticKey = policy?.semanticKey
    const requiredLocales = policy?.requiredLocales ?? []
    return Boolean(
        policy?.version === 1 &&
            semanticKey?.componentCodename === 'HeroKey' &&
            semanticKey.creationPrefix === 'hero' &&
            semanticKey.protectedValues.length === 1 &&
            semanticKey.protectedValues[0] === 'default' &&
            policy.denyDeleteWhenBound === true &&
            policy.immutableSemanticKeyWhenBound === true &&
            policy.runtimeMutation === 'deny' &&
            requiredLocales.length === 2 &&
            requiredLocales.includes('en') &&
            requiredLocales.includes('ru') &&
            policy.validatorKey === 'marketing.hero.v1'
    )
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

/** Validate policy metadata and values without leaking content into errors. */
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

    const requiredLocales = policy.requiredLocales ?? []
    for (const component of components) {
        if (component.validationRules?.localized !== true) continue
        const value = data[component.codename]
        const authored = hasActiveLocalizedText(value)
        if (component.isRequired || authored) {
            errors.push(...validateLocalizedString(value, component.codename, component.isRequired, requiredLocales))
        }
    }

    if (policy.validatorKey) {
        const validator = policyValidators[policy.validatorKey]
        if (!validator) {
            errors.push('recordPolicy.unsupported_validator')
        } else {
            errors.push(...validator(data, policy))
        }
    }

    return { valid: errors.length === 0, errors: Array.from(new Set(errors)) }
}

/** Parse the persisted record policy at every server-owned object boundary. */
export const readEntityRecordPolicy = (objectConfig: unknown): EntityRecordPolicy | undefined => resolveEntityRecordPolicy(objectConfig)
