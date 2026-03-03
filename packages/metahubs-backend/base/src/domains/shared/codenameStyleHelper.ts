import type { MetahubSettingsService } from '../settings/services/MetahubSettingsService'
import type { CodenameStyle, CodenameAlphabet } from '@universo/types'

const DEFAULT_STYLE: CodenameStyle = 'pascal-case'
const DEFAULT_ALPHABET: CodenameAlphabet = 'en-ru'
const DEFAULT_ALLOW_MIXED = false

/**
 * Human-readable error message for codename validation failures.
 * Used by all entity route handlers (catalogs, hubs, enumerations, attributes).
 */
export const codenameErrorMessage = (style: CodenameStyle, alphabet: CodenameAlphabet = 'en-ru', allowMixed = true): string => {
    const alphabetDesc: Record<CodenameAlphabet, string> = {
        en: 'English letters',
        ru: 'Russian letters',
        'en-ru': allowMixed ? 'English and Russian letters (can be mixed)' : 'English or Russian letters (no mixing)'
    }

    if (style === 'pascal-case') {
        return `Codename must start with an uppercase letter and contain only ${alphabetDesc[alphabet]}, digits, and underscores (PascalCase)`
    }
    return `Codename must contain only lowercase ${alphabetDesc[alphabet]}, digits, and hyphens (kebab-case)`
}

/**
 * Read the codename style setting for a metahub.
 * Returns 'pascal-case' if not set.
 */
export async function getCodenameStyle(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<CodenameStyle> {
    try {
        const row = await settingsService.findByKey(metahubId, 'general.codenameStyle', userId)
        const style = row?.value?._value
        if (style === 'kebab-case' || style === 'pascal-case') return style
    } catch {
        return DEFAULT_STYLE
    }
    return DEFAULT_STYLE
}

/**
 * Read the codename alphabet setting for a metahub.
 * Returns 'en-ru' if not set.
 */
export async function getCodenameAlphabet(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<CodenameAlphabet> {
    try {
        const row = await settingsService.findByKey(metahubId, 'general.codenameAlphabet', userId)
        const alphabet = row?.value?._value
        if (alphabet === 'en' || alphabet === 'ru' || alphabet === 'en-ru') return alphabet
    } catch {
        return DEFAULT_ALPHABET
    }
    return DEFAULT_ALPHABET
}

/**
 * Read the allow-mixed-alphabets setting for a metahub.
 * Returns false if not set.
 */
export async function getAllowMixedAlphabets(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'general.codenameAllowMixedAlphabets', userId)
        const val = row?.value?._value
        return val === true
    } catch {
        return DEFAULT_ALLOW_MIXED
    }
}

/**
 * Read all codename settings in parallel (1 round-trip instead of 3).
 * Returns { style, alphabet, allowMixed }.
 */
export async function getCodenameSettings(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<{ style: CodenameStyle; alphabet: CodenameAlphabet; allowMixed: boolean }> {
    try {
        const [styleRow, alphabetRow, mixedRow] = await Promise.all([
            settingsService.findByKey(metahubId, 'general.codenameStyle', userId),
            settingsService.findByKey(metahubId, 'general.codenameAlphabet', userId),
            settingsService.findByKey(metahubId, 'general.codenameAllowMixedAlphabets', userId)
        ])
        const style = styleRow?.value?._value
        const alphabet = alphabetRow?.value?._value
        const mixed = mixedRow?.value?._value

        return {
            style: style === 'kebab-case' || style === 'pascal-case' ? style : DEFAULT_STYLE,
            alphabet: alphabet === 'en' || alphabet === 'ru' || alphabet === 'en-ru' ? alphabet : DEFAULT_ALPHABET,
            allowMixed: mixed === true
        }
    } catch {
        return {
            style: DEFAULT_STYLE,
            alphabet: DEFAULT_ALPHABET,
            allowMixed: DEFAULT_ALLOW_MIXED
        }
    }
}

/**
 * Read attribute codename uniqueness scope setting.
 * Returns 'per-level' if not set (current default behavior).
 */
export async function getAttributeCodenameScope(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<'per-level' | 'global'> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.attributeCodenameScope', userId)
        const scope = row?.value?._value
        if (scope === 'per-level' || scope === 'global') return scope
    } catch {
        return 'per-level'
    }
    return 'per-level'
}

/**
 * Read allowed attribute types setting.
 * Returns all types if not set.
 */
