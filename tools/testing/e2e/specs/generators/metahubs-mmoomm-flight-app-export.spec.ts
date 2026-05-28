import fs from 'fs'
import path from 'path'
import { test, expect } from '../../fixtures/test'
import {
    assignLayoutZoneWidget,
    createLoggedInApiContext,
    createMetahub,
    createObjectCollection,
    disposeApiContext,
    getLayout,
    listLayoutZoneWidgets,
    listLayouts,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { buildSnapshotEnvelope, createCodenameVLC, validateSnapshotEnvelope } from '@universo-react/utils'
import {
    MMOOMM_FLIGHT_CANONICAL_METAHUB,
    MMOOMM_FLIGHT_FIXTURE_FILENAME,
    MMOOMM_FLIGHT_PACKAGES,
    assertMmoommFlightFixtureEnvelopeContract
} from '../../support/mmoommFlightFixtureContract'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const FIXTURES_DIR = path.resolve(repoRoot, 'tools', 'fixtures')
const SPACE_SECTION_CODENAME = 'FlightWorld'
const WELCOME_SECTION_CODENAME = 'WelcomePage'
const STABLE_TIMESTAMP = '1970-01-01T00:00:00.000Z'

const localizedText = (en: string, ru: string, primary: 'en' | 'ru' = 'en') => ({
    _schema: '1',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP },
        ru: { content: ru, version: 1, isActive: true, createdAt: STABLE_TIMESTAMP, updatedAt: STABLE_TIMESTAMP }
    },
    _primary: primary
})

async function apiGet(api: ApiContext, urlPath: string) {
    const cookieHeader = Array.from((api.cookies as Map<string, string>).entries())
        .map(([name, value]: [string, string]) => `${name}=${value}`)
        .join('; ')

    return fetch(new URL(urlPath, api.baseURL as string).toString(), {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    })
}

const createModule = async (api: ApiContext, metahubId: string, payload: Record<string, unknown>) => {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/modules`, payload)
    expect(response.ok).toBe(true)
    return response.json()
}

const attachPackage = async (api: ApiContext, metahubId: string, packageName: string, version: string) => {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/packages`, { packageName, version })
    expect(response.ok).toBe(true)
    return response.json()
}

const createSet = async (api: ApiContext, metahubId: string, payload: Record<string, unknown>) => {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entities/set/instances`, payload)
    expect(response.ok).toBe(true)
    return response.json()
}

const createEnumeration = async (api: ApiContext, metahubId: string, payload: Record<string, unknown>) => {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entities/enumeration/instances`, payload)
    expect(response.ok).toBe(true)
    return response.json()
}

