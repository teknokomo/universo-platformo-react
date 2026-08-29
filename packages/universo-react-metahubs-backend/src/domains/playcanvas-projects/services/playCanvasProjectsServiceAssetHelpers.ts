import type { PlayCanvasAsset, PlayCanvasEditorCompatibilitySettingsDocument } from '@universo-react/types'
import {
    PLAYCANVAS_ASSET_TYPES,
    PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS,
    playCanvasProjectMetadataSchema,
    playCanvasProjectParsedAttributesSchema,
    playCanvasProjectPayloadSchema,
    playCanvasProjectSettingsSchema
} from '@universo-react/types'
import {
    createPlayCanvasEditorNumericAssetId,
    deriveUniqueNumericIds,
    parseCanonicalPlayCanvasEditorDocumentId
} from '@universo-react/playcanvas-editor-backend'
import stableStringify from 'json-stable-stringify'
import { MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'

import { asRecord } from './playCanvasProjectsServiceSceneHelpers'

export type CompatibilitySettingsKind = PlayCanvasEditorCompatibilitySettingsDocument['kind']

export const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []

export const isPlayCanvasAssetType = (value: unknown): value is PlayCanvasAsset['type'] =>
    (PLAYCANVAS_ASSET_TYPES as readonly string[]).includes(String(value))

export const assertEditorAssetName = (value: unknown): string => {
    if (typeof value !== 'string') {
        throw new MetahubValidationError('PlayCanvas Editor asset name is required', {
            messageCode: 'playcanvas.editorCompatibility.assetNameInvalid'
        })
    }
    const name = value.trim()
    if (!name || name.length > 255 || name.startsWith('.') || name.includes('/') || name.includes('\\') || name.includes('\0')) {
        throw new MetahubValidationError('PlayCanvas Editor asset name contains unsupported path segments', {
            messageCode: 'playcanvas.editorCompatibility.assetNameInvalid'
        })
    }
    return name
}

export const EDITOR_DOCUMENT_ID_METADATA_KEY = 'editorDocumentId'

export const assertPlayCanvasAssetMetadata = (value: unknown): Record<string, unknown> => {
    const parsed = playCanvasProjectMetadataSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('PlayCanvas asset metadata is not supported', {
            messageCode: 'playcanvas.editorCompatibility.assetMetadataInvalid',
            issues: parsed.error.issues.slice(0, 8).map((issue) => issue.message)
        })
    }
    const reservedKeys = PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS.filter((key) => Object.prototype.hasOwnProperty.call(parsed.data, key))
    if (reservedKeys.length > 0) {
        throw new MetahubValidationError('PlayCanvas asset lifecycle metadata is reserved', {
            messageCode: 'playcanvas.editorCompatibility.assetLifecycleMetadataReserved',
            keys: reservedKeys
        })
    }
    return parsed.data as Record<string, unknown>
}

export const stripPlayCanvasAssetLifecycleMetadata = (value: unknown): Record<string, unknown> => {
    const metadata = { ...asRecord(value) }
    for (const key of PLAYCANVAS_ASSET_LIFECYCLE_METADATA_KEYS) {
        delete metadata[key]
    }
    return metadata
}

export const assertPlayCanvasProjectSettings = (value: unknown): Record<string, unknown> => {
    const parsed = playCanvasProjectSettingsSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('PlayCanvas project settings are not supported', {
            messageCode: 'playcanvas.project.settingsInvalid',
            issues: parsed.error.issues.slice(0, 8).map((issue) => issue.message)
        })
    }
    return parsed.data as Record<string, unknown>
}

export const assertPlayCanvasParsedAttributes = (value: unknown): Record<string, unknown> => {
    const parsed = playCanvasProjectParsedAttributesSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('PlayCanvas parsed script attributes are not supported', {
            messageCode: 'playcanvas.scriptAssets.parsedAttributesInvalid',
            issues: parsed.error.issues.slice(0, 8).map((issue) => issue.message)
        })
    }
    return parsed.data as Record<string, unknown>
}

