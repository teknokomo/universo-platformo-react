import type { DbExecutor } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface AdminSettingRow {
    id: string
    category: string
    key: string
    value: unknown
    created_at: string
    updated_at: string
}

/**
 * Transform raw DB row to camelCase API response
 */
export function transformSettingRow(row: AdminSettingRow) {
    return {
        id: row.id,
        category: row.category,
        key: row.key,
        value: row.value,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

// ─── Queries ─────────────────────────────────────────────────────────────

export async function listSettings(exec: DbExecutor, category?: string): Promise<AdminSettingRow[]> {
    if (category) {
        return exec.query<AdminSettingRow>(
            `SELECT * FROM admin.settings WHERE category = $1 AND _upl_deleted = false ORDER BY key ASC`,
            [category]
        )
    }
    return exec.query<AdminSettingRow>(`SELECT * FROM admin.settings WHERE _upl_deleted = false ORDER BY category ASC, key ASC`)
}

export async function findSetting(exec: DbExecutor, category: string, key: string): Promise<AdminSettingRow | null> {
    const rows = await exec.query<AdminSettingRow>(
        `SELECT * FROM admin.settings WHERE category = $1 AND key = $2 AND _upl_deleted = false LIMIT 1`,
        [category, key]
    )
    return rows[0] ?? null
}

export async function upsertSetting(exec: DbExecutor, category: string, key: string, value: unknown): Promise<AdminSettingRow> {
    const wrappedValue = JSON.stringify({ _value: value })
    const rows = await exec.query<AdminSettingRow>(
        `INSERT INTO admin.settings (category, key, value)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (category, key) WHERE _upl_deleted = false DO UPDATE SET value = $3::jsonb, updated_at = NOW()
         RETURNING *`,
        [category, key, wrappedValue]
    )
    return rows[0]
}

export async function bulkUpsertSettings(
    exec: DbExecutor,
    category: string,
    entries: Array<[string, unknown]>
): Promise<AdminSettingRow[]> {
    return exec.transaction(async (tx) => {
        for (const [key, value] of entries) {
            await upsertSetting(tx, category, key, value)
        }
        const keys = entries.map(([k]) => k)
        return tx.query<AdminSettingRow>(
            `SELECT * FROM admin.settings WHERE category = $1 AND key = ANY($2::text[]) AND _upl_deleted = false ORDER BY key ASC`,
            [category, keys]
        )
    })
}

export async function deleteSetting(exec: DbExecutor, category: string, key: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE admin.settings
         SET _upl_deleted = true, _upl_deleted_at = NOW(), _upl_deleted_by = $3
         WHERE category = $1 AND key = $2 AND _upl_deleted = false
         RETURNING id`,
        [category, key, deletedBy ?? null]
    )
    return rows.length > 0
}
