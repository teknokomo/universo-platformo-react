import type { Knex } from 'knex'
import type { ComponentDefinitionDataType, MetaPresentation } from '@universo/types'

export type MigrationTransactionMode = 'single' | 'per_migration' | 'none'
export type MigrationLockMode = 'transaction_advisory' | 'session_advisory' | 'none'
export type MigrationRunStatus = 'planned' | 'applied' | 'skipped' | 'blocked' | 'drifted' | 'failed' | 'rolled_forward'
export type MigrationScopeKind = 'platform_schema' | 'runtime_schema' | 'template' | 'publication' | 'application_sync' | 'metahub_sync'
export type MigrationRiskLevel = 'low' | 'medium' | 'high'
export type MigrationDeliveryStage = 'expand' | 'migrate' | 'contract' | 'one_shot'

export type MigrationSourceKind = 'file' | 'declarative' | 'system_sync' | 'template_seed' | 'publication_snapshot'

export interface MigrationScope {
    kind: MigrationScopeKind
    key: string
}

export interface MigrationLogger {
    info(message: string, meta?: Record<string, unknown>): void
    warn(message: string, meta?: Record<string, unknown>): void
    error(message: string, meta?: Record<string, unknown>): void
}

export interface MigrationExecutionContext {
    knex: Knex | Knex.Transaction
    logger: MigrationLogger
    scope: MigrationScope
    runId: string
    raw(sql: string, bindings?: readonly unknown[]): Promise<unknown>
}

export interface DdlExecutionBudget {
    lockTimeoutMs: number
    statementTimeoutMs: number
    riskLevel: MigrationRiskLevel
}

export interface SqlMigrationStatement {
    sql: string
    warningMessage?: string
}

export interface SqlPlatformMigrationDefinition {
    id: string
    version: string
    summary: string
    up: readonly SqlMigrationStatement[]
    down?: readonly SqlMigrationStatement[]
}

export interface FixedSchemaTarget {
    kind: 'fixed'
    schemaName: string
}

export interface ManagedDynamicSchemaTarget {
    kind: 'managed_dynamic'
    prefix: 'app' | 'mhb'
    ownerId: string
    branchNumber?: number
}

export interface ManagedCustomSchemaTarget {
    kind: 'managed_custom'
    schemaName: string
    ownerKind: 'system_app' | 'application' | 'metahub_branch'
}

export type SchemaTarget = FixedSchemaTarget | ManagedDynamicSchemaTarget | ManagedCustomSchemaTarget

export type SystemAppMigrationEntry =
    | {
          kind: 'sql'
          definition: SqlPlatformMigrationDefinition
          bootstrapPhase?: 'standalone' | 'pre_schema_generation' | 'post_schema_generation'
      }
    | {
          kind: 'file'
          migration: PlatformMigrationFile
          bootstrapPhase?: 'standalone' | 'pre_schema_generation' | 'post_schema_generation'
      }

export interface RepeatableSeedPack {
    id: string
    version: string
    checksum: string
    scope: 'platform' | 'system_app'
    lifecycle: 'bootstrap' | 'configuration_template'
}

export interface SystemAppRuntimeCapabilities {
    supportsPublicationSync: boolean
    supportsTemplateVersions: boolean
    usesCurrentUiShell: 'universo-template-mui' | 'apps-template-mui'
}

export type SystemAppStorageModel = 'legacy_fixed' | 'application_like'

export interface SystemAppStructureCapabilities {
    appCoreTables: boolean
    objectTables: boolean
    documentTables: boolean
    relationTables: boolean
    settingsTables: boolean
    layoutTables: boolean
    widgetTables: boolean
    componentValueTables: boolean
}

export interface SystemTableCapabilityOptions {
    includeComponents?: boolean
    includeValues?: boolean
    includeLayouts?: boolean
    includeWidgets?: boolean
}

export type SystemAppBusinessTableKind = 'object' | 'document' | 'relation' | 'settings'

