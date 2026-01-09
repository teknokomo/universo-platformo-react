import { slugifyCodename } from '@universo/utils/ui-utils/slugify'
import { CODENAME_PATTERN, isValidCodename as isValidCodenameBase } from '@universo/utils/validation/codename'

/**
 * Sanitize user input to valid codename format.
 * Uses slugifyCodename which handles transliteration (e.g., Cyrillic -> Latin).
 */
export const sanitizeCodename = (value: string) => slugifyCodename(value)

/**
 * Check if a codename matches the valid pattern.
 * Re-exported from shared utils for convenience.
 */
export const isValidCodename = isValidCodenameBase

// Re-export pattern for consumers that need it
export { CODENAME_PATTERN }
