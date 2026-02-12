import 'reflect-metadata'
import path from 'path'
import * as fs from 'fs'
import { DataSource } from 'typeorm'
import { getUserHome } from './utils'
import { entities } from './database/entities'
import { postgresMigrations } from './database/migrations/postgres'
import { parseNonNegativeInt, parsePositiveInt } from '@universo/utils'

let appDataSource: DataSource
let poolMonitorInterval: NodeJS.Timeout | null = null
const ENABLE_POOL_DEBUG = process.env.DATABASE_POOL_DEBUG === 'true'

/**
 * Pool monitoring configuration
 * Logs pool status periodically when pool is under pressure
 */
const POOL_MONITOR_INTERVAL_MS = 10000 // 10 seconds
const POOL_PRESSURE_THRESHOLD = 0.7 // Log when >70% of pool is in use

/**
 * Get current pool metrics from TypeORM driver
 * NOTE: Accessing internal pg-pool properties - may break with driver updates
 */
const getPoolMetrics = (): { total: number; idle: number; waiting: number } | null => {
    const pool = (appDataSource as unknown as { driver?: { master?: { totalCount?: number; idleCount?: number; waitingCount?: number } } })
        ?.driver?.master
    if (pool && typeof pool.totalCount === 'number') {
        return {
            total: pool.totalCount,
            idle: pool.idleCount ?? 0,
            waiting: pool.waitingCount ?? 0
        }
    }
    return null
}

/**
 * Log pool status with context
 */
const logPoolStatus = (context: string, force = false): void => {
    const metrics = getPoolMetrics()
    if (!metrics) return

    const used = metrics.total - metrics.idle
    const utilization = metrics.total > 0 ? used / metrics.total : 0

    // Only log if under pressure or forced
    if (force || utilization >= POOL_PRESSURE_THRESHOLD || metrics.waiting > 0) {
        console.log(`[DataSource] Pool ${context}:`, {
            used,
            idle: metrics.idle,
            total: metrics.total,
            waiting: metrics.waiting,
            utilization: `${Math.round(utilization * 100)}%`
        })
    }
}

/**
 * Start periodic pool monitoring
 */
const startPoolMonitor = (): void => {
    if (!ENABLE_POOL_DEBUG || poolMonitorInterval) return

    poolMonitorInterval = setInterval(() => {
        logPoolStatus('status')
    }, POOL_MONITOR_INTERVAL_MS)

    // Don't keep process alive just for monitoring
    poolMonitorInterval.unref()
}

/**
 * Stop pool monitoring
 */
export const stopPoolMonitor = (): void => {
    if (poolMonitorInterval) {
        clearInterval(poolMonitorInterval)
        poolMonitorInterval = null
    }
}

export const init = async (): Promise<void> => {
    const databaseType = process.env.DATABASE_TYPE ?? 'postgres'
    const port = parsePositiveInt(process.env.DATABASE_PORT, 5432)
    const isTransactionPooler = port === 6543

    console.log('[DataSource] Initializing', {
        type: databaseType,
        host: process.env.DATABASE_HOST,
        port,
        database: process.env.DATABASE_NAME,
        user: process.env.DATABASE_USER ? '***' : undefined,
        ssl: !!getDatabaseSSLFromEnv(),
        poolerMode: isTransactionPooler ? 'transaction' : 'session/direct'
    })

    if (isTransactionPooler) {
        console.warn('[DataSource] ⚠️ Transaction pooler detected (port 6543). Prepared statements may cause issues.')
    }

    if (databaseType !== 'postgres') {
        throw new Error(`Unsupported database type "${databaseType}". This build supports only PostgreSQL configurations.`)
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
        const metrics = getPoolMetrics()
        if (metrics) {
            console.error('[DataSource] Pool error:', err.message, metrics)
        } else {
            console.error('[DataSource] Pool error:', err.message)
        }
    }

    // Connection budget for mixed TypeORM + Knex traffic.
    // TypeORM carries request-scoped RLS QueryRunners, so it gets most of the budget.
    const defaultConnectionBudget = process.env.NODE_ENV === 'development' ? 12 : 8
    const connectionBudget = parsePositiveInt(process.env.DATABASE_CONNECTION_BUDGET, defaultConnectionBudget)
    const defaultKnexReserve = Math.max(2, Math.floor(connectionBudget / 4))
    const defaultPoolMax = Math.max(4, connectionBudget - defaultKnexReserve)
    const poolMax = parsePositiveInt(process.env.DATABASE_POOL_MAX, defaultPoolMax)
    const poolMin = parseNonNegativeInt(process.env.DATABASE_POOL_MIN, 0)
    const idleTimeoutMillis = parsePositiveInt(process.env.DATABASE_IDLE_TIMEOUT_MS, 20000)
    const connectionTimeoutMillis = parsePositiveInt(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10000)

    appDataSource = new DataSource({
        type: 'postgres',
        host: process.env.DATABASE_HOST,
        port,
        username: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: getDatabaseSSLFromEnv(),
        synchronize: false,
        migrationsRun: false,
        entities: Object.values(entities),
        migrations: postgresMigrations,
        logging: ['error', 'warn', 'migration'], // Enable SQL logging for debugging
        // Pool configuration tuned for mixed TypeORM + Knex workloads.
        extra: {
            max: poolMax,
            min: poolMin,
            idleTimeoutMillis,
            connectionTimeoutMillis,
            // Allow exit on idle for serverless-like deployments
            allowExitOnIdle: true
        },
        poolErrorHandler: logPoolError
    })
    console.log(
        `[DataSource] DataSource created successfully (pool max: ${poolMax}, min: ${poolMin}, budget: ${connectionBudget})`
    )

    // Pool monitoring is disabled by default to reduce noisy logs in development.
    if (ENABLE_POOL_DEBUG) {
        startPoolMonitor()
        logPoolStatus('initialized', true)
    }
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
