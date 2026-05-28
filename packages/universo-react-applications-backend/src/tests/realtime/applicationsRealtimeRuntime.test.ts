jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

jest.mock('@universo-react/colyseus-server', () => ({
    __esModule: true,
    Room: class {},
    Server: class {
        define() {
            return { filterBy: jest.fn() }
        }
    },
    matchMaker: {
        controller: {
            matchmakeRoute: 'matchmake',
            invokeMethod: jest.fn()
        },
        accept: jest.fn(async () => undefined)
    },
    applyMoveToPointIntent: jest.fn((state, target) => ({ ...state, target })),
    applyStopIntent: jest.fn((state) => ({ ...state, target: null })),
    createStoppedMovementState: jest.fn((position) => ({ position, velocity: { x: 0, y: 0, z: 0 }, target: null, speed: 0 })),
    resolveSafeTargetOutsideGuards: jest.fn((_from, target) => target),
    stepFixedTickMovement: jest.fn((state) => ({ state, arrived: false, blocked: false }))
}))

import { __applicationsRealtimeRuntimeTestUtils } from '../../realtime/applicationsRealtimeRuntime'
import {
    isRealtimeMatchmakeMethodAllowed,
    resolveRealtimeClientCanControl,
    selectRealtimeControllerSessionId
} from '../../realtime/realtimeAccess'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import { createMockDbExecutor } from '../utils/dbMocks'

const createRuntimeModule = (overrides: Record<string, unknown> = {}) => ({
    id: overrides.id ?? 'module-1',
    codename: overrides.codename ?? 'flight-canvas-widget',
    moduleRole: overrides.moduleRole ?? 'widget',
    attachedToKind: overrides.attachedToKind ?? 'metahub',
    clientBundle: overrides.clientBundle ?? 'module.exports = class FlightCanvasWidget {}',
    serverBundle: overrides.serverBundle ?? null,
    checksum: overrides.checksum ?? 'checksum-1',
    manifest:
        overrides.manifest ??
        ({
            methods: [{ name: 'mount', target: 'client', eventName: null }]
        } as Record<string, unknown>)
})

describe('applications realtime runtime authorization', () => {
    it('allows realtime control only for roles with edit content permission', () => {
        expect(resolveRealtimeClientCanControl('member', 'member')).toBe(false)
        expect(resolveRealtimeClientCanControl('member', 'editor')).toBe(true)
        expect(resolveRealtimeClientCanControl('member', 'admin')).toBe(true)
        expect(resolveRealtimeClientCanControl('member', 'owner')).toBe(true)
        expect(resolveRealtimeClientCanControl('public', 'owner')).toBe(false)
    })

    it('honors application role policy overrides for realtime control', () => {
        expect(
            resolveRealtimeClientCanControl('member', 'member', {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'memberPolicy',
                            title: { en: 'Member permissions' },
                            rules: [{ capability: 'records.edit', effect: 'allow', scope: 'workspace' }]
                        }
                    ]
                }
            })
        ).toBe(true)

        expect(
            resolveRealtimeClientCanControl('member', 'editor', {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'editorPolicy',
                            title: { en: 'Editor permissions' },
                            rules: [{ capability: 'records.edit', effect: 'deny', scope: 'workspace' }]
                        }
                    ]
                }
            })
        ).toBe(false)
    })

    it('hands off realtime controller status only to clients that can control', () => {
        const clients = [{ sessionId: 'observer-1' }, { sessionId: 'editor-1' }, { sessionId: 'observer-2' }]
        const permissions = new Map([
            ['observer-1', false],
            ['editor-1', true],
            ['observer-2', false]
        ])

        expect(selectRealtimeControllerSessionId(clients, permissions)).toBe('editor-1')
        expect(selectRealtimeControllerSessionId(clients, permissions, 'editor-1')).toBeNull()
    })

    it('rejects room-id based matchmaking methods that bypass realtime scope filters', () => {
        expect(isRealtimeMatchmakeMethodAllowed('join')).toBe(true)
        expect(isRealtimeMatchmakeMethodAllowed('joinOrCreate')).toBe(true)
        expect(isRealtimeMatchmakeMethodAllowed('joinById')).toBe(false)
        expect(isRealtimeMatchmakeMethodAllowed('create')).toBe(false)
    })
})

