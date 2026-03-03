// Re-export centralized codename utilities from @universo/utils
export {
    // Patterns
    CODENAME_PATTERN,
    CODENAME_KEBAB_RU_PATTERN,
    CODENAME_KEBAB_EN_RU_PATTERN,
    CODENAME_PASCAL_PATTERN,
    CODENAME_PASCAL_EN_PATTERN,
    CODENAME_PASCAL_RU_PATTERN,
    // Single-alphabet validators
    isValidCodename,
    isValidKebabRuCodename,
    isValidKebabEnRuCodename,
    isValidPascalCodename,
    isValidPascalEnCodename,
    isValidPascalRuCodename,
    // Mixed-alphabet helper
    hasMixedAlphabets,
    autoConvertMixedAlphabetsByFirstSymbol,
    // Style-aware validation
    isValidCodenameForStyle,
    // Normalizers
    normalizeCodename,
    normalizeKebabRuCodename,
    normalizeKebabEnRuCodename,
    normalizePascalCodename,
    normalizePascalEnCodename,
    normalizePascalRuCodename,
    normalizeCodenameForStyle,
    // Sanitizers (auto-generate from name)
    sanitizeCodename,
    sanitizeCodenameForStyle
} from '@universo/utils/validation/codename'
