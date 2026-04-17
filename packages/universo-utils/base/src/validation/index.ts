export { schemas } from './schemas'
export {
    CODENAME_PATTERN,
    CODENAME_KEBAB_RU_PATTERN,
    CODENAME_KEBAB_EN_RU_PATTERN,
    CODENAME_PASCAL_PATTERN,
    CODENAME_PASCAL_EN_PATTERN,
    CODENAME_PASCAL_RU_PATTERN,
    normalizeCodename,
    normalizeKebabRuCodename,
    normalizeKebabEnRuCodename,
    normalizePascalCodename,
    normalizePascalEnCodename,
    normalizePascalRuCodename,
    normalizeCodenameForStyle,
    isValidCodename,
    isValidKebabRuCodename,
    isValidKebabEnRuCodename,
    isValidPascalCodename,
    isValidPascalEnCodename,
    isValidPascalRuCodename,
    isValidCodenameForStyle,
    hasMixedAlphabets,
    autoConvertMixedAlphabetsByFirstSymbol,
    getCanonicalCodenameText,
    sanitizeCodename,
    sanitizeCodenameForStyle,
    sanitizeCodenameToVLC,
    normalizeCodenameVLC,
    normalizeCodenameVLCAllLocales
} from './codename'
export {
    normalizeApplicationCopyOptions,
    normalizeFieldDefinitionCopyOptions,
    normalizeBranchCopyOptions,
    normalizeRecordCopyOptions,
    normalizeTreeEntityCopyOptions,
    normalizeLinkedCollectionCopyOptions,
    normalizeValueGroupCopyOptions,
    normalizeOptionListCopyOptions,
    normalizeLayoutCopyOptions,
    normalizeFixedValueCopyOptions
} from './copyOptions'
export {
    extractLinkedCollectionLayoutBehaviorConfig,
    normalizeLinkedCollectionRuntimeViewConfig,
    resolveLinkedCollectionLayoutBehaviorConfig,
    sanitizeLinkedCollectionRuntimeViewConfig,
    setLinkedCollectionLayoutBehaviorConfig,
    resolveLinkedCollectionRuntimeDashboardLayoutConfig
} from './linkedCollectionRuntimeConfig'
export { normalizeDashboardLayoutConfig } from './dashboardLayout'
export {
    validateNumber,
    validateNumberOrThrow,
    getMaxValueForPrecision,
    toNumberRules,
    NUMBER_DEFAULTS,
    type NumberValidationResult,
    type NumberValidationRules
} from './numberValidation'
export { buildTableConstraintText, type TranslateFn, type TableConstraintParams, type TableConstraintResult } from './tableConstraints'
