/**
 * Shared safety gate for author-supplied validation regexes.
 *
 * Patterns come from design-time authors and are executed synchronously against
 * user-supplied values on write paths. Bounded value length alone does not
 * prevent catastrophic backtracking, so any pattern that can backtrack
 * exponentially is treated as unsafe and must never be executed.
 *
 * Detection strategy:
 * - Exponential backtracking requires a repeated group: nested repetition
 *   (`(a+)+`, `(.*)*`) or a repeated alternation whose branches overlap
 *   (`(a|aa)+`, `(\d|\d\d)+`). Patterns without a group quantifier can only
 *   backtrack polynomially, and polynomial work is bounded by
 *   MAX_VALIDATION_PATTERN_VALUE_LENGTH.
 * - The content of every repeated group is analyzed with `redos-detector`, a
 *   browser-safe analyzer used behind our own bounded budget. Group content is
 *   analyzed in isolation (`^(?:<content>)+$`) because whole-pattern analysis
 *   flags legitimate patterns whose polynomial ambiguity lives outside the
 *   repetition (for example email or URL validators).
 * - Alternatives considered and rejected: `safe-regex2` only limits star
 *   height, misses `(a|aa)+` and rejects the repository's canonical
 *   `^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$` pattern; `recheck` is more precise
 *   but its synchronous API needs a Node worker thread and its browser build
 *   is not suitable for this shared package.
 */

import { isSafePattern } from 'redos-detector'

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

/**
 * Bounded repetitions below this bound are left to the legacy rule above:
 * `(?:\d{1,3}\.){3}` (IPv4) and `(?:\d{3}-){2}` (phone chunks) repeat a
 * bounded number of times, so they cannot backtrack exponentially. Larger
 * bounded repetitions can still explode, so they are analyzed like unbounded
 * ones.
 */
const MAX_SKIPPED_BOUNDED_REPETITION = 16
const ANALYSIS_MAX_STEPS = 2500
const ANALYSIS_BUDGET_MS = 100
const SAFETY_CACHE_LIMIT = 256

const safetyCache = new Map<string, boolean>()

type RepetitionBounds = {
    unbounded: boolean
    max: number
}

const readRepetitionBounds = (pattern: string, start: number): RepetitionBounds | null => {
    const char = pattern[start]
    if (char === '*' || char === '+') return { unbounded: true, max: Number.POSITIVE_INFINITY }
    if (char === '?') return { unbounded: false, max: 1 }
    if (char !== '{') return null

    const quantifier = /^\{(\d+)(?:,(\d*))?\}/.exec(pattern.slice(start))
    if (!quantifier) return null
    if (quantifier[2] === undefined) return { unbounded: false, max: Number(quantifier[1]) }
    if (quantifier[2] === '') return { unbounded: true, max: Number.POSITIVE_INFINITY }
    return { unbounded: false, max: Number(quantifier[2]) }
}

const stripGroupHead = (content: string): string => {
    if (!content.startsWith('?')) return content
    if (content.startsWith('?:') || content.startsWith('?=') || content.startsWith('?!')) return content.slice(2)
    if (content.startsWith('?<=') || content.startsWith('?<!')) return content.slice(3)
    const named = /^\?<([A-Za-z_$][\w$]*)>/.exec(content)
    return named ? content.slice(named[0].length) : content.slice(1)
}

/**
 * Collects `^(?:<group content>)+$` probes for every repeated group that can
 * backtrack exponentially. The scan is escape- and character-class-aware so
 * `\)+` and `[)]*` are not mistaken for quantified groups.
 */
const collectRepetitionProbes = (pattern: string): string[] => {
    const probes: string[] = []
    const groupStarts: number[] = []
    let inCharacterClass = false

    for (let index = 0; index < pattern.length; index += 1) {
        const char = pattern[index]
        if (char === '\\') {
            index += 1
            continue
        }
        if (inCharacterClass) {
            if (char === ']') inCharacterClass = false
            continue
        }
        if (char === '[') {
            inCharacterClass = true
            continue
        }
        if (char === '(') {
            groupStarts.push(index)
            continue
        }
        if (char !== ')') continue

        const groupStart = groupStarts.pop()
        if (groupStart === undefined) continue

        const bounds = readRepetitionBounds(pattern, index + 1)
        if (!bounds) continue
        if (!bounds.unbounded && bounds.max < MAX_SKIPPED_BOUNDED_REPETITION) continue

        const content = stripGroupHead(pattern.slice(groupStart + 1, index))
        if (content.length > 0) probes.push(`^(?:${content})+$`)
    }

    return probes
}

const analyzePatternSafety = (pattern: string): boolean => {
    if (SINGLE_ATOM_GROUP_RE.test(pattern)) return false

    const probes = collectRepetitionProbes(pattern)
    if (probes.length === 0) return true

    // A pattern may contain many repeated groups; the shared budget keeps the
    // worst case bounded and fails closed once the budget is exhausted.
    const startedAt = Date.now()
    for (const probe of probes) {
        const remainingBudget = ANALYSIS_BUDGET_MS - (Date.now() - startedAt)
        if (remainingBudget <= 0) return false
        try {
            if (!isSafePattern(probe, { maxSteps: ANALYSIS_MAX_STEPS, timeout: remainingBudget }).safe) return false
        } catch {
            return false
        }
    }

    return true
}

const isSafeValidationPattern = (pattern: string): boolean => {
    const cached = safetyCache.get(pattern)
    if (cached !== undefined) return cached

    const safe = analyzePatternSafety(pattern)
    if (safetyCache.size >= SAFETY_CACHE_LIMIT) {
        const oldest = safetyCache.keys().next().value
        if (oldest !== undefined) safetyCache.delete(oldest)
    }
    safetyCache.set(pattern, safe)
    return safe
}

export function isUsableValidationPattern(pattern: unknown): pattern is string {
    return (
        typeof pattern === 'string' &&
        pattern.length > 0 &&
        pattern.length <= MAX_VALIDATION_PATTERN_LENGTH &&
        isSafeValidationPattern(pattern)
    )
}

/**
 * True for patterns that can backtrack exponentially once executed. Write paths
 * must fail closed on this result instead of silently skipping the rule,
 * otherwise authored validation would be bypassed without any feedback.
 */
export function isUnsafeValidationPattern(pattern: unknown): boolean {
    return (
        typeof pattern === 'string' &&
        pattern.length > 0 &&
        pattern.length <= MAX_VALIDATION_PATTERN_LENGTH &&
        !isSafeValidationPattern(pattern)
    )
}

export function isUsableValidationPatternValue(value: string): boolean {
    return value.length <= MAX_VALIDATION_PATTERN_VALUE_LENGTH
}
