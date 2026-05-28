import { createHash } from 'crypto'
import type { ModuleLifecyclePayload, ModuleManifest } from '@universo-react/types'

const DEFAULT_MEMORY_LIMIT_MB = 32
const DEFAULT_TIMEOUT_MS = 500
const DEFAULT_MAX_ISOLATES = 16
const DEFAULT_FAILURE_THRESHOLD = 3
const DEFAULT_COOLDOWN_MS = 30_000
const HOST_FUNCTION_MARKER = '__universoHostFunctionPath'
const RESTRICTED_SERVER_GLOBALS = ['eval', 'Function', 'require', 'process', 'Proxy', 'WebAssembly'] as const

export interface ModuleRuntimeExecutionRequest {
    bundle: string
    methodName: string
    args?: unknown[]
    context: Record<string, unknown>
    timeoutMs?: number
}

export interface ModuleRuntimeDispatchRequest {
    bundle: string
    manifest: ModuleManifest
    eventName: string
    payload: ModuleLifecyclePayload
    context: Record<string, unknown>
    timeoutMs?: number
}

export interface ModuleRuntimeHost {
    kind: string
    execute(request: ModuleRuntimeExecutionRequest): Promise<unknown>
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

type IsolatedVmCompiledModule = {
    run(context: IsolatedVmContext, options?: Record<string, unknown>): Promise<unknown>
}

type IsolatedVmIsolate = {
    createContext(): Promise<IsolatedVmContext>
    compileScript(code: string, options?: Record<string, unknown>): Promise<IsolatedVmCompiledModule>
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
    compiled: Promise<IsolatedVmCompiledModule>
    lastUsedAt: number
}

export interface IsolatePoolOptions {
    memoryLimitMb?: number
    maxIsolates?: number
}

export interface ModuleHealthMonitorOptions {
    failureThreshold?: number
    cooldownMs?: number
    now?: () => number
}

export interface ModuleHealthState {
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
                throw new Error(`isolated-vm is required for module execution: ${error instanceof Error ? error.message : String(error)}`)
            })
    }

    return isolatedVmPromise
}

export const assertIsolatedVmRuntimeAvailable = async (): Promise<void> => {
    await loadIsolatedVm()
}

const createModulePoolKey = (bundle: string): string => createHash('sha256').update(bundle).digest('hex')

export class ModuleHealthMonitor {
    private readonly states = new Map<string, ModuleHealthState>()

    constructor(
        private readonly options: Required<ModuleHealthMonitorOptions> = {
            failureThreshold: DEFAULT_FAILURE_THRESHOLD,
            cooldownMs: DEFAULT_COOLDOWN_MS,
            now: () => Date.now()
        }
    ) {}

    assertAvailable(moduleKey: string): void {
        const current = this.states.get(moduleKey)
        if (!current?.cooldownUntil) {
            return
        }

        if (current.cooldownUntil <= this.options.now()) {
            this.states.set(moduleKey, {
                consecutiveFailures: 0,
                cooldownUntil: null,
                lastError: null
            })
            return
        }

        throw new Error(`Module circuit breaker is open until ${new Date(current.cooldownUntil).toISOString()}`)
    }

    recordSuccess(moduleKey: string): void {
        this.states.delete(moduleKey)
    }

    recordFailure(moduleKey: string, error: unknown): void {
        const previous = this.states.get(moduleKey) ?? {
            consecutiveFailures: 0,
            cooldownUntil: null,
            lastError: null
        }
        const nextFailureCount = previous.consecutiveFailures + 1
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (nextFailureCount >= this.options.failureThreshold) {
            this.states.set(moduleKey, {
                consecutiveFailures: 0,
                cooldownUntil: this.options.now() + this.options.cooldownMs,
                lastError: errorMessage
            })
            return
        }

        this.states.set(moduleKey, {
            consecutiveFailures: nextFailureCount,
            cooldownUntil: null,
            lastError: errorMessage
        })
    }

