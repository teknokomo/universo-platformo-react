import type { VersionedLocalizedContent } from '@universo/types'
import type { SqlQueryable, PublicationRow, PublicationVersionRow, PublicationAccessMode, PublicationSchemaStatus } from './types'
import { uplFieldAliases, appFieldAliases } from './types'
import { activeMetahubRowCondition } from './metahubsQueryHelpers'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT fragments
// ═══════════════════════════════════════════════════════════════════════════════

const PUBLICATION_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.metahub_id AS "metahubId",
    ${alias}.name,
    ${alias}.description,
    ${alias}.access_mode AS "accessMode",
    ${alias}.access_config AS "accessConfig",
    ${alias}.schema_name AS "schemaName",
    ${alias}.schema_status AS "schemaStatus",
    ${alias}.schema_error AS "schemaError",
    ${alias}.schema_synced_at AS "schemaSyncedAt",
    ${alias}.schema_snapshot AS "schemaSnapshot",
    ${alias}.auto_create_application AS "autoCreateApplication",
    ${alias}.active_version_id AS "activeVersionId",
    ${uplFieldAliases(alias)},
    ${appFieldAliases(alias)}
`.trim()

const PUB_VERSION_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.publication_id AS "publicationId",
    ${alias}.branch_id AS "branchId",
    ${alias}.version_number AS "versionNumber",
    ${alias}.name,
    ${alias}.description,
    ${alias}.snapshot_json AS "snapshotJson",
    ${alias}.snapshot_hash AS "snapshotHash",
    ${alias}.is_active AS "isActive",
    ${uplFieldAliases(alias)},
    ${appFieldAliases(alias)}
`.trim()

