export interface GlobalMigrationCatalogConfig {
    enabled: boolean
}

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }

    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
}

export const getGlobalMigrationCatalogConfig = (): GlobalMigrationCatalogConfig => ({
    enabled: parseEnvBoolean(typeof process !== 'undefined' ? process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED : undefined, false)
})

export const isGlobalMigrationCatalogEnabled = (): boolean => getGlobalMigrationCatalogConfig().enabled
