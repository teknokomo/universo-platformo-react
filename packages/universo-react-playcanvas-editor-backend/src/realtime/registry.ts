import ShareDB from 'sharedb'
import { z } from 'zod'
import type { WebSocket } from 'ws'
import type { PlayCanvasEditorCompatibilityTokenClaims } from '@universo-react/types'
import { PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID, parseCanonicalPlayCanvasEditorDocumentId } from '../tokens/index.js'
import { createPlayCanvasEditorNumericIds } from '../config/index.js'
import { MAX_REALTIME_MESSAGE_BYTES, closeUnauthorized, closePolicyViolation, isSocketOpen } from './index.js'
import type {
    PlayCanvasEditorRealtimeAssetDocument,
    PlayCanvasEditorRealtimeRuntimeDeps,
    RealtimeCollection,
    ShareDbDocumentMetadata
} from './index.js'

export const shareDbPersistedMetadata = new WeakMap<ShareDB, Map<string, ShareDbDocumentMetadata>>()
export const shareDbPersistQueues = new WeakMap<ShareDB, Map<string, Promise<void>>>()
export const shareDbSeedQueues = new WeakMap<ShareDB, Map<string, Promise<void>>>()
export const shareDbSeedWriteKeys = new WeakMap<ShareDB, Set<string>>()
export const shareDbAllowedDocumentKeys = new WeakMap<ShareDB, Set<string>>()
const shareDbDocumentSubmitLocks = new WeakMap<ShareDB, Map<string, Promise<void>>>()
const shareDbDurableCommitVersions = new WeakMap<ShareDB, Map<string, number>>()
const shareDbPersistenceBlockedDocuments = new WeakMap<ShareDB, Set<string>>()
const shareDbPersistenceRecoveryKeys = new WeakMap<ShareDB, Set<string>>()

export const getShareDbPersistedMetadata = (backend: ShareDB): Map<string, ShareDbDocumentMetadata> => {
    let metadata = shareDbPersistedMetadata.get(backend)
    if (!metadata) {
        metadata = new Map()
        shareDbPersistedMetadata.set(backend, metadata)
    }
    return metadata
}

export const getShareDbPersistQueues = (backend: ShareDB): Map<string, Promise<void>> => {
    let queues = shareDbPersistQueues.get(backend)
    if (!queues) {
        queues = new Map()
        shareDbPersistQueues.set(backend, queues)
    }
    return queues
}

const getShareDbDocumentSubmitLocks = (backend: ShareDB): Map<string, Promise<void>> => {
    let locks = shareDbDocumentSubmitLocks.get(backend)
    if (!locks) {
        locks = new Map()
        shareDbDocumentSubmitLocks.set(backend, locks)
    }
    return locks
}

export const getShareDbDurableCommitVersions = (backend: ShareDB): Map<string, number> => {
    let versions = shareDbDurableCommitVersions.get(backend)
    if (!versions) {
        versions = new Map()
        shareDbDurableCommitVersions.set(backend, versions)
    }
    return versions
}

export const getShareDbPersistenceBlockedDocuments = (backend: ShareDB): Set<string> => {
    let blocked = shareDbPersistenceBlockedDocuments.get(backend)
    if (!blocked) {
        blocked = new Set()
        shareDbPersistenceBlockedDocuments.set(backend, blocked)
    }
    return blocked
}

export const getShareDbPersistenceRecoveryKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbPersistenceRecoveryKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbPersistenceRecoveryKeys.set(backend, keys)
    }
    return keys
}

export const acquireShareDbDocumentSubmitLock = async (backend: ShareDB, key: string): Promise<() => void> => {
    const locks = getShareDbDocumentSubmitLocks(backend)
    const previous = locks.get(key) ?? Promise.resolve()
    let releaseCurrent!: () => void
    const current = new Promise<void>((resolve) => {
        releaseCurrent = resolve
    })
    const tail = previous.then(() => current)
    locks.set(key, tail)
    await previous
    let released = false
    return () => {
        if (released) return
        released = true
        releaseCurrent()
        if (locks.get(key) === tail) locks.delete(key)
    }
}

export const getShareDbSeedQueues = (backend: ShareDB): Map<string, Promise<void>> => {
    let queues = shareDbSeedQueues.get(backend)
    if (!queues) {
        queues = new Map()
        shareDbSeedQueues.set(backend, queues)
    }
    return queues
}

export const getShareDbSeedWriteKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbSeedWriteKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbSeedWriteKeys.set(backend, keys)
    }
    return keys
}

export const getShareDbAllowedDocumentKeys = (backend: ShareDB): Set<string> => {
    let keys = shareDbAllowedDocumentKeys.get(backend)
    if (!keys) {
        keys = new Set()
        shareDbAllowedDocumentKeys.set(backend, keys)
    }
    return keys
}

