// Profile System Types

export interface CreateProfileDto {
    user_id: string
    nickname: string
    first_name?: string
    last_name?: string
}

export interface UpdateProfileDto {
    nickname?: string
    first_name?: string
    last_name?: string
}

export interface ProfileResponse {
    id: string
    user_id: string
    nickname: string
    first_name: string | null
    last_name: string | null
    created_at: Date
    updated_at: Date
}

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
}

/**
 * User settings stored in profile
 * These settings are persisted on the server and synced across devices
 */
export interface UserSettingsData {
    /** Admin-only settings (superadmin/supermoderator) */
    admin?: {
        /** Show all items in lists (all users' data) vs only own items */
        showAllItems?: boolean
    }
    /** Display preferences (for all users) */
    display?: {
        /** Default view mode for lists */
        defaultViewMode?: 'card' | 'list'
        /** Items per page */
        itemsPerPage?: number
    }
}

export interface UpdateSettingsDto {
    settings: Partial<UserSettingsData>
}
