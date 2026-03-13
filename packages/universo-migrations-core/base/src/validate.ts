import { AttributeDataType } from '@universo/types'
import {
    assertCanonicalPlatformScopeKey,
    assertCanonicalSchemaName,
    assertManagedCustomSchemaName,
    buildManagedDynamicSchemaName
} from './identifiers'
import type {
    SystemAppBusinessTableDefinition,
    ManagedCustomSchemaTarget,
    ManagedDynamicSchemaTarget,
    MigrationValidationIssue,
    MigrationValidationResult,
    PlatformMigrationFile,
    SchemaTarget,
    SystemAppStructureCapabilities,
    SystemAppDefinition,
    SystemAppDefinitionValidationIssue,
    SystemAppDefinitionValidationResult
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

const isLocalizedContentRecord = (value: unknown): boolean => isRecord(value) && isRecord(value.locales)

const isMetaPresentation = (value: unknown): boolean =>
    isRecord(value) &&
    isLocalizedContentRecord(value.name) &&
    (typeof value.description === 'undefined' || isLocalizedContentRecord(value.description))

const compareVersions = (left: PlatformMigrationFile, right: PlatformMigrationFile): number => {
    if (left.version === right.version) {
        return left.id.localeCompare(right.id)
    }
    return left.version.localeCompare(right.version)
}

export const sortPlatformMigrations = (migrations: PlatformMigrationFile[]): PlatformMigrationFile[] =>
    [...migrations].sort(compareVersions)

export const validatePlatformMigrations = (migrations: PlatformMigrationFile[]): MigrationValidationResult => {
    const issues: MigrationValidationIssue[] = []
    const ids = new Set<string>()
    const versions = new Map<string, string>()

    for (const migration of migrations) {
        if (!migration.id.trim()) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Migration id must not be empty' })
        }

        if (ids.has(migration.id)) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Duplicate migration id detected' })
        }
        ids.add(migration.id)

        if (!migration.version.trim()) {
            issues.push({ level: 'error', migrationId: migration.id, message: 'Migration version must not be empty' })
        }

        const versionOwner = versions.get(migration.version)
        if (versionOwner && versionOwner !== migration.id) {
            issues.push({
                level: 'error',
                migrationId: migration.id,
                message: `Migration version ${migration.version} is duplicated by ${versionOwner}`
            })
        }
        versions.set(migration.version, migration.id)

        if (migration.scope.kind === 'platform_schema') {
            try {
                assertCanonicalPlatformScopeKey(migration.scope.key)
            } catch (error) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: error instanceof Error ? error.message : String(error)
                })
            }
        }

        if (migration.isDestructive && !migration.requiresReview) {
            issues.push({
                level: 'warning',
                migrationId: migration.id,
                message: 'Destructive migration should declare requiresReview=true'
            })
        }

        const lockMode = migration.lockMode ?? 'transaction_advisory'
        const transactionMode = migration.transactionMode ?? 'single'
        if (transactionMode === 'none' && lockMode === 'transaction_advisory') {
            issues.push({
                level: 'error',
                migrationId: migration.id,
                message: 'transactionMode="none" cannot be combined with lockMode="transaction_advisory"'
            })
        }

        if (migration.executionBudget) {
            const { lockTimeoutMs, statementTimeoutMs, riskLevel } = migration.executionBudget
            if (transactionMode === 'none') {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: 'executionBudget is currently supported only for transactional migrations'
                })
            }
            if (!Number.isInteger(lockTimeoutMs) || lockTimeoutMs <= 0) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: 'executionBudget.lockTimeoutMs must be a positive integer'
                })
            }

            if (!Number.isInteger(statementTimeoutMs) || statementTimeoutMs <= 0) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: 'executionBudget.statementTimeoutMs must be a positive integer'
                })
            }

            if (lockTimeoutMs > statementTimeoutMs) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: 'executionBudget.lockTimeoutMs must not exceed executionBudget.statementTimeoutMs'
                })
            }

            if (!['low', 'medium', 'high'].includes(riskLevel)) {
                issues.push({
                    level: 'error',
                    migrationId: migration.id,
                    message: 'executionBudget.riskLevel must be one of: low, medium, high'
                })
            }
        }

        if (migration.deliveryStage === 'contract' && !migration.isDestructive) {
            issues.push({
                level: 'warning',
                migrationId: migration.id,
                message: 'deliveryStage="contract" is typically expected to be destructive or cleanup-oriented'
            })
        }

        if (migration.deliveryStage === 'one_shot' && migration.isDestructive && !migration.requiresReview) {
            issues.push({
                level: 'warning',
                migrationId: migration.id,
                message: 'Destructive one-shot migration should declare requiresReview=true'
            })
        }
    }

    const sorted = sortPlatformMigrations(migrations)
    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index]
        const previous = sorted[index - 1]
        if (previous.version > current.version) {
            issues.push({
                level: 'error',
                migrationId: current.id,
                message: `Migration ordering is invalid: ${current.version} is before ${previous.version}`
            })
        }
    }

    return {
        ok: !issues.some((issue) => issue.level === 'error'),
        issues
    }
}

