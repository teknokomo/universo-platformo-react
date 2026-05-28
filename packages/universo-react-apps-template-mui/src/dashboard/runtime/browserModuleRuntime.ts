type ModuleConstructor = new () => {
    ctx?: unknown
    [key: string]: unknown
}

type HostFunction = (...args: unknown[]) => unknown

type HostFunctionMap = Map<string, HostFunction>

const HOST_FUNCTION_MARKER = '__universoHostFunctionPath'

const SHADOWED_CLIENT_RUNTIME_BINDINGS = [
    'globalThis',
    'self',
    'window',
    'document',
    'global',
    'process',
    'Buffer',
    'navigator',
    'location',
    'fetch',
    'Request',
    'Response',
    'Headers',
    'WebSocket',
    'EventSource',
    'XMLHttpRequest',
    'Worker',
    'SharedWorker',
    'BroadcastChannel',
    'MessageChannel',
    'MessagePort',
    'FileReaderSync',
    'importScripts',
    'caches',
    'indexedDB',
    'localStorage',
    'sessionStorage',
    'Function',
    'Proxy',
    'WebAssembly',
    'Blob',
    'URL'
] as const

const RESTRICTED_WORKER_GLOBALS = [
    'self',
    'fetch',
    'Request',
    'Response',
    'Headers',
    'WebSocket',
    'EventSource',
    'XMLHttpRequest',
    'Worker',
    'SharedWorker',
    'BroadcastChannel',
    'MessageChannel',
    'MessagePort',
    'FileReaderSync',
    'importScripts',
    'caches',
    'indexedDB',
    'navigator',
    'location',
    'localStorage',
    'sessionStorage',
    'close',
    'eval',
    'Function',
    'Proxy',
    'WebAssembly',
    'URL',
    'Blob',
    'console'
] as const

const bundleCache = new Map<string, Promise<ModuleConstructor>>()
const WORKER_EXECUTION_TIMEOUT_MS = 15000

const createRestrictedBundlePreludeSource = () => SHADOWED_CLIENT_RUNTIME_BINDINGS.map((name) => `const ${name} = undefined;`).join('\n')

const createRestrictedWorkerEnvironmentSource = () => `
const RESTRICTED_WORKER_GLOBALS = ${JSON.stringify(RESTRICTED_WORKER_GLOBALS)};

const disableGlobal = (name) => {
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

for (const name of RESTRICTED_WORKER_GLOBALS) {
    disableGlobal(name);
}
`

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

const createClientModuleRequireSource = () => `
   const __universoCloneVector3 = (value) => ({
       x: Number(value?.x ?? 0),
       y: Number(value?.y ?? 0),
       z: Number(value?.z ?? 0)
   });
   const __universoLerpNumber = (from, to, alpha) => from + (to - from) * Math.min(1, Math.max(0, alpha));
   const __universoLerpVector3 = (from, to, alpha) => ({
       x: __universoLerpNumber(from.x, to.x, alpha),
       y: __universoLerpNumber(from.y, to.y, alpha),
       z: __universoLerpNumber(from.z, to.z, alpha)
   });
   const __universoResolveFollowCameraPosition = (options) => {
       const distance = Math.min(options.maxDistance, Math.max(options.minDistance, options.distance));
       const pitch = Math.min(Math.PI / 2 - 0.01, Math.max(-Math.PI / 2 + 0.01, options.pitch));
       const horizontal = Math.cos(pitch) * distance;
       return {
           x: options.target.x + Math.sin(options.yaw) * horizontal,
           y: options.target.y + Math.sin(pitch) * distance,
           z: options.target.z + Math.cos(options.yaw) * horizontal
       };
   };

   const __universoClientModulePackages = Object.freeze({
       '@universo-react/colyseus-client': Object.freeze({
           createMoveToPointIntent: (target) => ({
               type: 'move_to_point',
            target: __universoCloneVector3(target)
        }),
           createMoveToObjectIntent: (objectId) => ({
               type: 'move_to_object',
               objectId: String(objectId)
           }),
           createStopIntent: () => ({ type: 'stop' }),
           lerpNumber: __universoLerpNumber,
           lerpVector3: __universoLerpVector3,
           interpolateSnapshotVector3: (previous, next, renderTime, selectVector) => {
               if (!next) {
                   return previous ? selectVector(previous.state) : null;
               }
               if (!previous || previous.receivedAt >= next.receivedAt) {
                   return selectVector(next.state);
               }
               const duration = next.receivedAt - previous.receivedAt;
               const alpha = duration > 0 ? (renderTime - previous.receivedAt) / duration : 1;
               return __universoLerpVector3(selectVector(previous.state), selectVector(next.state), alpha);
           },
           isDoubleClickActivation: (params) =>
               params.lastClickAt !== null && params.currentClickAt - params.lastClickAt <= (params.thresholdMs ?? 350)
       }),
       '@universo-react/playcanvas-engine': Object.freeze({
           resolveFollowCameraPosition: __universoResolveFollowCameraPosition,
           zoomFollowCamera: (distance, delta, minDistance, maxDistance) => Math.min(maxDistance, Math.max(minDistance, distance + delta)),
           rotateFollowCamera: (yaw, pitch, deltaYaw, deltaPitch, minPitch = -Math.PI / 3, maxPitch = Math.PI / 3) => ({
               yaw: yaw + deltaYaw,
               pitch: Math.min(maxPitch, Math.max(minPitch, pitch + deltaPitch))
           }),
           createAabbFromCenterAndSize: (center, size) => ({
               center: __universoCloneVector3(center),
               halfExtents: {
                   x: Number(size?.x ?? 0) / 2,
                y: Number(size?.y ?? 0) / 2,
                z: Number(size?.z ?? 0) / 2
            }
        }),
        isPointInsideAabb: (point, box) => {
            const candidate = __universoCloneVector3(point);
            const center = __universoCloneVector3(box?.center);
            const halfExtents = __universoCloneVector3(box?.halfExtents);
            return (
                Math.abs(candidate.x - center.x) <= halfExtents.x &&
                Math.abs(candidate.y - center.y) <= halfExtents.y &&
                Math.abs(candidate.z - center.z) <= halfExtents.z
            );
        }
    })
});

const require = (packageName) => {
    const moduleExports = __universoClientModulePackages[packageName];
    if (!moduleExports) {
        throw new Error('Client module import "' + packageName + '" is not available in this runtime');
    }
    return moduleExports;
};
`

