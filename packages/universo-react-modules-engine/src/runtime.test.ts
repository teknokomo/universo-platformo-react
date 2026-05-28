import { Script, createContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { IsolatePool, IsolatedVmModuleRuntimeHost, ModuleHealthMonitor } from './runtime'

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
            constructor(_value: unknown) {
                // Test double keeps the same constructor surface as isolated-vm.Reference.
            }

            async apply() {
                return undefined
            }

            release() {
                // Test double does not retain native resources.
            }
        },
        ExternalCopy: class {
            constructor(private readonly value: unknown) {}

            copyInto() {
                return this.value
            }
        }
    }
}

const createNodeVmIsolatedVmModule = () => ({
    Isolate: class {
        async createContext() {
            const sandbox = createContext({})

            return {
                global: {
                    set: async (name: string, value: unknown) => {
                        ;(sandbox as Record<string, unknown>)[name] = value
                    },
                    derefInto: () => sandbox
                },
                evalClosure: async (code: string) => {
                    const script = new Script(`(async () => {${code}})()`)

                    return await script.runInContext(sandbox)
                }
            }
        }

        async compileScript(code: string) {
            const script = new Script(code)

            return {
                run: async (context: { global: { derefInto?: () => unknown } }) => {
                    const sandbox = context.global.derefInto?.()
                    if (!sandbox) {
                        throw new Error('Missing node:vm sandbox')
                    }

                    script.runInContext(sandbox as ReturnType<typeof createContext>)
                }
            }
        }

        dispose() {
            // Test double does not retain native resources.
        }
    },
    Reference: class {
        constructor(private readonly value: unknown) {}

        async apply(_receiver: unknown, argumentsList?: unknown[]) {
            if (typeof this.value !== 'function') {
                return undefined
            }

            return await this.value(...(argumentsList ?? []))
        }

        release() {
            // Test double does not retain native resources.
        }
    },
    ExternalCopy: class {
        constructor(private readonly value: unknown) {}

        copyInto() {
            return this.value
        }
    }
})

describe('ModuleHealthMonitor', () => {
    it('opens the circuit breaker after repeated failures and resets after cooldown', () => {
        let now = 1000
        const monitor = new ModuleHealthMonitor({
            failureThreshold: 2,
            cooldownMs: 500,
            now: () => now
        })

        monitor.recordFailure('module-a', new Error('boom-1'))
        expect(monitor.getState('module-a')).toEqual({
            consecutiveFailures: 1,
            cooldownUntil: null,
            lastError: 'boom-1'
        })

        monitor.recordFailure('module-a', new Error('boom-2'))
        expect(() => monitor.assertAvailable('module-a')).toThrow('Module circuit breaker is open until')

        now = 1600
        expect(() => monitor.assertAvailable('module-a')).not.toThrow()
        expect(monitor.getState('module-a')).toEqual({
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

describe('IsolatedVmModuleRuntimeHost', () => {
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

                dispose() {
                    // Test double does not retain native resources.
                }
            },
            Reference: class {
                constructor(_value: unknown) {
                    // Test double keeps the same constructor surface as isolated-vm.Reference.
                }

                async apply() {
                    return undefined
                }

                release() {
                    // Test double does not retain native resources.
                }
            },
            ExternalCopy: class {
                constructor(private readonly value: unknown) {}

                copyInto() {
                    return this.value
                }
            }
        })

        const pool = new IsolatePool(loadModule)
        const host = new IsolatedVmModuleRuntimeHost(pool, new ModuleHealthMonitor(), loadModule)

        await expect(
            host.execute({
                bundle: 'module.exports = class ExampleModule { async run() { return 123 } }',
                methodName: 'run',
                context: {},
                args: []
            })
        ).resolves.toEqual({ ok: true })
    })

    it('keeps server package movement guards aligned with controlled body extents', async () => {
        const loadModule = async () => createNodeVmIsolatedVmModule()
        const pool = new IsolatePool(loadModule)
        const host = new IsolatedVmModuleRuntimeHost(pool, new ModuleHealthMonitor(), loadModule)

        await expect(
            host.execute({
                bundle: `
                    module.exports = class MovementModule {
                        run() {
                            const {
                                applyMoveToPointIntent,
                                createStoppedMovementState,
                                stepFixedTickMovement
                            } = require('@universo-react/colyseus-server');
                            const initial = applyMoveToPointIntent(createStoppedMovementState({ x: 0, y: 0, z: 0 }), { x: 5, y: 0, z: 0 });

                            return stepFixedTickMovement(initial, 1, {
                                cruiseSpeed: 5,
                                acceleration: 5,
                                deceleration: 5,
                                arrivalRadius: 0.1,
                                guards: [{ center: { x: 8, y: 0, z: 0 }, halfExtents: { x: 1, y: 1, z: 1 } }],
                                controlledHalfExtents: { x: 2, y: 0.5, z: 0.5 }
                            });
                        }
                    };
                `,
                methodName: 'run',
                context: {},
                args: []
            })
        ).resolves.toMatchObject({
            blocked: true,
            state: {
                position: { x: 0, y: 0, z: 0 },
                speed: 0
            }
        })
    })
})