const createFixedValue = async (api: ApiContext, metahubId: string, setId: string, payload: Record<string, unknown>) => {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entities/set/instance/${setId}/fixed-values`, payload)
    expect(response.ok).toBe(true)
    return response.json()
}

const createEnumerationValue = async (api: ApiContext, metahubId: string, enumerationId: string, payload: Record<string, unknown>) => {
    const response = await sendWithCsrf(
        api,
        'POST',
        `/api/v1/metahub/${metahubId}/entities/enumeration/instance/${enumerationId}/values`,
        payload
    )
    expect(response.ok).toBe(true)
    return response.json()
}

const createWelcomeBlockContent = () => ({
    format: 'editorjs',
    data: {
        time: 0,
        version: '2.29.1',
        blocks: [
            {
                id: 'mmoomm-welcome-title',
                type: 'header',
                data: {
                    text: localizedText('Welcome to Universo MMOOMM', 'Добро пожаловать в Universo MMOOMM'),
                    level: 2
                }
            },
            {
                id: 'mmoomm-welcome-body',
                type: 'paragraph',
                data: {
                    text: localizedText(
                        'This minimal flight simulator validates the metahub-to-application runtime chain: a published configuration mounts PlayCanvas, connects Colyseus realtime state, and lets one ship fly near one station.',
                        'Этот минимальный симулятор полета проверяет runtime-цепочку от метахаба до приложения: опубликованная конфигурация монтирует PlayCanvas, подключает Colyseus realtime state и позволяет одному кораблю летать рядом с одной станцией.'
                    )
                }
            }
        ]
    }
})

const patchMmoommSnapshotContent = (snapshot: Record<string, any>) => {
    for (const entity of Object.values(snapshot.entities ?? {}) as Array<Record<string, any>>) {
        const codename = entity?.codename?.locales?.[entity?.codename?._primary ?? 'en']?.content
        if (entity.kind === 'page' && codename === WELCOME_SECTION_CODENAME) {
            entity.presentation = {
                ...(entity.presentation ?? {}),
                name: localizedText('Welcome', 'Добро пожаловать')
            }
            entity.config = {
                ...(entity.config ?? {}),
                blockContent: createWelcomeBlockContent()
            }
        }
    }
    return snapshot
}

const widgetModuleSource = `
import { ExtensionModule, AtClient } from '@universo-react/extension-sdk'
import { createMoveToPointIntent, createStopIntent } from '@universo-react/colyseus-client'
import { createAabbFromCenterAndSize } from '@universo-react/playcanvas-engine'

export default class FlightCanvasWidget extends ExtensionModule {
    @AtClient()
    async mount(params) {
        const scene = params && typeof params === 'object' && params.scene ? params.scene : null
        return {
            scene,
            moveToPoint: createMoveToPointIntent({ x: 72, y: 0, z: -48 }),
            stop: createStopIntent(),
            stationBounds: createAabbFromCenterAndSize({ x: 72, y: 0, z: -48 }, { x: 48, y: 16, z: 16 })
        }
    }
}
`.trim()

const serverModuleSource = `
import { ExtensionModule, AtServer } from '@universo-react/extension-sdk'

export default class FixedTickFlightRuntime extends ExtensionModule {
    @AtServer()
    async createRealtimeRoomOptions(params) {
        const scene = params && typeof params === 'object' && params.scene ? params.scene : null
        const ship = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.controlledObjectId) : null
        const station = Array.isArray(scene?.objects) ? scene.objects.find((item) => item?.id === scene.targetObjectId) : null
        const initialPosition = ship?.position ?? { x: 0, y: 0, z: 0 }
        const targetPosition = station?.position ?? { x: 72, y: 0, z: -48 }
        const shipScale = ship?.scale ?? { x: 12, y: 4, z: 4 }
        const stationScale = station?.scale ?? { x: 48, y: 16, z: 16 }
        return {
            initialPosition,
            targetObjects: { [scene?.targetObjectId ?? 'station']: targetPosition },
            controlledHalfExtents: { x: Math.abs(shipScale.x) / 2, y: Math.abs(shipScale.y) / 2, z: Math.abs(shipScale.z) / 2 },
            guardBoxes: [
                {
                    center: targetPosition,
                    halfExtents: { x: Math.abs(stationScale.x) / 2, y: Math.abs(stationScale.y) / 2, z: Math.abs(stationScale.z) / 2 }
                }
            ],
            cruiseSpeed: scene?.cruiseSpeed ?? 36,
            acceleration: 48,
            deceleration: 48,
            arrivalRadius: 0.5
        }
    }
}
`.trim()

test.describe('MMOOMM flight simulator fixture generator', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('@generator create canonical mmoomm flight metahub and export snapshot fixture', async ({ runManifest }) => {
        test.setTimeout(300_000)

        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        fs.mkdirSync(FIXTURES_DIR, { recursive: true })

        const metahubName = { ...MMOOMM_FLIGHT_CANONICAL_METAHUB.name }
        const metahub = await createMetahub(api, {
            name: metahubName,
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', MMOOMM_FLIGHT_CANONICAL_METAHUB.codename.en),
            description: MMOOMM_FLIGHT_CANONICAL_METAHUB.description,
            descriptionPrimaryLocale: 'en',
            templateCodename: 'basic'
        })

        if (!metahub?.id) {
            throw new Error('MMOOMM flight generator did not receive a metahub id')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName.en,
            codename: MMOOMM_FLIGHT_CANONICAL_METAHUB.codename.en
        })

        for (const item of MMOOMM_FLIGHT_PACKAGES) {
            await attachPackage(api, metahub.id, item.packageName, item.version)
        }

        await createObjectCollection(api, metahub.id, {
            name: { en: 'Space', ru: 'Космос' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', SPACE_SECTION_CODENAME)
        })
        await createObjectCollection(api, metahub.id, {
            name: { en: 'Flight Ship', ru: 'Корабль' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'FlightShip')
        })
        await createObjectCollection(api, metahub.id, {
            name: { en: 'Flight Station', ru: 'Станция' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'FlightStation')
        })
        const movementCommandEnumeration = await createEnumeration(api, metahub.id, {
            name: { en: 'Movement Commands', ru: 'Команды движения' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'MovementCommands')
        })
        const movementCommandEnumerationId = movementCommandEnumeration?.id ?? movementCommandEnumeration?.data?.id
        expect(typeof movementCommandEnumerationId).toBe('string')
        for (const command of [
            { codename: 'MoveToPoint', name: { en: 'Move to point', ru: 'Лететь в точку' }, isDefault: true },
            { codename: 'MoveToObject', name: { en: 'Move to object', ru: 'Лететь к объекту' }, isDefault: false },
            { codename: 'Stop', name: { en: 'Stop', ru: 'Остановиться' }, isDefault: false }
        ]) {
            await createEnumerationValue(api, metahub.id, movementCommandEnumerationId, {
                codename: createCodenameVLC('en', command.codename),
                name: command.name,
                namePrimaryLocale: 'en',
                isDefault: command.isDefault
            })
        }

        const simulationConstantsSet = await createSet(api, metahub.id, {
            name: { en: 'Flight Simulation Constants', ru: 'Константы симуляции полета' },
            namePrimaryLocale: 'en',
            codename: createCodenameVLC('en', 'FlightSimulationConstants')
        })
        const simulationConstantsSetId = simulationConstantsSet?.id ?? simulationConstantsSet?.data?.id
        expect(typeof simulationConstantsSetId).toBe('string')
        for (const constant of [
            { codename: 'CruiseSpeedMetersPerSecond', name: { en: 'Cruise speed, m/s', ru: 'Крейсерская скорость, м/с' }, value: 36 },
            { codename: 'AccelerationMetersPerSecond2', name: { en: 'Acceleration, m/s2', ru: 'Ускорение, м/с2' }, value: 48 },
            { codename: 'DecelerationMetersPerSecond2', name: { en: 'Deceleration, m/s2', ru: 'Торможение, м/с2' }, value: 48 },
            { codename: 'ArrivalRadiusMeters', name: { en: 'Arrival radius, m', ru: 'Радиус прибытия, м' }, value: 0.5 }
        ]) {
            await createFixedValue(api, metahub.id, simulationConstantsSetId, {
                codename: createCodenameVLC('en', constant.codename),
                name: constant.name,
                namePrimaryLocale: 'en',
                dataType: 'NUMBER',
                validationRules: { precision: 10, scale: 3 },
                value: String(constant.value)
            })
        }

        await createModule(api, metahub.id, {
            codename: 'flight-canvas-widget',
            name: { en: 'Flight Canvas Widget', ru: 'Виджет полета' },
            namePrimaryLocale: 'en',
            attachedToKind: 'metahub',
            moduleRole: 'widget',
            sourceCode: widgetModuleSource,
            capabilities: ['metadata.read', 'rpc.client']
        })
        await createModule(api, metahub.id, {
            codename: 'fixed-tick-flight-runtime',
            name: { en: 'Fixed Tick Flight Runtime', ru: 'Fixed Tick runtime полета' },
            namePrimaryLocale: 'en',
            attachedToKind: 'metahub',
            moduleRole: 'module',
            sourceCode: serverModuleSource,
            capabilities: ['metadata.read']
        })

        const layouts = await listLayouts(api, metahub.id)
        const layout = Array.isArray(layouts?.items) ? layouts.items[0] : Array.isArray(layouts) ? layouts[0] : null
        if (!layout?.id) {
            throw new Error('MMOOMM flight generator could not find a default layout')
        }

        const currentLayout = await getLayout(api, metahub.id, layout.id)
        const currentLayoutConfig =
            currentLayout?.config && typeof currentLayout.config === 'object' ? currentLayout.config : layout.config ?? {}
        const layoutConfig = {
            ...currentLayoutConfig,
            showDetailsTable: false,
            showDetailsTitle: false,
            showFooter: false,
            showSearch: false,
            showDatePicker: false,
            showBreadcrumbs: false,
            showOptionsMenu: false,
            showOverviewCards: false,
            showOverviewTitle: false,
            showSessionsChart: false,
            showPageViewsChart: false,
            showColumnsContainer: false,
            showUsersByCountryChart: false
        }
        const updateLayoutResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/layout/${layout.id}`, {
            name: currentLayout?.name ?? layout.name,
            namePrimaryLocale: currentLayout?.name?._primary ?? layout.name?._primary ?? 'en',
            description: currentLayout?.description ?? layout.description,
            descriptionPrimaryLocale: currentLayout?.description?._primary ?? layout.description?._primary ?? 'en',
            config: layoutConfig
        })
        expect(updateLayoutResponse.ok).toBe(true)

        const zoneWidgets = await listLayoutZoneWidgets(api, metahub.id, layout.id)
        for (const widget of zoneWidgets?.items?.filter((item) =>
            ['detailsTitle', 'detailsTable', 'menuWidget'].includes(String(item?.widgetKey ?? ''))
        ) ?? []) {
            const removeResponse = await sendWithCsrf(
                api,
                'DELETE',
                `/api/v1/metahub/${metahub.id}/layout/${layout.id}/zone-widget/${widget.id}`
            )
            expect(removeResponse.status).toBe(204)
        }

        await assignLayoutZoneWidget(api, metahub.id, layout.id, {
            zone: 'left',
            widgetKey: 'menuWidget',
            sortOrder: 1,
            config: {
                showTitle: true,
                title: localizedText('Navigation', 'Навигация'),
                autoShowAllSections: false,
                startPage: WELCOME_SECTION_CODENAME,
                workspacePlacement: 'hidden',
                items: [
                    {
                        id: 'welcome',
                        kind: 'section',
                        title: localizedText('Welcome', 'Добро пожаловать'),
                        icon: 'home',
                        sectionId: WELCOME_SECTION_CODENAME,
                        objectCollectionId: WELCOME_SECTION_CODENAME,
                        sortOrder: 1,
                        isActive: true
                    },
                    {
                        id: 'space',
                        kind: 'section',
                        title: localizedText('Space', 'Космос'),
                        icon: 'rocket',
                        sectionId: SPACE_SECTION_CODENAME,
                        objectCollectionId: SPACE_SECTION_CODENAME,
                        sortOrder: 2,
                        isActive: true
                    }
                ]
            }
        })

        await assignLayoutZoneWidget(api, metahub.id, layout.id, {
            zone: 'center',
            widgetKey: 'playcanvasCanvas',
            sortOrder: 1,
            config: {
                title: { en: 'MMOOMM Flight Simulator', ru: 'Симулятор полета MMOOMM' },
                minHeight: 560,
                heightMode: 'fitViewport',
                moduleCodename: 'flight-canvas-widget',
                serverModuleCodename: 'fixed-tick-flight-runtime',
                attachedToKind: 'metahub',
                visibleFor: { sectionCodenames: [SPACE_SECTION_CODENAME] },
                scene: {
                    controlledObjectId: 'ship',
                    targetObjectId: 'station',
                    cruiseSpeed: 36,
                    intentDistance: 720,
                    objects: [
                        { id: 'ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
                        {
                            id: 'station',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 },
                            selectable: true,
                            guard: true
                        }
                    ]
                }
            }
        })

        const exportResponse = await apiGet(api, `/api/v1/metahub/${metahub.id}/export`)
        expect(exportResponse.ok).toBe(true)

        const exportedEnvelope = validateSnapshotEnvelope((await exportResponse.json()) as Record<string, unknown>)
        const patchedSnapshot = patchMmoommSnapshotContent(exportedEnvelope.snapshot as Record<string, any>)
        const envelope = buildSnapshotEnvelope({
            metahub: exportedEnvelope.metahub,
            publication: exportedEnvelope.publication,
            sourceInstance: exportedEnvelope.sourceInstance,
            snapshot: {
                ...patchedSnapshot,
                runtimePolicy: {
                    workspaceMode: 'optional'
                }
            }
        })
        validateSnapshotEnvelope(envelope)
        assertMmoommFlightFixtureEnvelopeContract(envelope)

        const fixturePath = path.join(FIXTURES_DIR, MMOOMM_FLIGHT_FIXTURE_FILENAME)
        fs.writeFileSync(fixturePath, JSON.stringify(envelope, null, 2), 'utf8')

        expect(fs.existsSync(fixturePath)).toBe(true)
    })
})
