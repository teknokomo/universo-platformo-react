import { computeSnapshotHash } from '@universo-react/utils'

export const MMOOMM_APP_FIXTURE_FILENAME = 'metahubs-mmoomm-app-snapshot.json'

export const MMOOMM_APP_CANONICAL_METAHUB = {
    name: {
        en: 'Universo MMOOMM',
        ru: 'Universo MMOOMM'
    },
    description: {
        en: 'Browser-authored MMOOMM metahub with PlayCanvas Editor authoring data and Colyseus runtime.',
        ru: 'Созданный через браузер метахаб MMOOMM с данными PlayCanvas Editor и runtime Colyseus.'
    },
    codename: {
        en: 'UniversoMmoomm',
        ru: 'UniversoMmoomm'
    }
} as const

export const MMOOMM_APP_PACKAGES = [
    { packageName: '@universo-react/playcanvas-editor-frontend', version: '0.1.0', target: null },
    { packageName: '@universo-react/playcanvas-engine', version: '0.1.0', target: 'client' },
    { packageName: '@universo-react/colyseus-client', version: '0.1.0', target: 'client' },
    { packageName: '@universo-react/colyseus-server', version: '0.1.0', target: 'server' }
] as const

const MMOOMM_AUTHORING_PROJECT_NAME = 'MMOOMM Authoring'
const MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME = 'MMOOMM Visual Linkup Lab'
const MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY = 'visualLab'
const MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT = 16
const MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES = ['ship', 'station', 'rockAsteroid', 'iceAsteroid'] as const
const MMOOMM_VISUAL_LINKUP_LAB_FOG_COLOR = [0.045, 0.055, 0.08] as const
const MMOOMM_VISUAL_LINKUP_LAB_FOG_DENSITY = 0.014
const MMOOMM_SPACE_SECTION_CODENAME = 'FlightWorld'
const MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME = 'VisualLinkupLab'

export type SnapshotEnvelope = Record<string, unknown> & {
    metahub?: { name?: unknown; description?: unknown; codename?: unknown }
    snapshot?: {
        packages?: unknown[]
        entities?: Record<string, { kind?: unknown; codename?: unknown }>
        fixedValues?: Record<string, Array<{ codename?: unknown; dataType?: unknown; value?: unknown }>>
        optionValues?: Record<string, Array<{ codename?: unknown; isDefault?: unknown }>>
        modules?: unknown[]
        layouts?: unknown[]
        layoutZoneWidgets?: unknown[]
        layoutConfig?: Record<string, unknown>
    } & Record<string, unknown>
    snapshotHash?: string
}

type PlayCanvasProjectSnapshot = {
    projects?: Array<{ id?: unknown; displayName?: unknown; codename?: unknown; defaultSceneId?: unknown }>
    scenes?: Array<{
        id?: unknown
        projectId?: unknown
        payload?: {
            settings?: {
                render?: Record<string, unknown>
            }
            assets?: Array<{
                id?: unknown
                type?: unknown
                metadata?: Record<string, unknown>
            }>
            entities?: Array<{
                id?: unknown
                name?: unknown
                position?: unknown
                rotation?: unknown
                scale?: unknown
                components?: unknown
            }>
            metadata?: Record<string, unknown>
        }
        payloadFile?: {
            snapshotContentBase64?: unknown
        }
    }>
    sourceFiles?: unknown[]
    generatedArtifacts?: unknown[]
    runtimeManifests?: Array<{ projectId?: unknown; sceneId?: unknown; checksum?: unknown; metadata?: Record<string, unknown> }>
}

type PlayCanvasSceneEntitySnapshot = NonNullable<NonNullable<PlayCanvasProjectSnapshot['scenes']>[number]['payload']> extends {
    entities?: Array<infer Entity>
}
    ? Entity
    : never

const readCodenameText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = record._primary ?? 'en'
    const content = record.locales?.[primary]?.content
    return typeof content === 'string' ? content : ''
}

const readLocalizedText = (value: unknown, locale: 'en' | 'ru'): string => {
    if (typeof value === 'string') return locale === 'en' ? value : ''
    if (!value || typeof value !== 'object') return ''
    const record = value as { locales?: Record<string, { content?: unknown }> }
    const content = record.locales?.[locale]?.content
    return typeof content === 'string' ? content.trim() : ''
}

const readPrimaryText = (value: unknown): string => readLocalizedText(value, 'en') || readCodenameText(value)

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`
    }
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
        .join(',')}}`
}

const readScenePayloadFilePayload = (
    scene: NonNullable<PlayCanvasProjectSnapshot['scenes']>[number],
    projectName: string
): Record<string, unknown> | null => {
    const encoded = scene.payloadFile?.snapshotContentBase64
    if (typeof encoded !== 'string' || encoded.length === 0) {
        return null
    }
    let parsed: unknown
    try {
        parsed = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as unknown
    } catch {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} must include valid bundled scene payload JSON`)
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} bundled scene payload must be an object`)
    }
    return parsed as Record<string, unknown>
}

const isVector3Tuple = (value: unknown): value is [number, number, number] =>
    Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))

const isUuidV4 = (value: unknown): boolean =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

const assertUniqueStrings = (values: unknown[], label: string): void => {
    const strings = values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    const seen = new Set<string>()
    for (const value of strings) {
        if (seen.has(value)) {
            throw new Error(`MMOOMM app fixture ${label} must be unique: ${value}`)
        }
        seen.add(value)
    }
}

