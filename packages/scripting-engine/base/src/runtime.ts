import { createHash } from 'crypto'
import type { ScriptLifecyclePayload, ScriptManifest } from '@universo/types'

const DEFAULT_MEMORY_LIMIT_MB = 32
const DEFAULT_TIMEOUT_MS = 500
const DEFAULT_MAX_ISOLATES = 16
const DEFAULT_FAILURE_THRESHOLD = 3
const DEFAULT_COOLDOWN_MS = 30_000
const HOST_FUNCTION_MARKER = '__universoHostFunctionPath'
const RESTRICTED_SERVER_GLOBALS = ['eval', 'Function', 'require', 'process', 'Proxy', 'WebAssembly'] as const

export interface ScriptRuntimeExecutionRequest {
    bundle: string
    methodName: string
    args?: unknown[]
    context: Record<string, unknown>
    timeoutMs?: number
}

export interface ScriptRuntimeDispatchRequest {
    bundle: string
    manifest: ScriptManifest
    eventName: string
    payload: ScriptLifecyclePayload
    context: Record<string, unknown>
    timeoutMs?: number
}

export interface ScriptRuntimeHost {
    kind: string
    execute(request: ScriptRuntimeExecutionRequest): Promise<unknown>
}

type HostFunction = (...args: unknown[]) => unknown

type HostFunctionMap = Map<string, HostFunction>

type IsolatedVmReference<T = unknown> = {
    apply(receiver: unknown, argumentsList?: unknown[], options?: Record<string, unknown>): Promise<T>
    release?: () => void
}

type IsolatedVmContext = {
    global: {
        set(name: string, value: unknown): Promise<void>
        derefInto?: () => unknown
    }
    evalClosure<T = unknown>(code: string, args?: unknown[], options?: Record<string, unknown>): Promise<T>
}

type IsolatedVmCompiledScript = {
    run(context: IsolatedVmContext, options?: Record<string, unknown>): Promise<unknown>
}

type IsolatedVmIsolate = {
    createContext(): Promise<IsolatedVmContext>
    compileScript(code: string, options?: Record<string, unknown>): Promise<IsolatedVmCompiledScript>
    dispose(): void
}

type IsolatedVmModule = {
    Isolate: new (options: { memoryLimit: number }) => IsolatedVmIsolate
    Reference: new <T>(value: T) => IsolatedVmReference<T>
    ExternalCopy: new <T>(value: T) => { copyInto(): T }
}

type PooledIsolateEntry = {
    key: string
    isolate: IsolatedVmIsolate
    compiled: Promise<IsolatedVmCompiledScript>
    lastUsedAt: number
}

export interface IsolatePoolOptions {
    memoryLimitMb?: number
    maxIsolates?: number
}

export interface ScriptHealthMonitorOptions {
    failureThreshold?: number
    cooldownMs?: number
    now?: () => number
}

export interface ScriptHealthState {
    consecutiveFailures: number
    cooldownUntil: number | null
    lastError: string | null
}

let isolatedVmPromise: Promise<IsolatedVmModule> | null = null

const loadIsolatedVm = async (): Promise<IsolatedVmModule> => {
    if (!isolatedVmPromise) {
        isolatedVmPromise = import('isolated-vm')
            .then((mod) => (mod as { default?: IsolatedVmModule }).default ?? (mod as unknown as IsolatedVmModule))
            .catch((error) => {
                isolatedVmPromise = null
                throw new Error(`isolated-vm is required for script execution: ${error instanceof Error ? error.message : String(error)}`)
            })
    }

    return isolatedVmPromise
}

export const assertIsolatedVmRuntimeAvailable = async (): Promise<void> => {
    await loadIsolatedVm()
}

const createScriptPoolKey = (bundle: string): string => createHash('sha256').update(bundle).digest('hex')

export class ScriptHealthMonitor {
    private readonly states = new Map<string, ScriptHealthState>()

    constructor(
        private readonly options: Required<ScriptHealthMonitorOptions> = {
            failureThreshold: DEFAULT_FAILURE_THRESHOLD,
            cooldownMs: DEFAULT_COOLDOWN_MS,
            now: () => Date.now()
        }
    ) {}

    assertAvailable(scriptKey: string): void {
        const current = this.states.get(scriptKey)
        if (!current?.cooldownUntil) {
            return
        }

        if (current.cooldownUntil <= this.options.now()) {
            this.states.set(scriptKey, {
                consecutiveFailures: 0,
                cooldownUntil: null,
                lastError: null
            })
            return
        }

        throw new Error(`Script circuit breaker is open until ${new Date(current.cooldownUntil).toISOString()}`)
    }

    recordSuccess(scriptKey: string): void {
        this.states.delete(scriptKey)
    }

