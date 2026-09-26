import { MARKETING_HERO_ENTITY_CODENAME, marketingActionSchema } from '@universo-react/types'
import type { DynamicFieldConfig, DynamicFieldValidationRules } from '@universo-react/template-mui/components/dialogs'
import { getCodenamePrimary, getVLCString, normalizeLocale } from '@universo-react/utils/vlc'

import type { Component, RecordItem } from '../../../types'

export { MARKETING_HERO_ENTITY_CODENAME }

export const MARKETING_PAGE_HUB_CODENAME = 'MarketingPage' as const

const REQUIRED_LOCALIZED_LOCALES = ['en', 'ru'] as const
const TERMS_COMPONENT_KEYS = ['TermsText', 'TermsLinkLabel', 'TermsAction'] as const
const RESERVED_COMPONENT_KEYS = new Set([
    'HeroKey',
    'Published',
    'PublishedAt',
    'PublishedBy',
    'DeletedAt',
    'DeletedBy',
    'CreatedAt',
    'CreatedBy',
    'UpdatedAt',
    'UpdatedBy'
])

type HeroRecordValidationResult =
    | { success: true; data: Record<string, unknown> }
    | { success: false; error: 'invalidAction' | 'termsGroup' }
    | { success: false; error: 'missingLocale'; field: string; locale: string }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const getHeroComponentKey = (component: Pick<Component, 'codename'>): string => getCodenamePrimary(component.codename).trim()

const isAuthorableComponent = (component: Component): boolean => {
    const key = getHeroComponentKey(component)
    return Boolean(
        key &&
            !RESERVED_COMPONENT_KEYS.has(key) &&
            component.uiConfig?.hidden !== true &&
            component.isActive !== false &&
            component.isExcluded !== true
    )
}

export const buildHeroRecordFields = (components: Component[], locale: string, fallbackLabel: string): DynamicFieldConfig[] =>
    components.filter(isAuthorableComponent).map((component) => {
        const key = getHeroComponentKey(component)
        const validationRules = component.validationRules as DynamicFieldValidationRules | undefined
        const rows = component.uiConfig?.rows

        return {
            id: key,
            codename: key,
            label: getVLCString(component.name, locale).trim() || fallbackLabel,
            type: component.dataType as DynamicFieldConfig['type'],
            required: component.isRequired,
            localized: validationRules?.localized === true,
            validationRules,
            uiConfig: component.uiConfig,
            ...(typeof rows === 'number' && Number.isFinite(rows) && rows > 0 ? { multilineRows: rows } : {})
        }
    })

export const getHeroRecordLabel = (record: RecordItem, components: Component[], locale: string, fallbackLabel: string): string => {
    const labelComponent =
        components.find((component) => isAuthorableComponent(component) && component.isDisplayComponent === true) ??
        components.find((component) => isAuthorableComponent(component) && getHeroComponentKey(component) === 'Title') ??
        components.find((component) => isAuthorableComponent(component) && component.dataType === 'STRING')

    if (!labelComponent) return fallbackLabel
    const value = record.data?.[getHeroComponentKey(labelComponent)]
    const label = typeof value === 'string' ? value.trim() : getVLCString(value as Parameters<typeof getVLCString>[0], locale).trim()

    return label || fallbackLabel
}

const hasMeaningfulValue = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0
    if (typeof value === 'number' || typeof value === 'boolean') return true
    if (!isRecord(value)) return false

    if (isRecord(value.locales)) {
        return Object.values(value.locales).some(
            (entry) => isRecord(entry) && entry.isActive !== false && typeof entry.content === 'string' && entry.content.trim().length > 0
        )
    }

    return Object.keys(value).length > 0
}

const hasLocalizedContent = (value: unknown, locale: string, currentLocale: string): boolean => {
    if (typeof value === 'string') return locale === currentLocale && value.trim().length > 0
    if (!isRecord(value)) return false

    const normalizedLocale = normalizeLocale(locale)
    if (isRecord(value.locales)) {
        const entry = value.locales[normalizedLocale]
        return isRecord(entry) && entry.isActive !== false && typeof entry.content === 'string' && entry.content.trim().length > 0
    }

    const simpleValue = value[normalizedLocale]
    return typeof simpleValue === 'string' && simpleValue.trim().length > 0
}

export const validateHeroRecordData = (submittedData: unknown, components: Component[], locale: string): HeroRecordValidationResult => {
    if (!isRecord(submittedData)) return { success: false, error: 'invalidAction' }

    const authorableComponents = components.filter(isAuthorableComponent)
    const componentKeys = new Set(authorableComponents.map(getHeroComponentKey))
    const termsKeys = TERMS_COMPONENT_KEYS.filter((key) => componentKeys.has(key))
    const hasAnyTermsValue = termsKeys.some((key) => hasMeaningfulValue(submittedData[key]))
    if (
        hasAnyTermsValue &&
        (termsKeys.length !== TERMS_COMPONENT_KEYS.length || TERMS_COMPONENT_KEYS.some((key) => !hasMeaningfulValue(submittedData[key])))
    ) {
        return { success: false, error: 'termsGroup' }
    }

    const currentLocale = normalizeLocale(locale)
    const localesToCheck = [currentLocale, ...REQUIRED_LOCALIZED_LOCALES.filter((requiredLocale) => requiredLocale !== currentLocale)]

    for (const component of authorableComponents) {
        if (component.validationRules?.localized !== true) continue
        const key = getHeroComponentKey(component)
        const value = submittedData[key]
        if (!component.isRequired && !hasMeaningfulValue(value)) continue

        for (const requiredLocale of localesToCheck) {
            if (!hasLocalizedContent(value, requiredLocale, currentLocale)) {
                return { success: false, error: 'missingLocale', field: key, locale: requiredLocale }
            }
        }
    }

    const data: Record<string, unknown> = {}
    for (const component of authorableComponents) {
        const key = getHeroComponentKey(component)
        if (!Object.prototype.hasOwnProperty.call(submittedData, key)) continue

        const value = submittedData[key]
        if (component.validationRules?.format === 'marketingAction') {
            if (value == null && !component.isRequired) {
                data[key] = value
                continue
            }
            const parsedAction = marketingActionSchema.safeParse(value)
            if (!parsedAction.success) return { success: false, error: 'invalidAction' }
            data[key] = parsedAction.data
            continue
        }

        data[key] = value
    }

    for (const component of authorableComponents) {
        if (component.validationRules?.format !== 'marketingAction' || !component.isRequired) continue
        if (!Object.prototype.hasOwnProperty.call(data, getHeroComponentKey(component))) return { success: false, error: 'invalidAction' }
    }

    return { success: true, data }
}