export const assertPlayCanvasProjectPayload = (value: unknown): Record<string, unknown> => {
    const parsed = playCanvasProjectPayloadSchema.safeParse(value)
    if (!parsed.success) {
        throw new MetahubValidationError('PlayCanvas project payload is not supported', {
            messageCode: 'playcanvas.scene.payloadInvalid',
            issues: parsed.error.issues.slice(0, 8).map((issue) => issue.message)
        })
    }
    return parsed.data as Record<string, unknown>
}

export const readStoredPlayCanvasEditorAssetDocumentId = (asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset): number | null => {
    const value = asRecord(asset.metadata)[EDITOR_DOCUMENT_ID_METADATA_KEY]
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null
}

/**
 * Editor-authored folder assets derive their numeric ShareDB document id from a
 * stable path key (stored in asset metadata) instead of the random uuid row id,
 * so regenerated projects keep identical document identities for the same tree.
 */
export const readPlayCanvasEditorAssetDocumentKey = (asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset): string | null => {
    const key = asRecord(asset.metadata).editorDocumentKey
    return typeof key === 'string' && key.length > 0 && key.length <= 200 ? `key:${key}` : null
}

export type PlayCanvasEditorSceneLocalAsset = {
    id: string
    projectId: string
    sceneId: string
    stableAssetId: string
    type: PlayCanvasAsset['type'] | string
    name: string
    virtualPath: string[]
    file: null
    metadata: Record<string, unknown>
    data?: unknown
    meta?: unknown
    publish: boolean
    version: number
}

export const readPlayCanvasEditorAssetDocumentData = (
    asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset,
    documentId?: number,
    context?: { pathDocumentIds?: number[]; createdAt?: string | null }
): Record<string, unknown> => {
    const metadata = asRecord(asset.metadata)
    const editorDocument = asRecord(metadata.editorDocument)
    const storedData = editorDocument.data !== undefined ? editorDocument.data : metadata.data
    const storedMeta = editorDocument.meta !== undefined ? editorDocument.meta : metadata.meta
    return {
        item_id: documentId ?? readPlayCanvasEditorAssetDocumentId(asset),
        name: asset.name,
        type: asset.type,
        file: asset.file
            ? {
                  filename: asset.virtualPath.length > 0 ? asset.virtualPath[asset.virtualPath.length - 1] : asset.name,
                  hash: asset.file.hash,
                  size: asset.file.size,
                  url: '',
                  variants: null
              }
            : null,
        path: context?.pathDocumentIds ?? [],
        createdAt: context?.createdAt ?? null,
        tags: asStringArray(editorDocument.tags ?? metadata.tags),
        data: storedData ?? null,
        meta: storedMeta ?? null,
        preload: typeof editorDocument.preload === 'boolean' ? editorDocument.preload : true,
        source: typeof editorDocument.source === 'boolean' ? editorDocument.source : false
    }
}

/**
 * Resolves the upstream folder-tree context (`path` arrays of ancestor folder
 * document ids) for every asset entry. Folder ancestors are matched by their
 * virtual path prefix against folder-type entries; the chain stops at the first
 * missing ancestor so legacy assets without folder rows surface at the tree root
 * instead of disappearing.
 */
export const buildEditorCompatibilityAssetPathContext = (
    entries: PlayCanvasEditorCompatibilityAssetEntry[]
): Map<string, { pathDocumentIds: number[]; parentDocumentId: number | null; createdAt: string | null }> => {
    const folderDocumentIdByPath = new Map<string, number>()
    for (const { asset, documentId } of entries) {
        if (asset.type !== 'folder') continue
        folderDocumentIdByPath.set(editorAssetPathKey(asset.virtualPath), documentId)
    }
    const contextByAssetId = new Map<string, { pathDocumentIds: number[]; parentDocumentId: number | null; createdAt: string | null }>()
    for (const { asset } of entries) {
        const segments = asset.virtualPath
        const pathDocumentIds: number[] = []
        let parentDocumentId: number | null = null
        for (let depth = 1; depth < segments.length; depth += 1) {
            const folderDocumentId = folderDocumentIdByPath.get(editorAssetPathKey(segments.slice(0, depth)))
            if (folderDocumentId === undefined) break
            pathDocumentIds.push(folderDocumentId)
            parentDocumentId = folderDocumentId
        }
        const editorDocument = asRecord(asset.metadata).editorDocument
        const createdAt = typeof asRecord(editorDocument).createdAt === 'string' ? (asRecord(editorDocument).createdAt as string) : null
        contextByAssetId.set(asset.id, { pathDocumentIds, parentDocumentId, createdAt })
    }
    return contextByAssetId
}

