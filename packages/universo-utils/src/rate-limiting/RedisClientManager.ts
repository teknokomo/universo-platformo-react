import Redis from 'ioredis'

/**
 * Singleton Redis client manager for rate limiting
 * Ensures only one Redis connection per process
 */
export class RedisClientManager {
    private static instance: Redis | null = null
    private static isConnecting = false

    private constructor() {
        // Private constructor prevents direct instantiation
    }

    /**
     * Get or create Redis client instance
     * Thread-safe with connection pooling
     */
    public static async getClient(redisUrl?: string): Promise<Redis> {
        const effectiveUrl = redisUrl || process.env.REDIS_URL

        if (!effectiveUrl) {
            throw new Error('Redis URL not provided. Set REDIS_URL environment variable.')
        }

        // Return existing client if available
        if (this.instance && this.instance.status === 'ready') {
            return this.instance
        }

        // Wait if connection is in progress (event-driven approach)
        if (this.isConnecting) {
            return new Promise((resolve, reject) => {
                let timeoutId: NodeJS.Timeout | null = null

                const cleanup = () => {
                    if (timeoutId) {
                        clearTimeout(timeoutId)
                        timeoutId = null
                    }
                    if (this.instance) {
                        this.instance.off('ready', onReady)
                        this.instance.off('error', onError)
                    }
                }

                const onReady = () => {
                    cleanup()
                    if (this.instance) {
                        resolve(this.instance)
                    } else {
                        reject(new Error('Redis instance is null'))
                    }
                }

                const onError = (err: Error) => {
                    cleanup()
                    reject(err)
                }

                const onTimeout = () => {
                    cleanup()
                    reject(new Error('Redis connection timeout'))
                }

                // Subscribe to events
                if (this.instance) {
                    this.instance.once('ready', onReady)
                    this.instance.once('error', onError)
                }

                // Set timeout
                timeoutId = setTimeout(onTimeout, 10000)
            })
        }

        try {
            this.isConnecting = true

            // Create new Redis client with production-ready configuration
            this.instance = new Redis(effectiveUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy: (times: number) => {
                    if (times > 3) {
                        console.error('[Redis] Max retry attempts reached')
                        return null // Stop retrying
                    }
                    const delay = Math.min(times * 100, 3000)
                    console.warn(`[Redis] Retrying connection in ${delay}ms (attempt ${times})`)
                    return delay
                },
                reconnectOnError: (err: Error) => {
                    const targetErrors = ['READONLY', 'ECONNREFUSED']
                    return targetErrors.some((target) => err.message.includes(target))
                }
            })

            // Wait for ready state
            await new Promise<void>((resolve, reject) => {
                this.instance!.once('ready', () => {
                    console.info('[Redis] Client connected successfully')
                    resolve()
                })

                this.instance!.once('error', (err) => {
                    console.error('[Redis] Connection error:', err)
                    reject(err)
                })
            })

            // Setup error handlers
            this.instance.on('error', (err) => {
                console.error('[Redis] Runtime error:', err)
            })

            this.instance.on('close', () => {
                console.warn('[Redis] Connection closed')
            })

            return this.instance
        } catch (error) {
            this.instance = null
            throw error
        } finally {
            this.isConnecting = false
        }
    }

    /**
     * Close Redis connection gracefully
     * Call this during application shutdown
     */
    public static async close(): Promise<void> {
        if (this.instance) {
            console.info('[Redis] Closing connection...')
            await this.instance.quit()
            this.instance = null
            console.info('[Redis] Connection closed')
        }
    }

    /**
     * Check if Redis client is available and connected
     */
    public static isConnected(): boolean {
        return this.instance?.status === 'ready'
    }
}
