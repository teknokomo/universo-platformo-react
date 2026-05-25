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

export const extractRuntimeErrorMessage = (error: unknown, fallback: string, locale = 'en'): string => {
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
