import type { DbExecutor } from '@universo/utils'
import { activeAppRowCondition } from '@universo/utils'
import { escapeLikeWildcards } from '@universo/utils/database'

// ─── Types ───────────────────────────────────────────────────────────────

export interface InstanceRow {
    id: string
    codename: string
    name: unknown
    description: unknown
    url: string | null
    status: string
    is_local: boolean
    _upl_created_at: string
    _upl_updated_at: string
}

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

const instanceCodenameTextSql = (columnRef: string): string =>
    normalizeSql(
        `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
    )

const buildCodenameVlc = (codename: string, ruCodename?: string) => {
    const now = new Date().toISOString()

    const locales: Record<string, { content: string; version: number; isActive: boolean; createdAt: string; updatedAt: string }> = {
        en: {
            content: codename,
            version: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    }

    if (ruCodename) {
        locales.ru = {
            content: ruCodename,
            version: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now
        }
    }

    return {
        _schema: '1',
        _primary: 'en',
        locales
    }
}

const INSTANCE_RETURNING_COLUMNS = `${instanceCodenameTextSql(
    'codename'
)} AS codename, id, name, description, url, status, is_local, _upl_created_at, _upl_updated_at`

const INSTANCE_SELECT_COLUMNS = `
    id,
    ${instanceCodenameTextSql('codename')} AS codename,
    name,
    description,
    url,
    status,
    is_local,
    _upl_created_at,
    _upl_updated_at
`

// ─── Queries ─────────────────────────────────────────────────────────────

const SORT_WHITELIST: Record<string, string> = {
    codename: instanceCodenameTextSql('codename'),
    created: '_upl_created_at',
    status: 'status'
}

export async function listInstances(
    exec: DbExecutor,
    options: { limit: number; offset: number; search?: string; sortBy?: string; sortOrder?: string }
): Promise<{ items: InstanceRow[]; total: number }> {
    const { limit, offset, search, sortBy = 'created', sortOrder = 'desc' } = options
    const conditions: string[] = []
    const params: unknown[] = []

    conditions.push(activeAppRowCondition())

    if (search) {
        params.push(`%${escapeLikeWildcards(search.toLowerCase())}%`)
        conditions.push(`(LOWER(${instanceCodenameTextSql('codename')}) LIKE $${params.length} OR name::text ILIKE $${params.length})`)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const sortCol = SORT_WHITELIST[sortBy] ?? '_upl_created_at'
    const dir = sortOrder === 'asc' ? 'ASC' : 'DESC'

    const countRows = await exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.cfg_instances ${where}`, params)
    const total = parseInt(countRows[0]?.count ?? '0', 10)

    if (total === 0) return { items: [], total: 0 }

    const items = await exec.query<InstanceRow>(
        `SELECT ${INSTANCE_SELECT_COLUMNS} FROM admin.cfg_instances ${where} ORDER BY ${sortCol} ${dir}, id ASC LIMIT $${
            params.length + 1
        } OFFSET $${params.length + 2}`,
        [...params, limit, offset]
    )

    return { items, total }
}

export async function findInstanceById(exec: DbExecutor, id: string): Promise<InstanceRow | null> {
    const rows = await exec.query<InstanceRow>(
        `SELECT ${INSTANCE_SELECT_COLUMNS} FROM admin.cfg_instances WHERE id = $1 AND ${activeAppRowCondition()} LIMIT 1`,
        [id]
    )
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
        params.push(JSON.stringify(buildCodenameVlc(data.codename)))
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

    sets.push(`_upl_updated_at = NOW()`)
    params.push(id)

    const rows = await exec.query<InstanceRow>(
        `UPDATE admin.cfg_instances SET ${sets.join(
            ', '
        )} WHERE id = $${idx} AND ${activeAppRowCondition()} RETURNING ${INSTANCE_RETURNING_COLUMNS}`,
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
        exec.query<{ count: string }>(
            `SELECT COUNT(DISTINCT ur.user_id) AS count
             FROM admin.rel_user_roles ur
             INNER JOIN admin.cat_roles r ON r.id = ur.role_id AND ${activeAppRowCondition('r')}
             WHERE ${activeAppRowCondition('ur')} AND r.is_superuser = true`
        ),
        exec.query<{ count: string }>(`SELECT COUNT(*) AS count FROM admin.cat_roles WHERE ${activeAppRowCondition()}`)
    ])

    return {
        totalUsers: parseInt(usersResult[0]?.count ?? '0', 10),
        globalAccessUsers: parseInt(globalUsersResult[0]?.count ?? '0', 10),
        totalRoles: parseInt(rolesResult[0]?.count ?? '0', 10)
    }
}
