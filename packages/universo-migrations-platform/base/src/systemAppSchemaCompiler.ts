import { createHash } from 'node:crypto'
import type { Knex } from 'knex'
import type { DefinitionArtifact } from '@universo/migrations-catalog'
import { buildLogicalKey, createDefinitionArtifact } from '@universo/migrations-catalog'
import { validateDependencyGraph } from '@universo/migrations-core'
import {
    SchemaGenerator,
    SchemaMigrator,
    MigrationManager,
    buildSchemaSnapshot,
    resolveSystemTableNames,
    type ApplyChangesOptions,
    type EntityDefinition,
    type GenerateFullSchemaOptions,
    type RuntimeEntityKind,
    type SchemaDiff,
    type SchemaSnapshot,
    type SchemaGenerationResult
} from '@universo/schema-ddl'
import {
    buildRegisteredSystemAppSchemaGenerationPlan,
    exportRegisteredSystemAppSchemaGenerationPlans,
    type SystemAppSchemaGenerationPlan
} from './systemAppDefinitions'

export interface ApplySystemAppSchemaGenerationPlanOptions {
    recordMigration?: boolean
    migrationName?: string
    migrationDescription?: string
    migrationManager?: GenerateFullSchemaOptions['migrationManager']
    migrationMeta?: GenerateFullSchemaOptions['migrationMeta']
    publicationSnapshot?: Record<string, unknown> | null
    userId?: string | null
    afterMigrationRecorded?: (context: {
        trx: Knex.Transaction
        schemaName: string
        snapshotBefore: SchemaSnapshot | null
        snapshotAfter: SchemaSnapshot
        diff: SchemaDiff
        migrationName: string
        migrationId: string
    }) => Promise<void>
}

export interface ApplyRegisteredSystemAppSchemaGenerationPlansOptions {
    stage?: 'current' | 'target'
    keys?: string[]
    generatorOptions?: ApplySystemAppSchemaGenerationPlanOptions
}

export interface PlanRegisteredSystemAppSchemaGenerationPlansOptions {
    stage?: 'current' | 'target'
    keys?: string[]
}

export interface AppliedSystemAppSchemaGenerationPlanResult {
    definitionKey: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    tablesCreated: string[]
}

export interface ApplyRegisteredSystemAppSchemaGenerationPlansResult {
    applied: AppliedSystemAppSchemaGenerationPlanResult[]
}

export interface EnsuredSystemAppSchemaGenerationPlanResult {
    definitionKey: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    action: 'applied' | 'upgraded' | 'skipped' | 'baseline_backfilled'
    tablesCreated: string[]
}

export interface EnsureRegisteredSystemAppSchemaGenerationPlansOptions {
    stage?: 'current' | 'target'
    keys?: string[]
    generatorOptions?: ApplySystemAppSchemaGenerationPlanOptions
}

export interface EnsureRegisteredSystemAppSchemaGenerationPlansResult {
    ensured: EnsuredSystemAppSchemaGenerationPlanResult[]
}

export interface BootstrapSystemAppStructureMetadataOptions {
    userId?: string | null
}

export interface BootstrappedSystemAppStructureMetadataResult {
    definitionKey: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    metadataObjectCount: number
    metadataAttributeCount: number
    systemTables: string[]
    syncStrategy: 'noop' | 'full_sync'
}

export interface BootstrapRegisteredSystemAppStructureMetadataOptions extends BootstrapSystemAppStructureMetadataOptions {
    stage?: 'current' | 'target'
    keys?: string[]
}

export interface BootstrapRegisteredSystemAppStructureMetadataResult {
    bootstrapped: BootstrappedSystemAppStructureMetadataResult[]
}

interface CompiledSystemAppSchemaBasePayload {
    definitionKey: string
    displayName: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    structureVersion: string
    configurationVersion: string
}

type SyntheticPresentation = NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['presentation']>

interface CompiledSystemAppSchemaPayload extends CompiledSystemAppSchemaBasePayload {
    kind: 'system-app-compiled-schema'
}

interface CompiledSystemAppTablePayload extends CompiledSystemAppSchemaBasePayload {
    kind: 'system-app-compiled-table'
    tableName: string
}

interface CompiledSystemAppObjectPayload extends CompiledSystemAppSchemaBasePayload {
    kind: 'system-app-compiled-object'
    objectCodename: string
    tableName: string
    objectKind: SystemAppSchemaGenerationPlan['businessTables'][number]['kind']
    presentation: SystemAppSchemaGenerationPlan['businessTables'][number]['presentation']
}

interface CompiledSystemAppAttributePayload extends CompiledSystemAppSchemaBasePayload {
    kind: 'system-app-compiled-attribute'
    objectCodename: string
    tableName: string
    attributeCodename: string
    physicalColumnName: string
    targetObjectCodename: string | null
    dataType: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]['dataType']
    isRequired: boolean
    isDisplayAttribute: boolean
    presentation: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]['presentation'] | null
    validationRules: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]['validationRules'] | null
    uiConfig: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]['uiConfig'] | null
}

export interface CompiledSystemAppSchemaArtifactSet {
    plan: SystemAppSchemaGenerationPlan
    artifacts: DefinitionArtifact[]
}

export interface RegisteredSystemAppCompiledDefinitionsValidationResult {
    ok: boolean
    issues: string[]
    artifactSets: CompiledSystemAppSchemaArtifactSet[]
}

export interface SystemAppStructureMetadataInspectionEntry {
    definitionKey: string
    schemaName: string
    stage: 'current' | 'target'
    storageModel: SystemAppSchemaGenerationPlan['storageModel']
    expectedSystemTables: string[]
    presentSystemTables: string[]
    missingSystemTables: string[]
    objectCount: number
    attributeCount: number
    missingObjectCodenames: string[]
    missingAttributeKeys: string[]
    expectedFingerprint: string
    actualFingerprint: string | null
    metadataFingerprintMatches: boolean
}

export interface RegisteredSystemAppStructureMetadataInspectionResult {
    ok: boolean
    issues: string[]
    entries: SystemAppStructureMetadataInspectionEntry[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)

const normalizeRawRows = (value: unknown): Array<Record<string, unknown>> => {
    if (Array.isArray(value)) {
        return value.filter(isRecord)
    }

    if (isRecord(value) && Array.isArray(value.rows)) {
        return value.rows.filter(isRecord)
    }

    return []
}

const normalizeDeterministicJson = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => normalizeDeterministicJson(entry))
    }

    if (isRecord(value)) {
        return Object.keys(value)
            .sort((left, right) => left.localeCompare(right))
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = normalizeDeterministicJson(value[key])
                return accumulator
            }, {})
    }

    return value
}