const WORKER_BUNDLE_RESTRICTED_PRELUDE_SOURCE = JSON.stringify(createRestrictedBundlePreludeSource())
const WORKER_BUNDLE_SILENT_CONSOLE_SOURCE = JSON.stringify(createSilentConsoleSource())
const WORKER_BUNDLE_REQUIRE_SOURCE = JSON.stringify(createClientModuleRequireSource())

const workerSource = `
const HOST_FUNCTION_MARKER = '${HOST_FUNCTION_MARKER}';
const __HOST_SELF = self;
const __HOST_URL = URL;
const __HOST_BLOB = Blob;

const buildBundleModuleSource = (bundle) => [
    ${WORKER_BUNDLE_RESTRICTED_PRELUDE_SOURCE},
    'const module = { exports: {} };',
    'const exports = module.exports;',
    ${WORKER_BUNDLE_SILENT_CONSOLE_SOURCE},
    ${WORKER_BUNDLE_REQUIRE_SOURCE},
    bundle,
    'const __resolvedModule = (module.exports && module.exports.default) || module.exports || (exports && exports.default) || exports;',
    "if (typeof __resolvedModule !== 'function') { throw new Error('Client module bundle did not export a constructable class') }",
    'export default __resolvedModule;'
].join('\\n');

const createBundleModuleUrl = (bundle) => __HOST_URL.createObjectURL(new __HOST_BLOB([buildBundleModuleSource(bundle)], { type: 'text/javascript' }));

const serializeError = (error) => ({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null
});

const pendingHostCalls = new Map();
let hostRequestId = 0;

${createRestrictedWorkerEnvironmentSource()}

const callHost = (path, args) =>
    new Promise((resolve, reject) => {
        const requestId = ++hostRequestId;
        pendingHostCalls.set(requestId, { resolve, reject });
        __HOST_SELF.postMessage({ type: 'invoke', requestId, path, args });
    });

const hydrateContextValue = (value) => {
    if (Array.isArray(value)) {
        return value.map((entry) => hydrateContextValue(entry));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    if (Object.prototype.hasOwnProperty.call(value, HOST_FUNCTION_MARKER)) {
        return async (...args) => await callHost(value[HOST_FUNCTION_MARKER], args);
    }

    const next = {};
    for (const [key, entry] of Object.entries(value)) {
        next[key] = hydrateContextValue(entry);
    }
    return next;
};

__HOST_SELF.onmessage = async (event) => {
    const data = event.data;

    if (data?.type === 'invokeResult' || data?.type === 'invokeError') {
        const pending = pendingHostCalls.get(data.requestId);
        if (!pending) return;
        pendingHostCalls.delete(data.requestId);

        if (data.type === 'invokeResult') {
            pending.resolve(data.result);
        } else {
            const error = new Error(data.error?.message || 'Client module host bridge failed');
            error.name = data.error?.name || 'Error';
            if (data.error?.stack) {
                error.stack = data.error.stack;
            }
            pending.reject(error);
        }
        return;
    }

    if (data?.type !== 'execute') {
        return;
    }

    let moduleUrl = null;

    try {
        moduleUrl = createBundleModuleUrl(data.bundle);
        const imported = await import(moduleUrl);
        const ModuleClass = imported.default;
        if (typeof ModuleClass !== 'function') {
            throw new Error('Client module bundle did not export a constructable class');
        }

        const instance = new ModuleClass();
        instance.ctx = hydrateContextValue(data.snapshot);

        const method = instance[data.methodName];
        if (typeof method !== 'function') {
            throw new Error('Client module method "' + data.methodName + '" was not found');
        }

        const result = await Promise.resolve(Reflect.apply(method, instance, Array.isArray(data.args) ? data.args : []));
        __HOST_SELF.postMessage({ type: 'result', result });
    } catch (error) {
        __HOST_SELF.postMessage({ type: 'error', error: serializeError(error) });
    } finally {
        if (moduleUrl) {
            __HOST_URL.revokeObjectURL(moduleUrl);
        }
    }
};
`

