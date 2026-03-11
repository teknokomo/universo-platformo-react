import type { DbExecutor } from '@universo/utils/database'
import type { UserSettingsData } from '../types'

export interface ProfileRow {
    id: string
    user_id: string
    nickname: string
    first_name: string | null
    last_name: string | null
    settings: UserSettingsData
    onboarding_completed: boolean
    terms_accepted: boolean
    terms_accepted_at: Date | null
    privacy_accepted: boolean
    privacy_accepted_at: Date | null
    terms_version: string | null
    privacy_version: string | null
    created_at: Date
    updated_at: Date
}

export async function findProfileByUserId(exec: DbExecutor, userId: string): Promise<ProfileRow | null> {
    const rows = await exec.query<ProfileRow>(
        'SELECT * FROM public.profiles WHERE user_id = $1 LIMIT 1',
        [userId]
    )
    return rows[0] ?? null
}

export async function createProfile(
    exec: DbExecutor,
    data: { user_id: string; nickname: string; first_name?: string; last_name?: string; settings?: UserSettingsData }
): Promise<ProfileRow> {
    const rows = await exec.query<ProfileRow>(
        `INSERT INTO public.profiles (id, user_id, nickname, first_name, last_name, settings)
         VALUES (public.uuid_generate_v7(), $1, $2, $3, $4, $5::jsonb)
         RETURNING *`,
        [data.user_id, data.nickname, data.first_name ?? null, data.last_name ?? null, JSON.stringify(data.settings ?? {})]
    )
    return rows[0]
}

export async function updateProfileByUserId(
    exec: DbExecutor,
    userId: string,
    data: Record<string, unknown>
): Promise<ProfileRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            sets.push(`${key} = $${idx++}`)
            params.push(key === 'settings' ? JSON.stringify(value) : value)
        }
    }
    if (sets.length === 0) return null
    sets.push(`updated_at = NOW()`)
    params.push(userId)
    const rows = await exec.query<ProfileRow>(
        `UPDATE public.profiles SET ${sets.join(', ')} WHERE user_id = $${idx} RETURNING *`,
        params
    )
    return rows[0] ?? null
}

export async function isNicknameAvailable(exec: DbExecutor, nickname: string, excludeUserId?: string): Promise<boolean> {
    const params: unknown[] = [nickname]
    let sql = 'SELECT 1 FROM public.profiles WHERE nickname = $1'
    if (excludeUserId) {
        sql += ' AND user_id != $2'
        params.push(excludeUserId)
    }
    sql += ' LIMIT 1'
    const rows = await exec.query(sql, params)
    return rows.length === 0
}

export async function profileExistsByUserId(exec: DbExecutor, userId: string): Promise<boolean> {
    const rows = await exec.query<{ n: string }>(
        'SELECT 1 AS n FROM public.profiles WHERE user_id = $1 LIMIT 1',
        [userId]
    )
    return rows.length > 0
}

export async function findAllProfiles(exec: DbExecutor): Promise<ProfileRow[]> {
    return exec.query<ProfileRow>('SELECT * FROM public.profiles ORDER BY created_at DESC')
}

export async function deleteProfileByUserId(exec: DbExecutor, userId: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        'DELETE FROM public.profiles WHERE user_id = $1 RETURNING id',
        [userId]
    )
    return rows.length > 0
}
