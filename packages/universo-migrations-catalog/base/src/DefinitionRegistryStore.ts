import type { Knex } from 'knex'
import type { MigrationSourceKind } from '@universo/migrations-core'
import { createMigrationRunId, validateDependencyGraph } from '@universo/migrations-core'
import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

/** Domain kind of a single schema definition unit. */
export type DefinitionArtifactKind =
    | 'table'
    | 'index'
    | 'rls_policy'
    | 'function'
    | 'trigger'
    | 'seed_data'
    | 'constraint'
    | 'view'
    | 'custom'

/**
 * A single schema definition unit that can be stored and versioned
 * in the definition registry.
 */
export interface DefinitionArtifact {
    kind: DefinitionArtifactKind
    name: string
    schemaQualifiedName: string
    sql: string
    checksum: string
    dependencies: string[]
}

/** Revision status for a definition. */
export type DefinitionRevisionStatus = 'draft' | 'review' | 'published'

/** A stored definition registry entry. */
export interface DefinitionRegistryRecord {
    id: string
    logicalKey: string
    kind: DefinitionArtifactKind
    activeRevisionId: string | null
    sourceKind: MigrationSourceKind
    meta: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

/** A stored definition revision entry. */
export interface DefinitionRevisionRecord {
    id: string
    registryId: string
    revisionStatus: DefinitionRevisionStatus
    checksum: string
    payload: DefinitionArtifact
    provenance: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

/** A stored definition export entry. */
export interface DefinitionExportRecord {
    id: string
    registryId: string
    revisionId: string | null
    exportTarget: string
    fileChecksum: string | null
    meta: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

/** A stored definition draft entry. */
export interface DefinitionDraftRecord {
    id: string
    registryId: string | null
    status: DefinitionRevisionStatus
    checksum: string
    payload: DefinitionArtifact
    provenance: Record<string, unknown> | null
    authorId: string | null
    createdAt: string
    updatedAt: string
}

/** A stored approval event entry. */
export interface DefinitionApprovalEventRecord {
    id: string
    migrationRunId: string | null
    eventKind: string
    actorId: string | null
    payload: Record<string, unknown> | null
    createdAt: string
}

/** Canonical DB/file bundle contract for definition lifecycle round-trips. */
export interface DefinitionBundle {
    kind: 'definition_bundle'
    bundleVersion: 1
    checksumFamily: 'sha256'
    sourceKind: MigrationSourceKind
    generatedAt: string
    artifacts: DefinitionArtifact[]
    meta: Record<string, unknown> | null
    provenance: Record<string, unknown> | null
}

/** Filter options for listing definitions. */
export interface ListDefinitionsFilter {
    kind?: DefinitionArtifactKind
    sourceKind?: MigrationSourceKind
    logicalKeyPrefix?: string
    limit?: number
    offset?: number
}

// ═══════════════════════════════════════════════════════════════════════
// Row mappers
// ═══════════════════════════════════════════════════════════════════════

interface DefinitionRegistryRow {
    id: string
    logical_key: string
    kind: string
    active_revision_id: string | null
    source_kind: string
    meta: Record<string, unknown> | null
    _upl_created_at: string
    _upl_updated_at: string
}

interface DefinitionRevisionRow {
    id: string
    registry_id: string
    revision_status: string
    checksum: string
    payload: DefinitionArtifact | string
    provenance: Record<string, unknown> | null
    _upl_created_at: string
    _upl_updated_at: string
}

interface DefinitionExportRow {
    id: string
    registry_id: string
    revision_id: string | null
    export_target: string
    file_checksum: string | null
    meta: Record<string, unknown> | null
    _upl_created_at: string
    _upl_updated_at: string
}

interface DefinitionDraftRow {
    id: string
    registry_id: string | null
    status: string
    checksum: string
    payload: DefinitionArtifact | string
    provenance: Record<string, unknown> | null
    author_id: string | null
    _upl_created_at: string
    _upl_updated_at: string
}

interface DefinitionApprovalEventRow {
    id: string
    migration_run_id: string | null
    event_kind: string
    actor_id: string | null
    payload: Record<string, unknown> | null
    _upl_created_at: string
}

const mapRegistryRow = (row: DefinitionRegistryRow): DefinitionRegistryRecord => ({
    id: row.id,
    logicalKey: row.logical_key,
    kind: row.kind as DefinitionArtifactKind,
    activeRevisionId: row.active_revision_id,
    sourceKind: row.source_kind as MigrationSourceKind,
    meta: row.meta,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at
})

const mapRevisionRow = (row: DefinitionRevisionRow): DefinitionRevisionRecord => ({
    id: row.id,
    registryId: row.registry_id,
    revisionStatus: row.revision_status as DefinitionRevisionStatus,
    checksum: row.checksum,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    provenance: row.provenance,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at
})

const mapExportRow = (row: DefinitionExportRow): DefinitionExportRecord => ({
    id: row.id,
    registryId: row.registry_id,
    revisionId: row.revision_id,
    exportTarget: row.export_target,
    fileChecksum: row.file_checksum,
    meta: row.meta,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at
})

const mapDraftRow = (row: DefinitionDraftRow): DefinitionDraftRecord => ({
    id: row.id,
    registryId: row.registry_id,
    status: row.status as DefinitionRevisionStatus,
    checksum: row.checksum,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    provenance: row.provenance,
    authorId: row.author_id,
    createdAt: row._upl_created_at,
    updatedAt: row._upl_updated_at
})

const mapApprovalEventRow = (row: DefinitionApprovalEventRow): DefinitionApprovalEventRecord => ({
    id: row.id,
    migrationRunId: row.migration_run_id,
    eventKind: row.event_kind,
    actorId: row.actor_id,
    payload: row.payload,
    createdAt: row._upl_created_at
})

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calculate a SHA-256 checksum for a definition artifact's SQL content.
 */
export function calculateDefinitionChecksum(sql: string): string {
    return createHash('sha256').update(sql).digest('hex')
}

const buildDefinitionArtifactComparisonSignature = (
    artifact: Pick<DefinitionArtifact, 'kind' | 'name' | 'schemaQualifiedName' | 'sql' | 'dependencies'>
): string =>
    stableStringify({
        kind: artifact.kind,
        name: artifact.name,
        schemaQualifiedName: artifact.schemaQualifiedName,
        sql: artifact.sql,
        dependencies: artifact.dependencies.map((dependency) => String(dependency))
    }) ?? ''

export function areDefinitionArtifactsEquivalent(
    left: Pick<DefinitionArtifact, 'kind' | 'name' | 'schemaQualifiedName' | 'sql' | 'dependencies'>,
    right: Pick<DefinitionArtifact, 'kind' | 'name' | 'schemaQualifiedName' | 'sql' | 'dependencies'>
): boolean {
    return buildDefinitionArtifactComparisonSignature(left) === buildDefinitionArtifactComparisonSignature(right)
}

/**
 * Build a deterministic logical key for a definition artifact.
 * Format: `<schemaQualifiedName>::<kind>`
 */
export function buildLogicalKey(artifact: Pick<DefinitionArtifact, 'schemaQualifiedName' | 'kind'>): string {
    return `${artifact.schemaQualifiedName}::${artifact.kind}`
}

/**
 * Build a DefinitionArtifact from its components, computing the checksum.
 */
export function createDefinitionArtifact(input: Omit<DefinitionArtifact, 'checksum'>): DefinitionArtifact {
    return {
        ...input,
        checksum: calculateDefinitionChecksum(input.sql)
    }
}

const advisoryLockKeySql = `
    ('x' || substr(md5(?), 1, 16))::bit(64)::bigint
`

const isTransaction = (executor: Knex | Knex.Transaction): executor is Knex.Transaction =>
    (executor as Knex.Transaction & { isTransaction?: boolean }).isTransaction === true

const isUniqueViolationError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') {
        return false
    }

