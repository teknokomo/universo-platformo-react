import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Redis from 'ioredis'
import { RedisClientManager } from '../RedisClientManager'

// Mock ioredis
vi.mock('ioredis')

describe('RedisClientManager', () => {
    let mockRedisInstance: any

    beforeEach(() => {
        // Reset singleton state before each test
        ;(RedisClientManager as any).instance = null
        ;(RedisClientManager as any).isConnecting = false

        // Create mock Redis instance with event emitter behavior
        const eventHandlers: Map<string, Set<Function>> = new Map()

        mockRedisInstance = {
            status: 'connecting',
            once: vi.fn((event: string, callback: Function) => {
                if (!eventHandlers.has(event)) {
                    eventHandlers.set(event, new Set())
                }
                eventHandlers.get(event)!.add(callback)
            }),
            on: vi.fn((event: string, callback: Function) => {
                if (!eventHandlers.has(event)) {
                    eventHandlers.set(event, new Set())
                }
                eventHandlers.get(event)!.add(callback)
            }),
            off: vi.fn((event: string, callback: Function) => {
                eventHandlers.get(event)?.delete(callback)
            }),
            emit: vi.fn((event: string, ...args: any[]) => {
                const handlers = eventHandlers.get(event)
                if (handlers) {
                    handlers.forEach((handler) => handler(...args))
                    // 'once' listeners should be removed after execution
                    eventHandlers.delete(event)
                }
            }),
            quit: vi.fn().mockResolvedValue(undefined),
            call: vi.fn()
        }

        // Mock Redis constructor to return our mock and emit 'ready' asynchronously
        vi.mocked(Redis).mockImplementation(() => {
            // Emit 'ready' event in next tick to simulate real Redis behavior
            process.nextTick(() => {
                mockRedisInstance.status = 'ready'
                mockRedisInstance.emit('ready')
            })
            return mockRedisInstance
        })
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('getClient', () => {
        it('should throw error when Redis URL not provided', async () => {
            delete process.env.REDIS_URL

            await expect(RedisClientManager.getClient()).rejects.toThrow('Redis URL not provided. Set REDIS_URL environment variable.')
        })

        it('should create new Redis client on first call', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            const client = await RedisClientManager.getClient()

            expect(client).toBe(mockRedisInstance)
            expect(client.status).toBe('ready')
            expect(Redis).toHaveBeenCalledWith(
                'redis://localhost:6379',
                expect.objectContaining({
                    maxRetriesPerRequest: 3
                })
            )
        })

        it('should return same instance for multiple calls (singleton)', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            const client1 = await RedisClientManager.getClient()
            const client2 = await RedisClientManager.getClient()

            expect(client1).toBe(client2)
            expect(Redis).toHaveBeenCalledTimes(1)
        })

        it('should handle concurrent calls correctly', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            // Start two concurrent getClient calls
            const [client1, client2] = await Promise.all([RedisClientManager.getClient(), RedisClientManager.getClient()])

            expect(client1).toBe(client2)
            expect(Redis).toHaveBeenCalledTimes(1)
        })

        it('should handle connection errors', async () => {
            process.env.REDIS_URL = 'redis://invalid:6379'

            const error = new Error('Connection failed')

            // Mock Redis to emit error instead of ready
            vi.mocked(Redis).mockImplementation(() => {
                process.nextTick(() => {
                    mockRedisInstance.emit('error', error)
                })
                return mockRedisInstance
            })

            await expect(RedisClientManager.getClient()).rejects.toThrow('Connection failed')

            // Verify instance is reset after error
            expect((RedisClientManager as any).instance).toBeNull()
        })

        it('should use custom Redis URL from parameter', async () => {
            const customUrl = 'redis://custom:6379'

            await RedisClientManager.getClient(customUrl)

            expect(Redis).toHaveBeenCalledWith(customUrl, expect.any(Object))
        })
    })

    describe('close', () => {
        it('should close connection gracefully', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            await RedisClientManager.getClient()
            await RedisClientManager.close()

            expect(mockRedisInstance.quit).toHaveBeenCalled()
            expect((RedisClientManager as any).instance).toBeNull()
        })

        it('should handle close when no connection exists', async () => {
            await expect(RedisClientManager.close()).resolves.not.toThrow()
        })
    })

    describe('isConnected', () => {
        it('should return true when client is ready', async () => {
            process.env.REDIS_URL = 'redis://localhost:6379'

            await RedisClientManager.getClient()

            expect(RedisClientManager.isConnected()).toBe(true)
        })

        it('should return false when no connection exists', () => {
            expect(RedisClientManager.isConnected()).toBe(false)
        })

        it('should return false when client is not ready', () => {
            // Manually set instance with non-ready status
            ;(RedisClientManager as any).instance = { status: 'connecting' }

            expect(RedisClientManager.isConnected()).toBe(false)
        })
    })
})