export const readPlayCanvasEditorAssetSummaryMetadata = (
    asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset
): Record<string, unknown> | undefined => {
    const metadata = asRecord(asset.metadata)
    const summary: Record<string, unknown> = {}
    for (const key of ['data', 'meta', 'editorDocument', 'mmoomm']) {
        if (metadata[key] !== undefined) {
            summary[key] = metadata[key]
        }
    }
    return Object.keys(summary).length > 0 ? summary : undefined
}

export const readPlayCanvasEditorAssetDocumentId = (asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset): number => {
    const stored = readStoredPlayCanvasEditorAssetDocumentId(asset)
    if (stored !== null) return stored
    return parseCanonicalPlayCanvasEditorDocumentId(asset.id) ?? createPlayCanvasEditorNumericAssetId(asset.id)
}

/**
 * Builds a deterministic per-project asset document id resolver for one combined
 * asset universe (storage assets plus scene-local assets). Assets whose id is already
 * a positive integer keep that fixed numeric identity and reserve it; every other
 * asset derives its base hash through the shared batch assignment so two assets can
 * never claim the same document id by construction. The result is a pure function of
 * the asset id set, so independent calls over the same universe agree on assignments.
 */
export const createPlayCanvasEditorNumericAssetIdResolver = (
    assets: ReadonlyArray<PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset>
): ((asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset) => number) => {
    const fixedIdByAssetId = new Map<string, number>()
    const reservedIds = new Set<number>()
    const hashedKeys = new Set<string>()
    const keyByAssetId = new Map<string, string>()
    for (const asset of assets) {
        if (fixedIdByAssetId.has(asset.id)) continue
        const storedDocumentId = readStoredPlayCanvasEditorAssetDocumentId(asset)
        if (storedDocumentId !== null) {
            fixedIdByAssetId.set(asset.id, storedDocumentId)
            reservedIds.add(storedDocumentId)
            continue
        }
        const numericId = parseCanonicalPlayCanvasEditorDocumentId(asset.id)
        if (numericId !== null) {
            fixedIdByAssetId.set(asset.id, numericId)
            reservedIds.add(numericId)
            continue
        }
        const hashKey = readPlayCanvasEditorAssetDocumentKey(asset) ?? `asset:${asset.id}`
        keyByAssetId.set(asset.id, hashKey)
        hashedKeys.add(hashKey)
    }
    const assignments = deriveUniqueNumericIds(
        [...hashedKeys].map((key) => ({ key })),
        reservedIds
    )
    return (asset) => {
        const fixedId = fixedIdByAssetId.get(asset.id)
        if (fixedId !== undefined) return fixedId
        const hashKey = keyByAssetId.get(asset.id) ?? readPlayCanvasEditorAssetDocumentKey(asset) ?? `asset:${asset.id}`
        return assignments.get(hashKey) ?? readPlayCanvasEditorAssetDocumentId(asset)
    }
}

/**
 * Chooses a document id for a new asset without remapping any existing asset.
 * Existing assets are considered fixed for this allocation, and each candidate
 * is checked against the complete resolver output before it is accepted. The
 * chosen value is persisted in metadata by the caller, so later create/delete
 * operations cannot change it when another hash collides.
 */
