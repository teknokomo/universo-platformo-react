import type { Knex } from 'knex'
import type { MigrationSourceKind } from '@universo/migrations-core'
import { createMigrationRunId } from '@universo/migrations-core'
import { createHash } from 'crypto'

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

/** Domain kind of a single schema definition unit. */
export type DefinitionArtifactKind = 'table' | 'index' | 'rls_policy' | 'function' | 'trigger' | 'seed_data' | 'constraint' | 'view' | 'custom'

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

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calculate a SHA-256 checksum for a definition artifact's SQL content.
 */
export function calculateDefinitionChecksum(sql: string): string {
    return createHash('sha256').update(sql).digest('hex')
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
    options?: { sourceKind?: MigrationSourceKind; meta?: Record<string, unknown> | null }
): Promise<{ registry: DefinitionRegistryRecord; revision: DefinitionRevisionRecord; created: boolean }> {
    const logicalKey = buildLogicalKey(artifact)
    const sourceKind = options?.sourceKind ?? 'declarative'
    const now = new Date().toISOString()

    // Check for existing registry entry
    const existing = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry')
        .where({ logical_key: logicalKey })
        .first()

    if (existing) {
        // Check if active revision has same checksum
        if (existing.active_revision_id) {
            const activeRevision = await trx<DefinitionRevisionRow>('upl_migrations.definition_revisions')
                .where({ id: existing.active_revision_id })
                .first()

            if (activeRevision && activeRevision.checksum === artifact.checksum) {
                return {
                    registry: mapRegistryRow(existing),
                    revision: mapRevisionRow(activeRevision),
                    created: false
                }
            }
        }

        // Checksum differs — create a new revision
        const revisionId = createMigrationRunId()
        const revisionRow: DefinitionRevisionRow = {
            id: revisionId,
            registry_id: existing.id,
            revision_status: 'published',
            checksum: artifact.checksum,
            payload: artifact as unknown as string,
            provenance: null,
            _upl_created_at: now,
            _upl_updated_at: now
        }
        await trx('upl_migrations.definition_revisions').insert(revisionRow)
        await trx('upl_migrations.definition_registry')
            .where({ id: existing.id })
            .update({ active_revision_id: revisionId, _upl_updated_at: now })

        const updatedRegistry = await trx<DefinitionRegistryRow>('upl_migrations.definition_registry')
            .where({ id: existing.id })
            .first()

        return {
            registry: mapRegistryRow(updatedRegistry!),
            revision: mapRevisionRow(revisionRow),
            created: false
        }
    }

    // New entry
    const registryId = createMigrationRunId()
    const revisionId = createMigrationRunId()

    const revisionRow: DefinitionRevisionRow = {
        id: revisionId,
        registry_id: registryId,
        revision_status: 'published',
        checksum: artifact.checksum,
        payload: artifact as unknown as string,
        provenance: null,
        _upl_created_at: now,
        _upl_updated_at: now
    }

    const registryRow: DefinitionRegistryRow = {
        id: registryId,
        logical_key: logicalKey,
        kind: artifact.kind,
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
        created: true
    }
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

    const rows = await query
        .orderBy('_upl_created_at', 'desc')
        .limit(limit)
        .offset(offset)

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
    const row = await executor<DefinitionRegistryRow>('upl_migrations.definition_registry')
        .where({ logical_key: logicalKey })
        .first()

    return row ? mapRegistryRow(row) : null
}

/**
 * Get the active revision for a registry entry.
 */
export async function getActiveRevision(
    executor: Knex | Knex.Transaction,
    registryId: string
): Promise<DefinitionRevisionRecord | null> {
    const registry = await executor<DefinitionRegistryRow>('upl_migrations.definition_registry')
        .where({ id: registryId })
        .first()

    if (!registry?.active_revision_id) return null

    const row = await executor<DefinitionRevisionRow>('upl_migrations.definition_revisions')
        .where({ id: registry.active_revision_id })
        .first()

    return row ? mapRevisionRow(row) : null
}

/**
 * List all revisions for a specific registry entry.
 */
export async function listRevisions(
    executor: Knex | Knex.Transaction,
    registryId: string
): Promise<DefinitionRevisionRecord[]> {
    const rows = await executor<DefinitionRevisionRow>('upl_migrations.definition_revisions')
        .where({ registry_id: registryId })
        .orderBy('_upl_created_at', 'desc')

    return rows.map(mapRevisionRow)
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
    let query = executor<DefinitionRegistryRow>('upl_migrations.definition_registry')
        .whereNotNull('active_revision_id')

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

    return artifacts
}

/**
 * Import definition artifacts into the registry.
 * Upserts each artifact — creates if new, updates revision if checksum changed.
 */
export async function importDefinitions(
    trx: Knex | Knex.Transaction,
    artifacts: DefinitionArtifact[],
    options?: { sourceKind?: MigrationSourceKind }
): Promise<{ created: number; updated: number; unchanged: number }> {
    let created = 0
    let updated = 0
    let unchanged = 0

    for (const artifact of artifacts) {
        const result = await registerDefinition(trx, artifact, { sourceKind: options?.sourceKind })
        if (result.created) {
            created++
        } else if (result.revision.checksum !== artifact.checksum) {
            updated++
        } else {
            unchanged++
        }
    }

    return { created, updated, unchanged }
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