export async function getAllowedAttributeTypes(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<string[]> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowedAttributeTypes', userId)
        const types = row?.value?._value
        if (Array.isArray(types) && types.length > 0) return types
    } catch {
        return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE']
    }
    return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE']
}

/**
 * Read allow-attribute-copy setting.
 * Returns true if not set.
 */
export async function getAllowAttributeCopy(settingsService: MetahubSettingsService, metahubId: string, userId?: string): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowAttributeCopy', userId)
        const value = row?.value?._value
        return value !== false
    } catch {
        return true
    }
}

/**
 * Read allow-attribute-delete setting.
 * Returns true if not set.
 */
export async function getAllowAttributeDelete(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowAttributeDelete', userId)
        const value = row?.value?._value
        return value !== false
    } catch {
        return true
    }
}

/**
 * Read allow-delete-last-display-attribute setting.
 * Returns true if not set.
 */
export async function getAllowDeleteLastDisplayAttribute(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowDeleteLastDisplayAttribute', userId)
        const value = row?.value?._value
        return value !== false
    } catch {
        return true
    }
}

/**
 * Read allow-move-between-root-and-children setting.
 * Returns true if not set.
 */
export async function getAllowAttributeMoveBetweenRootAndChildren(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowAttributeMoveBetweenRootAndChildren', userId)
        const value = row?.value?._value
        return value !== false
    } catch {
        return true
    }
}

/**
 * Read allow-move-between-child-lists setting.
 * Returns true if not set.
 */
export async function getAllowAttributeMoveBetweenChildLists(
    settingsService: MetahubSettingsService,
    metahubId: string,
    userId?: string
): Promise<boolean> {
    try {
        const row = await settingsService.findByKey(metahubId, 'catalogs.allowAttributeMoveBetweenChildLists', userId)
        const value = row?.value?._value
        return value !== false
    } catch {
        return true
    }
}

// ─── Codename attempt builder ────────────────────────────────────────────────

/**
 * Build a codename candidate with an optional numeric suffix for retry loops.
 * Attempt 1 returns the bare codename; attempt ≥ 2 appends a separator + number.
 * Truncates the base so the result never exceeds the style length limit (100/80).
 */
export function buildCodenameAttempt(baseCodename: string, attempt: number, style: CodenameStyle = 'kebab-case'): string {
    if (attempt <= 1) return baseCodename

    const attemptSuffix = `${attempt}`
    const limit = style === 'pascal-case' ? 80 : 100
    const maxLength = Math.max(1, limit - attemptSuffix.length)
    return `${baseCodename.slice(0, maxLength)}${attemptSuffix}`
}

// ─── Batch extract helpers (avoid N+1 queries) ──────────────────────────────

type SettingsRow = { key: string; value: Record<string, unknown> }

/** Extract a setting value from a pre-loaded settings array. */
function extractValue(settings: SettingsRow[], key: string): unknown {
    const row = settings.find((s) => s.key === key)
    return row?.value?._value
}

/** Extract codename style from pre-loaded settings. */
export function extractCodenameStyle(settings: SettingsRow[]): CodenameStyle {
    const style = extractValue(settings, 'general.codenameStyle')
    if (style === 'kebab-case' || style === 'pascal-case') return style
    return DEFAULT_STYLE
}

/** Extract codename alphabet from pre-loaded settings. */
export function extractCodenameAlphabet(settings: SettingsRow[]): CodenameAlphabet {
    const alphabet = extractValue(settings, 'general.codenameAlphabet')
    if (alphabet === 'en' || alphabet === 'ru' || alphabet === 'en-ru') return alphabet
    return DEFAULT_ALPHABET
}

/** Extract allow-mixed-alphabets from pre-loaded settings. */
export function extractAllowMixedAlphabets(settings: SettingsRow[]): boolean {
    const val = extractValue(settings, 'general.codenameAllowMixedAlphabets')
    return val === true
}

/** Extract attribute codename scope from pre-loaded settings. */
export function extractAttributeCodenameScope(settings: SettingsRow[]): 'per-level' | 'global' {
    const scope = extractValue(settings, 'catalogs.attributeCodenameScope')
    if (scope === 'per-level' || scope === 'global') return scope
    return 'per-level'
}

/** Extract allowed attribute types from pre-loaded settings. */
export function extractAllowedAttributeTypes(settings: SettingsRow[]): string[] {
    const types = extractValue(settings, 'catalogs.allowedAttributeTypes')
    if (Array.isArray(types) && types.length > 0) return types
    return ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE']
}