const readVector3 = (value: unknown): { x: number; y: number; z: number } | null => {
    if (isVector3Tuple(value)) {
        return { x: value[0], y: value[1], z: value[2] }
    }
    if (!value || typeof value !== 'object') {
        return null
    }
    const candidate = value as { x?: unknown; y?: unknown; z?: unknown }
    return Number.isFinite(candidate.x) && Number.isFinite(candidate.y) && Number.isFinite(candidate.z)
        ? { x: candidate.x as number, y: candidate.y as number, z: candidate.z as number }
        : null
}

const vectorDistance = (left: { x: number; y: number; z: number }, right: { x: number; y: number; z: number }): number =>
    Math.hypot(left.x - right.x, left.y - right.y, left.z - right.z)

const assertRenderableMmoommEntity = (entity: {
    name?: unknown
    position?: unknown
    rotation?: unknown
    scale?: unknown
    components?: unknown
}): void => {
    if (!readVector3(entity.position) || !isVector3Tuple(entity.rotation) || !readVector3(entity.scale)) {
        throw new Error(`MMOOMM app fixture PlayCanvas entity ${String(entity.name ?? '')} must persist transform tuples`)
    }
    const components = entity.components && typeof entity.components === 'object' ? (entity.components as Record<string, unknown>) : {}
    const render = components.render && typeof components.render === 'object' ? (components.render as Record<string, unknown>) : null
    const model = components.model && typeof components.model === 'object' ? (components.model as Record<string, unknown>) : null
    if (!render && !model) {
        throw new Error(`MMOOMM app fixture PlayCanvas entity ${String(entity.name ?? '')} must include a renderable component`)
    }
    if (render) {
        if (render.enabled === false || render.type !== 'box') {
            throw new Error(
                `MMOOMM app fixture PlayCanvas entity ${String(entity.name ?? '')} must persist an enabled box render component`
            )
        }
        const layers = Array.isArray(render.layers) ? render.layers : []
        if (!layers.includes(0)) {
            throw new Error(
                `MMOOMM app fixture PlayCanvas entity ${String(entity.name ?? '')} render component must stay on the world layer`
            )
        }
        const materialAssets = Array.isArray(render.materialAssets) ? render.materialAssets : []
        const usesDefaultMaterial =
            materialAssets.length === 1 && (materialAssets[0] === null || materialAssets[0] === undefined || materialAssets[0] === 0)
        const usesAssetMaterial = materialAssets.length > 0 && materialAssets.every((item) => Number.isInteger(item) && Number(item) > 0)
        if (!usesDefaultMaterial && !usesAssetMaterial) {
            throw new Error(
                `MMOOMM app fixture PlayCanvas entity ${String(
                    entity.name ?? ''
                )} must use the Editor default material or valid material assets`
            )
        }
    }
}

const assertMmoommLightingEntity = (entity: {
    name?: unknown
    position?: unknown
    rotation?: unknown
    scale?: unknown
    components?: unknown
}): void => {
    if (!readVector3(entity.position) || !isVector3Tuple(entity.rotation) || !readVector3(entity.scale)) {
        throw new Error('MMOOMM app fixture PlayCanvas key light must persist transform tuples')
    }
    const components = entity.components && typeof entity.components === 'object' ? (entity.components as Record<string, unknown>) : {}
    const light = components.light && typeof components.light === 'object' ? (components.light as Record<string, unknown>) : null
    if (!light || light.type !== 'directional' || light.enabled === false) {
        throw new Error('MMOOMM app fixture PlayCanvas scene must include an enabled directional key light')
    }
    const color = Array.isArray(light.color) ? light.color : []
    if (color.length !== 3 || color.some((channel) => !Number.isFinite(channel) || Number(channel) < 0.9)) {
        throw new Error('MMOOMM app fixture PlayCanvas key light must use a white light color')
    }
    if (!Number.isFinite(light.intensity) || Number(light.intensity) <= 0) {
        throw new Error('MMOOMM app fixture PlayCanvas key light must have positive intensity')
    }
}

const isEmptyDefaultPlayCanvasEntity = (entity: PlayCanvasSceneEntitySnapshot | null | undefined): boolean => {
    if (!entity || typeof entity !== 'object') return false
    const entityRecord = entity as { id?: unknown; name?: unknown; components?: unknown; children?: unknown }
    const components =
        entityRecord.components && typeof entityRecord.components === 'object' && !Array.isArray(entityRecord.components)
            ? (entityRecord.components as Record<string, unknown>)
            : {}
    const children = Array.isArray(entityRecord.children) ? entityRecord.children : []
    return entityRecord.id !== 'root' && entityRecord.name === 'New Entity' && Object.keys(components).length === 0 && children.length === 0
}

const assertNoEmptyDefaultPlayCanvasEntities = (playcanvasProjects: PlayCanvasProjectSnapshot): void => {
    const offenders = (playcanvasProjects.scenes ?? []).flatMap((scene) =>
        (scene.payload?.entities ?? [])
            .filter(isEmptyDefaultPlayCanvasEntity)
            .map((entity) => `${String(scene.id ?? 'unknown-scene')}:${String(entity.id ?? 'unknown-entity')}`)
    )
    if (offenders.length > 0) {
        throw new Error(
            `MMOOMM app fixture PlayCanvas scenes must not export empty default New Entity authoring artifacts: ${offenders.join(', ')}`
        )
    }
}

