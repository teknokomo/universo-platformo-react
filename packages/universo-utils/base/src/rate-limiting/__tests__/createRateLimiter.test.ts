import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { rateLimit } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { createRateLimiter, createRateLimiters } from '../createRateLimiter'
import { RedisClientManager } from '../RedisClientManager'

// Mock dependencies
vi.mock('express-rate-limit')
vi.mock('rate-limit-redis')
vi.mock('../RedisClientManager')

describe('createRateLimiter', () => {
    let mockRedisClient: any
    let mockRateLimitHandler: any

    beforeEach(() => {
        // Reset environment
        delete process.env.REDIS_URL

        // Mock Redis client
        mockRedisClient = {
            call: vi.fn()
        }

        // Mock RedisClientManager
        vi.mocked(RedisClientManager.getClient).mockResolvedValue(mockRedisClient as any)

        // Mock rateLimit middleware
        mockRateLimitHandler = vi.fn()
        vi.mocked(rateLimit).mockReturnValue(mockRateLimitHandler as any)

        // Mock console methods
        vi.spyOn(console, 'info').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    describe('basic functionality', () => {
        it('should create rate limiter with default config for read type', async () => {
            const limiter = await createRateLimiter('read')

            expect(limiter).toBe(mockRateLimitHandler)
            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    windowMs: 15 * 60 * 1000,
                    max: 100,
                    standardHeaders: true,
                    legacyHeaders: false
                })
            )
        })

        it('should create rate limiter with default config for write type', async () => {
            await createRateLimiter('write')

            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    max: 60 // write default
                })
            )
        })

        it('should create rate limiter with custom type and maxCustom', async () => {
            await createRateLimiter('custom', { maxCustom: 200 })

            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    max: 200
                })
            )
        })

        it('should use custom windowMs when provided', async () => {
            await createRateLimiter('read', { windowMs: 60000 })

            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    windowMs: 60000
                })
            )
        })

        it('should use custom maxRead when provided', async () => {
            await createRateLimiter('read', { maxRead: 500 })

            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    max: 500
                })
            )
        })
    })

    describe('Redis store integration', () => {
        it('should use Redis store when REDIS_URL is set', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            await createRateLimiter('read')

            expect(RedisClientManager.getClient).toHaveBeenCalledWith('redis://localhost:6379')
            expect(RedisStore).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'rate-limit:read:'
                })
            )
            expect(console.info).toHaveBeenCalledWith('[RateLimit:read] Using Redis store (distributed mode)')
        })

        it('should use custom redisUrl from config', async () => {
            const customUrl = 'redis://custom:6379'

            await createRateLimiter('read', { redisUrl: customUrl })

            expect(RedisClientManager.getClient).toHaveBeenCalledWith(customUrl)
        })

        it('should use custom keyPrefix', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            await createRateLimiter('read', { keyPrefix: 'custom-prefix' })

            expect(RedisStore).toHaveBeenCalledWith(
                expect.objectContaining({
                    prefix: 'custom-prefix:read:'
                })
            )
        })
    })

    describe('MemoryStore fallback', () => {
        it('should use MemoryStore when no Redis URL provided', async () => {
            await createRateLimiter('read')

            expect(RedisClientManager.getClient).not.toHaveBeenCalled()
            expect(RedisStore).not.toHaveBeenCalled()
            expect(console.info).toHaveBeenCalledWith('[RateLimit:read] Using MemoryStore (single-instance mode)')

            // Verify rateLimit called with undefined store (defaults to MemoryStore)
            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    store: undefined
                })
            )
        })

        it('should fallback to MemoryStore when Redis connection fails', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'
            vi.mocked(RedisClientManager.getClient).mockRejectedValue(new Error('Connection failed'))

            await createRateLimiter('read')

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect to Redis after 3 attempts'),
                'Connection failed'
            )
            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    store: undefined
                })
            )
        })
    })

    describe('retry logic', () => {
        beforeEach(() => {
            vi.useFakeTimers()
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('should retry Redis connection with default config (3 attempts, 1000ms delay)', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            let attemptCount = 0
            vi.mocked(RedisClientManager.getClient).mockImplementation(() => {
                attemptCount++
                if (attemptCount < 3) {
                    return Promise.reject(new Error(`Attempt ${attemptCount} failed`))
                }
                return Promise.resolve(mockRedisClient)
            })

            const promise = createRateLimiter('read')

            // Fast-forward through retry delays
            await vi.advanceTimersByTimeAsync(1000) // First retry
            await vi.advanceTimersByTimeAsync(1000) // Second retry

            await promise

            expect(attemptCount).toBe(3)

            // Verify retry warnings
            const warnCalls = vi.mocked(console.warn).mock.calls
            expect(warnCalls.some((call) => call[0].includes('attempt 1/3'))).toBe(true)
            expect(warnCalls.some((call) => call[0].includes('attempt 2/3'))).toBe(true)

            expect(console.info).toHaveBeenCalledWith('[RateLimit:read] Using Redis store (distributed mode)')
        })

        it('should use custom retry config', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            let attemptCount = 0
            vi.mocked(RedisClientManager.getClient).mockImplementation(() => {
                attemptCount++
                if (attemptCount < 5) {
                    return Promise.reject(new Error(`Attempt ${attemptCount} failed`))
                }
                return Promise.resolve(mockRedisClient)
            })

            const promise = createRateLimiter('read', {
                redisRetries: 5,
                redisRetryDelay: 500
            })

            // Fast-forward through custom retry delays
            for (let i = 0; i < 4; i++) {
                await vi.advanceTimersByTimeAsync(500)
            }

            await promise

            expect(attemptCount).toBe(5)

            // Verify retry warnings (attempts 1-4, not attempt 5 which succeeds)
            const warnCalls = vi.mocked(console.warn).mock.calls
            expect(warnCalls.some((call) => call[0].includes('attempt 1/5'))).toBe(true)
            expect(warnCalls.some((call) => call[0].includes('attempt 4/5'))).toBe(true)
        })

        it('should stop retrying and fallback to MemoryStore after max attempts', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            vi.mocked(RedisClientManager.getClient).mockRejectedValue(new Error('Persistent failure'))

            const promise = createRateLimiter('read', { redisRetries: 2, redisRetryDelay: 100 })

            // Fast-forward through all retries
            await vi.advanceTimersByTimeAsync(100)
            await vi.advanceTimersByTimeAsync(100)

            await promise

            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect to Redis after 2 attempts'),
                'Persistent failure'
            )
            expect(rateLimit).toHaveBeenCalledWith(
                expect.objectContaining({
                    store: undefined // MemoryStore
                })
            )
        })

        it('should not retry when redisRetries is 1', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            vi.mocked(RedisClientManager.getClient).mockRejectedValue(new Error('Immediate failure'))

            await createRateLimiter('read', { redisRetries: 1 })

            expect(RedisClientManager.getClient).toHaveBeenCalledTimes(1)
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Failed to connect to Redis after 1 attempts'),
                'Immediate failure'
            )
        })
    })

    describe('error handler', () => {
        it('should configure custom error handler with structured response', async () => {
            await createRateLimiter('read')

            const config = vi.mocked(rateLimit).mock.calls[0][0] as any
            expect(config).toHaveProperty('handler')
            expect(typeof config.handler).toBe('function')
        })

        it('should use custom message when provided', async () => {
            const customMessage = 'Custom rate limit message'

            await createRateLimiter('read', { message: customMessage })

            const config = vi.mocked(rateLimit).mock.calls[0][0] as any
            const mockReq = { ip: '127.0.0.1', path: '/test', rateLimit: {} }
            const mockRes = {
                set: vi.fn(),
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            // Call the handler (express-rate-limit handler signature)
            config.handler(mockReq, mockRes)

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    error: customMessage
                })
            )
        })
    })
})

