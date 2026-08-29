import { createHash } from 'node:crypto'

/**
 * Pipeline jobs are transport messages, not durable entities. Keep replay
 * state scoped to the ShareDB backend that owns the mutation and bound it by
 * both age and count so an attacker cannot grow process memory with job ids.
 */
export const PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES = 2048
export const PLAYCANVAS_EDITOR_PIPELINE_REPLAY_TTL_MS = 15 * 60 * 1000

export type PipelineReplayResult = { ok: true } | { ok: false; code: string }

type PipelineReplayEntry = {
    fingerprint: string
    inFlight: boolean
    result?: PipelineReplayResult
    expiresAt: number
}

type PipelineReplayScope = object

export type PipelineReplayDecision =
    | { kind: 'process' }
    | { kind: 'inFlight' }
    | { kind: 'completed'; result: PipelineReplayResult }
    | { kind: 'conflict' }
    | { kind: 'capacity' }

const registries = new WeakMap<PipelineReplayScope, Map<string, PipelineReplayEntry>>()

const getRegistry = (scope: PipelineReplayScope): Map<string, PipelineReplayEntry> => {
    let registry = registries.get(scope)
    if (!registry) {
        registry = new Map<string, PipelineReplayEntry>()
        registries.set(scope, registry)
    }
    return registry
}

const pruneExpiredEntries = (registry: Map<string, PipelineReplayEntry>, now: number): void => {
    for (const [jobId, entry] of registry) {
        // Never evict an in-flight job: doing so would permit a concurrent
        // retry to execute the durable mutation a second time.
        if (!entry.inFlight && entry.expiresAt <= now) registry.delete(jobId)
    }
}

const evictCompletedEntry = (registry: Map<string, PipelineReplayEntry>): boolean => {
    for (const [jobId, entry] of registry) {
        if (!entry.inFlight) {
            registry.delete(jobId)
            return true
        }
    }
    return false
}

/**
 * Canonical JSON serialization keeps retries with reordered object keys on
 * the same idempotency key equivalent, while the bounded pipeline schema
 * guarantees there are no cycles or non-JSON values here.
 */
const stableSerialize = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
        .join(',')}}`
}

export const createPipelineReplayFingerprint = (value: unknown): string =>
    createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex')

/**
 * Atomically reserves a job id for one scoped ShareDB backend. The synchronous
 * map operation happens before the first await in the pipeline handler, so
 * concurrent websocket frames cannot both acquire the `process` decision.
 */
export const claimPipelineReplay = (
    scope: PipelineReplayScope,
    jobId: string,
    fingerprint: string,
    now = Date.now()
): PipelineReplayDecision => {
    const registry = getRegistry(scope)
    pruneExpiredEntries(registry, now)
    const existing = registry.get(jobId)
    if (existing) {
        if (existing.fingerprint !== fingerprint) return { kind: 'conflict' }
        if (existing.inFlight) return { kind: 'inFlight' }
        if (existing.result) return { kind: 'completed', result: existing.result }
        // Defensive recovery for an entry that was not completed correctly.
        registry.delete(jobId)
    }

    if (registry.size >= PLAYCANVAS_EDITOR_PIPELINE_REPLAY_MAX_ENTRIES && !evictCompletedEntry(registry)) {
        return { kind: 'capacity' }
    }
    registry.set(jobId, {
        fingerprint,
        inFlight: true,
        expiresAt: now + PLAYCANVAS_EDITOR_PIPELINE_REPLAY_TTL_MS
    })
    return { kind: 'process' }
}

/** Stores both successful and failed terminal results for deterministic retries. */
export const completePipelineReplay = (
    scope: PipelineReplayScope,
    jobId: string,
    fingerprint: string,
    result: PipelineReplayResult,
    now = Date.now()
): boolean => {
    const registry = registries.get(scope)
    const entry = registry?.get(jobId)
    if (!registry || !entry || entry.fingerprint !== fingerprint) return false
    entry.inFlight = false
    entry.result = result
    entry.expiresAt = now + PLAYCANVAS_EDITOR_PIPELINE_REPLAY_TTL_MS
    // Refresh insertion order so the oldest completed entries are evicted
    // first when the bounded registry reaches capacity.
    registry.delete(jobId)
    registry.set(jobId, entry)
    return true
}

/** Clears replay state when a scoped ShareDB backend is closed. */
export const clearPipelineReplayRegistry = (scope: PipelineReplayScope): void => {
    registries.delete(scope)
}

/** Exposed only for bounded-registry tests and diagnostics. */
export const getPipelineReplayRegistrySize = (scope: PipelineReplayScope): number => registries.get(scope)?.size ?? 0
