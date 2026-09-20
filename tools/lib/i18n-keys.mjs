/**
 * Pure helpers for the i18n coverage gate. Kept dependency-free so the gate
 * logic can be unit-tested without touching the repository filesystem.
 */

export const PLURAL_SUFFIX_RE = /_(zero|one|two|few|many|other)$/u

export const flattenKeys = (value, prefix = '', into = new Set()) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [key, child] of Object.entries(value)) {
            flattenKeys(child, prefix ? `${prefix}.${key}` : key, into)
        }
    } else {
        into.add(prefix)
    }
    return into
}

export const normalizePluralKeys = (keys) => {
    const normalized = new Set()
    for (const key of keys) normalized.add(key.replace(PLURAL_SUFFIX_RE, ''))
    return normalized
}

/**
 * i18next satisfies a `t('key', { count })` lookup through the plural suffixed
 * entries (`key_one`, `key_few`, …), so a count-aware callsite also accepts a
 * base key whenever any plural variant exists.
 */
export const buildResolvableKeySet = (keys) => {
    const resolvable = new Set(keys)
    for (const key of keys) resolvable.add(key.replace(PLURAL_SUFFIX_RE, ''))
    return resolvable
}

export const lineOffsetsOf = (source) => {
    const offsets = [0]
    for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '\n') offsets.push(index + 1)
    }
    return offsets
}

export const lineAt = (offsets, position) => {
    let low = 0
    let high = offsets.length - 1
    while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (offsets[middle] <= position) low = middle
        else high = middle - 1
    }
    return low + 1
}

/**
 * Detects duplicate object keys per JSON object. `JSON.parse` keeps the last
 * duplicate silently, which hides content authors losing earlier values.
 * Keys are compared by their parsed value so `"a"` and `"\u0061"` collide.
 */
export const findDuplicateKeys = (source) => {
    const duplicates = []
    const lineOffsets = lineOffsetsOf(source)
    const stack = []
    let inString = false
    let escaped = false
    let stringStart = -1
    let pendingKey = null
    let expectKey = false
    for (let index = 0; index < source.length; index += 1) {
        const character = source[index]
        if (inString) {
            if (escaped) escaped = false
            else if (character === '\\') escaped = true
            else if (character === '"') {
                inString = false
                if (expectKey) {
                    const rawKey = source.slice(stringStart, index)
                    try {
                        pendingKey = JSON.parse(`"${rawKey}"`)
                    } catch {
                        pendingKey = rawKey
                    }
                    expectKey = false
                }
            }
            continue
        }
        if (character === '"') {
            inString = true
            stringStart = index + 1
            continue
        }
        if (character === '{') {
            stack.push(new Set())
            pendingKey = null
            expectKey = true
            continue
        }
        if (character === '}') {
            stack.pop()
            pendingKey = null
            expectKey = false
            continue
        }
        if (character === '[' || character === ']') {
            pendingKey = null
            expectKey = false
            continue
        }
        if (character === ':') {
            const current = stack[stack.length - 1]
            if (pendingKey !== null && current) {
                if (current.has(pendingKey)) duplicates.push({ key: pendingKey, line: lineAt(lineOffsets, index) })
                else current.add(pendingKey)
            }
            pendingKey = null
            expectKey = false
            continue
        }
        if (character === ',') {
            if (stack.length > 0) expectKey = true
            continue
        }
    }
    return duplicates
}

/**
 * Refuses vacuous gate passes: a scan that finds no source files or no literal
 * translation keys means the scanner or its configuration broke, not that the
 * package is clean.
 */
export function describeVacuousScan({ name, sourceFileCount, literalKeyCount, minLiteralKeys = 1 }) {
    if (sourceFileCount === 0) {
        return `${name}: no source files were scanned; check the configured source root`
    }
    if (literalKeyCount < minLiteralKeys) {
        return `${name}: only ${literalKeyCount} literal translation key(s) found, expected at least ${minLiteralKeys}`
    }
    return null
}

/**
 * Shared dialog primitives must not ship English prop defaults for the discard
 * confirmation: callers rarely override them and a localized UI would then show
 * English copy. Flag literal defaults on the known discard props.
 */
export function findHardcodedDiscardDefaults(source) {
    const matches = []
    const pattern = /(?:discardChanges(?:Title|Description|ConfirmButtonText|CancelButtonText))\s*=\s*'([^']+)'/gu
    let match
    while ((match = pattern.exec(source)) !== null) {
        matches.push({ value: match[1], index: match.index })
    }
    return matches
}
