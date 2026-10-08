import type { SnapshotEnvelope } from './mmoommAppFixtureContract.shared.ts'
import {
    MMOOMM_APP_PACKAGES,
    MMOOMM_AUTHORING_PROJECT_NAME,
    MMOOMM_SPACE_SECTION_CODENAME,
    MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME,
    MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME
} from './mmoommAppFixtureContract.shared.ts'
import { assertUniqueStrings, readCodenameText, readLocalizedText } from './mmoommAppFixtureContract.shared.ts'
import { requirePlayCanvasProjectByName } from './mmoommPlaycanvasSceneContract.ts'
import type { PlayCanvasProjectSnapshot } from './mmoommAppFixtureContract.shared.ts'

export const hasWidget = (value: unknown, widgetKey: string): boolean => {
    if (Array.isArray(value)) {
        return value.some((item) => hasWidget(item, widgetKey))
    }
    if (!value || typeof value !== 'object') {
        return false
    }
    const record = value as Record<string, unknown>
    return record.widgetKey === widgetKey || Object.values(record).some((item) => hasWidget(item, widgetKey))
}

export const assertPackage = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>, expected: (typeof MMOOMM_APP_PACKAGES)[number]) => {
    const matched = snapshot.packages?.some((item) => {
        const candidate = item as {
            packageName?: string
            version?: string
            source?: { runtimeTargets?: string[]; upstreamVersion?: string }
            config?: Record<string, unknown>
        }
        if (candidate.packageName !== expected.packageName || candidate.version !== expected.version) return false
        if (candidate.source?.upstreamVersion !== expected.upstreamVersion) return false
        return expected.target === null || candidate.source?.runtimeTargets?.includes(expected.target)
    })
    if (!matched) {
        throw new Error(`MMOOMM app fixture is missing package ${expected.packageName}@${expected.version}`)
    }
}

