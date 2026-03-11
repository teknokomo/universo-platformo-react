import type { VersionedLocalizedContent } from '@universo/types'
import type { SqlQueryable, MetahubRow, MetahubUserRow } from './types'
import { uplFieldAliases, mhbFieldAliases } from './types'
import { activeMetahubRowCondition, softDelete } from './metahubsQueryHelpers'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT fragments
// ═══════════════════════════════════════════════════════════════════════════════

const METAHUB_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.name,
    ${alias}.description,
    ${alias}.codename,
    ${alias}.codename_localized AS "codenameLocalized",
    ${alias}.slug,
    ${alias}.default_branch_id AS "defaultBranchId",
    ${alias}.last_branch_number AS "lastBranchNumber",
    ${alias}.is_public AS "isPublic",
    ${alias}.template_id AS "templateId",
    ${alias}.template_version_id AS "templateVersionId",
    ${uplFieldAliases(alias)},
    ${mhbFieldAliases(alias)}
`.trim()

const METAHUB_USER_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.metahub_id AS "metahubId",
    ${alias}.user_id AS "userId",
    ${alias}.active_branch_id AS "activeBranchId",
    ${alias}.role,
    ${alias}.comment,
    ${uplFieldAliases(alias)},
    ${mhbFieldAliases(alias)}
`.trim()

