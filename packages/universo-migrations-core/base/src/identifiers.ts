export const FIXED_SCHEMA_NAMES = new Set(['public', 'admin', 'profile', 'metahubs', 'applications', 'upl_migrations'])
export const MANAGED_DYNAMIC_SCHEMA_PATTERN = /^(app_[a-f0-9]+|mhb_[a-f0-9]+(_b[0-9]+)?)$/
export const SYNTHETIC_PLATFORM_SCOPE_KEYS = new Set(['cross_schema'])
const SIMPLE_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/

export const isFixedSchemaName = (value: string): boolean => FIXED_SCHEMA_NAMES.has(value)

export const isManagedDynamicSchemaName = (value: string): boolean => MANAGED_DYNAMIC_SCHEMA_PATTERN.test(value)

export const isCanonicalSchemaName = (value: string): boolean =>
    isFixedSchemaName(value) || isManagedDynamicSchemaName(value)

export const isSyntheticPlatformScopeKey = (value: string): boolean => SYNTHETIC_PLATFORM_SCOPE_KEYS.has(value)

export const isCanonicalPlatformScopeKey = (value: string): boolean =>
    isCanonicalSchemaName(value) || isSyntheticPlatformScopeKey(value)

export const assertCanonicalSchemaName = (value: string): void => {
    if (!isCanonicalSchemaName(value)) {
        throw new Error(`Invalid schema name: ${value}`)
    }
}

export const assertCanonicalPlatformScopeKey = (value: string): void => {
    if (!isCanonicalPlatformScopeKey(value)) {
        throw new Error(`Invalid schema name: ${value}`)
    }
}

export const assertCanonicalIdentifier = (value: string): void => {
    if (!SIMPLE_IDENTIFIER_PATTERN.test(value)) {
        throw new Error(`Invalid SQL identifier: ${value}`)
    }
}

export const quoteIdentifier = (value: string): string => {
    if (!value) {
        throw new Error('Identifier must not be empty')
    }

    return `"${value.replace(/"/g, '""')}"`
}

export const quoteQualifiedIdentifier = (schemaName: string, objectName: string): string => {
    assertCanonicalSchemaName(schemaName)
    assertCanonicalIdentifier(objectName)
    return `${quoteIdentifier(schemaName)}.${quoteIdentifier(objectName)}`
}