export const createAllowedShareDbDocumentKeys = (claims: PlayCanvasEditorCompatibilityTokenClaims): Set<string> => {
    const numericIds = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    })
    return new Set([
        `scenes:${numericIds.sceneId}`,
        `settings:${numericIds.settingsId}`,
        `settings:user_${numericIds.selfId}`,
        `settings:project_${numericIds.projectId}_${numericIds.selfId}`,
        `settings:project-private_${numericIds.projectId}`,
        `user_data:${numericIds.sceneId}_${numericIds.selfId}`,
        ...(claims.assetDocumentIds ?? []).map((id) => `assets:${id}`)
    ])
}

export const addAllowedShareDbDocumentKeys = (backend: ShareDB, claims: PlayCanvasEditorCompatibilityTokenClaims): void => {
    const keys = getShareDbAllowedDocumentKeys(backend)
    for (const key of createAllowedShareDbDocumentKeys(claims)) {
        keys.add(key)
    }
}

export const isAllowedShareDbDocument = (backend: ShareDB, collection: unknown, documentId: unknown): collection is RealtimeCollection =>
    typeof collection === 'string' &&
    typeof documentId === 'string' &&
    getShareDbAllowedDocumentKeys(backend).has(`${collection}:${documentId}`)

type RealtimeAssetDocumentSeeder = (documentIds: readonly number[]) => Promise<void>

type RealtimeAssetDocumentRegistry = {
    grants: Map<string, Set<number>>
    generations: Map<string, Map<number, number>>
    /** Tombstones deny stale token claims until the id is explicitly re-granted. */
    revoked: Map<string, Set<number>>
    revokedAt: Map<string, Map<number, number>>
    seeders: Map<string, Set<RealtimeAssetDocumentSeeder>>
}

/**
 * Asset document ids granted AFTER a scoped backend was created (editor "+"
 * creates assets while sockets are already authenticated, so their ids cannot be
 * part of the minted token claims). Keyed by `metahubId:projectId`; every scoped
 * backend for that project consults the registry on top of its token-derived
 * allow-list. Grants are additive and process-local — reconnecting sockets get
 * the same coverage through refreshed token claims.
 *
 * The package publishes both CommonJS and ESM entry points. During mixed-mode
 * development or a rolling worker reload those entry points can be evaluated in
 * one Node process, so keep the short-lived registry on `globalThis` rather than
 * in a module singleton. This prevents a POST handled by one entry point from
 * being rejected by a subsequent GET or realtime seed handled by the other.
 */
const realtimeAssetDocumentRegistryGlobalKey = '__universoPlayCanvasEditorRealtimeAssetDocumentRegistry'

const getRealtimeAssetDocumentRegistry = (): RealtimeAssetDocumentRegistry => {
    const globalScope = globalThis as typeof globalThis & {
        [realtimeAssetDocumentRegistryGlobalKey]?: RealtimeAssetDocumentRegistry
    }
    const existing = globalScope[realtimeAssetDocumentRegistryGlobalKey]
    if (existing) {
        // A development process can evaluate the CJS and ESM entry points in
        // different orders while hot-reloading. Upgrade an older registry in
        // place so its grants survive without making generation checks fail
        // open.
        existing.generations ??= new Map<string, Map<number, number>>()
        existing.revoked ??= new Map<string, Set<number>>()
        existing.revokedAt ??= new Map<string, Map<number, number>>()
        return existing
    }
    const registry: RealtimeAssetDocumentRegistry = {
        grants: new Map<string, Set<number>>(),
        generations: new Map<string, Map<number, number>>(),
        revoked: new Map<string, Set<number>>(),
        revokedAt: new Map<string, Map<number, number>>(),
        seeders: new Map<string, Set<RealtimeAssetDocumentSeeder>>()
    }
    Object.defineProperty(globalScope, realtimeAssetDocumentRegistryGlobalKey, {
        value: registry,
        enumerable: false,
        configurable: false,
        writable: false
    })
    return registry
}

const realtimeAssetDocumentRegistry = getRealtimeAssetDocumentRegistry()
const dynamicAssetDocumentGrants = realtimeAssetDocumentRegistry.grants
const dynamicAssetDocumentGenerations = realtimeAssetDocumentRegistry.generations
const revokedAssetDocumentIds = realtimeAssetDocumentRegistry.revoked
const revokedAssetDocumentTimestamps = realtimeAssetDocumentRegistry.revokedAt
const dynamicAssetDocumentSeeders = realtimeAssetDocumentRegistry.seeders

export const REALTIME_ASSET_DOCUMENT_TOMBSTONE_TTL_MS = 15 * 60 * 1000
export const MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE = 10_000

