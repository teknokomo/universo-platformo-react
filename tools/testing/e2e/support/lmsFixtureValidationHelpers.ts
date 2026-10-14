import { buildVLC } from '@universo-react/utils'
import { LMS_CANONICAL_METAHUB } from './lmsFixtureDataOverview.ts'
import type { SnapshotElement } from './lmsFixtureContractTypes.ts'

export const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const localized = value as {
        _primary?: string
        locales?: Record<string, { content?: string }>
        [key: string]: unknown
    }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const locales = localized.locales ?? {}
    const readLocaleValue = (entry: unknown): string | undefined => {
        if (typeof entry === 'string' && entry.length > 0) return entry
        if (!entry || typeof entry !== 'object') return undefined
        const content = (entry as { content?: unknown }).content
        return typeof content === 'string' && content.length > 0 ? content : undefined
    }
    const directValue = readLocaleValue(locales[normalizedLocale]) ?? readLocaleValue(localized[normalizedLocale])
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryValue = localized._primary
        ? readLocaleValue(locales[localized._primary]) ?? readLocaleValue(localized[localized._primary])
        : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.entries(Object.keys(locales).length > 0 ? locales : localized)
        .filter(([key]) => !key.startsWith('_') && key !== 'locales')
        .map(([, entry]) => readLocaleValue(entry))
        .find((entry): entry is string => typeof entry === 'string')
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

export const readWidgetConfig = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const readRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

export const assertLocalizedFixtureValue = (errors: string[], value: unknown, expected: { en: string; ru: string }, label: string) => {
    const actualEn = readLocalizedText(value, 'en')
    const actualRu = readLocalizedText(value, 'ru')
    if (actualEn !== expected.en) {
        errors.push(`${label} is missing the canonical English value`)
    }
    if (actualRu !== expected.ru) {
        errors.push(`${label} is missing the canonical Russian value`)
    }
}

export const isVersionedLocalizedText = (value: unknown): boolean => {
    const record = readRecord(value)
    const locales = readRecord(record?.locales)
    if (!locales) return false

    const english = readRecord(locales.en)?.content
    const russian = readRecord(locales.ru)?.content
    return typeof english === 'string' && english.trim().length > 0 && typeof russian === 'string' && russian.trim().length > 0
}

export const assertEditorBlockTextLocalized = (errors: string[], body: unknown, label: string) => {
    const bodyRecord = readRecord(body)
    const blocks = Array.isArray(bodyRecord?.blocks) ? bodyRecord.blocks : []
    for (const [index, block] of blocks.entries()) {
        const blockRecord = readRecord(block)
        const data = readRecord(blockRecord?.data)
        const text = data?.text
        if (text === undefined || text === null || text === '') continue
        if (!isVersionedLocalizedText(text)) {
            errors.push(`${label} block ${index + 1} text must be a localized English/Russian VLC value`)
        }
    }
}

export const getSeededRows = (elementsByEntityId: Record<string, SnapshotElement[]>, entityId: string | undefined) => {
    if (!entityId) {
        return []
    }

    return Array.isArray(elementsByEntityId[entityId]) ? elementsByEntityId[entityId] : []
}

export const findRowByField = (rows: SnapshotElement[], fieldName: string, expectedValue: string, locale: 'en' | 'ru' = 'en') =>
    rows.find((row) => {
        const value = row?.data?.[fieldName]
        if (typeof value === 'string') {
            return value === expectedValue
        }
        return readLocalizedText(value, locale) === expectedValue
    })

export function buildLmsLiveMetahubName(_runId?: string) {
    return { ...LMS_CANONICAL_METAHUB.name }
}

export function buildLmsLiveMetahubCodename(_runId?: string) {
    return buildVLC(LMS_CANONICAL_METAHUB.codename.en, LMS_CANONICAL_METAHUB.codename.ru)
}
