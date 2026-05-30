import { computeSnapshotHash } from '@universo-react/utils'

export const MMOOMM_FLIGHT_FIXTURE_FILENAME = 'metahubs-mmoomm-flight-app-snapshot.json'

export const MMOOMM_FLIGHT_CANONICAL_METAHUB = {
    name: {
        en: 'MMOOMM Flight Simulator',
        ru: 'Симулятор полета MMOOMM'
    },
    description: {
        en: 'A minimal PlayCanvas and Colyseus powered flight simulator metahub configuration.',
        ru: 'Минимальная конфигурация метахаба flight simulator на PlayCanvas и Colyseus.'
    },
    codename: {
        en: 'MmoommFlightSimulator',
        ru: 'MmoommFlightSimulator'
    }
} as const

export const MMOOMM_FLIGHT_PACKAGES = [
    { packageName: '@universo-react/playcanvas-engine', version: '0.1.0', target: 'client' },
    { packageName: '@universo-react/colyseus-client', version: '0.1.0', target: 'client' },
    { packageName: '@universo-react/colyseus-server', version: '0.1.0', target: 'server' }
] as const

export const MMOOMM_FLIGHT_ACCEPTANCE_MATRIX = [
    'snapshot contains attached PlayCanvas and Colyseus wrapper packages',
    'snapshot declares Object entities for world, ship, and station',
    'snapshot declares Movement Commands enumeration and Flight Simulation Constants set',
    'snapshot contains widget and server runtime modules with packageImports',
    'snapshot server runtime module declares deterministic multi-ship spawn options',
    'snapshot layout renders the generic playcanvasCanvas widget',
    'published runtime can open a bounded non-empty canvas and sync two ships'
] as const

export interface SnapshotEnvelope {
    snapshot?: {
        packages?: unknown[]
        entities?: Record<string, { kind?: unknown; codename?: unknown }>
        fixedValues?: Record<string, Array<{ codename?: unknown; dataType?: unknown; value?: unknown }>>
        optionValues?: Record<string, Array<{ codename?: unknown; isDefault?: unknown }>>
        modules?: unknown[]
        layouts?: unknown[]
        layoutZoneWidgets?: unknown[]
        layoutConfig?: Record<string, unknown>
    }
    snapshotHash?: string
}

const readCodenameText = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const primary = record._primary ?? 'en'
    const content = record.locales?.[primary]?.content
    return typeof content === 'string' ? content : ''
}

const readLocalizedContentText = (value: unknown, locale = 'en'): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const content = record.locales?.[locale]?.content ?? record.locales?.[record._primary ?? 'en']?.content
    return typeof content === 'string' ? content : ''
}

const readEntityName = (entity: unknown, locale = 'en'): string => {
    if (!entity || typeof entity !== 'object') return ''
    const presentation = (entity as { presentation?: { name?: unknown } }).presentation
    return readLocalizedContentText(presentation?.name, locale)
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

const hasPlayCanvasRealtimeModuleConfig = (value: unknown): boolean => {
    if (Array.isArray(value)) {
        return value.some(hasPlayCanvasRealtimeModuleConfig)
    }
    if (!value || typeof value !== 'object') {
        return false
    }
    const record = value as Record<string, unknown>
    const config = record.config && typeof record.config === 'object' ? (record.config as Record<string, unknown>) : record
    return (
        record.widgetKey === 'playcanvasCanvas' &&
        config.moduleCodename === 'flight-canvas-widget' &&
        config.serverModuleCodename === 'fixed-tick-flight-runtime'
    )
}

const readWidgetKeyRecords = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) {
        return value.flatMap(readWidgetKeyRecords)
    }
    if (!value || typeof value !== 'object') {
        return []
    }
    const record = value as Record<string, unknown>
    const own = typeof record.widgetKey === 'string' ? [record] : []
    return [...own, ...Object.values(record).flatMap(readWidgetKeyRecords)]
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
        throw new Error(`MMOOMM flight fixture is missing ${kind} ${codename}`)
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
            throw new Error(`MMOOMM flight fixture ${label} is missing ${expected}`)
        }
    }
}

