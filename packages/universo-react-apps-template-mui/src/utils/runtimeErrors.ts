import { hasRuntimeTechnicalValueLeakage } from './displayValue'

const INTERNAL_ERROR_PATTERNS: RegExp[] = [
    /\b(?:sql|postgres|postgresql|knex|supabase)\b/i,
    /\b(?:constraint|violates|violation|duplicate key|foreign key|not-null|null value|relation|schema|table|column)\b/i,
    /\b(?:syntax error|stack trace|at Object\.|at async|TypeError|ReferenceError|RangeError)\b/i,
    /\b(?:ECONN|ENOTFOUND|ETIMEDOUT|fetch failed|NetworkError)\b/i,
    /\b(?:adapter is not available|not available for this runtime adapter)\b/i,
    /\b(?:backend exploded|delete exploded)\b/i
]

const containsAsciiLettersOnly = (value: string): boolean =>
    /[A-Za-z]/.test(value) && Array.from(value).every((char) => char.charCodeAt(0) <= 0x7f)

const readResponseMessage = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null
    const record = value as Record<string, unknown>
    const responseData = (record.response as { data?: unknown } | undefined)?.data
    if (!responseData || typeof responseData !== 'object') return null
    const data = responseData as Record<string, unknown>
    const candidate = data.error ?? data.message ?? data.detail
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null
}

export const isUnsafeRuntimeErrorMessage = (message: string, locale = 'en'): boolean => {
    const trimmed = message.trim()
    if (!trimmed) return true
    if (trimmed.length > 220) return true
    if (hasRuntimeTechnicalValueLeakage(trimmed)) return true
    if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed))) return true

    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    if (normalizedLocale !== 'en' && containsAsciiLettersOnly(trimmed)) return true

    return false
}

/**
 * Rule codes map to the shared `apps` i18n bundle so every locale resolves
 * through the normal translation pipeline. The inline defaults keep the
 * contract testable before the app bundle is initialized.
 */
export const RUNTIME_RULE_ERROR_KEYS: Record<string, string> = {
    RECORD_KEY_DUPLICATE: 'errors.recordKeyDuplicate',
    RECORD_PATTERN_MISMATCH: 'errors.recordPatternMismatch'
}

export type RuntimeRuleTranslator = (key: string, locale: string) => string | null

let runtimeRuleTranslator: RuntimeRuleTranslator | null = null

/**
 * The app bootstrap registers a translator backed by the shared `apps` i18n
 * bundle. Keeping it injected avoids importing the i18n singleton (and its
 * side effects) into every module that only needs error formatting.
 */
export const configureRuntimeRuleTranslator = (translator: RuntimeRuleTranslator | null): void => {
    runtimeRuleTranslator = translator
}

export const RUNTIME_RULE_ERROR_MESSAGES: Record<string, { en: string; ru: string }> = {
    RECORD_KEY_DUPLICATE: {
        en: 'A record with the same value already exists. Change the duplicate value and try again.',
        ru: 'Запись с таким же значением уже существует. Измените дублирующееся значение и повторите попытку.'
    },
    RECORD_PATTERN_MISMATCH: {
        en: 'The value does not match the required field format. Check the value and try again.',
        ru: 'Значение не соответствует требуемому формату поля. Проверьте значение и повторите попытку.'
    }
}

export const readRuntimeErrorCode = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') return null
    const record = error as Record<string, unknown>
    const direct = record.code
    if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim()
    const responseData = (record.response as { data?: unknown } | undefined)?.data
    if (responseData && typeof responseData === 'object') {
        const nested = (responseData as Record<string, unknown>).code
        if (typeof nested === 'string' && nested.trim().length > 0) return nested.trim()
    }
    return null
}

/**
 * Rule violations raised by the runtime write paths carry stable codes, so the
 * authoring UI can explain the problem in the active locale instead of leaking
 * an English server message.
 */
export const resolveRuntimeRuleErrorMessage = (error: unknown, locale = 'en'): string | null => {
    const code = readRuntimeErrorCode(error)
    if (!code) return null
    const entry = RUNTIME_RULE_ERROR_MESSAGES[code]
    if (!entry) return null
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() === 'ru' ? 'ru' : 'en'
    const key = RUNTIME_RULE_ERROR_KEYS[code]
    if (key && runtimeRuleTranslator) {
        try {
            const translated = runtimeRuleTranslator(key, normalizedLocale)
            if (typeof translated === 'string' && translated.length > 0) return translated
        } catch {
            /* fall back to the inline copy when the bundle is unavailable */
        }
    }
    return entry[normalizedLocale]
}

export const extractRuntimeErrorMessage = (error: unknown, fallback: string, locale = 'en'): string => {
    const ruleMessage = resolveRuntimeRuleErrorMessage(error, locale)
    if (ruleMessage) return ruleMessage

    const responseMessage = readResponseMessage(error)
    const rawMessage =
        responseMessage ??
        (error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : typeof error === 'string' && error.trim().length > 0
            ? error.trim()
            : '')

    return rawMessage && !isUnsafeRuntimeErrorMessage(rawMessage, locale) ? rawMessage : fallback
}
