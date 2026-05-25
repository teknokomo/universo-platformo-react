export interface GlobalMigrationObjectConfig {
    enabled: boolean
}

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }

    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
}

export const getGlobalMigrationObjectConfig = (): GlobalMigrationObjectConfig => ({
    enabled: parseEnvBoolean(typeof process !== 'undefined' ? process.env.UPL_GLOBAL_MIGRATION_OBJECT_ENABLED : undefined, false)
})

export const isGlobalMigrationObjectEnabled = (): boolean => getGlobalMigrationObjectConfig().enabled