const assertMmoommSceneObjectMatchesEntity = (
    scene: Record<string, unknown> | undefined,
    entity: { id?: unknown; name?: unknown; position?: unknown; scale?: unknown },
    label: string
): void => {
    const sceneObjects = Array.isArray(scene?.objects)
        ? (scene.objects.filter((item) => item && typeof item === 'object') as Record<string, unknown>[])
        : []
    const sceneObject = sceneObjects.find((item) => item.id === entity.id)
    const scenePosition = readVector3(sceneObject?.position)
    const sceneScale = readVector3(sceneObject?.scale)
    const entityPosition = readVector3(entity.position)
    const entityScale = readVector3(entity.scale)
    if (!sceneObject || !scenePosition || !sceneScale || !entityPosition || !entityScale) {
        throw new Error(`MMOOMM app fixture MMOOMM metadata must include ${label} runtime projection geometry`)
    }
    if (vectorDistance(scenePosition, entityPosition) > 0.001 || vectorDistance(sceneScale, entityScale) > 0.001) {
        throw new Error(`MMOOMM app fixture ${label} PlayCanvas transform must match MMOOMM runtime projection metadata`)
    }
}

const requirePlayCanvasProjectByName = (playcanvasProjects: PlayCanvasProjectSnapshot, projectName: string) => {
    const project = (playcanvasProjects.projects ?? []).find((item) => readPrimaryText(item.displayName) === projectName)
    if (!project?.id || typeof project.id !== 'string') {
        throw new Error(`MMOOMM app fixture must include PlayCanvas project ${projectName}`)
    }
    if (typeof project.defaultSceneId !== 'string') {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} must include a default scene id`)
    }
    return project as typeof project & { id: string; defaultSceneId: string }
}

const requirePlayCanvasSceneForProject = (
    playcanvasProjects: PlayCanvasProjectSnapshot,
    project: { id: string; defaultSceneId: string },
    projectName: string
) => {
    const scene = (playcanvasProjects.scenes ?? []).find((item) => item.id === project.defaultSceneId && item.projectId === project.id)
    if (!scene?.payload) {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} must include its default scene payload`)
    }
    const filePayload = readScenePayloadFilePayload(scene, projectName)
    if (!filePayload) {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} must include bundled default scene payload content`)
    }
    if (stableStringify(scene.payload) !== stableStringify(filePayload)) {
        throw new Error(`MMOOMM app fixture PlayCanvas project ${projectName} inline and bundled default scene payloads must match`)
    }
    return scene
}

const assertVisualLinkupLabEntity = (entity: PlayCanvasSceneEntitySnapshot): void => {
    const record = entity as {
        name?: unknown
        position?: unknown
        rotation?: unknown
        scale?: unknown
        components?: Record<string, unknown>
    }
    if (!readVector3(record.position) || !isVector3Tuple(record.rotation) || !readVector3(record.scale)) {
        throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must persist transform tuples`)
    }
    const render =
        record.components?.render && typeof record.components.render === 'object'
            ? (record.components.render as Record<string, unknown>)
            : null
    const camera =
        record.components?.camera && typeof record.components.camera === 'object'
            ? (record.components.camera as Record<string, unknown>)
            : null
    const light =
        record.components?.light && typeof record.components.light === 'object'
            ? (record.components.light as Record<string, unknown>)
            : null
    if (!render && !camera && !light) {
        throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must persist render, camera, or light data`)
    }
    if (render) {
        if (render.enabled === false || !['box', 'sphere'].includes(String(render.type))) {
            throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must use an enabled box/sphere render primitive`)
        }
        const metadata = (record as { metadata?: { mmoomm?: Record<string, unknown> } }).metadata?.mmoomm
        const visualMaterial = metadata?.visualMaterial as Record<string, unknown> | undefined
        if (String(record.name ?? '').startsWith('Linkup Lab ') && !visualMaterial) {
            throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must persist visual material evidence`)
        }
        if (visualMaterial) {
            const role = visualMaterial.role
            const opacity = Number(visualMaterial.opacity)
            const materialAssetId = Number(visualMaterial.materialAssetId)
            if (!['core', 'glow', 'variantMarker'].includes(String(role)) || !Number.isFinite(opacity) || opacity <= 0 || opacity > 1) {
                throw new Error(
                    `MMOOMM visual linkup lab entity ${String(record.name ?? '')} must persist bounded material opacity evidence`
                )
            }
            if (!Number.isInteger(materialAssetId) || materialAssetId <= 0 || !visualMaterial.materialAssetName) {
                throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must persist material asset evidence`)
            }
            const materialAssets = Array.isArray(render.materialAssets) ? render.materialAssets : []
            if (materialAssets.length !== 1 || Number(materialAssets[0]) !== materialAssetId) {
                throw new Error(`MMOOMM visual linkup lab entity ${String(record.name ?? '')} must reference its material asset`)
            }
            if (role === 'glow') {
                const emissive = visualMaterial.emissive
                if (!isVector3Tuple(emissive) || visualMaterial.blendType !== 'additive') {
                    throw new Error(
                        `MMOOMM visual linkup lab glow entity ${String(record.name ?? '')} must persist additive emissive evidence`
                    )
                }
            }
        }
    }
}