    const candidate = error as { code?: string; errno?: number; message?: string }
    if (candidate.code === '23505' || candidate.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return true
    }

    return typeof candidate.message === 'string' && candidate.message.toLowerCase().includes('unique')
}

export function normalizeDefinitionArtifact(artifact: DefinitionArtifact): DefinitionArtifact {
    const checksum = calculateDefinitionChecksum(artifact.sql)
    if (artifact.checksum !== checksum) {
        throw new Error(`Definition artifact checksum mismatch for ${buildLogicalKey(artifact)}`)
    }

    return {
        kind: artifact.kind,
        name: artifact.name,
        schemaQualifiedName: artifact.schemaQualifiedName,
        sql: artifact.sql,
        checksum,
        dependencies: artifact.dependencies.map((dependency) => String(dependency))
    }
}

const mergeLifecycleProvenance = (
    artifact: DefinitionArtifact,
    input?: {
        sourceKind?: MigrationSourceKind
        actorId?: string | null
        reviewState?: DefinitionRevisionStatus
        importedFrom?: string | null
        exportedTo?: string | null
        compilerVersion?: string | null
        checksumFamily?: 'sha256'
        base?: Record<string, unknown> | null
    }
): Record<string, unknown> => ({
    ...(input?.base ?? {}),
    logicalKey: buildLogicalKey(artifact),
    sourceKind: input?.sourceKind ?? (input?.base?.sourceKind as MigrationSourceKind | undefined) ?? 'declarative',
    actorId: input?.actorId ?? (input?.base?.actorId as string | null | undefined) ?? null,
    reviewState: input?.reviewState ?? (input?.base?.reviewState as DefinitionRevisionStatus | undefined) ?? 'draft',
    importedFrom: input?.importedFrom ?? (input?.base?.importedFrom as string | null | undefined) ?? null,
    exportedTo: input?.exportedTo ?? (input?.base?.exportedTo as string | null | undefined) ?? null,
    compilerVersion: input?.compilerVersion ?? (input?.base?.compilerVersion as string | null | undefined) ?? null,
    checksumFamily: input?.checksumFamily ?? (input?.base?.checksumFamily as 'sha256' | undefined) ?? 'sha256'
})

const normalizeRecordValue = (value: unknown): Record<string, unknown> | null => {
    if (!value) {
        return null
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>
    }

    if (typeof value !== 'string') {
        return null
    }

    try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
    } catch {
        return null
    }
}

