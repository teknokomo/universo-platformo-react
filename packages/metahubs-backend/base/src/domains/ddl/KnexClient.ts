import knex, { Knex } from 'knex'
import { parsePositiveInt } from '@universo/utils'

/**
 * KnexClient - Singleton wrapper for Knex instance
 *
 * Provides a Knex connection for runtime DDL operations (CREATE SCHEMA, CREATE TABLE, etc.)
 * This is separate from TypeORM which handles the static "metahubs" schema.
 *
 * Used by:
 * - SchemaGenerator: Creates PostgreSQL schemas for Publications
 * - SchemaMigrator: Alters tables when configuration changes
 *
 * Pool Configuration:
 * - Production defaults remain conservative for shared Supabase limits.
 * - Development defaults prioritize TypeORM/RLS request traffic
 *   (TypeORM 8, Knex 4 by default unless env overrides are provided).
 */
class KnexClient {
    private static instance: Knex | null = null
    private static poolMonitorInterval: NodeJS.Timeout | null = null
    private static readonly ENABLE_POOL_DEBUG = process.env.DATABASE_KNEX_POOL_DEBUG === 'true'

    /**
     * Pool monitoring configuration
     */
    private static readonly POOL_MONITOR_INTERVAL_MS = 10000 // 10 seconds
    private static readonly POOL_PRESSURE_THRESHOLD = 0.7 // Log when >70% of pool is in use

    /**
     * Get the Knex instance (creates one if not exists)
     */
    public static getInstance(): Knex {
        if (!KnexClient.instance) {
            KnexClient.instance = KnexClient.createInstance()
        }
        return KnexClient.instance
    }

    /**
     * Create a new Knex instance from environment variables
     */
    private static createInstance(): Knex {
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

        const sslConfig = KnexClient.getSSLConfig()

        // Knex receives a smaller slice of the shared connection budget.
        // This leaves headroom for request-scoped TypeORM RLS runners.
        const defaultConnectionBudget = process.env.NODE_ENV === 'development' ? 12 : 8
        const connectionBudget = parsePositiveInt(process.env.DATABASE_CONNECTION_BUDGET, defaultConnectionBudget)
        const defaultPoolMax = Math.max(2, Math.min(4, Math.floor(connectionBudget / 4)))
        const poolMax = parsePositiveInt(process.env.DATABASE_KNEX_POOL_MAX, defaultPoolMax)
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
            connectionBudget,
            poolerMode: isTransactionPooler ? 'transaction' : 'session/direct'
        })

        if (isTransactionPooler) {
            console.warn('[KnexClient] ⚠️ Transaction pooler detected (port 6543). Using shorter timeouts.')
        }

        const instance = knex({
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
                max: poolMax, // Configurable, default 5 for Supabase Nano tier
                // Shorter timeouts for better connection reuse
                acquireTimeoutMillis,
                idleTimeoutMillis,
                reapIntervalMillis: 1000,
                createTimeoutMillis,
                destroyTimeoutMillis: 5000,
                propagateCreateError: false
            }
        })

        // NOTE: Accessing internal Knex/tarn.js pool properties for error monitoring.
        // This is fragile and may break with Knex or tarn.js updates.
        // We accept this risk for improved observability during pool errors.
        // The pool interface matches tarn.js internals (numUsed, numFree, numPendingAcquires, numPendingCreates).
        const pool = (instance as unknown as { client?: { pool?: any } })?.client?.pool
        if (pool?.on) {
            pool.on('error', (error: unknown) => {
                KnexClient.logPoolState('error', pool, error)
            })

            if (KnexClient.ENABLE_POOL_DEBUG) {
                // Additional event listeners for diagnostics
                pool.on('acquireRequest', () => {
                    KnexClient.logPoolState('acquireRequest', pool)
                })

                pool.on('acquireSuccess', () => {
                    KnexClient.logPoolState('acquireSuccess', pool)
                })

                pool.on('release', () => {
                    KnexClient.logPoolState('release', pool)
                })
            }

            pool.on('acquireFail', (_eventId: number, err: Error) => {
                KnexClient.logPoolState('acquireFail', pool, err)
            })
        }

        // Start pool monitoring
        KnexClient.startPoolMonitor(pool)

        return instance
    }

    private static logPoolState(context: string, pool: any, error?: unknown): void {
        const used = typeof pool?.numUsed === 'function' ? pool.numUsed() : undefined
        const free = typeof pool?.numFree === 'function' ? pool.numFree() : undefined
        const pendingAcquires = typeof pool?.numPendingAcquires === 'function' ? pool.numPendingAcquires() : undefined
        const pendingCreates = typeof pool?.numPendingCreates === 'function' ? pool.numPendingCreates() : undefined
        const max = pool?.max ?? 5

        const poolState = {
            used,
            free,
            pendingAcquires,
            pendingCreates
        }

        // Calculate utilization
        const total = (used ?? 0) + (free ?? 0)
        const utilization = total > 0 ? (used ?? 0) / max : 0

        // Only log if under pressure, has errors, or explicit events
        const isUnderPressure = utilization >= KnexClient.POOL_PRESSURE_THRESHOLD || (pendingAcquires ?? 0) > 0
        const shouldLog =
            context === 'error' ||
            context === 'acquireFail' ||
            (KnexClient.ENABLE_POOL_DEBUG &&
                (context === 'status' || (isUnderPressure && (context === 'acquireRequest' || context === 'release'))))

        if (!shouldLog) return

        const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined
        const logData = {
            ...poolState,
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

    /**
     * Start periodic pool monitoring
     */
    private static startPoolMonitor(pool: any): void {
        if (!KnexClient.ENABLE_POOL_DEBUG || KnexClient.poolMonitorInterval) return

        KnexClient.poolMonitorInterval = setInterval(() => {
            KnexClient.logPoolState('status', pool)
        }, KnexClient.POOL_MONITOR_INTERVAL_MS)

        // Don't keep process alive just for monitoring
        KnexClient.poolMonitorInterval.unref()
    }

    /**
     * Stop pool monitoring
     */
    public static stopPoolMonitor(): void {
        if (KnexClient.poolMonitorInterval) {
            clearInterval(KnexClient.poolMonitorInterval)
            KnexClient.poolMonitorInterval = null
        }
    }

    /**
     * Parse SSL configuration from environment
     * Returns SSL options for pg connection (tls.ConnectionOptions compatible)
     */
    private static getSSLConfig(): { rejectUnauthorized: boolean; ca?: string } | undefined {
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
     * Destroy the Knex instance (for cleanup/testing)
     */
    public static async destroy(): Promise<void> {
        if (KnexClient.instance) {
            await KnexClient.instance.destroy()
            KnexClient.instance = null
            console.log('[KnexClient] Instance destroyed')
        }
    }
}

export { KnexClient }
export default KnexClient