// ═══════════════════════════════════════════════════════════════════════════════
// Metahub queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findMetahubById(exec: SqlQueryable, id: string): Promise<MetahubRow | null> {
    const rows = await exec.query<MetahubRow>(
        `SELECT ${METAHUB_SELECT('m')}
         FROM metahubs.metahubs m
         WHERE m.id = $1
           AND ${activeMetahubRowCondition('m')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findMetahubForUpdate(exec: SqlQueryable, id: string): Promise<MetahubRow | null> {
    const rows = await exec.query<MetahubRow>(
        `SELECT ${METAHUB_SELECT('m')}
         FROM metahubs.metahubs m
         WHERE m.id = $1
           AND ${activeMetahubRowCondition('m')}
         FOR UPDATE
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function updateMetahubFieldsRaw(
    exec: SqlQueryable,
    id: string,
    fields: { defaultBranchId?: string | null; lastBranchNumber?: number }
): Promise<void> {
    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (fields.defaultBranchId !== undefined) {
        setClauses.push(`default_branch_id = $${idx}`)
        params.push(fields.defaultBranchId)
        idx++
    }
    if (fields.lastBranchNumber !== undefined) {
        setClauses.push(`last_branch_number = $${idx}`)
        params.push(fields.lastBranchNumber)
        idx++
    }
    if (setClauses.length === 0) return

    params.push(id)
    await exec.query(
        `UPDATE metahubs.metahubs
         SET ${setClauses.join(', ')}
         WHERE id = $${params.length}
           AND ${activeMetahubRowCondition()}`,
        params
    )
}

export async function findMetahubByIdNotDeleted(exec: SqlQueryable, id: string): Promise<MetahubRow | null> {
    const rows = await exec.query<MetahubRow>(
        `SELECT ${METAHUB_SELECT('m')}
         FROM metahubs.metahubs m
         WHERE m.id = $1
                     AND ${activeMetahubRowCondition('m')}
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findMetahubByCodename(exec: SqlQueryable, codename: string): Promise<MetahubRow | null> {
    const rows = await exec.query<MetahubRow>(
        `SELECT ${METAHUB_SELECT('m')}
         FROM metahubs.metahubs m
         WHERE m.codename = $1
                     AND ${activeMetahubRowCondition('m')}
         LIMIT 1`,
        [codename]
    )
    return rows[0] ?? null
}

export async function findMetahubBySlug(exec: SqlQueryable, slug: string): Promise<Pick<MetahubRow, 'id' | 'slug'> | null> {
    const rows = await exec.query<Pick<MetahubRow, 'id' | 'slug'>>(
        `SELECT id, slug
         FROM metahubs.metahubs
         WHERE slug = $1
                     AND ${activeMetahubRowCondition()}
         LIMIT 1`,
        [slug]
    )
    return rows[0] ?? null
}

export async function findPublicMetahubBySlug(exec: SqlQueryable, slug: string): Promise<MetahubRow | null> {
    const rows = await exec.query<MetahubRow>(
        `SELECT ${METAHUB_SELECT('m')}
         FROM metahubs.metahubs m
         WHERE m.slug = $1
           AND m.is_public = true
                     AND ${activeMetahubRowCondition('m')}
         LIMIT 1`,
        [slug]
    )
    return rows[0] ?? null
}

/**
 * List metahubs with window-based pagination and optional membership filtering.
 */
export interface MetahubListItem extends MetahubRow {
    membersCount: number
    branchesCount: number
    membershipRole: string | null
}

interface MetahubListRow extends MetahubListItem {
    windowTotal: string
}

export async function listMetahubs(
    exec: SqlQueryable,
    input: {
        userId: string
        showAll: boolean
        limit: number
        offset: number
        sortBy: 'name' | 'codename' | 'created' | 'updated'
        sortOrder: 'asc' | 'desc'
        search?: string
        includeDeleted?: boolean
    }
): Promise<{ items: MetahubListItem[]; total: number }> {
    const params: unknown[] = [input.userId, input.showAll]
    const conditions: string[] = ['($2::boolean = true OR membership.user_id IS NOT NULL)']

    if (!input.includeDeleted) {
        conditions.push(activeMetahubRowCondition('m'))
    }

    if (input.search) {
        params.push(`%${input.search}%`)
        conditions.push(
            `(m.name::text ILIKE $${params.length} OR COALESCE(m.description::text, '') ILIKE $${params.length} OR COALESCE(m.slug, '') ILIKE $${params.length} OR COALESCE(m.codename, '') ILIKE $${params.length})`
        )
    }

    params.push(input.limit, input.offset)
    const limitIdx = params.length - 1
    const offsetIdx = params.length

    const orderCol =
        input.sortBy === 'name'
            ? `COALESCE(m.name->>(m.name->>'_primary'), m.name->>'en', '')`
            : input.sortBy === 'codename'
            ? 'm.codename'
            : input.sortBy === 'created'
            ? 'm._upl_created_at'
            : 'm._upl_updated_at'
    const orderDir = input.sortOrder === 'asc' ? 'ASC' : 'DESC'

    const rows = await exec.query<MetahubListRow>(
        `SELECT
            ${METAHUB_SELECT('m')},
            COALESCE(member_counts.count, 0)::int AS "membersCount",
            COALESCE(branch_counts.count, 0)::int AS "branchesCount",
            membership.role AS "membershipRole",
            COUNT(*) OVER() AS "windowTotal"
         FROM metahubs.metahubs m
         LEFT JOIN metahubs.metahubs_users membership
             ON membership.metahub_id = m.id
            AND membership.user_id = $1
            AND ${activeMetahubRowCondition('membership')}
         LEFT JOIN (
             SELECT metahub_id, COUNT(*)::int AS count
             FROM metahubs.metahubs_users
             WHERE ${activeMetahubRowCondition()}
             GROUP BY metahub_id
         ) member_counts ON member_counts.metahub_id = m.id
         LEFT JOIN (
             SELECT metahub_id, COUNT(*)::int AS count
             FROM metahubs.metahubs_branches
             WHERE ${activeMetahubRowCondition()}
             GROUP BY metahub_id
         ) branch_counts ON branch_counts.metahub_id = m.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items: MetahubListItem[] = rows.map(({ windowTotal: _wt, ...row }) => row)
    return { items, total }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metahub create / update
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateMetahubInput {
    id?: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    codename: string
    codenameLocalized?: VersionedLocalizedContent<string> | null
    slug?: string | null
    isPublic?: boolean
    lastBranchNumber?: number
    templateId?: string | null
    templateVersionId?: string | null
    userId: string
}

export async function createMetahub(exec: SqlQueryable, input: CreateMetahubInput): Promise<MetahubRow> {
    const cols = [
        'name',
        'description',
        'codename',
        'codename_localized',
        'slug',
        'is_public',
        'template_id',
        'template_version_id',
        '_upl_created_by',
        '_upl_updated_by'
    ]
    const vals: unknown[] = [
        JSON.stringify(input.name),
        input.description ? JSON.stringify(input.description) : null,
        input.codename,
        input.codenameLocalized ? JSON.stringify(input.codenameLocalized) : null,
        input.slug ?? null,
        input.isPublic ?? false,
        input.templateId ?? null,
        input.templateVersionId ?? null,
        input.userId,
        input.userId
    ]

    if (input.id) {
        cols.unshift('id')
        vals.unshift(input.id)
    }
    if (input.lastBranchNumber !== undefined) {
        cols.push('last_branch_number')
        vals.push(input.lastBranchNumber)
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ')
    const rows = await exec.query<MetahubRow>(
        `INSERT INTO metahubs.metahubs (${cols.join(', ')})
         VALUES (${placeholders})
         RETURNING ${METAHUB_SELECT('metahubs.metahubs')}`,
        vals
    )
    return rows[0]
}

export interface UpdateMetahubInput {
    name?: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    codename?: string
    codenameLocalized?: VersionedLocalizedContent<string> | null
    slug?: string | null
    isPublic?: boolean
    defaultBranchId?: string | null
    lastBranchNumber?: number
    templateId?: string | null
    templateVersionId?: string | null
    userId?: string
    expectedVersion?: number
}

export async function updateMetahub(exec: SqlQueryable, id: string, input: UpdateMetahubInput): Promise<MetahubRow | null> {
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
    if (input.codename !== undefined) push('codename', input.codename)
    if (input.codenameLocalized !== undefined)
        push('codename_localized', input.codenameLocalized ? JSON.stringify(input.codenameLocalized) : null)
    if (input.slug !== undefined) push('slug', input.slug)
    if (input.isPublic !== undefined) push('is_public', input.isPublic)
    if (input.defaultBranchId !== undefined) push('default_branch_id', input.defaultBranchId)
    if (input.lastBranchNumber !== undefined) push('last_branch_number', input.lastBranchNumber)
    if (input.templateId !== undefined) push('template_id', input.templateId)
    if (input.templateVersionId !== undefined) push('template_version_id', input.templateVersionId)
    if (input.userId) push('_upl_updated_by', input.userId)

    // Always bump updated_at
    setClauses.push('_upl_updated_at = NOW()')
    // Bump version
    setClauses.push('_upl_version = _upl_version + 1')

    if (setClauses.length === 0) return findMetahubById(exec, id)

    // Optimistic lock condition
    const conditions = [`id = $${idx}`]
    params.push(id)
    idx++

    conditions.push(activeMetahubRowCondition())

    if (input.expectedVersion !== undefined) {
        conditions.push(`_upl_version = $${idx}`)
        params.push(input.expectedVersion)
    }

    const rows = await exec.query<MetahubRow>(
        `UPDATE metahubs.metahubs
         SET ${setClauses.join(', ')}
         WHERE ${conditions.join(' AND ')}
         RETURNING ${METAHUB_SELECT('metahubs.metahubs')}`,
        params
    )
    return rows[0] ?? null
}

/**
 * Increment last_branch_number atomically and return the new value.
 */
export async function incrementBranchNumber(exec: SqlQueryable, metahubId: string): Promise<number> {
    const rows = await exec.query<{ last_branch_number: number }>(
        `UPDATE metahubs.metahubs
         SET last_branch_number = last_branch_number + 1,
             _upl_updated_at = NOW()
         WHERE id = $1
           AND ${activeMetahubRowCondition()}
         RETURNING last_branch_number`,
        [metahubId]
    )
    return rows[0].last_branch_number
}

// ═══════════════════════════════════════════════════════════════════════════════
// MetahubUser queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findMetahubMembership(exec: SqlQueryable, metahubId: string, userId: string): Promise<MetahubUserRow | null> {
    const rows = await exec.query<MetahubUserRow>(
        `SELECT ${METAHUB_USER_SELECT('mu')}
         FROM metahubs.metahubs_users mu
         JOIN metahubs.metahubs m ON m.id = mu.metahub_id
         WHERE mu.metahub_id = $1 AND mu.user_id = $2
           AND ${activeMetahubRowCondition('mu')}
           AND ${activeMetahubRowCondition('m')}
         LIMIT 1`,
        [metahubId, userId]
    )
    return rows[0] ?? null
}

export async function findMetahubMemberById(exec: SqlQueryable, memberId: string): Promise<MetahubUserRow | null> {
    const rows = await exec.query<MetahubUserRow>(
        `SELECT ${METAHUB_USER_SELECT('mu')}
         FROM metahubs.metahubs_users mu
         WHERE mu.id = $1
           AND ${activeMetahubRowCondition('mu')}
         LIMIT 1`,
        [memberId]
    )
    return rows[0] ?? null
}

export interface MetahubMemberListItem extends MetahubUserRow {
    email: string | null
    nickname: string | null
}

interface MetahubMemberListRow extends MetahubMemberListItem {
    windowTotal: string
}

export async function listMetahubMembers(
    exec: SqlQueryable,
    input: {
        metahubId: string
        limit: number
        offset: number
        sortBy?: 'role' | 'email' | 'created'
        sortOrder?: 'asc' | 'desc'
        search?: string
    }
): Promise<{ items: MetahubMemberListItem[]; total: number }> {
    const params: unknown[] = [input.metahubId]
    const conditions: string[] = ['mu.metahub_id = $1', activeMetahubRowCondition('mu')]

    if (input.search) {
        params.push(`%${input.search.toLowerCase()}%`)
        conditions.push(`(LOWER(COALESCE(u.email, '')) LIKE $${params.length} OR LOWER(COALESCE(p.nickname, '')) LIKE $${params.length})`)
    }

    params.push(input.limit, input.offset)
    const limitIdx = params.length - 1
    const offsetIdx = params.length

    const orderCol = input.sortBy === 'email' ? 'u.email' : input.sortBy === 'role' ? 'mu.role' : 'mu._upl_created_at'
    const orderDir = (input.sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

    const rows = await exec.query<MetahubMemberListRow>(
        `SELECT
            ${METAHUB_USER_SELECT('mu')},
            u.email,
            p.nickname,
            COUNT(*) OVER() AS "windowTotal"
         FROM metahubs.metahubs_users mu
         LEFT JOIN auth.users u ON u.id = mu.user_id
         LEFT JOIN public.profiles p ON p.user_id = mu.user_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items: MetahubMemberListItem[] = rows.map(({ windowTotal: _wt, ...row }) => row)
    return { items, total }
}

export interface AddMetahubMemberInput {
    metahubId: string
    userId: string
    role: string
    activeBranchId?: string | null
    comment?: VersionedLocalizedContent<string> | null
    createdBy: string
}

export async function addMetahubMember(exec: SqlQueryable, input: AddMetahubMemberInput): Promise<MetahubUserRow> {
    const rows = await exec.query<MetahubUserRow>(
        `INSERT INTO metahubs.metahubs_users (
            metahub_id, user_id, role, active_branch_id, comment,
            _upl_created_by, _upl_updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING ${METAHUB_USER_SELECT('metahubs.metahubs_users')}`,
        [
            input.metahubId,
            input.userId,
            input.role,
            input.activeBranchId ?? null,
            input.comment ? JSON.stringify(input.comment) : null,
            input.createdBy
        ]
    )
    return rows[0]
}

export async function updateMetahubMember(
    exec: SqlQueryable,
    memberId: string,
    input: {
        role?: string
        activeBranchId?: string | null
        comment?: VersionedLocalizedContent<string> | null
        updatedBy?: string
    }
): Promise<MetahubUserRow | null> {
    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (input.role !== undefined) {
        setClauses.push(`role = $${idx}`)
        params.push(input.role)
        idx++
    }
    if (input.activeBranchId !== undefined) {
        setClauses.push(`active_branch_id = $${idx}`)
        params.push(input.activeBranchId)
        idx++
    }
    if (input.comment !== undefined) {
        setClauses.push(`comment = $${idx}`)
        params.push(input.comment ? JSON.stringify(input.comment) : null)
        idx++
    }
    if (input.updatedBy) {
        setClauses.push(`_upl_updated_by = $${idx}`)
        params.push(input.updatedBy)
        idx++
    }

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = _upl_version + 1')

    params.push(memberId)

    const rows = await exec.query<MetahubUserRow>(
        `UPDATE metahubs.metahubs_users
         SET ${setClauses.join(', ')}
         WHERE id = $${params.length}
           AND ${activeMetahubRowCondition()}
         RETURNING ${METAHUB_USER_SELECT('metahubs.metahubs_users')}`,
        params
    )
    return rows[0] ?? null
}

export async function removeMetahubMember(exec: SqlQueryable, memberId: string, userId?: string | null): Promise<boolean> {
    return softDelete(exec, 'metahubs', 'metahubs_users', memberId, userId)
}

export async function countMetahubMembers(exec: SqlQueryable, metahubId: string): Promise<number> {
    const rows = await exec.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM metahubs.metahubs_users
         WHERE metahub_id = $1
           AND ${activeMetahubRowCondition()}`,
        [metahubId]
    )
    return parseInt(rows[0]?.count ?? '0', 10)
}
