import { themeTokensSchema, type ThemeOverrides, type ThemeTokens } from '@universo-react/types'

/**
 * Sparse overrides semantics (TZ §7.3): absent keys keep the preset value,
 * `null` reverts to it, and unknown keys are dropped — the strict overrides
 * schema already rejects them, this guard is defense in depth. Browser-safe:
 * no node builtins (hashing lives in ./resolve).
 */

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

export const mergeThemeTokens = (base: ThemeTokens, patch: ThemeOverrides): ThemeTokens => {
    const merged = mergeBranch(base, patch) as ThemeTokens
    const parsed = themeTokensSchema.safeParse(merged)
    if (!parsed.success) {
        throw new Error('Resolved theme tokens failed validation.')
    }
    return parsed.data
}

function mergeBranch(base: unknown, patch: unknown): unknown {
    if (patch === null || patch === undefined) return base
    if (!isPlainObject(base) || !isPlainObject(patch)) return patch
    const merged: Record<string, unknown> = { ...base }
    for (const [key, patchValue] of Object.entries(patch)) {
        if (FORBIDDEN_KEYS.has(key) || !(key in base)) continue
        merged[key] = mergeBranch(base[key], patchValue)
    }
    return merged
}
