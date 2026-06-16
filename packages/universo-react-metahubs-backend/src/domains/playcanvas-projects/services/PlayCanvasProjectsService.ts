import { createHash } from 'node:crypto'
import type {
    CreatePlayCanvasProjectRequest,
    PlayCanvasAsset,
    PlayCanvasGeneratedArtifact,
    PlayCanvasFileReference,
    PlayCanvasEditorCompatibilityProtocolDescriptor,
    PlayCanvasEditorCompatibilitySettingsDocument,
    PlayCanvasEditorCompatibilitySourceFileDocument,
    PlayCanvasEditorCompatibilitySourceFileSummary,
    PlayCanvasEditorMinimalAssetMetadata,
    PlayCanvasEditorScenePayload,
    PlayCanvasProjectSummary,
    PlayCanvasRuntimeManifest,
    PlayCanvasScene,
    PlayCanvasSceneScriptBinding,
    PlayCanvasScriptAsset,
    PlayCanvasSourceFile,
    UpdatePlayCanvasProjectSettingsRequest
} from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_PROJECT_FILE_ROOT,
    PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasImageFileReference,
    isPlayCanvasJsonFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasScriptFileReference,
    isPlayCanvasSourceFileReference,
    playCanvasEditorCompatibilityScenePayloadSchema,
    playCanvasEditorCompatibilityProtocolDescriptorSchema,
    playCanvasEditorCompatibilitySettingsDocumentSchema
} from '@universo-react/types'
import { createPlayCanvasEditorNumericAssetId, createPlayCanvasEditorNumericIds } from '@universo-react/playcanvas-editor-backend'
import { playCanvasEditorScenePayloadSchema } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { createCodenameVLC, createLocalizedContent, generateUuidV7, OptimisticLockError } from '@universo-react/utils'
import stableStringify from 'json-stable-stringify'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubConflictError, MetahubDomainError, MetahubValidationError } from '../../shared/domainErrors'
import { createLogger } from '../../../utils/logger'
import {
    assertPlayCanvasProjectMimeForPath,
    assertSafeRelativePlayCanvasProjectPath,
    PlayCanvasProjectFileService
} from './PlayCanvasProjectFileService'
import type { PlayCanvasProjectFileReadResult, PlayCanvasProjectFileScope } from './PlayCanvasProjectFileService'
import { PlayCanvasEditorBridgeSessionService } from './PlayCanvasEditorBridgeSessionService'
import { PlayCanvasProjectSnapshotService } from './PlayCanvasProjectSnapshotService'
import {
    clearPlayCanvasDefaultProjectPointers,
    createPlayCanvasProject,
    findPlayCanvasAsset,
    findPlayCanvasProject,
    findPlayCanvasScene,
    findPlayCanvasSourceFileByStableId,
    listPlayCanvasProjects,
    listPlayCanvasAssets,
    listPlayCanvasPublicationManifests,
    listPlayCanvasScenes,
    listPlayCanvasSourceFiles,
    markPlayCanvasAssetFileReferenceMissing,
    markPlayCanvasAssetFileReferenceReady,
    markPlayCanvasProjectFileReferenceMissing,
    markPlayCanvasProjectFileReferenceReady,
    playCanvasProjectMetadataFileReferenceExists,
    listPlayCanvasProjectCodenamesByPrefix,
    restoreSoftDeletedPlayCanvasProject,
    replacePlayCanvasPublicationManifests,
    softDeletePlayCanvasProject,
    softDeletePlayCanvasScene,
    summarizePlayCanvasProject,
    updatePlayCanvasProject,
    upsertPlayCanvasAsset,
    upsertPlayCanvasGeneratedArtifact,
    upsertPlayCanvasScene,
    upsertPlayCanvasSceneScriptBinding,
    upsertPlayCanvasScriptAsset,
    upsertPlayCanvasSourceFile,
    softDeletePlayCanvasSourceFileByStableId
} from './playCanvasProjectsStore'
import { createPlayCanvasEditorUserData, normalizePlayCanvasEditorUserData } from './playCanvasEditorUserData'

const log = createLogger('PlayCanvasProjectsService')
const STRICT_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const COMPATIBILITY_SETTINGS_KEY = 'playCanvasEditorCompatibility'
const REALTIME_SETTINGS_KEY = 'playCanvasEditorRealtime'
const COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE = 'compatibility.scene.save'
const COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE = 'compatibility.settings.write'
const COMPATIBILITY_SOURCEFILE_WRITE_COMMAND_TYPE = 'compatibility.sourcefile.write'
const COMPATIBILITY_SOURCEFILE_DELETE_COMMAND_TYPE = 'compatibility.sourcefile.delete'
const CLOUD_ONLY_SURFACE_REASON = 'playcanvasCloudOnlySurfaceOutsideUniversoScope'
const UNIVERSO_SOURCEFILES_REASON = 'universoDurableJavaScriptSourcefilesEnabled'

const isCurrentChecksumMismatch = (error: unknown): error is MetahubValidationError =>
    error instanceof MetahubValidationError && error.details?.messageCode === 'playcanvas.files.path.currentChecksumMismatch'

const areEditorScenePayloadsEqual = (left: PlayCanvasEditorScenePayload | null, right: PlayCanvasEditorScenePayload): boolean => {
    const leftComparable = normalizeEditorScenePayloadForComparison(left)
    const rightComparable = normalizeEditorScenePayloadForComparison(right)
    return Boolean(leftComparable && stableStringify(leftComparable) === stableStringify(rightComparable))
}

type PlayCanvasEditorVector3Tuple = [number, number, number]

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readPlayCanvasEditorVector3Tuple = (
    value: unknown,
    fallback?: PlayCanvasEditorVector3Tuple
): PlayCanvasEditorVector3Tuple | undefined => {
    if (Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))) {
        return [value[0] as number, value[1] as number, value[2] as number]
    }
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>
        const x = record.x ?? record[0]
        const y = record.y ?? record[1]
        const z = record.z ?? record[2]
        if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
            return [x as number, y as number, z as number]
        }
    }
    return fallback
}

const findEditorSceneEntityById = (payload: PlayCanvasEditorScenePayload | null | undefined, entityId: string) =>
    payload?.entities?.find((entity) => entity.id === entityId)

type PlayCanvasEditorEntityComponents = NonNullable<PlayCanvasEditorScenePayload['entities'][number]['components']>

const UNSAFE_EDITOR_COMPONENT_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

const createEditorComponentRecord = (): Record<string, unknown> => Object.create(null) as Record<string, unknown>

const assertSafeEditorComponentPath = (path: string[]): void => {
    if (path.length === 0 || path.some((segment) => !segment || UNSAFE_EDITOR_COMPONENT_PATH_SEGMENTS.has(segment))) {
        throw new MetahubValidationError('Unsafe PlayCanvas Editor component path', {
            messageCode: 'playcanvas.editor.scenePayloadUnsafeComponentPath',
            path: path.join('.')
        })
    }
}

const cloneEditorComponentRecord = (value: unknown): Record<string, unknown> => {
    const target = createEditorComponentRecord()
    for (const [key, item] of Object.entries(asRecord(value))) {
        assertSafeEditorComponentPath([key])
        target[key] = item
    }
    return target
}

const assignNestedRecordPath = (target: Record<string, unknown>, path: string[], value: unknown): void => {
    assertSafeEditorComponentPath(path)
    let current = target
    for (const segment of path.slice(0, -1)) {
        const next = Object.prototype.hasOwnProperty.call(current, segment) ? current[segment] : undefined
        if (!next || typeof next !== 'object' || Array.isArray(next)) {
            current[segment] = createEditorComponentRecord()
        }
        current = current[segment] as Record<string, unknown>
    }
    current[path[path.length - 1]] = value
}

const mergeComponentRecord = (target: Record<string, unknown>, componentName: string, value: unknown): void => {
    assertSafeEditorComponentPath([componentName])
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const merged = cloneEditorComponentRecord(target[componentName])
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            assertSafeEditorComponentPath([key])
            merged[key] = item
        }
        target[componentName] = merged
        return
    }
    target[componentName] = value
}

const normalizeEditorEntityComponents = (componentsInput: unknown, entityInput?: unknown): PlayCanvasEditorEntityComponents => {
    const source = asRecord(componentsInput)
    const entitySource = asRecord(entityInput)
    const components = createEditorComponentRecord()

    for (const [key, value] of Object.entries(source)) {
        if (key.includes('.')) continue
        assertSafeEditorComponentPath([key])
        components[key] = value
    }

    for (const [key, value] of Object.entries(source)) {
        const path = key.split('.').filter(Boolean)
        if (path.length < 2) continue
        assignNestedRecordPath(components, path, value)
    }

    for (const [key, value] of Object.entries(entitySource)) {
        if (!key.startsWith('components.')) continue
        const path = key.slice('components.'.length).split('.').filter(Boolean)
        if (path.length === 0) continue
        if (path.length === 1) {
            mergeComponentRecord(components, path[0], value)
        } else {
            assignNestedRecordPath(components, path, value)
        }
    }

    return components as PlayCanvasEditorEntityComponents
}

const normalizeEditorSceneEntityForSave = (
    entity: PlayCanvasEditorScenePayload['entities'][number]
): PlayCanvasEditorScenePayload['entities'][number] => ({
    ...entity,
    components: normalizeEditorEntityComponents(entity.components, entity)
})

const isRenderableEditorEntity = (entity: PlayCanvasEditorScenePayload['entities'][number]): boolean => {
    const components = asRecord(entity.components)
    const render = asRecord(components.render)
    return entity.enabled !== false && Object.keys(render).length > 0 && render.enabled !== false
}

const toMmoommVector = (tuple: PlayCanvasEditorVector3Tuple) => ({ x: tuple[0], y: tuple[1], z: tuple[2] })

const stripMmoommRuntimeSceneMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
    if (!metadata) return undefined
    const mmoomm = asRecord(metadata.mmoomm)
    if (Object.keys(mmoomm).length === 0) return metadata
    const { scene: _scene, provenance, ...mmoommRest } = mmoomm
    const provenanceRecord = asRecord(provenance)
    const { authoringFlow: _authoringFlow, ...provenanceRest } = provenanceRecord
    const nextMmoomm = {
        ...mmoommRest,
        ...(Object.keys(provenanceRest).length > 0 ? { provenance: provenanceRest } : {})
    }
    const { mmoomm: _mmoomm, ...metadataRest } = metadata
    return Object.keys(nextMmoomm).length > 0 ? { ...metadataRest, mmoomm: nextMmoomm } : metadataRest
}

const deriveMmoommMetadataFromEditorEntities = (
    metadata: Record<string, unknown> | undefined,
    entities: PlayCanvasEditorScenePayload['entities']
): Record<string, unknown> | undefined => {
    const ship = entities.find((entity) => entity.name === 'MMOOMM Ship' && isRenderableEditorEntity(entity))
    const station = entities.find((entity) => entity.name === 'MMOOMM Station' && isRenderableEditorEntity(entity))
    if (!ship || !station) return stripMmoommRuntimeSceneMetadata(metadata)

    const shipPosition = readPlayCanvasEditorVector3Tuple(ship.position, [0, 0, 0]) ?? [0, 0, 0]
    const stationPosition = readPlayCanvasEditorVector3Tuple(station.position, [72, 0, -48]) ?? [72, 0, -48]
    const shipScale = readPlayCanvasEditorVector3Tuple(ship.scale, [12, 4, 4]) ?? [12, 4, 4]
    const stationScale = readPlayCanvasEditorVector3Tuple(station.scale, [48, 16, 16]) ?? [48, 16, 16]

    return {
        ...metadata,
        mmoomm: {
            ...asRecord(metadata?.mmoomm),
            scene: {
                ...asRecord(asRecord(metadata?.mmoomm).scene),
                controlledObjectId: ship.id,
                targetObjectId: station.id,
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: [
                    {
                        id: ship.id,
                        position: toMmoommVector(shipPosition),
                        scale: toMmoommVector(shipScale),
                        selectable: true
                    },
                    {
                        id: station.id,
                        position: toMmoommVector(stationPosition),
                        scale: toMmoommVector(stationScale),
                        selectable: true,
                        guard: true
                    }
                ]
            },
            provenance: {
                ...asRecord(asRecord(metadata?.mmoomm).provenance),
                authoringFlow: 'playcanvas-editor-native-scene'
            }
        }
    }
}

