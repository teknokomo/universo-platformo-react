import { apiClient } from '../../shared'
import type { ThemeAppearance, ThemeAppearanceDraft } from '@universo-react/types'

/**
 * Theme-preset and layout-appearance API (metahub scope).
 * Backed by the dedicated theme-presets routes; appearance mutations update the
 * layout config through the dedicated PATCH/reset endpoints instead of the
 * generic layout update so the server can re-resolve tokens.
 */

export interface ThemePresetSummary {
    id: string
    codename: string
    source: 'file' | 'metahub'
    version: number
    name: Record<string, string>
    description?: Record<string, string> | null
    archived: boolean
    usageCount: number | null
}

export interface ThemePresetListResult {
    file: ThemePresetSummary[]
    presets: ThemePresetSummary[]
}

export interface ThemePresetRecordDto extends ThemePresetSummary {
    tokens: unknown
}

export interface LayoutAppearanceMutationResult {
    layoutId: string
    version: number
    appearance: ThemeAppearance | null
}

export interface ApplyLayoutAppearanceInput {
    appearance: ThemeAppearanceDraft
    expectedVersion: number
}

export const listThemePresets = async (metahubId: string): Promise<ThemePresetListResult> => {
    const response = await apiClient.get<ThemePresetListResult>(`/metahub/${metahubId}/theme-presets`)
    return response.data
}

export interface CreateThemePresetInput {
    codename: string
    name: Record<string, string>
    description?: Record<string, string>
    tokens: unknown
}

export const createThemePreset = async (metahubId: string, data: CreateThemePresetInput): Promise<ThemePresetRecordDto> => {
    const response = await apiClient.post<ThemePresetRecordDto>(`/metahub/${metahubId}/theme-presets`, data)
    return response.data
}

export interface CopyThemePresetInput {
    presetId?: string
    filePresetId?: string
    codename?: string
}

export const copyThemePreset = async (metahubId: string, presetId: string, data: CopyThemePresetInput): Promise<ThemePresetRecordDto> => {
    const response = await apiClient.post<ThemePresetRecordDto>(`/metahub/${metahubId}/theme-presets/${presetId}/copy`, data)
    return response.data
}

export const deleteThemePreset = async (metahubId: string, presetId: string, expectedVersion: number): Promise<ThemePresetRecordDto> => {
    const response = await apiClient.delete<ThemePresetRecordDto>(`/metahub/${metahubId}/theme-presets/${presetId}`, {
        data: { expectedVersion }
    })
    return response.data
}

/** Download the preset file envelope as `<codename>.theme.json`. */
export const exportThemePreset = async (metahubId: string, presetId: string): Promise<void> => {
    const response = await apiClient.get(`/metahub/${metahubId}/theme-presets/${presetId}/export`, { responseType: 'blob' })
    const blob = new Blob([response.data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    const disposition = response.headers['content-disposition'] ?? ''
    const filenameMatch = disposition.match(/filename\*?="?(?:UTF-8'')?([^";]+)"?/)
    anchor.download = filenameMatch?.[1] ? decodeURIComponent(filenameMatch[1]) : 'theme-preset.json'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}

export const applyLayoutAppearance = async (
    metahubId: string,
    layoutId: string,
    data: ApplyLayoutAppearanceInput
): Promise<LayoutAppearanceMutationResult> => {
    const response = await apiClient.patch<LayoutAppearanceMutationResult>(`/metahub/${metahubId}/layout/${layoutId}/appearance`, data)
    return response.data
}

export const resetLayoutAppearance = async (
    metahubId: string,
    layoutId: string,
    expectedVersion: number
): Promise<LayoutAppearanceMutationResult> => {
    const response = await apiClient.post<LayoutAppearanceMutationResult>(`/metahub/${metahubId}/layout/${layoutId}/appearance/reset`, {
        expectedVersion
    })
    return response.data
}

export const applyLatestLayoutAppearance = async (
    metahubId: string,
    layoutId: string,
    expectedVersion: number
): Promise<LayoutAppearanceMutationResult> => {
    const response = await apiClient.post<LayoutAppearanceMutationResult>(
        `/metahub/${metahubId}/layout/${layoutId}/appearance/apply-latest`,
        { expectedVersion }
    )
    return response.data
}