const assertVisualLinkupLabScene = (scene: NonNullable<PlayCanvasProjectSnapshot['scenes']>[number]): void => {
    const entities = scene.payload?.entities ?? []
    assertUniqueStrings(
        entities.map((entity) => entity.id),
        'visual lab scene entity ids'
    )
    assertUniqueStrings(entities.map((entity) => String(entity.name ?? '')).filter(Boolean), 'visual lab scene entity names')
    const entityNames = new Set(entities.map((entity) => String(entity.name ?? '')).filter(Boolean))
    if (!entityNames.has('MMOOMM Linkup Lab Camera') || !entityNames.has('MMOOMM Linkup Lab Key Light')) {
        throw new Error('MMOOMM visual linkup lab scene must include its camera and key light')
    }
    const cameraEntity = entities.find((entity) => entity.name === 'MMOOMM Linkup Lab Camera')
    const cameraComponent =
        cameraEntity?.components?.camera && typeof cameraEntity.components.camera === 'object'
            ? (cameraEntity.components.camera as Record<string, unknown>)
            : null
    if (!cameraComponent || cameraComponent.enabled === false) {
        throw new Error('MMOOMM visual linkup lab camera must persist an enabled PlayCanvas camera component')
    }
    if (cameraEntity?.components?.render) {
        throw new Error('MMOOMM visual linkup lab camera must not be persisted as a render placeholder')
    }
    const renderSettings = scene.payload?.settings?.render
    if (
        !renderSettings ||
        renderSettings.fog !== 'exp2' ||
        JSON.stringify(renderSettings.fog_color) !== JSON.stringify(MMOOMM_VISUAL_LINKUP_LAB_FOG_COLOR) ||
        Number(renderSettings.fog_density) !== MMOOMM_VISUAL_LINKUP_LAB_FOG_DENSITY
    ) {
        throw new Error('MMOOMM visual linkup lab scene must persist readable PlayCanvas exp2 fog settings')
    }
    const materialAssets = (scene.payload?.assets ?? []).filter((asset) => asset.type === 'material')
    const materialAssetIds = new Set(materialAssets.map((asset) => String(asset.id ?? '')).filter(Boolean))
    if (materialAssets.length < MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT * (1 + MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES.length * 2)) {
        throw new Error('MMOOMM visual linkup lab scene must persist material assets for every marker/core/glow render entity')
    }
    const referencedMaterialIds = entities.flatMap((entity) => {
        const render =
            entity.components?.render && typeof entity.components.render === 'object'
                ? (entity.components.render as Record<string, unknown>)
                : null
        const materialRefs = Array.isArray(render?.materialAssets) ? render.materialAssets : []
        return materialRefs.filter((value) => Number.isInteger(value) && Number(value) > 0).map(String)
    })
    if (referencedMaterialIds.length === 0 || referencedMaterialIds.some((id) => !materialAssetIds.has(id))) {
        throw new Error('MMOOMM visual linkup lab scene render materialAssets must reference persisted material assets')
    }
    for (const asset of materialAssets) {
        const record = asset as Record<string, unknown>
        const metadata = record.metadata && typeof record.metadata === 'object' ? (record.metadata as Record<string, unknown>) : {}
        const editorDocument =
            metadata.editorDocument && typeof metadata.editorDocument === 'object'
                ? (metadata.editorDocument as Record<string, unknown>)
                : {}
        const materialData = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : null
        const metadataData = metadata.data && typeof metadata.data === 'object' ? (metadata.data as Record<string, unknown>) : null
        const editorDocumentData =
            editorDocument.data && typeof editorDocument.data === 'object' ? (editorDocument.data as Record<string, unknown>) : null
        if (!materialData || !metadataData || !editorDocumentData) {
            throw new Error('MMOOMM visual linkup lab material assets must persist PlayCanvas material data for Editor asset loading')
        }
        for (const data of [materialData, metadataData, editorDocumentData]) {
            if (typeof data.blendType !== 'number') {
                throw new Error('MMOOMM visual linkup lab material assets must persist numeric PlayCanvas blendType data')
            }
        }
    }
    for (let index = 1; index <= MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT; index += 1) {
        const prefix = `Linkup Lab ${String(index).padStart(2, '0')}`
        const hasVariantMarker = Array.from(entityNames).some(
            (name) => name.startsWith(`${prefix} `) && !name.endsWith(' Core') && !name.endsWith(' Glow')
        )
        if (!hasVariantMarker) {
            throw new Error(`MMOOMM visual linkup lab scene is missing variant marker ${prefix}`)
        }
        for (const objectType of MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES) {
            if (!entityNames.has(`${prefix} ${objectType} Core`) || !entityNames.has(`${prefix} ${objectType} Glow`)) {
                throw new Error(`MMOOMM visual linkup lab scene is missing ${prefix} ${objectType} core/glow entities`)
            }
        }
    }
    for (const entity of entities.filter(
        (item) =>
            String(item.name ?? '').startsWith('Linkup Lab ') ||
            item.name === 'MMOOMM Linkup Lab Camera' ||
            item.name === 'MMOOMM Linkup Lab Key Light'
    )) {
        assertVisualLinkupLabEntity(entity)
    }
    const mmoomm = scene.payload?.metadata?.mmoomm as Record<string, unknown> | undefined
    const visualLab = mmoomm?.[MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY] as Record<string, unknown> | undefined
    if (!visualLab || visualLab.projectRole !== 'visual-linkup-lab' || visualLab.variantCount !== MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT) {
        throw new Error('MMOOMM visual linkup lab scene must persist metadata.mmoomm.visualLab with 16 variants')
    }
    if (JSON.stringify(visualLab).includes('playcanvas-editor-iframe-mmoomm-panel')) {
        throw new Error('MMOOMM visual linkup lab metadata must not depend on the removed Editor overlay panel')
    }
    const objectTypes = Array.isArray(visualLab.objectTypes) ? visualLab.objectTypes : []
    for (const expected of MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES) {
        if (!objectTypes.includes(expected)) {
            throw new Error(`MMOOMM visual linkup lab metadata is missing object type ${expected}`)
        }
    }
    const objects = Array.isArray(visualLab.objects) ? visualLab.objects : []
    if (objects.length !== MMOOMM_VISUAL_LINKUP_LAB_VARIANT_COUNT * MMOOMM_VISUAL_LINKUP_LAB_OBJECT_TYPES.length) {
        throw new Error('MMOOMM visual linkup lab metadata must describe every variant/object combination')
    }
    assertUniqueStrings(
        objects.map((item) => (item as Record<string, unknown>).id),
        'visual lab object ids'
    )
    assertUniqueStrings(
        objects.map(
            (item) => `${String((item as Record<string, unknown>).variant)}:${String((item as Record<string, unknown>).objectType)}`
        ),
        'visual lab variant/object pairs'
    )
    const lowPolyObjects = objects.filter((item) => {
        const object = item as Record<string, unknown>
        return Number.isFinite(object.lowPolyBands) && Number(object.lowPolyBands) >= 3
    })
    if (lowPolyObjects.length === 0) {
        throw new Error('MMOOMM visual linkup lab metadata must include low-poly geometry evidence')
    }
    for (const item of objects) {
        const object = item as Record<string, unknown>
        const material = object.material as { core?: Record<string, unknown>; glow?: Record<string, unknown> } | undefined
        if (!material?.core || !material.glow) {
            throw new Error('MMOOMM visual linkup lab metadata must include core/glow material evidence for every object')
        }
        if (material.core.blendType !== 'normal' || material.glow.blendType !== 'additive') {
            throw new Error('MMOOMM visual linkup lab metadata must distinguish normal cores from additive glow shells')
        }
        if (!isVector3Tuple(material.glow.emissive)) {
            throw new Error('MMOOMM visual linkup lab metadata must include glow emissive color evidence')
        }
    }
    const fog = visualLab.sceneFog as Record<string, unknown> | undefined
    if (
        !fog ||
        fog.type !== 'exp2' ||
        JSON.stringify(fog.color) !== JSON.stringify(MMOOMM_VISUAL_LINKUP_LAB_FOG_COLOR) ||
        Number(fog.density) !== MMOOMM_VISUAL_LINKUP_LAB_FOG_DENSITY
    ) {
        throw new Error('MMOOMM visual linkup lab metadata must include readable exp2 fog evidence')
    }
}