    recordFailure(scriptKey: string, error: unknown): void {
        const previous = this.states.get(scriptKey) ?? {
            consecutiveFailures: 0,
            cooldownUntil: null,
            lastError: null
        }
        const nextFailureCount = previous.consecutiveFailures + 1
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (nextFailureCount >= this.options.failureThreshold) {
            this.states.set(scriptKey, {
                consecutiveFailures: 0,
                cooldownUntil: this.options.now() + this.options.cooldownMs,
                lastError: errorMessage
            })
            return
        }

        this.states.set(scriptKey, {
            consecutiveFailures: nextFailureCount,
            cooldownUntil: null,
            lastError: errorMessage
        })
    }

    getState(scriptKey: string): ScriptHealthState {
        return (
            this.states.get(scriptKey) ?? {
                consecutiveFailures: 0,
                cooldownUntil: null,
                lastError: null
            }
        )
    }
}

export class IsolatePool {
    private readonly entries = new Map<string, PooledIsolateEntry>()

    constructor(
        private readonly loadModule: () => Promise<IsolatedVmModule> = loadIsolatedVm,
        private readonly options: Required<IsolatePoolOptions> = {
            memoryLimitMb: DEFAULT_MEMORY_LIMIT_MB,
            maxIsolates: DEFAULT_MAX_ISOLATES
        }
    ) {}

    getKey(bundle: string): string {
        return createScriptPoolKey(bundle)
    }

    async acquire(bundle: string): Promise<PooledIsolateEntry> {
        const key = this.getKey(bundle)
        const existing = this.entries.get(key)
        if (existing) {
            existing.lastUsedAt = Date.now()
            return existing
        }

        if (this.entries.size >= this.options.maxIsolates) {
            this.evictLeastRecentlyUsed()
        }

        const ivm = await this.loadModule()
        const isolate = new ivm.Isolate({ memoryLimit: this.options.memoryLimitMb })
        const entry: PooledIsolateEntry = {
            key,
            isolate,
            compiled: isolate.compileScript(buildBootstrapSource(bundle), {
                filename: `universo-script.${key}.bundle.cjs`
            }),
            lastUsedAt: Date.now()
        }

        this.entries.set(key, entry)

        try {
            await entry.compiled
            return entry
        } catch (error) {
            this.entries.delete(key)
            isolate.dispose()
            throw error
        }
    }

    disposeAll(): void {
        for (const entry of this.entries.values()) {
            entry.isolate.dispose()
        }

        this.entries.clear()
    }

    private evictLeastRecentlyUsed(): void {
        let oldestEntry: PooledIsolateEntry | null = null

        for (const entry of this.entries.values()) {
            if (!oldestEntry || entry.lastUsedAt < oldestEntry.lastUsedAt) {
                oldestEntry = entry
            }
        }

        if (!oldestEntry) {
            return
        }

        this.entries.delete(oldestEntry.key)
        oldestEntry.isolate.dispose()
    }
}

const serializeContextValue = (value: unknown, path: string[], hostFunctions: HostFunctionMap): unknown => {
    if (typeof value === 'function') {
        const hostFunctionPath = path.join('.')
        hostFunctions.set(hostFunctionPath, value as HostFunction)
        return { [HOST_FUNCTION_MARKER]: hostFunctionPath }
    }

    if (Array.isArray(value)) {
        return value.map((entry, index) => serializeContextValue(entry, [...path, String(index)], hostFunctions))
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = {}
        for (const [key, entry] of Object.entries(value)) {
            result[key] = serializeContextValue(entry, [...path, key], hostFunctions)
        }
        return result
    }

    if (typeof value === 'bigint') {
        return value.toString()
    }

    return value
}

const serializeContext = (context: Record<string, unknown>): { snapshot: Record<string, unknown>; hostFunctions: HostFunctionMap } => {
    const hostFunctions: HostFunctionMap = new Map()
    const snapshot = serializeContextValue(context, [], hostFunctions)

    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
        throw new Error('Script execution context must serialize to an object root')
    }

    return {
        snapshot: snapshot as Record<string, unknown>,
        hostFunctions
    }
}

const releaseReference = (reference: { release?: () => void } | null | undefined) => {
    if (reference && typeof reference.release === 'function') {
        reference.release()
    }
}

const createSilentConsoleSource = () => `
const console = {
    assert() {},
    clear() {},
    count() {},
    countReset() {},
    debug() {},
    dir() {},
    dirxml() {},
    error() {},
    group() {},
    groupCollapsed() {},
    groupEnd() {},
    info() {},
    log() {},
    table() {},
    time() {},
    timeEnd() {},
    timeLog() {},
    trace() {},
    warn() {}
};
`

const createRestrictedServerGlobalSource = () => `
const __disableGlobal = (name) => {
    try {
        Object.defineProperty(globalThis, name, {
            configurable: true,
            writable: false,
            value: undefined
        });
        return;
    } catch (_error) {}

    try {
        globalThis[name] = undefined;
    } catch (_error) {}
};

for (const name of ${JSON.stringify(RESTRICTED_SERVER_GLOBALS)}) {
    __disableGlobal(name);
}
`

