import knex, { Knex } from 'knex'

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
 * Pool Configuration (Supabase Nano tier - 15 connections max):
 * - TypeORM: 5 connections (static entities)
 * - Knex: 5 connections (DDL operations)
 * - Reserved: 5 connections for Supabase internal services
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
        const port = parseInt(process.env.DATABASE_PORT || '5432', 10)
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

        // Pool size from env or default 5 (for Supabase Nano tier compatibility)
        const poolMax = parseInt(process.env.DATABASE_KNEX_POOL_MAX || '5', 10)

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
                acquireTimeoutMillis: 30000, // Reduced from 60000
                idleTimeoutMillis: 20000, // Reduced from 30000
                reapIntervalMillis: 1000,
                createTimeoutMillis: 15000, // Reduced from 30000
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

    /**
     * Acquire an advisory lock for DDL operations
     * This prevents concurrent schema modifications
     *
     * @param lockKey - Unique numeric key for the lock (use applicationId hash)
     * @param timeoutMs - How long to wait for the lock (default: 30s)
     * @returns true if lock acquired, false if timeout
     */
    public static async acquireAdvisoryLock(lockKey: number, timeoutMs = 30000): Promise<boolean> {
        const knexInstance = KnexClient.getInstance()

        // Set statement timeout for this session
        await knexInstance.raw(`SET LOCAL statement_timeout = ${timeoutMs}`)

        try {
            // Try to acquire exclusive session-level advisory lock
            const result = await knexInstance.raw<{ rows: { pg_try_advisory_lock: boolean }[] }>(`SELECT pg_try_advisory_lock(?)`, [
                lockKey
            ])
            return result.rows[0]?.pg_try_advisory_lock === true
        } catch (error) {
            console.error('[KnexClient] Failed to acquire advisory lock:', error)
            return false
        }
    }

    /**
     * Release an advisory lock
     *
     * @param lockKey - The same key used to acquire the lock
     */
    public static async releaseAdvisoryLock(lockKey: number): Promise<void> {
        const knexInstance = KnexClient.getInstance()
        try {
            await knexInstance.raw(`SELECT pg_advisory_unlock(?)`, [lockKey])
        } catch (error) {
            console.error('[KnexClient] Failed to release advisory lock:', error)
        }
    }

    /**
     * Generate a numeric lock key from a UUID string
     * Uses a simple hash function to convert UUID to int32
     *
     * @param uuid - Application UUID
     * @returns Numeric lock key
     */
    public static uuidToLockKey(uuid: string): number {
        const cleanUuid = uuid.replace(/-/g, '')
        let hash = 0
        for (let i = 0; i < cleanUuid.length; i++) {
            const char = cleanUuid.charCodeAt(i)
            hash = (hash << 5) - hash + char
            hash = hash & hash // Convert to 32bit integer
        }
        return Math.abs(hash)
    }
}

export { KnexClient }
export default KnexClient