export const assertRuntimeManifestWidgetBinding = (
    snapshot: NonNullable<SnapshotEnvelope['snapshot']>,
    playcanvasProjects: PlayCanvasProjectSnapshot
): void => {
    const defaultLayoutId = typeof snapshot.defaultLayoutId === 'string' ? snapshot.defaultLayoutId : null
    const defaultLayout = (snapshot.layouts ?? []).find(
        (candidate) => candidate && typeof candidate === 'object' && (candidate as { id?: unknown }).id === defaultLayoutId
    ) as { id?: unknown; templateKey?: unknown } | undefined
    if (!defaultLayout || defaultLayout.templateKey !== 'dashboard') {
        throw new Error('MMOOMM app fixture must identify its default Dashboard layout')
    }
    const placements = (snapshot.layoutZoneWidgets ?? []).filter(
        (candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === 'object'
    )
    const scopedLayouts = (snapshot.scopedLayouts ?? []).filter(
        (candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === 'object'
    )
    const canvasPlacements = placements.filter((placement) => placement.widgetKey === 'playcanvasCanvas')
    const authoringProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_AUTHORING_PROJECT_NAME)
    const visualLabProject = requirePlayCanvasProjectByName(playcanvasProjects, MMOOMM_VISUAL_LINKUP_LAB_PROJECT_NAME)
    if (canvasPlacements.length !== 2) {
        throw new Error('MMOOMM app fixture must contain exactly two placed PlayCanvas widgets: flight and visual lab')
    }
    if (canvasPlacements.some((placement) => placement.layoutId === defaultLayoutId)) {
        throw new Error('MMOOMM PlayCanvas widgets must be scoped to their semantic Object targets, not the global layout')
    }

    const assertWidgetBinding = (input: {
        projectId: unknown
        titleEn: string
        titleRu: string
        entityCodename: string
        entityNameEn: string
        entityNameRu: string
        roleLabel: string
    }): void => {
        const placement = canvasPlacements.find((candidate) => {
            const config = candidate.config && typeof candidate.config === 'object' ? (candidate.config as Record<string, unknown>) : {}
            const binding = config.runtimeManifest as { projectId?: unknown } | undefined
            return binding?.projectId === input.projectId
        })
        if (!placement) {
            throw new Error(`MMOOMM app fixture must include a playcanvasCanvas widget for ${input.roleLabel}`)
        }
        const config = placement.config && typeof placement.config === 'object' ? (placement.config as Record<string, unknown>) : {}
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
        if (placement.zone !== 'center' || placement.isActive !== true) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must be active in the center placement zone`)
        }
        if (Object.hasOwn(config, 'visibleFor')) {
            throw new Error(
                `MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must use scoped layout placement instead of visibleFor config`
            )
        }
        const scopedLayout = scopedLayouts.find((candidate) => candidate.id === placement.layoutId)
        const entityId = findEntityId(snapshot, 'object', input.entityCodename)
        if (
            !entityId ||
            !scopedLayout ||
            scopedLayout.scopeEntityId !== entityId ||
            scopedLayout.baseLayoutId !== defaultLayoutId ||
            scopedLayout.templateKey !== 'dashboard' ||
            scopedLayout.isActive !== true
        ) {
            throw new Error(
                `MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must be placed on an active Dashboard layout scoped to Object ${input.entityCodename}`
            )
        }
        if (config.heightMode !== 'fitViewport' || typeof config.minHeight !== 'number' || config.minHeight < 560) {
            throw new Error(
                `MMOOMM app fixture ${input.roleLabel} PlayCanvas widget must use fitViewport height with a playable minimum height`
            )
        }
        if (readLocalizedText(config.title, 'en') !== input.titleEn || readLocalizedText(config.title, 'ru') !== input.titleRu) {
            throw new Error(`MMOOMM app fixture ${input.roleLabel} PlayCanvas widget title must be localized in EN/RU`)
        }
        const entity = snapshot.entities?.[entityId]
        if (
            entity?.kind !== 'object' ||
            readLocalizedText(entity.presentation?.name, 'en') !== input.entityNameEn ||
            readLocalizedText(entity.presentation?.name, 'ru') !== input.entityNameRu
        ) {
            throw new Error(
                `MMOOMM app fixture ${input.roleLabel} generated navigation source Object ${input.entityCodename} must have matching bilingual Entity presentation metadata`
            )
        }
    }

    assertWidgetBinding({
        projectId: authoringProject.id,
        titleEn: 'Universo MMOOMM',
        titleRu: 'Universo MMOOMM',
        entityCodename: MMOOMM_SPACE_SECTION_CODENAME,
        entityNameEn: 'Space',
        entityNameRu: 'Космос',
        roleLabel: 'flight'
    })
    assertWidgetBinding({
        projectId: visualLabProject.id,
        titleEn: 'Visual Linkup Lab',
        titleRu: 'Визуальная лаборатория',
        entityCodename: MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME,
        entityNameEn: 'Visual Linkup Lab',
        entityNameRu: 'Визуальная лаборатория',
        roleLabel: 'visual lab'
    })
}

export const assertGeneratedMenuEntitySource = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const defaultLayoutId = typeof snapshot.defaultLayoutId === 'string' ? snapshot.defaultLayoutId : null
    const menuPlacement = (snapshot.layoutZoneWidgets ?? []).find(
        (candidate) =>
            candidate &&
            typeof candidate === 'object' &&
            (candidate as Record<string, unknown>).widgetKey === 'menuWidget' &&
            (candidate as Record<string, unknown>).layoutId === defaultLayoutId
    ) as Record<string, unknown> | undefined
    if (!menuPlacement || menuPlacement.zone !== 'left' || menuPlacement.isActive !== true) {
        throw new Error('MMOOMM app fixture must include an active left-zone generated menu placement on the default layout')
    }
    const config = menuPlacement.config && typeof menuPlacement.config === 'object' ? (menuPlacement.config as Record<string, unknown>) : {}
    if (config.variant !== 'generated' || Object.keys(config).length !== 1) {
        throw new Error('MMOOMM app fixture menu config must select generated Entity navigation without embedded menu content')
    }
    if (Object.hasOwn(config, 'startPage') || Object.hasOwn(config, 'items')) {
        throw new Error('MMOOMM app fixture generated menu must not store startPage or authored menu items')
    }

    const runtimeConfig = (codename: string): Record<string, unknown> | null => {
        const entityId = requireEntityId(snapshot, 'object', codename)
        const entityConfig = snapshot.entities?.[entityId]?.config
        if (!entityConfig || typeof entityConfig !== 'object' || Array.isArray(entityConfig)) return null
        const runtime = (entityConfig as Record<string, unknown>).runtime
        return runtime && typeof runtime === 'object' && !Array.isArray(runtime) ? (runtime as Record<string, unknown>) : null
    }
    for (const [codename, icon] of [
        [MMOOMM_SPACE_SECTION_CODENAME, 'apps'],
        [MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME, 'analytics']
    ] as const) {
        const metadata = runtimeConfig(codename)
        if (metadata?.menuVisibility !== 'primary' || metadata.icon !== icon) {
            throw new Error('MMOOMM app fixture ' + codename + ' must be explicitly selected for primary navigation with its semantic icon')
        }
    }
    const primaryObjectCodenames = Object.values(snapshot.entities ?? {})
        .filter((entity) => entity.kind === 'object')
        .filter((entity) => {
            const config = entity.config
            if (!config || typeof config !== 'object' || Array.isArray(config)) return false
            const runtime = (config as Record<string, unknown>).runtime
            return Boolean(
                runtime &&
                    typeof runtime === 'object' &&
                    !Array.isArray(runtime) &&
                    (runtime as Record<string, unknown>).menuVisibility === 'primary'
            )
        })
        .map((entity) => readLocalizedText(entity.codename, 'en'))
        .sort()
    if (
        JSON.stringify(primaryObjectCodenames) !==
        JSON.stringify([MMOOMM_SPACE_SECTION_CODENAME, MMOOMM_VISUAL_LINKUP_LAB_SECTION_CODENAME].sort())
    ) {
        throw new Error('MMOOMM app fixture must expose exactly Space and Visual Linkup Lab as primary Object navigation items')
    }
    for (const codename of ['FlightShip', 'FlightStation']) {
        if (runtimeConfig(codename)?.menuVisibility === 'primary') {
            throw new Error('MMOOMM app fixture ordinary Object ' + codename + ' must stay out of primary navigation')
        }
    }

    const welcomePageId = requireEntityId(snapshot, 'page', 'WelcomePage')
    const welcomePage = snapshot.entities?.[welcomePageId]
    if (
        readLocalizedText(welcomePage?.presentation?.name, 'en') !== 'Welcome' ||
        readLocalizedText(welcomePage?.presentation?.name, 'ru') !== 'Добро пожаловать'
    ) {
        throw new Error('MMOOMM generated navigation source Page WelcomePage must retain its bilingual Entity presentation metadata')
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

export const assertDomainModel = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
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

export const assertRuntimeModules = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const modules = snapshot.modules ?? []
    const findModule = (codename: string) =>
        modules.find(
            (item) => item && typeof item === 'object' && readCodenameText((item as { codename?: unknown }).codename) === codename
        ) as Record<string, unknown> | undefined
    const serverModule = findModule('fixed-tick-flight-runtime')
    if (!serverModule || serverModule.moduleRole !== 'module') {
        throw new Error('MMOOMM app fixture must include the fixed-tick-flight-runtime server module')
    }
    if (typeof serverModule.serverBundle !== 'string' || serverModule.serverBundle.trim().length === 0) {
        throw new Error('MMOOMM app fixture server module must preserve a non-empty serverBundle')
    }
    // The flight-canvas-widget client module was replaced by PlayCanvas script
    // assets (flight-control / follow-camera / remote-ships) — it must NOT return.
    if (findModule('flight-canvas-widget')) {
        throw new Error('MMOOMM app fixture must not carry the legacy flight-canvas-widget client module')
    }
}