const mergeRecordValues = (base: unknown, next?: Record<string, unknown> | null): Record<string, unknown> | null => {
    const normalizedBase = normalizeRecordValue(base)

    if (!normalizedBase && !next) {
        return null
    }

    return {
        ...(normalizedBase ?? {}),
        ...(next ?? {})
    }
}

const hasPublishedLifecycleProvenance = (provenance: unknown): boolean => {
    const normalized = normalizeRecordValue(provenance)
    if (!normalized) {
        return false
    }

    return normalized.reviewState === 'published' && normalized.checksumFamily === 'sha256' && typeof normalized.sourceKind === 'string'
}

const ensureDefinitionRegistryShell = async (
    trx: Knex | Knex.Transaction,
    artifact: DefinitionArtifact,
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
    }
): Promise<DefinitionRegistryRecord> => {
    const normalizedArtifact = normalizeDefinitionArtifact(artifact)
    const logicalKey = buildLogicalKey(normalizedArtifact)
    const sourceKind = options?.sourceKind ?? 'declarative'
    const now = new Date().toISOString()

    const existing = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ logical_key: logicalKey }).first()
    if (existing) {
        if (options?.meta) {
            await trx('upl_migrations.definition_registry').where({ id: existing.id }).update({
                meta: options.meta,
                source_kind: sourceKind,
                _upl_updated_at: now
            })

            const refreshed = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ id: existing.id }).first()
            return mapRegistryRow(refreshed ?? existing)
        }

        return mapRegistryRow(existing)
    }

    const registryRow: DefinitionRegistryRow = {
        id: createMigrationRunId(),
        logical_key: logicalKey,
        kind: normalizedArtifact.kind,
        active_revision_id: null,
        source_kind: sourceKind,
        meta: options?.meta ?? null,
        _upl_created_at: now,
        _upl_updated_at: now
    }

    await trx('upl_migrations.definition_registry').insert(registryRow)
    return mapRegistryRow(registryRow)
}

// ═══════════════════════════════════════════════════════════════════════
// CRUD operations
// ═══════════════════════════════════════════════════════════════════════

/**
 * Register a new definition (or update the active revision if the artifact changed).
 * Idempotent — returns existing record if the checksum matches.
 */