const isBrowserWorkerCapable = (): boolean =>
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Worker === 'function' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'

const isBrowserRuntime = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined'

const buildBundleModuleSource = (bundle: string) =>
    [
        createRestrictedBundlePreludeSource(),
        'const module = { exports: {} };',
        'const exports = module.exports;',
        createSilentConsoleSource(),
        createClientModuleRequireSource(),
        bundle,
        'const __resolvedModule = (module.exports && module.exports.default) || module.exports || (exports && exports.default) || exports;',
        "if (typeof __resolvedModule !== 'function') { throw new Error('Client module bundle did not export a constructable class') }",
        'export default __resolvedModule;'
    ].join('\n')

const isBlobUrl = (value: string): boolean => value.startsWith('blob:')

const getBuffer = (): { from(input: string, encoding?: string): { toString(encoding: string): string } } | null => {
    const candidate = (globalThis as { Buffer?: { from(input: string, encoding?: string): { toString(encoding: string): string } } }).Buffer

    return candidate && typeof candidate.from === 'function' ? candidate : null
}

const createModuleUrl = (source: string): string => {
    const buffer = getBuffer()
    const isNodeLikeRuntime = typeof process !== 'undefined' && Boolean((process as { versions?: { node?: string } }).versions?.node)
    const shouldPreferBlobUrl = !isNodeLikeRuntime && typeof window !== 'undefined' && typeof document !== 'undefined'

    if (shouldPreferBlobUrl && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    }

    if (buffer) {
        return `data:text/javascript;base64,${buffer.from(source, 'utf8').toString('base64')}`
    }

    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    }

    throw new Error('No client module module loader is available in this environment')
}

const revokeModuleUrl = (moduleUrl: string) => {
    if (isBlobUrl(moduleUrl) && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(moduleUrl)
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
        throw new Error('Client module execution context must serialize to an object root')
    }

    return {
        snapshot: snapshot as Record<string, unknown>,
        hostFunctions
    }
}

const hydrateContextValue = (value: unknown, hostFunctions: HostFunctionMap): unknown => {
    if (Array.isArray(value)) {
        return value.map((entry) => hydrateContextValue(entry, hostFunctions))
    }

    if (!value || typeof value !== 'object') {
        return value
    }

    if (Object.prototype.hasOwnProperty.call(value, HOST_FUNCTION_MARKER)) {
        const hostFunctionPath = (value as Record<string, unknown>)[HOST_FUNCTION_MARKER]
        if (typeof hostFunctionPath !== 'string') {
            throw new Error('Client module host bridge path is invalid')
        }

        return async (...args: unknown[]) => {
            const target = hostFunctions.get(hostFunctionPath)
            if (!target) {
                throw new Error(`Client module host bridge "${hostFunctionPath}" was not found`)
            }

            return await Promise.resolve(target(...args))
        }
    }

    const result: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
        result[key] = hydrateContextValue(entry, hostFunctions)
    }
    return result
}

const serializeError = (error: unknown): { name: string; message: string; stack: string | null } => ({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null
})

const deserializeError = (payload: { name?: string; message?: string; stack?: string | null } | null | undefined): Error => {
    const error = new Error(payload?.message || 'Client module execution failed')
    error.name = payload?.name || 'Error'
    if (payload?.stack) {
        error.stack = payload.stack
    }
    return error
}