const pruneRealtimeAssetDocumentRegistry = (now = Date.now()): void => {
    const cutoff = now - REALTIME_ASSET_DOCUMENT_TOMBSTONE_TTL_MS
    for (const [scopeKey, revoked] of revokedAssetDocumentIds) {
        const timestamps = revokedAssetDocumentTimestamps.get(scopeKey)
        for (const documentId of [...revoked]) {
            const revokedAt = timestamps?.get(documentId) ?? 0
            if (revokedAt > cutoff) continue
            revoked.delete(documentId)
            timestamps?.delete(documentId)
            const generations = dynamicAssetDocumentGenerations.get(scopeKey)
            if (!dynamicAssetDocumentGrants.get(scopeKey)?.has(documentId)) generations?.delete(documentId)
        }
        if (revoked.size > MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE) {
            const oldest = [...revoked]
                .sort((left, right) => (timestamps?.get(left) ?? 0) - (timestamps?.get(right) ?? 0))
                .slice(0, revoked.size - MAX_REALTIME_ASSET_DOCUMENT_TOMBSTONES_PER_SCOPE)
            for (const documentId of oldest) {
                revoked.delete(documentId)
                timestamps?.delete(documentId)
                const generations = dynamicAssetDocumentGenerations.get(scopeKey)
                if (!dynamicAssetDocumentGrants.get(scopeKey)?.has(documentId)) generations?.delete(documentId)
            }
        }
        if (revoked.size === 0) {
            revokedAssetDocumentIds.delete(scopeKey)
            revokedAssetDocumentTimestamps.delete(scopeKey)
        }
    }
    for (const [scopeKey, generations] of dynamicAssetDocumentGenerations) {
        if (generations.size === 0 && !dynamicAssetDocumentGrants.has(scopeKey) && !revokedAssetDocumentIds.has(scopeKey)) {
            dynamicAssetDocumentGenerations.delete(scopeKey)
        }
    }
}

export const realtimeProjectScopeKey = (metahubId: string, projectId: string): string => `${metahubId}:${projectId}`

export const registerRealtimeAssetDocumentSeeder = (
    metahubId: string,
    projectId: string,
    seeder: RealtimeAssetDocumentSeeder
): (() => void) => {
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    let seeders = dynamicAssetDocumentSeeders.get(scopeKey)
    if (!seeders) {
        seeders = new Set<RealtimeAssetDocumentSeeder>()
        dynamicAssetDocumentSeeders.set(scopeKey, seeders)
    }
    seeders.add(seeder)
    return () => {
        const registered = dynamicAssetDocumentSeeders.get(scopeKey)
        if (!registered) return
        registered.delete(seeder)
        if (registered.size === 0) dynamicAssetDocumentSeeders.delete(scopeKey)
    }
}

export const getGrantedRealtimeAssetDocumentIds = (metahubId: string, projectId: string): number[] => (
    pruneRealtimeAssetDocumentRegistry(), Array.from(dynamicAssetDocumentGrants.get(realtimeProjectScopeKey(metahubId, projectId)) ?? [])
)

export type RealtimeAssetDocumentGrantVersions = ReadonlyMap<number, number>

export interface RealtimeAssetDocumentGrantOptions {
    /**
     * Confirms that ids still exist in durable storage before publishing a
     * grant. This closes the create/delete race where an old delete completes
     * after an id has been allocated again.
     */
    validateDocumentIds?: (documentIds: readonly number[]) => Promise<readonly number[]>
}

/**
 * Captures the generation observed before an asynchronous delete starts. A
 * later create increments that generation, so the completion of the stale
 * delete cannot revoke the newly-created document with the same numeric id.
 * An empty id list snapshots every currently granted id, which is needed for
 * folder deletes whose concrete descendants are only known after storage
 * finishes the delete transaction.
 */
export const captureRealtimeAssetDocumentGrantVersions = (
    metahubId: string,
    projectId: string,
    documentIds: readonly number[] = []
): RealtimeAssetDocumentGrantVersions => {
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    const generations = dynamicAssetDocumentGenerations.get(scopeKey)
    const ids = documentIds.length > 0 ? documentIds : getGrantedRealtimeAssetDocumentIds(metahubId, projectId)
    const captured = new Map<number, number>()
    for (const rawDocumentId of ids) {
        const documentId = parseCanonicalPlayCanvasEditorDocumentId(rawDocumentId)
        if (documentId === null || captured.has(documentId)) continue
        captured.set(documentId, generations?.get(documentId) ?? 0)
    }
    return captured
}

