import type { LocaleCode, VersionedLocalizedContent } from '@universo-react/types'
import { createLocalizedContent, generateUuidV7, getVLCString, isUuidV7, updateLocalizedContentLocale } from '@universo-react/utils'

const DEFAULT_MIN_OPTIONS = 2
const DEFAULT_MAX_OPTIONS = 20
// Keep the published-app editor aligned with the assessment API's OPTION_LIMIT.
const MAX_ASSESSMENT_OPTION_COUNT = 20
export const MAX_ASSESSMENT_OPTION_TEXT_LENGTH = 2000

export interface AssessmentOptionValue {
    id: string
    label: unknown
    isCorrect: boolean
}

export interface AssessmentOptionDraft extends AssessmentOptionValue {
    text: string
}

export interface AssessmentOptionBounds {
    min: number
    max: number
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const asLocaleCode = (locale: string): LocaleCode => locale.split(/[-_]/)[0]?.trim().toLowerCase() || 'en'

const isVersionedLocalizedLabel = (value: unknown): value is VersionedLocalizedContent<string> => {
    if (!isRecord(value) || !isRecord(value.locales)) return false
    return Object.values(value.locales).every((entry) => isRecord(entry) && typeof entry.content === 'string')
}

const isSimpleLocalizedLabel = (value: unknown): value is Record<string, string> => {
    if (!isRecord(value)) return false
    const entries = Object.values(value)
    return entries.length > 0 && entries.every((entry) => typeof entry === 'string')
}

const isLocalizedLabel = (value: unknown): boolean => isVersionedLocalizedLabel(value) || isSimpleLocalizedLabel(value)

const readLabelText = (value: unknown, locale: string): string => getVLCString(value as Parameters<typeof getVLCString>[0], locale)

const makeEmptyLabelLike = (template: unknown, locale: string): unknown => {
    const normalizedLocale = asLocaleCode(locale)

    if (isVersionedLocalizedLabel(template)) {
        let localized = createLocalizedContent(normalizedLocale, '')
        for (const localeCode of Object.keys(template.locales)) {
            if (localeCode !== normalizedLocale) {
                localized = updateLocalizedContentLocale(localized, localeCode, '')
            }
        }
        return {
            ...localized,
            _schema: template._schema,
            _primary: template._primary
        }
    }

    if (isSimpleLocalizedLabel(template)) {
        const locales = Object.fromEntries(Object.keys(template).map((localeCode) => [localeCode, '']))
        return { ...locales, [normalizedLocale]: '' }
    }

    return createLocalizedContent(normalizedLocale, '')
}

const writeLabelText = (original: unknown, text: string, locale: string): unknown => {
    const normalizedLocale = asLocaleCode(locale)

    if (isVersionedLocalizedLabel(original)) {
        return updateLocalizedContentLocale(original, normalizedLocale, text)
    }

    if (isSimpleLocalizedLabel(original)) {
        return { ...original, [normalizedLocale]: text }
    }

    return text
}

export function resolveAssessmentOptionBounds(uiConfig: unknown): AssessmentOptionBounds {
    const config = isRecord(uiConfig) ? uiConfig : {}
    const readCount = (value: unknown, fallback: number) =>
        typeof value === 'number' && Number.isSafeInteger(value) && value >= DEFAULT_MIN_OPTIONS ? value : fallback

    const min = Math.min(MAX_ASSESSMENT_OPTION_COUNT, readCount(config.minOptions, DEFAULT_MIN_OPTIONS))
    const max = Math.min(MAX_ASSESSMENT_OPTION_COUNT, Math.max(min, readCount(config.maxOptions, DEFAULT_MAX_OPTIONS)))
    return { min, max }
}

export function getAssessmentOptionCount(value: unknown): number {
    return Array.isArray(value) ? value.length : 0
}

export function readAssessmentOptionDrafts(value: unknown, locale: string): AssessmentOptionDraft[] {
    if (!Array.isArray(value)) return []

    const usedIds = new Set<string>()
    return value.flatMap((rawOption): AssessmentOptionDraft[] => {
        if (!isRecord(rawOption)) return []

        const storedId = isUuidV7(rawOption.id) ? rawOption.id : null
        let id = storedId && !usedIds.has(storedId) ? storedId : generateUuidV7()
        while (usedIds.has(id)) id = generateUuidV7()
        usedIds.add(id)

        const label = rawOption.label ?? rawOption.text ?? ''
        return [
            {
                id,
                label,
                text: readLabelText(label, locale),
                isCorrect: rawOption.isCorrect === true || rawOption.is_correct === true
            }
        ]
    })
}

export function createAssessmentOptionDraft(existingOptions: AssessmentOptionDraft[], locale: string): AssessmentOptionDraft {
    const localizedTemplate = existingOptions.find((option) => isLocalizedLabel(option.label))?.label

    return {
        id: generateUuidV7(),
        label: makeEmptyLabelLike(localizedTemplate, locale),
        text: '',
        isCorrect: false
    }
}

export function serializeAssessmentOptionDrafts(drafts: AssessmentOptionDraft[], locale: string): AssessmentOptionValue[] {
    return drafts.map(({ id, label, text, isCorrect }) => ({
        id,
        label: writeLabelText(label, text, locale),
        isCorrect
    }))
}

export function canSaveAssessmentOptionDrafts(drafts: AssessmentOptionDraft[], bounds: AssessmentOptionBounds): boolean {
    return (
        drafts.length >= bounds.min &&
        drafts.length <= bounds.max &&
        drafts.every((option) => option.text.trim().length > 0 && option.text.length <= MAX_ASSESSMENT_OPTION_TEXT_LENGTH) &&
        drafts.filter((option) => option.isCorrect).length === 1
    )
}
