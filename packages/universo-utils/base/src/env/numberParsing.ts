/**
 * Parses a positive integer from environment-like input.
 * Returns fallback when value is missing, NaN, or <= 0.
 */
export const parsePositiveInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? '', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

/**
 * Parses a non-negative integer from environment-like input.
 * Returns fallback when value is missing, NaN, or < 0.
 */
export const parseNonNegativeInt = (value: string | undefined, fallback: number): number => {
    const parsed = Number.parseInt(value ?? '', 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