export const grantRealtimeAssetDocuments = async (
    metahubId: string,
    projectId: string,
    documentIds: readonly number[],
    options: RealtimeAssetDocumentGrantOptions = {}
): Promise<number[]> => {
    pruneRealtimeAssetDocumentRegistry()
    const normalizedDocumentIds = Array.from(
        new Set(
            documentIds
                .map((documentId) => parseCanonicalPlayCanvasEditorDocumentId(documentId))
                .filter((documentId): documentId is number => documentId !== null)
        )
    )
    let confirmedDocumentIds = normalizedDocumentIds
    if (options.validateDocumentIds) {
        try {
            confirmedDocumentIds = Array.from(
                new Set(
                    (await options.validateDocumentIds(normalizedDocumentIds))
                        .map((documentId) => parseCanonicalPlayCanvasEditorDocumentId(documentId))
                        .filter((documentId): documentId is number => documentId !== null)
                )
            )
        } catch {
            return []
        }
    }
    if (confirmedDocumentIds.length === 0) return []
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    let grants = dynamicAssetDocumentGrants.get(scopeKey)
    if (!grants) {
        grants = new Set<number>()
        dynamicAssetDocumentGrants.set(scopeKey, grants)
    }
    let generations = dynamicAssetDocumentGenerations.get(scopeKey)
    if (!generations) {
        generations = new Map<number, number>()
        dynamicAssetDocumentGenerations.set(scopeKey, generations)
    }
    let revoked = revokedAssetDocumentIds.get(scopeKey)
    let revokedAt = revokedAssetDocumentTimestamps.get(scopeKey)
    const newlyGrantedDocumentIds: number[] = []
    for (const parsedDocumentId of confirmedDocumentIds) {
        const wasGranted = grants.has(parsedDocumentId)
        const wasRevoked = revoked?.has(parsedDocumentId) === true
        if (!wasGranted || wasRevoked) {
            generations.set(parsedDocumentId, (generations.get(parsedDocumentId) ?? 0) + 1)
        }
        if (!wasGranted || wasRevoked) {
            newlyGrantedDocumentIds.push(parsedDocumentId)
        }
        grants.add(parsedDocumentId)
        revoked?.delete(parsedDocumentId)
        revokedAt?.delete(parsedDocumentId)
    }
    if (revoked?.size === 0) revokedAssetDocumentIds.delete(scopeKey)
    if (revokedAt?.size === 0) revokedAssetDocumentTimestamps.delete(scopeKey)

    const seeders = Array.from(dynamicAssetDocumentSeeders.get(scopeKey) ?? [])
    if (confirmedDocumentIds.length === 0 || seeders.length === 0) return newlyGrantedDocumentIds
    await Promise.all(
        seeders.map((seeder) =>
            Promise.resolve()
                .then(() => seeder(confirmedDocumentIds))
                .catch(() => {
                    // The asset remains available through the compatibility REST API;
                    // a reconnect will retry ShareDB seeding from the durable grant.
                })
        )
    )
    return newlyGrantedDocumentIds
}

/**
 * Removes deleted asset ids from the process-local allow-list. When grant
 * versions are supplied, only the generation captured before the delete may be
 * revoked; a concurrent recreate is left granted and keeps its newer seed.
 */
export const revokeRealtimeAssetDocuments = (
    metahubId: string,
    projectId: string,
    documentIds: readonly number[],
    expectedVersions?: RealtimeAssetDocumentGrantVersions
): number[] => {
    pruneRealtimeAssetDocumentRegistry()
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    const grants = dynamicAssetDocumentGrants.get(scopeKey)
    let revoked = revokedAssetDocumentIds.get(scopeKey)
    let revokedAt = revokedAssetDocumentTimestamps.get(scopeKey)
    let generations = dynamicAssetDocumentGenerations.get(scopeKey)
    if (!generations) {
        generations = new Map<number, number>()
        dynamicAssetDocumentGenerations.set(scopeKey, generations)
    }
    const revokedDocumentIds: number[] = []
    for (const documentId of documentIds) {
        const parsedDocumentId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
        if (parsedDocumentId === null) continue
        const currentGeneration = generations.get(parsedDocumentId) ?? 0
        const expectedGeneration = expectedVersions?.get(parsedDocumentId) ?? 0
        if (expectedVersions && currentGeneration !== expectedGeneration) continue
        const wasGranted = grants?.has(parsedDocumentId) === true
        const wasRevoked = revoked?.has(parsedDocumentId) === true
        if (!wasGranted && wasRevoked) continue
        grants?.delete(parsedDocumentId)
        // Keep a tombstone generation even after the grant set becomes empty.
        // This prevents a delayed delete from matching the initial generation
        // after a delete -> recreate sequence.
        generations.set(parsedDocumentId, currentGeneration + 1)
        if (!revoked) {
            revoked = new Set<number>()
            revokedAssetDocumentIds.set(scopeKey, revoked)
        }
        if (!revokedAt) {
            revokedAt = new Map<number, number>()
            revokedAssetDocumentTimestamps.set(scopeKey, revokedAt)
        }
        revoked.add(parsedDocumentId)
        revokedAt.set(parsedDocumentId, Date.now())
        revokedDocumentIds.push(parsedDocumentId)
    }
    if (grants?.size === 0) dynamicAssetDocumentGrants.delete(scopeKey)
    return revokedDocumentIds
}

/** Backwards-compatible name used by the editor asset creation seam. */
export const extendRealtimeAssetAllowList = grantRealtimeAssetDocuments

