import type { DbExecutor } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface InstanceRow {
    id: string
    codename: string
    name: unknown
    description: unknown
    url: string | null
    status: string
    is_local: boolean
    created_at: string
    updated_at: string
}

// ─── Queries ─────────────────────────────────────────────────────────────

const SORT_WHITELIST: Record<string, string> = {
    codename: 'codename',
    created: 'created_at',
    status: 'status'
}

export async function listInstances(
    exec: DbExecutor,
    options: { limit: number; offset: number; search?: string; sortBy?: string; sortOrder?: string }
): Promise<{ items: InstanceRow[]; total: number }> {
    const { limit, offset, search, sortBy = 'created', sortOrder = 'desc' } = options
    const conditions: string[] = []
    const params: unknown[] = []

    if (search) {
        params.push(`%${search.toLowerCase()}%`)
        conditions.push(`(LOWER(codename) LIKE $${params.length} OR name::text ILIKE $${params.length})`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortCol = SORT_WHITELIST[sortBy] ?? 'created_at'
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countRows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.instances ${where}`, params)
    const total = parseInt(countRows[0]?.count ?? '0', 10)

    if (total === 0) return { items: [], total: 0 }

    const items = await exec.query<InstanceRow>(
        `SELECT * FROM admin.instances ${where} ORDER BY ${sortCol} ${dir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    )

    return { items, total }
}

export async function findInstanceById(exec: DbExecutor, id: string): Promise<InstanceRow | null> {
    const rows = await exec.query<InstanceRow>(`SELECT * FROM admin.instances WHERE id = $1 LIMIT 1`, [id])
    return rows[0] ?? null
}

export async function updateInstance(
    exec: DbExecutor,
    id: string,
    data: { codename?: string; name?: unknown; description?: unknown; url?: string | null; status?: string }
): Promise<InstanceRow | null> {
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
    if (data.url !== undefined) {
        sets.push(`url = $${idx++}`)
        params.push(data.url)
    }
    if (data.status !== undefined) {
        sets.push(`status = $${idx++}`)
        params.push(data.status)
    }

    if (sets.length === 0) return null

    sets.push(`updated_at = NOW()`)
    params.push(id)

    const rows = await exec.query<InstanceRow>(
        `UPDATE admin.instances SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    )
    return rows[0] ?? null
}

export async function getInstanceStats(exec: DbExecutor): Promise<{
    totalUsers: number
    globalAccessUsers: number
    totalRoles: number
}> {
    const [usersResult, globalUsersResult, rolesResult] = await Promise.all([
        exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM auth.users`),
        exec.query<{ count: string }>(`SELECT COUNT(DISTINCT user_id) AS count FROM admin.user_roles`),
        exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.roles`)
    ])

    return {
        totalUsers: parseInt(usersResult[0]?.count ?? '0', 10),
        globalAccessUsers: parseInt(globalUsersResult[0]?.count ?? '0', 10),
        totalRoles: parseInt(rolesResult[0]?.count ?? '0', 10)
    }
}