const readWidgetConfigs = (value: unknown): Record<string, unknown>[] => {
    if (Array.isArray(value)) {
        return value.flatMap(readWidgetConfigs)
    }
    if (!value || typeof value !== 'object') {
        return []
    }
    const record = value as Record<string, unknown>
    const ownConfig =
        record.widgetKey === 'playcanvasCanvas' && record.config && typeof record.config === 'object'
            ? [record.config as Record<string, unknown>]
            : []
    return [...ownConfig, ...Object.values(record).flatMap(readWidgetConfigs)]
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

const assertUniqueSceneObjectIds = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const configs = [...readWidgetConfigs(snapshot.layouts), ...readWidgetConfigs(snapshot.layoutZoneWidgets)]
    for (const config of configs) {
        const scene = config.scene && typeof config.scene === 'object' ? (config.scene as Record<string, unknown>) : null
        const objects = Array.isArray(scene?.objects) ? scene.objects : []
        const ids = objects
            .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : null))
            .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        if (new Set(ids).size !== ids.length) {
            throw new Error('MMOOMM flight fixture playcanvasCanvas scene object ids must be unique')
        }
    }
}

const assertNoInheritedDetailsRuntimeWidgets = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const layoutConfigs = [
        snapshot.layoutConfig,
        ...(Array.isArray(snapshot.layouts)
            ? snapshot.layouts
                  .map((layout) => (layout && typeof layout === 'object' ? (layout as { config?: unknown }).config : null))
                  .filter((config): config is Record<string, unknown> => Boolean(config && typeof config === 'object'))
            : [])
    ]
    if (layoutConfigs.some((config) => config.showDetailsTable === true || config.showDetailsTitle === true)) {
        throw new Error('MMOOMM flight fixture layout must not enable inherited details title/table')
    }

    const forbiddenWidgets = new Set(['detailsTitle', 'detailsTable'])
    const activeForbiddenWidgets = [...readWidgetKeyRecords(snapshot.layouts), ...readWidgetKeyRecords(snapshot.layoutZoneWidgets)].filter(
        (widget) => forbiddenWidgets.has(String(widget.widgetKey)) && widget.isActive !== false
    )
    if (activeForbiddenWidgets.length > 0) {
        throw new Error('MMOOMM flight fixture must not contain active inherited details widgets in runtime layout')
    }
}

const assertFlightSceneGeometry = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const configs = [...readWidgetConfigs(snapshot.layouts), ...readWidgetConfigs(snapshot.layoutZoneWidgets)]
    const scene = configs
        .map((config) => (config.scene && typeof config.scene === 'object' ? (config.scene as Record<string, unknown>) : null))
        .find((candidate) => Array.isArray(candidate?.objects))
    const objects = Array.isArray(scene?.objects) ? scene.objects : []
    const ship = objects.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === 'ship') as
        | Record<string, unknown>
        | undefined
    const station = objects.find((item) => item && typeof item === 'object' && (item as { id?: unknown }).id === 'station') as
        | Record<string, unknown>
        | undefined

    const hasVector = (value: unknown, expected: { x: number; y: number; z: number }) =>
        Boolean(
            value &&
                typeof value === 'object' &&
                (value as { x?: unknown }).x === expected.x &&
                (value as { y?: unknown }).y === expected.y &&
                (value as { z?: unknown }).z === expected.z
        )

    if (!ship || !hasVector(ship.scale, { x: 12, y: 4, z: 4 })) {
        throw new Error('MMOOMM flight fixture ship must use the required 12 x 4 x 4 scale')
    }
    if (
        !station ||
        station.guard !== true ||
        !hasVector(station.scale, { x: 48, y: 16, z: 16 }) ||
        !hasVector(station.position, { x: 72, y: 0, z: -48 })
    ) {
        throw new Error('MMOOMM flight fixture station must use the required guarded 48 x 16 x 16 box at the canonical position')
    }

    const widgetConfig = configs[0]
    if (widgetConfig?.heightMode !== 'fitViewport' || typeof widgetConfig?.minHeight !== 'number' || widgetConfig.minHeight < 560) {
        throw new Error('MMOOMM flight fixture PlayCanvas widget must use fitViewport height with a playable minimum height')
    }
    if (scene?.intentDistance !== 720) {
        throw new Error('MMOOMM flight fixture must set the 10x default double-click intent distance')
    }
    const visibleFor = widgetConfig?.visibleFor as { sectionCodenames?: unknown } | undefined
    if (!Array.isArray(visibleFor?.sectionCodenames) || !visibleFor.sectionCodenames.includes('FlightWorld')) {
        throw new Error('MMOOMM flight fixture PlayCanvas widget must be visible only for the Space section')
    }
}