export const isDynamicallyGrantedAssetDocument = (
    metahubId: string,
    projectId: string,
    collection: unknown,
    documentId: unknown
): boolean => {
    pruneRealtimeAssetDocumentRegistry()
    if (collection !== 'assets') return false
    const numericId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
    if (numericId === null) return false
    if (revokedAssetDocumentIds.get(realtimeProjectScopeKey(metahubId, projectId))?.has(numericId)) return false
    return dynamicAssetDocumentGrants.get(realtimeProjectScopeKey(metahubId, projectId))?.has(numericId) ?? false
}

export const isRealtimeAssetDocumentRevoked = (metahubId: string, projectId: string, documentId: unknown): boolean => {
    pruneRealtimeAssetDocumentRegistry()
    const numericId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
    return numericId !== null && revokedAssetDocumentIds.get(realtimeProjectScopeKey(metahubId, projectId))?.has(numericId) === true
}

const isStaticClaimedAssetDocument = (claims: PlayCanvasEditorCompatibilityTokenClaims, documentId: unknown): boolean => {
    const numericId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
    return numericId !== null && (claims.assetDocumentIds ?? []).includes(numericId)
}

export const isClaimedOrGrantedAssetDocument = (claims: PlayCanvasEditorCompatibilityTokenClaims, documentId: unknown): boolean => {
    const numericId = parseCanonicalPlayCanvasEditorDocumentId(documentId)
    if (numericId === null) return false
    // Tombstones always win over the token's static allow-list. Otherwise a
    // token minted before deletion could keep operating on a stale document
    // (or on a numeric id that was accidentally reused) until it expired.
    if (isRealtimeAssetDocumentRevoked(claims.metahubId, claims.projectId, numericId)) {
        return false
    }
    return (
        isStaticClaimedAssetDocument(claims, numericId) ||
        isDynamicallyGrantedAssetDocument(claims.metahubId, claims.projectId, 'assets', numericId)
    )
}

const isBoundedPipelineJsonValue = (value: unknown): boolean => {
    const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
    let nodes = 0
    while (pending.length > 0) {
        const current = pending.pop()
        if (!current) continue
        nodes += 1
        if (nodes > 5_000 || current.depth > 24) return false
        if (current.value === null || typeof current.value === 'boolean') continue
        if (typeof current.value === 'string') {
            if (current.value.length > 4_096) return false
            continue
        }
        if (typeof current.value === 'number') {
            if (!Number.isFinite(current.value)) return false
            continue
        }
        if (Array.isArray(current.value)) {
            if (current.value.length > 512) return false
            for (const item of current.value) pending.push({ value: item, depth: current.depth + 1 })
            continue
        }
        if (typeof current.value !== 'object') return false
        const objectValue = current.value as Record<string, unknown>
        const prototype = Object.getPrototypeOf(objectValue)
        if (prototype !== Object.prototype && prototype !== null) return false
        const entries = Object.entries(objectValue)
        if (entries.length > 128) return false
        for (const [key, child] of entries) {
            if (key.length > 128 || key === '__proto__' || key === 'constructor' || key === 'prototype') {
                return false
            }
            pending.push({ value: child, depth: current.depth + 1 })
        }
    }
    return true
}

/** A Zod boundary plus an iterative bound check avoids recursive parser DoS. */
const boundedPipelineJsonValueSchema = z.unknown().superRefine((value, context) => {
    if (!isBoundedPipelineJsonValue(value)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Pipeline JSON value exceeds safety limits' })
    }
})

const canonicalDocumentIdInputSchema = z.union([
    z.number().int().positive().max(PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID),
    z
        .string()
        .regex(/^[1-9][0-9]{0,9}$/)
        .refine((value) => parseCanonicalPlayCanvasEditorDocumentId(value) !== null)
])

const reconciliationAssetDocumentIdSchema = z
    .union([
        z.number().int().positive().max(PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID),
        z
            .string()
            .regex(/^[1-9][0-9]{0,9}$/)
            .refine((value) => parseCanonicalPlayCanvasEditorDocumentId(value) !== null)
    ])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))

const realtimeAssetDocumentDescriptorSchema = z
    .object({
        id: reconciliationAssetDocumentIdSchema,
        branchId: reconciliationAssetDocumentIdSchema.optional(),
        source: z.boolean().optional(),
        status: z.string().max(64).optional(),
        type: z.string().min(1).max(64).optional(),
        sourceAssetId: z.union([z.string().max(160), reconciliationAssetDocumentIdSchema]).optional(),
        createdAt: z.string().max(128).nullable().optional()
    })
    .strict()

export const MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS = 10_000
export const PLAYCANVAS_EDITOR_REALTIME_ASSET_RECONCILIATION_INTERVAL_MS = 5_000

