import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

export type RateLimitType = 'read' | 'write' | 'custom'

export interface RateLimitConfig {
    /**
     * Window duration in milliseconds
     * @default 900000 (15 minutes)
     */
    windowMs?: number

    /**
     * Max requests for read operations
     * @default 100
     */
    maxRead?: number

    /**
     * Max requests for write operations
     * @default 60
     */
    maxWrite?: number

    /**
     * Max requests for custom type
     */
    maxCustom?: number

    /**
     * Redis connection URL for distributed rate limiting
     * Falls back to REDIS_URL env variable
     * @example "redis://localhost:6379"
     */
    redisUrl?: string

    /**
     * Number of retry attempts for Redis store initialization
     * @default 3
     */
    redisRetries?: number

    /**
     * Delay between retry attempts in milliseconds
     * @default 1000
     */
    redisRetryDelay?: number

    /**
     * Prefix for Redis keys
     * @default "rate-limit"
     */
    keyPrefix?: string

    /**
     * Custom error message
     */
    message?: string
}

export interface RateLimiterMiddleware {
    (req: Request, res: Response, next: NextFunction): void | Promise<void>
}

export { RateLimitRequestHandler }
