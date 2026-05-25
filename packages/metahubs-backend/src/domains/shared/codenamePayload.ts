import { CodenameVLCSchema, type CodenameVLC, type VersionedLocalizedContent } from '@universo/types'
import {
    createCodenameVLC,
    ensureCodenameVLC,
    getCodenamePrimary,
    updateLocalizedContentLocale,
    enforceSingleLocaleCodename
} from '@universo/utils/vlc'
import { normalizeCodenameVLCAllLocales } from '@universo/utils/validation/codename'

const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

export const requiredCodenamePayloadSchema = CodenameVLCSchema
export const optionalCodenamePayloadSchema = CodenameVLCSchema.optional()

export const getCodenamePayloadText = (value: CodenameVLC | string | null | undefined): string => getCodenamePrimary(value)

export const resolveCodenamePayload = (
    value: unknown,
    fallbackPrimaryLocale: string,
    fallbackText?: string | null
): VersionedLocalizedContent<string> | null => {
    const normalizedLocale = normalizeLocaleCode(fallbackPrimaryLocale || 'en')
    const ensured = ensureCodenameVLC(value, normalizedLocale)
    if (ensured) {
        return ensured
    }

    const trimmedFallbackText = typeof fallbackText === 'string' ? fallbackText.trim() : ''
    if (!trimmedFallbackText) {
        return null
    }

    return createCodenameVLC(normalizedLocale, trimmedFallbackText)
}

export const resolveOptionalCodenamePayload = (
    value: unknown,
    fallbackPrimaryLocale: string,
    fallbackText?: string | null
): VersionedLocalizedContent<string> | null | undefined => {
    if (value === undefined) {
        return undefined
    }

    return resolveCodenamePayload(value, fallbackPrimaryLocale, fallbackText)
}

export const syncCodenamePayloadText = (
    value: unknown,
    fallbackPrimaryLocale: string,
    primaryText: string,
    style?: 'kebab-case' | 'pascal-case',
    alphabet?: 'en' | 'ru' | 'en-ru'
): VersionedLocalizedContent<string> | null => {
    const resolved = resolveCodenamePayload(value, fallbackPrimaryLocale, primaryText)
    if (!resolved) {
        return null
    }

    const synced = updateLocalizedContentLocale(resolved, resolved._primary, primaryText)

    if (!style || !alphabet) {
        return synced
    }

    return normalizeCodenameVLCAllLocales(synced, style, alphabet) ?? synced
}

export const syncOptionalCodenamePayloadText = (
    value: unknown,
    fallbackPrimaryLocale: string,
    primaryText: string,
    style?: 'kebab-case' | 'pascal-case',
    alphabet?: 'en' | 'ru' | 'en-ru'
): VersionedLocalizedContent<string> | null | undefined => {
    if (value === undefined) {
        return undefined
    }

    return syncCodenamePayloadText(value, fallbackPrimaryLocale, primaryText, style, alphabet)
}

export { enforceSingleLocaleCodename }
