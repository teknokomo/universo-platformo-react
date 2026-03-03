import { getSettingDefinition } from '@universo/types'

/**
 * Validate a setting value against its registry definition.
 * Returns an error message if invalid, or null if valid.
 */
export function validateSettingValue(key: string, value: Record<string, unknown>, selectOptions?: readonly string[]): string | null {
    const def = getSettingDefinition(key)
    if (!def) return `Unknown setting key: ${key}`

    const actual = value._value
    if (actual === undefined) return `Value must contain _value field`

    switch (def.valueType) {
        case 'boolean':
            if (typeof actual !== 'boolean') return `Setting "${key}" expects boolean value`
            break
        case 'number':
            if (typeof actual !== 'number') return `Setting "${key}" expects number value`
            break
        case 'string':
            if (typeof actual !== 'string') return `Setting "${key}" expects string value`
            break
        case 'select': {
            if (typeof actual !== 'string') return `Setting "${key}" expects string value`
            if (key === 'general.language') {
                if (actual.trim().length === 0) {
                    return `Setting "${key}" expects non-empty string value`
                }
                if (Array.isArray(selectOptions) && selectOptions.length > 0 && !selectOptions.includes(actual)) {
                    return `Setting "${key}" value must be one of: ${selectOptions.join(', ')}`
                }
                break
            }
            if (def.options && !def.options.includes(actual)) {
                return `Setting "${key}" value must be one of: ${def.options.join(', ')}`
            }
            break
        }
        case 'multiselect':
            if (!Array.isArray(actual)) return `Setting "${key}" expects array value`
            if (def.options) {
                const invalid = actual.filter((v: unknown) => typeof v !== 'string' || !def.options!.includes(v))
                if (invalid.length > 0) {
                    return `Setting "${key}" contains invalid options: ${invalid.join(', ')}. Allowed: ${def.options.join(', ')}`
                }
            }
            break
    }
    return null
}
