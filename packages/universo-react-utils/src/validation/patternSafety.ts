/**
 * Shared safety gate for author-supplied validation regexes.
 *
 * Patterns come from design-time authors and are executed synchronously against
 * user-supplied values on write paths. Bounded length alone does not prevent
 * catastrophic backtracking, so patterns with nested quantifiers are treated as
 * unusable and skipped on both surfaces instead of risking an event-loop stall.
 */

export const MAX_VALIDATION_PATTERN_LENGTH = 512
export const MAX_VALIDATION_PATTERN_VALUE_LENGTH = 4096

/**
 * A group whose entire content is one (optionally quantified) atom, followed by
 * another quantifier: `(a+)+`, `(.*)*`, `([a-z]+)*`. The classic catastrophic
 * shapes. Groups with an additional mandatory atom (for example
 * `(?:[._-][a-z0-9]+)*`) stay usable because every repetition consumes at least
 * one required literal character.
 */
const SINGLE_ATOM_GROUP_RE = /\(\??:?(?:\\[wdsWDS]|\[[^\]]*\]|\.|[^\\()[\]{}])[*+?]?\)\s*[*+{]/

export function isUsableValidationPattern(pattern: unknown): pattern is string {
    return (
        typeof pattern === 'string' &&
        pattern.length > 0 &&
        pattern.length <= MAX_VALIDATION_PATTERN_LENGTH &&
        !SINGLE_ATOM_GROUP_RE.test(pattern)
    )
}

export function isUsableValidationPatternValue(value: string): boolean {
    return value.length <= MAX_VALIDATION_PATTERN_VALUE_LENGTH
}
