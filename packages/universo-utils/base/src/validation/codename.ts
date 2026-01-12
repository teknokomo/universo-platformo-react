/**
 * Codename validation and normalization utilities.
 * Used for generating URL-safe, database-friendly identifiers from user input.
 */

import { slugifyCodename } from '../ui-utils/slugify'

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
 * For user input with non-ASCII characters, use sanitizeCodename instead.
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
 * Sanitize user input to valid codename format.
 * Handles transliteration (e.g., Cyrillic -> Latin) for user-friendly input.
 * Use this for frontend form fields where users may type in any language.
 *
 * @param value - Raw user input string
 * @returns Sanitized codename string
 *
 * @example
 * sanitizeCodename('Мой Проект') // 'moj-proekt'
 * sanitizeCodename('Hello World!') // 'hello-world'
 */
export const sanitizeCodename = (value: string): string => slugifyCodename(value)

/**
 * Check if a codename matches the valid pattern.
 *
 * @param value - Codename to validate
 * @returns true if codename is valid
 */
export const isValidCodename = (value: string): boolean => CODENAME_PATTERN.test(value)