const normalizeJsonColumnValue = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return normalizeDeterministicJson(value)
    }

    try {
        return normalizeDeterministicJson(JSON.parse(value))
    } catch {
        return value
    }
}

const normalizeMetadataCodename = (value: unknown): string | null => {
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value) as unknown
            if (parsed !== value) {
                return normalizeMetadataCodename(parsed)
            }
        } catch {
            return value
        }

        return value
    }

    if (!isRecord(value)) {
        return null
    }

    const locales = isRecord(value.locales) ? value.locales : null
    if (!locales) {
        return null
    }

    const primaryLocale = typeof value._primary === 'string' && value._primary.trim().length > 0 ? value._primary : 'en'
    const primaryEntry = isRecord(locales[primaryLocale]) ? locales[primaryLocale] : null
    const englishEntry = isRecord(locales.en) ? locales.en : null
    const primaryContent = typeof primaryEntry?.content === 'string' ? primaryEntry.content : null
    const englishContent = typeof englishEntry?.content === 'string' ? englishEntry.content : null

    return primaryContent ?? englishContent
}

interface SystemAppStructureMetadataObjectSnapshot {
    id: string
    kind: RuntimeEntityKind
    codename: string
    tableName: string
    presentation: unknown
    config: unknown
}

interface SystemAppStructureMetadataAttributeSnapshot {
    id: string
    objectId: string
    codename: string
    columnName: string
    dataType: string
    isRequired: boolean
    isDisplayAttribute: boolean
    targetObjectId: string | null
    targetObjectKind: string | null
    presentation: unknown
    validationRules: unknown
    uiConfig: unknown
}

interface SystemAppStructureMetadataFingerprintSnapshot {
    objects: SystemAppStructureMetadataObjectSnapshot[]
    attributes: SystemAppStructureMetadataAttributeSnapshot[]
}

const sortStructureMetadataObjects = (
    left: SystemAppStructureMetadataObjectSnapshot,
    right: SystemAppStructureMetadataObjectSnapshot
): number => left.id.localeCompare(right.id)

const sortStructureMetadataAttributes = (
    left: SystemAppStructureMetadataAttributeSnapshot,
    right: SystemAppStructureMetadataAttributeSnapshot
): number => left.id.localeCompare(right.id)

const buildExpectedSystemAppStructureMetadataSnapshot = (
    plan: SystemAppSchemaGenerationPlan
): SystemAppStructureMetadataFingerprintSnapshot => {
    const businessEntities = buildSystemAppBusinessEntities(plan)

    return {
        objects: businessEntities
            .map<SystemAppStructureMetadataObjectSnapshot>((entity) => ({
                id: entity.id,
                kind: entity.kind,
                codename: entity.codename,
                tableName: entity.physicalTableName ?? entity.codename,
                presentation: normalizeDeterministicJson(entity.presentation),
                config: normalizeDeterministicJson(entity.config ?? {})
            }))
            .sort(sortStructureMetadataObjects),
        attributes: businessEntities
            .flatMap((entity) =>
                entity.fields.map<SystemAppStructureMetadataAttributeSnapshot>((field) => ({
                    id: field.id,
                    objectId: entity.id,
                    codename: field.codename,
                    columnName: field.physicalColumnName ?? field.codename,
                    dataType: field.dataType,
                    isRequired: field.isRequired,
                    isDisplayAttribute: field.isDisplayAttribute ?? false,
                    targetObjectId: field.targetEntityId ?? null,
                    targetObjectKind: field.targetEntityKind ?? null,
                    presentation: normalizeDeterministicJson(field.presentation),
                    validationRules: normalizeDeterministicJson(field.validationRules ?? {}),
                    uiConfig: normalizeDeterministicJson(field.uiConfig ?? {})
                }))
            )
            .sort(sortStructureMetadataAttributes)
    }
}

const buildSystemAppStructureMetadataFingerprint = (snapshot: SystemAppStructureMetadataFingerprintSnapshot): string =>
    createHash('sha256')
        .update(JSON.stringify(normalizeDeterministicJson(snapshot)))
        .digest('hex')

const loadActualSystemAppStructureMetadataSnapshot = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    presentSystemTables: string[]
): Promise<SystemAppStructureMetadataFingerprintSnapshot> => {
    let objects: SystemAppStructureMetadataObjectSnapshot[] = []
    let attributes: SystemAppStructureMetadataAttributeSnapshot[] = []

    if (presentSystemTables.includes('_app_objects')) {
        objects = normalizeRawRows(
            await knex.raw(
                `
                    select id, kind, codename, table_name, presentation::text as presentation_json, config::text as config_json
                    from ${quoteIdentifier(plan.schemaName)}._app_objects
                    where _upl_deleted = false
                      and _app_deleted = false
                    order by id asc
                `
            )
        )
            .map((row) => {
                const id = typeof row.id === 'string' ? row.id : null
                const kind = typeof row.kind === 'string' ? (row.kind as RuntimeEntityKind) : null
                const codename = normalizeMetadataCodename(row.codename)
                const tableName = typeof row.table_name === 'string' ? row.table_name : null
                if (!id || !kind || !codename || !tableName) {
                    return null
                }

                return {
                    id,
                    kind,
                    codename,
                    tableName,
                    presentation: normalizeJsonColumnValue(row.presentation_json),
                    config: normalizeJsonColumnValue(row.config_json)
                }
            })
            .filter((entry): entry is SystemAppStructureMetadataObjectSnapshot => entry !== null)
            .sort(sortStructureMetadataObjects)
    }

    if (presentSystemTables.includes('_app_attributes')) {
        attributes = normalizeRawRows(
            await knex.raw(
                `
                    select
                        id,
                        object_id,
                        codename,
                        column_name,
                        data_type,
                        is_required,
                        is_display_attribute,
                        target_object_id,
                        target_object_kind,
                        presentation::text as presentation_json,
                        validation_rules::text as validation_rules_json,
                        ui_config::text as ui_config_json
                    from ${quoteIdentifier(plan.schemaName)}._app_attributes
                    where _upl_deleted = false
                      and _app_deleted = false
                    order by id asc
                `
            )
        )
            .map((row) => {
                const id = typeof row.id === 'string' ? row.id : null
                const objectId = typeof row.object_id === 'string' ? row.object_id : null
                const codename = normalizeMetadataCodename(row.codename)
                const columnName = typeof row.column_name === 'string' ? row.column_name : null
                const dataType = typeof row.data_type === 'string' ? row.data_type : null
                if (!id || !objectId || !codename || !columnName || !dataType) {
                    return null
                }

                return {
                    id,
                    objectId,
                    codename,
                    columnName,
                    dataType,
                    isRequired: row.is_required === true,
                    isDisplayAttribute: row.is_display_attribute === true,
                    targetObjectId: typeof row.target_object_id === 'string' ? row.target_object_id : null,
                    targetObjectKind: typeof row.target_object_kind === 'string' ? row.target_object_kind : null,
                    presentation: normalizeJsonColumnValue(row.presentation_json),
                    validationRules: normalizeJsonColumnValue(row.validation_rules_json),
                    uiConfig: normalizeJsonColumnValue(row.ui_config_json)
                }
            })
            .filter((entry): entry is SystemAppStructureMetadataAttributeSnapshot => entry !== null)
            .sort(sortStructureMetadataAttributes)
    }

    return {
        objects,
        attributes
    }
}

