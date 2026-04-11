import type { ActionContext } from '@universo/template-mui'
import type { EntityKind } from '@universo/types'
import type { HubElementDisplay, VersionedLocalizedContent } from '../../../types'
import { getVLCString } from '../../../types'
import { hasAxiosResponse } from '@universo/utils'

// ────────────────────────── Types ──────────────────────────

export type ElementOption = {
    id: string
    name: string
}

export type RefTargetDescriptor = {
    kind: EntityKind
    targetId: string
    targetConstantId?: string | null
    setConstantLabel?: string | null
}

export type ElementUpdatePatch = Record<string, unknown>

export type ElementMenuContext = ActionContext<HubElementDisplay, { data: ElementUpdatePatch }>

export type ElementConfirmSpec = {
    title?: string
    titleKey?: string
    description?: string
    descriptionKey?: string
    confirmButtonName?: string
    confirmKey?: string
    cancelButtonName?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
}

export type EnumerationValueOption = {
    id: string
    label: string
    isDefault: boolean
}

// ────────────────────────── Utility Functions ──────────────────────────

export const isVersionedLocalizedContent = (value: unknown): value is VersionedLocalizedContent<string> =>
    value !== null && typeof value === 'object' && 'locales' in value

export const extractResponseMessage = (error: unknown): string | undefined => {
    if (!hasAxiosResponse(error)) return undefined
    const responseData = error.response.data
    if (!responseData || typeof responseData !== 'object') return undefined
    const message = (responseData as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

export const resolveSetConstantLabel = (constant: { value: unknown; dataType?: string }, locale: string): string => {
    const rawValue = constant.value
    if (rawValue === null || rawValue === undefined) return '—'

    if (typeof rawValue === 'object') {
        const localized = getVLCString(rawValue as Record<string, unknown>, locale)
        if (localized && localized.trim().length > 0) return localized
    }

    if (constant.dataType === 'DATE' && typeof rawValue === 'string') {
        const parsed = new Date(rawValue)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toLocaleString(locale)
        }
    }

    return String(rawValue)
}

export const resolveRefId = (value: unknown): string | null => {
    if (typeof value === 'string' && value.length > 0) return value
    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>
        if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id
        if (typeof obj.value === 'string' && obj.value.length > 0) return obj.value
    }
    return null
}

export const normalizeUiLocale = (locale: string) => locale.split(/[-_]/)[0]?.toLowerCase() || 'en'

export const getCopySuffixByLocale = (locale: string) => (normalizeUiLocale(locale) === 'ru' ? ' (копия)' : ' (copy)')
export const getCopyLabelByLocale = (locale: string) => (normalizeUiLocale(locale) === 'ru' ? 'Копия' : 'Copy')

export const isLocalizedContentValue = (value: unknown): value is { _primary?: string; locales?: Record<string, { content?: string }> } =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

export const applyCopySuffixToFirstStringAttribute = (params: {
    sourceData: Record<string, unknown>
    attributes: Array<{ dataType: string; codename: string }>
    locale: string
}): Record<string, unknown> => {
    const { sourceData, attributes, locale } = params
    const firstStringAttribute = attributes.find((attribute) => attribute.dataType === 'STRING')
    if (!firstStringAttribute) return { ...sourceData }

    const fieldKey = firstStringAttribute.codename
    const rawValue = sourceData[fieldKey]
    const defaultSuffix = getCopySuffixByLocale(locale)

    if (typeof rawValue === 'string') {
        const content = rawValue.trim()
        return {
            ...sourceData,
            [fieldKey]: content.length > 0 ? `${content}${defaultSuffix}` : `${getCopyLabelByLocale(locale)}${defaultSuffix}`
        }
    }

    if (isLocalizedContentValue(rawValue)) {
        const nextLocales = { ...(rawValue.locales ?? {}) }
        let hasAnyContent = false
        for (const [localeKey, localeValue] of Object.entries(nextLocales)) {
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            if (!content) continue
            hasAnyContent = true
            nextLocales[localeKey] = {
                ...(localeValue ?? {}),
                content: `${content}${getCopySuffixByLocale(localeKey)}`
            }
        }

        if (!hasAnyContent) {
            const primaryLocale = normalizeUiLocale(rawValue._primary || locale)
            nextLocales[primaryLocale] = {
                content: `${getCopyLabelByLocale(primaryLocale)}${getCopySuffixByLocale(primaryLocale)}`
            }
        }

        return {
            ...sourceData,
            [fieldKey]: {
                ...rawValue,
                locales: nextLocales
            }
        }
    }

    return {
        ...sourceData,
        [fieldKey]: `${getCopyLabelByLocale(locale)}${defaultSuffix}`
    }
}