const syncMmoommMetadataWithEditorEntities = (
    metadata: Record<string, unknown> | undefined,
    entities: PlayCanvasEditorScenePayload['entities']
): Record<string, unknown> | undefined => {
    const derivedMetadata = deriveMmoommMetadataFromEditorEntities(metadata, entities)
    if (!derivedMetadata) return undefined
    const mmoomm =
        derivedMetadata?.mmoomm && typeof derivedMetadata.mmoomm === 'object' && !Array.isArray(derivedMetadata.mmoomm)
            ? (derivedMetadata.mmoomm as Record<string, unknown>)
            : null
    const scene =
        mmoomm?.scene && typeof mmoomm.scene === 'object' && !Array.isArray(mmoomm.scene) ? (mmoomm.scene as Record<string, unknown>) : null
    if (!mmoomm || !scene) return derivedMetadata
    const entityById = new Map(entities.map((entity) => [entity.id, entity]))
    const objects = Array.isArray(scene.objects) ? scene.objects : []
    return {
        ...derivedMetadata,
        mmoomm: {
            ...mmoomm,
            scene: {
                ...scene,
                objects: objects
                    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object' && !Array.isArray(item))
                    .map((item) => {
                        const entity = typeof item.id === 'string' ? entityById.get(item.id) : undefined
                        const position = entity ? readPlayCanvasEditorVector3Tuple(entity.position) : undefined
                        const scale = entity ? readPlayCanvasEditorVector3Tuple(entity.scale) : undefined
                        return {
                            ...item,
                            ...(position ? { position: { x: position[0], y: position[1], z: position[2] } } : {}),
                            ...(scale ? { scale: { x: scale[0], y: scale[1], z: scale[2] } } : {})
                        }
                    })
            },
            provenance: {
                ...asRecord(mmoomm.provenance),
                authoringFlow: 'playcanvas-editor-native-scene'
            }
        }
    }
}

type CompatibilitySettingsKind = PlayCanvasEditorCompatibilitySettingsDocument['kind']

const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []

const isPlayCanvasAssetType = (value: unknown): value is PlayCanvasAsset['type'] =>
    ['scene', 'script', 'generatedScript', 'texture', 'model', 'audio', 'json', 'other'].includes(String(value))

const resolveRealtimeAssetDocument = (
    assets: (PlayCanvasAsset & { version: number })[],
    documentId: string
): (PlayCanvasAsset & { version: number }) | never => {
    const matches = assets.filter((candidate) => String(createPlayCanvasEditorNumericAssetId(candidate.id)) === documentId)
    if (matches.length === 1) {
        return matches[0]
    }
    if (matches.length > 1) {
        throw new MetahubValidationError('PlayCanvas Editor realtime asset document id collision', {
            messageCode: 'playcanvas.editorRealtime.assetDocumentIdCollision',
            documentId,
            assetIds: matches.map((asset) => asset.id)
        })
    }
    throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime asset document', {
        messageCode: 'playcanvas.editorRealtime.unsupportedAssetDocument',
        documentId
    })
}

const settingsDocumentId = (kind: CompatibilitySettingsKind, projectId: string, userId: string): string => {
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

const realtimeSettingsDocumentKind = (documentId: string): CompatibilitySettingsKind | null => {
    if (/^user_\d+$/.test(documentId)) return 'user'
    if (/^project_\d+_\d+$/.test(documentId)) return 'projectUser'
    if (/^project-private_\d+$/.test(documentId)) return 'projectPrivate'
    if (/^project_\d+$/.test(documentId)) return 'projectPrivate'
    return null
}

const assertRealtimeUserDataDocumentId = (documentId: string, numericSceneId: number, numericUserId: number): void => {
    if (documentId !== `${numericSceneId}_${numericUserId}`) {
        throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime user data document', {
            messageCode: 'playcanvas.editorRealtime.unsupportedUserDataDocument',
            documentId
        })
    }
}