const quoteIdentifier = (value: string): string => `"${value.replace(/"/g, '""')}"`

export const planRegisteredSystemAppSchemaGenerationPlans = (
    stage: 'current' | 'target' = 'target',
    keys?: string[]
): SystemAppSchemaGenerationPlan[] => {
    const plans = exportRegisteredSystemAppSchemaGenerationPlans(stage)
    if (!keys?.length) {
        return plans
    }

    const requested = new Set(keys)
    const selected = plans.filter((plan) => requested.has(plan.definitionKey))
    const missingKeys = keys.filter((key) => !selected.some((plan) => plan.definitionKey === key))

    if (missingKeys.length > 0) {
        throw new Error(`Unknown registered system app definition keys: ${missingKeys.join(', ')}`)
    }

    return selected
}

const selectApplicationLikeSystemAppPlans = (plans: SystemAppSchemaGenerationPlan[]): SystemAppSchemaGenerationPlan[] =>
    plans.filter((plan) => plan.structureCapabilities.appCoreTables && plan.storageModel === 'application_like')

export const buildSystemAppSchemaGenerationOptions = (
    plan: SystemAppSchemaGenerationPlan,
    options: ApplySystemAppSchemaGenerationPlanOptions = {}
): GenerateFullSchemaOptions => ({
    ...options,
    systemTableCapabilities: plan.systemTableCapabilities
})

const sanitizeSystemAppBaselineVersion = (value: string): string =>
    value
        .trim()
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase()

const buildSystemAppBaselineMigrationName = (plan: SystemAppSchemaGenerationPlan): string =>
    `baseline_${plan.definitionKey}_structure_${sanitizeSystemAppBaselineVersion(plan.structureVersion)}`

const buildExecutableSystemAppSchemaGenerationOptions = (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    options: ApplySystemAppSchemaGenerationPlanOptions = {},
    mode: 'baseline' | 'upgrade' = 'baseline'
): GenerateFullSchemaOptions => ({
    ...buildSystemAppSchemaGenerationOptions(plan, options),
    recordMigration: true,
    migrationName: options.migrationName ?? (mode === 'baseline' ? buildSystemAppBaselineMigrationName(plan) : undefined),
    migrationDescription:
        options.migrationDescription ??
        (mode === 'baseline' ? `${plan.definitionKey} fixed-system baseline schema` : `${plan.definitionKey} fixed-system schema upgrade`),
    migrationManager: options.migrationManager ?? new MigrationManager(knex)
})

const buildExecutableSystemAppApplyChangesOptions = (
    plan: SystemAppSchemaGenerationPlan,
    options: ApplySystemAppSchemaGenerationPlanOptions = {}
): ApplyChangesOptions => ({
    recordMigration: true,
    systemTableCapabilities: plan.systemTableCapabilities,
    migrationName: options.migrationName,
    migrationDescription: options.migrationDescription ?? `${plan.definitionKey} fixed-system schema upgrade`,
    migrationMeta: options.migrationMeta,
    publicationSnapshot: options.publicationSnapshot ?? null,
    userId: options.userId ?? null,
    afterMigrationRecorded: options.afterMigrationRecorded
})

const readLatestSystemAppSnapshot = async (
    migrationManager: MigrationManager,
    plan: SystemAppSchemaGenerationPlan
): Promise<SchemaSnapshot | null> => {
    const latestMigration = await migrationManager.getLatestMigration(plan.schemaName)
    if (!latestMigration) {
        return null
    }

    const snapshotAfter = latestMigration.meta?.snapshotAfter
    if (!isRecord(snapshotAfter) || !isRecord(snapshotAfter.entities)) {
        throw new Error(
            `System app ${plan.definitionKey} has malformed snapshotAfter in ${plan.schemaName}._app_migrations for migration ${latestMigration.name}`
        )
    }

    return snapshotAfter as unknown as SchemaSnapshot
}

const upgradeSystemAppSchemaGenerationPlan = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    options: ApplySystemAppSchemaGenerationPlanOptions = {}
): Promise<{ upgraded: boolean }> => {
    const migrationManager = options.migrationManager ?? new MigrationManager(knex)
    const snapshotBefore = await readLatestSystemAppSnapshot(migrationManager, plan)
    if (!snapshotBefore) {
        throw new Error(
            `System app ${plan.definitionKey} is missing local migration history snapshots in ${plan.schemaName}._app_migrations`
        )
    }

    const generator = new SchemaGenerator(knex)
    const migrator = new SchemaMigrator(knex, generator, migrationManager)
    const businessEntities = buildSystemAppBusinessEntities(plan)
    const diff = migrator.calculateDiff(snapshotBefore, businessEntities)

    if (!diff.hasChanges) {
        return { upgraded: false }
    }

    const result = await migrator.applyAllChanges(
        plan.schemaName,
        diff,
        businessEntities,
        true,
        buildExecutableSystemAppApplyChangesOptions(plan, options)
    )

    if (!result.success) {
        throw new Error(
            `Failed to upgrade system app schema generation plan for ${plan.definitionKey}: ${result.errors.join('; ') || 'unknown error'}`
        )
    }

    return { upgraded: true }
}