const resolveModuleConstructor = async (bundle: string): Promise<ModuleConstructor> => {
    const cached = bundleCache.get(bundle)
    if (cached) {
        return await cached
    }

    const loading = (async () => {
        const moduleUrl = createModuleUrl(buildBundleModuleSource(bundle))

        try {
            const imported = await import(/* @vite-ignore */ moduleUrl)
            const ModuleClass = imported.default

            if (typeof ModuleClass !== 'function') {
                throw new Error('Client module bundle did not export a constructable class')
            }

            return ModuleClass as ModuleConstructor
        } finally {
            revokeModuleUrl(moduleUrl)
        }
    })()

    bundleCache.set(bundle, loading)

    try {
        return await loading
    } catch (error) {
        bundleCache.delete(bundle)
        throw error
    }
}

const executeClientModuleMethodInWorker = async (params: {
    bundle: string
    methodName: string
    args: unknown[]
    snapshot: Record<string, unknown>
    hostFunctions: HostFunctionMap
}): Promise<unknown> => {
    const workerUrl = createModuleUrl(workerSource)
    let worker: Worker

    try {
        worker = new Worker(workerUrl, { type: 'module' })
    } catch (error) {
        revokeModuleUrl(workerUrl)
        throw error
    }

    return await new Promise((resolve, reject) => {
        let completed = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const armTimeout = () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
            }

            timeoutId = setTimeout(() => {
                console.error('[browserModuleRuntime] Worker execution timed out')
                finishReject(new Error(`Client module worker execution timed out after ${WORKER_EXECUTION_TIMEOUT_MS}ms`))
            }, WORKER_EXECUTION_TIMEOUT_MS)
        }

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId)
                timeoutId = null
            }

            if (completed) {
                return
            }

            completed = true
            worker.terminate()
            revokeModuleUrl(workerUrl)
        }

        const finishResolve = (value: unknown) => {
            cleanup()
            resolve(value)
        }

        const finishReject = (error: unknown) => {
            cleanup()
            reject(error)
        }

        worker.onmessage = (event: MessageEvent) => {
            const data = event.data as
                | { type: 'invoke'; requestId: number; path: string; args?: unknown[] }
                | { type: 'result'; result: unknown }
                | { type: 'error'; error?: { name?: string; message?: string; stack?: string | null } }

            if (!data || typeof data !== 'object') {
                return
            }

            armTimeout()

            if (data.type === 'invoke') {
                void (async () => {
                    const target = params.hostFunctions.get(data.path)
                    if (!target) {
                        worker.postMessage({
                            type: 'invokeError',
                            requestId: data.requestId,
                            error: serializeError(new Error(`Client module host bridge "${data.path}" was not found`))
                        })
                        return
                    }

                    try {
                        const result = await Promise.resolve(target(...(Array.isArray(data.args) ? data.args : [])))
                        worker.postMessage({ type: 'invokeResult', requestId: data.requestId, result })
                    } catch (error) {
                        worker.postMessage({ type: 'invokeError', requestId: data.requestId, error: serializeError(error) })
                    }
                })()
                return
            }

            if (data.type === 'result') {
                finishResolve(data.result)
                return
            }

            console.error('[browserModuleRuntime] Worker execution failed', data.error)
            finishReject(deserializeError(data.error))
        }

        worker.onerror = (event: ErrorEvent) => {
            console.error('[browserModuleRuntime] Worker runtime error', event.message)
            finishReject(new Error(event.message || 'Client module worker execution failed'))
        }

        armTimeout()
        worker.postMessage({
            type: 'execute',
            bundle: params.bundle,
            methodName: params.methodName,
            args: params.args,
            snapshot: params.snapshot
        })
    })
}

export const executeClientModuleMethod = async (params: {
    bundle: string
    methodName: string
    args?: unknown[]
    context: Record<string, unknown>
}): Promise<unknown> => {
    const { snapshot, hostFunctions } = serializeContext(params.context)

    if (isBrowserWorkerCapable()) {
        return await executeClientModuleMethodInWorker({
            bundle: params.bundle,
            methodName: params.methodName,
            args: params.args ?? [],
            snapshot,
            hostFunctions
        })
    }

    if (isBrowserRuntime()) {
        throw new Error('Client module execution requires a Worker-capable browser runtime')
    }

    const ModuleClass = await resolveModuleConstructor(params.bundle)
    const instance = new ModuleClass()
    instance.ctx = hydrateContextValue(snapshot, hostFunctions)

    const method = instance[params.methodName]
    if (typeof method !== 'function') {
        throw new Error(`Client module method "${params.methodName}" was not found`)
    }

    return await Promise.resolve(Reflect.apply(method as (...args: unknown[]) => unknown, instance, params.args ?? []))
}

export const __browserModuleRuntimeTestUtils = {
    workerSource,
    requireSource: createClientModuleRequireSource(),
    restrictedWorkerGlobals: [...RESTRICTED_WORKER_GLOBALS],
    workerExecutionTimeoutMs: WORKER_EXECUTION_TIMEOUT_MS
}
