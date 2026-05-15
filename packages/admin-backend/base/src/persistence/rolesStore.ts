import type { CodenameVLC } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import { activeAppRowCondition, softDeleteSetClause } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface RoleRow {
    id: string
    codename: CodenameVLC
    description: unknown
    name: unknown
    color: string
    is_superuser: boolean
    is_system: boolean
    _upl_created_at: string
    _upl_updated_at: string
}

export interface RolePermissionRow {
    id: string
    role_id: string
    subject: string
    action: string
    conditions: unknown
    fields: string[]
    _upl_created_at: string
}

export interface UserRoleRow {
    id: string
    user_id: string
    role_id: string
    granted_by: string | null
    comment: string | null
    _upl_created_at: string
}

export interface RoleWithPermissions extends RoleRow {
    permissions: RolePermissionRow[]
}

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const roleCodenameTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const ROLE_RETURNING_COLUMNS = `codename, id, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at`

const ROLE_SELECT_COLUMNS = `
    r.id,
    r.codename,
    r.description,
    r.name,
    r.color,
    r.is_superuser,
    r.is_system,
    r._upl_created_at,
    r._upl_updated_at
`

const ROLE_PERMISSION_RETURNING_COLUMNS = 'id, role_id, subject, action, conditions, fields, _upl_created_at'

// ─── Roles ───────────────────────────────────────────────────────────────

const ROLE_SORT_WHITELIST: Record<string, string> = {
    codename: roleCodenameTextSql('r.codename'),
    created: 'r._upl_created_at',
    has_global_access: 'r.has_global_access'
}

export async function listRoles(
    exec: DbExecutor,
    options: {
        limit: number
        offset: number
        search?: string
        sortBy?: string
        sortOrder?: string
        includeSystem?: boolean
    }
): Promise<{ items: RoleWithPermissions[]; total: number }> {
    const { limit, offset, search, sortBy = 'codename', sortOrder = 'asc', includeSystem = true } = options
    const conditions: string[] = []
    const params: unknown[] = []

    conditions.push(activeAppRowCondition('r'))

    if (!includeSystem) {
        conditions.push('r.is_system = false')
    }

    if (search) {
        params.push(`%${search}%`)
        conditions.push(
            `(LOWER(${roleCodenameTextSql('r.codename')}) LIKE $${params.length} OR r.name::text ILIKE $${
                params.length
            } OR r.description::text ILIKE $${params.length})`
        )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortCol = ROLE_SORT_WHITELIST[sortBy] ?? roleCodenameTextSql('r.codename')
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Count
    const countRows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.obj_roles r ${where}`, params)
    const total = parseInt(countRows[0]?.count ?? '0', 10)

    if (total === 0) return { items: [], total: 0 }

    // Paginated roles
    const rolesParams = [...params, limit, offset]
    const roles = await exec.query<RoleRow>(
        `SELECT ${ROLE_SELECT_COLUMNS} FROM admin.obj_roles r ${where} ORDER BY ${sortCol} ${dir}, r.id ASC LIMIT $${
            params.length + 1
        } OFFSET $${params.length + 2}`,
        rolesParams
    )

    if (roles.length === 0) return { items: [], total }

    const roleIds = roles.map((r) => r.id)
    const permissions = await exec.query<RolePermissionRow>(
        `SELECT ${ROLE_PERMISSION_RETURNING_COLUMNS} FROM admin.rel_role_permissions WHERE role_id = ANY($1::uuid[]) AND ${activeAppRowCondition()} ORDER BY _upl_created_at`,
        [roleIds]
    )

    const permMap = new Map<string, RolePermissionRow[]>()
    for (const p of permissions) {
        const arr = permMap.get(p.role_id) ?? []
        arr.push(p)
        permMap.set(p.role_id, arr)
    }

    const items: RoleWithPermissions[] = roles.map((r) => ({ ...r, permissions: permMap.get(r.id) ?? [] }))
    return { items, total }
}

export async function listAssignableRoles(exec: DbExecutor): Promise<RoleRow[]> {
    return exec.query<RoleRow>(
        `SELECT id, ${roleCodenameTextSql(
            'codename'
        )} AS codename, name, color FROM admin.obj_roles WHERE ${activeAppRowCondition()} ORDER BY ${roleCodenameTextSql(
            'codename'
        )} ASC, id ASC`
    )
}

export async function findRoleById(exec: DbExecutor, id: string): Promise<RoleWithPermissions | null> {
    const roles = await exec.query<RoleRow>(
        `SELECT ${ROLE_SELECT_COLUMNS} FROM admin.obj_roles r WHERE r.id = $1 AND ${activeAppRowCondition('r')} LIMIT 1`,
        [id]
    )
    if (roles.length === 0) return null

    const permissions = await exec.query<RolePermissionRow>(
        `SELECT ${ROLE_PERMISSION_RETURNING_COLUMNS} FROM admin.rel_role_permissions WHERE role_id = $1 AND ${activeAppRowCondition()} ORDER BY _upl_created_at`,
        [id]
    )
    return { ...roles[0], permissions }
}

export async function findRoleByCodename(exec: DbExecutor, codename: string): Promise<RoleRow | null> {
    const rows = await exec.query<RoleRow>(
        `SELECT ${ROLE_SELECT_COLUMNS}
         FROM admin.obj_roles r
         WHERE ${roleCodenameTextSql('r.codename')} = $1 AND ${activeAppRowCondition('r')}
         LIMIT 1`,
        [codename]
    )
    return rows[0] ?? null
}

export async function createRole(
    exec: DbExecutor,
    data: {
        codename: CodenameVLC
        name: unknown
        description?: unknown
        color?: string
        is_superuser?: boolean
        created_by?: string | null
    }
): Promise<RoleRow> {
    const rows = await exec.query<RoleRow>(
        `INSERT INTO admin.obj_roles (codename, name, description, color, is_superuser, is_system, _upl_created_by)
         VALUES ($1, $2, $3, $4, $5, false, $6)
         RETURNING ${ROLE_RETURNING_COLUMNS}`,
        [
            JSON.stringify(data.codename),
            JSON.stringify(data.name),
            JSON.stringify(data.description ?? null),
            data.color ?? null,
            data.is_superuser ?? false,
            data.created_by ?? null
        ]
    )
    return rows[0]
}

export async function updateRole(
    exec: DbExecutor,
    id: string,
    data: { codename?: CodenameVLC; name?: unknown; description?: unknown; color?: string; is_superuser?: boolean }
): Promise<RoleRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (data.codename !== undefined) {
        sets.push(`codename = $${idx++}`)
        params.push(JSON.stringify(data.codename))
    }
    if (data.name !== undefined) {
        sets.push(`name = $${idx++}`)
        params.push(JSON.stringify(data.name))
    }
    if (data.description !== undefined) {
        sets.push(`description = $${idx++}`)
        params.push(JSON.stringify(data.description))
    }
    if (data.color !== undefined) {
        sets.push(`color = $${idx++}`)
        params.push(data.color)
    }
    if (data.is_superuser !== undefined) {
        sets.push(`is_superuser = $${idx++}`)
        params.push(data.is_superuser)
    }

    if (sets.length === 0) return null

    sets.push(`_upl_updated_at = NOW()`)
    params.push(id)

    const rows = await exec.query<RoleRow>(
        `UPDATE admin.obj_roles SET ${sets.join(
            ', '
        )} WHERE id = $${idx} AND ${activeAppRowCondition()} RETURNING ${ROLE_RETURNING_COLUMNS}`,
        params
    )
    return rows[0] ?? null
}

export async function deleteRole(exec: DbExecutor, id: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE admin.obj_roles
         SET ${softDeleteSetClause('$2')}
         WHERE id = $1 AND ${activeAppRowCondition()}
         RETURNING id`,
        [id, deletedBy ?? null]
    )
    return rows.length > 0
}

