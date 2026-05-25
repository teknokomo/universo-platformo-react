import { softDeleteSetClause } from '@universo/utils'
import type { DbExecutor } from '@universo/utils/database'

export type ObjectKind = 'goals' | 'topics' | 'features'

export interface OnboardingObjectRow {
    id: string
    codename: string
    name: Record<string, unknown>
    description: Record<string, unknown>
    sort_order: number
    is_active: boolean
}

export interface UserSelectionRow {
    id: string
    user_id: string
    object_kind: ObjectKind
    item_id: string
}

const OBJECT_TABLE_MAP: Record<ObjectKind, string> = {
    goals: 'start.obj_goals',
    topics: 'start.obj_topics',
    features: 'start.obj_features'
}

const ACTIVE_PREDICATE = '_upl_deleted = false AND _app_deleted = false'

const OBJECT_COLUMNS = 'id, codename, name, description, sort_order, is_active'
const SELECTION_COLUMNS = 'id, user_id, object_kind, item_id'

export async function fetchObjectItems(exec: DbExecutor, kind: ObjectKind): Promise<OnboardingObjectRow[]> {
    const table = OBJECT_TABLE_MAP[kind]
    return exec.query<OnboardingObjectRow>(
        `SELECT ${OBJECT_COLUMNS}
         FROM ${table}
         WHERE ${ACTIVE_PREDICATE} AND is_active = true
         ORDER BY sort_order ASC, _upl_created_at ASC`,
        []
    )
}

export async function fetchUserSelections(exec: DbExecutor, userId: string, kind: ObjectKind): Promise<UserSelectionRow[]> {
    return exec.query<UserSelectionRow>(
        `SELECT ${SELECTION_COLUMNS}
         FROM start.rel_user_selections
         WHERE user_id = $1 AND object_kind = $2 AND ${ACTIVE_PREDICATE}`,
        [userId, kind]
    )
}

export async function fetchAllUserSelections(exec: DbExecutor, userId: string): Promise<UserSelectionRow[]> {
    return exec.query<UserSelectionRow>(
        `SELECT ${SELECTION_COLUMNS}
         FROM start.rel_user_selections
         WHERE user_id = $1 AND ${ACTIVE_PREDICATE}`,
        [userId]
    )
}

export async function validateItemExists(exec: DbExecutor, kind: ObjectKind, itemId: string): Promise<boolean> {
    const table = OBJECT_TABLE_MAP[kind]
    const rows = await exec.query<{ id: string }>(
        `SELECT id FROM ${table} WHERE id = $1 AND ${ACTIVE_PREDICATE} AND is_active = true LIMIT 1`,
        [itemId]
    )
    return rows.length > 0
}

export async function syncUserSelections(
    exec: DbExecutor,
    userId: string,
    kind: ObjectKind,
    itemIds: string[]
): Promise<{ added: number; removed: number }> {
    const uniqueItemIds = [...new Set(itemIds)]
    const existing = await fetchUserSelections(exec, userId, kind)
    const existingItemIds = new Set(existing.map((r) => r.item_id))
    const desiredItemIds = new Set(uniqueItemIds)

    const toAdd = uniqueItemIds.filter((id) => !existingItemIds.has(id))
    const toRemove = existing.filter((r) => !desiredItemIds.has(r.item_id))

    if (toRemove.length > 0) {
        const ids = toRemove.map((r) => r.id)
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ')
        await exec.query<{ id: string }>(
            `UPDATE start.rel_user_selections
             SET ${softDeleteSetClause(`$${ids.length + 1}`)}, _upl_version = _upl_version + 1
             WHERE id IN (${placeholders}) AND ${ACTIVE_PREDICATE}
             RETURNING id`,
            [...ids, userId]
        )
    }

    for (const itemId of toAdd) {
        await exec.query<UserSelectionRow>(
            `INSERT INTO start.rel_user_selections (user_id, object_kind, item_id, _upl_created_by, _upl_updated_by)
             VALUES ($1, $2, $3, $1, $1)
             ON CONFLICT (user_id, object_kind, item_id) WHERE _upl_deleted = false AND _app_deleted = false
             DO NOTHING
             RETURNING ${SELECTION_COLUMNS}`,
            [userId, kind, itemId]
        )
    }

    return { added: toAdd.length, removed: toRemove.length }
}