export async function registerDefinition(
    trx: Knex | Knex.Transaction,
    artifact: DefinitionArtifact,
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
    }
): Promise<{
    registry: DefinitionRegistryRecord
    revision: DefinitionRevisionRecord
    created: boolean
    changeType: 'created' | 'updated' | 'unchanged'
}> {
    const normalizedArtifact = normalizeDefinitionArtifact(artifact)
    const logicalKey = buildLogicalKey(normalizedArtifact)
    const sourceKind = options?.sourceKind ?? 'declarative'
    const now = new Date().toISOString()
    const mergedProvenance = mergeLifecycleProvenance(normalizedArtifact, {
        sourceKind,
        reviewState: 'published',
        base: mergeRecordValues(null, options?.provenance ?? null)
    })

    if (isTransaction(trx)) {
        await trx.raw(`SELECT pg_advisory_xact_lock(${advisoryLockKeySql})`, [`definition_registry:${logicalKey}`])
    }

    // Check for existing registry entry
    const existing = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ logical_key: logicalKey }).first()

    if (existing) {
        const hasActiveRevision = !!existing.active_revision_id

        // Check if active revision has same checksum
        if (existing.active_revision_id) {
            const activeRevision = await trx<DefinitionRevisionRow>('upl_migrations.definition_revisions')
                .where({ id: existing.active_revision_id })
                .first()

            if (activeRevision && activeRevision.checksum === artifact.checksum) {
                const activePayload =
                    typeof activeRevision.payload === 'string'
                        ? (JSON.parse(activeRevision.payload) as DefinitionArtifact)
                        : (activeRevision.payload as DefinitionArtifact)

                if (areDefinitionArtifactsEquivalent(activePayload, normalizedArtifact)) {
                    const nextProvenance = mergeLifecycleProvenance(normalizedArtifact, {
                        sourceKind,
                        reviewState: 'published',
                        base: mergeRecordValues(activeRevision.provenance, options?.provenance ?? null)
                    })

                    await trx('upl_migrations.definition_revisions').where({ id: activeRevision.id }).update({
                        provenance: nextProvenance,
                        _upl_updated_at: now
                    })

                    await trx('upl_migrations.definition_registry')
                        .where({ id: existing.id })
                        .update({
                            source_kind: sourceKind,
                            meta: options?.meta ?? existing.meta,
                            _upl_updated_at: now
                        })

                    const refreshedRegistry = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry')
                        .where({ id: existing.id })
                        .first()

                    return {
                        registry: mapRegistryRow(refreshedRegistry ?? existing),
                        revision: mapRevisionRow({
                            ...activeRevision,
                            provenance: nextProvenance,
                            _upl_updated_at: now
                        }),
                        created: false,
                        changeType: 'unchanged'
                    }
                }
            }
        }

        // Checksum differs — create a new revision
        const revisionId = createMigrationRunId()
        const revisionRow: DefinitionRevisionRow = {
            id: revisionId,
            registry_id: existing.id,
            revision_status: 'published',
            checksum: normalizedArtifact.checksum,
            payload: normalizedArtifact as unknown as string,
            provenance: mergedProvenance,
            _upl_created_at: now,
            _upl_updated_at: now
        }
        await trx('upl_migrations.definition_revisions').insert(revisionRow)
        await trx('upl_migrations.definition_registry')
            .where({ id: existing.id })
            .update({
                active_revision_id: revisionId,
                source_kind: sourceKind,
                meta: options?.meta ?? existing.meta,
                _upl_updated_at: now
            })

        const updatedRegistry = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ id: existing.id }).first()

        return {
            registry: mapRegistryRow(updatedRegistry!),
            revision: mapRevisionRow(revisionRow),
            created: !hasActiveRevision,
            changeType: hasActiveRevision ? 'updated' : 'created'
        }
    }

    // New entry
    const registryId = createMigrationRunId()
    const revisionId = createMigrationRunId()

    const revisionRow: DefinitionRevisionRow = {
        id: revisionId,
        registry_id: registryId,
        revision_status: 'published',
        checksum: normalizedArtifact.checksum,
        payload: normalizedArtifact as unknown as string,
        provenance: mergedProvenance,
        _upl_created_at: now,
        _upl_updated_at: now
    }

    const registryRow: DefinitionRegistryRow = {
        id: registryId,
        logical_key: logicalKey,
        kind: normalizedArtifact.kind,
        active_revision_id: revisionId,
        source_kind: sourceKind,
        meta: options?.meta ?? null,
        _upl_created_at: now,
        _upl_updated_at: now
    }

    await trx('upl_migrations.definition_registry').insert(registryRow)
    await trx('upl_migrations.definition_revisions').insert(revisionRow)

    return {
        registry: mapRegistryRow(registryRow),
        revision: mapRevisionRow(revisionRow),
        created: true,
        changeType: 'created'
    }
}

const orderDefinitionArtifacts = (artifacts: DefinitionArtifact[]): DefinitionArtifact[] => {
    const normalizedArtifacts = artifacts.map((artifact) => normalizeDefinitionArtifact(artifact))
    const graph = validateDependencyGraph(
        normalizedArtifacts.map((artifact) => ({
            logicalKey: buildLogicalKey(artifact),
            dependencies: artifact.dependencies
        }))
    )

    if (!graph.ok) {
        throw new Error(`Definition artifact graph is invalid: ${graph.issues.join('; ')}`)
    }

    const byKey = new Map<string, DefinitionArtifact>(normalizedArtifacts.map((artifact) => [buildLogicalKey(artifact), artifact] as const))
    return graph.orderedKeys
        .map((logicalKey: string) => byKey.get(logicalKey))
        .filter((artifact): artifact is DefinitionArtifact => artifact != null)
}

/**
 * List definition registry entries with optional filtering.
 */
export async function listDefinitions(
    executor: Knex | Knex.Transaction,
    filter?: ListDefinitionsFilter
): Promise<{ records: DefinitionRegistryRecord[]; total: number }> {
    const { limit = 50, offset = 0 } = filter ?? {}

    let query = executor<DefinitionRegistryRow>('upl_migrations.definition_registry')

    if (filter?.kind) {
        query = query.where('kind', filter.kind)
    }
    if (filter?.sourceKind) {
        query = query.where('source_kind', filter.sourceKind)
    }
    if (filter?.logicalKeyPrefix) {
        query = query.where('logical_key', 'like', `${filter.logicalKeyPrefix}%`)
    }

    const countRow = await query.clone().count<{ count: string }[]>('* as count').first()
    const total = Number(countRow?.count ?? 0)

    const rows = await query.orderBy('_upl_created_at', 'desc').limit(limit).offset(offset)

    return {
        total,
        records: rows.map(mapRegistryRow)
    }
}

/**
 * Get a specific definition by its logical key.
 */