const validateManagedDynamicSchemaTarget = (
    target: ManagedDynamicSchemaTarget,
    definitionKey: string,
    issues: SystemAppDefinitionValidationIssue[]
): void => {
    try {
        buildManagedDynamicSchemaName(target)
    } catch (error) {
        issues.push({
            level: 'error',
            definitionKey,
            message: error instanceof Error ? error.message : String(error)
        })
    }
}

const validateManagedCustomSchemaTarget = (
    target: ManagedCustomSchemaTarget,
    definitionKey: string,
    issues: SystemAppDefinitionValidationIssue[]
): void => {
    try {
        assertManagedCustomSchemaName(target.schemaName)
    } catch (error) {
        issues.push({
            level: 'error',
            definitionKey,
            message: error instanceof Error ? error.message : String(error)
        })
    }
}

const validateSchemaTarget = (target: SchemaTarget, definitionKey: string, issues: SystemAppDefinitionValidationIssue[]): void => {
    if (target.kind === 'fixed') {
        try {
            assertCanonicalSchemaName(target.schemaName)
        } catch (error) {
            issues.push({
                level: 'error',
                definitionKey,
                message: error instanceof Error ? error.message : String(error)
            })
        }
        return
    }

    if (target.kind === 'managed_dynamic') {
        validateManagedDynamicSchemaTarget(target, definitionKey, issues)
        return
    }

    validateManagedCustomSchemaTarget(target, definitionKey, issues)
}

const validateStructureCapabilities = (
    capabilities: SystemAppStructureCapabilities,
    definitionKey: string,
    label: 'currentStructureCapabilities' | 'targetStructureCapabilities',
    issues: SystemAppDefinitionValidationIssue[]
): void => {
    if ((capabilities.layoutTables || capabilities.widgetTables || capabilities.attributeValueTables) && !capabilities.appCoreTables) {
        issues.push({
            level: 'error',
            definitionKey,
            message: `${label} requires appCoreTables=true when layout, widget, or attribute value tables are enabled`
        })
    }

    if (capabilities.widgetTables && !capabilities.layoutTables) {
        issues.push({
            level: 'error',
            definitionKey,
            message: `${label} requires layoutTables=true when widgetTables=true`
        })
    }
}

const systemAppBusinessTableKindCapabilityMap = {
    catalog: 'catalogTables',
    document: 'documentTables',
    relation: 'relationTables',
    settings: 'settingsTables'
} as const satisfies Record<SystemAppBusinessTableDefinition['kind'], keyof SystemAppStructureCapabilities>

const systemAppBusinessTablePrefixes = {
    catalog: 'cat_',
    document: 'doc_',
    relation: 'rel_',
    settings: 'cfg_'
} as const satisfies Record<SystemAppBusinessTableDefinition['kind'], string>

const tableNamePattern = /^[a-z][a-z0-9_]*$/

