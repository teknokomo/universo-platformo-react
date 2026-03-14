import knex, { type Knex } from 'knex'
import { parsePositiveInt } from '@universo/utils'

let instance: Knex | null = null
let poolMonitorInterval: NodeJS.Timeout | null = null
const ENABLE_POOL_DEBUG = process.env.DATABASE_KNEX_POOL_DEBUG === 'true'

const POOL_MONITOR_INTERVAL_MS = 10000
const POOL_PRESSURE_THRESHOLD = 0.7

function logPoolState(context: string, pool: any, error?: unknown): void {
    const used = typeof pool?.numUsed === 'function' ? pool.numUsed() : undefined
    const free = typeof pool?.numFree === 'function' ? pool.numFree() : undefined
    const pendingAcquires = typeof pool?.numPendingAcquires === 'function' ? pool.numPendingAcquires() : undefined
    const pendingCreates = typeof pool?.numPendingCreates === 'function' ? pool.numPendingCreates() : undefined
    const max = pool?.max ?? 15

    const total = (used ?? 0) + (free ?? 0)
    const utilization = total > 0 ? (used ?? 0) / max : 0

    const isUnderPressure = utilization >= POOL_PRESSURE_THRESHOLD || (pendingAcquires ?? 0) > 0
    const shouldLog =
        context === 'error' ||
        context === 'acquireFail' ||
        (ENABLE_POOL_DEBUG && (context === 'status' || (isUnderPressure && (context === 'acquireRequest' || context === 'release'))))

    if (!shouldLog) return

    const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined
    const logData = {
        used,
        free,
        pendingAcquires,
        pendingCreates,
        max,
        utilization: `${Math.round(utilization * 100)}%`,
        ...(errorMessage && { error: errorMessage })
    }

    if (errorMessage) {
        console.error(`[KnexClient] Pool ${context}`, logData)
    } else if (isUnderPressure) {
        console.warn(`[KnexClient] Pool ${context}`, logData)
    } else {
        console.log(`[KnexClient] Pool ${context}`, logData)
    }
}

function startPoolMonitor(pool: any): void {
    if (!ENABLE_POOL_DEBUG || poolMonitorInterval) return
    poolMonitorInterval = setInterval(() => {
        logPoolState('status', pool)
    }, POOL_MONITOR_INTERVAL_MS)
    poolMonitorInterval.unref()
}

function stopPoolMonitor(): void {
    if (poolMonitorInterval) {
        clearInterval(poolMonitorInterval)
        poolMonitorInterval = null
    }
}

function getSSLConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
    if (process.env.DATABASE_SSL_KEY_BASE64) {
        return {
            rejectUnauthorized: false,
            ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64').toString()
        }
    } else if (process.env.DATABASE_SSL === 'true') {
        return { rejectUnauthorized: false }
    }
    return undefined
}

/**
 * Initialize the Knex singleton. Idempotent — returns existing instance if created.
 *
 * Pool budget: 100% Knex (no TypeORM split).
 * Default pool max = DATABASE_POOL_MAX env or 15 (Supabase Nano safe default).
 */