const ensureSystemAppBaselineHistory = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    userId?: string | null
): Promise<boolean> => {
    const baselineName = buildSystemAppBaselineMigrationName(plan)
    const snapshotAfter = buildSchemaSnapshot(buildSystemAppBusinessEntities(plan))
    const meta = {
        snapshotBefore: null,
        snapshotAfter,
        changes: [],
        hasDestructive: false,
        summary: `Initial schema creation with ${plan.businessTables.length} table(s)`
    }

    return knex.transaction(async (trx) => {
        const result = await trx
            .withSchema(plan.schemaName)
            .table('_app_migrations')
            .insert({
                name: baselineName,
                meta: JSON.stringify(meta),
                publication_snapshot: null,
                _upl_created_by: userId ?? null,
                _upl_updated_by: userId ?? null
            })
            .onConflict('name')
            .ignore()
            .returning('id')

        return Boolean(result[0]?.id ?? result[0])
    })
}

const SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE = 'universo-system-app-compiler'

const toDeterministicUuid = (seed: string): string => {
    const hex = createHash('sha256').update(seed).digest('hex').slice(0, 32).split('')
    hex[12] = '5'
    hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
    return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex
        .slice(20, 32)
        .join('')}`
}

const createSyntheticPresentation = (value: string): SyntheticPresentation => ({
    name: {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: value,
                version: 1,
                isActive: true,
                createdAt: '1970-01-01T00:00:00.000Z',
                updatedAt: '1970-01-01T00:00:00.000Z'
            }
        }
    }
})

const mapBusinessTableKindToRuntimeEntityKind = (
    kind: SystemAppSchemaGenerationPlan['businessTables'][number]['kind']
): RuntimeEntityKind => {
    switch (kind) {
        case 'catalog':
            return 'catalog'
        case 'document':
            return 'document'
        case 'relation':
            return 'relation'
        case 'settings':
            return 'settings'
    }
}

const buildSystemAppBusinessFieldId = (
    plan: SystemAppSchemaGenerationPlan,
    table: SystemAppSchemaGenerationPlan['businessTables'][number],
    field: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]
): string =>
    toDeterministicUuid(
        `${SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${table.kind}:${table.codename}:${field.codename}:${field.physicalColumnName}`
    )

const buildSystemAppBusinessEntities = (plan: SystemAppSchemaGenerationPlan): EntityDefinition[] => {
    const baseEntities = plan.businessTables.map((table) => ({
        table,
        id: toDeterministicUuid(
            `${SYSTEM_APP_SYNTHETIC_ENTITY_NAMESPACE}:${plan.definitionKey}:${plan.stage}:${table.kind}:${table.codename}:${table.tableName}`
        ),
        kind: mapBusinessTableKindToRuntimeEntityKind(table.kind)
    }))

    const entitiesByCodename = new Map(baseEntities.map((entry) => [entry.table.codename, entry]))

    return baseEntities.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        codename: entry.table.codename,
        physicalTableName: entry.table.tableName,
        presentation: entry.table.presentation ?? createSyntheticPresentation(entry.table.codename),
        fields: (entry.table.fields ?? []).map((field) => {
            const targetEntry = field.targetTableCodename ? entitiesByCodename.get(field.targetTableCodename) : null
            return {
                id: buildSystemAppBusinessFieldId(plan, entry.table, field),
                codename: field.codename,
                dataType: field.dataType,
                isRequired: field.isRequired ?? false,
                isDisplayAttribute: field.isDisplayAttribute ?? false,
                physicalColumnName: field.physicalColumnName,
                physicalDataType: field.physicalDataType,
                defaultSqlExpression: field.defaultSqlExpression,
                targetEntityId: targetEntry?.id ?? null,
                targetEntityKind: targetEntry?.kind ?? null,
                presentation: field.presentation ?? createSyntheticPresentation(field.codename),
                validationRules: field.validationRules,
                uiConfig: field.uiConfig
            }
        }),
        config: {
            systemAppDefinitionKey: plan.definitionKey,
            systemAppBusinessTableKind: entry.table.kind,
            systemAppCompilerStage: plan.stage
        }
    }))
}

const buildCompiledSystemAppSchemaPayload = (plan: SystemAppSchemaGenerationPlan): CompiledSystemAppSchemaPayload => ({
    kind: 'system-app-compiled-schema',
    definitionKey: plan.definitionKey,
    displayName: plan.displayName,
    schemaName: plan.schemaName,
    stage: plan.stage,
    storageModel: plan.storageModel,
    structureVersion: plan.structureVersion,
    configurationVersion: plan.configurationVersion
})

const buildCompiledSystemAppTablePayload = (plan: SystemAppSchemaGenerationPlan, tableName: string): CompiledSystemAppTablePayload => ({
    kind: 'system-app-compiled-table',
    definitionKey: plan.definitionKey,
    displayName: plan.displayName,
    schemaName: plan.schemaName,
    stage: plan.stage,
    storageModel: plan.storageModel,
    structureVersion: plan.structureVersion,
    configurationVersion: plan.configurationVersion,
    tableName
})

const buildCompiledSystemAppObjectPayload = (
    plan: SystemAppSchemaGenerationPlan,
    table: SystemAppSchemaGenerationPlan['businessTables'][number]
): CompiledSystemAppObjectPayload => ({
    kind: 'system-app-compiled-object',
    definitionKey: plan.definitionKey,
    displayName: plan.displayName,
    schemaName: plan.schemaName,
    stage: plan.stage,
    storageModel: plan.storageModel,
    structureVersion: plan.structureVersion,
    configurationVersion: plan.configurationVersion,
    objectCodename: table.codename,
    tableName: table.tableName,
    objectKind: table.kind,
    presentation: table.presentation ?? createSyntheticPresentation(table.codename)
})

const buildCompiledSystemAppAttributePayload = (
    plan: SystemAppSchemaGenerationPlan,
    table: SystemAppSchemaGenerationPlan['businessTables'][number],
    field: NonNullable<SystemAppSchemaGenerationPlan['businessTables'][number]['fields']>[number]
): CompiledSystemAppAttributePayload => ({
    kind: 'system-app-compiled-attribute',
    definitionKey: plan.definitionKey,
    displayName: plan.displayName,
    schemaName: plan.schemaName,
    stage: plan.stage,
    storageModel: plan.storageModel,
    structureVersion: plan.structureVersion,
    configurationVersion: plan.configurationVersion,
    objectCodename: table.codename,
    tableName: table.tableName,
    attributeCodename: field.codename,
    physicalColumnName: field.physicalColumnName,
    targetObjectCodename: field.targetTableCodename ?? null,
    dataType: field.dataType,
    isRequired: field.isRequired ?? false,
    isDisplayAttribute: field.isDisplayAttribute ?? false,
    presentation: field.presentation ?? createSyntheticPresentation(field.codename),
    validationRules: field.validationRules ?? null,
    uiConfig: field.uiConfig ?? null
})

const buildCompiledObjectArtifactSchemaQualifiedName = (plan: SystemAppSchemaGenerationPlan, tableName: string): string =>
    `system_app_compiled.object.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${tableName}`

const buildCompiledAttributeArtifactSchemaQualifiedName = (
    plan: SystemAppSchemaGenerationPlan,
    tableName: string,
    physicalColumnName: string
): string => `system_app_compiled.attribute.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${tableName}.${physicalColumnName}`

export const compileSystemAppSchemaDefinitionArtifacts = (plan: SystemAppSchemaGenerationPlan): DefinitionArtifact[] => {
    const schemaArtifact = createDefinitionArtifact({
        kind: 'custom',
        name: plan.definitionKey,
        schemaQualifiedName: `system_app_compiled.schema.${plan.stage}.${plan.definitionKey}.${plan.schemaName}`,
        sql: JSON.stringify(buildCompiledSystemAppSchemaPayload(plan)),
        dependencies: []
    })

    const schemaLogicalKey = buildLogicalKey(schemaArtifact)

    const resolvedSystemTables = resolveSystemTableNames(plan.systemTableCapabilities)

    const tableArtifacts = resolvedSystemTables.map((tableName) => {
        const dependencies = [schemaLogicalKey]
        if (tableName === '_app_attributes' || tableName === '_app_values') {
            dependencies.push(`system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_objects::custom`)
        }

        if (tableName === '_app_widgets') {
            dependencies.push(`system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_layouts::custom`)
        }

        return createDefinitionArtifact({
            kind: 'custom',
            name: `${plan.definitionKey}.${tableName}`,
            schemaQualifiedName: `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${tableName}`,
            sql: JSON.stringify(buildCompiledSystemAppTablePayload(plan, tableName)),
            dependencies
        })
    })

    const businessTableArtifacts = plan.businessTables.map((table) => {
        const dependencies = [schemaLogicalKey]
        if (resolvedSystemTables.includes('_app_objects')) {
            dependencies.push(`system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_objects::custom`)
        }

        return createDefinitionArtifact({
            kind: 'custom',
            name: `${plan.definitionKey}.${table.tableName}`,
            schemaQualifiedName: `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${table.tableName}`,
            sql: JSON.stringify(buildCompiledSystemAppTablePayload(plan, table.tableName)),
            dependencies
        })
    })

    const compiledObjectArtifacts = resolvedSystemTables.includes('_app_objects')
        ? plan.businessTables.map((table) =>
              createDefinitionArtifact({
                  kind: 'custom',
                  name: `${plan.definitionKey}.${table.tableName}.__object__`,
                  schemaQualifiedName: buildCompiledObjectArtifactSchemaQualifiedName(plan, table.tableName),
                  sql: JSON.stringify(buildCompiledSystemAppObjectPayload(plan, table)),
                  dependencies: [
                      `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_objects::custom`,
                      `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${table.tableName}::custom`
                  ]
              })
          )
        : []

    const compiledAttributeArtifacts = resolvedSystemTables.includes('_app_attributes')
        ? plan.businessTables.flatMap((table) =>
              (table.fields ?? []).map((field) =>
                  createDefinitionArtifact({
                      kind: 'custom',
                      name: `${plan.definitionKey}.${table.tableName}.__attr__.${field.physicalColumnName}`,
                      schemaQualifiedName: buildCompiledAttributeArtifactSchemaQualifiedName(
                          plan,
                          table.tableName,
                          field.physicalColumnName
                      ),
                      sql: JSON.stringify(buildCompiledSystemAppAttributePayload(plan, table, field)),
                      dependencies: [
                          `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_attributes::custom`,
                          `${buildCompiledObjectArtifactSchemaQualifiedName(plan, table.tableName)}::custom`
                      ]
                  })
              )
          )
        : []

    return [schemaArtifact, ...tableArtifacts, ...businessTableArtifacts, ...compiledObjectArtifacts, ...compiledAttributeArtifacts]
}

export const compileRegisteredSystemAppSchemaDefinitionArtifacts = (
    stage: 'current' | 'target' = 'target',
    keys?: string[]
): CompiledSystemAppSchemaArtifactSet[] =>
    planRegisteredSystemAppSchemaGenerationPlans(stage, keys).map((plan) => ({
        plan,
        artifacts: compileSystemAppSchemaDefinitionArtifacts(plan)
    }))

export const validateSystemAppCompiledArtifactSet = (artifactSet: CompiledSystemAppSchemaArtifactSet): string[] => {
    const issues: string[] = []
    const { plan, artifacts } = artifactSet
    const expectedSchemaQualifiedNames = new Set<string>([
        `system_app_compiled.schema.${plan.stage}.${plan.definitionKey}.${plan.schemaName}`,
        ...resolveSystemTableNames(plan.systemTableCapabilities).map(
            (tableName) => `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${tableName}`
        ),
        ...plan.businessTables.map(
            (table) => `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${table.tableName}`
        ),
        ...(resolveSystemTableNames(plan.systemTableCapabilities).includes('_app_objects')
            ? plan.businessTables.map((table) => buildCompiledObjectArtifactSchemaQualifiedName(plan, table.tableName))
            : []),
        ...(resolveSystemTableNames(plan.systemTableCapabilities).includes('_app_attributes')
            ? plan.businessTables.flatMap((table) =>
                  (table.fields ?? []).map((field) =>
                      buildCompiledAttributeArtifactSchemaQualifiedName(plan, table.tableName, field.physicalColumnName)
                  )
              )
            : [])
    ])
    const actualSchemaQualifiedNames = new Set(artifacts.map((artifact) => artifact.schemaQualifiedName))

    for (const schemaQualifiedName of expectedSchemaQualifiedNames) {
        if (!actualSchemaQualifiedNames.has(schemaQualifiedName)) {
            issues.push(`${plan.definitionKey}: missing compiled artifact ${schemaQualifiedName}`)
        }
    }

    for (const schemaQualifiedName of actualSchemaQualifiedNames) {
        if (!expectedSchemaQualifiedNames.has(schemaQualifiedName)) {
            issues.push(`${plan.definitionKey}: unexpected compiled artifact ${schemaQualifiedName}`)
        }
    }

    if (actualSchemaQualifiedNames.size !== artifacts.length) {
        issues.push(`${plan.definitionKey}: compiled artifacts contain duplicate schemaQualifiedName values`)
    }

    const graph = validateDependencyGraph(
        artifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )
    if (!graph.ok) {
        issues.push(...graph.issues.map((issue) => `${plan.definitionKey}: ${issue}`))
    }

    const appObjectsDependency = `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_objects::custom`
    if (resolveSystemTableNames(plan.systemTableCapabilities).includes('_app_objects')) {
        for (const table of plan.businessTables) {
            const artifact = artifacts.find(
                (entry) =>
                    entry.schemaQualifiedName ===
                    `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${table.tableName}`
            )
            if (!artifact?.dependencies.includes(appObjectsDependency)) {
                issues.push(`${plan.definitionKey}: compiled business artifact ${table.tableName} must depend on _app_objects`)
            }

            const objectArtifact = artifacts.find(
                (entry) => entry.schemaQualifiedName === buildCompiledObjectArtifactSchemaQualifiedName(plan, table.tableName)
            )
            if (!objectArtifact?.dependencies.includes(appObjectsDependency)) {
                issues.push(`${plan.definitionKey}: compiled object artifact ${table.tableName} must depend on _app_objects`)
            }
            if (
                !objectArtifact?.dependencies.includes(
                    `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}.${table.tableName}::custom`
                )
            ) {
                issues.push(`${plan.definitionKey}: compiled object artifact ${table.tableName} must depend on its business table artifact`)
            }

            if (!objectArtifact) {
                continue
            }

            let parsedObjectPayload: unknown
            try {
                parsedObjectPayload = JSON.parse(objectArtifact.sql)
            } catch (error) {
                issues.push(
                    `${plan.definitionKey}: compiled object artifact ${table.tableName} contains invalid JSON: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                )
                continue
            }

            const expectedObjectPayload = buildCompiledSystemAppObjectPayload(plan, table)

            if (
                !isRecord(parsedObjectPayload) ||
                JSON.stringify(parsedObjectPayload.presentation ?? null) !== JSON.stringify(expectedObjectPayload.presentation ?? null)
            ) {
                issues.push(
                    `${plan.definitionKey}: compiled object artifact ${table.tableName} must preserve manifest presentation metadata`
                )
            }
        }
    }

    const appAttributesDependency = `system_app_compiled.table.${plan.stage}.${plan.definitionKey}.${plan.schemaName}._app_attributes::custom`
    if (resolveSystemTableNames(plan.systemTableCapabilities).includes('_app_attributes')) {
        for (const table of plan.businessTables) {
            for (const field of table.fields ?? []) {
                const attributeArtifact = artifacts.find(
                    (entry) =>
                        entry.schemaQualifiedName ===
                        buildCompiledAttributeArtifactSchemaQualifiedName(plan, table.tableName, field.physicalColumnName)
                )
                if (!attributeArtifact?.dependencies.includes(appAttributesDependency)) {
                    issues.push(
                        `${plan.definitionKey}: compiled attribute artifact ${table.tableName}.${field.physicalColumnName} must depend on _app_attributes`
                    )
                }
                if (
                    !attributeArtifact?.dependencies.includes(
                        `${buildCompiledObjectArtifactSchemaQualifiedName(plan, table.tableName)}::custom`
                    )
                ) {
                    issues.push(
                        `${plan.definitionKey}: compiled attribute artifact ${table.tableName}.${field.physicalColumnName} must depend on its object artifact`
                    )
                }

                if (!attributeArtifact) {
                    continue
                }

                let parsedAttributePayload: unknown
                try {
                    parsedAttributePayload = JSON.parse(attributeArtifact.sql)
                } catch (error) {
                    issues.push(
                        `${plan.definitionKey}: compiled attribute artifact ${table.tableName}.${
                            field.physicalColumnName
                        } contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`
                    )
                    continue
                }

                const expectedAttributePayload = buildCompiledSystemAppAttributePayload(plan, table, field)

                if (
                    !isRecord(parsedAttributePayload) ||
                    JSON.stringify(parsedAttributePayload.presentation ?? null) !==
                        JSON.stringify(expectedAttributePayload.presentation ?? null) ||
                    JSON.stringify(parsedAttributePayload.validationRules ?? null) !==
                        JSON.stringify(expectedAttributePayload.validationRules ?? null) ||
                    JSON.stringify(parsedAttributePayload.uiConfig ?? null) !== JSON.stringify(expectedAttributePayload.uiConfig ?? null)
                ) {
                    issues.push(
                        `${plan.definitionKey}: compiled attribute artifact ${table.tableName}.${field.physicalColumnName} must preserve manifest metadata`
                    )
                }
            }
        }
    }

    return issues
}