const hasWidget = (value: unknown, widgetKey: string): boolean => {
    if (Array.isArray(value)) {
        return value.some((item) => hasWidget(item, widgetKey))
    }
    if (!value || typeof value !== 'object') {
        return false
    }
    const record = value as Record<string, unknown>
    return record.widgetKey === widgetKey || Object.values(record).some((item) => hasWidget(item, widgetKey))
}

const readWidgetConfigsByKey = (value: unknown, widgetKey: string): Record<string, unknown>[] => {
    if (Array.isArray(value)) {
        return value.flatMap((item) => readWidgetConfigsByKey(item, widgetKey))
    }
    if (!value || typeof value !== 'object') {
        return []
    }
    const record = value as Record<string, unknown>
    const ownConfig =
        record.widgetKey === widgetKey && record.config && typeof record.config === 'object'
            ? [record.config as Record<string, unknown>]
            : []
    return [...ownConfig, ...Object.values(record).flatMap((item) => readWidgetConfigsByKey(item, widgetKey))]
}

const assertPackage = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>, expected: (typeof MMOOMM_APP_PACKAGES)[number]) => {
    const matched = snapshot.packages?.some((item) => {
        const candidate = item as {
            packageName?: string
            version?: string
            source?: { runtimeTargets?: string[] }
            config?: Record<string, unknown>
        }
        if (candidate.packageName !== expected.packageName || candidate.version !== expected.version) return false
        return expected.target === null || candidate.source?.runtimeTargets?.includes(expected.target)
    })
    if (!matched) {
        throw new Error(`MMOOMM app fixture is missing package ${expected.packageName}@${expected.version}`)
    }
}

