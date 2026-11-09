import type { AppearancePresetOption } from './ThemeAppearancePanel'
import type { ThemePresetManagerItem } from './ThemePresetManagerDialog'

/**
 * Structural shape of the preset summary records consumed by the appearance
 * authoring sections. The metahub `ThemePresetSummary` and the application
 * `ApplicationThemePresetSummary` both satisfy it: they differ only in the
 * `source` union literal, which the mappers receive as their own `source`
 * argument instead of reading it off the record.
 */
export interface ThemePresetSummaryInput {
    id: string
    codename: string
    version: number
    name: Record<string, string>
    description?: Record<string, string> | null
    archived: boolean
    usageCount: number | null
}

/** Codename generator for MVP preset creation/copy (`^[a-z][a-z0-9-]{2,63}$`). */
export const generatePresetCodename = (base: string): string => {
    const sanitized = base
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
    const safeBase = /^[a-z][a-z0-9-]{2,}$/.test(sanitized) ? sanitized : 'preset'
    return `${safeBase}-${Date.now().toString(36)}`
}

/** Maps a scope preset summary to the select option of `ThemeAppearancePanel`. */
export const toPresetOption = <TSource extends 'metahub' | 'application'>(
    preset: ThemePresetSummaryInput,
    source: 'file' | TSource
): AppearancePresetOption => ({
    key: source === 'file' ? `file:${preset.id}` : preset.id,
    label: (typeof preset.name?.en === 'string' && preset.name.en) || preset.codename,
    source,
    version: preset.version,
    archived: preset.archived,
    usageCount: preset.usageCount
})

/** Maps a scope preset summary to a `ThemePresetManagerDialog` card item. */
export const toManagerItem = <TSource extends 'metahub' | 'application'>(
    preset: ThemePresetSummaryInput,
    source: 'file' | TSource
): ThemePresetManagerItem => ({
    ...toPresetOption(preset, source),
    id: preset.id,
    codename: preset.codename,
    description: preset.description ?? undefined
})
