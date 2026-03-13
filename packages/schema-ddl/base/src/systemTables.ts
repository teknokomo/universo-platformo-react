import type { SystemTableCapabilityOptions } from '@universo/migrations-core'

export interface ResolvedSystemTableCapabilityOptions {
    includeAttributes: boolean
    includeValues: boolean
    includeLayouts: boolean
    includeWidgets: boolean
}

const SYSTEM_TABLE_ORDER = [
    '_app_migrations',
    '_app_settings',
    '_app_objects',
    '_app_attributes',
    '_app_values',
    '_app_layouts',
    '_app_widgets'
] as const

export type SystemTableName = (typeof SYSTEM_TABLE_ORDER)[number]

export const normalizeSystemTableCapabilities = (options?: SystemTableCapabilityOptions): ResolvedSystemTableCapabilityOptions => {
    const normalized: ResolvedSystemTableCapabilityOptions = {
        includeAttributes: options?.includeAttributes ?? true,
        includeValues: options?.includeValues ?? true,
        includeLayouts: options?.includeLayouts ?? true,
        includeWidgets: options?.includeWidgets ?? true
    }

    if (normalized.includeWidgets && !normalized.includeLayouts) {
        throw new Error('System table capabilities cannot enable _app_widgets without _app_layouts')
    }

    return normalized
}

export const resolveSystemTableNames = (options?: SystemTableCapabilityOptions): SystemTableName[] => {
    const capabilities = normalizeSystemTableCapabilities(options)

    return SYSTEM_TABLE_ORDER.filter((tableName): tableName is SystemTableName => {
        if (tableName === '_app_attributes') {
            return capabilities.includeAttributes
        }

        if (tableName === '_app_values') {
            return capabilities.includeValues
        }

        if (tableName === '_app_layouts') {
            return capabilities.includeLayouts
        }

        if (tableName === '_app_widgets') {
            return capabilities.includeWidgets
        }

        return true
    })
}