export async function getDefinitionByLogicalKey(
    executor: Knex | Knex.Transaction,
    logicalKey: string
): Promise<DefinitionRegistryRecord | null> {
    const row = await executor<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ logical_key: logicalKey }).first()

    return row ? mapRegistryRow(row) : null
}

/**
 * Get the active revision for a registry entry.
 */
export async function getActiveRevision(executor: Knex | Knex.Transaction, registryId: string): Promise<DefinitionRevisionRecord | null> {
    const registry = await executor<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ id: registryId }).first()

    if (!registry?.active_revision_id) return null

    const row = await executor<DefinitionRevisionRow>('upl_migrations.definition_revisions')
        .where({ id: registry.active_revision_id })
        .first()

    return row ? mapRevisionRow(row) : null
}

/**
 * List all revisions for a specific registry entry.
 */
export async function listRevisions(executor: Knex | Knex.Transaction, registryId: string): Promise<DefinitionRevisionRecord[]> {
    const rows = await executor<DefinitionRevisionRow>('upl_migrations.definition_revisions')
        .where({ registry_id: registryId })
        .orderBy('_upl_created_at', 'desc')

    return rows.map(mapRevisionRow)
}

/**
 * Create a draft definition revision without activating it.
 */
export async function createDefinitionDraft(
    executor: Knex | Knex.Transaction,
    artifact: DefinitionArtifact,
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
        authorId?: string | null
        status?: Extract<DefinitionRevisionStatus, 'draft'>
        compilerVersion?: string | null
    }
): Promise<DefinitionDraftRecord> {
    const runCreate = async (trx: Knex | Knex.Transaction): Promise<DefinitionDraftRecord> => {
        if (options?.status && options.status !== 'draft') {
            throw new Error('Definition drafts must be created in draft status')
        }

        const normalizedArtifact = normalizeDefinitionArtifact(artifact)
        const registry = await ensureDefinitionRegistryShell(trx, normalizedArtifact, {
            sourceKind: options?.sourceKind,
            meta: options?.meta ?? null
        })
        const now = new Date().toISOString()
        const row: DefinitionDraftRow = {
            id: createMigrationRunId(),
            registry_id: registry.id,
            status: 'draft',
            checksum: normalizedArtifact.checksum,
            payload: normalizedArtifact as unknown as string,
            provenance: mergeLifecycleProvenance(normalizedArtifact, {
                sourceKind: options?.sourceKind,
                actorId: options?.authorId ?? null,
                reviewState: 'draft',
                compilerVersion: options?.compilerVersion ?? null,
                base: options?.provenance ?? null
            }),
            author_id: options?.authorId ?? null,
            _upl_created_at: now,
            _upl_updated_at: now
        }

        await trx('upl_migrations.definition_drafts').insert(row)
        return mapDraftRow(row)
    }

    if (isTransaction(executor)) {
        return runCreate(executor)
    }

    if (typeof executor.transaction === 'function') {
        return executor.transaction(async (trx) => runCreate(trx))
    }

    return runCreate(executor)
}

/**
 * List stored drafts with optional filtering.
 */
export async function listDefinitionDrafts(
    executor: Knex | Knex.Transaction,
    filter?: {
        registryId?: string
        authorId?: string
        status?: DefinitionRevisionStatus
        limit?: number
        offset?: number
    }
): Promise<DefinitionDraftRecord[]> {
    const { limit = 50, offset = 0 } = filter ?? {}

    let query = executor<DefinitionDraftRow>('upl_migrations.definition_drafts')
    if (filter?.registryId) {
        query = query.where({ registry_id: filter.registryId })
    }
    if (filter?.authorId) {
        query = query.where({ author_id: filter.authorId })
    }
    if (filter?.status) {
        query = query.where({ status: filter.status })
    }

    const rows = await query.orderBy('_upl_created_at', 'desc').limit(limit).offset(offset)
    return rows.map(mapDraftRow)
}

/**
 * Record a lifecycle approval/review event.
 */
export async function recordApprovalEvent(
    trx: Knex | Knex.Transaction,
    input: {
        migrationRunId?: string | null
        eventKind: string
        actorId?: string | null
        payload?: Record<string, unknown> | null
    }
): Promise<DefinitionApprovalEventRecord> {
    const row: DefinitionApprovalEventRow = {
        id: createMigrationRunId(),
        migration_run_id: input.migrationRunId ?? null,
        event_kind: input.eventKind,
        actor_id: input.actorId ?? null,
        payload: input.payload ?? null,
        _upl_created_at: new Date().toISOString()
    }

    await trx('upl_migrations.approval_events').insert(row)
    return mapApprovalEventRow(row)
}

/**
 * Transition a draft into review state and persist review metadata.
 */