const buildBootstrapSource = (bundle: string) =>
    [
        `'use strict';`,
        createRestrictedServerGlobalSource(),
        'const module = { exports: {} };',
        'const exports = module.exports;',
        createSilentConsoleSource(),
        bundle,
        'const __resolvedScript = (module.exports && module.exports.default) || module.exports || (exports && exports.default) || exports;',
        "if (typeof __resolvedScript !== 'function') { throw new Error('Compiled script bundle did not export a constructable script class') }",
        'globalThis.__universoScriptClass = __resolvedScript;'
    ].join('\n')

const EXECUTION_SOURCE = `
return (async () => {
    const __invokeHost = globalThis.__universoInvokeHost;
    const __createBridgeFunction = (path) => {
        return async (...args) => {
            return await __invokeHost.apply(
                undefined,
                [path, args],
                {
                    arguments: { copy: true },
                    result: { copy: true, promise: true }
                }
            );
        };
    };

    const __hydrateContext = (value) => {
        if (Array.isArray(value)) {
            return value.map((entry) => __hydrateContext(entry));
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        if (Object.prototype.hasOwnProperty.call(value, '${HOST_FUNCTION_MARKER}')) {
            return __createBridgeFunction(value['${HOST_FUNCTION_MARKER}']);
        }

        const next = {};
        for (const [key, entry] of Object.entries(value)) {
            next[key] = __hydrateContext(entry);
        }
        return next;
    };

    const ScriptClass = globalThis.__universoScriptClass;
    if (typeof ScriptClass !== 'function') {
        throw new Error('Script bundle class is not available in the isolate runtime');
    }

    const instance = new ScriptClass();
    instance.ctx = __hydrateContext(globalThis.__universoContextSnapshot);

    const methodName = globalThis.__universoMethodName;
    const method = instance[methodName];
    if (typeof method !== 'function') {
        throw new Error('Script method "' + methodName + '" was not found');
    }

    return await Promise.resolve(Reflect.apply(method, instance, globalThis.__universoArgs || []));
})();
`

export class IsolatedVmScriptRuntimeHost implements ScriptRuntimeHost {
    readonly kind = 'isolated-vm'

    constructor(
        private readonly isolatePool: IsolatePool = new IsolatePool(),
        private readonly healthMonitor: ScriptHealthMonitor = new ScriptHealthMonitor(),
        private readonly loadModule: () => Promise<IsolatedVmModule> = loadIsolatedVm
    ) {}

    async execute(request: ScriptRuntimeExecutionRequest): Promise<unknown> {
        const ivm = await this.loadModule()
        const scriptKey = this.isolatePool.getKey(request.bundle)
        this.healthMonitor.assertAvailable(scriptKey)
        const { snapshot, hostFunctions } = serializeContext(request.context)
        const pooledEntry = await this.isolatePool.acquire(request.bundle)
        const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
        const hostCallReference = new ivm.Reference(async (path: string, args: unknown[]) => {
            const target = hostFunctions.get(path)
            if (!target) {
                throw new Error(`Script context host bridge '${path}' was not found`)
            }

            return await Promise.resolve(target(...(Array.isArray(args) ? args : [])))
        })

        try {
            const context = await pooledEntry.isolate.createContext()
            const jail = context.global
            if (typeof jail.derefInto === 'function') {
                await jail.set('global', jail.derefInto())
                await jail.set('globalThis', jail.derefInto())
            }

            await jail.set('__universoContextSnapshot', new ivm.ExternalCopy(snapshot).copyInto())
            await jail.set('__universoMethodName', request.methodName)
            await jail.set('__universoArgs', new ivm.ExternalCopy(request.args ?? []).copyInto())
            await jail.set('__universoInvokeHost', hostCallReference)

            const compiled = await pooledEntry.compiled
            await compiled.run(context, { timeout: timeoutMs })

            const result = await context.evalClosure(EXECUTION_SOURCE, [], {
                timeout: timeoutMs,
                result: { copy: true, promise: true }
            })
            this.healthMonitor.recordSuccess(scriptKey)
            return result
        } catch (error) {
            this.healthMonitor.recordFailure(scriptKey, error)
            throw error
        } finally {
            releaseReference(hostCallReference)
        }
    }
}

export const createDefaultScriptRuntimeHost = (): ScriptRuntimeHost => new IsolatedVmScriptRuntimeHost()

export class ScriptEngine {
    constructor(private readonly host: ScriptRuntimeHost = createDefaultScriptRuntimeHost()) {}

    async callMethod(request: ScriptRuntimeExecutionRequest): Promise<unknown> {
        return this.host.execute(request)
    }

    async dispatchEvent(request: ScriptRuntimeDispatchRequest): Promise<unknown[]> {
        const handlers = request.manifest.methods.filter((method) => method.eventName === request.eventName && method.target === 'server')
        const results: unknown[] = []

        for (const handler of handlers) {
            results.push(
                await this.host.execute({
                    bundle: request.bundle,
                    methodName: handler.name,
                    args: [request.payload],
                    context: request.context,
                    timeoutMs: request.timeoutMs
                })
            )
        }

        return results
    }
}
