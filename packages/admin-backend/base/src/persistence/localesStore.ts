import type { DbExecutor } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface LocaleRow {
    id: string
    code: string
    name: unknown
    native_name: string | null
    is_enabled_content: boolean
    is_enabled_ui: boolean
    is_default_content: boolean
    is_default_ui: boolean
    is_system: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

/**
 * Transform raw DB row to camelCase API response
 */
export function transformLocaleRow(row: LocaleRow) {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        nativeName: row.native_name,
        isEnabledContent: row.is_enabled_content,
        isEnabledUi: row.is_enabled_ui,
        isDefaultContent: row.is_default_content,
        isDefaultUi: row.is_default_ui,
        isSystem: row.is_system,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

// ─── Queries ─────────────────────────────────────────────────────────────

const SORT_WHITELIST: Record<string, string> = {
    code: 'code',
    sort_order: 'sort_order',
    created_at: 'created_at'
}

export async function listLocales(
    exec: DbExecutor,
    options: {
        includeDisabled?: boolean
        sortBy?: string
        sortOrder?: string
        limit?: number
        offset?: number
    }
): Promise<{ items: LocaleRow[]; total: number }> {
    const { includeDisabled = false, sortBy = 'sort_order', sortOrder = 'asc', limit, offset } = options
    const conditions: string[] = []
    const params: unknown[] = []

    if (!includeDisabled) {
        conditions.push('(is_enabled_content = true OR is_enabled_ui = true)')
    }

    conditions.push('_upl_deleted = false')

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sortCol = SORT_WHITELIST[sortBy] ?? 'sort_order'
    const dir = sortOrder === 'desc' ? 'DESC' : 'ASC'

    let sql = `SELECT *, COUNT(*) OVER() AS _total FROM admin.locales ${where} ORDER BY ${sortCol} ${dir}`

    if (limit !== undefined) {
        params.push(limit)
        sql += ` LIMIT $${params.length}`
    }
    if (offset !== undefined) {
        params.push(offset)
        sql += ` OFFSET $${params.length}`
    }

    const rows = await exec.query<LocaleRow & { _total: string }>(sql, params)
    const total = parseInt(rows[0]?._total ?? '0', 10)
    return { items: rows.map(({ _total, ...rest }) => rest as unknown as LocaleRow), total }
}

export async function findLocaleById(exec: DbExecutor, id: string): Promise<LocaleRow | null> {
    const rows = await exec.query<LocaleRow>(`SELECT * FROM admin.locales WHERE id = $1 AND _upl_deleted = false LIMIT 1`, [id])
    return rows[0] ?? null
}

export async function findLocaleByCode(exec: DbExecutor, code: string): Promise<LocaleRow | null> {
    const rows = await exec.query<LocaleRow>(`SELECT * FROM admin.locales WHERE code = $1 AND _upl_deleted = false LIMIT 1`, [code])
    return rows[0] ?? null
}

export async function createLocale(
    exec: DbExecutor,
    data: {
        code: string
        name: unknown
        nativeName?: string | null
        isEnabledContent: boolean
        isEnabledUi: boolean
        isDefaultContent: boolean
        isDefaultUi: boolean
        sortOrder: number
    }
): Promise<LocaleRow> {
    return exec.transaction(async (tx) => {
        if (data.isDefaultContent) {
            await tx.query(`UPDATE admin.locales SET is_default_content = false WHERE is_default_content = true AND _upl_deleted = false`)
        }
        if (data.isDefaultUi) {
            await tx.query(`UPDATE admin.locales SET is_default_ui = false WHERE is_default_ui = true AND _upl_deleted = false`)
        }

        const rows = await tx.query<LocaleRow>(
            `INSERT INTO admin.locales (code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
             RETURNING *`,
            [
                data.code,
                JSON.stringify(data.name),
                data.nativeName ?? null,
                data.isEnabledContent,
                data.isEnabledUi,
                data.isDefaultContent,
                data.isDefaultUi,
                data.sortOrder
            ]
        )
        return rows[0]
    })
}

export async function updateLocale(
    exec: DbExecutor,
    id: string,
    data: {
        name?: unknown
        nativeName?: string | null
        isEnabledContent?: boolean
        isEnabledUi?: boolean
        isDefaultContent?: boolean
        isDefaultUi?: boolean
        sortOrder?: number
    }
): Promise<LocaleRow> {
    return exec.transaction(async (tx) => {
        // Business rule: cannot disable the last enabled content locale
        if (data.isEnabledContent === false) {
            const countRows = await tx.query<{ count: string }>(
                `SELECT COUNT(*) AS count FROM admin.locales WHERE is_enabled_content = true AND _upl_deleted = false`
            )
            if (parseInt(countRows[0]?.count ?? '0', 10) <= 1) {
                throw new Error('LAST_ENABLED_LOCALE')
            }
        }

        // Clear existing defaults atomically
        if (data.isDefaultContent === true) {
            await tx.query(`UPDATE admin.locales SET is_default_content = false WHERE is_default_content = true AND id != $1 AND _upl_deleted = false`, [id])
        }
        if (data.isDefaultUi === true) {
            await tx.query(`UPDATE admin.locales SET is_default_ui = false WHERE is_default_ui = true AND id != $1 AND _upl_deleted = false`, [id])
        }

        const sets: string[] = []
        const params: unknown[] = []
        let idx = 1

        if (data.name !== undefined) {
            sets.push(`name = $${idx++}`)
            params.push(JSON.stringify(data.name))
        }
        if (data.nativeName !== undefined) {
            sets.push(`native_name = $${idx++}`)
            params.push(data.nativeName)
        }
        if (data.isEnabledContent !== undefined) {
            sets.push(`is_enabled_content = $${idx++}`)
            params.push(data.isEnabledContent)
        }
        if (data.isEnabledUi !== undefined) {
            sets.push(`is_enabled_ui = $${idx++}`)
            params.push(data.isEnabledUi)
        }
        if (data.isDefaultContent !== undefined) {
            sets.push(`is_default_content = $${idx++}`)
            params.push(data.isDefaultContent)
        }
        if (data.isDefaultUi !== undefined) {
            sets.push(`is_default_ui = $${idx++}`)
            params.push(data.isDefaultUi)
        }
        if (data.sortOrder !== undefined) {
            sets.push(`sort_order = $${idx++}`)
            params.push(data.sortOrder)
        }

        if (sets.length === 0) {
            const rows = await tx.query<LocaleRow>(`SELECT * FROM admin.locales WHERE id = $1 AND _upl_deleted = false`, [id])
            return rows[0]
        }

        sets.push(`updated_at = NOW()`)
        params.push(id)

        const rows = await tx.query<LocaleRow>(
            `UPDATE admin.locales SET ${sets.join(', ')} WHERE id = $${idx} AND _upl_deleted = false RETURNING *`,
            params
        )
        return rows[0]
    })
}

export async function deleteLocale(exec: DbExecutor, id: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE admin.locales
         SET _upl_deleted = true, _upl_deleted_at = NOW(), _upl_deleted_by = $2
         WHERE id = $1 AND _upl_deleted = false
         RETURNING id`,
        [id, deletedBy ?? null]
    )
    return rows.length > 0
}

// ─── Public (no auth) queries ────────────────────────────────────────────

export async function listEnabledContentLocales(exec: DbExecutor): Promise<Array<{ code: string; native_name: string | null; is_default_content: boolean }>> {
    return exec.query(
        `SELECT code, native_name, is_default_content FROM admin.locales WHERE is_enabled_content = true AND _upl_deleted = false ORDER BY sort_order ASC`
    )
}

export async function listEnabledUiLocales(exec: DbExecutor): Promise<Array<{ code: string; native_name: string | null; is_default_ui: boolean }>> {
    return exec.query(
        `SELECT code, native_name, is_default_ui FROM admin.locales WHERE is_enabled_ui = true AND _upl_deleted = false ORDER BY sort_order ASC`
    )
}
