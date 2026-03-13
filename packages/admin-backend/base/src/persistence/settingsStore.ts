import type { DbExecutor } from '@universo/utils'
import { activeAppRowCondition, softDeleteSetClause } from '@universo/utils'

// ─── Types ───────────────────────────────────────────────────────────────

export interface AdminSettingRow {
    id: string
    category: string
    key: string
    value: unknown
    _upl_created_at: string
    _upl_updated_at: string
}

const SETTING_RETURNING_COLUMNS = 'id, category, key, value, _upl_created_at, _upl_updated_at'

/**
 * Transform raw DB row to camelCase API response
 */
export function transformSettingRow(row: AdminSettingRow) {
    return {
        id: row.id,
        category: row.category,
        key: row.key,
        value: row.value,
        createdAt: row._upl_created_at,
        updatedAt: row._upl_updated_at
    }
}

// ─── Queries ─────────────────────────────────────────────────────────────

export async function listSettings(exec: DbExecutor, category?: string): Promise<AdminSettingRow[]> {
    if (category) {
        return exec.query<AdminSettingRow>(
            `SELECT * FROM admin.cfg_settings WHERE category = $1 AND ${activeAppRowCondition()} ORDER BY key ASC`,
            [category]
        )
    }
    return exec.query<AdminSettingRow>(`SELECT * FROM admin.cfg_settings WHERE ${activeAppRowCondition()} ORDER BY category ASC, key ASC`)
}

export async function findSetting(exec: DbExecutor, category: string, key: string): Promise<AdminSettingRow | null> {
    const rows = await exec.query<AdminSettingRow>(
        `SELECT * FROM admin.cfg_settings WHERE category = $1 AND key = $2 AND ${activeAppRowCondition()} LIMIT 1`,
        [category, key]
    )
    return rows[0] ?? null
}

export async function upsertSetting(exec: DbExecutor, category: string, key: string, value: unknown): Promise<AdminSettingRow> {
    const wrappedValue = JSON.stringify({ _value: value })
    const rows = await exec.query<AdminSettingRow>(
        `INSERT INTO admin.cfg_settings (category, key, value)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (category, key) WHERE ${activeAppRowCondition()} DO UPDATE SET value = $3::jsonb, _upl_updated_at = NOW()
         RETURNING ${SETTING_RETURNING_COLUMNS}`,
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
            `SELECT * FROM admin.cfg_settings WHERE category = $1 AND key = ANY($2::text[]) AND ${activeAppRowCondition()} ORDER BY key ASC`,
            [category, keys]
        )
    })
}

export async function deleteSetting(exec: DbExecutor, category: string, key: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE admin.cfg_settings
         SET ${softDeleteSetClause('$3')}
         WHERE category = $1 AND key = $2 AND ${activeAppRowCondition()}
         RETURNING id`,
        [category, key, deletedBy ?? null]
    )
    return rows.length > 0
}
