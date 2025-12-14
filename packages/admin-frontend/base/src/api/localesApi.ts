import type { VersionedLocalizedContent } from '@universo/types'
import apiClient from './apiClient'

// ═══════════════════════════════════════════════════════════════
// LOCALE TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Locale entity from API
 */
export interface LocaleItem {
    id: string
    code: string
    name: VersionedLocalizedContent<string>
    nativeName: string | null
    isEnabledContent: boolean
    isEnabledUi: boolean
    isDefaultContent: boolean
    isDefaultUi: boolean
    isSystem: boolean
    sortOrder: number
    createdAt: string
    updatedAt: string
}

/**
 * Create locale payload
 */
export interface CreateLocalePayload {
    code: string
    name: VersionedLocalizedContent<string>
    nativeName?: string
    isEnabledContent?: boolean
    isEnabledUi?: boolean
    isDefaultContent?: boolean
    isDefaultUi?: boolean
    sortOrder?: number
}

/**
 * Update locale payload
 */
export interface UpdateLocalePayload {
    name?: VersionedLocalizedContent<string>
    nativeName?: string | null
    isEnabledContent?: boolean
    isEnabledUi?: boolean
    isDefaultContent?: boolean
    isDefaultUi?: boolean
    sortOrder?: number
}

/**
 * List locales params
 */
export interface LocalesListParams {
    includeDisabled?: boolean
    sortBy?: 'code' | 'sort_order' | 'created_at'
    sortOrder?: 'asc' | 'desc'
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
 * Locales list response data
 */
interface LocalesListData {
    items: LocaleItem[]
    total: number
}

// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * List all locales
 */
export async function listLocales(params?: LocalesListParams): Promise<LocalesListData> {
    const response = await apiClient.get<ApiResponse<LocalesListData>>('/admin/locales', { params })
    return response.data.data
}

/**
 * Get a single locale by ID
 */
export async function getLocale(id: string): Promise<LocaleItem> {
    const response = await apiClient.get<ApiResponse<LocaleItem>>(`/admin/locales/${id}`)
    return response.data.data
}

/**
 * Create a new locale
 */
export async function createLocale(data: CreateLocalePayload): Promise<LocaleItem> {
    const response = await apiClient.post<ApiResponse<LocaleItem>>('/admin/locales', data)
    return response.data.data
}

/**
 * Update an existing locale
 */
export async function updateLocale(id: string, data: UpdateLocalePayload): Promise<LocaleItem> {
    const response = await apiClient.patch<ApiResponse<LocaleItem>>(`/admin/locales/${id}`, data)
    return response.data.data
}

/**
 * Delete a locale
 */
export async function deleteLocale(id: string): Promise<void> {
    await apiClient.delete(`/admin/locales/${id}`)
}
