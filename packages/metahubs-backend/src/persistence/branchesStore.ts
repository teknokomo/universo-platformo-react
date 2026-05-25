import type { VersionedLocalizedContent } from '@universo/types'
import type { SqlQueryable, MetahubBranchRow } from './types'
import { uplFieldAliases, appFieldAliases } from './types'
import { activeMetahubRowCondition } from './metahubsQueryHelpers'
import { CURRENT_STRUCTURE_VERSION_SEMVER } from '../domains/metahubs/services/structureVersions'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const branchCodenameTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const resolveCodenameJson = (codename: VersionedLocalizedContent<string> | undefined): string | null =>
    codename ? JSON.stringify(codename) : null

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT fragments
// ═══════════════════════════════════════════════════════════════════════════════

const BRANCH_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.metahub_id AS "metahubId",
    ${alias}.source_branch_id AS "sourceBranchId",
    ${alias}.name,
    ${alias}.description,
    ${alias}.codename AS codename,
    ${alias}.branch_number AS "branchNumber",
    ${alias}.schema_name AS "schemaName",
    ${alias}.structure_version AS "structureVersion",
    ${alias}.last_template_version_id AS "lastTemplateVersionId",
    ${alias}.last_template_version_label AS "lastTemplateVersionLabel",
    ${alias}.last_template_synced_at AS "lastTemplateSyncedAt",
    ${uplFieldAliases(alias)},
    ${appFieldAliases(alias)}
`.trim()

// ═══════════════════════════════════════════════════════════════════════════════
// Branch queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findBranchById(exec: SqlQueryable, id: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.id = $1
           AND ${activeMetahubRowCondition('b')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findBranchByIdNotDeleted(exec: SqlQueryable, id: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.id = $1
                     AND ${activeMetahubRowCondition('b')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findBranchByCodename(exec: SqlQueryable, metahubId: string, codename: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.metahub_id = $1
                     AND ${branchCodenameTextSql('b.codename')} = $2
                     AND ${activeMetahubRowCondition('b')}
         LIMIT 1`,
        [metahubId, codename]
    )
    return rows[0] ?? null
}

export async function findBranchBySchemaName(exec: SqlQueryable, schemaName: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.schema_name = $1
                     AND ${activeMetahubRowCondition('b')}
         LIMIT 1`,
        [schemaName]
    )
    return rows[0] ?? null
}

export interface BranchListItem extends MetahubBranchRow {
    isDefault: boolean
}

interface BranchListRow extends BranchListItem {
    windowTotal: string
}

export async function listBranches(
    exec: SqlQueryable,
    input: {
        metahubId: string
        limit: number
        offset: number
        sortBy?: 'name' | 'created' | 'updated'
        sortOrder?: 'asc' | 'desc'
        includeDeleted?: boolean
    }
): Promise<{ items: BranchListItem[]; total: number }> {
    const params: unknown[] = [input.metahubId]
    const conditions: string[] = ['b.metahub_id = $1']

    if (!input.includeDeleted) {
        conditions.push(activeMetahubRowCondition('b'))
    }

    params.push(input.limit, input.offset)
    const limitIdx = params.length - 1
    const offsetIdx = params.length

    const orderCol =
        input.sortBy === 'name'
            ? `COALESCE(b.name->>(b.name->>'_primary'), b.name->>'en', '')`
            : input.sortBy === 'created'
            ? 'b._upl_created_at'
            : 'b._upl_updated_at'
    const orderDir = (input.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const rows = await exec.query<BranchListRow>(
        `SELECT
            ${BRANCH_SELECT('b')},
            (b.id = m.default_branch_id) AS "isDefault",
            COUNT(*) OVER() AS "windowTotal"
         FROM metahubs.obj_metahub_branches b
            JOIN metahubs.obj_metahubs m ON m.id = b.metahub_id AND ${activeMetahubRowCondition('m')}
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items: BranchListItem[] = rows.map(({ windowTotal: _wt, ...row }) => row)
    return { items, total }
}

