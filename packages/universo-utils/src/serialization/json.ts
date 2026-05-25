export type SafeParseResult<T> = { ok: true; value: T } | { ok: false; error: Error }

export function safeParseJson<T = unknown>(raw: string): SafeParseResult<T> {
    try {
        const value = JSON.parse(raw) as T
        return { ok: true, value }
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e : new Error('Invalid JSON') }
    }
}