export function initKnex(): Knex {
    if (instance) return instance

    const host = process.env.DATABASE_HOST
    const port = parsePositiveInt(process.env.DATABASE_PORT, 5432)
    const user = process.env.DATABASE_USER
    const password = process.env.DATABASE_PASSWORD
    const database = process.env.DATABASE_NAME
    const isTransactionPooler = port === 6543

    if (!host || !user || !password || !database) {
        throw new Error(
            '[KnexClient] Missing required database configuration. ' +
                'Ensure DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME are set.'
        )
    }

    const sslConfig = getSSLConfig()
    const poolMax = parsePositiveInt(process.env.DATABASE_POOL_MAX, 15)
    const acquireTimeoutMillis = parsePositiveInt(process.env.DATABASE_KNEX_ACQUIRE_TIMEOUT_MS, 10000)
    const idleTimeoutMillis = parsePositiveInt(process.env.DATABASE_KNEX_IDLE_TIMEOUT_MS, 15000)
    const createTimeoutMillis = parsePositiveInt(process.env.DATABASE_KNEX_CREATE_TIMEOUT_MS, 10000)

    console.log('[KnexClient] Creating Knex instance', {
        host,
        port,
        database,
        user: '***',
        ssl: sslConfig ? 'enabled' : 'disabled',
        poolMax,
        poolerMode: isTransactionPooler ? 'transaction' : 'session/direct'
    })

    if (isTransactionPooler) {
        console.error(
            '[KnexClient] ❌ Transaction pooler (port 6543) is NOT compatible with RLS session ' +
                'variables and advisory locks. Switch to session mode (port 5432 via pooler) or direct connection. ' +
                'Set ALLOW_TRANSACTION_POOLER=true to bypass this check (NOT recommended for production).'
        )
        if (process.env.ALLOW_TRANSACTION_POOLER !== 'true') {
            throw new Error(
                '[KnexClient] Transaction pooler (port 6543) detected. ' +
                    'This is incompatible with RLS set_config() and advisory locks. ' +
                    'Switch DATABASE_PORT to 5432 (session mode) or set ALLOW_TRANSACTION_POOLER=true.'
            )
        }
    }

    instance = knex({
        client: 'pg',
        connection: {
            host,
            port,
            user,
            password,
            database,
            ssl: sslConfig
        },
        pool: {
            min: 0,
            max: poolMax,
            acquireTimeoutMillis,
            idleTimeoutMillis,
            reapIntervalMillis: 1000,
            createTimeoutMillis,
            destroyTimeoutMillis: 5000,
            propagateCreateError: false,
            afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
                conn.query(
                    "SET search_path TO public, extensions, metahubs, applications, admin; SET statement_timeout TO '30s';",
                    (err: Error | null) => {
                        if (err) {
                            console.error('[KnexClient] afterCreate: connection initialization failed:', err.message)
                        }
                        done(err, conn)
                    }
                )
            }
        }
    })

    // NOTE: Accessing internal Knex/tarn.js pool properties for error monitoring.
    // This is fragile and may break with Knex or tarn.js updates.
    const pool = (instance as unknown as { client?: { pool?: any } })?.client?.pool
    if (pool?.on) {
        pool.on('error', (error: unknown) => {
            logPoolState('error', pool, error)
        })

        if (ENABLE_POOL_DEBUG) {
            pool.on('acquireRequest', () => {
                logPoolState('acquireRequest', pool)
            })
            pool.on('acquireSuccess', () => {
                logPoolState('acquireSuccess', pool)
            })
            pool.on('release', () => {
                logPoolState('release', pool)
            })
        }

        pool.on('acquireFail', (_eventId: number, err: Error) => {
            logPoolState('acquireFail', pool, err)
        })
    }

    startPoolMonitor(pool)
    return instance
}

/**
 * Get the Knex singleton instance. Initializes on first call.
 */
export function getKnex(): Knex {
    if (!instance) return initKnex()
    return instance
}

/**
 * Destroy the Knex singleton and release all pool connections.
 */
export async function destroyKnex(): Promise<void> {
    stopPoolMonitor()
    if (instance) {
        await instance.destroy()
        instance = null
        console.log('[KnexClient] Instance destroyed')
    }
}

export interface DatabaseHealthStatus {
    connected: boolean
    latencyMs: number
    poolStatus: { used: number; free: number; pending: number }
}

/**
 * Check database connection health and pool status.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealthStatus> {
    const knexInstance = instance
    if (!knexInstance) {
        return { connected: false, latencyMs: -1, poolStatus: { used: 0, free: 0, pending: 0 } }
    }

    const pool = (knexInstance as unknown as { client?: { pool?: any } })?.client?.pool
    const poolStatus = {
        used: typeof pool?.numUsed === 'function' ? pool.numUsed() : 0,
        free: typeof pool?.numFree === 'function' ? pool.numFree() : 0,
        pending: typeof pool?.numPendingAcquires === 'function' ? pool.numPendingAcquires() : 0
    }

    const start = Date.now()
    try {
        await knexInstance.raw('SELECT 1')
        return { connected: true, latencyMs: Date.now() - start, poolStatus }
    } catch {
        return { connected: false, latencyMs: Date.now() - start, poolStatus }
    }
}

let shutdownRegistered = false

/**
 * Register SIGTERM/SIGINT handler for graceful pool shutdown.
 * Waits up to SHUTDOWN_GRACE_MS (default 15 000 ms) for in-flight queries
 * to finish before destroying the connection pool.
 * Idempotent — only registers once.
 */
export function registerGracefulShutdown(): void {
    if (shutdownRegistered) return
    shutdownRegistered = true

    const gracePeriodMs = parsePositiveInt(process.env.DATABASE_SHUTDOWN_GRACE_MS, 15000)

    const shutdown = async (signal: string) => {
        console.log(`[KnexClient] ${signal} received — waiting up to ${gracePeriodMs}ms for in-flight queries...`)

        const pool = (instance as unknown as { client?: { pool?: any } })?.client?.pool
        const used = typeof pool?.numUsed === 'function' ? pool.numUsed() : 0

        if (used > 0) {
            const start = Date.now()
            await new Promise<void>((resolve) => {
                const check = () => {
                    const currentUsed = typeof pool?.numUsed === 'function' ? pool.numUsed() : 0
                    if (currentUsed === 0 || Date.now() - start >= gracePeriodMs) {
                        resolve()
                        return
                    }
                    setTimeout(check, 250)
                }
                check()
            })
            const finalUsed = typeof pool?.numUsed === 'function' ? pool.numUsed() : 0
            if (finalUsed > 0) {
                console.warn(`[KnexClient] Grace period expired with ${finalUsed} in-flight connection(s) — forcing pool destroy`)
            }
        }

        await destroyKnex()
        process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
}
