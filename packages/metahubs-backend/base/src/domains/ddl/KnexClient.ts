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
 */
class KnexClient {
    private static instance: Knex | null = null

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

        if (!host || !user || !password || !database) {
            throw new Error(
                '[KnexClient] Missing required database configuration. ' +
                'Ensure DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME are set.'
            )
        }

        const sslConfig = KnexClient.getSSLConfig()

        console.log('[KnexClient] Creating Knex instance', {
            host,
            port,
            database,
            user: '***',
            ssl: sslConfig ? 'enabled' : 'disabled',
        })

        const instance = knex({
            client: 'pg',
            connection: {
                host,
                port,
                user,
                password,
                database,
                ssl: sslConfig,
            },
            pool: {
                min: 0,
                max: 8, // Keep below Supabase Pool Size (15) together with TypeORM (7)
                // Acquire timeout - how long to wait for a connection
                acquireTimeoutMillis: 60000,
                // Idle timeout - close connections after this time
                idleTimeoutMillis: 30000,
                // Reap interval - how often to check for idle connections
                reapIntervalMillis: 1000,
                // Create timeout - how long to wait for connection creation
                createTimeoutMillis: 30000,
                // Destroy timeout - how long to wait for connection destruction
                destroyTimeoutMillis: 5000,
                // Propagate create error
                propagateCreateError: false,
                // Pool event logging for monitoring
                afterCreate: (conn: unknown, done: (err: Error | null, conn: unknown) => void) => {
                    console.log('[KnexClient] Pool connection created')
                    done(null, conn)
                },
            },
        })

        const pool = (instance as unknown as { client?: { pool?: any } })?.client?.pool
        if (pool?.on) {
            pool.on('error', (error: unknown) => {
                KnexClient.logPoolState('error', pool, error)
            })
        }

        return instance
    }

    private static logPoolState(context: string, pool: any, error?: unknown): void {
        const used = typeof pool?.numUsed === 'function' ? pool.numUsed() : undefined
        const free = typeof pool?.numFree === 'function' ? pool.numFree() : undefined
        const pendingAcquires = typeof pool?.numPendingAcquires === 'function' ? pool.numPendingAcquires() : undefined
        const pendingCreates = typeof pool?.numPendingCreates === 'function' ? pool.numPendingCreates() : undefined

        const poolState = {
            used,
            free,
            pendingAcquires,
            pendingCreates
        }

        const errorMessage = error instanceof Error ? error.message : error ? String(error) : undefined
        if (errorMessage) {
            console.error(`[KnexClient] Pool ${context}`, { error: errorMessage, ...poolState })
        } else {
            console.warn(`[KnexClient] Pool ${context}`, poolState)
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
                ca: Buffer.from(process.env.DATABASE_SSL_KEY_BASE64, 'base64').toString(),
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
            const result = await knexInstance.raw<{ rows: { pg_try_advisory_lock: boolean }[] }>(
                `SELECT pg_try_advisory_lock(?)`,
                [lockKey]
            )
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
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32bit integer
        }
        return Math.abs(hash)
    }
}

export { KnexClient }
export default KnexClient
