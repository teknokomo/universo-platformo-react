import type { DbExecutor } from '@universo/utils/database'
import { activeAppRowCondition, softDeleteSetClause } from '@universo/utils'
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
    _upl_created_at: Date
    _upl_updated_at: Date
}

export interface ProfileUpdateRowInput {
    nickname?: string
    first_name?: string
    last_name?: string
    settings?: UserSettingsData
    onboarding_completed?: boolean
    terms_accepted?: boolean
    terms_accepted_at?: Date | null
    privacy_accepted?: boolean
    privacy_accepted_at?: Date | null
    terms_version?: string | null
    privacy_version?: string | null
}

const PROFILE_RETURNING_COLUMNS =
    'id, user_id, nickname, first_name, last_name, settings, onboarding_completed, terms_accepted, terms_accepted_at, privacy_accepted, privacy_accepted_at, terms_version, privacy_version, _upl_created_at, _upl_updated_at'

const PROFILE_UPDATE_COLUMN_MAP: Record<keyof ProfileUpdateRowInput, string> = {
    nickname: 'nickname',
    first_name: 'first_name',
    last_name: 'last_name',
    settings: 'settings',
    onboarding_completed: 'onboarding_completed',
    terms_accepted: 'terms_accepted',
    terms_accepted_at: 'terms_accepted_at',
    privacy_accepted: 'privacy_accepted',
    privacy_accepted_at: 'privacy_accepted_at',
    terms_version: 'terms_version',
    privacy_version: 'privacy_version'
}

function isProfileUpdateColumnKey(value: string): value is keyof ProfileUpdateRowInput {
    return value in PROFILE_UPDATE_COLUMN_MAP
}

export async function findProfileByUserId(exec: DbExecutor, userId: string): Promise<ProfileRow | null> {
    const rows = await exec.query<ProfileRow>(
        `SELECT * FROM profiles.obj_profiles WHERE user_id = $1 AND ${activeAppRowCondition()} LIMIT 1`,
        [userId]
    )
    return rows[0] ?? null
}

export async function createProfile(
    exec: DbExecutor,
    data: { user_id: string; nickname: string; first_name?: string; last_name?: string; settings?: UserSettingsData }
): Promise<ProfileRow> {
    const rows = await exec.query<ProfileRow>(
        `INSERT INTO profiles.obj_profiles (id, user_id, nickname, first_name, last_name, settings)
         VALUES (public.uuid_generate_v7(), $1, $2, $3, $4, $5::jsonb)
         RETURNING ${PROFILE_RETURNING_COLUMNS}`,
        [data.user_id, data.nickname, data.first_name ?? null, data.last_name ?? null, JSON.stringify(data.settings ?? {})]
    )
    return rows[0]
}

export async function updateProfileByUserId(exec: DbExecutor, userId: string, data: ProfileUpdateRowInput): Promise<ProfileRow | null> {
    const sets: string[] = []
    const params: unknown[] = []
    let idx = 1

    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || !isProfileUpdateColumnKey(key)) {
            continue
        }

        sets.push(`${PROFILE_UPDATE_COLUMN_MAP[key]} = $${idx++}`)
        params.push(key === 'settings' ? JSON.stringify(value) : value)
    }

    if (sets.length === 0) return null

    sets.push(`_upl_updated_at = NOW()`)
    params.push(userId)

    const rows = await exec.query<ProfileRow>(
        `UPDATE profiles.obj_profiles SET ${sets.join(
            ', '
        )} WHERE user_id = $${idx} AND ${activeAppRowCondition()} RETURNING ${PROFILE_RETURNING_COLUMNS}`,
        params
    )
    return rows[0] ?? null
}

export async function isNicknameAvailable(exec: DbExecutor, nickname: string, excludeUserId?: string): Promise<boolean> {
    const params: unknown[] = [nickname]
    let sql = `SELECT 1 FROM profiles.obj_profiles WHERE nickname = $1 AND ${activeAppRowCondition()}`
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
        `SELECT 1 AS n FROM profiles.obj_profiles WHERE user_id = $1 AND ${activeAppRowCondition()} LIMIT 1`,
        [userId]
    )
    return rows.length > 0
}

export async function findAllProfiles(exec: DbExecutor): Promise<ProfileRow[]> {
    return exec.query<ProfileRow>(`SELECT * FROM profiles.obj_profiles WHERE ${activeAppRowCondition()} ORDER BY _upl_created_at DESC`)
}

export async function deleteProfileByUserId(exec: DbExecutor, userId: string, deletedBy?: string): Promise<boolean> {
    const rows = await exec.query<{ id: string }>(
        `UPDATE profiles.obj_profiles
         SET ${softDeleteSetClause('$2')}
         WHERE user_id = $1 AND ${activeAppRowCondition()}
         RETURNING id`,
        [userId, deletedBy ?? null]
    )
    return rows.length > 0
}