export const resolveNewEditorCompatibilityAssetDocumentId = (
    existingAssets: ReadonlyArray<PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset>,
    newAsset: PlayCanvasAsset,
    reservedDocumentIds: ReadonlySet<number> = new Set()
): number => {
    const existingResolver = createPlayCanvasEditorNumericAssetIdResolver(existingAssets)
    const existingAssignments = new Map(existingAssets.map((asset) => [asset.id, existingResolver(asset)]))
    const occupied = new Set([...existingAssignments.values(), ...reservedDocumentIds])
    const baseKey = readPlayCanvasEditorAssetDocumentKey(newAsset) ?? `asset:${newAsset.id}`
    for (let suffix = 0; suffix < 10_000; suffix += 1) {
        const candidateKey = suffix === 0 ? baseKey : `${baseKey}#${suffix}`
        const candidate = deriveUniqueNumericIds([{ key: candidateKey }], occupied).get(candidateKey)
        if (!candidate) continue
        const candidateAsset = {
            ...newAsset,
            metadata: { ...newAsset.metadata, [EDITOR_DOCUMENT_ID_METADATA_KEY]: candidate }
        }
        const nextResolver = createPlayCanvasEditorNumericAssetIdResolver([...existingAssets, candidateAsset])
        const existingStable = existingAssets.every((asset) => nextResolver(asset) === existingAssignments.get(asset.id))
        if (existingStable && nextResolver(candidateAsset) === candidate) return candidate
    }
    throw new MetahubConflictError('No stable PlayCanvas Editor asset document id is available', {
        messageCode: 'playcanvas.editorCompatibility.assetDocumentIdUnavailable',
        projectId: newAsset.projectId
    })
}

export const isPlayCanvasEditorSceneLocalAsset = (asset: unknown): asset is PlayCanvasEditorSceneLocalAsset => {
    const record = asRecord(asset)
    return typeof record.id === 'string' && typeof record.type === 'string' && typeof record.name === 'string'
}

export const normalizePlayCanvasEditorSceneLocalAsset = (
    asset: unknown,
    projectId: string,
    sceneId: string,
    version = 1
): PlayCanvasEditorSceneLocalAsset | null => {
    if (!isPlayCanvasEditorSceneLocalAsset(asset)) return null
    const record = asset as Record<string, unknown>
    const metadata = asRecord(record.metadata)
    const data = record.data !== undefined ? record.data : metadata.data
    const meta = record.meta !== undefined ? record.meta : metadata.meta
    return {
        id: String(record.id),
        projectId,
        sceneId,
        stableAssetId:
            typeof record.stableAssetId === 'string' && record.stableAssetId.trim()
                ? record.stableAssetId.trim()
                : `scene-local-${String(record.id)}`,
        type: String(record.type),
        name: String(record.name),
        virtualPath: asStringArray(record.virtualPath),
        file: null,
        metadata: {
            ...metadata,
            ...(data !== undefined ? { data } : {}),
            ...(meta !== undefined ? { meta } : {})
        },
        ...(data !== undefined ? { data } : {}),
        ...(meta !== undefined ? { meta } : {}),
        publish: true,
        version
    }
}

export const isStoragePlayCanvasAsset = (
    asset: PlayCanvasAsset | PlayCanvasEditorSceneLocalAsset
): asset is PlayCanvasAsset & { version: number } => !('sceneId' in asset)

export const normalizedEditorAssetPath = (segments: readonly string[]): string[] =>
    segments.map((segment) => assertEditorAssetName(segment))

export const editorAssetPathKey = (segments: readonly string[]): string => segments.join('/').toLocaleLowerCase('en-US')

export const isEditorAssetPathPrefix = (prefix: readonly string[], candidate: readonly string[]): boolean => {
    if (prefix.length > candidate.length) return false
    return prefix.every((segment, index) => segment.toLocaleLowerCase('en-US') === candidate[index]?.toLocaleLowerCase('en-US'))
}

