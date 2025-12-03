// Base58 validation utilities for publication links

export const isValidBase58 = (slug: string): boolean => {
    if (!slug || slug.length < 8) return false

    // Base58 alphabet (excludes 0, O, I, l for readability)
    const base58Regex = /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/
    return base58Regex.test(slug)
}

export const formatPublishLink = (baseSlug: string, targetType: 'group' | 'version'): string => {
    if (!isValidBase58(baseSlug)) {
        console.warn(`Invalid Base58 slug: ${baseSlug}`)
        return `/${baseSlug}` // Fallback for display
    }

    const prefix = targetType === 'group' ? 'p' : 'b'
    return `/${prefix}/${baseSlug}`
}
