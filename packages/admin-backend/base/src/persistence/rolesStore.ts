import type { DbExecutor } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface RoleRow {
    id: string
    codename: string
    description: unknown
    name: unknown
    color: string
    is_superuser: boolean
    is_system: boolean
    created_at: string
    updated_at: string
}

export interface RolePermissionRow {
    id: string
    role_id: string
    subject: string
    action: string
    conditions: unknown
    fields: string[]
    created_at: string
}

export interface UserRoleRow {
    id: string
    user_id: string
    role_id: string
    granted_by: string | null
    comment: string | null
    created_at: string
}

export interface RoleWithPermissions extends RoleRow {
    permissions: RolePermissionRow[]
}

// ─── Roles ───────────────────────────────────────────────────────────────

const ROLE_SORT_WHITELIST: Record<string, string> = {
    codename: 'r.codename',
    created: 'r.created_at',
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

    conditions.push('r._upl_deleted = false')

    if (!includeSystem) {
        conditions.push('r.is_system = false')
    }

    if (search) {
        params.push(`%${search}%`)
        conditions.push(
            `(LOWER(r.codename) LIKE $${params.length} OR r.name::text ILIKE $${params.length} OR r.description::text ILIKE $${params.length})`
        )
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortCol = ROLE_SORT_WHITELIST[sortBy] ?? 'r.codename'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Count
    const countRows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.roles r ${where}`, params)
    const total = parseInt(countRows[0]?.count ?? '0', 10)

    if (total === 0) return { items: [], total: 0 }

    // Paginated roles
    const rolesParams = [...params, limit, offset]
    const roles = await exec.query<RoleRow>(
        `SELECT r.* FROM admin.roles r ${where} ORDER BY ${sortCol} ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        rolesParams
    )

    if (roles.length === 0) return { items: [], total }

    const roleIds = roles.map((r) => r.id)
    const permissions = await exec.query<RolePermissionRow>(
        `SELECT * FROM admin.role_permissions WHERE role_id = ANY($1::uuid[]) AND _upl_deleted = false ORDER BY created_at`,
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
        `SELECT id, codename, name, color FROM admin.roles WHERE _upl_deleted = false ORDER BY codename ASC`
    )
}

export async function findRoleById(exec: DbExecutor, id: string): Promise<RoleWithPermissions | null> {
    const roles = await exec.query<RoleRow>(`SELECT * FROM admin.roles WHERE id = $1 AND _upl_deleted = false LIMIT 1`, [id])
    if (roles.length === 0) return null

    const permissions = await exec.query<RolePermissionRow>(
        `SELECT * FROM admin.role_permissions WHERE role_id = $1 AND _upl_deleted = false ORDER BY created_at`,
        [id]
    )
    return { ...roles[0], permissions }
}

export async function findRoleByCodename(exec: DbExecutor, codename: string): Promise<RoleRow | null> {
    const rows = await exec.query<RoleRow>(`SELECT * FROM admin.roles WHERE codename = $1 AND _upl_deleted = false LIMIT 1`, [codename])
    return rows[0] ?? null
}

export async function createRole(
    exec: DbExecutor,
    data: { codename: string; name: unknown; description?: unknown; color?: string; is_superuser?: boolean }
): Promise<RoleRow> {
    const rows = await exec.query<RoleRow>(
        `INSERT INTO admin.roles (codename, name, description, color, is_superuser, is_system)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING *`,
        [data.codename, JSON.stringify(data.name), JSON.stringify(data.description ?? null), data.color ?? null, data.is_superuser ?? false]
    )
    return rows[0]
}

export async function updateRole(
    exec: DbExecutor,
    id: string,
    data: { codename?: string; name?: unknown; description?: unknown; color?: string; is_superuser?: boolean }
): Promise<RoleRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    if (data.codename !== undefined) {
        sets.push(`codename = $${idx++}`)
        params.push(data.codename)
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

    sets.push(`updated_at = NOW()`)
    params.push(id)

    const rows = await exec.query<RoleRow>(
        `UPDATE admin.roles SET ${sets.join(', ')} WHERE id = $${idx} AND _upl_deleted = false RETURNING *`,
        params
    )
    return rows[0] ?? null
}

export async function deleteRole(exec: DbExecutor, id: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE admin.roles
         SET _upl_deleted = true, _upl_deleted_at = NOW(), _upl_deleted_by = $2
         WHERE id = $1 AND _upl_deleted = false
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
        `UPDATE admin.role_permissions
         SET _upl_deleted = true, _upl_deleted_at = NOW(), _upl_deleted_by = $2
         WHERE role_id = $1 AND _upl_deleted = false`,
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
        `INSERT INTO admin.role_permissions (role_id, subject, action, conditions, fields)
         VALUES ${values.join(', ')}
         RETURNING *`,
        params
    )
}

// ─── User Roles ──────────────────────────────────────────────────────────

export async function countUsersByRoleId(exec: DbExecutor, roleId: string): Promise<number> {
    const rows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.user_roles WHERE role_id = $1`, [roleId])
    return parseInt(rows[0]?.count ?? '0', 10)
}

export async function listRoleUsers(
    exec: DbExecutor,
    roleId: string,
    options: { limit: number; offset: number; search?: string; sortBy?: string; sortOrder?: string }
): Promise<{ items: Array<UserRoleRow & { email: string | null; full_name: string | null; status: string }>; total: number }> {
    const { limit, offset, search, sortBy = 'assigned_at', sortOrder = 'desc' } = options
    const conditions: string[] = ['ur.role_id = $1']
    const params: unknown[] = [roleId]

    if (search) {
        params.push(`%${search.toLowerCase()}%`)
        conditions.push(
            `EXISTS (SELECT 1 FROM auth.users u WHERE u.id = ur.user_id AND LOWER(u.email) LIKE $${params.length})`
        )
    }

    const where = conditions.join(' AND ')
    const sortCol =
        sortBy === 'email' ? '(SELECT u.email FROM auth.users u WHERE u.id = ur.user_id)' : 'ur.created_at'
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countRows = await exec.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin.user_roles ur WHERE ${where}`,
        params
    )
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
         FROM admin.user_roles ur
         WHERE ${where}
         ORDER BY ${sortCol} ${dir}
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    )

    return { items, total }
}