const assertPlayCanvasProjectSnapshot = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): PlayCanvasProjectSnapshot => {
    const playcanvasProjects = (snapshot as { playcanvasProjects?: PlayCanvasProjectSnapshot }).playcanvasProjects
    if (!playcanvasProjects) {
        throw new Error('MMOOMM app fixture must include PlayCanvas project authoring snapshot data')
    }
    if (!Array.isArray(playcanvasProjects.projects) || playcanvasProjects.projects.length !== 2) {
        throw new Error('MMOOMM app fixture must include exactly two PlayCanvas projects: authoring and visual linkup lab')
    }
    assertUniqueStrings(
        playcanvasProjects.projects.map((project) => project.id),
        'PlayCanvas project ids'
    )
    assertUniqueStrings(
        playcanvasProjects.projects.map((project) => readCodenameText(project.codename)),
        'PlayCanvas project codenames'
    )
    if (!Array.isArray(playcanvasProjects.scenes) || playcanvasProjects.scenes.length < 1) {
        throw new Error('MMOOMM app fixture must include at least one PlayCanvas scene')
    }
    assertUniqueStrings(
        playcanvasProjects.scenes.map((scene) => scene.id),
        'PlayCanvas scene ids'
    )
    assertNoEmptyDefaultPlayCanvasEntities(playcanvasProjects)
    const authoringProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_AUTHORING_PROJECT_NAME)
    const visualLabProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    if (authoringProject.id === visualLabProject.id || authoringProject.defaultSceneId === visualLabProject.defaultSceneId) {
        throw new Error('MMOOMM app fixture PlayCanvas authoring and visual lab projects must not share project or scene ids')
    }
    const authoredScene = requirePlayCanvasSceneForProject(playcanvasProjects, authoringProject, MMOOMM_AUTHORING_PROJECT_NAME)
    const visualLabScene = requirePlayCanvasSceneForProject(playcanvasProjects, visualLabProject, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    if (!authoredScene) {
        throw new Error('MMOOMM app fixture must contain a scene saved through the browser PlayCanvas Editor authoring flow')
    }
    if (!authoredScene.payload?.metadata || authoredScene.payload.metadata.mmoomm == null) {
        throw new Error('MMOOMM app fixture PlayCanvas scene must contain MMOOMM runtime projection metadata')
    }
    if (JSON.stringify(authoredScene.payload.metadata).includes('playcanvas-editor-iframe-mmoomm-panel')) {
        throw new Error('MMOOMM app fixture must not depend on the removed PlayCanvas Editor MMOOMM overlay panel')
    }
    const authoredEntities = authoredScene.payload.entities ?? []
    assertUniqueStrings(
        authoredEntities.map((entity) => entity.id),
        'authoring scene entity ids'
    )
    assertUniqueStrings(authoredEntities.map((entity) => String(entity.name ?? '')).filter(Boolean), 'authoring scene entity names')
    const shipEntity = authoredEntities.find((entity) => entity.name === 'MMOOMM Ship')
    const stationEntity = authoredEntities.find((entity) => entity.name === 'MMOOMM Station')
    const keyLightEntity = authoredEntities.find((entity) => entity.name === 'MMOOMM Key Light')
    if (!shipEntity?.id || !stationEntity?.id) {
        throw new Error('MMOOMM app fixture PlayCanvas scene must contain browser-authored ship and station entities')
    }
    if (!keyLightEntity?.id) {
        throw new Error('MMOOMM app fixture PlayCanvas scene must contain a browser-authored key light for readable Editor materials')
    }
    // Native PlayCanvas Editor entity ids are authored inside the scene payload and are not Universo database identities.
    // UUID v4 is accepted only for this native payload scope; project, scene, manifest, and metahub ids remain UUID v7-owned elsewhere.
    if ((isUuidV4(shipEntity.id) || isUuidV4(stationEntity.id)) && shipEntity.id === stationEntity.id) {
        throw new Error('MMOOMM app fixture native PlayCanvas entity ids must remain unique')
    }
    assertRenderableMmoommEntity(shipEntity)
    assertRenderableMmoommEntity(stationEntity)
    assertMmoommLightingEntity(keyLightEntity)
    const mmoommScene = (authoredScene.payload.metadata.mmoomm as { scene?: Record<string, unknown> }).scene
    const provenance = (authoredScene.payload.metadata.mmoomm as { provenance?: Record<string, unknown> }).provenance
    if (provenance?.authoringFlow !== 'playcanvas-editor-native-scene') {
        throw new Error('MMOOMM app fixture must be authored as a native PlayCanvas Editor scene')
    }
    if (mmoommScene?.controlledObjectId !== shipEntity.id || mmoommScene?.targetObjectId !== stationEntity.id) {
        throw new Error('MMOOMM app fixture PlayCanvas scene projection must reference the browser-authored entity ids')
    }
    assertMmoommSceneObjectMatchesEntity(mmoommScene, shipEntity, 'ship')
    assertMmoommSceneObjectMatchesEntity(mmoommScene, stationEntity, 'station')
    assertVisualLinkupLabScene(visualLabScene)
    if (!Array.isArray(playcanvasProjects.runtimeManifests) || playcanvasProjects.runtimeManifests.length < 1) {
        throw new Error('MMOOMM app fixture must include generated PlayCanvas runtime manifests')
    }
    if (Array.isArray(playcanvasProjects.generatedArtifacts) && playcanvasProjects.generatedArtifacts.length === 0) {
        // The app fixture publishes runtime manifests directly from the native Editor scene.
        // Empty generated artifacts are valid only while runtime manifests carry the published payload.
        if (playcanvasProjects.runtimeManifests.length < 1) {
            throw new Error('MMOOMM app fixture cannot have empty generated artifacts without published runtime manifests')
        }
    }
    const authoringManifest = playcanvasProjects.runtimeManifests.find((manifest) => manifest.projectId === authoringProject.id)
    const visualLabManifest = playcanvasProjects.runtimeManifests.find((manifest) => manifest.projectId === visualLabProject.id)
    if (!authoringManifest?.metadata?.mmoomm?.scene) {
        throw new Error('MMOOMM app fixture authoring runtime manifest must carry MMOOMM flight scene metadata')
    }
    if (authoringManifest.metadata.mmoomm[MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY]) {
        throw new Error('MMOOMM app fixture authoring runtime manifest must not carry visual lab metadata')
    }
    if (!visualLabManifest?.metadata?.mmoomm?.[MMOOMM_VISUAL_LINKUP_LAB_METADATA_KEY]) {
        throw new Error('MMOOMM app fixture visual lab runtime manifest must carry MMOOMM visualLab metadata')
    }
    if (visualLabManifest.metadata.mmoomm.scene) {
        throw new Error('MMOOMM app fixture visual lab runtime manifest must not carry playable flight scene metadata')
    }
    for (const manifest of playcanvasProjects.runtimeManifests) {
        if (typeof manifest.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.checksum)) {
            throw new Error('MMOOMM app fixture runtime manifests must include stable checksums')
        }
        if (!manifest.metadata?.mmoomm) {
            throw new Error('MMOOMM app fixture runtime manifests must carry MMOOMM metadata')
        }
    }
    assertUniqueStrings(
        playcanvasProjects.runtimeManifests.map(
            (manifest) => `${String(manifest.projectId)}:${String(manifest.sceneId)}:${String(manifest.checksum)}`
        ),
        'runtime manifest project/scene/checksum keys'
    )
    return playcanvasProjects
}