// ─── Role Permissions ────────────────────────────────────────────────────

export async function replacePermissions(
    exec: DbExecutor,
    roleId: string,
    permissions: Array<{ subject: string; action: string; conditions?: unknown; fields?: string[] }>,
    deletedBy?: string
): Promise<RolePermissionRow[]> {
    await exec.query(
        `UPDATE admin.rel_role_permissions
         SET ${softDeleteSetClause('$2')}
         WHERE role_id = $1 AND ${activeAppRowCondition()}`,
        [roleId, deletedBy ?? null]
    )

    if (permissions.length === 0) return []

    const values: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const perm of permissions) {
        values.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4})`)
        params.push(roleId, perm.subject, perm.action, JSON.stringify(perm.conditions ?? {}), perm.fields ?? [])
        idx += 5
    }

    return exec.query<RolePermissionRow>(
        `INSERT INTO admin.rel_role_permissions (role_id, subject, action, conditions, fields)
         VALUES ${values.join(', ')}
         RETURNING ${ROLE_PERMISSION_RETURNING_COLUMNS}`,
        params
    )
}

// ─── User Roles ──────────────────────────────────────────────────────────

export async function countUsersByRoleId(exec: DbExecutor, roleId: string): Promise<number> {
    const rows = await exec.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin.rel_user_roles WHERE role_id = $1 AND ${activeAppRowCondition()}`,
        [roleId]
    )
    return parseInt(rows[0]?.count ?? '0', 10)
}

export async function listRoleUsers(
    exec: DbExecutor,
    roleId: string,
    options: { limit: number; offset: number; search?: string; sortBy?: string; sortOrder?: string }
): Promise<{ items: Array<UserRoleRow & { email: string | null; full_name: string | null; status: string }>; total: number }> {
    const { limit, offset, search, sortBy = 'assigned_at', sortOrder = 'desc' } = options
    const conditions: string[] = ['ur.role_id = $1', activeAppRowCondition('ur')]
    const params: unknown[] = [roleId]

    if (search) {
        params.push(`%${search.toLowerCase()}%`)
        conditions.push(`EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id AND LOWER(u.email) LIKE $${params.length})`)
    }

    const where = conditions.join(' AND ')
    const sortCol = sortBy === 'email' ? '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)' : 'ur._upl_created_at'
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countRows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.rel_user_roles ur WHERE ${where}`, params)
    const total = parseInt(countRows[0]?.count ?? '0', 10)

    if (total === 0) return { items: [], total: 0 }

    const items = await exec.query<UserRoleRow & { email: string | null; full_name: string | null; status: string }>(
        `SELECT
            ur.*,
            (SELECT u.email FROM auth.users u WHERE u.id = ur.user_id) AS email,
            (SELECT u.raw_user_meta_data->>'full_name' FROM auth.users u WHERE u.id = ur.user_id) AS full_name,
            CASE
              WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id) THEN 'active'
              ELSE 'inactive'
            END AS status
         FROM admin.rel_user_roles ur
         WHERE ${where}
         ORDER BY ${sortCol} ${dir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    )

    return { items, total }
}
