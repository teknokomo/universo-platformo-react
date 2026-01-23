import stableStringifyLib from 'json-stable-stringify'

export function stableStringify(value: unknown): string {
    const result = stableStringifyLib(value)
    if (result === undefined) {
        throw new Error('Failed to stringify value')
    }
    return result
}
