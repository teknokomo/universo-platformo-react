export const toTimestamp = (value: unknown): number => {
    if (value instanceof Date) return value.getTime()
    if (typeof value === 'string' || typeof value === 'number') {
        const timestamp = new Date(value).getTime()
        return Number.isNaN(timestamp) ? 0 : timestamp
    }
    return 0
}
