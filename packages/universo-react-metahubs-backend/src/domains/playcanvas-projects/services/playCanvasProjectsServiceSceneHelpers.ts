import type { PlayCanvasEditorScenePayload } from '@universo-react/types'
import { PLAYCANVAS_PROJECT_SCHEMA_VERSION, playCanvasEditorCompatibilityScenePayloadSchema } from '@universo-react/types'

import stableStringify from 'json-stable-stringify'
import { MetahubValidationError } from '../../shared/domainErrors'

export const areEditorScenePayloadsEqual = (left: PlayCanvasEditorScenePayload | null, right: PlayCanvasEditorScenePayload): boolean => {
    const leftComparable = normalizeEditorScenePayloadForComparison(left)
    const rightComparable = normalizeEditorScenePayloadForComparison(right)
    return Boolean(leftComparable && stableStringify(leftComparable) === stableStringify(rightComparable))
}

export type PlayCanvasEditorVector3Tuple = [number, number, number]

export const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const readPlayCanvasEditorVector3Tuple = (
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

export const findEditorSceneEntityById = (payload: PlayCanvasEditorScenePayload | null | undefined, entityId: string) =>
    payload?.entities?.find((entity) => entity.id === entityId)

export type PlayCanvasEditorEntityComponents = NonNullable<PlayCanvasEditorScenePayload['entities'][number]['components']>
export type PlayCanvasEditorEntityMetadata = NonNullable<PlayCanvasEditorScenePayload['entities'][number]['metadata']>
export type PlayCanvasEditorSceneMetadata = NonNullable<PlayCanvasEditorScenePayload['metadata']>

export const UNSAFE_EDITOR_COMPONENT_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor'])

export const createEditorComponentRecord = (): Record<string, unknown> => Object.create(null) as Record<string, unknown>

export const readEditorJsonMetadataRecord = <T extends Record<string, unknown>>(value: unknown): T | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : undefined

export const assertSafeEditorComponentPath = (path: string[]): void => {
    if (path.length === 0 || path.some((segment) => !segment || UNSAFE_EDITOR_COMPONENT_PATH_SEGMENTS.has(segment))) {
        throw new MetahubValidationError('Unsafe PlayCanvas Editor component path', {
            messageCode: 'playcanvas.editor.scenePayloadUnsafeComponentPath',
            path: path.join('.')
        })
    }
}

export const cloneEditorComponentRecord = (value: unknown): Record<string, unknown> => {
    const target = createEditorComponentRecord()
    for (const [key, item] of Object.entries(asRecord(value))) {
        assertSafeEditorComponentPath([key])
        target[key] = item
    }
    return target
}

export const assignNestedRecordPath = (target: Record<string, unknown>, path: string[], value: unknown): void => {
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

export const mergeComponentRecord = (target: Record<string, unknown>, componentName: string, value: unknown): void => {
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

export const normalizeEditorEntityComponents = (componentsInput: unknown, entityInput?: unknown): PlayCanvasEditorEntityComponents => {
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

export const normalizeEditorSceneEntityForSave = (
    entity: PlayCanvasEditorScenePayload['entities'][number]
): PlayCanvasEditorScenePayload['entities'][number] => ({
    ...entity,
    components: normalizeEditorEntityComponents(entity.components, entity)
})

/**
 * Keep compatibility scene payloads rooted even when the upstream Editor omits
 * its synthetic Root observer after a dirty authoring flow. The persisted
 * compatibility payload is the canonical source used by exports and runtime
 * manifests, so hierarchy repair belongs at this boundary rather than only in
 * the realtime adapter.
 */
export const normalizeEditorSceneEntitiesForSave = (
    entities: PlayCanvasEditorScenePayload['entities']
): PlayCanvasEditorScenePayload['entities'] => {
    const normalized = entities.map(normalizeEditorSceneEntityForSave)
    const root = normalized.find((entity) => entity.id === 'root')

    if (root) {
        const rootChildren = new Set(
            (Array.isArray(root.children) ? root.children : []).filter((childId): childId is string => typeof childId === 'string')
        )
        for (const entity of normalized) {
            if (entity.id !== 'root' && (entity.parentId === null || entity.parentId === undefined || entity.parentId === 'root')) {
                rootChildren.add(entity.id)
            }
        }
        const normalizedRoot = {
            ...root,
            name: root.name ?? 'Root',
            parentId: null,
            enabled: root.enabled ?? true,
            position: root.position ?? [0, 0, 0],
            rotation: root.rotation ?? [0, 0, 0],
            scale: root.scale ?? [1, 1, 1],
            components: root.components ?? {},
            metadata: root.metadata ?? {},
            children: [...rootChildren]
        }
        return [
            normalizedRoot,
            ...normalized
                .filter((entity) => entity.id !== 'root')
                .map((entity) => (entity.parentId === null || entity.parentId === undefined ? { ...entity, parentId: 'root' } : entity))
        ]
    }

    const rootChildren = normalized
        .filter((entity) => entity.parentId === null || entity.parentId === undefined || entity.parentId === 'root')
        .map((entity) => entity.id)
    return [
        {
            id: 'root',
            name: 'Root',
            parentId: null,
            enabled: true,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            components: {},
            metadata: {},
            children: rootChildren
        },
        ...normalized.map((entity) =>
            entity.parentId === null || entity.parentId === undefined ? { ...entity, parentId: 'root' } : entity
        )
    ]
}

export const isRenderableEditorEntity = (entity: PlayCanvasEditorScenePayload['entities'][number]): boolean => {
    const components = asRecord(entity.components)
    const render = asRecord(components.render)
    return entity.enabled !== false && Object.keys(render).length > 0 && render.enabled !== false
}

export const toMmoommVector = (tuple: PlayCanvasEditorVector3Tuple) => ({ x: tuple[0], y: tuple[1], z: tuple[2] })

export const stripMmoommRuntimeSceneMetadata = (metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined => {
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

export const deriveMmoommMetadataFromEditorEntities = (
    metadata: Record<string, unknown> | undefined,
    entities: PlayCanvasEditorScenePayload['entities']
): Record<string, unknown> | undefined => {
    const ship = entities.find((entity) => entity.name === 'MMOOMM Ship' && isRenderableEditorEntity(entity))
    const station = entities.find((entity) => entity.name === 'MMOOMM Station' && isRenderableEditorEntity(entity))
    const camera = entities.find((entity) => entity.name === 'MMOOMM Follow Camera' && entity.enabled !== false)
    if (!ship || !station) return stripMmoommRuntimeSceneMetadata(metadata)

    const shipPosition = readPlayCanvasEditorVector3Tuple(ship.position, [0, 0, 0]) ?? [0, 0, 0]
    const stationPosition = readPlayCanvasEditorVector3Tuple(station.position, [72, 0, -48]) ?? [72, 0, -48]
    const shipScale = readPlayCanvasEditorVector3Tuple(ship.scale, [12, 4, 4]) ?? [12, 4, 4]
    const stationScale = readPlayCanvasEditorVector3Tuple(station.scale, [48, 16, 16]) ?? [48, 16, 16]
    const cameraPosition = readPlayCanvasEditorVector3Tuple(camera?.position, [0, 28, 48]) ?? [0, 28, 48]

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
                    },
                    ...(camera
                        ? [
                              {
                                  id: camera.id,
                                  role: 'camera',
                                  position: toMmoommVector(cameraPosition),
                                  scale: { x: 1, y: 1, z: 1 },
                                  selectable: false
                              }
                          ]
                        : [])
                ]
            },
            provenance: {
                ...asRecord(asRecord(metadata?.mmoomm).provenance),
                authoringFlow: 'playcanvas-editor-native-scene'
            }
        }
    }
}

export const syncMmoommMetadataWithEditorEntities = (
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

export const createDefaultEditorScenePayload = (): PlayCanvasEditorScenePayload => ({
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

export const normalizeEditorSceneSettings = (value: unknown): PlayCanvasEditorScenePayload['settings'] => {
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

export function normalizeEditorScenePayloadForComparison(
    payload: PlayCanvasEditorScenePayload | null
): PlayCanvasEditorScenePayload | null {
    if (!payload) return null
    return playCanvasEditorCompatibilityScenePayloadSchema.parse({
        ...payload,
        settings: normalizeEditorSceneSettings(payload.settings)
    })
}

export const normalizeEditorCompatibilityScenePayloadForSave = (payload: PlayCanvasEditorScenePayload): PlayCanvasEditorScenePayload => {
    const metadata =
        payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
            ? (payload.metadata as Record<string, unknown>)
            : undefined
    const entities = normalizeEditorSceneEntitiesForSave(payload.entities ?? [])
    return playCanvasEditorCompatibilityScenePayloadSchema.parse({
        ...payload,
        settings: normalizeEditorSceneSettings(payload.settings),
        entities,
        metadata: syncMmoommMetadataWithEditorEntities(metadata, entities)
    })
}