export async function requestDefinitionReview(
    executor: Knex | Knex.Transaction,
    draftId: string,
    options?: {
        actorId?: string | null
        payload?: Record<string, unknown> | null
    }
): Promise<DefinitionDraftRecord> {
    const runRequest = async (trx: Knex | Knex.Transaction): Promise<DefinitionDraftRecord> => {
        const existing = await trx<DefinitionDraftRow>('upl_migrations.definition_drafts').where({ id: draftId }).first()
        if (!existing) {
            throw new Error(`Definition draft ${draftId} not found`)
        }
        if (existing.status !== 'draft') {
            throw new Error(`Definition draft ${draftId} must be in draft status before review request`)
        }

        const payload = typeof existing.payload === 'string' ? JSON.parse(existing.payload) : existing.payload
        const now = new Date().toISOString()
        const nextProvenance = mergeLifecycleProvenance(payload, {
            actorId: options?.actorId ?? null,
            reviewState: 'review',
            base: existing.provenance
        })

        await trx('upl_migrations.definition_drafts').where({ id: draftId }).update({
            status: 'review',
            provenance: nextProvenance,
            _upl_updated_at: now
        })

        await recordApprovalEvent(trx, {
            eventKind: 'definition_review_requested',
            actorId: options?.actorId ?? null,
            payload: {
                draftId,
                registryId: existing.registry_id,
                ...(options?.payload ?? {})
            }
        })

        return mapDraftRow({
            ...existing,
            status: 'review',
            provenance: nextProvenance,
            _upl_updated_at: now
        })
    }

    if (isTransaction(executor)) {
        return runRequest(executor)
    }

    if (typeof executor.transaction === 'function') {
        return executor.transaction(async (trx) => runRequest(trx))
    }

    return runRequest(executor)
}

/**
 * Publish a draft into the active registry lifecycle and link approval metadata.
 */
export async function publishDefinitionDraft(
    executor: Knex | Knex.Transaction,
    draftId: string,
    options?: {
        actorId?: string | null
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        payload?: Record<string, unknown> | null
        compilerVersion?: string | null
    }
): Promise<{
    draft: DefinitionDraftRecord
    registry: DefinitionRegistryRecord
    revision: DefinitionRevisionRecord
    created: boolean
    changeType: 'created' | 'updated' | 'unchanged'
}> {
    const runPublish = async (trx: Knex | Knex.Transaction) => {
        const existing = await trx<DefinitionDraftRow>('upl_migrations.definition_drafts').where({ id: draftId }).first()
        if (!existing) {
            throw new Error(`Definition draft ${draftId} not found`)
        }
        if (existing.status !== 'review') {
            throw new Error(`Definition draft ${draftId} must be in review status before publication`)
        }

        const artifact = normalizeDefinitionArtifact(
            typeof existing.payload === 'string' ? (JSON.parse(existing.payload) as DefinitionArtifact) : existing.payload
        )
        const provenance = mergeLifecycleProvenance(artifact, {
            sourceKind: options?.sourceKind,
            actorId: options?.actorId ?? existing.author_id ?? null,
            reviewState: 'published',
            compilerVersion: options?.compilerVersion ?? null,
            base: existing.provenance
        })

        const published = await registerDefinition(trx, artifact, {
            sourceKind: options?.sourceKind,
            meta: options?.meta ?? null,
            provenance
        })

        const now = new Date().toISOString()
        await trx('upl_migrations.definition_drafts').where({ id: draftId }).update({
            registry_id: published.registry.id,
            status: 'published',
            provenance,
            _upl_updated_at: now
        })

        await recordApprovalEvent(trx, {
            eventKind: 'definition_published',
            actorId: options?.actorId ?? existing.author_id ?? null,
            payload: {
                draftId,
                registryId: published.registry.id,
                revisionId: published.revision.id,
                ...(options?.payload ?? {})
            }
        })

        return {
            draft: mapDraftRow({
                ...existing,
                registry_id: published.registry.id,
                status: 'published',
                provenance,
                _upl_updated_at: now
            }),
            registry: published.registry,
            revision: published.revision,
            created: published.created,
            changeType: published.changeType
        }
    }

    if (isTransaction(executor)) {
        return runPublish(executor)
    }

    if (typeof executor.transaction === 'function') {
        return executor.transaction(async (trx) => runPublish(trx))
    }

    return runPublish(executor)
}

