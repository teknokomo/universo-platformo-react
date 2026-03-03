/**
 * Universo Platformo | Metahubs Settings API Client
 *
 * CRUD operations for metahub settings key-value pairs.
 * Uses the shared authenticated API client.
 */

import { apiClient } from '../../shared'

// ─── Response types ──────────────────────────────────────────────────────────

export interface SettingResponse {
    key: string
    value: Record<string, unknown>
    id: string | null
    version: number
    updatedAt: string | null
    isDefault: boolean
}

export interface SettingsRegistryEntry {
    key: string
    tab: string
    valueType: string
    defaultValue: unknown
    options?: readonly string[]
    sortOrder: number
}

export interface SettingsResponse {
    settings: SettingResponse[]
    registry: SettingsRegistryEntry[]
}

export interface ResetSettingResponse {
    key: string
    value: Record<string, unknown>
    isDefault: true
}

// ─── API methods ─────────────────────────────────────────────────────────────

export const settingsApi = {
    /** Get all settings merged with defaults. */
    getAll: async (metahubId: string): Promise<SettingsResponse> => {
        const { data } = await apiClient.get(`/metahub/${metahubId}/settings`)
        return data
    },

    /** Get single setting (singular path). */
    getByKey: async (metahubId: string, key: string): Promise<SettingResponse> => {
        const { data } = await apiClient.get(`/metahub/${metahubId}/setting/${key}`)
        return data
    },

    /** Bulk update settings (collection path). Returns same format as getAll. */
    update: async (metahubId: string, settings: Array<{ key: string; value: Record<string, unknown> }>): Promise<SettingsResponse> => {
        const { data } = await apiClient.put(`/metahub/${metahubId}/settings`, { settings })
        return data
    },

    /** Reset a setting to default (singular path). Returns the default value. */
    resetToDefault: async (metahubId: string, key: string): Promise<ResetSettingResponse> => {
        const { data } = await apiClient.delete(`/metahub/${metahubId}/setting/${key}`)
        return data
    }
}