const assertServerModuleSpawnOptions = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const modules = snapshot.modules ?? []
    const serverModule = modules.find(
        (item) =>
            item && typeof item === 'object' && readCodenameText((item as { codename?: unknown }).codename) === 'fixed-tick-flight-runtime'
    ) as Record<string, unknown> | undefined
    const source = typeof serverModule?.sourceCode === 'string' ? serverModule.sourceCode : ''
    const requiredSpawnOptions: Array<[string, number]> = [
        ['spawnSafetyMargin', 8],
        ['spawnMaxAttempts', 64],
        ['spawnRingSpacing', 24]
    ]
    for (const [name, expectedValue] of requiredSpawnOptions) {
        const assignmentPattern = new RegExp(`${name}\\s*:\\s*${expectedValue}\\b`)
        if (!assignmentPattern.test(source)) {
            throw new Error(`MMOOMM flight fixture server runtime module must return ${name}: ${expectedValue}`)
        }
    }
}

const assertRuntimeModuleContract = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const modules = snapshot.modules ?? []
    const findModule = (codename: string) =>
        modules.find(
            (item) => item && typeof item === 'object' && readCodenameText((item as { codename?: unknown }).codename) === codename
        ) as Record<string, unknown> | undefined
    const clientModule = findModule('flight-canvas-widget')
    const serverModule = findModule('fixed-tick-flight-runtime')
    if (!clientModule || clientModule.moduleRole !== 'widget') {
        throw new Error('MMOOMM flight fixture must include the flight-canvas-widget widget module')
    }
    if (!serverModule || serverModule.moduleRole !== 'module') {
        throw new Error('MMOOMM flight fixture must include the fixed-tick-flight-runtime server module')
    }
    if (typeof clientModule.clientBundle !== 'string' || clientModule.clientBundle.trim().length === 0) {
        throw new Error('MMOOMM flight fixture client module must preserve a non-empty clientBundle')
    }
    if (typeof serverModule.serverBundle !== 'string' || serverModule.serverBundle.trim().length === 0) {
        throw new Error('MMOOMM flight fixture server module must preserve a non-empty serverBundle')
    }

    const clientMethods = (clientModule.manifest as { methods?: Array<{ name?: unknown; target?: unknown }> } | undefined)?.methods ?? []
    const serverMethods = (serverModule.manifest as { methods?: Array<{ name?: unknown; target?: unknown }> } | undefined)?.methods ?? []
    if (!clientMethods.some((method) => method.name === 'mount' && method.target === 'client')) {
        throw new Error('MMOOMM flight fixture client module must expose a client mount method')
    }
    if (!serverMethods.some((method) => method.name === 'createRealtimeRoomOptions' && method.target === 'server')) {
        throw new Error('MMOOMM flight fixture server module must expose createRealtimeRoomOptions on the server')
    }

    const clientPackageImports =
        (clientModule.manifest as { packageImports?: Array<{ packageName?: unknown; targets?: unknown }> } | undefined)?.packageImports ??
        []
    for (const packageName of ['@universo-react/playcanvas-engine', '@universo-react/colyseus-client']) {
        if (
            !clientPackageImports.some(
                (item) => item.packageName === packageName && Array.isArray(item.targets) && item.targets.includes('client')
            )
        ) {
            throw new Error(`MMOOMM flight fixture client module must import ${packageName} for the client runtime`)
        }
    }
}