const validateBusinessTables = (
    tables: readonly SystemAppBusinessTableDefinition[],
    capabilities: SystemAppStructureCapabilities,
    definitionKey: string,
    label: 'currentBusinessTables' | 'targetBusinessTables',
    enforceCanonicalPrefixes: boolean,
    issues: SystemAppDefinitionValidationIssue[]
): void => {
    const seenCodenames = new Set<string>()
    const seenTableNames = new Set<string>()
    const availableTableCodenames = new Set(tables.map((table) => table.codename))

    for (const table of tables) {
        if (!table.codename.trim()) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} codename must not be empty`
            })
        }

        if (!table.tableName.trim()) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} tableName must not be empty`
            })
        }

        if (seenCodenames.has(table.codename)) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} contains duplicate codename: ${table.codename}`
            })
        }
        seenCodenames.add(table.codename)

        if (seenTableNames.has(table.tableName)) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} contains duplicate tableName: ${table.tableName}`
            })
        }
        seenTableNames.add(table.tableName)

        if (!tableNamePattern.test(table.tableName)) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} contains invalid tableName: ${table.tableName}`
            })
        }

        const requiredCapability = systemAppBusinessTableKindCapabilityMap[table.kind]
        if (!capabilities[requiredCapability]) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} requires ${requiredCapability}=true for ${table.tableName}`
            })
        }

        if (enforceCanonicalPrefixes && !table.tableName.startsWith(systemAppBusinessTablePrefixes[table.kind])) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label} must use ${systemAppBusinessTablePrefixes[table.kind]}* table names for kind=${table.kind}`
            })
        }

        if (typeof table.presentation !== 'undefined' && !isMetaPresentation(table.presentation)) {
            issues.push({
                level: 'error',
                definitionKey,
                message: `${label}.${table.codename} contains invalid presentation`
            })
        }

        const seenFieldCodenames = new Set<string>()
        const seenFieldColumnNames = new Set<string>()
        for (const field of table.fields ?? []) {
            if (!field.codename.trim()) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields codename must not be empty`
                })
            }

            if (!field.physicalColumnName.trim()) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields physicalColumnName must not be empty`
                })
            }

            if (seenFieldCodenames.has(field.codename)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields contains duplicate codename: ${field.codename}`
                })
            }
            seenFieldCodenames.add(field.codename)

            if (seenFieldColumnNames.has(field.physicalColumnName)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields contains duplicate physicalColumnName: ${field.physicalColumnName}`
                })
            }
            seenFieldColumnNames.add(field.physicalColumnName)

            if (!tableNamePattern.test(field.physicalColumnName)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields contains invalid physicalColumnName: ${field.physicalColumnName}`
                })
            }

            if (typeof field.presentation !== 'undefined' && !isMetaPresentation(field.presentation)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields.${field.codename} contains invalid presentation`
                })
            }

            if (typeof field.validationRules !== 'undefined' && !isRecord(field.validationRules)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields.${field.codename} validationRules must be an object`
                })
            }

            if (typeof field.uiConfig !== 'undefined' && !isRecord(field.uiConfig)) {
                issues.push({
                    level: 'error',
                    definitionKey,
                    message: `${label}.${table.codename}.fields.${field.codename} uiConfig must be an object`
                })
            }

            if (typeof field.targetTableCodename === 'string') {
                if (!field.targetTableCodename.trim()) {
                    issues.push({
                        level: 'error',
                        definitionKey,
                        message: `${label}.${table.codename}.fields targetTableCodename must not be empty`
                    })
                }

                if (field.dataType !== AttributeDataType.REF) {
                    issues.push({
                        level: 'error',
                        definitionKey,
                        message: `${label}.${table.codename}.fields targetTableCodename is supported only for REF fields`
                    })
                }

                if (!availableTableCodenames.has(field.targetTableCodename)) {
                    issues.push({
                        level: 'error',
                        definitionKey,
                        message: `${label}.${table.codename}.fields references unknown targetTableCodename: ${field.targetTableCodename}`
                    })
                }
            }
        }
    }
}