const assertRuntimeManifestWidgetBinding = (
    snapshot: NonNullable<SnapshotEnvelope['snapshot']>,
    playcanvasProjects: PlayCanvasProjectSnapshot
): void => {
    const widgetConfigs = [
        ...readWidgetConfigsByKey(snapshot.layouts, 'playcanvasCanvas'),
        ...readWidgetConfigsByKey(snapshot.layoutZoneWidgets, 'playcanvasCanvas')
    ]
    const authoringProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_AUTHORING_PROJECT_NAME)
    const visualLabProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    const configsWithRuntimeManifest = widgetConfigs.filter(
        (candidate) => candidate.runtimeManifest && typeof candidate.runtimeManifest === 'object'
    )
    if (configsWithRuntimeManifest.length !== 2) {
        throw new Error('MMOOMM app fixture must bind exactly two playcanvasCanvas widgets: flight and visual lab')
    }

    const assertWidgetBinding = (input: {
        projectId: unknown
        titleEn: string
        titleRu: string
        sectionCodename: string
        roleLabel: string
    }): void => {
        const config = configsWithRuntimeManifest.find((candidate) => {
            const binding = candidate.runtimeManifest as { projectId?: unknown } | undefined
            return binding?.projectId === input.projectId
        })
        if (!config) {
            throw new Error(`MMOOMM app fixture must include a playcanvasCanvas widget for ${input.roleLabel}`)
        }
        const binding = config.runtimeManifest as {
            source?: unknown
            projectId?: unknown
            sceneId?: unknown
            checksum?: unknown
            failClosed?: unknown
        }
        if (binding.source !== 'publishedManifest') {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} widget runtimeManifest binding must use publishedManifest source`)
        }
        const matchingManifest = playcanvasProjects.runtimeManifests?.find(
            (manifest) =>
                manifest.projectId === binding.projectId && manifest.sceneId === binding.sceneId && manifest.checksum === binding.checksum
        )
        if (!matchingManifest) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} widget runtimeManifest binding must match exported manifest data`)
        }
        if (binding.failClosed !== true) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} widget runtimeManifest binding must fail closed`)
        }
        if (config.heightMode !== 'fitViewport' || typeof config.minHeight !== 'number' || config.minHeight < 560) {
            throw new Error(
                `MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must use fitViewport height with a playable minimum height`
            )
        }
        if (readLocalizedText(config.title, 'en') !== input.titleEn || readLocalizedText(config.title, 'ru') !== input.titleRu) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} PlayCanvas widget title must be localized in EN/RU`)
        }
        const visibleFor = config.visibleFor as { sectionCodenames?: unknown } | undefined
        if (!Array.isArray(visibleFor?.sectionCodenames) || visibleFor.sectionCodenames.length !== 1) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must be visible for exactly one section`)
        }
        if (!visibleFor.sectionCodenames.includes(input.sectionCodename)) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must be visible only for ${input.sectionCodename}`)
        }
    }

    assertWidgetBinding({
        projectId: authoringProject.id,
        titleEn: 'Universo MMOOMM',
        titleRu: 'Universo MMOOMM',
        sectionCodename: MMOOMM_SPACE_SECTION_CODENAME,
        roleLabel: 'flight'
    })
    assertWidgetBinding({
        projectId: visualLabProject.id,
        titleEn: 'Visual Linkup Lab',
        titleRu: 'Визуальная лаборатория',
        sectionCodename: MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME,
        roleLabel: 'visual lab'
    })
}

const assertMenuWidgetLocalization = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const menuConfigs = [
        ...readWidgetConfigsByKey(snapshot.layouts, 'menuWidget'),
        ...readWidgetConfigsByKey(snapshot.layoutZoneWidgets, 'menuWidget')
    ]
    const config = menuConfigs.find((candidate) => readLocalizedText(candidate.title, 'en') === 'Navigation')
    if (!config) {
        throw new Error('MMOOMM app fixture must include the localized navigation menu widget')
    }
    if (readLocalizedText(config.title, 'ru') !== 'Навигация') {
        throw new Error('MMOOMM app fixture menu title must include the Russian translation')
    }
    const items = Array.isArray(config.items)
        ? (config.items as Array<{ title?: unknown; sectionId?: unknown; objectCollectionId?: unknown }>)
        : []
    const requiredItems = [
        { en: 'Welcome', ru: 'Добро пожаловать', targetId: requireEntityId(snapshot, 'page', 'WelcomePage') },
        { en: 'Space', ru: 'Космос', targetId: requireEntityId(snapshot, 'object', MMOOMM_SPACE_SECTION_CODENAME) },
        {
            en: 'Visual Linkup Lab',
            ru: 'Визуальная лаборатория',
            targetId: requireEntityId(snapshot, 'object', MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME)
        }
    ]
    for (const expected of requiredItems) {
        const matched = items.find((item) => readLocalizedText(item.title, 'en') === expected.en)
        if (!matched || readLocalizedText(matched.title, 'ru') !== expected.ru) {
            throw new Error(`MMOOMM app fixture menu item ${expected.en} must include the Russian translation`)
        }
        if (matched.sectionId !== expected.targetId || matched.objectCollectionId !== expected.targetId) {
            throw new Error(`MMOOMM app fixture menu item ${expected.en} must target the section UUID`)
        }
    }
    if ((config as { startPage?: unknown }).startPage !== requiredItems[0].targetId) {
        throw new Error('MMOOMM app fixture menu start page must target the Welcome section UUID')
    }
    const sideMenu = (config as { sideMenu?: unknown }).sideMenu as Record<string, unknown> | undefined
    if (
        !sideMenu ||
        sideMenu.primaryMode !== 'wide' ||
        sideMenu.rememberUserChoice !== true ||
        !Array.isArray(sideMenu.availableModes) ||
        sideMenu.availableModes.join(',') !== 'wide,compact,overlay'
    ) {
        throw new Error('MMOOMM app fixture menu widget must preserve default side menu display modes')
    }
}

const findEntityId = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>, kind: string, codename: string): string | null => {
    for (const [id, item] of Object.entries(snapshot.entities ?? {})) {
        if (item.kind === kind && readCodenameText(item.codename) === codename) {
            return id
        }
    }
    return null
}