export type RealtimeAssetDocumentDiff = {
    added: number[]
    removed: number[]
}

/** Returns a deterministic set diff used by each authenticated scope poll. */
export const diffRealtimeAssetDocumentIds = (
    previous: ReadonlySet<number> | readonly number[],
    current: ReadonlySet<number> | readonly number[]
): RealtimeAssetDocumentDiff => {
    const previousSet = previous instanceof Set ? previous : new Set(previous)
    const currentSet = current instanceof Set ? current : new Set(current)
    return {
        added: [...currentSet].filter((documentId) => !previousSet.has(documentId)).sort((a, b) => a - b),
        removed: [...previousSet].filter((documentId) => !currentSet.has(documentId)).sort((a, b) => a - b)
    }
}

const normalizeRealtimeAssetDocuments = (value: unknown, fallbackBranchId: number): Map<number, PlayCanvasEditorRealtimeAssetDocument> => {
    if (!Array.isArray(value) || value.length > MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS) {
        throw new Error('Realtime asset reconciliation response exceeds safety limits')
    }
    const documents = new Map<number, PlayCanvasEditorRealtimeAssetDocument>()
    for (const item of value) {
        const parsed = realtimeAssetDocumentDescriptorSchema.safeParse(item)
        if (!parsed.success) {
            throw new Error('Realtime asset reconciliation response is invalid')
        }
        const { id, branchId, source, status, type, sourceAssetId, createdAt } = parsed.data
        if (documents.has(id)) {
            throw new Error('Realtime asset reconciliation response contains duplicate ids')
        }
        documents.set(id, {
            id,
            branchId: branchId ?? fallbackBranchId,
            source: source ?? false,
            status: status ?? 'complete',
            type: type ?? 'other',
            sourceAssetId: sourceAssetId === undefined ? '0' : String(sourceAssetId),
            createdAt: createdAt ?? null
        })
    }
    return documents
}

export const readRealtimeAssetDocuments = async (
    deps: PlayCanvasEditorRealtimeRuntimeDeps,
    claims: PlayCanvasEditorCompatibilityTokenClaims
): Promise<Map<number, PlayCanvasEditorRealtimeAssetDocument>> => {
    const fallbackBranchId = createPlayCanvasEditorNumericIds({
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    }).sceneId
    const input = {
        metahubId: claims.metahubId,
        projectId: claims.projectId,
        sceneId: claims.sceneId ?? claims.projectId,
        userId: claims.userId
    }
    if (deps.documentPort.listAssetDocuments) {
        return normalizeRealtimeAssetDocuments(await deps.documentPort.listAssetDocuments(input), fallbackBranchId)
    }
    if (deps.documentPort.listAssetDocumentIds) {
        const rawIds = await deps.documentPort.listAssetDocumentIds(input)
        if (!Array.isArray(rawIds) || rawIds.length > MAX_REALTIME_ASSET_RECONCILIATION_DOCUMENTS) {
            throw new Error('Realtime asset reconciliation id response exceeds safety limits')
        }
        return normalizeRealtimeAssetDocuments(
            rawIds.map((id) => ({
                id,
                branchId: fallbackBranchId,
                source: false,
                status: 'complete',
                type: 'other',
                sourceAssetId: '0',
                createdAt: null
            })),
            fallbackBranchId
        )
    }
    return new Map()
}

export const pipelineFrameSchema = z
    .object({
        name: z.string().max(64).optional(),
        data: z
            .object({
                script_task_type: z.literal('handle_parsed_script'),
                job_id: z
                    .string()
                    .min(1)
                    .max(128)
                    .regex(/^[A-Za-z0-9_-]+$/),
                project_id: z.union([z.string().min(1).max(160), z.number().int().positive()]).optional(),
                branch_id: z.union([z.string().min(1).max(160), z.number().int().positive()]).optional(),
                asset_id: canonicalDocumentIdInputSchema,
                parse_result: z
                    .object({
                        scripts: z.record(z.string().max(128), boundedPipelineJsonValueSchema).superRefine((scripts, context) => {
                            if (Object.keys(scripts).length > 128) {
                                context.addIssue({ code: z.ZodIssueCode.too_big, maximum: 128, type: 'object', inclusive: true })
                            }
                        }),
                        scriptsInvalid: boundedPipelineJsonValueSchema.optional(),
                        loading: z.boolean().optional()
                    })
                    .strict()
            })
            .strict()
    })
    .strict()

export const messengerAuthenticateMessageSchema = z
    .object({
        name: z.literal('authenticate'),
        token: z.string().min(1).max(16_384),
        type: z.string().max(64).optional()
    })
    .strict()

export const messengerProjectWatchMessageSchema = z
    .object({
        name: z.literal('project.watch'),
        target: z.object({ type: z.string().min(1).max(64) }).strict(),
        env: z.array(z.string().max(64)).max(16),
        data: z
            .object({
                // The upstream messenger sends the numeric PlayCanvas project
                // id, while compatibility callers may retain the UUID/string
                // form. Keep both bounded at the transport boundary.
                id: z.union([z.string().min(1).max(160), z.number().int().positive().max(PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID)])
            })
            .strict()
    })
    .strict()

