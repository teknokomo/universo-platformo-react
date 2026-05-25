export const FIXED_SCHEMA_NAMES = new Set(['public', 'admin', 'profiles', 'metahubs', 'applications', 'start', 'upl_migrations'])
export const MANAGED_DYNAMIC_SCHEMA_PATTERN = /^(app_[a-f0-9]+|mhb_[a-f0-9]+(_b[0-9]+)?)$/
export const SYNTHETIC_PLATFORM_SCOPE_KEYS = new Set(['cross_schema'])
const SIMPLE_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/
const RAW_MANAGED_OWNER_ID_PATTERN = /^[a-f0-9]{32}$/
const UUID_MANAGED_OWNER_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/

const normalizeManagedOwnerId = (value: string): string => {
    const normalizedValue = value.trim().toLowerCase()

    if (RAW_MANAGED_OWNER_ID_PATTERN.test(normalizedValue)) {
        return normalizedValue
    }

    if (UUID_MANAGED_OWNER_ID_PATTERN.test(normalizedValue)) {
        return normalizedValue.replace(/-/g, '')
    }

    throw new Error('Managed schema ownerId must be a canonical UUID or a 32-character hexadecimal identifier')
}

export const isFixedSchemaName = (value: string): boolean => FIXED_SCHEMA_NAMES.has(value)

export const isManagedDynamicSchemaName = (value: string): boolean => MANAGED_DYNAMIC_SCHEMA_PATTERN.test(value)

export const isManagedCustomSchemaName = (value: string): boolean => {
    if (!SIMPLE_IDENTIFIER_PATTERN.test(value)) {
        return false
    }

    return !isFixedSchemaName(value) && !isManagedDynamicSchemaName(value) && !isSyntheticPlatformScopeKey(value)
}

export const isCanonicalSchemaName = (value: string): boolean => isFixedSchemaName(value) || isManagedDynamicSchemaName(value)

export const isSyntheticPlatformScopeKey = (value: string): boolean => SYNTHETIC_PLATFORM_SCOPE_KEYS.has(value)

export const isCanonicalPlatformScopeKey = (value: string): boolean => isCanonicalSchemaName(value) || isSyntheticPlatformScopeKey(value)

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

export const assertManagedCustomSchemaName = (value: string): void => {
    if (!isManagedCustomSchemaName(value)) {
        throw new Error(`Invalid managed custom schema name: ${value}`)
    }
}

export const buildManagedDynamicSchemaName = (options: { prefix: 'app' | 'mhb'; ownerId: string; branchNumber?: number }): string => {
    const normalizedOwnerId = normalizeManagedOwnerId(options.ownerId)

    if (options.branchNumber !== undefined) {
        if (!Number.isInteger(options.branchNumber) || options.branchNumber <= 0) {
            throw new Error('Managed schema branchNumber must be a positive integer')
        }
    }

    const schemaName =
        options.prefix === 'mhb' && options.branchNumber !== undefined
            ? `mhb_${normalizedOwnerId}_b${options.branchNumber}`
            : `${options.prefix}_${normalizedOwnerId}`

    if (!isManagedDynamicSchemaName(schemaName)) {
        throw new Error(`Invalid managed dynamic schema name: ${schemaName}`)
    }

    return schemaName
}

export const resolveSchemaTargetSchemaName = (target: {
    kind: 'fixed' | 'managed_dynamic' | 'managed_custom'
    schemaName?: string
    prefix?: 'app' | 'mhb'
    ownerId?: string
    branchNumber?: number
}): string => {
    if (target.kind === 'fixed') {
        assertCanonicalSchemaName(target.schemaName ?? '')
        return target.schemaName ?? ''
    }

    if (target.kind === 'managed_dynamic') {
        return buildManagedDynamicSchemaName({
            prefix: target.prefix ?? 'app',
            ownerId: target.ownerId ?? '',
            branchNumber: target.branchNumber
        })
    }

    assertManagedCustomSchemaName(target.schemaName ?? '')
    return target.schemaName ?? ''
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
