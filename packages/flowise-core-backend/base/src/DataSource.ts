import 'reflect-metadata'
import path from 'path'
import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { getUserHome } from './utils'
import { entities } from './database/entities'
import { postgresMigrations } from './database/migrations/postgres'

let appDataSource: DataSource

export const init = async (): Promise<void> => {
    const databaseType = process.env.DATABASE_TYPE ?? 'postgres'
    console.log('[DataSource] Initializing', {
        type: databaseType,
        host: process.env.DATABASE_HOST,
        port: process.env.DATABASE_PORT || '5432',
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER ? '***' : undefined,
        ssl: !!getDatabaseSSLFromEnv()
    })
    if (databaseType !== 'postgres') {
        throw new Error(
            `Unsupported database type "${databaseType}". This build supports only PostgreSQL configurations.`
        )
    }

    const flowisePath = path.join(getUserHome(), '.flowise')
    ensureDirectory(flowisePath)

    const configuredDatabasePath = process.env.DATABASE_PATH
    if (configuredDatabasePath) {
        ensureDirectory(configuredDatabasePath)
    }

    console.log('[DataSource] Creating DataSource with entities:', Object.keys(entities).length, 'migrations:', postgresMigrations.length)
    const logPoolError = (err: Error): void => {
        // NOTE: Accessing internal TypeORM driver properties for pool metrics.
        // This is fragile and may break with TypeORM or pg-pool updates.
        // We accept this risk for improved observability during pool errors.
        // The pool metrics interface matches pg-pool internals (totalCount, idleCount, waitingCount).
        const pool = (appDataSource as unknown as { driver?: { master?: { totalCount?: number; idleCount?: number; waitingCount?: number } } })
            ?.driver?.master
        if (pool) {
            console.error('[DataSource] Pool error:', err.message, {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            })
            return
        }
        console.error('[DataSource] Pool error:', err.message)
    }

    appDataSource = new DataSource({
        type: 'postgres',
        host: process.env.DATABASE_HOST,
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: getDatabaseSSLFromEnv(),
        synchronize: false,
        migrationsRun: false,
        entities: Object.values(entities),
        migrations: postgresMigrations,
        logging: ['error', 'warn', 'migration'], // Enable SQL logging for debugging
        // Pool configuration - keep below Supabase Pool Size (15) together with KnexClient (8)
        extra: {
            max: 7,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000
        },
        poolErrorHandler: logPoolError
    })
    console.log('[DataSource] DataSource created successfully (pool max: 7)')
}

export function getDataSource(): DataSource {
    if (appDataSource === undefined) {
        init()
    }
    return appDataSource
}

const getDatabaseSSLFromEnv = () => {
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        return {
            rejectUnauthorized: false,
            ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64')
        }
    } else if (process.env.DATABASE_SSL === 'true') {
        return true
    }
    return undefined
}

const ensureDirectory = (directoryPath: string): void => {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true })
    }
}
