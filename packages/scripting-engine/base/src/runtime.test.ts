import { Script } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { IsolatePool, IsolatedVmScriptRuntimeHost, ScriptHealthMonitor } from './runtime'

const createFakeIsolatedVmModule = (records: { isolates: Array<{ id: number; dispose: ReturnType<typeof vi.fn> }> }) => {
    let nextId = 0

    return {
        Isolate: class {
            readonly id = ++nextId
            readonly dispose = vi.fn()

            constructor(_options: { memoryLimit: number }) {
                records.isolates.push({ id: this.id, dispose: this.dispose })
            }

            async createContext() {
                return {
                    global: {
                        set: async () => undefined,
                        derefInto: () => ({})
                    },
                    evalClosure: async () => undefined
                }
            }

            async compileScript(code: string) {
                new Script(code)

                return {
                    run: async () => undefined
                }
            }
        },
        Reference: class {
            constructor(_value: unknown) {}

            async apply() {
                return undefined
            }

            release() {}
        },
        ExternalCopy: class {
            constructor(private readonly value: unknown) {}

            copyInto() {
                return this.value
            }
        }
    }
}

describe('ScriptHealthMonitor', () => {
    it('opens the circuit breaker after repeated failures and resets after cooldown', () => {
        let now = 1000
        const monitor = new ScriptHealthMonitor({
            failureThreshold: 2,
            cooldownMs: 500,
            now: () => now
        })

        monitor.recordFailure('script-a', new Error('boom-1'))
        expect(monitor.getState('script-a')).toEqual({
            consecutiveFailures: 1,
            cooldownUntil: null,
            lastError: 'boom-1'
        })

        monitor.recordFailure('script-a', new Error('boom-2'))
        expect(() => monitor.assertAvailable('script-a')).toThrow('Script circuit breaker is open until')

        now = 1600
        expect(() => monitor.assertAvailable('script-a')).not.toThrow()
        expect(monitor.getState('script-a')).toEqual({
            consecutiveFailures: 0,
            cooldownUntil: null,
            lastError: null
        })
    })
})

describe('IsolatePool', () => {
    it('reuses pooled entries for the same bundle and evicts the least recently used isolate', async () => {
        const records = {
            isolates: [] as Array<{ id: number; dispose: ReturnType<typeof vi.fn> }>
        }
        let now = 0
        const dateNowSpy = vi.spyOn(Date, 'now').mockImplementation(() => {
            now += 1
            return now
        })
        const pool = new IsolatePool(async () => createFakeIsolatedVmModule(records), {
            memoryLimitMb: 8,
            maxIsolates: 2
        })

        const first = await pool.acquire('bundle-1')
        const second = await pool.acquire('bundle-2')
        const reusedFirst = await pool.acquire('bundle-1')
        const third = await pool.acquire('bundle-3')

        expect(reusedFirst).toBe(first)
        expect(records.isolates).toHaveLength(3)
        expect(records.isolates[1].dispose).toHaveBeenCalledTimes(1)
        expect(records.isolates[0].dispose).not.toHaveBeenCalled()
        expect(records.isolates[2].dispose).not.toHaveBeenCalled()
        expect(second.key).not.toBe(third.key)

        pool.disposeAll()
        expect(records.isolates[0].dispose).toHaveBeenCalledTimes(1)
        expect(records.isolates[1].dispose).toHaveBeenCalledTimes(1)
        expect(records.isolates[2].dispose).toHaveBeenCalledTimes(1)
        dateNowSpy.mockRestore()
    })
})

describe('IsolatedVmScriptRuntimeHost', () => {
    it('creates fresh global references for both global aliases', async () => {
        const consumedRefs = new Set<number>()
        let nextRefId = 0

        const loadModule = async () => ({
            Isolate: class {
                async createContext() {
                    return {
                        global: {
                            set: async (_name: string, value: unknown) => {
                                if (
                                    typeof value === 'object' &&
                                    value !== null &&
                                    'refId' in value &&
                                    typeof (value as { refId: unknown }).refId === 'number'
                                ) {
                                    const refId = (value as { refId: number }).refId
                                    if (consumedRefs.has(refId)) {
                                        throw new Error('The return value of derefInto() should only be used once')
                                    }
                                    consumedRefs.add(refId)
                                }
                            },
                            derefInto: () => ({ refId: ++nextRefId })
                        },
                        evalClosure: async () => ({ ok: true })
                    }
                }

                async compileScript(code: string) {
                    new Script(code)
                    return {
                        run: async () => undefined
                    }
                }

                dispose() {}
            },
            Reference: class {
                constructor(_value: unknown) {}

                async apply() {
                    return undefined
                }

                release() {}
            },
            ExternalCopy: class {
                constructor(private readonly value: unknown) {}

                copyInto() {
                    return this.value
                }
            }
        })

        const pool = new IsolatePool(loadModule)
        const host = new IsolatedVmScriptRuntimeHost(pool, new ScriptHealthMonitor(), loadModule)

        await expect(
            host.execute({
                bundle: 'module.exports = class ExampleScript { async run() { return 123 } }',
                methodName: 'run',
                context: {},
                args: []
            })
        ).resolves.toEqual({ ok: true })
    })
})