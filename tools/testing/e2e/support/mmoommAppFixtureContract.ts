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
    projects?: Array<{ id?: unknown; defaultSceneId?: unknown }>
    scenes?: Array<{
        id?: unknown
        payload?: {
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
    }>
    sourceFiles?: unknown[]
    generatedArtifacts?: unknown[]
    runtimeManifests?: Array<{ projectId?: unknown; sceneId?: unknown; checksum?: unknown; metadata?: Record<string, unknown> }>
}

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

const isVector3Tuple = (value: unknown): value is [number, number, number] =>
    Array.isArray(value) && value.length === 3 && value.every((item) => Number.isFinite(item))

const isUuidV4 = (value: unknown): boolean =>
    typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

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
    if (!Array.isArray(playcanvasProjects.projects) || playcanvasProjects.projects.length < 1) {
        throw new Error('MMOOMM app fixture must include at least one PlayCanvas project')
    }
    if (!Array.isArray(playcanvasProjects.scenes) || playcanvasProjects.scenes.length < 1) {
        throw new Error('MMOOMM app fixture must include at least one PlayCanvas scene')
    }
    const authoredScene = playcanvasProjects.scenes.find((scene) => {
        const metadata = scene.payload?.metadata
        const mmoomm = metadata && typeof metadata === 'object' ? (metadata.mmoomm as Record<string, unknown> | undefined) : undefined
        const mmoommScene = mmoomm && typeof mmoomm === 'object' ? (mmoomm.scene as Record<string, unknown> | undefined) : undefined
        return Boolean(mmoommScene?.controlledObjectId && mmoommScene?.targetObjectId)
    })
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
    for (const manifest of playcanvasProjects.runtimeManifests) {
        if (typeof manifest.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(manifest.checksum)) {
            throw new Error('MMOOMM app fixture runtime manifests must include stable checksums')
        }
        if (!manifest.metadata?.mmoomm) {
            throw new Error('MMOOMM app fixture runtime manifests must carry MMOOMM metadata')
        }
    }
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
    const config = widgetConfigs.find((candidate) => candidate.runtimeManifest && typeof candidate.runtimeManifest === 'object')
    if (!config) {
        throw new Error('MMOOMM app fixture must bind playcanvasCanvas to a published runtimeManifest')
    }
    const binding = config.runtimeManifest as {
        source?: unknown
        projectId?: unknown
        sceneId?: unknown
        checksum?: unknown
        failClosed?: unknown
    }
    if (binding.source !== 'publishedManifest') {
        throw new Error('MMOOMM app fixture playcanvasCanvas runtimeManifest binding must use the publishedManifest source')
    }
    const matchingManifest = playcanvasProjects.runtimeManifests?.find(
        (manifest) =>
            manifest.projectId === binding.projectId && manifest.sceneId === binding.sceneId && manifest.checksum === binding.checksum
    )
    if (!matchingManifest) {
        throw new Error('MMOOMM app fixture playcanvasCanvas runtimeManifest binding must match exported manifest data')
    }
    if (binding.failClosed !== true) {
        throw new Error('MMOOMM app fixture playcanvasCanvas runtimeManifest binding must fail closed')
    }
    if (config.heightMode !== 'fitViewport' || typeof config.minHeight !== 'number' || config.minHeight < 560) {
        throw new Error('MMOOMM app fixture PlayCanvas widget must use fitViewport height with a playable minimum height')
    }
    if (readLocalizedText(config.title, 'en') !== 'Universo MMOOMM' || readLocalizedText(config.title, 'ru') !== 'Universo MMOOMM') {
        throw new Error('MMOOMM app fixture PlayCanvas widget title must be localized in EN/RU')
    }
    const visibleFor = config.visibleFor as { sectionCodenames?: unknown } | undefined
    if (!Array.isArray(visibleFor?.sectionCodenames) || !visibleFor.sectionCodenames.includes('FlightWorld')) {
        throw new Error('MMOOMM app fixture PlayCanvas widget must be visible only for the Space section')
    }
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
    const items = Array.isArray(config.items) ? (config.items as Array<{ title?: unknown }>) : []
    const requiredItems = [
        { en: 'Welcome', ru: 'Добро пожаловать' },
        { en: 'Space', ru: 'Космос' }
    ]
    for (const expected of requiredItems) {
        const matched = items.find((item) => readLocalizedText(item.title, 'en') === expected.en)
        if (!matched || readLocalizedText(matched.title, 'ru') !== expected.ru) {
            throw new Error(`MMOOMM app fixture menu item ${expected.en} must include the Russian translation`)
        }
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