const normalizeEditorSourceFilePath = (
    projectId: string,
    sourceFileId: string,
    inputPath: string,
    fileService: PlayCanvasProjectFileService
): string => {
    const normalized = inputPath.replace(/\\/g, '/').trim()
    if (!normalized || normalized.startsWith('/') || normalized.includes('\0')) {
        throw new MetahubValidationError('PlayCanvas sourcefile path must be relative', {
            messageCode: 'playcanvas.files.sourcefile.pathMismatch',
            sourceFileId,
            sourcePath: inputPath
        })
    }
    const storagePrefix = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/sourcefiles/`
    const storageProjectPrefix = `${PLAYCANVAS_PROJECT_FILE_ROOT}/${projectId}/`
    if (normalized.startsWith(storagePrefix)) {
        return assertSafeRelativePlayCanvasProjectPath(normalized)
    }
    if (normalized.startsWith(storageProjectPrefix)) {
        throw new MetahubValidationError('Sourcefile path does not match the sourcefiles storage namespace', {
            messageCode: 'playcanvas.files.sourcefile.pathMismatch',
            sourceFileId,
            sourcePath: normalized
        })
    }
    const parts = normalized.split('/').filter(Boolean)
    if (parts.some((part) => part === '..' || part.startsWith('.'))) {
        throw new MetahubValidationError('PlayCanvas sourcefile path cannot contain hidden or parent segments', {
            messageCode: 'playcanvas.files.path.hiddenOrParentSegment',
            sourceFileId,
            sourcePath: normalized
        })
    }
    const filename = parts[parts.length - 1] ?? `${sourceFileId}.mjs`
    const dot = filename.lastIndexOf('.')
    const extension = dot >= 0 ? filename.slice(dot) : '.mjs'
    return fileService.buildDefaultSourceFilePath(projectId, sourceFileId, extension === '.js' ? '.js' : '.mjs')
}

const normalizeEditorSourceFileStableId = (sourceFileId: string): string => sourceFileId.replace(/\.[cm]?js$/i, '')

const getEditorSourceFileName = (sourceFileId: string, inputPath: string, requestedName?: string): string => {
    if (requestedName?.trim()) return requestedName.trim()
    const normalized = inputPath.replace(/\\/g, '/').trim()
    const filename = normalized.split('/').filter(Boolean).pop()
    return filename && !filename.startsWith('.') ? filename : `${sourceFileId}.mjs`
}

const readRealtimeSettingsDocumentVersion = (document: Record<string, unknown>): number =>
    typeof document.version === 'number' && Number.isInteger(document.version) && document.version >= 0 ? document.version : 0

const waitForRealtimeSettingsRetry = (attempt: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, attempt * 25)
    })

const createDefaultEditorScenePayload = (): PlayCanvasEditorScenePayload => ({
    schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
    settings: {
        priority_scripts: [],
        physics: {
            gravity: [0, -9.81, 0]
        },
        render: {
            global_ambient: [0.2, 0.2, 0.2],
            skybox: null,
            skyType: 'infinite',
            skyMeshPosition: [0, 0, 0],
            skyMeshRotation: [0, 0, 0],
            skyMeshScale: [1, 1, 1],
            skyCenter: [0, 0, 0],
            skyboxIntensity: 1,
            skyboxRotation: [0, 0, 0],
            skyboxMip: 0,
            skyDepthWrite: false,
            clusteredLightingEnabled: true,
            lightingCells: [10, 3, 10],
            lightingMaxLightsPerCell: 255,
            lightingCookiesEnabled: true,
            lightingCookieAtlasResolution: 2048,
            lightingShadowsEnabled: true,
            lightingShadowAtlasResolution: 2048,
            lightingShadowType: 0,
            lightingAreaLightsEnabled: true,
            tonemapping: 0,
            exposure: 1,
            gamma_correction: 1,
            fog: 'none',
            fog_start: 1,
            fog_end: 1000,
            fog_density: 0,
            fog_color: [0, 0, 0]
        }
    },
    entities: [
        {
            id: 'root',
            name: 'Root',
            parentId: null,
            enabled: true,
            components: {},
            children: []
        }
    ]
})

const normalizeEditorSceneSettings = (value: unknown): PlayCanvasEditorScenePayload['settings'] => {
    const defaults = createDefaultEditorScenePayload().settings as Record<string, unknown>
    const record = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
    const physics = record.physics && typeof record.physics === 'object' && !Array.isArray(record.physics) ? record.physics : {}
    const render = record.render && typeof record.render === 'object' && !Array.isArray(record.render) ? record.render : {}
    const defaultPhysics =
        defaults.physics && typeof defaults.physics === 'object' && !Array.isArray(defaults.physics) ? defaults.physics : {}
    const defaultRender = defaults.render && typeof defaults.render === 'object' && !Array.isArray(defaults.render) ? defaults.render : {}
    return {
        priority_scripts: Array.isArray(record.priority_scripts) ? record.priority_scripts : [],
        physics: {
            ...defaultPhysics,
            ...physics
        },
        render: {
            ...defaultRender,
            ...render
        }
    }
}

function normalizeEditorScenePayloadForComparison(payload: PlayCanvasEditorScenePayload | null): PlayCanvasEditorScenePayload | null {
    if (!payload) return null
    return playCanvasEditorCompatibilityScenePayloadSchema.parse({
        ...payload,
        settings: normalizeEditorSceneSettings(payload.settings)
    })
}

const normalizeEditorCompatibilityScenePayloadForSave = (payload: PlayCanvasEditorScenePayload): PlayCanvasEditorScenePayload => {
    const metadata =
        payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
            ? (payload.metadata as Record<string, unknown>)
            : undefined
    const entities = (payload.entities ?? []).map(normalizeEditorSceneEntityForSave)
    return playCanvasEditorCompatibilityScenePayloadSchema.parse({
        ...payload,
        settings: normalizeEditorSceneSettings(payload.settings),
        entities,
        metadata: syncMmoommMetadataWithEditorEntities(metadata, entities)
    })
}

const createRealtimeRootEntity = (children: string[] = []): Record<string, unknown> => ({
    resource_id: 'root',
    name: 'Root',
    parent: null,
    enabled: true,
    components: {},
    children
})

const normalizeRealtimeSceneEntities = (
    entities: PlayCanvasEditorScenePayload['entities'] = []
): Record<string, Record<string, unknown>> => {
    const normalized = new Map<string, Record<string, unknown>>()
    let rootId: string | null = null

    for (const entity of entities) {
        const isRoot = entity.id === 'root'
        if (isRoot) {
            rootId = entity.id
        }
        const position = readPlayCanvasEditorVector3Tuple(entity.position, isRoot ? [0, 0, 0] : undefined)
        const rotation = readPlayCanvasEditorVector3Tuple(entity.rotation, isRoot ? [0, 0, 0] : undefined)
        const scale = readPlayCanvasEditorVector3Tuple(entity.scale, isRoot ? [1, 1, 1] : undefined)
        normalized.set(entity.id, {
            resource_id: entity.id,
            name: entity.name ?? (isRoot ? 'Root' : 'Entity'),
            parent: entity.parentId ?? null,
            enabled: entity.enabled ?? true,
            ...(position ? { position } : {}),
            ...(rotation ? { rotation } : {}),
            ...(scale ? { scale } : {}),
            components: normalizeEditorEntityComponents(entity.components, entity),
            children: Array.isArray(entity.children) ? entity.children : []
        })
    }

    if (!rootId) {
        rootId = 'root'
        normalized.set(rootId, createRealtimeRootEntity())
    }

    const hasParentCycle = (entityId: string, parentId: string): boolean => {
        const visited = new Set<string>([entityId])
        let current: string | null = parentId
        while (current) {
            if (visited.has(current)) return true
            visited.add(current)
            const parent = normalized.get(current)
            if (!parent) return false
            current = typeof parent.parent === 'string' ? parent.parent : null
        }
        return false
    }

    for (const [id, entity] of normalized) {
        if (id === rootId) {
            entity.parent = null
            continue
        }
        const parentId = typeof entity.parent === 'string' ? entity.parent : null
        if (!parentId || !normalized.has(parentId) || parentId === id || hasParentCycle(id, parentId)) {
            entity.parent = rootId
        }
    }

    const childrenByParent = new Map<string, string[]>()
    const appendChild = (parentId: string, childId: string): void => {
        const children = childrenByParent.get(parentId) ?? []
        if (!children.includes(childId)) {
            children.push(childId)
        }
        childrenByParent.set(parentId, children)
    }

    for (const [id, entity] of normalized) {
        const existingChildren = Array.isArray(entity.children) ? entity.children : []
        for (const childId of existingChildren) {
            if (typeof childId !== 'string' || childId === id || !normalized.has(childId)) continue
            if (normalized.get(childId)?.parent === id) {
                appendChild(id, childId)
            }
        }
    }

    for (const [id, entity] of normalized) {
        if (id === rootId) continue
        const parentId = typeof entity.parent === 'string' ? entity.parent : rootId
        appendChild(parentId, id)
    }

    for (const [id, entity] of normalized) {
        normalized.set(id, {
            ...entity,
            parent: id === rootId ? null : entity.parent,
            children: childrenByParent.get(id) ?? []
        })
    }

    return Object.fromEntries(normalized)
}

const createDefaultRealtimeProjectSettingsDocument = (input: {
    documentId: string
    numericProjectId: number
}): Record<string, unknown> => ({
    id: input.documentId,
    project: input.numericProjectId,
    scripts: [],
    useLegacyScripts: false,
    engineV2: true,
    width: 1280,
    height: 720
})

const normalizeRealtimeSettingsDocumentData = (
    documentId: string,
    data: Record<string, unknown>,
    input: { numericProjectId: number; numericUserId: number }
): Record<string, unknown> => {
    if (/^project_\d+$/.test(documentId)) {
        return {
            ...createDefaultRealtimeProjectSettingsDocument({ documentId, numericProjectId: input.numericProjectId }),
            ...data,
            scripts: Array.isArray(data.scripts) ? data.scripts : []
        }
    }

    return {
        id: documentId,
        userId: input.numericUserId,
        projectId: input.numericProjectId,
        ...data
    }
}

const hashEditorCompatibilityReplayFingerprint = (value: unknown): string =>
    createHash('sha256')
        .update(stableStringify(value) ?? JSON.stringify(value))
        .digest('hex')

const compatibilitySceneSaveSessionId = (input: { metahubId: string; projectId: string; sceneId: string; userId: string }): string =>
    `compatibility:${input.metahubId}:${input.projectId}:${input.sceneId}:${input.userId}`

const compatibilitySettingsWriteSessionId = (input: {
    metahubId: string
    projectId: string
    kind: CompatibilitySettingsKind
    userId: string
}): string => `compatibility:${input.metahubId}:${input.projectId}:settings:${input.kind}:${input.userId}`

const compatibilitySourceFileSessionId = (input: { metahubId: string; projectId: string; sourceFileId: string; userId: string }): string =>
    `compatibility:${input.metahubId}:${input.projectId}:sourcefile:${input.sourceFileId}:${input.userId}`

const isEditorCompatibilitySceneSaveResult = (
    value: unknown
): value is { scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null } => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    const scene = record.scene as Record<string, unknown> | undefined
    return (
        !!scene &&
        typeof scene === 'object' &&
        typeof scene.id === 'string' &&
        (record.payload === null || typeof record.payload === 'object') &&
        (record.checksum === null || typeof record.checksum === 'string')
    )
}

const isEditorCompatibilitySettingsWriteResult = (value: unknown): value is PlayCanvasEditorCompatibilitySettingsDocument =>
    playCanvasEditorCompatibilitySettingsDocumentSchema.safeParse(value).success

const isEditorCompatibilitySourceFileDocument = (value: unknown): value is PlayCanvasEditorCompatibilitySourceFileDocument => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return (
        typeof record.id === 'string' &&
        typeof record.path === 'string' &&
        typeof record.name === 'string' &&
        typeof record.content === 'string' &&
        typeof record.hash === 'string' &&
        typeof record.size === 'number' &&
        typeof record.mime === 'string' &&
        (record.updatedAt === null || typeof record.updatedAt === 'string')
    )
}

const isEditorCompatibilitySourceFileDeleteResult = (value: unknown): value is { id: string; deleted: true } => {
    if (!value || typeof value !== 'object') return false
    const record = value as Record<string, unknown>
    return typeof record.id === 'string' && record.deleted === true
}

const slugifyProjectName = (value: string): string => {
    const normalized = value
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80)
    return normalized || 'playcanvas_project'
}

const getPrimaryText = (value: PlayCanvasProjectSummary['displayName']): string => {
    const primary = value._primary
    const primaryValue = value.locales?.[primary]?.content
    if (typeof primaryValue === 'string' && primaryValue.trim()) return primaryValue.trim()
    const first = Object.values(value.locales ?? {}).find((entry) => typeof entry?.content === 'string' && entry.content.trim())
    return typeof first?.content === 'string' ? first.content.trim() : 'PlayCanvas Project'
}

const decodeStrictBase64 = (value: string): Buffer => {
    if (!STRICT_BASE64_PATTERN.test(value)) {
        throw new MetahubValidationError('PlayCanvas project file content must be canonical base64', {
            messageCode: 'playcanvas.files.base64.invalid'
        })
    }
    return Buffer.from(value, 'base64')
}

export class PlayCanvasProjectsService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly fileService = new PlayCanvasProjectFileService()
    ) {}

    private async resolveSchemaName(metahubId: string): Promise<string> {
        return this.schemaService.ensureSchema(metahubId)
    }

    private metadataUpdateError(projectId: string, sourcePath: string): MetahubValidationError {
        return new MetahubValidationError('PlayCanvas project file metadata reference was not updated', {
            messageCode: 'playcanvas.files.metadataUpdateFailed',
            projectId,
            sourcePath
        })
    }

    private async markSourceFileMetadataMissingAfterWriteFailure(
        schemaName: string,
        projectId: string,
        sourcePath: string,
        sourceFileId: string,
        userId: string,
        existing: PlayCanvasSourceFile | null,
        preparedVersion: number
    ): Promise<void> {
        try {
            if (!existing) {
                const deleted = await softDeletePlayCanvasSourceFileByStableId(
                    this.exec,
                    schemaName,
                    projectId,
                    sourceFileId,
                    userId,
                    preparedVersion
                )
                if (!deleted) {
                    log.warn('Failed to soft-delete PlayCanvas sourcefile metadata after physical write failure', {
                        schemaName,
                        projectId,
                        sourceFileId,
                        sourcePath
                    })
                }
                return
            }

            const restored = await upsertPlayCanvasSourceFile(
                this.exec,
                schemaName,
                projectId,
                {
                    id: existing.id,
                    stableSourceFileId: existing.stableSourceFileId,
                    name: existing.name,
                    virtualPath: existing.virtualPath,
                    file: existing.file,
                    scriptKind: existing.scriptKind,
                    checksum: existing.checksum,
                    parsedAttributes: existing.parsedAttributes,
                    parseStatus: existing.parseStatus,
                    parseDiagnostics: existing.parseDiagnostics,
                    publish: existing.publish,
                    expectedVersion: preparedVersion
                },
                userId
            )
            if (!restored) {
                log.warn('Failed to restore PlayCanvas sourcefile metadata after physical write failure', {
                    schemaName,
                    projectId,
                    sourceFileId,
                    sourcePath
                })
            }
        } catch (rollbackError) {
            log.warn('PlayCanvas sourcefile metadata rollback failed after physical write failure', {
                schemaName,
                projectId,
                sourceFileId,
                sourcePath,
                error: rollbackError
            })
        }
    }

    async listProjects(metahubId: string, _userId: string): Promise<PlayCanvasProjectSummary[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const rows = await listPlayCanvasProjects(this.exec, schemaName)
        return Promise.all(rows.map((row) => summarizePlayCanvasProject(this.exec, schemaName, row)))
    }

    async getProject(metahubId: string, projectId: string, _userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const row = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!row) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        return summarizePlayCanvasProject(this.exec, schemaName, row)
    }

    async loadSelectedProjectForEditor(metahubId: string, projectId: string, userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        let row = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!row) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, row)
        }

        const sceneId = row.id
        let scene = await findPlayCanvasScene(this.exec, schemaName, row.id, sceneId)
        if (!scene) {
            scene =
                (await upsertPlayCanvasScene(
                    this.exec,
                    schemaName,
                    row.id,
                    {
                        id: sceneId,
                        codename: createCodenameVLC('en', 'main-scene'),
                        displayName: createLocalizedContent('en', 'Main Scene'),
                        payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                        payload: createDefaultEditorScenePayload(),
                        payloadFile: null,
                        checksum: null,
                        sortOrder: 0,
                        publish: true
                    },
                    userId
                )) ?? (await findPlayCanvasScene(this.exec, schemaName, row.id, sceneId))
        }
        if (!scene) {
            throw new MetahubValidationError('PlayCanvas project default scene could not be initialized', {
                messageCode: 'playcanvas.projectDefaultSceneInitFailed',
                projectId
            })
        }

        row = (await findPlayCanvasProject(this.exec, schemaName, projectId)) ?? row
        if (row.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, row)
        }

        const updated = await updatePlayCanvasProject(
            this.exec,
            schemaName,
            row.id,
            {
                defaultSceneId: scene.id,
                expectedVersion: row.version
            },
            userId
        )
        if (updated) {
            return summarizePlayCanvasProject(this.exec, schemaName, updated)
        }

        const latest = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (latest?.defaultSceneId) {
            return summarizePlayCanvasProject(this.exec, schemaName, latest)
        }
        throw this.optimisticError(row.id, row.version)
    }

    async describeEditorCompatibilityProtocol(
        metahubId: string,
        projectId: string,
        userId: string
    ): Promise<PlayCanvasEditorCompatibilityProtocolDescriptor> {
        const project = await this.getProject(metahubId, projectId, userId)
        const defaultSceneId = project.defaultSceneId ?? null
        const enabledSurface = {
            status: 'enabled' as const,
            reason: 'universoFullUpstreamUi'
        }
        const stubbedSurface = {
            status: 'stubbed' as const,
            reason: CLOUD_ONLY_SURFACE_REASON
        }
        const sourcefilesSurface = {
            status: 'enabled' as const,
            reason: UNIVERSO_SOURCEFILES_REASON
        }
        const branchId = defaultSceneId ?? project.id
        const numericIds = createPlayCanvasEditorNumericIds({
            metahubId,
            projectId,
            sceneId: branchId,
            userId
        })

        return playCanvasEditorCompatibilityProtocolDescriptorSchema.parse({
            schemaVersion: PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
            upstream: {
                repository: 'https://github.com/playcanvas/editor',
                minimumTag: 'v2.24.2'
            },
            project,
            defaultSceneId,
            numericIds,
            identity: {
                self: {
                    id: userId,
                    role: 'designer'
                },
                owner: {
                    id: metahubId,
                    type: 'metahub'
                },
                permissions: {
                    read: true,
                    write: true,
                    admin: false
                },
                branch: {
                    id: branchId,
                    name: 'Main',
                    active: true
                },
                teams: [],
                organizations: []
            },
            endpoints: {
                rest: enabledSurface,
                realtime: enabledSurface,
                messenger: enabledSurface,
                relay: enabledSurface
            },
            shareDb: {
                requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
                persisted: true,
                persistence: 'snapshot-port',
                sceneStorage: 'metahub-playcanvas-project-storage'
            },
            cloudOnly: {
                store: stubbedSurface,
                jobs: stubbedSurface,
                branchesCheckpoints: stubbedSurface,
                sourcefiles: sourcefilesSurface,
                publishing: stubbedSurface,
                usersCollaboration: stubbedSurface,
                assetPipeline: stubbedSurface
            },
            documents: {
                codeEditorSourcefiles: {
                    status: 'enabled',
                    reason: UNIVERSO_SOURCEFILES_REASON
                }
            },
            settingsDocuments: {
                user: `user_${userId}`,
                projectUser: `project_${project.id}_${userId}`,
                projectPrivate: `project-private_${project.id}`
            }
        })
    }

    async createProject(metahubId: string, input: CreatePlayCanvasProjectRequest, userId: string): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        return this.exec.transaction(async (tx) => {
            const codename =
                input.codename ??
                (await this.createUniqueProjectCodename(
                    schemaName,
                    input.displayName._primary,
                    slugifyProjectName(getPrimaryText(input.displayName)),
                    tx
                ))
            const row = await createPlayCanvasProject(
                tx,
                schemaName,
                {
                    codename,
                    displayName: input.displayName,
                    description: input.description ?? null,
                    packageVersion: input.packageVersion ?? null,
                    settings: {}
                },
                userId
            )
            const sceneId = generateUuidV7()
            const scene = await upsertPlayCanvasScene(
                tx,
                schemaName,
                row.id,
                {
                    id: sceneId,
                    codename: createCodenameVLC(input.displayName._primary, 'main-scene'),
                    displayName: createLocalizedContent(input.displayName._primary, 'Main Scene'),
                    payloadSchemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                    payload: createDefaultEditorScenePayload(),
                    payloadFile: null,
                    checksum: null,
                    sortOrder: 0,
                    publish: true
                },
                userId
            )
            const updated = await updatePlayCanvasProject(
                tx,
                schemaName,
                row.id,
                {
                    defaultSceneId: scene.id,
                    expectedVersion: row.version
                },
                userId
            )
            if (!updated) {
                throw this.optimisticError(row.id, row.version)
            }
            return summarizePlayCanvasProject(tx, schemaName, updated)
        })
    }

    private async createUniqueProjectCodename(
        schemaName: string,
        locale: string,
        baseCodename: string,
        exec: DbExecutor = this.exec
    ): Promise<NonNullable<CreatePlayCanvasProjectRequest['codename']>> {
        const existingCodenames = new Set(await listPlayCanvasProjectCodenamesByPrefix(exec, schemaName, baseCodename))
        for (let index = 0; index < 100; index += 1) {
            const candidate = index === 0 ? baseCodename : `${baseCodename}-${index + 1}`
            if (!existingCodenames.has(candidate)) {
                return createCodenameVLC(locale, candidate)
            }
        }
        throw new MetahubValidationError('PlayCanvas project codename is not unique', {
            messageCode: 'playcanvas.project.codenameNotUnique',
            codename: baseCodename
        })
    }

    async listScenes(metahubId: string, projectId: string, _userId: string): Promise<(PlayCanvasScene & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        return listPlayCanvasScenes(this.exec, schemaName, projectId)
    }

    async getScene(metahubId: string, projectId: string, sceneId: string, _userId: string): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const scene = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
        if (!scene) {
            throw new MetahubValidationError('PlayCanvas scene was not found', {
                messageCode: 'playcanvas.scenes.notFound',
                sceneId
            })
        }
        return scene
    }

    async readEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null }> {
        const scene = await this.getScene(metahubId, projectId, sceneId, userId)
        if (!scene.payloadFile?.path) {
            if (!scene.payload) {
                return { scene, payload: null }
            }
            const parsed = playCanvasEditorScenePayloadSchema.safeParse(scene.payload)
            if (!parsed.success) {
                throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                    messageCode: 'playcanvas.editor.scenePayloadUnsupported'
                })
            }
            return { scene, payload: parsed.data }
        }

        const file = await this.readProjectFile(metahubId, projectId, scene.payloadFile.path, userId)
        let raw: unknown
        try {
            raw = JSON.parse(Buffer.from(file.contentBase64, 'base64').toString('utf8')) as unknown
        } catch {
            throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                messageCode: 'playcanvas.editor.scenePayloadUnsupported'
            })
        }
        const parsed = playCanvasEditorScenePayloadSchema.safeParse(raw)
        if (!parsed.success) {
            throw new MetahubValidationError('PlayCanvas editor scene payload is not supported', {
                messageCode: 'playcanvas.editor.scenePayloadUnsupported'
            })
        }
        return { scene: { ...scene, checksum: file.checksum }, payload: parsed.data }
    }

    async writeScene(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasScene, 'projectId'> & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasScene & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const payloadFile = this.assertScenePayloadFileReference(projectId, input.payloadFile)
        const scene = await upsertPlayCanvasScene(this.exec, schemaName, projectId, { ...input, payloadFile }, userId)
        if (!scene) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return scene
    }

    async saveEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        input: {
            payload: PlayCanvasEditorScenePayload
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; checksum: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const payload = normalizeEditorCompatibilityScenePayloadForSave(input.payload)
        const existing = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
        const existingPayloadFile = this.assertScenePayloadFileReference(projectId, existing?.payloadFile)
        const payloadFilePath = existingPayloadFile?.path ?? this.fileService.buildDefaultScenePath(projectId, sceneId)
        const safePath = this.assertEditorScenePayloadPath(projectId, sceneId, payloadFilePath)
        assertPlayCanvasProjectMimeForPath(safePath, 'application/json')
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const preparedPayloadFile: PlayCanvasFileReference = {
            provider: existingPayloadFile?.provider ?? 'local',
            root: existingPayloadFile?.root ?? PLAYCANVAS_PROJECT_FILE_ROOT,
            path: safePath,
            mime: 'application/json',
            hash: existingPayloadFile?.hash ?? null,
            size: existingPayloadFile?.size ?? null,
            status: 'missing'
        }
        let prepared: (PlayCanvasScene & { version: number }) | null = null
        let written: { sourcePath: string; checksum: string; size: number; mime: string | null } | null = null
        try {
            prepared = await upsertPlayCanvasScene(
                this.exec,
                schemaName,
                projectId,
                {
                    id: sceneId,
                    codename: existing?.codename ?? createCodenameVLC('en', `scene-${sceneId.slice(0, 8)}`),
                    displayName: existing?.displayName ?? createLocalizedContent('en', 'PlayCanvas Scene'),
                    payloadSchemaVersion: payload.schemaVersion,
                    payload: null,
                    payloadFile: preparedPayloadFile,
                    checksum: existing?.checksum ?? null,
                    sortOrder: existing?.sortOrder ?? 0,
                    publish: existing?.publish ?? true,
                    expectedVersion: existing?.version
                },
                userId
            )
            if (!prepared) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            written = await this.fileService.write(scope, safePath, Buffer.from(JSON.stringify(payload), 'utf8'), {
                expectedCurrentChecksum: input.expectedCurrentChecksum,
                mime: 'application/json'
            })
            const marked = await markPlayCanvasProjectFileReferenceReady(this.exec, schemaName, projectId, safePath, written, userId)
            if (!marked) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            const metadata = await findPlayCanvasScene(this.exec, schemaName, projectId, sceneId)
            if (!metadata) {
                throw this.metadataUpdateError(projectId, safePath)
            }
            return {
                scene: metadata,
                checksum: written.checksum
            }
        } catch (error) {
            if (written) {
                await this.rollbackFileWrite(scope, safePath, written.checksum, previous, 'application/json').catch((rollbackError) => {
                    log.warn('Failed to rollback PlayCanvas editor scene file after save failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        sceneId,
                        sourcePath: safePath,
                        rollbackError
                    })
                })
            }
            if (prepared) {
                await this.rollbackEditorSceneMetadata(schemaName, projectId, sceneId, existing, prepared.version, userId).catch(
                    (rollbackError) => {
                        log.warn('Failed to rollback PlayCanvas editor scene metadata after save failure', {
                            metahubId,
                            schemaName,
                            projectId,
                            sceneId,
                            sourcePath: safePath,
                            rollbackError
                        })
                    }
                )
            }
            throw error
        }
    }

    async saveEditorCompatibilityScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        input: {
            requestId: string
            payload: PlayCanvasEditorScenePayload
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<{ scene: PlayCanvasScene & { version: number }; payload: PlayCanvasEditorScenePayload | null; checksum: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const payload = normalizeEditorCompatibilityScenePayloadForSave(input.payload)
        const replayInput = {
            sessionId: compatibilitySceneSaveSessionId({ metahubId, projectId, sceneId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SCENE_SAVE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                payload,
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySceneSaveResult(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility scene save replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const saved = await this.saveEditorScene(
                metahubId,
                projectId,
                sceneId,
                {
                    payload,
                    expectedCurrentChecksum: input.expectedCurrentChecksum
                },
                userId
            )
            mutationCommitted = true
            const read = await this.readEditorScene(metahubId, projectId, sceneId, userId)
            const response = { ...saved, payload: read.payload }
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }

    async listAssets(metahubId: string, projectId: string, _userId: string): Promise<(PlayCanvasAsset & { version: number })[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        return listPlayCanvasAssets(this.exec, schemaName, projectId)
    }

    async listMinimalAssetsForEditorScene(
        metahubId: string,
        projectId: string,
        sceneId: string,
        userId: string
    ): Promise<PlayCanvasEditorMinimalAssetMetadata[]> {
        const [{ payload }, assets] = await Promise.all([
            this.readEditorScene(metahubId, projectId, sceneId, userId),
            this.listAssets(metahubId, projectId, userId)
        ])
        const referenced = new Set<string>()
        for (const asset of payload?.assets ?? []) {
            referenced.add(asset.id)
            if (asset.stableAssetId) referenced.add(asset.stableAssetId)
            if (asset.fileId) referenced.add(asset.fileId)
        }
        return assets
            .filter(
                (asset) =>
                    asset.type === 'json' && (referenced.size === 0 || referenced.has(asset.id) || referenced.has(asset.stableAssetId))
            )
            .map((asset) => ({
                id: asset.id,
                stableAssetId: asset.stableAssetId,
                type: asset.type,
                name: asset.name,
                virtualPath: asset.virtualPath,
                mime: asset.file?.mime ?? null,
                hash: asset.file?.hash ?? null,
                size: asset.file?.size ?? null
            }))
    }

    async readEditorCompatibilitySettings(
        metahubId: string,
        projectId: string,
        kind: CompatibilitySettingsKind,
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySettingsDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const project = await this.requireProject(schemaName, projectId)
        const documentId = settingsDocumentId(kind, projectId, userId)
        const compatibilitySettings = asRecord(project.settings[COMPATIBILITY_SETTINGS_KEY])
        const settingsDocuments = asRecord(compatibilitySettings.settingsDocuments)
        const existing = asRecord(settingsDocuments[documentId])
        const revision = typeof existing.revision === 'string' ? existing.revision : `project-${project.version}`
        const data = asRecord(existing.data)

        return playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
            kind,
            documentId,
            data,
            revision
        })
    }

    async writeEditorCompatibilitySettings(
        metahubId: string,
        projectId: string,
        kind: CompatibilitySettingsKind,
        input: {
            data: PlayCanvasEditorCompatibilitySettingsDocument['data']
            expectedRevision?: string
            requestId: string
        },
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySettingsDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySettingsWriteSessionId({ metahubId, projectId, kind, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SETTINGS_WRITE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                kind,
                data: input.data,
                expectedRevision: input.expectedRevision
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySettingsWriteResult(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility settings write replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const project = await this.requireProject(schemaName, projectId)
            const documentId = settingsDocumentId(kind, projectId, userId)
            const current = await this.readEditorCompatibilitySettings(metahubId, projectId, kind, userId)
            if (input.expectedRevision && input.expectedRevision !== current.revision) {
                throw new OptimisticLockError({
                    entityId: projectId,
                    entityType: 'playcanvasProject',
                    expectedVersion: Number(input.expectedRevision.replace(/^project-/, '')) || 0,
                    actualVersion: project.version,
                    updatedAt: new Date(0),
                    updatedBy: null
                })
            }

            const compatibilitySettings = asRecord(project.settings[COMPATIBILITY_SETTINGS_KEY])
            const settingsDocuments = asRecord(compatibilitySettings.settingsDocuments)
            const nextRevision = `project-${project.version + 1}`
            const nextSettings = {
                ...project.settings,
                [COMPATIBILITY_SETTINGS_KEY]: {
                    ...compatibilitySettings,
                    settingsDocuments: {
                        ...settingsDocuments,
                        [documentId]: {
                            kind,
                            data: input.data,
                            revision: nextRevision,
                            requestId: input.requestId,
                            updatedAt: new Date().toISOString()
                        }
                    }
                }
            }

            const updated = await updatePlayCanvasProject(
                this.exec,
                schemaName,
                projectId,
                {
                    settings: nextSettings,
                    expectedVersion: project.version
                },
                userId
            )
            if (!updated) {
                throw this.optimisticError(projectId, project.version)
            }
            mutationCommitted = true
            const response = playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
                kind,
                documentId,
                data: input.data,
                revision: nextRevision
            })
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility settings replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }

    async loadEditorRealtimeDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: 'scenes' | 'assets' | 'settings' | 'user_data'
        documentId: string
        numericProjectId: number
        numericSceneId: number
        numericUserId: number
    }): Promise<{
        collection: 'scenes' | 'assets' | 'settings' | 'user_data'
        id: string
        data: Record<string, unknown>
        version?: number
        checksum?: string | null
        revision?: string | null
    } | null> {
        if (input.collection === 'scenes') {
            const read = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId)
            return {
                collection: 'scenes',
                id: input.documentId,
                version: read.scene.version,
                checksum: read.scene.checksum ?? null,
                data: {
                    item_id: input.numericSceneId,
                    name: getPrimaryText(read.scene.displayName),
                    settings: normalizeEditorSceneSettings(read.payload?.settings),
                    entities: normalizeRealtimeSceneEntities(read.payload?.entities ?? []),
                    scene: input.numericSceneId
                }
            }
        }

        if (input.collection === 'settings') {
            if (!realtimeSettingsDocumentKind(input.documentId)) {
                throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime settings document', {
                    messageCode: 'playcanvas.editorRealtime.unsupportedSettingsDocument',
                    documentId: input.documentId
                })
            }
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const project = await this.requireProject(schemaName, input.projectId)
            const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
            const documents = asRecord(realtimeSettings.documents)
            const existing = asRecord(documents[input.documentId])
            return {
                collection: 'settings',
                id: input.documentId,
                data: normalizeRealtimeSettingsDocumentData(input.documentId, asRecord(existing.data), {
                    numericProjectId: input.numericProjectId,
                    numericUserId: input.numericUserId
                }),
                version: readRealtimeSettingsDocumentVersion(existing),
                revision: String(readRealtimeSettingsDocumentVersion(existing))
            }
        }

        if (input.collection === 'user_data') {
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: input.metahubId,
                projectId: input.projectId,
                sceneId: input.sceneId,
                userId: input.userId
            })
            assertRealtimeUserDataDocumentId(input.documentId, numericIds.sceneId, numericIds.selfId)
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const project = await this.requireProject(schemaName, input.projectId)
            const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
            const documentsByScene = asRecord(realtimeSettings.userDataDocumentsByScene)
            const existing = asRecord(asRecord(documentsByScene[input.sceneId])[input.userId])
            const scene = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId)
            const data =
                Object.keys(asRecord(existing.data)).length > 0
                    ? normalizePlayCanvasEditorUserData(existing.data)
                    : createPlayCanvasEditorUserData(scene.payload)
            const version = readRealtimeSettingsDocumentVersion(existing)
            return {
                collection: 'user_data',
                id: input.documentId,
                data,
                version,
                revision: String(version)
            }
        }

        const schemaName = await this.resolveSchemaName(input.metahubId)
        const assets = await listPlayCanvasAssets(this.exec, schemaName, input.projectId)
        const asset = resolveRealtimeAssetDocument(assets, input.documentId)
        return {
            collection: 'assets',
            id: input.documentId,
            data: {
                item_id: Number(input.documentId),
                branch_id: input.numericSceneId,
                project: input.numericProjectId,
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
                path: [],
                tags: [],
                data: null,
                meta: null,
                preload: true,
                source: false
            },
            version: asset.version
        }
    }

    async persistEditorRealtimeDocument(input: {
        metahubId: string
        projectId: string
        sceneId: string
        userId: string
        collection: 'scenes' | 'assets' | 'settings' | 'user_data'
        documentId: string
        data: Record<string, unknown>
        version: number
        checksum?: string | null
        revision?: string | null
    }): Promise<{ checksum?: string | null; revision?: string | null } | void> {
        if (input.collection === 'scenes') {
            const entitiesRecord =
                input.data.entities && typeof input.data.entities === 'object' && !Array.isArray(input.data.entities)
                    ? (input.data.entities as Record<string, Record<string, unknown>>)
                    : {}
            const syntheticRootIds = new Set(
                Object.entries(entitiesRecord)
                    .filter(
                        ([id, entity]) =>
                            id === 'root' ||
                            (entity.resource_id === 'root' &&
                                (entity.parent === null || entity.parent === undefined) &&
                                typeof entity.name === 'string' &&
                                entity.name.toLowerCase() === 'root')
                    )
                    .map(([id]) => id)
            )
            const entityIdByDocumentId = new Map(
                Object.entries(entitiesRecord)
                    .filter(([documentId]) => !syntheticRootIds.has(documentId))
                    .map(([documentId, entity]) => [
                        documentId,
                        typeof entity.resource_id === 'string' && entity.resource_id ? entity.resource_id : documentId
                    ])
            )
            const resolveRealtimeEntityId = (value: unknown): string | null => {
                if (typeof value !== 'string' || syntheticRootIds.has(value)) {
                    return null
                }
                return entityIdByDocumentId.get(value) ?? value
            }
            const currentBeforeSave = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId)
            const existingMetadata =
                currentBeforeSave.payload?.metadata &&
                typeof currentBeforeSave.payload.metadata === 'object' &&
                !Array.isArray(currentBeforeSave.payload.metadata)
                    ? currentBeforeSave.payload.metadata
                    : undefined
            const incomingMetadata =
                input.data.metadata && typeof input.data.metadata === 'object' && !Array.isArray(input.data.metadata)
                    ? (input.data.metadata as Record<string, never>)
                    : undefined
            const effectiveMetadata = incomingMetadata ?? existingMetadata
            const entities = Object.entries(entitiesRecord)
                .filter(([id]) => !syntheticRootIds.has(id))
                .map(([id, entity]) => {
                    const entityId = entityIdByDocumentId.get(id) ?? id
                    const previousEntity = findEditorSceneEntityById(currentBeforeSave.payload, entityId)
                    const position = readPlayCanvasEditorVector3Tuple(entity.position, previousEntity?.position)
                    const rotation = readPlayCanvasEditorVector3Tuple(entity.rotation, previousEntity?.rotation)
                    const scale = readPlayCanvasEditorVector3Tuple(entity.scale, previousEntity?.scale)
                    const hasComponentsRecord =
                        entity.components && typeof entity.components === 'object' && !Array.isArray(entity.components)
                    const normalizedComponents = normalizeEditorEntityComponents(hasComponentsRecord ? entity.components : {}, entity)
                    return {
                        id: entityId,
                        name: typeof entity.name === 'string' ? entity.name : previousEntity?.name ?? 'Entity',
                        parentId: resolveRealtimeEntityId(entity.parent),
                        enabled: typeof entity.enabled === 'boolean' ? entity.enabled : previousEntity?.enabled ?? true,
                        ...(position ? { position } : {}),
                        ...(rotation ? { rotation } : {}),
                        ...(scale ? { scale } : {}),
                        components:
                            hasComponentsRecord || Object.keys(normalizedComponents).length > 0
                                ? normalizedComponents
                                : previousEntity?.components ?? {},
                        children: Array.isArray(entity.children)
                            ? entity.children
                                  .map((child) => resolveRealtimeEntityId(child))
                                  .filter((child): child is string => typeof child === 'string')
                            : previousEntity?.children ?? []
                    }
                })
            const payload = playCanvasEditorCompatibilityScenePayloadSchema.parse({
                schemaVersion: PLAYCANVAS_PROJECT_SCHEMA_VERSION,
                settings: normalizeEditorSceneSettings(input.data.settings),
                metadata: syncMmoommMetadataWithEditorEntities(effectiveMetadata, entities),
                entities
            })
            if (areEditorScenePayloadsEqual(currentBeforeSave.payload, payload)) {
                return { checksum: currentBeforeSave.scene.checksum ?? null }
            }
            const expectedCurrentChecksum = input.checksum !== undefined ? input.checksum : currentBeforeSave.scene.checksum ?? null
            try {
                const saved = await this.saveEditorCompatibilityScene(
                    input.metahubId,
                    input.projectId,
                    input.sceneId,
                    {
                        requestId: generateUuidV7(),
                        payload,
                        expectedCurrentChecksum
                    },
                    input.userId
                )
                return { checksum: saved.checksum ?? null }
            } catch (error) {
                if (!isCurrentChecksumMismatch(error)) {
                    throw error
                }

                const current = await this.readEditorScene(input.metahubId, input.projectId, input.sceneId, input.userId)
                if (!areEditorScenePayloadsEqual(current.payload, payload)) {
                    throw error
                }
                return { checksum: current.scene.checksum ?? null }
            }
        }

        if (input.collection === 'settings') {
            const kind = realtimeSettingsDocumentKind(input.documentId)
            if (!kind) {
                throw new MetahubValidationError('Unsupported PlayCanvas Editor realtime settings document', {
                    messageCode: 'playcanvas.editorRealtime.unsupportedSettingsDocument',
                    documentId: input.documentId
                })
            }
            const parsed = playCanvasEditorCompatibilitySettingsDocumentSchema.parse({
                kind,
                documentId: input.documentId,
                data: input.data,
                revision: String(input.version)
            })
            const schemaName = await this.resolveSchemaName(input.metahubId)
            const maxAttempts = 8
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const project = await this.requireProject(schemaName, input.projectId)
                const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
                const documents = asRecord(realtimeSettings.documents)
                const existing = asRecord(documents[input.documentId])
                const existingVersion = readRealtimeSettingsDocumentVersion(existing)
                if (input.revision !== undefined && input.revision !== null && input.revision !== String(existingVersion)) {
                    if (stableStringify(asRecord(existing.data)) === stableStringify(parsed.data)) {
                        return { revision: String(existingVersion) }
                    }
                    throw new MetahubValidationError('PlayCanvas Editor realtime settings revision mismatch', {
                        messageCode: 'playcanvas.editorRealtime.settingsRevisionMismatch',
                        documentId: input.documentId,
                        expectedRevision: input.revision,
                        actualRevision: String(existingVersion)
                    })
                }
                const updated = await updatePlayCanvasProject(
                    this.exec,
                    schemaName,
                    input.projectId,
                    {
                        settings: {
                            ...project.settings,
                            [REALTIME_SETTINGS_KEY]: {
                                ...realtimeSettings,
                                documents: {
                                    ...documents,
                                    [input.documentId]: {
                                        data: parsed.data,
                                        version: input.version,
                                        updatedAt: new Date().toISOString()
                                    }
                                }
                            }
                        },
                        expectedVersion: project.version
                    },
                    input.userId
                )
                if (updated) {
                    return { revision: String(input.version) }
                }
                if (attempt === maxAttempts) {
                    throw this.optimisticError(input.projectId, project.version)
                }
                await waitForRealtimeSettingsRetry(attempt)
            }
        }

        if (input.collection === 'user_data') {
            const numericIds = createPlayCanvasEditorNumericIds({
                metahubId: input.metahubId,
                projectId: input.projectId,
                sceneId: input.sceneId,
                userId: input.userId
            })
            assertRealtimeUserDataDocumentId(input.documentId, numericIds.sceneId, numericIds.selfId)
            const schemaName = await this.resolveSchemaName(input.metahubId)
            let parsed: Record<string, unknown>
            try {
                parsed = normalizePlayCanvasEditorUserData(input.data)
            } catch (error) {
                throw new MetahubValidationError('Invalid PlayCanvas Editor realtime user data document', {
                    messageCode: 'playcanvas.editorRealtime.invalidUserDataDocument',
                    documentId: input.documentId,
                    reason: error instanceof Error ? error.message : String(error)
                })
            }
            const maxAttempts = 8
            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const project = await this.requireProject(schemaName, input.projectId)
                const realtimeSettings = asRecord(project.settings[REALTIME_SETTINGS_KEY])
                const documentsByScene = asRecord(realtimeSettings.userDataDocumentsByScene)
                const documentsByUser = asRecord(documentsByScene[input.sceneId])
                const existing = asRecord(documentsByUser[input.userId])
                const existingVersion = readRealtimeSettingsDocumentVersion(existing)
                if (input.revision !== undefined && input.revision !== null && input.revision !== String(existingVersion)) {
                    if (stableStringify(asRecord(existing.data)) === stableStringify(parsed)) {
                        return { revision: String(existingVersion) }
                    }
                    throw new MetahubValidationError('PlayCanvas Editor realtime user data revision mismatch', {
                        messageCode: 'playcanvas.editorRealtime.userDataRevisionMismatch',
                        documentId: input.documentId,
                        expectedRevision: input.revision,
                        actualRevision: String(existingVersion)
                    })
                }
                const updated = await updatePlayCanvasProject(
                    this.exec,
                    schemaName,
                    input.projectId,
                    {
                        settings: {
                            ...project.settings,
                            [REALTIME_SETTINGS_KEY]: {
                                ...realtimeSettings,
                                userDataDocumentsByScene: {
                                    ...documentsByScene,
                                    [input.sceneId]: {
                                        ...documentsByUser,
                                        [input.userId]: {
                                            data: parsed,
                                            version: input.version,
                                            updatedAt: new Date().toISOString()
                                        }
                                    }
                                }
                            }
                        },
                        expectedVersion: project.version
                    },
                    input.userId
                )
                if (updated) {
                    return { revision: String(input.version) }
                }
                if (attempt === maxAttempts) {
                    throw this.optimisticError(input.projectId, project.version)
                }
                await waitForRealtimeSettingsRetry(attempt)
            }
        }

        if (input.collection === 'assets') {
            const schemaName = await this.resolveSchemaName(input.metahubId)
            await this.requireProject(schemaName, input.projectId)
            const assets = await listPlayCanvasAssets(this.exec, schemaName, input.projectId)
            const asset = resolveRealtimeAssetDocument(assets, input.documentId)
            const nextType = isPlayCanvasAssetType(input.data.type) ? input.data.type : asset.type
            const nextName = typeof input.data.name === 'string' && input.data.name.trim() ? input.data.name.trim() : asset.name
            const nextPath = asStringArray(input.data.path)
            const nextMetadata = {
                ...asset.metadata,
                editorDocument: {
                    data: input.data.data ?? null,
                    meta: input.data.meta ?? null,
                    tags: asStringArray(input.data.tags),
                    preload: typeof input.data.preload === 'boolean' ? input.data.preload : true,
                    source: typeof input.data.source === 'boolean' ? input.data.source : false,
                    version: input.version
                }
            }
            const updated = await upsertPlayCanvasAsset(
                this.exec,
                schemaName,
                input.projectId,
                {
                    id: asset.id,
                    stableAssetId: asset.stableAssetId,
                    type: nextType,
                    name: nextName,
                    virtualPath: nextPath.length > 0 ? nextPath : asset.virtualPath,
                    file: asset.file,
                    metadata: nextMetadata,
                    publish: asset.publish,
                    expectedVersion: asset.version
                },
                input.userId
            )
            if (!updated) {
                throw this.optimisticError(asset.id, asset.version)
            }
            return { revision: String(updated.version) }
        }
    }

    async writeAssetMetadata(
        metahubId: string,
        projectId: string,
        input: Omit<PlayCanvasAsset, 'projectId'> & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasAsset & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const file = this.assertAssetFileReference(projectId, input.type, input.file)
        const asset = await upsertPlayCanvasAsset(this.exec, schemaName, projectId, { ...input, file }, userId)
        if (!asset) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return asset
    }

    async resolveScriptAsset(
        metahubId: string,
        projectId: string,
        input: PlayCanvasScriptAsset & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasScriptAsset & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const script = await upsertPlayCanvasScriptAsset(this.exec, schemaName, projectId, input, userId)
        if (!script) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return script
    }

    async writeSceneScriptBinding(
        metahubId: string,
        projectId: string,
        input: PlayCanvasSceneScriptBinding & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasSceneScriptBinding & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const binding = await upsertPlayCanvasSceneScriptBinding(this.exec, schemaName, projectId, input, userId)
        if (!binding) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return binding
    }

    async upsertGeneratedArtifact(
        metahubId: string,
        projectId: string,
        input: PlayCanvasGeneratedArtifact & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasGeneratedArtifact & { version: number }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const outputFile = this.assertGeneratedArtifactFileReference(projectId, input.outputFile)
        const artifact = await upsertPlayCanvasGeneratedArtifact(this.exec, schemaName, projectId, { ...input, outputFile }, userId)
        if (!artifact) {
            throw this.optimisticError(input.id, input.expectedVersion)
        }
        return artifact
    }

    async publishProjectState(metahubId: string, projectId: string, userId: string): Promise<PlayCanvasRuntimeManifest[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const hasActiveReplayClaims = await sessionService.hasActiveReplayClaims(this.exec, schemaName, { metahubId, projectId })
        if (hasActiveReplayClaims) {
            throw new MetahubConflictError('PlayCanvas Editor project has pending compatibility writes', {
                messageCode: 'playcanvas.publish.pendingEditorWrites',
                projectId
            })
        }
        const snapshot = await new PlayCanvasProjectSnapshotService(this.exec, this.schemaService, this.fileService).exportProjectSnapshot(
            metahubId,
            projectId
        )
        const runtimeManifests = snapshot?.runtimeManifests ?? []
        if (runtimeManifests.length === 0) {
            throw new MetahubValidationError('PlayCanvas project has no publishable runtime manifests', {
                messageCode: 'playcanvas.publish.noRuntimeManifests',
                projectId
            })
        }
        await replacePlayCanvasPublicationManifests(this.exec, schemaName, {
            projectIds: [projectId],
            manifests: runtimeManifests,
            userId,
            replaceScope: 'projects'
        })
        return runtimeManifests
    }

    async listPublishedRuntimeManifests(metahubId: string) {
        const schemaName = await this.resolveSchemaName(metahubId)
        return listPlayCanvasPublicationManifests(this.exec, schemaName)
    }

    async exportProjectState(metahubId: string, projectId: string, _userId: string) {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const snapshot = await new PlayCanvasProjectSnapshotService(this.exec, this.schemaService, this.fileService).exportSnapshot(
            metahubId,
            { projectIds: [projectId] }
        )
        if (!snapshot) return null
        return snapshot
    }

    async updateProjectSettings(
        metahubId: string,
        projectId: string,
        input: UpdatePlayCanvasProjectSettingsRequest & { expectedVersion?: number },
        userId: string
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        if (input.defaultSceneId) {
            const scene = await findPlayCanvasScene(this.exec, schemaName, projectId, input.defaultSceneId)
            if (!scene) {
                throw new MetahubValidationError('PlayCanvas default scene was not found', {
                    messageCode: 'playcanvas.project.defaultSceneNotFound',
                    projectId,
                    sceneId: input.defaultSceneId
                })
            }
        }
        const updateInput = { ...input }
        if (input.settings !== undefined) {
            if (input.expectedVersion === undefined) {
                throw new MetahubValidationError('PlayCanvas project settings updates require an expected version', {
                    messageCode: 'playcanvas.project.settingsExpectedVersionRequired',
                    projectId
                })
            }
            if (Object.prototype.hasOwnProperty.call(input.settings, REALTIME_SETTINGS_KEY)) {
                throw new MetahubValidationError('PlayCanvas Editor realtime settings are reserved for the realtime adapter', {
                    messageCode: 'playcanvas.project.settingsReservedKey',
                    projectId,
                    settingsKey: REALTIME_SETTINGS_KEY
                })
            }
            const project = await this.requireProject(schemaName, projectId)
            updateInput.settings = {
                ...input.settings,
                ...(project.settings[REALTIME_SETTINGS_KEY] === undefined
                    ? {}
                    : { [REALTIME_SETTINGS_KEY]: project.settings[REALTIME_SETTINGS_KEY] })
            }
        }
        const updated = await updatePlayCanvasProject(this.exec, schemaName, projectId, updateInput, userId)
        if (!updated) {
            throw new OptimisticLockError({
                entityId: projectId,
                entityType: 'playcanvasProject',
                expectedVersion: input.expectedVersion ?? 0,
                actualVersion: 0,
                updatedAt: new Date(0),
                updatedBy: null
            })
        }
        return summarizePlayCanvasProject(this.exec, schemaName, updated)
    }

    async deleteProject(
        metahubId: string,
        projectId: string,
        input: { expectedVersion: number },
        userId: string
    ): Promise<PlayCanvasProjectSummary> {
        const schemaName = await this.resolveSchemaName(metahubId)
        const deleted = await softDeletePlayCanvasProject(this.exec, schemaName, projectId, userId, input.expectedVersion)
        if (!deleted) {
            throw new OptimisticLockError({
                entityId: projectId,
                entityType: 'playcanvasProject',
                expectedVersion: input.expectedVersion ?? 0,
                actualVersion: 0,
                updatedAt: new Date(0),
                updatedBy: null
            })
        }
        let clearedPackagePointers: Array<{ id: string; config: Record<string, unknown> }> = []
        let fileCleanupStarted = false
        try {
            clearedPackagePointers = await clearPlayCanvasDefaultProjectPointers(this.exec, metahubId, projectId, userId)
            fileCleanupStarted = true
            await this.fileService.deleteProjectTree({ metahubId, branchSlug: schemaName }, projectId)
        } catch (error) {
            if (!fileCleanupStarted) {
                await restoreSoftDeletedPlayCanvasProject(this.exec, schemaName, projectId, userId, deleted.deletionToken).catch(
                    (rollbackError) => {
                        log.warn('Failed to roll back PlayCanvas project metadata after package default pointer cleanup failure', {
                            metahubId,
                            schemaName,
                            projectId,
                            error: rollbackError
                        })
                    }
                )
                throw error
            }
            if (clearedPackagePointers.length > 0) {
                log.warn(
                    'PlayCanvas package default project pointers were cleared and will remain cleared because project file cleanup may be partial',
                    {
                        metahubId,
                        projectId,
                        clearedPackagePointerCount: clearedPackagePointers.length
                    }
                )
            }
            log.warn(
                'PlayCanvas project file cleanup failed after metadata was soft-deleted; leaving project deleted to avoid live metadata pointing at partially removed files',
                {
                    metahubId,
                    schemaName,
                    projectId,
                    error
                }
            )
            throw error
        }
        return summarizePlayCanvasProject(this.exec, schemaName, deleted)
    }

    async readProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        _userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; contentBase64: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath)
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, safePath)
        return {
            sourcePath: read.sourcePath,
            checksum: read.checksum,
            size: read.size,
            contentBase64: read.content.toString('base64')
        }
    }

    async readAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        _userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; contentBase64: string }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
        return {
            sourcePath: read.sourcePath,
            checksum: read.checksum,
            size: read.size,
            contentBase64: read.content.toString('base64')
        }
    }

    async listEditorCompatibilitySourceFiles(
        metahubId: string,
        projectId: string,
        _userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileSummary[]> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const sourceFiles = await listPlayCanvasSourceFiles(this.exec, schemaName, projectId)
        return sourceFiles.map((sourceFile) => ({
            id: sourceFile.stableSourceFileId,
            path: sourceFile.file.path,
            filename: sourceFile.name,
            name: sourceFile.name,
            hash: sourceFile.file.hash ?? sourceFile.checksum ?? null,
            size: sourceFile.file.size ?? null,
            mime: sourceFile.file.mime ?? 'text/javascript',
            updatedAt: null
        }))
    }

    async readEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        _userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sourceFile = await findPlayCanvasSourceFileByStableId(this.exec, schemaName, projectId, stableSourceFileId)
        if (!sourceFile) {
            throw new MetahubValidationError('PlayCanvas sourcefile was not found', {
                messageCode: 'playcanvas.sourcefiles.notFound',
                sourceFileId
            })
        }
        const sourcePath = this.assertSourceFileReference(projectId, sourceFile.file)?.path
        if (!sourcePath) {
            throw new MetahubValidationError('PlayCanvas sourcefile metadata does not reference a source file', {
                messageCode: 'playcanvas.files.role.sourcefileMismatch',
                sourceFileId
            })
        }
        const read = await this.fileService.read({ metahubId, branchSlug: schemaName }, sourcePath)
        const content = read.content.toString('utf8')
        return {
            id: sourceFile.stableSourceFileId,
            path: sourcePath,
            name: sourceFile.name,
            content,
            hash: read.checksum,
            size: read.size,
            mime: sourceFile.file.mime ?? 'text/javascript',
            updatedAt: null
        }
    }

    async writeEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: {
            requestId: string
            path: string
            name?: string
            content: string
            expectedCurrentChecksum?: string | null
        },
        userId: string
    ): Promise<PlayCanvasEditorCompatibilitySourceFileDocument> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sourcePath = normalizeEditorSourceFilePath(projectId, stableSourceFileId, input.path, this.fileService)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySourceFileSessionId({ metahubId, projectId, sourceFileId: stableSourceFileId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SOURCEFILE_WRITE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                path: sourcePath,
                name: input.name ?? null,
                content: input.content,
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySourceFileDocument(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility sourcefile write replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const existing = await findPlayCanvasSourceFileByStableId(this.exec, schemaName, projectId, stableSourceFileId)
            const existingSourcePath = existing ? this.assertSourceFileReference(projectId, existing.file)?.path ?? null : null
            if (existing && existingSourcePath !== sourcePath) {
                throw new MetahubValidationError('PlayCanvas sourcefile path changes are not supported for existing sourcefile ids', {
                    messageCode: 'playcanvas.files.sourcefile.pathChangeUnsupported',
                    sourceFileId: stableSourceFileId,
                    existingSourcePath,
                    sourcePath
                })
            }
            const sourceFileIdForStorage = existing?.id ?? generateUuidV7()
            const name = existing?.name ?? getEditorSourceFileName(stableSourceFileId, input.path, input.name)
            const initialFile = {
                provider: 'local',
                root: PLAYCANVAS_PROJECT_FILE_ROOT,
                path: sourcePath,
                hash: existing?.file.hash ?? input.expectedCurrentChecksum ?? null,
                size: existing?.file.size ?? null,
                mime: existing?.file.mime ?? 'text/javascript',
                status: existing?.file.status ?? 'missing'
            } satisfies PlayCanvasSourceFile['file']
            this.assertSourceFileReference(projectId, initialFile)
            const metadata = await upsertPlayCanvasSourceFile(
                this.exec,
                schemaName,
                projectId,
                {
                    id: sourceFileIdForStorage,
                    stableSourceFileId,
                    name,
                    virtualPath: [name],
                    file: initialFile,
                    scriptKind: 'esm',
                    checksum: initialFile.hash ?? null,
                    parsedAttributes: existing?.parsedAttributes ?? {},
                    parseStatus: 'missing',
                    parseDiagnostics: existing?.parseDiagnostics ?? null,
                    publish: existing?.publish ?? true,
                    expectedVersion: existing?.version
                },
                userId
            )
            if (!metadata) {
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            const scope = { metahubId, branchSlug: schemaName }
            const previous = await this.readFileForRollback(scope, sourcePath)
            let written: { sourcePath: string; checksum: string; size: number; mime: string | null }
            try {
                written = await this.fileService.write(scope, sourcePath, Buffer.from(input.content, 'utf8'), {
                    expectedChecksum: null,
                    expectedCurrentChecksum: input.expectedCurrentChecksum ?? null,
                    mime: 'text/javascript'
                })
            } catch (error) {
                await this.markSourceFileMetadataMissingAfterWriteFailure(
                    schemaName,
                    projectId,
                    sourcePath,
                    stableSourceFileId,
                    userId,
                    existing ?? null,
                    metadata.version
                )
                throw error
            }
            const finalMime = written.mime ?? 'text/javascript'
            const finalFile = {
                ...initialFile,
                hash: written.checksum,
                size: written.size,
                mime: finalMime,
                status: 'ready'
            } satisfies PlayCanvasSourceFile['file']
            try {
                const finalized = await upsertPlayCanvasSourceFile(
                    this.exec,
                    schemaName,
                    projectId,
                    {
                        id: metadata.id,
                        stableSourceFileId,
                        name,
                        virtualPath: [name],
                        file: finalFile,
                        scriptKind: metadata.scriptKind,
                        checksum: written.checksum,
                        parsedAttributes: metadata.parsedAttributes,
                        parseStatus: 'ready',
                        parseDiagnostics: metadata.parseDiagnostics,
                        publish: metadata.publish,
                        expectedVersion: metadata.version
                    },
                    userId
                )
                if (finalized) {
                    mutationCommitted = true
                }
            } finally {
                if (!mutationCommitted) {
                    await this.markSourceFileMetadataMissingAfterWriteFailure(
                        schemaName,
                        projectId,
                        sourcePath,
                        stableSourceFileId,
                        userId,
                        existing ?? null,
                        metadata.version
                    )
                }
            }
            if (!mutationCommitted) {
                await this.rollbackFileWrite(scope, sourcePath, written.checksum, previous, finalMime)
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            const response = {
                id: stableSourceFileId,
                path: written.sourcePath,
                name,
                content: input.content,
                hash: written.checksum,
                size: written.size,
                mime: written.mime ?? 'text/javascript',
                updatedAt: null
            } satisfies PlayCanvasEditorCompatibilitySourceFileDocument
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility sourcefile write replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }

    async deleteEditorCompatibilitySourceFile(
        metahubId: string,
        projectId: string,
        sourceFileId: string,
        input: { requestId: string; expectedCurrentChecksum?: string | null },
        userId: string
    ): Promise<{ id: string; deleted: true }> {
        if (!input.expectedCurrentChecksum) {
            throw new MetahubValidationError('Current file checksum is required', {
                messageCode: 'playcanvas.files.path.currentChecksumRequired',
                sourceFileId
            })
        }
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const stableSourceFileId = normalizeEditorSourceFileStableId(sourceFileId)
        const sessionService = new PlayCanvasEditorBridgeSessionService()
        const replayInput = {
            sessionId: compatibilitySourceFileSessionId({ metahubId, projectId, sourceFileId: stableSourceFileId, userId }),
            metahubId,
            projectId,
            requestId: input.requestId,
            commandType: COMPATIBILITY_SOURCEFILE_DELETE_COMMAND_TYPE,
            fingerprint: hashEditorCompatibilityReplayFingerprint({
                expectedCurrentChecksum: input.expectedCurrentChecksum
            }),
            expiresAt: Date.now() + PLAYCANVAS_EDITOR_BRIDGE_SESSION_TTL_MS,
            userId
        }
        const claimed = await sessionService.claimReplay(this.exec, schemaName, replayInput)
        if (!claimed) {
            const storedResponse = await sessionService.readReplayResponse(this.exec, schemaName, replayInput)
            if (storedResponse?.status === 'completed' && isEditorCompatibilitySourceFileDeleteResult(storedResponse.response)) {
                return storedResponse.response
            }
            throw new MetahubConflictError('PlayCanvas Editor compatibility sourcefile delete replay is already in progress', {
                messageCode: 'playcanvas.editorCompatibility.replayRejected',
                requestId: input.requestId
            })
        }

        let mutationCommitted = false
        let replayClaimReleased = false
        const releaseReplayClaim = async () => {
            if (replayClaimReleased) return
            replayClaimReleased = true
            await sessionService.releaseReplay(this.exec, schemaName, replayInput).catch(() => undefined)
        }
        try {
            const sourceFile = await findPlayCanvasSourceFileByStableId(this.exec, schemaName, projectId, stableSourceFileId)
            if (!sourceFile) {
                throw new MetahubValidationError('PlayCanvas sourcefile was not found', {
                    messageCode: 'playcanvas.sourcefiles.notFound',
                    sourceFileId
                })
            }
            const sourcePath = sourceFile.file.path
            const safePath = this.assertSourceFileReference(projectId, sourceFile.file)?.path ?? null
            if (!safePath) {
                throw new MetahubValidationError('PlayCanvas sourcefile metadata does not reference a source file', {
                    messageCode: 'playcanvas.files.role.sourcefileMismatch',
                    sourceFileId
                })
            }
            const scope = { metahubId, branchSlug: schemaName }
            const previous = await this.readFileForRollback(scope, safePath)
            const physicallyDeleted = await this.fileService.deleteIfCurrentChecksum(scope, safePath, input.expectedCurrentChecksum)
            if (!physicallyDeleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum: input.expectedCurrentChecksum,
                    sourcePath: safePath
                })
            }
            const deleted = await softDeletePlayCanvasSourceFileByStableId(
                this.exec,
                schemaName,
                projectId,
                stableSourceFileId,
                userId,
                sourceFile.version
            )
            if (!deleted) {
                await this.rollbackPhysicalDelete(scope, safePath, previous, sourceFile.file.mime)
                throw this.metadataUpdateError(projectId, sourcePath)
            }
            mutationCommitted = true
            const response = { id: stableSourceFileId, deleted: true } as const
            const completed = await sessionService.completeReplay(this.exec, schemaName, {
                ...replayInput,
                response,
                userId
            })
            if (!completed) {
                throw new MetahubDomainError({
                    message: 'PlayCanvas Editor compatibility sourcefile delete replay response could not be recorded',
                    statusCode: 503,
                    code: 'SCHEMA_SYNC_FAILED',
                    details: {
                        messageCode: 'playcanvas.editorCompatibility.replayCompletionFailed',
                        requestId: input.requestId
                    }
                })
            }
            return response
        } catch (error) {
            if (!mutationCommitted) {
                await releaseReplayClaim()
            }
            throw error
        }
    }

    async writeProjectFile(
        metahubId: string,
        projectId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, input.sourcePath)
        const content = decodeStrictBase64(input.contentBase64)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const written = await this.fileService.write(scope, safePath, content, {
            expectedChecksum: input.expectedChecksum,
            expectedCurrentChecksum: input.expectedCurrentChecksum,
            mime: input.mime
        })
        try {
            const marked = await markPlayCanvasProjectFileReferenceReady(this.exec, schemaName, projectId, safePath, written, userId)
            if (!marked) {
                throw this.metadataUpdateError(projectId, safePath)
            }
        } catch (error) {
            await this.rollbackFileWrite(scope, safePath, written.checksum, previous, input.mime)
            throw error
        }
        return {
            sourcePath: written.sourcePath,
            checksum: written.checksum,
            size: written.size,
            mime: written.mime
        }
    }

    async writeAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        input: {
            sourcePath: string
            contentBase64: string
            expectedChecksum?: string | null
            expectedCurrentChecksum: string | null
            mime?: string | null
        },
        userId: string
    ): Promise<{ sourcePath: string; checksum: string; size: number; mime: string | null }> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, input.sourcePath)
        const content = decodeStrictBase64(input.contentBase64)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, input.sourcePath)
        const written = await this.fileService.write(scope, input.sourcePath, content, {
            expectedChecksum: input.expectedChecksum,
            expectedCurrentChecksum: input.expectedCurrentChecksum,
            mime: input.mime
        })
        try {
            const marked = await markPlayCanvasAssetFileReferenceReady(
                this.exec,
                schemaName,
                projectId,
                assetId,
                input.sourcePath,
                written,
                userId
            )
            if (!marked) {
                throw this.metadataUpdateError(projectId, input.sourcePath)
            }
        } catch (error) {
            await this.rollbackFileWrite(scope, input.sourcePath, written.checksum, previous, input.mime)
            throw error
        }
        return {
            sourcePath: written.sourcePath,
            checksum: written.checksum,
            size: written.size,
            mime: written.mime
        }
    }

    async deleteProjectFile(
        metahubId: string,
        projectId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireProject(schemaName, projectId)
        const safePath = await this.requireProjectMetadataFilePath(schemaName, projectId, sourcePath)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, safePath)
        const markedMissing = await markPlayCanvasProjectFileReferenceMissing(this.exec, schemaName, projectId, safePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, safePath)
        }
        try {
            const deleted = await this.fileService.deleteIfCurrentChecksum(scope, safePath, expectedCurrentChecksum)
            if (!deleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum,
                    sourcePath: safePath
                })
            }
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasProjectFileReferenceReady(
                    this.exec,
                    schemaName,
                    projectId,
                    safePath,
                    { ...previous.file, mime: null },
                    userId
                )
                if (!restored) {
                    log.warn('Failed to restore PlayCanvas project file metadata after physical delete failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        sourcePath: safePath
                    })
                }
            }
            throw error
        }
    }

    async deleteAssetFile(
        metahubId: string,
        projectId: string,
        assetId: string,
        sourcePath: string,
        expectedCurrentChecksum: string,
        userId: string
    ): Promise<void> {
        const schemaName = await this.resolveSchemaName(metahubId)
        await this.requireAssetFilePath(schemaName, projectId, assetId, sourcePath)
        const scope = { metahubId, branchSlug: schemaName }
        const previous = await this.readFileForRollback(scope, sourcePath)
        const markedMissing = await markPlayCanvasAssetFileReferenceMissing(this.exec, schemaName, projectId, assetId, sourcePath, userId)
        if (!markedMissing) {
            throw this.metadataUpdateError(projectId, sourcePath)
        }
        try {
            const deleted = await this.fileService.deleteIfCurrentChecksum(scope, sourcePath, expectedCurrentChecksum)
            if (!deleted) {
                throw new MetahubValidationError('Current file checksum does not match', {
                    messageCode: 'playcanvas.files.path.currentChecksumMismatch',
                    expectedCurrentChecksum,
                    sourcePath
                })
            }
        } catch (error) {
            if (previous.exists) {
                const restored = await markPlayCanvasAssetFileReferenceReady(
                    this.exec,
                    schemaName,
                    projectId,
                    assetId,
                    sourcePath,
                    { ...previous.file, mime: null },
                    userId
                )
                if (!restored) {
                    log.warn('Failed to restore PlayCanvas asset file metadata after physical delete failure', {
                        metahubId,
                        schemaName,
                        projectId,
                        assetId,
                        sourcePath
                    })
                }
            }
            throw error
        }
    }

    private async requireProject(schemaName: string, projectId: string) {
        const existing = await findPlayCanvasProject(this.exec, schemaName, projectId)
        if (!existing) {
            throw new MetahubValidationError('PlayCanvas project was not found', {
                messageCode: 'playcanvas.projects.notFound',
                projectId
            })
        }
        return existing
    }

    private assertProjectPath(projectId: string, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        if (!safePath.startsWith(`playcanvas-projects/${projectId}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path must belong to the requested project', {
                messageCode: 'playcanvas.files.path.projectMismatch'
            })
        }
        return safePath
    }

    private assertProjectSubdirectoryPath(
        projectId: string,
        sourcePath: string,
        subdirectory: 'assets' | 'generated' | 'scenes' | 'sourcefiles'
    ): void {
        if (!sourcePath.startsWith(`playcanvas-projects/${projectId}/${subdirectory}/`)) {
            throw new MetahubValidationError('PlayCanvas project file path does not match the required storage role', {
                messageCode: `playcanvas.files.role.${subdirectory}PathMismatch`
            })
        }
    }

    private async requireProjectMetadataFilePath(schemaName: string, projectId: string, sourcePath: string): Promise<string> {
        const safePath = this.assertProjectPath(projectId, sourcePath)
        const exists = await playCanvasProjectMetadataFileReferenceExists(this.exec, schemaName, projectId, safePath)
        if (!exists) {
            throw new MetahubValidationError('PlayCanvas project file path must be referenced by scene or generated artifact metadata', {
                messageCode: 'playcanvas.files.path.untracked'
            })
        }
        return safePath
    }

    private assertFileReference<T extends { provider?: string; root?: string; path?: string; mime?: string | null }>(
        projectId: string,
        file: T | null | undefined
    ): (T & { path: string }) | null {
        if (!file) return null
        if (file.provider !== 'local') {
            throw new MetahubValidationError('PlayCanvas project metadata file references must use local project storage', {
                messageCode: 'playcanvas.files.provider.unsupported',
                provider: file.provider
            })
        }
        if (file.root !== PLAYCANVAS_PROJECT_FILE_ROOT) {
            throw new MetahubValidationError('PlayCanvas project file path must start with playcanvas-projects/', {
                messageCode: 'playcanvas.files.path.namespaceRequired'
            })
        }
        const safePath = this.assertProjectPath(projectId, file.path ?? '')
        assertPlayCanvasProjectMimeForPath(safePath, file.mime)
        return { ...file, path: safePath }
    }

    private assertScenePayloadFileReference(
        projectId: string,
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'scenes')
        if (!isPlayCanvasScenePayloadFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas scene payload files must be JSON files', {
                messageCode: 'playcanvas.files.role.scenePayloadMismatch'
            })
        }
        return checked
    }

    private assertEditorScenePayloadPath(projectId: string, sceneId: string, sourcePath: string): string {
        const safePath = assertSafeRelativePlayCanvasProjectPath(sourcePath)
        const expectedPath = this.fileService.buildDefaultScenePath(projectId, sceneId)
        if (safePath !== expectedPath) {
            throw new MetahubValidationError('PlayCanvas editor scene payload file path must belong to the requested scene', {
                messageCode: 'playcanvas.editor.scenePayloadPathMismatch',
                projectId,
                sceneId,
                sourcePath: safePath
            })
        }
        return safePath
    }

    private assertAssetFileReference(
        projectId: string,
        assetType: PlayCanvasAsset['type'],
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'assets')
        if (!isPlayCanvasAssetFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas asset files must be stored in the project assets directory', {
                messageCode: 'playcanvas.files.role.assetPathMismatch',
                assetType
            })
        }
        if (
            (assetType === 'scene' || assetType === 'json') &&
            !isPlayCanvasJsonFileReference({ path: checked.path ?? '', mime: checked.mime })
        ) {
            throw new MetahubValidationError('PlayCanvas scene and JSON assets must reference JSON files', {
                messageCode: 'playcanvas.files.role.assetJsonMismatch',
                assetType
            })
        }
        if (
            (assetType === 'script' || assetType === 'generatedScript') &&
            !isPlayCanvasScriptFileReference({ path: checked.path ?? '', mime: checked.mime })
        ) {
            throw new MetahubValidationError('PlayCanvas script assets must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.assetScriptMismatch',
                assetType
            })
        }
        if (
            !['scene', 'json', 'script', 'generatedScript'].includes(assetType) &&
            !isPlayCanvasJsonFileReference({ path: checked.path ?? '', mime: checked.mime }) &&
            !(assetType === 'texture' && isPlayCanvasImageFileReference({ path: checked.path ?? '', mime: checked.mime }))
        ) {
            throw new MetahubValidationError('PlayCanvas non-script sidecar assets must reference JSON files or supported texture images', {
                messageCode: 'playcanvas.files.role.assetSidecarMismatch',
                assetType
            })
        }
        return checked
    }

    private assertSourceFileReference(projectId: string, file: PlayCanvasFileReference | null | undefined): PlayCanvasFileReference | null {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) return null
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'sourcefiles')
        if (!isPlayCanvasSourceFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas sourcefiles must be JavaScript files in the sourcefiles directory', {
                messageCode: 'playcanvas.files.role.sourcefileMismatch'
            })
        }
        return checked
    }

    private assertGeneratedArtifactFileReference(
        projectId: string,
        file: PlayCanvasFileReference | null | undefined
    ): PlayCanvasFileReference {
        const checked = this.assertFileReference(projectId, file)
        if (!checked) {
            throw new MetahubValidationError('PlayCanvas generated artifacts must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.generatedArtifactMismatch'
            })
        }
        this.assertProjectSubdirectoryPath(projectId, checked.path ?? '', 'generated')
        if (!isPlayCanvasGeneratedArtifactFileReference({ path: checked.path ?? '', mime: checked.mime })) {
            throw new MetahubValidationError('PlayCanvas generated artifacts must reference JavaScript files', {
                messageCode: 'playcanvas.files.role.generatedArtifactMismatch'
            })
        }
        return checked
    }

    private async requireAssetFilePath(schemaName: string, projectId: string, assetId: string, sourcePath: string): Promise<void> {
        await this.requireProject(schemaName, projectId)
        this.assertProjectPath(projectId, sourcePath)
        const asset = await findPlayCanvasAsset(this.exec, schemaName, projectId, assetId)
        if (!asset) {
            throw new MetahubValidationError('PlayCanvas asset was not found', {
                messageCode: 'playcanvas.assets.notFound',
                assetId
            })
        }
        if (!asset.file?.path) {
            throw new MetahubValidationError('PlayCanvas asset does not have a file reference', {
                messageCode: 'playcanvas.assets.fileReferenceRequired',
                assetId
            })
        }
        if (asset.file.path !== sourcePath) {
            throw new MetahubValidationError('PlayCanvas asset file path does not match the requested source path', {
                messageCode: 'playcanvas.assets.filePathMismatch',
                assetId
            })
        }
    }

    private optimisticError(entityId: string, expectedVersion?: number): OptimisticLockError {
        return new OptimisticLockError({
            entityId,
            entityType: 'playcanvasProject',
            expectedVersion: expectedVersion ?? 0,
            actualVersion: 0,
            updatedAt: new Date(0),
            updatedBy: null
        })
    }

    private async readFileForRollback(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string
    ): Promise<{ exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false }> {
        const stat = await this.fileService.stat(scope, sourcePath)
        if (!stat.exists) {
            return { exists: false }
        }
        return { exists: true, file: await this.fileService.read(scope, sourcePath) }
    }

    private async rollbackFileWrite(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        writtenChecksum: string,
        previous: { exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false },
        mime?: string | null
    ): Promise<void> {
        if (previous.exists) {
            await this.fileService.write(scope, sourcePath, previous.file.content, {
                expectedChecksum: previous.file.checksum,
                expectedCurrentChecksum: writtenChecksum,
                mime
            })
            return
        }
        await this.fileService.deleteIfCurrentChecksum(scope, sourcePath, writtenChecksum)
    }

    private async rollbackPhysicalDelete(
        scope: PlayCanvasProjectFileScope,
        sourcePath: string,
        previous: { exists: true; file: PlayCanvasProjectFileReadResult } | { exists: false },
        mime?: string | null
    ): Promise<void> {
        if (!previous.exists) return
        await this.fileService.write(scope, sourcePath, previous.file.content, {
            expectedChecksum: previous.file.checksum,
            expectedCurrentChecksum: null,
            mime
        })
    }

    private async rollbackEditorSceneMetadata(
        schemaName: string,
        projectId: string,
        sceneId: string,
        previous: (PlayCanvasScene & { version: number }) | null,
        preparedVersion: number,
        userId: string
    ): Promise<void> {
        if (previous) {
            const restored = await upsertPlayCanvasScene(
                this.exec,
                schemaName,
                projectId,
                {
                    id: previous.id,
                    codename: previous.codename,
                    displayName: previous.displayName,
                    payloadSchemaVersion: previous.payloadSchemaVersion,
                    payload: previous.payload ?? null,
                    payloadFile: previous.payloadFile ?? null,
                    checksum: previous.checksum ?? null,
                    sortOrder: previous.sortOrder,
                    publish: previous.publish,
                    expectedVersion: preparedVersion
                },
                userId
            )
            if (!restored) {
                log.warn('Failed to restore PlayCanvas editor scene metadata after save rollback', {
                    schemaName,
                    projectId,
                    sceneId
                })
            }
            return
        }

        const deleted = await softDeletePlayCanvasScene(this.exec, schemaName, projectId, sceneId, preparedVersion, userId)
        if (!deleted) {
            log.warn('Failed to remove prepared PlayCanvas editor scene metadata after save rollback', {
                schemaName,
                projectId,
                sceneId
            })
        }
    }
}
