import type { TFunction } from 'i18next'

/**
 * Stable runtime error codes — `ECONOMY_*` (economy, TZ DOC-2026-005 §8.4) and
 * `MINING_*` (mining, TZ DOC-2026-006 §8.2) — localize through the single
 * `runtime.economyErrors.*` i18n block; anything else stays generic so internal
 * details never leak into user-facing surfaces.
 */
const RUNTIME_ERROR_CODE_PATTERN = /^(ECONOMY_|MINING_)/

export const extractRuntimeErrorCode = (error: unknown): string | null => {
    const candidate = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : null
    return typeof candidate === 'string' && RUNTIME_ERROR_CODE_PATTERN.test(candidate) ? candidate : null
}

export const localizeRuntimeError = (error: unknown, t: TFunction<'apps'>): string => {
    const code = extractRuntimeErrorCode(error)
    if (!code) return t('runtime.economyErrors.generic')
    const serverMessage = error instanceof Error && error.message.trim().length > 0 ? error.message : undefined
    return t(`runtime.economyErrors.${code}`, { defaultValue: serverMessage })
}
