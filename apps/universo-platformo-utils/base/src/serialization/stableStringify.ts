export function stableStringify(value: unknown): string {
    const seen = new WeakSet<object>()
    const sort = (v: any): any => {
        if (v === null || typeof v !== 'object') return v
        if (seen.has(v)) throw new Error('Circular reference')
        seen.add(v)
        if (Array.isArray(v)) return v.map(sort)
        const out: Record<string, any> = {}
        for (const k of Object.keys(v).sort()) out[k] = sort(v[k])
        return out
    }
    return JSON.stringify(sort(value))
}