describe('createRateLimiters', () => {
    let mockRateLimitHandler: any

    beforeEach(() => {
        mockRateLimitHandler = vi.fn()
        vi.mocked(rateLimit).mockReturnValue(mockRateLimitHandler as any)
        vi.spyOn(console, 'info').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.restoreAllMocks()
    })

    it('should create both read and write limiters', async () => {
        const limiters = await createRateLimiters()

        expect(limiters).toHaveProperty('read')
        expect(limiters).toHaveProperty('write')
        expect(limiters.read).toBe(mockRateLimitHandler)
        expect(limiters.write).toBe(mockRateLimitHandler)
    })

    it('should create limiters in parallel', async () => {
        const startTime = Date.now()

        await createRateLimiters()

        const duration = Date.now() - startTime

        // Both limiters should be created in parallel, not sequentially
        expect(rateLimit).toHaveBeenCalledTimes(2)
        expect(duration).toBeLessThan(100) // Should be fast (parallel execution)
    })

    it('should pass config to both limiters', async () => {
        const config = {
            windowMs: 30000,
            maxRead: 200,
            maxWrite: 100,
            redisUrl: 'redis://localhost:6379'
        }

        await createRateLimiters(config)

        expect(rateLimit).toHaveBeenCalledTimes(2)

        // Verify read limiter config
        const readConfig = vi.mocked(rateLimit).mock.calls[0][0]
        expect(readConfig).toMatchObject({
            windowMs: 30000,
            max: 200
        })

        // Verify write limiter config
        const writeConfig = vi.mocked(rateLimit).mock.calls[1][0]
        expect(writeConfig).toMatchObject({
            windowMs: 30000,
            max: 100
        })
    })
})
