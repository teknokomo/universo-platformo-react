/**
 * Number validation utilities for precision/scale constraints.
 *
 * PostgreSQL NUMERIC(precision, scale) rules:
 * - precision: total significant digits (1-38 in PostgreSQL, but limited to 1-15 here)
 * - scale: digits after decimal point (0 to precision-1, at least 1 integer digit required)
 * - max integer digits = precision - scale
 *
 * JavaScript limitations (why we limit to 15 digits):
 * - Numbers > Number.MAX_SAFE_INTEGER (2^53-1 = 9007199254740991) lose precision
 * - All numbers are stored as IEEE-754 double precision floats (~15-17 significant digits)
 */

export interface NumberValidationResult {
    /** Whether the value passes validation */
    valid: boolean
    /** Error message key (English) for invalid values */
    errorKey?: string
    /** Error message with interpolated values */
    errorMessage?: string
    /** Interpolation values for error message */
    errorParams?: Record<string, number>
    /** Normalized value rounded to scale (only if valid) */
    normalizedValue?: number
}

export interface NumberValidationRules {
    /** Total significant digits (1-38), default 10 */
    precision?: number
    /** Digits after decimal point (0-precision), default 2 */
    scale?: number
    /** Minimum allowed value */
    min?: number | null
    /** Maximum allowed value */
    max?: number | null
    /** Only allow non-negative values (>= 0) */
    nonNegative?: boolean
}

/**
 * Default precision/scale values matching PostgreSQL NUMERIC defaults.
 * 
 * Note: maxPrecision is limited to 15 (not PostgreSQL's 38) because JavaScript
 * numbers lose precision beyond Number.MAX_SAFE_INTEGER (2^53-1 = ~16 digits).
 */
export const NUMBER_DEFAULTS = {
    precision: 10,
    scale: 2,
    minPrecision: 1,
    maxPrecision: 15
} as const

/**
 * Calculate max allowed value for given precision/scale.
 *
 * @example
 * getMaxValueForPrecision(10, 2) → 99999999.99 (8 integer digits + 2 decimal)
 * getMaxValueForPrecision(5, 0) → 99999 (5 integer digits, no decimal)
 */
export function getMaxValueForPrecision(precision: number, scale: number): number {
    const integerDigits = precision - scale
    if (integerDigits <= 0) return 0

    // Calculate max integer part: 10^n - 1
    const maxInteger = Math.pow(10, integerDigits) - 1

    if (scale === 0) return maxInteger

    // Add decimal part: 0.99...9 (scale digits)
    const decimalPart = (Math.pow(10, scale) - 1) / Math.pow(10, scale)
    return maxInteger + decimalPart
}

/**
 * Count integer digits (digits before decimal point).
 * Returns 1 for zero and for values between -1 and 1 (the leading "0" in "0.xxx").
 * This matches PostgreSQL NUMERIC behavior where NUMERIC(p,s) always requires at least 1 integer digit.
 */
function countIntegerDigits(value: number): number {
    const absValue = Math.abs(value)
    // Zero has 1 integer digit (the "0")
    if (absValue === 0) return 1
    // Values between -1 and 1 (exclusive) have 1 integer digit (the leading "0" in "0.xxx")
    if (absValue < 1) return 1
    return Math.floor(Math.log10(absValue)) + 1
}

/**
 * Count actual decimal digits (excluding trailing zeros).
 */
function countDecimalDigits(value: number): number {
    if (!Number.isFinite(value)) return 0

    const strValue = String(value)
    const decimalIdx = strValue.indexOf('.')
    if (decimalIdx === -1) return 0

    // Handle scientific notation
    const eIdx = strValue.indexOf('e')
    if (eIdx !== -1) {
        // For scientific notation, extract mantissa decimal part
        const mantissa = strValue.slice(0, eIdx)
        const mantissaDecIdx = mantissa.indexOf('.')
        if (mantissaDecIdx === -1) return 0
        return mantissa.length - mantissaDecIdx - 1
    }

    // Remove trailing zeros for accurate count
    const decimalPart = strValue.slice(decimalIdx + 1).replace(/0+$/, '')
    return decimalPart.length
}