export const validateSystemAppDefinitions = (definitions: readonly SystemAppDefinition[]): SystemAppDefinitionValidationResult => {
    const issues: SystemAppDefinitionValidationIssue[] = []
    const seenKeys = new Set<string>()

    for (const definition of definitions) {
        if (!Number.isInteger(definition.manifestVersion) || definition.manifestVersion <= 0) {
            issues.push({
                level: 'error',
                definitionKey: definition.key,
                message: 'System app manifestVersion must be a positive integer'
            })
        }

        if (!definition.key.trim()) {
            issues.push({ level: 'error', definitionKey: definition.key, message: 'System app key must not be empty' })
        }

        if (seenKeys.has(definition.key)) {
            issues.push({ level: 'error', definitionKey: definition.key, message: 'Duplicate system app definition key detected' })
        }
        seenKeys.add(definition.key)

        if (!definition.displayName.trim()) {
            issues.push({ level: 'error', definitionKey: definition.key, message: 'System app displayName must not be empty' })
        }

        if (!definition.ownerPackage.trim()) {
            issues.push({ level: 'error', definitionKey: definition.key, message: 'System app ownerPackage must not be empty' })
        }

        for (const [fieldName, value] of [
            ['engineVersion', definition.engineVersion],
            ['structureVersion', definition.structureVersion],
            ['configurationVersion', definition.configurationVersion]
        ] as const) {
            if (!value.trim()) {
                issues.push({
                    level: 'error',
                    definitionKey: definition.key,
                    message: `System app ${fieldName} must not be empty`
                })
            }
        }

        validateSchemaTarget(definition.schemaTarget, definition.key, issues)
        validateStructureCapabilities(definition.currentStructureCapabilities, definition.key, 'currentStructureCapabilities', issues)
        validateStructureCapabilities(definition.targetStructureCapabilities, definition.key, 'targetStructureCapabilities', issues)
        validateBusinessTables(
            definition.currentBusinessTables,
            definition.currentStructureCapabilities,
            definition.key,
            'currentBusinessTables',
            false,
            issues
        )
        validateBusinessTables(
            definition.targetBusinessTables,
            definition.targetStructureCapabilities,
            definition.key,
            'targetBusinessTables',
            definition.targetStorageModel === 'application_like',
            issues
        )

        if (definition.currentStorageModel === 'application_like' && !definition.currentStructureCapabilities.appCoreTables) {
            issues.push({
                level: 'error',
                definitionKey: definition.key,
                message: 'System app currentStructureCapabilities.appCoreTables must be true for application_like storage'
            })
        }

        if (definition.targetStorageModel === 'application_like' && !definition.targetStructureCapabilities.appCoreTables) {
            issues.push({
                level: 'error',
                definitionKey: definition.key,
                message: 'System app targetStructureCapabilities.appCoreTables must be true for application_like storage'
            })
        }

        if (definition.migrations.length === 0) {
            issues.push({ level: 'warning', definitionKey: definition.key, message: 'System app has no migrations' })
        }

        const repeatableSeedIds = new Set<string>()
        for (const seed of definition.repeatableSeeds) {
            if (!seed.id.trim()) {
                issues.push({ level: 'error', definitionKey: definition.key, message: 'Repeatable seed id must not be empty' })
            }

            if (!seed.version.trim()) {
                issues.push({ level: 'error', definitionKey: definition.key, message: 'Repeatable seed version must not be empty' })
            }

            if (!seed.checksum.trim()) {
                issues.push({ level: 'error', definitionKey: definition.key, message: 'Repeatable seed checksum must not be empty' })
            }

            if (repeatableSeedIds.has(seed.id)) {
                issues.push({
                    level: 'error',
                    definitionKey: definition.key,
                    message: `Duplicate repeatable seed id detected: ${seed.id}`
                })
            }
            repeatableSeedIds.add(seed.id)
        }
    }

    return {
        ok: !issues.some((issue) => issue.level === 'error'),
        issues
    }
}
