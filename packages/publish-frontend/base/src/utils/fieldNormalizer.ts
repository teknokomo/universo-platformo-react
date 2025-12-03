// Minimal FieldNormalizer for MVP
// All comments in English per repository guidelines

export class FieldNormalizer {
    // Normalize version group id from either camelCase or snake_case
    static normalizeVersionGroupId(input: any): string | null {
        if (!input) return null
        const vg = input?.versionGroupId ?? input?.version_group_id ?? null
        return typeof vg === 'string' && vg.length > 0 ? vg : null
    }

    // Convert a plain object's snake_case keys to camelCase (shallow)
    static toCamelCase<T extends Record<string, any>>(obj: T): T {
        if (!obj || typeof obj !== 'object') return obj
        const result: Record<string, any> = {}
        for (const key of Object.keys(obj)) {
            const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
            result[camel] = (obj as any)[key]
        }
        return result as T
    }

    // Convert a plain object's camelCase keys to snake_case (shallow)
    static toSnakeCase<T extends Record<string, any>>(obj: T): T {
        if (!obj || typeof obj !== 'object') return obj
        const result: Record<string, any> = {}
        for (const key of Object.keys(obj)) {
            const snake = key
                .replace(/([A-Z])/g, '_$1')
                .toLowerCase()
                .replace(/^_/, '')
            result[snake] = (obj as any)[key]
        }
        return result as T
    }
}