export const relayRoomMessageSchema = z
    .object({
        t: z.enum(['room:join', 'room:leave']),
        name: z.string().min(1).max(160),
        authentication: boundedPipelineJsonValueSchema.optional()
    })
    .strict()

/**
 * Returns whether an asset document created after full-boot token issuance is
 * allowed to be read through the compatibility REST surface. This mirrors the
 * dynamic ShareDB allow-list used by authenticated realtime sockets.
 */
export const isRealtimeAssetDocumentGranted = (metahubId: string, projectId: string, documentId: unknown): boolean =>
    isDynamicallyGrantedAssetDocument(metahubId, projectId, 'assets', documentId)

type RealtimeSocketRegistration = {
    socket: WebSocket
    claims: PlayCanvasEditorCompatibilityTokenClaims
}

/**
 * Realtime sockets are kept by project scope so a revoked session can be
 * terminated as soon as the authorization check fails. Asset revocation does
 * not close the whole socket: the per-document allow-list and tombstone checks
 * below reject any stale read or write, while the authenticated editor remains
 * usable for unrelated assets and can process the asset.delete messenger
 * event. Closing the project-wide socket here would turn an ordinary asset
 * deletion into a misleading connection error for every open editor tab.
 */
export const realtimeSocketsByScope = new Map<string, Set<RealtimeSocketRegistration>>()

export const unregisterRealtimeSocket = (socket: WebSocket): void => {
    for (const [scopeKey, registrations] of realtimeSocketsByScope) {
        for (const registration of registrations) {
            if (registration.socket === socket) registrations.delete(registration)
        }
        if (registrations.size === 0) realtimeSocketsByScope.delete(scopeKey)
    }
}

export const registerRealtimeSocket = (claims: PlayCanvasEditorCompatibilityTokenClaims, socket: WebSocket): void => {
    const scopeKey = realtimeProjectScopeKey(claims.metahubId, claims.projectId)
    let sockets = realtimeSocketsByScope.get(scopeKey)
    if (!sockets) {
        sockets = new Set<RealtimeSocketRegistration>()
        realtimeSocketsByScope.set(scopeKey, sockets)
    }
    const registration = { socket, claims }
    sockets.add(registration)
    socket.once('close', () => unregisterRealtimeSocket(socket))
}

export const closeRealtimeSocketsForClaims = (claims: PlayCanvasEditorCompatibilityTokenClaims): void => {
    const sockets = realtimeSocketsByScope.get(realtimeProjectScopeKey(claims.metahubId, claims.projectId))
    if (!sockets) return
    for (const registration of [...sockets]) {
        if (registration.claims.userId !== claims.userId || (registration.claims.sceneId ?? '') !== (claims.sceneId ?? '')) {
            continue
        }
        closeUnauthorized(registration.socket, 'playcanvasEditor.fullBoot.accessDenied')
    }
}

/**
 * Authenticated editor messenger sockets by project scope. The editor learns
 * about assets created elsewhere (or by REST routes) exclusively through
 * messenger pushes (`asset.new` / `asset.delete` / `scriptAttrsFinished:<job>`),
 * so routes need a way to broadcast JSON frames to these sockets.
 */
type MessengerSocketRegistration = {
    socket: WebSocket
    claims: PlayCanvasEditorCompatibilityTokenClaims
    revalidate: () => Promise<boolean>
}

export const messengerSocketsByScope = new Map<string, Set<MessengerSocketRegistration>>()
type PendingMessengerEvent = {
    frame: string
    /** Sockets that were present when the event was queued. */
    targets: Set<MessengerSocketRegistration> | null
    delivered: boolean
}

export const pendingMessengerEventsByScope = new Map<string, PendingMessengerEvent[]>()
const messengerFlushesByScope = new Map<string, Promise<void>>()
const maxPendingMessengerEventsPerScope = 64

export const unregisterMessengerSocket = (socket: WebSocket): void => {
    for (const [scopeKey, registrations] of messengerSocketsByScope) {
        for (const registration of registrations) {
            if (registration.socket !== socket) continue
            registrations.delete(registration)
            for (const pending of pendingMessengerEventsByScope.get(scopeKey) ?? []) {
                pending.targets?.delete(registration)
                if (pending.targets?.size === 0 && !pending.delivered) {
                    // No authenticated socket remains for this event. Keep it
                    // pending so the next authenticated socket receives it.
                    pending.targets = null
                }
            }
        }
        if (registrations.size === 0) messengerSocketsByScope.delete(scopeKey)
    }
}