const ensurePublishedDefinitionLifecycle = async (
    trx: Knex | Knex.Transaction,
    artifact: DefinitionArtifact,
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
        authorId?: string | null
        actorId?: string | null
        compilerVersion?: string | null
    }
): Promise<{
    registry: DefinitionRegistryRecord
    revision: DefinitionRevisionRecord
    created: boolean
    changeType: 'created' | 'updated' | 'unchanged'
}> => {
    const normalizedArtifact = normalizeDefinitionArtifact(artifact)
    const logicalKey = buildLogicalKey(normalizedArtifact)
    const existing = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry').where({ logical_key: logicalKey }).first()

    if (existing?.active_revision_id) {
        const activeRevision = await trx<DefinitionRevisionRow>('upl_migrations.definition_revisions')
            .where({ id: existing.active_revision_id })
            .first()

        if (activeRevision?.checksum === normalizedArtifact.checksum && hasPublishedLifecycleProvenance(activeRevision.provenance)) {
            return registerDefinition(trx, normalizedArtifact, {
                sourceKind: options?.sourceKind,
                meta: options?.meta ?? null,
                provenance: mergeRecordValues(activeRevision.provenance, options?.provenance ?? null)
            })
        }
    }

    const draft = await createDefinitionDraft(trx, normalizedArtifact, {
        sourceKind: options?.sourceKind,
        meta: options?.meta ?? null,
        provenance: options?.provenance ?? null,
        authorId: options?.authorId ?? options?.actorId ?? null,
        compilerVersion: options?.compilerVersion ?? null
    })

    await requestDefinitionReview(trx, draft.id, {
        actorId: options?.actorId ?? options?.authorId ?? null
    })

    const published = await publishDefinitionDraft(trx, draft.id, {
        actorId: options?.actorId ?? options?.authorId ?? null,
        sourceKind: options?.sourceKind,
        meta: options?.meta ?? null,
        compilerVersion: options?.compilerVersion ?? null
    })

    return {
        registry: published.registry,
        revision: published.revision,
        created: published.created,
        changeType: published.changeType
    }
}

/**
 * List recorded export events with optional filtering.
 */
export async function listDefinitionExports(
    executor: Knex | Knex.Transaction,
    filter?: {
        registryId?: string
        revisionId?: string
        exportTarget?: string
        limit?: number
        offset?: number
    }
): Promise<DefinitionExportRecord[]> {
    const { limit = 50, offset = 0 } = filter ?? {}

    let query = executor<DefinitionExportRow>('upl_migrations.definition_exports')
    if (filter?.registryId) {
        query = query.where({ registry_id: filter.registryId })
    }
    if (filter?.revisionId) {
        query = query.where({ revision_id: filter.revisionId })
    }
    if (filter?.exportTarget) {
        query = query.where({ export_target: filter.exportTarget })
    }

    const rows = await query.orderBy('_upl_created_at', 'desc').limit(limit).offset(offset)
    return rows.map(mapExportRow)
}

/**
 * Ensure the same export metadata record is not duplicated for the active revision.
 */
export async function ensureDefinitionExportRecorded(
    trx: Knex | Knex.Transaction,
    input: {
        registryId: string
        revisionId?: string | null
        exportTarget: string
        fileChecksum?: string | null
        meta?: Record<string, unknown> | null
    }
): Promise<DefinitionExportRecord> {
    const existing = await trx<DefinitionExportRow>('upl_migrations.definition_exports')
        .where({
            registry_id: input.registryId,
            revision_id: input.revisionId ?? null,
            export_target: input.exportTarget
        })
        .first()

    if (existing) {
        return mapExportRow(existing)
    }

    try {
        return await recordDefinitionExport(trx, input)
    } catch (error) {
        if (!isUniqueViolationError(error)) {
            throw error
        }

        const concurrent = await trx<DefinitionExportRow>('upl_migrations.definition_exports')
            .where({
                registry_id: input.registryId,
                revision_id: input.revisionId ?? null,
                export_target: input.exportTarget
            })
            .first()

        if (concurrent) {
            return mapExportRow(concurrent)
        }

        throw error
    }
}

/**
 * Build the canonical definition bundle contract used for DB/file round-trips.
 */
export function createDefinitionBundle(input: {
    artifacts: DefinitionArtifact[]
    sourceKind?: MigrationSourceKind
    generatedAt?: string
    meta?: Record<string, unknown> | null
    provenance?: Record<string, unknown> | null
}): DefinitionBundle {
    return {
        kind: 'definition_bundle',
        bundleVersion: 1,
        checksumFamily: 'sha256',
        sourceKind: input.sourceKind ?? 'declarative',
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        artifacts: orderDefinitionArtifacts(input.artifacts),
        meta: input.meta ?? null,
        provenance: input.provenance ?? null
    }
}

/**
 * Export published definitions as the canonical bundle format.
 */
export async function exportDefinitionBundle(
    executor: Knex | Knex.Transaction,
    filter?: { kind?: DefinitionArtifactKind; logicalKeyPrefix?: string },
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
    }
): Promise<DefinitionBundle> {
    const artifacts = await exportDefinitions(executor, filter)
    return createDefinitionBundle({
        artifacts,
        sourceKind: options?.sourceKind,
        meta: options?.meta ?? null,
        provenance: options?.provenance ?? null
    })
}

/**
 * Import the canonical bundle format into the registry lifecycle.
 */