export const validateRegisteredSystemAppCompiledDefinitions = (
    stage: 'current' | 'target' = 'target',
    keys?: string[]
): RegisteredSystemAppCompiledDefinitionsValidationResult => {
    const artifactSets = compileRegisteredSystemAppSchemaDefinitionArtifacts(stage, keys)
    const issues = artifactSets.flatMap((artifactSet) => validateSystemAppCompiledArtifactSet(artifactSet))

    return {
        ok: issues.length === 0,
        issues,
        artifactSets
    }
}

export const inspectSystemAppStructureMetadata = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan
): Promise<SystemAppStructureMetadataInspectionEntry> => {
    const expectedSystemTables = resolveSystemTableNames(plan.systemTableCapabilities)
    const systemTablesResult = await knex.raw(
        `
            select table_name
            from information_schema.tables
            where table_schema = ?
              and table_type = 'BASE TABLE'
              and table_name in (${expectedSystemTables.map(() => '?').join(', ')})
        `,
        [plan.schemaName, ...expectedSystemTables]
    )
    const presentSystemTables = normalizeRawRows(systemTablesResult)
        .map((row) => (typeof row.table_name === 'string' ? row.table_name : null))
        .filter((tableName): tableName is string => tableName !== null)
        .sort((left, right) => left.localeCompare(right))
    const missingSystemTables = expectedSystemTables.filter((tableName) => !presentSystemTables.includes(tableName))
    const expectedSnapshot = buildExpectedSystemAppStructureMetadataSnapshot(plan)
    const expectedFingerprint = buildSystemAppStructureMetadataFingerprint(expectedSnapshot)

    let objectRows: Array<Record<string, unknown>> = []
    let attributeRows: Array<Record<string, unknown>> = []
    let actualFingerprint: string | null = null
    let metadataFingerprintMatches = false

    if (presentSystemTables.includes('_app_objects')) {
        objectRows = normalizeRawRows(
            await knex.raw(
                `
                    select codename, table_name
                    from ${quoteIdentifier(plan.schemaName)}._app_objects
                    where _upl_deleted = false
                      and _app_deleted = false
                `
            )
        )
    }

    if (presentSystemTables.includes('_app_attributes')) {
        attributeRows = normalizeRawRows(
            await knex.raw(
                `
                    select o.codename as object_codename, a.codename, a.column_name
                    from ${quoteIdentifier(plan.schemaName)}._app_attributes a
                    join ${quoteIdentifier(plan.schemaName)}._app_objects o on o.id = a.object_id
                    where a._upl_deleted = false
                      and a._app_deleted = false
                      and o._upl_deleted = false
                      and o._app_deleted = false
                `
            )
        )
    }

    if (missingSystemTables.length === 0) {
        const actualSnapshot = await loadActualSystemAppStructureMetadataSnapshot(knex, plan, presentSystemTables)
        actualFingerprint = buildSystemAppStructureMetadataFingerprint(actualSnapshot)
        metadataFingerprintMatches = actualFingerprint === expectedFingerprint
    }

    const actualObjectKeys = new Set(
        objectRows
            .map((row) => {
                const codename = normalizeMetadataCodename(row.codename)
                const tableName = typeof row.table_name === 'string' ? row.table_name : null
                return codename && tableName ? `${codename}:${tableName}` : null
            })
            .filter((value): value is string => value !== null)
    )
    const missingObjectCodenames = plan.businessTables
        .filter((table) => !actualObjectKeys.has(`${table.codename}:${table.tableName}`))
        .map((table) => table.codename)
        .sort((left, right) => left.localeCompare(right))

    const actualAttributeKeys = new Set(
        attributeRows
            .map((row) => {
                const objectCodename = normalizeMetadataCodename(row.object_codename)
                const attributeCodename = normalizeMetadataCodename(row.codename)
                const columnName = typeof row.column_name === 'string' ? row.column_name : null
                return objectCodename && attributeCodename && columnName ? `${objectCodename}:${attributeCodename}:${columnName}` : null
            })
            .filter((value): value is string => value !== null)
    )
    const missingAttributeKeys = plan.businessTables
        .flatMap((table) =>
            (table.fields ?? []).map((field) => ({
                objectCodename: table.codename,
                attributeCodename: field.codename,
                columnName: field.physicalColumnName
            }))
        )
        .filter((field) => !actualAttributeKeys.has(`${field.objectCodename}:${field.attributeCodename}:${field.columnName}`))
        .map((field) => `${field.objectCodename}.${field.attributeCodename}`)
        .sort((left, right) => left.localeCompare(right))

    return {
        definitionKey: plan.definitionKey,
        schemaName: plan.schemaName,
        stage: plan.stage,
        storageModel: plan.storageModel,
        expectedSystemTables,
        presentSystemTables,
        missingSystemTables,
        objectCount: objectRows.length,
        attributeCount: attributeRows.length,
        missingObjectCodenames,
        missingAttributeKeys,
        expectedFingerprint,
        actualFingerprint,
        metadataFingerprintMatches
    }
}