// ═══════════════════════════════════════════════════════════════════════════════
// Publication queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findPublicationById(exec: SqlQueryable, id: string): Promise<PublicationRow | null> {
    const rows = await exec.query<PublicationRow>(
        `SELECT ${PUBLICATION_SELECT('p')}
         FROM metahubs.doc_publications p
         WHERE p.id = $1
           AND ${activeMetahubRowCondition('p')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findPublicationByIdNotDeleted(exec: SqlQueryable, id: string): Promise<PublicationRow | null> {
    const rows = await exec.query<PublicationRow>(
        `SELECT ${PUBLICATION_SELECT('p')}
         FROM metahubs.doc_publications p
         WHERE p.id = $1
                     AND ${activeMetahubRowCondition('p')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export interface PublicationListItem extends PublicationRow {
    versionsCount: number
}

interface PublicationListRow extends PublicationListItem {
    windowTotal: string
}

export async function listPublications(
    exec: SqlQueryable,
    input: {
        metahubId: string
        limit: number
        offset: number
        sortBy?: 'name' | 'created' | 'updated'
        sortOrder?: 'asc' | 'desc'
        includeDeleted?: boolean
    }
): Promise<{ items: PublicationListItem[]; total: number }> {
    const params: unknown[] = [input.metahubId]
    const conditions: string[] = ['p.metahub_id = $1']

    if (!input.includeDeleted) {
        conditions.push(activeMetahubRowCondition('p'))
    }

    params.push(input.limit, input.offset)
    const limitIdx = params.length - 1
    const offsetIdx = params.length

    const orderCol =
        input.sortBy === 'name'
            ? `COALESCE(p.name->>(p.name->>'_primary'), p.name->>'en', '')`
            : input.sortBy === 'created'
            ? 'p._upl_created_at'
            : 'p._upl_updated_at'
    const orderDir = (input.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const rows = await exec.query<PublicationListRow>(
        `SELECT
            ${PUBLICATION_SELECT('p')},
            COALESCE(vc.count, 0)::int AS "versionsCount",
            COUNT(*) OVER() AS "windowTotal"
         FROM metahubs.doc_publications p
         LEFT JOIN (
             SELECT publication_id, COUNT(*)::int AS count
             FROM metahubs.doc_publication_versions
             WHERE ${activeMetahubRowCondition()}
             GROUP BY publication_id
         ) vc ON vc.publication_id = p.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items: PublicationListItem[] = rows.map(({ windowTotal: _wt, ...row }) => row)
    return { items, total }
}

export async function listPublicationsByMetahub(exec: SqlQueryable, metahubId: string): Promise<PublicationRow[]> {
    return exec.query<PublicationRow>(
        `SELECT ${PUBLICATION_SELECT('p')}
         FROM metahubs.doc_publications p
         WHERE p.metahub_id = $1
                     AND ${activeMetahubRowCondition('p')}
         ORDER BY p._upl_created_at ASC`,
        [metahubId]
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Publication create / update
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreatePublicationInput {
    metahubId: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    accessMode?: PublicationAccessMode
    accessConfig?: Record<string, unknown> | null
    autoCreateApplication?: boolean
    userId: string
}

export async function createPublication(exec: SqlQueryable, input: CreatePublicationInput): Promise<PublicationRow> {
    const rows = await exec.query<PublicationRow>(
        `INSERT INTO metahubs.doc_publications (
            metahub_id, name, description, access_mode, access_config,
            auto_create_application,
            _upl_created_by, _upl_updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING ${PUBLICATION_SELECT('metahubs.doc_publications')}`,
        [
            input.metahubId,
            JSON.stringify(input.name),
            input.description ? JSON.stringify(input.description) : null,
            input.accessMode ?? 'full',
            input.accessConfig ? JSON.stringify(input.accessConfig) : '{}',
            input.autoCreateApplication ?? false,
            input.userId
        ]
    )
    return rows[0]
}

export interface UpdatePublicationInput {
    name?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    accessMode?: PublicationAccessMode
    accessConfig?: Record<string, unknown> | null
    schemaName?: string | null
    schemaStatus?: PublicationSchemaStatus
    schemaError?: string | null
    schemaSyncedAt?: Date | null
    schemaSnapshot?: Record<string, unknown> | null
    autoCreateApplication?: boolean
    activeVersionId?: string | null
    userId?: string
    expectedVersion?: number
}

export async function updatePublication(exec: SqlQueryable, id: string, input: UpdatePublicationInput): Promise<PublicationRow | null> {
    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    const push = (col: string, val: unknown) => {
        setClauses.push(`${col} = $${idx}`)
        params.push(val)
        idx++
    }

    if (input.name !== undefined) push('name', JSON.stringify(input.name))
    if (input.description !== undefined) push('description', input.description ? JSON.stringify(input.description) : null)
    if (input.accessMode !== undefined) push('access_mode', input.accessMode)
    if (input.accessConfig !== undefined) push('access_config', input.accessConfig ? JSON.stringify(input.accessConfig) : null)
    if (input.schemaName !== undefined) push('schema_name', input.schemaName)
    if (input.schemaStatus !== undefined) push('schema_status', input.schemaStatus)
    if (input.schemaError !== undefined) push('schema_error', input.schemaError)
    if (input.schemaSyncedAt !== undefined) push('schema_synced_at', input.schemaSyncedAt)
    if (input.schemaSnapshot !== undefined) push('schema_snapshot', input.schemaSnapshot ? JSON.stringify(input.schemaSnapshot) : null)
    if (input.autoCreateApplication !== undefined) push('auto_create_application', input.autoCreateApplication)
    if (input.activeVersionId !== undefined) push('active_version_id', input.activeVersionId)
    if (input.userId) push('_upl_updated_by', input.userId)

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = _upl_version + 1')

    if (setClauses.length === 0) return findPublicationById(exec, id)

    const conditions = [`id = $${idx}`]
    params.push(id)
    idx++

    conditions.push(activeMetahubRowCondition())

    if (input.expectedVersion !== undefined) {
        conditions.push(`_upl_version = $${idx}`)
        params.push(input.expectedVersion)
    }

    const rows = await exec.query<PublicationRow>(
        `UPDATE metahubs.doc_publications
         SET ${setClauses.join(', ')}
         WHERE ${conditions.join(' AND ')}
         RETURNING ${PUBLICATION_SELECT('metahubs.doc_publications')}`,
        params
    )
    return rows[0] ?? null
}

// ═══════════════════════════════════════════════════════════════════════════════
// PublicationVersion queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findPublicationVersionById(exec: SqlQueryable, id: string): Promise<PublicationVersionRow | null> {
    const rows = await exec.query<PublicationVersionRow>(
        `SELECT ${PUB_VERSION_SELECT('pv')}
         FROM metahubs.doc_publication_versions pv
         WHERE pv.id = $1
           AND ${activeMetahubRowCondition('pv')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findActivePublicationVersion(exec: SqlQueryable, publicationId: string): Promise<PublicationVersionRow | null> {
    const rows = await exec.query<PublicationVersionRow>(
        `SELECT ${PUB_VERSION_SELECT('pv')}
         FROM metahubs.doc_publication_versions pv
         WHERE pv.publication_id = $1
           AND pv.is_active = true
                     AND ${activeMetahubRowCondition('pv')}
         LIMIT 1`,
        [publicationId]
    )
    return rows[0] ?? null
}

export async function listPublicationVersions(exec: SqlQueryable, publicationId: string): Promise<PublicationVersionRow[]> {
    return exec.query<PublicationVersionRow>(
        `SELECT ${PUB_VERSION_SELECT('pv')}
         FROM metahubs.doc_publication_versions pv
         WHERE pv.publication_id = $1
           AND ${activeMetahubRowCondition('pv')}
         ORDER BY pv.version_number DESC`,
        [publicationId]
    )
}

export async function getMaxPublicationVersionNumber(exec: SqlQueryable, publicationId: string): Promise<number> {
    const rows = await exec.query<{ max: string | null }>(
        `SELECT MAX(version_number)::text AS max
         FROM metahubs.doc_publication_versions
         WHERE publication_id = $1`,
        [publicationId]
    )
    return parseInt(rows[0]?.max ?? '0', 10)
}

export interface CreatePublicationVersionInput {
    publicationId: string
    branchId?: string | null
    versionNumber: number
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    snapshotJson: Record<string, unknown>
    snapshotHash: string
    isActive?: boolean
    userId: string
}

export async function createPublicationVersion(exec: SqlQueryable, input: CreatePublicationVersionInput): Promise<PublicationVersionRow> {
    const rows = await exec.query<PublicationVersionRow>(
        `INSERT INTO metahubs.doc_publication_versions (
            publication_id, branch_id, version_number,
            name, description,
            snapshot_json, snapshot_hash, is_active,
            _upl_created_by, _upl_updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING ${PUB_VERSION_SELECT('metahubs.doc_publication_versions')}`,
        [
            input.publicationId,
            input.branchId ?? null,
            input.versionNumber,
            JSON.stringify(input.name),
            input.description ? JSON.stringify(input.description) : null,
            JSON.stringify(input.snapshotJson),
            input.snapshotHash,
            input.isActive ?? false,
            input.userId
        ]
    )
    return rows[0]
}

export async function deactivatePublicationVersions(exec: SqlQueryable, publicationId: string): Promise<void> {
    await exec.query(
        `UPDATE metahubs.doc_publication_versions
         SET is_active = false
         WHERE publication_id = $1
           AND is_active = true
           AND ${activeMetahubRowCondition()}`,
        [publicationId]
    )
}

export async function activatePublicationVersion(exec: SqlQueryable, versionId: string): Promise<void> {
    await exec.query(
        `UPDATE metahubs.doc_publication_versions
         SET is_active = true
         WHERE id = $1
           AND ${activeMetahubRowCondition()}`,
        [versionId]
    )
}
