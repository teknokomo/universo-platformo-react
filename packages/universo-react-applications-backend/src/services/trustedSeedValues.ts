type TrustedSeedValueInput = {
    hasTrustedValue: boolean
    trustedValue: unknown
    hasMetadataDefault: boolean
    metadataDefault: unknown
    resetOnCopy: boolean
}

type TrustedSeedValueResolution = { hasValue: true; value: unknown } | { hasValue: false }

/** Trusted seed content wins over defaults unless the field explicitly resets on copy. */
export const resolveTrustedServerOwnedSeedValue = (input: TrustedSeedValueInput): TrustedSeedValueResolution => {
    const hasTrustedValue = input.hasTrustedValue && input.trustedValue !== undefined
    const hasMetadataDefault = input.hasMetadataDefault && input.metadataDefault !== undefined
    if (hasMetadataDefault && (input.resetOnCopy || !hasTrustedValue)) {
        return { hasValue: true, value: input.metadataDefault }
    }
    if (hasTrustedValue) return { hasValue: true, value: input.trustedValue }
    return { hasValue: false }
}