export const inspectRegisteredSystemAppStructureMetadata = async (
    knex: Knex,
    stage: 'current' | 'target' = 'target',
    keys?: string[]
): Promise<RegisteredSystemAppStructureMetadataInspectionResult> => {
    const plans = planRegisteredSystemAppSchemaGenerationPlans(stage, keys).filter((plan) => plan.structureCapabilities.appCoreTables)
    const entries = await Promise.all(plans.map((plan) => inspectSystemAppStructureMetadata(knex, plan)))
    const issues = entries.flatMap((entry) => [
        ...entry.missingSystemTables.map((tableName) => `${entry.definitionKey}: missing system table ${entry.schemaName}.${tableName}`),
        ...entry.missingObjectCodenames.map((codename) => `${entry.definitionKey}: missing _app_objects metadata for ${codename}`),
        ...entry.missingAttributeKeys.map((key) => `${entry.definitionKey}: missing _app_attributes metadata for ${key}`),
        ...(entry.metadataFingerprintMatches
            ? []
            : [`${entry.definitionKey}: structure metadata fingerprint mismatch for ${entry.schemaName}`])
    ])

    return {
        ok: issues.length === 0,
        issues,
        entries
    }
}

export const applySystemAppSchemaGenerationPlan = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    options: ApplySystemAppSchemaGenerationPlanOptions = {}
): Promise<SchemaGenerationResult> => {
    const generator = new SchemaGenerator(knex)
    const result = await generator.generateFullSchema(
        plan.schemaName,
        buildSystemAppBusinessEntities(plan),
        buildExecutableSystemAppSchemaGenerationOptions(knex, plan, options, 'baseline')
    )

    if (!result.success) {
        throw new Error(
            `Failed to apply system app schema generation plan for ${plan.definitionKey}: ${result.errors.join('; ') || 'unknown error'}`
        )
    }

    return result
}