const requireEntityId = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>, kind: string, codename: string): string => {
    const id = findEntityId(snapshot, kind, codename)
    if (!id) {
        throw new Error(`MMOOMM app fixture is missing ${kind} ${codename}`)
    }
    return id
}

const requireChildCodenames = (
    label: string,
    items: Array<{ codename?: unknown }> | undefined,
    expectedCodenames: readonly string[]
): void => {
    const actual = new Set((items ?? []).map((item) => readCodenameText(item.codename)).filter(Boolean))
    for (const expected of expectedCodenames) {
        if (!actual.has(expected)) {
            throw new Error(`MMOOMM app fixture ${label} is missing ${expected}`)
        }
    }
}

const assertDomainModel = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    for (const codename of ['FlightWorld', 'FlightShip', 'FlightStation']) {
        requireEntityId(snapshot, 'object', codename)
    }
    const movementCommandsId = requireEntityId(snapshot, 'enumeration', 'MovementCommands')
    requireChildCodenames('MovementCommands enumeration', snapshot.optionValues?.[movementCommandsId], [
        'MoveToPoint',
        'MoveToObject',
        'Stop'
    ])
    const simulationConstantsId = requireEntityId(snapshot, 'set', 'FlightSimulationConstants')
    requireChildCodenames('FlightSimulationConstants set', snapshot.fixedValues?.[simulationConstantsId], [
        'CruiseSpeedMetersPerSecond',
        'AccelerationMetersPerSecond2',
        'DecelerationMetersPerSecond2',
        'ArrivalRadiusMeters'
    ])
    const allEntities = Object.values(snapshot.entities ?? {}) as Array<{
        id?: string
        kind?: string
        name?: unknown
        codename?: unknown
        config?: Record<string, unknown> | null
    }>
    const projectInstances = allEntities.filter((instance) => instance.kind === 'project')
    if (projectInstances.length !== 2) {
        throw new Error('MMOOMM fixture contract: expected exactly two Projects instances for authoring and visual lab')
    }
    assertUniqueStrings(
        projectInstances.map((instance) => instance.id),
        'Projects instance ids'
    )
    assertUniqueStrings(
        projectInstances.map((instance) => readCodenameText(instance.codename)),
        'Projects instance codenames'
    )
    for (const expectedName of [MMOOMM_AUTHORING_PROJECT_NAME, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME]) {
        const instance = projectInstances.find(
            (candidate) =>
                readLocalizedText(candidate.name, 'en') === expectedName ||
                readCodenameText(candidate.codename) === expectedName.replace(/\s+/g, '')
        )
        const binding = instance?.config?.projectBinding as { projectId?: unknown; projectCodename?: unknown } | undefined
        if (!instance?.id || typeof binding?.projectId !== 'string' || typeof binding.projectCodename !== 'string') {
            throw new Error(`MMOOMM fixture contract: project instance ${expectedName} must be bound to a PlayCanvas project`)
        }
    }
}

const assertRuntimeModules = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const modules = snapshot.modules ?? []
    const findModule = (codename: string) =>
        modules.find(
            (item) => item && typeof item === 'object' && readCodenameText((item as { codename?: unknown }).codename) === codename
        ) as Record<string, unknown> | undefined
    const clientModule = findModule('flight-canvas-widget')
    const serverModule = findModule('fixed-tick-flight-runtime')
    if (!clientModule || clientModule.moduleRole !== 'widget') {
        throw new Error('MMOOMM app fixture must include the flight-canvas-widget widget module')
    }
    if (!serverModule || serverModule.moduleRole !== 'module') {
        throw new Error('MMOOMM app fixture must include the fixed-tick-flight-runtime server module')
    }
    if (typeof clientModule.clientBundle !== 'string' || clientModule.clientBundle.trim().length === 0) {
        throw new Error('MMOOMM app fixture client module must preserve a non-empty clientBundle')
    }
    if (typeof serverModule.serverBundle !== 'string' || serverModule.serverBundle.trim().length === 0) {
        throw new Error('MMOOMM app fixture server module must preserve a non-empty serverBundle')
    }
}

export const assertMmoommAppFixtureEnvelopeContract = (envelope: SnapshotEnvelope): void => {
    const snapshot = envelope.snapshot
    if (!snapshot) {
        throw new Error('MMOOMM app fixture must contain a snapshot')
    }
    if (typeof envelope.snapshotHash !== 'string' || computeSnapshotHash(snapshot) !== envelope.snapshotHash) {
        throw new Error('MMOOMM app fixture snapshotHash does not match snapshot content')
    }
    for (const expected of MMOOMM_APP_PACKAGES) {
        assertPackage(snapshot, expected)
    }
    assertDomainModel(snapshot)
    assertRuntimeModules(snapshot)
    if (!hasWidget(snapshot.layouts, 'playcanvasCanvas') && !hasWidget(snapshot.layoutZoneWidgets, 'playcanvasCanvas')) {
        throw new Error('MMOOMM app fixture must include the playcanvasCanvas widget')
    }
    assertMenuWidgetLocalization(snapshot)
    const metahubCodename = readCodenameText((envelope as { metahub?: { codename?: unknown } }).metahub?.codename)
    if (metahubCodename !== MMOOMM_APP_CANONICAL_METAHUB.codename.en) {
        throw new Error(`MMOOMM app fixture metahub codename must be ${MMOOMM_APP_CANONICAL_METAHUB.codename.en}`)
    }
    const playcanvasProjects = assertPlayCanvasProjectSnapshot(snapshot)
    assertRuntimeManifestWidgetBinding(snapshot, playcanvasProjects)
}