export async function listAllBranches(exec: SqlQueryable, metahubId: string): Promise<MetahubBranchRow[]> {
    return exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.metahub_id = $1
                     AND ${activeMetahubRowCondition('b')}
         ORDER BY b.branch_number ASC`,
        [metahubId]
    )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Branch create / update
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateBranchInput {
    metahubId: string
    sourceBranchId?: string | null
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string>
    branchNumber: number
    schemaName: string
    structureVersion?: string
    lastTemplateVersionId?: string | null
    lastTemplateVersionLabel?: string | null
    lastTemplateSyncedAt?: Date | null
    userId: string
}

export async function createBranch(exec: SqlQueryable, input: CreateBranchInput): Promise<MetahubBranchRow> {
    const rows = await exec.query<MetahubBranchRow>(
        `INSERT INTO metahubs.obj_metahub_branches (
            metahub_id, source_branch_id, name, description,
                codename, branch_number, schema_name,
            structure_version,
            last_template_version_id, last_template_version_label, last_template_synced_at,
            _upl_created_by, _upl_updated_by
         )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
         RETURNING ${BRANCH_SELECT('metahubs.obj_metahub_branches')}`,
        [
            input.metahubId,
            input.sourceBranchId ?? null,
            JSON.stringify(input.name),
            input.description ? JSON.stringify(input.description) : null,
            resolveCodenameJson(input.codename),
            input.branchNumber,
            input.schemaName,
            input.structureVersion ?? CURRENT_STRUCTURE_VERSION_SEMVER,
            input.lastTemplateVersionId ?? null,
            input.lastTemplateVersionLabel ?? null,
            input.lastTemplateSyncedAt ?? null,
            input.userId
        ]
    )
    return rows[0]
}

export interface UpdateBranchInput {
    name?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    codename?: VersionedLocalizedContent<string>
    structureVersion?: string
    lastTemplateVersionId?: string | null
    lastTemplateVersionLabel?: string | null
    lastTemplateSyncedAt?: Date | null
    userId?: string
    expectedVersion?: number
}

export async function updateBranch(exec: SqlQueryable, id: string, input: UpdateBranchInput): Promise<MetahubBranchRow | null> {
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
    const codenameJson = resolveCodenameJson(input.codename)
    if (codenameJson !== null) push('codename', codenameJson)
    if (input.structureVersion !== undefined) push('structure_version', input.structureVersion)
    if (input.lastTemplateVersionId !== undefined) push('last_template_version_id', input.lastTemplateVersionId)
    if (input.lastTemplateVersionLabel !== undefined) push('last_template_version_label', input.lastTemplateVersionLabel)
    if (input.lastTemplateSyncedAt !== undefined) push('last_template_synced_at', input.lastTemplateSyncedAt)
    if (input.userId) push('_upl_updated_by', input.userId)

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = _upl_version + 1')

    if (setClauses.length === 0) return findBranchById(exec, id)

    const conditions = [`id = $${idx}`]
    params.push(id)
    idx++

    conditions.push(activeMetahubRowCondition())

    if (input.expectedVersion !== undefined) {
        conditions.push(`_upl_version = $${idx}`)
        params.push(input.expectedVersion)
    }

    const rows = await exec.query<MetahubBranchRow>(
        `UPDATE metahubs.obj_metahub_branches
         SET ${setClauses.join(', ')}
         WHERE ${conditions.join(' AND ')}
         RETURNING ${BRANCH_SELECT('metahubs.obj_metahub_branches')}`,
        params
    )
    return rows[0] ?? null
}

export async function countBranches(exec: SqlQueryable, metahubId: string): Promise<number> {
    const rows = await exec.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM metahubs.obj_metahub_branches
                 WHERE metahub_id = $1
                     AND ${activeMetahubRowCondition()}`,
        [metahubId]
    )
    return parseInt(rows[0]?.count ?? '0', 10)
}

export async function findBranchByIdAndMetahub(exec: SqlQueryable, id: string, metahubId: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
                 WHERE b.id = $1 AND b.metahub_id = $2
                     AND ${activeMetahubRowCondition('b')}
         LIMIT 1`,
        [id, metahubId]
    )
    return rows[0] ?? null
}

export async function findBranchesByMetahub(exec: SqlQueryable, metahubId: string): Promise<MetahubBranchRow[]> {
    return exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
         WHERE b.metahub_id = $1
           AND ${activeMetahubRowCondition('b')}
         ORDER BY b.branch_number ASC`,
        [metahubId]
    )
}

export async function findBranchForUpdate(exec: SqlQueryable, id: string, metahubId: string): Promise<MetahubBranchRow | null> {
    const rows = await exec.query<MetahubBranchRow>(
        `SELECT ${BRANCH_SELECT('b')}
         FROM metahubs.obj_metahub_branches b
                 WHERE b.id = $1 AND b.metahub_id = $2
                     AND ${activeMetahubRowCondition('b')}
         FOR UPDATE
         LIMIT 1`,
        [id, metahubId]
    )
    return rows[0] ?? null
}

export async function deleteBranchById(exec: SqlQueryable, id: string, metahubId: string, userId?: string | null): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE metahubs.obj_metahub_branches
         SET _upl_deleted = true,
             _upl_deleted_at = NOW(),
             _upl_deleted_by = $3,
             _app_deleted = true,
             _app_deleted_at = NOW(),
             _app_deleted_by = $3,
             _upl_updated_at = NOW(),
             _upl_version = _upl_version + 1
         WHERE id = $1 AND metahub_id = $2
           AND _upl_deleted = false
           AND _app_deleted = false
         RETURNING id`,
        [id, metahubId, userId ?? null]
    )
    return rows.length > 0
}

export async function getMaxBranchNumber(exec: SqlQueryable, metahubId: string): Promise<number> {
    const rows = await exec.query<{ max: string | null }>(
        `SELECT COALESCE(MAX(branch_number), 0)::text AS max
         FROM metahubs.obj_metahub_branches
         WHERE metahub_id = $1`,
        [metahubId]
    )
    return parseInt(rows[0]?.max ?? '0', 10)
}

export async function countMembersOnBranch(
    exec: SqlQueryable,
    metahubId: string,
    branchId: string,
    excludeUserId?: string
): Promise<number> {
    if (excludeUserId) {
        const rows = await exec.query<{ count: string }>(
            `SELECT COUNT(*)::text AS count
             FROM metahubs.rel_metahub_users
                         WHERE metahub_id = $1 AND active_branch_id = $2 AND user_id <> $3
                             AND ${activeMetahubRowCondition()}`,
            [metahubId, branchId, excludeUserId]
        )
        return parseInt(rows[0]?.count ?? '0', 10)
    }
    const rows = await exec.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM metahubs.rel_metahub_users
                 WHERE metahub_id = $1 AND active_branch_id = $2
                     AND ${activeMetahubRowCondition()}`,
        [metahubId, branchId]
    )
    return parseInt(rows[0]?.count ?? '0', 10)
}

export async function clearMemberActiveBranch(exec: SqlQueryable, metahubId: string, userId: string, branchId: string): Promise<void> {
    await exec.query(
        `UPDATE metahubs.rel_metahub_users
         SET active_branch_id = NULL, _upl_updated_at = NOW()
         WHERE metahub_id = $1 AND user_id = $2 AND active_branch_id = $3
           AND ${activeMetahubRowCondition()}`,
        [metahubId, userId, branchId]
    )
}