export const resolveEditorRealtimeAssetParentPath = (
    entries: ReadonlyArray<PlayCanvasEditorCompatibilityAssetEntry>,
    rawPath: unknown
): string[] => {
    if (!Array.isArray(rawPath)) {
        throw new MetahubValidationError('PlayCanvas Editor asset path must be a folder document id array', {
            messageCode: 'playcanvas.editorRealtime.invalidAssetPath'
        })
    }
    const folderByDocumentId = new Map(
        entries
            .filter(({ asset }) => isStoragePlayCanvasAsset(asset) && asset.type === 'folder')
            .map((entry) => [entry.documentId, entry.asset as PlayCanvasAsset & { version: number }])
    )
    let previousPath: string[] = []
    const seen = new Set<number>()
    for (const value of rawPath) {
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0 || seen.has(value)) {
            throw new MetahubValidationError('PlayCanvas Editor asset path contains an invalid folder document id', {
                messageCode: 'playcanvas.editorRealtime.invalidAssetPath'
            })
        }
        seen.add(value)
        const folder = folderByDocumentId.get(value)
        if (!folder) {
            throw new MetahubValidationError('PlayCanvas Editor asset path references an unknown folder', {
                messageCode: 'playcanvas.editorRealtime.invalidAssetPath',
                documentId: value
            })
        }
        const nextPath = normalizedEditorAssetPath(folder.virtualPath)
        if (nextPath.length !== previousPath.length + 1 || (previousPath.length > 0 && !isEditorAssetPathPrefix(previousPath, nextPath))) {
            throw new MetahubValidationError('PlayCanvas Editor asset path is not a folder hierarchy', {
                messageCode: 'playcanvas.editorRealtime.invalidAssetPath'
            })
        }
        previousPath = nextPath
    }
    return previousPath
}

export const createPlayCanvasEditorSceneLocalAssetPayloadEntry = (
    current: unknown,
    input: Record<string, unknown>,
    version: number
): Record<string, unknown> => {
    const record = asRecord(current)
    const metadata = asRecord(record.metadata)
    const editorDocument = asRecord(metadata.editorDocument)
    const nextName = assertEditorAssetName(
        typeof input.name === 'string' && input.name.trim() ? input.name.trim() : String(record.name ?? '')
    )
    const nextType = typeof input.type === 'string' && input.type.trim() ? input.type.trim() : String(record.type ?? 'material')
    const nextData = input.data ?? null
    const nextMeta = input.meta ?? null
    const nextMetadata = {
        ...metadata,
        data: nextData,
        meta: nextMeta,
        editorDocument: {
            ...editorDocument,
            data: nextData,
            meta: nextMeta,
            tags: asStringArray(input.tags),
            preload: typeof input.preload === 'boolean' ? input.preload : true,
            source: typeof input.source === 'boolean' ? input.source : false,
            version
        }
    }
    return {
        ...record,
        name: nextName,
        type: nextType,
        data: nextData,
        meta: nextMeta,
        metadata: nextMetadata
    }
}

export const sceneLocalAssetDocumentMatchesInput = (current: PlayCanvasEditorSceneLocalAsset, input: Record<string, unknown>): boolean => {
    const currentDocument = readPlayCanvasEditorAssetDocumentData(current)
    const comparableKeys = ['name', 'type', 'path', 'tags', 'data', 'meta', 'preload', 'source']
    const currentComparable = Object.fromEntries(comparableKeys.map((key) => [key, currentDocument[key]]))
    const inputComparable = Object.fromEntries(comparableKeys.map((key) => [key, input[key]]))
    return stableStringify(currentComparable) === stableStringify(inputComparable)
}

export const applySceneLocalAssetDocumentInput = (
    currentAssets: unknown[],
    input: {
        projectId: string
        sceneId: string
        assetId: string
        data: Record<string, unknown>
        version: number
        sceneVersion: number
    }
): { matched: boolean; alreadyApplied: boolean; assets: unknown[] } => {
    let matched = false
    let alreadyApplied = false
    const assets = currentAssets.map((currentAsset) => {
        const normalized = normalizePlayCanvasEditorSceneLocalAsset(currentAsset, input.projectId, input.sceneId, input.sceneVersion)
        if (!normalized || normalized.id !== input.assetId) {
            return currentAsset
        }
        matched = true
        if (sceneLocalAssetDocumentMatchesInput(normalized, input.data)) {
            alreadyApplied = true
            return currentAsset
        }
        return createPlayCanvasEditorSceneLocalAssetPayloadEntry(currentAsset, input.data, input.version)
    })
    return { matched, alreadyApplied, assets }
}