    getState(moduleKey: string): ModuleHealthState {
        return (
            this.states.get(moduleKey) ?? {
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
        return createModulePoolKey(bundle)
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
                filename: `universo-module.${key}.bundle.cjs`
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
        throw new Error('Module execution context must serialize to an object root')
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

const createRuntimePackageRequireSource = () => `
const __universoCloneVector3 = (value) => ({
    x: Number(value?.x ?? 0),
    y: Number(value?.y ?? 0),
    z: Number(value?.z ?? 0)
});

const __universoCreateVector3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
const __universoAddVector3 = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const __universoSubtractVector3 = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const __universoScaleVector3 = (value, scale) => ({ x: value.x * scale, y: value.y * scale, z: value.z * scale });
const __universoVector3Length = (value) => Math.hypot(value.x, value.y, value.z);
const __universoNormalizeVector3 = (value) => {
    const length = __universoVector3Length(value);
    return length > 1e-6 ? __universoScaleVector3(value, 1 / length) : __universoCreateVector3();
};
const __universoDistanceVector3 = (a, b) => __universoVector3Length(__universoSubtractVector3(a, b));
const __universoIsPointInsideAabb = (point, box) =>
    Math.abs(point.x - box.center.x) <= box.halfExtents.x &&
    Math.abs(point.y - box.center.y) <= box.halfExtents.y &&
    Math.abs(point.z - box.center.z) <= box.halfExtents.z;
const __universoSegmentIntersectsAabb = (from, to, box) => {
    let tMin = 0;
    let tMax = 1;
    for (const axis of ['x', 'y', 'z']) {
        const start = from[axis];
        const delta = to[axis] - start;
        const min = box.center[axis] - box.halfExtents[axis];
        const max = box.center[axis] + box.halfExtents[axis];
        if (Math.abs(delta) < 1e-6) {
            if (start < min || start > max) {
                return false;
            }
            continue;
        }
        const inverse = 1 / delta;
        let near = (min - start) * inverse;
        let far = (max - start) * inverse;
        if (near > far) {
            const swap = near;
            near = far;
            far = swap;
        }
        tMin = Math.max(tMin, near);
        tMax = Math.min(tMax, far);
        if (tMin > tMax) {
            return false;
        }
    }
    return true;
};
const __universoMoveSpeedToward = (current, target, maxDelta) =>
    Math.abs(target - current) <= maxDelta ? target : current + Math.sign(target - current) * maxDelta;
const __universoExpandAabb = (box, halfExtents) => ({
    center: __universoCloneVector3(box.center),
    halfExtents: __universoAddVector3(__universoCloneVector3(box.halfExtents), __universoCloneVector3(halfExtents))
});
const __universoIsMovementBlocked = (from, to, guards, controlledHalfExtents) =>
    Array.isArray(guards) &&
    guards.some((guard) => {
        const effectiveGuard = controlledHalfExtents ? __universoExpandAabb(guard, controlledHalfExtents) : guard;
        return __universoSegmentIntersectsAabb(from, to, effectiveGuard) || __universoIsPointInsideAabb(to, effectiveGuard);
    });
const __universoCreateStoppedMovementState = (position) => ({
    position: __universoCloneVector3(position),
    velocity: __universoCreateVector3(),
    target: null,
    speed: 0
});
const __universoApplyMoveToPointIntent = (state, target) => ({
    ...state,
    position: __universoCloneVector3(state.position),
    velocity: __universoCloneVector3(state.velocity),
    target: __universoCloneVector3(target)
});
const __universoApplyStopIntent = (state) => ({
    ...state,
    position: __universoCloneVector3(state.position),
    velocity: __universoCloneVector3(state.velocity),
    target: null
});
const __universoStepFixedTickMovement = (state, deltaSeconds, options) => {
    const safeDelta = Math.max(0, deltaSeconds);
    const currentPosition = __universoCloneVector3(state.position);
    if (!state.target) {
        const nextSpeed = __universoMoveSpeedToward(state.speed, 0, options.deceleration * safeDelta);
        const direction = __universoNormalizeVector3(state.velocity);
        const nextVelocity = __universoScaleVector3(direction, nextSpeed);
        const nextPosition = __universoAddVector3(currentPosition, __universoScaleVector3(nextVelocity, safeDelta));
        const blocked = __universoIsMovementBlocked(currentPosition, nextPosition, options.guards, options.controlledHalfExtents);
        return blocked
            ? { state: { position: currentPosition, velocity: __universoCreateVector3(), target: null, speed: 0 }, arrived: false, blocked: true }
            : { state: { position: nextPosition, velocity: nextVelocity, target: null, speed: nextSpeed }, arrived: false, blocked: false };
    }
    const target = __universoCloneVector3(state.target);
    const remaining = __universoDistanceVector3(currentPosition, target);
    if (remaining <= options.arrivalRadius) {
        return { state: { position: target, velocity: __universoCreateVector3(), target: null, speed: 0 }, arrived: true, blocked: false };
    }
    const direction = __universoNormalizeVector3(__universoSubtractVector3(target, currentPosition));
    const brakingDistance = state.speed > 0 && options.deceleration > 1e-6 ? (state.speed * state.speed) / (2 * options.deceleration) : 0;
    const desiredSpeed = remaining <= Math.max(options.arrivalRadius, brakingDistance) ? 0 : options.cruiseSpeed;
    const rate = desiredSpeed > state.speed ? options.acceleration : options.deceleration;
    const nextSpeed = __universoMoveSpeedToward(state.speed, desiredSpeed, rate * safeDelta);
    const stepDistance = Math.min(remaining, nextSpeed * safeDelta);
    const nextPosition = __universoAddVector3(currentPosition, __universoScaleVector3(direction, stepDistance));
    const blocked = __universoIsMovementBlocked(currentPosition, nextPosition, options.guards, options.controlledHalfExtents);
    if (blocked) {
        return { state: { position: currentPosition, velocity: __universoCreateVector3(), target: null, speed: 0 }, arrived: false, blocked: true };
    }
    const arrived = __universoDistanceVector3(nextPosition, target) <= options.arrivalRadius;
    return {
        state: {
            position: arrived ? target : nextPosition,
            velocity: arrived ? __universoCreateVector3() : __universoScaleVector3(direction, nextSpeed),
            target: arrived ? null : target,
            speed: arrived ? 0 : nextSpeed
        },
        arrived,
        blocked: false
    };
};

const __universoServerModulePackages = Object.freeze({
    '@universo-react/colyseus-server': Object.freeze({
        cloneVector3: __universoCloneVector3,
        createVector3: __universoCreateVector3,
        addVector3: __universoAddVector3,
        subtractVector3: __universoSubtractVector3,
        scaleVector3: __universoScaleVector3,
        vector3Length: __universoVector3Length,
        normalizeVector3: __universoNormalizeVector3,
        distanceVector3: __universoDistanceVector3,
        isPointInsideAabb: __universoIsPointInsideAabb,
        segmentIntersectsAabb: __universoSegmentIntersectsAabb,
        createStoppedMovementState: __universoCreateStoppedMovementState,
        applyMoveToPointIntent: __universoApplyMoveToPointIntent,
        applyStopIntent: __universoApplyStopIntent,
        stepFixedTickMovement: __universoStepFixedTickMovement
    })
});

const require = (packageName) => {
    const moduleExports = __universoServerModulePackages[packageName];
    if (!moduleExports) {
        throw new Error('Server module import "' + packageName + '" is not available in this runtime');
    }
    return moduleExports;
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
        createRuntimePackageRequireSource(),
        bundle,
        'const __resolvedModule = (module.exports && module.exports.default) || module.exports || (exports && exports.default) || exports;',
        "if (typeof __resolvedModule !== 'function') { throw new Error('Compiled module bundle did not export a constructable module class') }",
        'globalThis.__universoModuleClass = __resolvedModule;'
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

    const ModuleClass = globalThis.__universoModuleClass;
    if (typeof ModuleClass !== 'function') {
        throw new Error('Module bundle class is not available in the isolate runtime');
    }

    const instance = new ModuleClass();
    instance.ctx = __hydrateContext(globalThis.__universoContextSnapshot);

    const methodName = globalThis.__universoMethodName;
    const method = instance[methodName];
    if (typeof method !== 'function') {
        throw new Error('Module method "' + methodName + '" was not found');
    }

    return await Promise.resolve(Reflect.apply(method, instance, globalThis.__universoArgs || []));
})();
`

export class IsolatedVmModuleRuntimeHost implements ModuleRuntimeHost {
    readonly kind = 'isolated-vm'

    constructor(
        private readonly isolatePool: IsolatePool = new IsolatePool(),
        private readonly healthMonitor: ModuleHealthMonitor = new ModuleHealthMonitor(),
        private readonly loadModule: () => Promise<IsolatedVmModule> = loadIsolatedVm
    ) {}

    async execute(request: ModuleRuntimeExecutionRequest): Promise<unknown> {
        const ivm = await this.loadModule()
        const moduleKey = this.isolatePool.getKey(request.bundle)
        this.healthMonitor.assertAvailable(moduleKey)
        const { snapshot, hostFunctions } = serializeContext(request.context)
        const pooledEntry = await this.isolatePool.acquire(request.bundle)
        const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
        const hostCallReference = new ivm.Reference(async (path: string, args: unknown[]) => {
            const target = hostFunctions.get(path)
            if (!target) {
                throw new Error(`Module context host bridge '${path}' was not found`)
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
            this.healthMonitor.recordSuccess(moduleKey)
            return result
        } catch (error) {
            this.healthMonitor.recordFailure(moduleKey, error)
            throw error
        } finally {
            releaseReference(hostCallReference)
        }
    }
}

export const createDefaultModuleRuntimeHost = (): ModuleRuntimeHost => new IsolatedVmModuleRuntimeHost()

export class ModuleEngine {
    constructor(private readonly host: ModuleRuntimeHost = createDefaultModuleRuntimeHost()) {}

    async callMethod(request: ModuleRuntimeExecutionRequest): Promise<unknown> {
        return this.host.execute(request)
    }

    async dispatchEvent(request: ModuleRuntimeDispatchRequest): Promise<unknown[]> {
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
