/**
 * Codename validation and normalization utilities.
 * Used for generating URL-safe, database-friendly identifiers from user input.
 */

/**
 * Pattern for valid codenames: lowercase alphanumeric with hyphens.
 * Examples: "my-hub", "user-profile-2024", "a1b2c3"
 *
 * Rules:
 * - Must start and end with alphanumeric
 * - Only lowercase letters, digits, and hyphens allowed
 * - No consecutive hyphens
 * - No underscores (use hyphens instead)
 */
export const CODENAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Normalize a string to valid codename format.
 * This is a basic normalization without transliteration.
 * For user input with non-ASCII characters, use slugifyCodename from ui-utils/slugify.
 *
 * Transformations:
 * - Lowercase
 * - Replace spaces and underscores with hyphens
 * - Remove non-alphanumeric characters except hyphens
 * - Collapse multiple hyphens
 * - Trim leading/trailing hyphens
 *
 * @param value - Input string to normalize
 * @returns Normalized codename string
 */
export const normalizeCodename = (value: string): string =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')

/**
 * Check if a codename matches the valid pattern.
 *
 * @param value - Codename to validate
 * @returns true if codename is valid
 */
export const isValidCodename = (value: string): boolean => CODENAME_PATTERN.test(value)