export async function importDefinitionBundle(
    executor: Knex | Knex.Transaction,
    bundle: DefinitionBundle,
    options?: {
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
    }
): Promise<{ created: number; updated: number; unchanged: number }> {
    if (bundle.kind !== 'definition_bundle' || bundle.bundleVersion !== 1) {
        throw new Error('Definition bundle has an invalid kind or version')
    }
    if (bundle.checksumFamily !== 'sha256') {
        throw new Error(`Unsupported definition bundle checksum family: ${bundle.checksumFamily}`)
    }

    return importDefinitions(executor, bundle.artifacts, {
        sourceKind: bundle.sourceKind,
        meta: {
            bundleVersion: bundle.bundleVersion,
            checksumFamily: bundle.checksumFamily,
            generatedAt: bundle.generatedAt,
            ...(bundle.meta ?? {}),
            ...(options?.meta ?? {})
        },
        provenance: {
            ...(bundle.provenance ?? {}),
            ...(options?.provenance ?? {}),
            importedFrom: (options?.provenance?.importedFrom as string | undefined) ?? 'definition_bundle',
            checksumFamily: bundle.checksumFamily
        }
    })
}

// ═══════════════════════════════════════════════════════════════════════
// Export / import round-trip
// ═══════════════════════════════════════════════════════════════════════

/**
 * Export all published definitions from the registry, optionally filtered by kind.
 * Returns the artifacts in a format suitable for file-based storage or import.
 */
export async function exportDefinitions(
    executor: Knex | Knex.Transaction,
    filter?: { kind?: DefinitionArtifactKind; logicalKeyPrefix?: string }
): Promise<DefinitionArtifact[]> {
    let query = executor<DefinitionRegistryRow>('upl_migrations.definition_registry').whereNotNull('active_revision_id')

    if (filter?.kind) {
        query = query.where('kind', filter.kind)
    }
    if (filter?.logicalKeyPrefix) {
        query = query.where('logical_key', 'like', `${filter.logicalKeyPrefix}%`)
    }

    const registryRows = await query.orderBy('logical_key', 'asc')

    const artifacts: DefinitionArtifact[] = []

    for (const row of registryRows) {
        if (!row.active_revision_id) continue

        const revision = await executor<DefinitionRevisionRow>('upl_migrations.definition_revisions')
            .where({ id: row.active_revision_id })
            .first()

        if (revision) {
            const payload = typeof revision.payload === 'string' ? JSON.parse(revision.payload) : revision.payload
            artifacts.push(payload)
        }
    }

    return orderDefinitionArtifacts(artifacts)
}

/**
 * Import definition artifacts into the registry.
 * Upserts each artifact — creates if new, updates revision if checksum changed.
 */
export async function importDefinitions(
    executor: Knex | Knex.Transaction,
    artifacts: DefinitionArtifact[],
    options?: {
        sourceKind?: MigrationSourceKind
        meta?: Record<string, unknown> | null
        provenance?: Record<string, unknown> | null
        authorId?: string | null
        actorId?: string | null
        compilerVersion?: string | null
    }
): Promise<{ created: number; updated: number; unchanged: number }> {
    const runImport = async (trx: Knex | Knex.Transaction): Promise<{ created: number; updated: number; unchanged: number }> => {
        let created = 0
        let updated = 0
        let unchanged = 0

        for (const artifact of orderDefinitionArtifacts(artifacts)) {
            const result = await ensurePublishedDefinitionLifecycle(trx, artifact, {
                sourceKind: options?.sourceKind,
                meta: options?.meta ?? null,
                provenance: options?.provenance ?? null,
                authorId: options?.authorId ?? null,
                actorId: options?.actorId ?? null,
                compilerVersion: options?.compilerVersion ?? null
            })

            if (result.changeType === 'created') {
                created++
            } else if (result.changeType === 'updated') {
                updated++
            } else {
                unchanged++
            }
        }

        return { created, updated, unchanged }
    }

    if (isTransaction(executor)) {
        return runImport(executor)
    }

    if (typeof executor.transaction === 'function') {
        return executor.transaction(async (trx) => runImport(trx))
    }

    return runImport(executor)
}

/**
 * Record an export event for tracking when definitions were exported to a target.
 */
export async function recordDefinitionExport(
    trx: Knex | Knex.Transaction,
    input: {
        registryId: string
        revisionId?: string | null
        exportTarget: string
        fileChecksum?: string | null
        meta?: Record<string, unknown> | null
    }
): Promise<DefinitionExportRecord> {
    const id = createMigrationRunId()
    const now = new Date().toISOString()

    const row: DefinitionExportRow = {
        id,
        registry_id: input.registryId,
        revision_id: input.revisionId ?? null,
        export_target: input.exportTarget,
        file_checksum: input.fileChecksum ?? null,
        meta: input.meta ?? null,
        _upl_created_at: now,
        _upl_updated_at: now
    }

    await trx('upl_migrations.definition_exports').insert(row)
    return mapExportRow(row)
}