describe('applications realtime runtime module-backed room options', () => {
    const applicationId = '018f8a78-7b8f-7c1d-a111-2222333346aa'

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('fails closed when a configured widget module is not active in the published application schema', async () => {
        const { executor } = createMockDbExecutor()
        executor.query
            .mockResolvedValueOnce([{ id: applicationId, schemaName: 'app_018f8a787b8f7c1da1112222333346aa' }])
            .mockResolvedValueOnce([
                {
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
                    config: {
                        moduleCodename: 'flight-canvas-widget',
                        serverModuleCodename: 'fixed-tick-flight-runtime',
                        attachedToKind: 'metahub'
                    }
                }
            ])
        jest.spyOn(RuntimeModulesService.prototype, 'getActiveModuleByCodename').mockResolvedValue(null)

        await expect(
            __applicationsRealtimeRuntimeTestUtils.loadRoomOptionsFromApplicationSchema(executor as never, {
                applicationId,
                accessMode: 'member',
                moduleCodename: 'flight-canvas-widget'
            })
        ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('uses the published server module result and stable module identity in room options', async () => {
        const { executor } = createMockDbExecutor()
        executor.query
            .mockResolvedValueOnce([{ id: applicationId, schemaName: 'app_018f8a787b8f7c1da1112222333346aa' }])
            .mockResolvedValueOnce([
                {
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
                    config: {
                        moduleCodename: 'flight-canvas-widget',
                        serverModuleCodename: 'fixed-tick-flight-runtime',
                        attachedToKind: 'metahub',
                        scene: {
                            controlledObjectId: 'ship',
                            targetObjectId: 'station',
                            objects: [
                                { id: 'ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 } },
                                {
                                    id: 'station',
                                    position: { x: 72, y: 0, z: -48 },
                                    scale: { x: 48, y: 16, z: 16 },
                                    guard: true
                                }
                            ]
                        }
                    }
                }
            ])
        jest.spyOn(RuntimeModulesService.prototype, 'getActiveModuleByCodename')
            .mockResolvedValueOnce(createRuntimeModule() as never)
            .mockResolvedValueOnce(
                createRuntimeModule({
                    id: '018f8a78-7b8f-7c1d-a111-2222333346ac',
                    codename: 'fixed-tick-flight-runtime',
                    moduleRole: 'module',
                    serverBundle: 'module.exports = class FixedTickFlightRuntime {}',
                    checksum: 'server-checksum',
                    manifest: { methods: [{ name: 'createRealtimeRoomOptions', target: 'server', eventName: null }] }
                }) as never
            )
        const callInternalServerMethodSpy = jest.spyOn(RuntimeModulesService.prototype, 'callInternalServerMethod').mockResolvedValue({
            initialPosition: { x: 1, y: 0, z: 0 },
            targetObjects: { station: { x: 72, y: 0, z: -48 } },
            controlledHalfExtents: { x: 6, y: 2, z: 2 },
            guardBoxes: [{ center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }],
            cruiseSpeed: 40,
            acceleration: 50,
            deceleration: 55,
            arrivalRadius: 1
        })

        const options = await __applicationsRealtimeRuntimeTestUtils.loadRoomOptionsFromApplicationSchema(executor as never, {
            applicationId,
            accessMode: 'member',
            moduleCodename: 'flight-canvas-widget',
            workspaceId: '018f8a78-7b8f-7c1d-a111-2222333346ad',
            currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ae',
            permissions: {
                manageMembers: false,
                manageApplication: false,
                createContent: true,
                editContent: true,
                deleteContent: false,
                readReports: true
            }
        })

        expect(options).toMatchObject({
            initialPosition: { x: 1, y: 0, z: 0 },
            targetObjects: { station: { x: 72, y: 0, z: -48 } },
            controlledHalfExtents: { x: 6, y: 2, z: 2 },
            cruiseSpeed: 40,
            acceleration: 50,
            deceleration: 55,
            arrivalRadius: 1,
            runtimeModuleId: '018f8a78-7b8f-7c1d-a111-2222333346ac',
            runtimeModuleChecksum: 'server-checksum'
        })
        expect(options.scopeId).toContain('018f8a78-7b8f-7c1d-a111-2222333346ac:server-checksum')
        expect(callInternalServerMethodSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                currentWorkspaceId: '018f8a78-7b8f-7c1d-a111-2222333346ad',
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ae',
                permissions: expect.objectContaining({
                    createContent: true,
                    editContent: true,
                    readReports: true
                })
            })
        )
    })
})