export const bootstrapSystemAppStructureMetadata = async (
    knex: Knex,
    plan: SystemAppSchemaGenerationPlan,
    options: BootstrapSystemAppStructureMetadataOptions = {}
): Promise<BootstrappedSystemAppStructureMetadataResult> => {
    if (!plan.structureCapabilities.appCoreTables) {
        throw new Error(`System app ${plan.definitionKey} does not enable application-like core tables for ${plan.stage} stage`)
    }

    const generator = new SchemaGenerator(knex)
    const businessEntities = buildSystemAppBusinessEntities(plan)

    const inspection = await inspectSystemAppStructureMetadata(knex, plan)
    if (
        inspection.missingSystemTables.length === 0 &&
        inspection.missingObjectCodenames.length === 0 &&
        inspection.missingAttributeKeys.length === 0 &&
        inspection.metadataFingerprintMatches
    ) {
        return {
            definitionKey: plan.definitionKey,
            schemaName: plan.schemaName,
            stage: plan.stage,
            storageModel: plan.storageModel,
            metadataObjectCount: businessEntities.length,
            metadataAttributeCount: businessEntities.reduce((count, entity) => count + entity.fields.length, 0),
            systemTables: resolveSystemTableNames(plan.systemTableCapabilities),
            syncStrategy: 'noop'
        }
    }

    await knex.transaction(async (trx) => {
        await generator.createSchema(plan.schemaName, trx)
        await generator.syncSystemMetadata(plan.schemaName, businessEntities, {
            trx,
            userId: options.userId ?? null,
            removeMissing: true,
            systemTableCapabilities: plan.systemTableCapabilities
        })
    })

    return {
        definitionKey: plan.definitionKey,
        schemaName: plan.schemaName,
        stage: plan.stage,
        storageModel: plan.storageModel,
        metadataObjectCount: businessEntities.length,
        metadataAttributeCount: businessEntities.reduce((count, entity) => count + entity.fields.length, 0),
        systemTables: resolveSystemTableNames(plan.systemTableCapabilities),
        syncStrategy: 'full_sync'
    }
}