const assertFlightNavigation = (snapshot: NonNullable<SnapshotEnvelope['snapshot']>): void => {
    const menuConfigs = [
        ...readWidgetConfigsByKey(snapshot.layouts, 'menuWidget'),
        ...readWidgetConfigsByKey(snapshot.layoutZoneWidgets, 'menuWidget')
    ]
    const menuConfig = menuConfigs[0]
    if (!menuConfig) {
        throw new Error('MMOOMM flight fixture must include an explicit menuWidget')
    }
    if (menuConfig.autoShowAllSections !== false || menuConfig.workspacePlacement !== 'hidden' || menuConfig.startPage !== 'WelcomePage') {
        throw new Error('MMOOMM flight fixture menu must start at Welcome and must not auto-show all sections or workspaces')
    }
    const items = Array.isArray(menuConfig.items) ? menuConfig.items : []
    const visibleItems = items.filter((item) => item && typeof item === 'object' && (item as { isActive?: unknown }).isActive !== false)
    const sectionTargets = visibleItems.map((item) => {
        const record = item as { sectionId?: unknown; objectCollectionId?: unknown }
        return String(record.sectionId ?? record.objectCollectionId ?? '')
    })
    if (sectionTargets.length !== 2 || sectionTargets[0] !== 'WelcomePage' || sectionTargets[1] !== 'FlightWorld') {
        throw new Error('MMOOMM flight fixture menu must expose only Welcome and Space, in that order')
    }

    const entities = snapshot.entities ?? {}
    const welcomePage = Object.values(entities).find(
        (entity) => entity.kind === 'page' && readCodenameText(entity.codename) === 'WelcomePage'
    )
    const flightWorld = Object.values(entities).find(
        (entity) => entity.kind === 'object' && readCodenameText(entity.codename) === 'FlightWorld'
    )
    if (!welcomePage || readEntityName(welcomePage, 'ru') !== 'Добро пожаловать') {
        throw new Error('MMOOMM flight fixture must present WelcomePage as Добро пожаловать')
    }
    if (!flightWorld || readEntityName(flightWorld, 'ru') !== 'Космос') {
        throw new Error('MMOOMM flight fixture must present FlightWorld as Космос')
    }
    const welcomeContent = JSON.stringify((welcomePage as { config?: unknown }).config ?? {})
    if (
        !welcomeContent.includes('Universo MMOOMM') ||
        welcomeContent.includes('Use this page to publish structured application content.')
    ) {
        throw new Error('MMOOMM flight fixture Welcome page must contain product-specific onboarding content')
    }
}

export const assertMmoommFlightFixtureEnvelopeContract = (envelope: SnapshotEnvelope): void => {
    const snapshot = envelope.snapshot
    if (!snapshot) {
        throw new Error('MMOOMM flight fixture must contain a snapshot')
    }

    if (typeof envelope.snapshotHash !== 'string' || envelope.snapshotHash.trim().length === 0) {
        throw new Error('MMOOMM flight fixture must contain a snapshotHash')
    }
    if (computeSnapshotHash(snapshot) !== envelope.snapshotHash) {
        throw new Error('MMOOMM flight fixture snapshotHash does not match snapshot content')
    }

    for (const expected of MMOOMM_FLIGHT_PACKAGES) {
        const matched = snapshot.packages?.some((item) => {
            const candidate = item as { packageName?: string; version?: string; source?: { runtimeTargets?: string[] } }
            return (
                candidate.packageName === expected.packageName &&
                candidate.version === expected.version &&
                candidate.source?.runtimeTargets?.includes(expected.target)
            )
        })
        if (!matched) {
            throw new Error(`MMOOMM flight fixture is missing package ${expected.packageName}@${expected.version}`)
        }
    }

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
    for (const item of snapshot.fixedValues?.[simulationConstantsId] ?? []) {
        if (item.dataType !== 'NUMBER' || typeof item.value !== 'number' || !Number.isFinite(item.value)) {
            throw new Error('MMOOMM flight fixture simulation constants must be finite NUMBER values')
        }
    }

    const modules = snapshot.modules ?? []
    if (modules.length < 2) {
        throw new Error('MMOOMM flight fixture must include client and server modules')
    }
    if (!modules.some((item) => Array.isArray((item as { manifest?: { packageImports?: unknown[] } }).manifest?.packageImports))) {
        throw new Error('MMOOMM flight fixture modules must preserve packageImports')
    }
    if (!hasWidget(snapshot.layouts, 'playcanvasCanvas') && !hasWidget(snapshot.layoutZoneWidgets, 'playcanvasCanvas')) {
        throw new Error('MMOOMM flight fixture must include the playcanvasCanvas widget')
    }
    if (!hasPlayCanvasRealtimeModuleConfig(snapshot.layouts) && !hasPlayCanvasRealtimeModuleConfig(snapshot.layoutZoneWidgets)) {
        throw new Error('MMOOMM flight fixture must bind the PlayCanvas widget to client and server runtime modules')
    }
    assertRuntimeModuleContract(snapshot)
    assertUniqueSceneObjectIds(snapshot)
    assertNoInheritedDetailsRuntimeWidgets(snapshot)
    assertFlightNavigation(snapshot)
    assertFlightSceneGeometry(snapshot)
    assertServerModuleSpawnOptions(snapshot)
}