/**
 * Validates a number value against precision/scale rules.
 *
 * @param value - The value to validate (should be a number)
 * @param rules - Validation rules (precision, scale, min, max, nonNegative)
 * @returns Validation result with error details if invalid
 *
 * @example
 * // Valid: 12345678.99 fits precision=10, scale=2
 * validateNumber(12345678.99, { precision: 10, scale: 2 })
 * // → { valid: true, normalizedValue: 12345678.99 }
 *
 * // Invalid: 123456789.99 has 9 integer digits, max is 8
 * validateNumber(123456789.99, { precision: 10, scale: 2 })
 * // → { valid: false, errorKey: 'tooManyIntegerDigits', ... }
 */
export function validateNumber(
    value: unknown,
    rules: NumberValidationRules = {}
): NumberValidationResult {
    // Type check
    if (typeof value !== 'number') {
        return {
            valid: false,
            errorKey: 'notANumber',
            errorMessage: 'Expected a number'
        }
    }

    // NaN/Infinity check
    if (!Number.isFinite(value)) {
        return {
            valid: false,
            errorKey: 'notFinite',
            errorMessage: 'Value must be a finite number (not NaN or Infinity)'
        }
    }

    // Normalize rules with defaults
    const precision = Math.min(
        Math.max(NUMBER_DEFAULTS.minPrecision, rules.precision ?? NUMBER_DEFAULTS.precision),
        NUMBER_DEFAULTS.maxPrecision
    )
    // Validate scale: must be 0 to precision-1 (at least 1 integer digit required)
    const scale = rules.scale ?? NUMBER_DEFAULTS.scale
    if (scale < 0 || scale >= precision) {
        return {
            valid: false,
            errorKey: 'invalidScale',
            errorMessage: `Scale (${scale}) must be between 0 and ${precision - 1} (less than precision)`,
            errorParams: { scale, precision, maxScale: precision - 1 }
        }
    }
    const maxIntegerDigits = precision - scale

    // Check nonNegative
    if (rules.nonNegative === true && value < 0) {
        return {
            valid: false,
            errorKey: 'mustBeNonNegative',
            errorMessage: 'Value must be non-negative'
        }
    }

    // Check explicit min
    if (typeof rules.min === 'number' && value < rules.min) {
        return {
            valid: false,
            errorKey: 'belowMinimum',
            errorMessage: `Value must be at least ${rules.min}`,
            errorParams: { min: rules.min }
        }
    }

    // Check explicit max
    if (typeof rules.max === 'number' && value > rules.max) {
        return {
            valid: false,
            errorKey: 'aboveMaximum',
            errorMessage: `Value must be at most ${rules.max}`,
            errorParams: { max: rules.max }
        }
    }

    // Check JavaScript precision loss (numbers > 2^53 - 1)
    const absValue = Math.abs(value)
    if (absValue > Number.MAX_SAFE_INTEGER) {
        return {
            valid: false,
            errorKey: 'exceedsSafeInteger',
            errorMessage: 'Number is too large for precise representation (max 15 significant digits)'
        }
    }

    // Count integer digits
    const integerDigits = countIntegerDigits(value)
    if (integerDigits > maxIntegerDigits) {
        return {
            valid: false,
            errorKey: 'tooManyIntegerDigits',
            errorMessage: `Too many digits before decimal: ${integerDigits} (max ${maxIntegerDigits})`,
            errorParams: { actual: integerDigits, max: maxIntegerDigits }
        }
    }

    // Count decimal digits
    const decimalDigits = countDecimalDigits(value)
    if (decimalDigits > scale) {
        return {
            valid: false,
            errorKey: 'tooManyDecimalDigits',
            errorMessage: `Too many decimal places: ${decimalDigits} (max ${scale})`,
            errorParams: { actual: decimalDigits, max: scale }
        }
    }

    // Normalize: round to scale decimal places
    const normalizedValue = scale > 0
        ? Number(value.toFixed(scale))
        : Math.trunc(value)

    return { valid: true, normalizedValue }
}

/**
 * Validates and returns the normalized value, or throws an error.
 * Use in backend services where invalid data should halt execution.
 *
 * @throws Error with detailed message if validation fails
 */
export function validateNumberOrThrow(
    value: unknown,
    rules: NumberValidationRules,
    context: { fieldName: string; elementId?: string }
): number | null {
    if (value === null || value === undefined) {
        return null
    }

    const result = validateNumber(value, rules)

    if (!result.valid) {
        const prefix = context.elementId
            ? `Element ${context.elementId}, field "${context.fieldName}"`
            : `Field "${context.fieldName}"`

        throw new Error(`${prefix}: ${result.errorMessage}`)
    }

    return result.normalizedValue ?? null
}