export type PlayCanvasEditorCompatibilityAssetEntry = {
    asset: (PlayCanvasAsset & { version: number }) | PlayCanvasEditorSceneLocalAsset
    documentId: number
}

export const resolveEditorCompatibilityAssetEntry = (
    entries: ReadonlyArray<PlayCanvasEditorCompatibilityAssetEntry>,
    documentId: string,
    sceneId?: string | null
): PlayCanvasEditorCompatibilityAssetEntry | never => {
    const matches = entries.filter(
        (entry) =>
            String(entry.documentId) === documentId &&
            (isStoragePlayCanvasAsset(entry.asset) || !sceneId || entry.asset.sceneId === sceneId)
    )
    if (matches.length === 1) {
        return matches[0]
    }
    if (matches.length > 1) {
        throw new MetahubValidationError('PlayCanvas Editor realtime asset document id collision', {
            messageCode: 'playcanvas.editorRealtime.assetDocumentIdCollision',
            documentId,
            assetIds: matches.map((entry) => entry.asset.id)
        })
    }
    throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime asset document', {
        messageCode: 'playcanvas.editorRealtime.unsupportedAssetDocument',
        documentId
    })
}

export const addEditorCompatibilityAssetEntryByDocumentId = (
    byDocumentId: Map<string, PlayCanvasEditorCompatibilityAssetEntry>,
    entry: PlayCanvasEditorCompatibilityAssetEntry
): void => {
    const { asset, documentId } = entry
    const key = isStoragePlayCanvasAsset(asset) ? String(documentId) : `${documentId}:${asset.sceneId}`
    const existing = isStoragePlayCanvasAsset(asset)
        ? [...byDocumentId.entries()].find(([candidateKey]) => candidateKey === key || candidateKey.startsWith(`${key}:`))?.[1]
        : byDocumentId.get(String(documentId)) ?? byDocumentId.get(key)
    if (existing) {
        throw new MetahubValidationError('PlayCanvas Editor realtime asset document id collision', {
            messageCode: 'playcanvas.editorRealtime.assetDocumentIdCollision',
            documentId: String(documentId),
            assetIds: [existing.asset.id, asset.id]
        })
    }
    byDocumentId.set(key, entry)
}

export const settingsDocumentId = (kind: CompatibilitySettingsKind, projectId: string, userId: string): string => {
    switch (kind) {
        case 'user':
            return `user_${userId}`
        case 'projectUser':
            return `project_${projectId}_${userId}`
        case 'projectPrivate':
            return `project-private_${projectId}`
        default:
            throw new MetahubValidationError('Unsupported PlayCanvas Editor compatibility settings document kind', {
                messageCode: 'playcanvas.editorCompatibility.unsupportedSettingsDocumentKind',
                kind
            })
    }
}

export const realtimeSettingsDocumentKind = (documentId: string): CompatibilitySettingsKind | null => {
    if (/^user_\d+$/.test(documentId)) return 'user'
    if (/^project_\d+_\d+$/.test(documentId)) return 'projectUser'
    if (/^project-private_\d+$/.test(documentId)) return 'projectPrivate'
    if (/^project_\d+$/.test(documentId)) return 'projectPrivate'
    return null
}

export const assertRealtimeUserDataDocumentId = (documentId: string, numericSceneId: number, numericUserId: number): void => {
    if (documentId !== `${numericSceneId}_${numericUserId}`) {
        throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime user data document', {
            messageCode: 'playcanvas.editorRealtime.unsupportedUserDataDocument',
            documentId
        })
    }
}
