export const IDENTIFIER_REGEX = /^[a-z_][a-z0-9_]*$/

/** Quote a validated PostgreSQL identifier after it has crossed the metadata boundary. */
export const quoteIdentifier = (identifier: string): string => {
    if (!IDENTIFIER_REGEX.test(identifier)) {
        throw new Error(`Unsafe identifier: ${identifier}`)
    }
    return `"${identifier}"`
}