export const applyRegisteredSystemAppSchemaGenerationPlan = async (
    knex: Knex,
    key: string,
    stage: 'current' | 'target' = 'target',
    options: ApplySystemAppSchemaGenerationPlanOptions = {}
): Promise<SchemaGenerationResult> =>
    applySystemAppSchemaGenerationPlan(knex, buildRegisteredSystemAppSchemaGenerationPlan(key, stage), options)

export const applyRegisteredSystemAppSchemaGenerationPlans = async (
    knex: Knex,
    options: ApplyRegisteredSystemAppSchemaGenerationPlansOptions = {}
): Promise<ApplyRegisteredSystemAppSchemaGenerationPlansResult> => {
    const stage = options.stage ?? 'target'
    const plans = planRegisteredSystemAppSchemaGenerationPlans(stage, options.keys)
    const applied: AppliedSystemAppSchemaGenerationPlanResult[] = []

    for (const plan of plans) {
        const result = await applySystemAppSchemaGenerationPlan(knex, plan, options.generatorOptions)
        applied.push({
            definitionKey: plan.definitionKey,
            schemaName: plan.schemaName,
            stage: plan.stage,
            storageModel: plan.storageModel,
            tablesCreated: result.tablesCreated
        })
    }

    return {
        applied
    }
}

const listPresentSchemaTables = async (knex: Knex, schemaName: string): Promise<Set<string>> => {
    const result = await knex.raw(
        `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = ?
              AND table_type = 'BASE TABLE'
        `,
        [schemaName]
    )

    return new Set(normalizeRawRows(result).map((row) => String(row.table_name ?? '')))
}

export const ensureRegisteredSystemAppSchemaGenerationPlans = async (
    knex: Knex,
    options: EnsureRegisteredSystemAppSchemaGenerationPlansOptions = {}
): Promise<EnsureRegisteredSystemAppSchemaGenerationPlansResult> => {
    const stage = options.stage ?? 'target'
    const plans = selectApplicationLikeSystemAppPlans(planRegisteredSystemAppSchemaGenerationPlans(stage, options.keys))
    const ensured: EnsuredSystemAppSchemaGenerationPlanResult[] = []

    for (const plan of plans) {
        const expectedBusinessTables = plan.businessTables.map((table) => table.tableName)
        const presentTables = await listPresentSchemaTables(knex, plan.schemaName)
        const presentBusinessTables = expectedBusinessTables.filter((tableName) => presentTables.has(tableName))

        if (presentBusinessTables.length === 0) {
            const result = await applySystemAppSchemaGenerationPlan(knex, plan, options.generatorOptions)
            ensured.push({
                definitionKey: plan.definitionKey,
                schemaName: plan.schemaName,
                stage: plan.stage,
                storageModel: plan.storageModel,
                action: 'applied',
                tablesCreated: result.tablesCreated
            })
            continue
        }

        if (presentBusinessTables.length !== expectedBusinessTables.length) {
            const missingBusinessTables = expectedBusinessTables.filter((tableName) => !presentTables.has(tableName))
            throw new Error(
                `System app ${
                    plan.definitionKey
                } is in a partially bootstrapped fixed-schema state: missing business tables ${missingBusinessTables.join(', ')}`
            )
        }

        if (!presentTables.has('_app_migrations')) {
            throw new Error(
                `System app ${plan.definitionKey} is missing ${plan.schemaName}._app_migrations while business tables already exist`
            )
        }

        const baselineBackfilled = await ensureSystemAppBaselineHistory(knex, plan, options.generatorOptions?.userId ?? null)

        const { upgraded } = await upgradeSystemAppSchemaGenerationPlan(knex, plan, options.generatorOptions)

        ensured.push({
            definitionKey: plan.definitionKey,
            schemaName: plan.schemaName,
            stage: plan.stage,
            storageModel: plan.storageModel,
            action: upgraded ? 'upgraded' : baselineBackfilled ? 'baseline_backfilled' : 'skipped',
            tablesCreated: []
        })
    }

    return {
        ensured
    }
}

export const bootstrapRegisteredSystemAppStructureMetadata = async (
    knex: Knex,
    options: BootstrapRegisteredSystemAppStructureMetadataOptions = {}
): Promise<BootstrapRegisteredSystemAppStructureMetadataResult> => {
    const stage = options.stage ?? 'target'
    const plans = selectApplicationLikeSystemAppPlans(planRegisteredSystemAppSchemaGenerationPlans(stage, options.keys))
    const bootstrapped: BootstrappedSystemAppStructureMetadataResult[] = []

    for (const plan of plans) {
        bootstrapped.push(
            await bootstrapSystemAppStructureMetadata(knex, plan, {
                userId: options.userId ?? null
            })
        )
    }

    return {
        bootstrapped
    }
}
