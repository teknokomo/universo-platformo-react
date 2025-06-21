// Profile System Types

export interface CreateProfileDto {
    user_id: string
    nickname?: string
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
    nickname?: string
    first_name?: string
    last_name?: string
    created_at: Date
    updated_at: Date
}

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
}