export interface SystemAppBusinessComponent {
    codename: string
    physicalColumnName: string
    dataType: ComponentDefinitionDataType
    isRequired?: boolean
    isDisplayComponent?: boolean
    targetTableCodename?: string
    physicalDataType?: string
    defaultSqlExpression?: string
    presentation?: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

export interface SystemAppBusinessTableDefinition {
    kind: SystemAppBusinessTableKind
    codename: string
    tableName: string
    presentation?: MetaPresentation
    fields?: readonly SystemAppBusinessComponent[]
}

export interface SystemAppDefinition {
    manifestVersion: number
    key: string
    displayName: string
    ownerPackage: string
    engineVersion: string
    structureVersion: string
    configurationVersion: string
    schemaTarget: SchemaTarget
    runtimeCapabilities: SystemAppRuntimeCapabilities
    currentStorageModel: SystemAppStorageModel
    targetStorageModel: SystemAppStorageModel
    currentStructureCapabilities: SystemAppStructureCapabilities
    targetStructureCapabilities: SystemAppStructureCapabilities
    currentBusinessTables: readonly SystemAppBusinessTableDefinition[]
    targetBusinessTables: readonly SystemAppBusinessTableDefinition[]
    summary?: string
    migrations: readonly SystemAppMigrationEntry[]
    repeatableSeeds: readonly RepeatableSeedPack[]
}

export interface SystemAppDefinitionValidationIssue {
    level: 'error' | 'warning'
    definitionKey: string
    message: string
}

export interface SystemAppDefinitionValidationResult {
    ok: boolean
    issues: SystemAppDefinitionValidationIssue[]
}

export interface PlatformMigrationFile {
    id: string
    version: string
    scope: MigrationScope
    sourceKind?: MigrationSourceKind
    checksumSource?: string
    transactionMode?: MigrationTransactionMode
    lockMode?: MigrationLockMode
    summary?: string
    isDestructive?: boolean
    requiresReview?: boolean
    deliveryStage?: MigrationDeliveryStage
    executionBudget?: DdlExecutionBudget
    up(ctx: MigrationExecutionContext): Promise<void>
    down?: (ctx: MigrationExecutionContext) => Promise<void>
}

export interface MigrationObjectRecord {
    id: string
    scopeKind: MigrationScopeKind
    scopeKey: string
    sourceKind: MigrationSourceKind
    migrationName: string
    migrationVersion: string
    checksum: string
    transactionMode: MigrationTransactionMode
    lockMode: MigrationLockMode
    status: MigrationRunStatus
    summary: string | null
    meta: Record<string, unknown> | null
    snapshotBefore: Record<string, unknown> | null
    snapshotAfter: Record<string, unknown> | null
    plan: Record<string, unknown> | null
    error: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

export interface MigrationObjectRepository {
    ensureStorage(): Promise<void>
    isStorageReady?(): Promise<boolean>
    findLatest(scope: MigrationScope, migration: PlatformMigrationFile): Promise<MigrationObjectRecord | null>
    beginRun(input: {
        migration: PlatformMigrationFile
        checksum: string
        summary?: string | null
        meta?: Record<string, unknown> | null
        status?: MigrationRunStatus
    }): Promise<MigrationObjectRecord>
    completeRun(
        runId: string,
        patch: {
            status: MigrationRunStatus
            error?: Record<string, unknown> | null
            meta?: Record<string, unknown> | null
            snapshotBefore?: Record<string, unknown> | null
            snapshotAfter?: Record<string, unknown> | null
            plan?: Record<string, unknown> | null
        }
    ): Promise<void>
}

export interface MigrationValidationIssue {
    level: 'error' | 'warning'
    migrationId: string
    message: string
}

export interface MigrationValidationResult {
    ok: boolean
    issues: MigrationValidationIssue[]
}

export interface RunPlatformMigrationsOptions {
    knex: Knex
    migrations: PlatformMigrationFile[]
    object: MigrationObjectRepository
    logger?: MigrationLogger
    allowDestructive?: boolean
    allowReviewRequired?: boolean
    dryRun?: boolean
    prepareObjectStorage?: boolean
}

export type PlannedPlatformMigrationAction = 'apply' | 'skip' | 'drift' | 'blocked'

export interface PlannedPlatformMigration {
    id: string
    version: string
    scopeKind: MigrationScopeKind
    scopeKey: string
    checksum: string
    summary: string | null
    action: PlannedPlatformMigrationAction
    reason: string | null
    existingRunId: string | null
    existingStatus: MigrationRunStatus | null
    existingChecksum: string | null
    deliveryStage: MigrationDeliveryStage
    executionBudget: DdlExecutionBudget | null
}

export interface RunPlatformMigrationsResult {
    dryRun: boolean
    applied: string[]
    skipped: string[]
    drifted: string[]
    blocked: string[]
    planned: PlannedPlatformMigration[]
}

export interface DependencyGraphNode {
    logicalKey: string
    dependencies: readonly string[]
}

export interface DependencyGraphValidationResult {
    ok: boolean
    orderedKeys: string[]
    issues: string[]
}

// ═══════════════════════════════════════════════════════════════════════
// Runtime migration history — shared contract for local per-schema tables
// (_mhb_migrations, _app_migrations, etc.)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Common shape of a runtime migration history record stored in a
 * per-schema local history table (_mhb_migrations / _app_migrations).
 *
 * Domain-specific columns (from_version, publication_snapshot, …)
 * are NOT part of this interface — they live in the domain packages.
 */
export interface RuntimeMigrationHistoryRecord {
    id: string
    name: string
    appliedAt: Date
    meta: Record<string, unknown>
}

/**
 * Input for the `mirrorToGlobalCatalog()` helper that records a runtime
 * migration event in the central `upl_migrations` object.
 */
export interface MirrorToGlobalCatalogInput {
    knex: Knex | Knex.Transaction
    globalCatalogEnabled?: boolean
    scopeKind: MigrationScopeKind
    scopeKey: string
    sourceKind: MigrationSourceKind
    migrationName: string
    migrationVersion: string
    localHistoryTable: string
    summary?: string | null
    transactionMode?: MigrationTransactionMode
    lockMode?: MigrationLockMode
    checksumPayload?: unknown
    meta?: Record<string, unknown> | null
    snapshotBefore?: Record<string, unknown> | null
    snapshotAfter?: Record<string, unknown> | null
    plan?: Record<string, unknown> | null
}
