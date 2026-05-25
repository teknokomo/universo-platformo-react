import apiClient from './apiClient'

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Admin setting entity from API
 */
export interface AdminSettingItem {
    id: string
    category: string
    key: string
    value: Record<string, unknown>
    createdAt: string
    updatedAt: string
}

/**
 * API response wrapper
 */
interface ApiResponse<T> {
    success: boolean
    data: T
    error?: string
}

/**
 * Settings list response data
 */
interface SettingsListData {
    items: AdminSettingItem[]
    total: number
}

type SettingValue = string | number | boolean | null | Record<string, unknown> | unknown[]

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * List all settings, optionally filtered by category
 */
export async function listSettings(category?: string): Promise<SettingsListData> {
    const params = category ? { category } : {}
    const response = await apiClient.get<ApiResponse<SettingsListData>>('/admin/settings', { params })
    return response.data.data
}

/**
 * List settings for a specific category
 */
export async function listSettingsByCategory(category: string): Promise<SettingsListData> {
    const response = await apiClient.get<ApiResponse<SettingsListData>>(`/admin/settings/${category}`)
    return response.data.data
}

/**
 * Get a single setting by category and key
 */
export async function getSetting(category: string, key: string): Promise<AdminSettingItem> {
    const response = await apiClient.get<ApiResponse<AdminSettingItem>>(`/admin/settings/${category}/${key}`)
    return response.data.data
}

/**
 * Create or update (upsert) a setting
 */
export async function upsertSetting(category: string, key: string, value: unknown): Promise<AdminSettingItem> {
    const response = await apiClient.put<ApiResponse<AdminSettingItem>>(`/admin/settings/${category}/${key}`, { value })
    return response.data.data
}

/**
 * Atomic batch create/update for category settings
 */
export async function upsertSettingsBatch(category: string, values: Record<string, SettingValue>): Promise<SettingsListData> {
    const response = await apiClient.put<ApiResponse<SettingsListData>>(`/admin/settings/${category}`, { values })
    return response.data.data
}

/**
 * Delete a setting (reset to default)
 */
export async function deleteSetting(category: string, key: string): Promise<void> {
    await apiClient.delete(`/admin/settings/${category}/${key}`)
}
