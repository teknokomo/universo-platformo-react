import { rateLimit, type RateLimitRequestHandler } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { RedisClientManager } from './RedisClientManager'
import type { RateLimitType, RateLimitConfig } from './types'

/**
 * Create production-ready rate limiter middleware
 *
 * Features:
 * - Automatic Redis detection (falls back to MemoryStore)
 * - Singleton Redis client (no connection leak)
 * - Separate read/write limits
 * - Standard HTTP headers (RFC draft)
 * - Graceful degradation
 *
 * @example Basic usage
 * ```ts
 * const readLimiter = await createRateLimiter('read')
 * router.get('/api/items', readLimiter, handler)
 * ```
 *
 * @example With Redis
 * ```ts
 * const writeLimiter = await createRateLimiter('write', {
 *   redisUrl: 'redis://localhost:6379',
 *   keyPrefix: 'api:items'
 * })
 * ```
 */
export async function createRateLimiter(type: RateLimitType, config?: RateLimitConfig): Promise<RateLimitRequestHandler> {
    const {
        windowMs = 15 * 60 * 1000, // 15 minutes (fixed from 1 minute)
        maxRead = 100,
        maxWrite = 60,
        maxCustom,
        redisUrl,
        redisRetries = 3,
        redisRetryDelay = 1000,
        keyPrefix = 'rate-limit',
        message
    } = config || {}

    // Determine max requests based on type
    const max = type === 'read' ? maxRead : type === 'write' ? maxWrite : maxCustom ?? 100

    // Try to use Redis store for distributed rate limiting with retry logic
    let store: any = undefined // undefined = use MemoryStore (default)

    const effectiveRedisUrl = redisUrl || process.env.REDIS_URL

    if (effectiveRedisUrl) {
        let lastError: Error | null = null

        for (let attempt = 1; attempt <= redisRetries; attempt++) {
            try {
                const redisClient = await RedisClientManager.getClient(effectiveRedisUrl)

                store = new RedisStore({
                    // @ts-expect-error - ioredis call method not in types
                    sendCommand: (...args: string[]) => redisClient.call(...args),
                    prefix: `${keyPrefix}:${type}:`
                })

                console.info(`[RateLimit:${type}] Using Redis store (distributed mode)`)
                break // Success - exit retry loop
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt < redisRetries) {
                    console.warn(
                        `[RateLimit:${type}] Redis connection failed (attempt ${attempt}/${redisRetries}), retrying in ${redisRetryDelay}ms...`
                    )
                    await new Promise((resolve) => setTimeout(resolve, redisRetryDelay))
                } else {
                    console.warn(
                        `[RateLimit:${type}] Failed to connect to Redis after ${redisRetries} attempts, falling back to MemoryStore:`,
                        lastError.message
                    )
                    // store remains undefined → MemoryStore
                }
            }
        }
    } else {
        console.info(`[RateLimit:${type}] Using MemoryStore (single-instance mode)`)
    }

    return rateLimit({
        windowMs,
        max,
        standardHeaders: true, // Return rate limit info in headers (RateLimit-*)
        legacyHeaders: false, // Disable X-RateLimit-* headers
        store,

        // Custom error handler with detailed response
        handler: (req, res) => {
            const limitInfo = (req as any).rateLimit

            // Calculate retry-after in seconds
            const resetMs = limitInfo?.resetTime ? Math.max(0, limitInfo.resetTime.getTime() - Date.now()) : windowMs
            const retryAfterSeconds = Math.max(1, Math.ceil(resetMs / 1000))

            // Set standard headers for client retry logic
            res.set({
                'Retry-After': retryAfterSeconds.toString(),
                'X-RateLimit-Limit': String(limitInfo?.limit ?? max),
                'X-RateLimit-Remaining': String(limitInfo?.remaining ?? 0),
                'X-RateLimit-Reset': limitInfo?.resetTime
                    ? limitInfo.resetTime.toISOString()
                    : new Date(Date.now() + windowMs).toISOString()
            })

            // Log rate limit violation (for monitoring/alerting)
            console.warn(`[RateLimit:${type}] Limit exceeded`, {
                ip: req.ip,
                current: limitInfo?.current,
                limit: limitInfo?.limit,
                path: req.path
            })

            // Return structured JSON error
            res.status(429).json({
                success: false,
                error: message || 'Too many requests, please try again later.',
                retryAfter: retryAfterSeconds,
                code: 'RATE_LIMIT_EXCEEDED'
            })
        }
    })
}

/**
 * Create multiple rate limiters at once
 * Optimizes Redis connection reuse
 */
export async function createRateLimiters(
    config?: RateLimitConfig
): Promise<{ read: RateLimitRequestHandler; write: RateLimitRequestHandler }> {
    const [read, write] = await Promise.all([createRateLimiter('read', config), createRateLimiter('write', config)])

    return { read, write }
}