const queuePendingMessengerEvent = (scopeKey: string, frame: string): void => {
    const pending = pendingMessengerEventsByScope.get(scopeKey) ?? []
    const sockets = messengerSocketsByScope.get(scopeKey)
    pending.push({
        frame,
        targets: sockets && sockets.size > 0 ? new Set(sockets) : null,
        delivered: false
    })
    if (pending.length > maxPendingMessengerEventsPerScope) {
        // Dropping an arbitrary prefix can silently leave the Editor with an
        // incomplete asset tree (for example, an `asset.new` without the
        // corresponding delete). Fail closed instead: force every current
        // messenger client through a fresh full-boot/list reconciliation, and
        // discard the queue so a reconnect cannot consume an inconsistent
        // partial history.
        pendingMessengerEventsByScope.delete(scopeKey)
        for (const registration of sockets ?? []) {
            closePolicyViolation(registration.socket, 'playcanvasEditor.fullBoot.messengerResyncRequired')
        }
        return
    }
    pendingMessengerEventsByScope.set(scopeKey, pending)
}

const flushPendingMessengerEvents = async (scopeKey: string): Promise<void> => {
    const pending = pendingMessengerEventsByScope.get(scopeKey)
    if (!pending || pending.length === 0) return

    for (const event of [...pending]) {
        if (!event.targets) {
            const sockets = messengerSocketsByScope.get(scopeKey)
            if (!sockets || sockets.size === 0) continue
            event.targets = new Set(sockets)
        }

        for (const registration of Array.from(event.targets)) {
            if (!isSocketOpen(registration.socket)) {
                event.targets.delete(registration)
                continue
            }
            let allowed = false
            try {
                allowed = await registration.revalidate()
            } catch {
                closeUnauthorized(registration.socket, 'playcanvasEditor.fullBoot.accessDenied')
            }
            if (!allowed || !isSocketOpen(registration.socket)) {
                event.targets.delete(registration)
                continue
            }
            try {
                registration.socket.send(event.frame)
                event.delivered = true
                event.targets.delete(registration)
            } catch {
                closeUnauthorized(registration.socket, 'playcanvasEditor.fullBoot.accessDenied')
                event.targets.delete(registration)
            }
        }

        if (event.targets.size === 0) {
            if (event.delivered) {
                continue
            } else {
                // Every current socket was revoked or closed before delivery;
                // retain the event for the next authenticated socket.
                event.targets = null
            }
        }
    }
    const remaining = pending.filter((event) => !(event.targets && event.targets.size === 0 && event.delivered))
    if (remaining.length === 0) {
        pendingMessengerEventsByScope.delete(scopeKey)
    } else {
        pendingMessengerEventsByScope.set(scopeKey, remaining)
    }
}

const scheduleMessengerFlush = (scopeKey: string): void => {
    const previous = messengerFlushesByScope.get(scopeKey) ?? Promise.resolve()
    const current = previous
        .catch(() => undefined)
        .then(() => flushPendingMessengerEvents(scopeKey))
        .finally(() => {
            if (messengerFlushesByScope.get(scopeKey) === current) {
                messengerFlushesByScope.delete(scopeKey)
            }
        })
    messengerFlushesByScope.set(scopeKey, current)
    void current.catch(() => {
        // Individual socket failures are handled by the flush. Keep the queue
        // available for a later authenticated socket if the pass itself fails.
    })
}

export const registerMessengerSocket = (
    claims: PlayCanvasEditorCompatibilityTokenClaims,
    socket: WebSocket,
    revalidate: () => Promise<boolean>
): MessengerSocketRegistration => {
    const { metahubId, projectId } = claims
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    let sockets = messengerSocketsByScope.get(scopeKey)
    if (!sockets) {
        sockets = new Set<MessengerSocketRegistration>()
        messengerSocketsByScope.set(scopeKey, sockets)
    }
    const registration = { socket, claims, revalidate }
    sockets.add(registration)
    socket.once('close', () => unregisterMessengerSocket(socket))
    return registration
}

export const sendMessengerEvent = (metahubId: string, projectId: string, name: string, data: unknown): void => {
    const scopeKey = realtimeProjectScopeKey(metahubId, projectId)
    if (!/^[A-Za-z0-9_.:-]{1,160}$/.test(name)) return
    let frame: string
    try {
        frame = JSON.stringify({ name, data })
    } catch {
        return
    }
    if (Buffer.byteLength(frame, 'utf8') > MAX_REALTIME_MESSAGE_BYTES) return
    // Queue before asynchronous claim revalidation. A serialized per-scope
    // flush delivers the frame to every socket that was present at enqueue time,
    // removes it only after a successful send, and retains it when all current
    // sockets have been revoked or closed.
    queuePendingMessengerEvent(scopeKey, frame)
    scheduleMessengerFlush(scopeKey)
}

export const sendPendingMessengerEvents = (scopeKey: string): void => scheduleMessengerFlush(scopeKey)
