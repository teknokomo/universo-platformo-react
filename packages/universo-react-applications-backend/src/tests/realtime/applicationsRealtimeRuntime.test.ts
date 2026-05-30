jest.mock('@universo-react/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

jest.mock('@universo-react/colyseus-server', () => ({
    __esModule: true,
    Room: class {
        state: unknown
        metadata: unknown
        maxMessagesPerSecond = Infinity
        private messageHandlers = new Map<string, (client: unknown, payload: unknown) => void>()
        private simulationHandler: ((deltaMs: number) => void) | null = null

        setPatchRate = jest.fn()
        setMetadata = jest.fn((metadata: unknown) => {
            this.metadata = metadata
        })
        setState = jest.fn((state: unknown) => {
            this.state = state
        })
        onMessage = jest.fn((type: string, handler: (client: unknown, payload: unknown) => void) => {
            this.messageHandlers.set(type, handler)
        })
        setSimulationInterval = jest.fn((handler: (deltaMs: number) => void) => {
            this.simulationHandler = handler
        })
        allowReconnection = jest.fn(async (client: unknown) => client)
        __emitMessage(type: string, client: unknown, payload: unknown) {
            this.messageHandlers.get(type)?.(client, payload)
        }
        __tick(deltaMs: number) {
            this.simulationHandler?.(deltaMs)
        }
    },
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
    findFreeSpawnPosition: jest.fn(({ origin, occupiedEntities }) =>
        occupiedEntities.length === 0 ? origin : { x: origin.x + occupiedEntities.length * 32, y: origin.y, z: origin.z }
    ),
    resolveOccupiedEntityAabb: jest.fn(({ position, halfExtents }) =>
        halfExtents
            ? {
                  center: position,
                  halfExtents
              }
            : null
    ),
    orientedBodyBoxesOverlap: jest.fn(() => false),
    resolveSweptOrientedBodyContact: jest.fn(() => null),
    resolveSafeTargetOutsideGuards: jest.fn((_from, target) => target),
    resolveSafeTargetOutsideOccupiedEntities: jest.fn((_from, target) => target),
    stepFixedTickMovement: jest.fn((state) => ({ state, arrived: false, blocked: false }))
}))

import { randomUUID } from 'crypto'
import {
    applyMoveToPointIntent,
    applyStopIntent,
    createStoppedMovementState,
    findFreeSpawnPosition,
    orientedBodyBoxesOverlap,
    resolveSafeTargetOutsideGuards,
    resolveSafeTargetOutsideOccupiedEntities,
    resolveSweptOrientedBodyContact,
    stepFixedTickMovement
} from '@universo-react/colyseus-server'
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

    it('uses request-scoped DB executor for authenticated member matchmaking flows', () => {
        const fallbackExecutor = createMockDbExecutor().executor
        const requestExecutor = createMockDbExecutor().executor
        const request = {
            dbContext: {
                executor: requestExecutor,
                session: requestExecutor,
                isReleased: () => false,
                query: requestExecutor.query
            }
        }

        expect(__applicationsRealtimeRuntimeTestUtils.selectRealtimeDbExecutor('member', request as never, fallbackExecutor as never)).toBe(
            requestExecutor
        )
        expect(__applicationsRealtimeRuntimeTestUtils.selectRealtimeDbExecutor('public', request as never, fallbackExecutor as never)).toBe(
            fallbackExecutor
        )
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
            guardBoxes: [{ center: { x: 72, y: 0, z: -48 }, halfExtents: { x: -24, y: -8, z: -8 } }],
            cruiseSpeed: 40,
            acceleration: 50,
            deceleration: 55,
            arrivalRadius: 1
        })

        const options = await __applicationsRealtimeRuntimeTestUtils.loadRoomOptionsFromApplicationSchema(executor as never, {
            applicationId,
            accessMode: 'member',
            moduleCodename: 'flight-canvas-widget',
            objectCollectionId: 'world-alpha',
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
            guardBoxes: [{ center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }],
            cruiseSpeed: 40,
            acceleration: 50,
            deceleration: 55,
            arrivalRadius: 1,
            runtimeModuleId: '018f8a78-7b8f-7c1d-a111-2222333346ac',
            runtimeModuleChecksum: 'server-checksum',
            objectCollectionId: 'world-alpha'
        })
        expect(options.roomConfigHash).toMatch(/^[a-f0-9]{16}$/)
        expect(options.scopeId).toContain(':world-alpha:')
        expect(options.scopeId).toContain(options.roomConfigHash)
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

describe('applications realtime fixed tick room', () => {
    class TestSchema {}
    class TestMapSchema<T> extends Map<string, T> {}
    const defineTypes = jest.fn()

    const createClient = (sessionId: string, auth?: Record<string, unknown>) =>
        ({
            sessionId,
            auth,
            send: jest.fn(),
            leave: jest.fn(),
            close: jest.fn()
        } as never)
    const createSignedRoomOptions = (overrides: Record<string, unknown> = {}) => {
        const options = __applicationsRealtimeRuntimeTestUtils.parseRoomOptions({
            scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:module',
            accessMode: 'member',
            applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
            currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
            clientCanControl: true,
            authIssuedAt: Date.now(),
            authNonce: randomUUID(),
            targetObjects: { target: { x: 72, y: 0, z: -48 } },
            ...overrides
        })
        return {
            ...options,
            ...overrides,
            serverAuthSignature: __applicationsRealtimeRuntimeTestUtils.signRoomAuthOptions({ ...options, ...overrides })
        }
    }
    const createRoomAuth = (userId: string, overrides: Record<string, unknown> = {}) => ({
        userId,
        clientCanControl: true,
        applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
        scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:module',
        ...overrides
    })
    const flushRealtimeTasks = async () => {
        await Promise.resolve()
        await Promise.resolve()
    }
    const resetMovementMockImplementations = () => {
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation((state, target) => ({ ...state, target }))
        ;(applyStopIntent as jest.Mock).mockImplementation((state) => ({ ...state, target: null }))
        ;(createStoppedMovementState as jest.Mock).mockImplementation((position) => ({
            position,
            velocity: { x: 0, y: 0, z: 0 },
            target: null,
            speed: 0
        }))
        ;(findFreeSpawnPosition as jest.Mock).mockImplementation(({ origin, occupiedEntities }) =>
            occupiedEntities.length === 0 ? origin : { x: origin.x + occupiedEntities.length * 32, y: origin.y, z: origin.z }
        )
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(() => false)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation((_from, target) => target)
        ;(resolveSafeTargetOutsideOccupiedEntities as jest.Mock).mockImplementation((_from, target) => target)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation((state) => ({ state, arrived: false, blocked: false }))
    }

    beforeEach(() => {
        defineTypes.mockClear()
        resetMovementMockImplementations()
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => true)
    })

    afterEach(() => {
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(null)
        resetMovementMockImplementations()
    })

    it('rejects malformed or client-authoritative movement intents', () => {
        expect(
            __applicationsRealtimeRuntimeTestUtils.parseMovementIntent({
                type: 'move_to_point',
                seq: 1,
                target: { x: 1, y: 2, z: 3 }
            })
        ).toMatchObject({ type: 'move_to_point', seq: 1 })
        expect(
            __applicationsRealtimeRuntimeTestUtils.parseMovementIntent({
                type: 'move_to_point',
                seq: 1,
                target: { x: 1, y: 2, z: 3 },
                position: { x: 999, y: 0, z: 0 }
            })
        ).toBeNull()
        expect(__applicationsRealtimeRuntimeTestUtils.parseMovementIntent({ type: 'stop' })).toBeNull()
        expect(__applicationsRealtimeRuntimeTestUtils.parseMovementIntent({ type: 'stop', seq: 0 })).toBeNull()
        expect(
            __applicationsRealtimeRuntimeTestUtils.parseMovementIntent({
                type: 'move_to_point',
                seq: 2,
                target: { x: 100001, y: 0, z: 0 }
            })
        ).toBeNull()
    })

    it('normalizes signed room guard half extents and drops degenerate guard boxes', () => {
        const options = __applicationsRealtimeRuntimeTestUtils.parseRoomOptions({
            scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:module',
            accessMode: 'member',
            applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
            currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
            clientCanControl: true,
            targetObjects: { target: { x: 72, y: 0, z: -48 } },
            guardBoxes: [
                { center: { x: 72, y: 0, z: -48 }, halfExtents: { x: -24, y: -8, z: -8 } },
                { center: { x: 10, y: 0, z: 10 }, halfExtents: { x: 0, y: 8, z: 8 } }
            ]
        })

        expect(options.guardBoxes).toEqual([{ center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }])
    })

    it('sets a finite Colyseus message rate limit before intent payload handling', () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            maxMessagesPerSecond: number
            onCreate(options: unknown): void
        }

        room.onCreate(createSignedRoomOptions())

        expect(room.maxMessagesPerSecond).toBe(__applicationsRealtimeRuntimeTestUtils.MAX_MESSAGES_PER_SECOND_PER_CLIENT)
        expect(room.maxMessagesPerSecond).toBeLessThan(Infinity)
    })

    it('assigns one stable server-owned ship per controlling user and keeps observer clients read-only', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { shipId: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never, options?: unknown): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: 0, y: 0, z: 0 },
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                spawnSafetyMargin: 8,
                spawnMaxAttempts: 64,
                spawnRingSpacing: 24
            })
        )

        const firstClient = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab'),
            displayName: 'Player One'
        })
        const secondClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac'),
            displayName: 'Player Two'
        })
        const observerClient = createClient(
            'session-observer',
            createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ad', { clientCanControl: false })
        )

        await room.onJoin(firstClient)
        await room.onJoin(secondClient)
        await room.onJoin(observerClient)

        expect(room.state.ships.size).toBe(2)
        const firstShipId = (firstClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const secondShipId = (secondClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        expect(firstShipId).toMatch(/^ship:/)
        expect(secondShipId).toMatch(/^ship:/)
        expect(firstShipId).not.toContain('018f8a78')
        expect(secondShipId).not.toContain('018f8a78')
        expect(firstShipId).not.toBe(secondShipId)
        expect(observerClient.send).not.toHaveBeenCalled()
        const positions = Array.from(room.state.ships.values()).map((ship) => ship.position.x)
        expect(new Set(positions).size).toBe(2)

        room.__emitMessage('intent', observerClient, { type: 'move_to_point', seq: 1, target: { x: 100, y: 0, z: 0 } })
        room.__emitMessage('intent', firstClient, { type: 'move_to_point', seq: 1, target: { x: 20, y: 0, z: 0 } })
        room.__emitMessage('intent', firstClient, { type: 'move_to_point', seq: 1, target: { x: 40, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.get(firstShipId)?.lastProcessedInputSeq).toBe(1)
        expect(room.state.ships.get(secondShipId)?.lastProcessedInputSeq).toBe(0)
    })

    it('fails closed when Colyseus auth is missing or does not match the room scope', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { shipId: string }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())

        const missingAuthClient = createClient('session-missing')
        const mismatchedScopeClient = createClient('session-mismatch', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab'),
            scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:other'
        })

        await room.onJoin(missingAuthClient)
        await room.onJoin(mismatchedScopeClient)

        expect(room.state.ships.size).toBe(0)
        expect(missingAuthClient.send).not.toHaveBeenCalled()
        expect(mismatchedScopeClient.send).not.toHaveBeenCalled()
        expect(missingAuthClient.leave).toHaveBeenCalledWith(4423)
        expect(mismatchedScopeClient.leave).toHaveBeenCalledWith(4423)
    })

    it('requires server-signed room options during Colyseus auth', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const unsignedOptions = {
            scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:module',
            accessMode: 'member',
            applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
            currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
            clientCanControl: true,
            authIssuedAt: Date.now(),
            authNonce: randomUUID(),
            targetObjects: { target: { x: 72, y: 0, z: -48 } }
        }

        await expect(RoomClass.onAuth?.('', unsignedOptions)).resolves.toBe(false)
        await expect(RoomClass.onAuth?.('', createSignedRoomOptions())).resolves.toMatchObject({
            userId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
            clientCanControl: true
        })
    })

    it('rejects replayed or expired signed room options during Colyseus auth', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const signedOptions = createSignedRoomOptions()
        await expect(RoomClass.onAuth?.('', signedOptions)).resolves.toMatchObject({
            userId: '018f8a78-7b8f-7c1d-a111-2222333346ab'
        })
        await expect(RoomClass.onAuth?.('', signedOptions)).resolves.toBe(false)

        await expect(
            RoomClass.onAuth?.(
                '',
                createSignedRoomOptions({
                    authIssuedAt: Date.now() - 120_000,
                    authNonce: randomUUID()
                })
            )
        ).resolves.toBe(false)
    })

    it('rejects tampered or malformed signed room options during Colyseus auth', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const signedOptions = createSignedRoomOptions()

        await expect(RoomClass.onAuth?.('', { ...signedOptions, cruiseSpeed: 999 })).resolves.toBe(false)
        await expect(RoomClass.onAuth?.('', { ...signedOptions, serverAuthSignature: 'abc' })).resolves.toBe(false)
        await expect(RoomClass.onAuth?.('', { ...signedOptions, serverAuthSignature: 'z'.repeat(64) })).resolves.toBe(false)
    })

    it('fails closed when controlling access is revoked between room auth and join', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
        }
        const validator = jest.fn(async () => false)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(validator)
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)

        expect(validator).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerUserId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
                canControl: true
            }),
            expect.objectContaining({
                applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
                accessMode: 'member'
            })
        )
        expect(room.state.ships.size).toBe(0)
        expect(client.send).not.toHaveBeenCalled()
        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(client.close).toHaveBeenCalledWith(4423)
    })

    it('fails closed when read-only member access is revoked between room auth and join', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
        }
        const validator = jest.fn(async () => false)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(validator)
        room.onCreate(createSignedRoomOptions())
        const observerClient = createClient(
            'session-observer',
            createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ad', { clientCanControl: false })
        )

        await room.onJoin(observerClient)
        room.__emitMessage('intent', observerClient, { type: 'move_to_point', seq: 1, target: { x: 100, y: 0, z: 0 } })

        expect(validator).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerUserId: '018f8a78-7b8f-7c1d-a111-2222333346ad',
                canControl: false
            }),
            expect.objectContaining({
                applicationId: '018f8a78-7b8f-7c1d-a111-2222333346aa',
                accessMode: 'member'
            })
        )
        expect(room.state.ships.size).toBe(0)
        expect(observerClient.send).not.toHaveBeenCalled()
        expect(observerClient.leave).toHaveBeenCalledWith(4423)
        expect(observerClient.close).toHaveBeenCalledWith(4423)
    })

    it('bounds queued movement intents per ship before fixed tick processing', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { lastProcessedInputSeq: number }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        for (let seq = 1; seq <= 32; seq += 1) {
            room.__emitMessage('intent', client, { type: 'move_to_point', seq, target: { x: seq, y: 0, z: 0 } })
        }
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.get(shipId)?.lastProcessedInputSeq).toBe(32)
    })

    it('rejects large forward sequence jumps that would make normal inputs stale', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { lastProcessedInputSeq: number }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.__emitMessage('intent', client, { type: 'move_to_point', seq: 2147483647, target: { x: 20, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.get(shipId)?.lastProcessedInputSeq).toBe(0)

        room.__emitMessage('intent', client, { type: 'move_to_point', seq: 1, target: { x: 10, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.get(shipId)?.lastProcessedInputSeq).toBe(1)
    })

    it('publishes the current authoritative movement command for point, object, and stop intents', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; currentCommandObjectId: string; hasTarget: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        expect(room.state.ships.get(shipId)).toMatchObject({
            currentCommand: 'stop',
            currentCommandObjectId: '',
            hasTarget: false
        })

        room.__emitMessage('intent', client, { type: 'move_to_point', seq: 1, target: { x: 20, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)
        expect(room.state.ships.get(shipId)).toMatchObject({
            currentCommand: 'move_to_point',
            currentCommandObjectId: '',
            hasTarget: true
        })

        room.__emitMessage('intent', client, { type: 'move_to_object', seq: 2, objectId: 'target' })
        await flushRealtimeTasks()
        room.__tick(50)
        expect(room.state.ships.get(shipId)).toMatchObject({
            currentCommand: 'move_to_object',
            currentCommandObjectId: 'target',
            hasTarget: true
        })

        room.__emitMessage('intent', client, { type: 'stop', seq: 3 })
        await flushRealtimeTasks()
        room.__tick(50)
        expect(room.state.ships.get(shipId)).toMatchObject({
            currentCommand: 'stop',
            currentCommandObjectId: '',
            hasTarget: false
        })
    })

    it('resets the authoritative command when movement arrives or is blocked', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; hasTarget: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        ;(stepFixedTickMovement as jest.Mock).mockReturnValueOnce({
            state: { position: { x: 20, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, target: null, speed: 0 },
            arrived: true,
            blocked: false
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.__emitMessage('intent', client, { type: 'move_to_point', seq: 1, target: { x: 20, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.get(shipId)).toMatchObject({
            currentCommand: 'stop',
            hasTarget: false
        })
    })

    it('uses the real movement helpers when the fixed-tick room processes a guarded object intent', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockImplementation(actualMovement.findFreeSpawnPosition)
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; hasTarget: boolean; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                targetObjects: { station: { x: 72, y: 0, z: -48 } },
                guardBoxes: [{ center: { x: 72, y: 0, z: -48 }, halfExtents: { x: 24, y: 8, z: 8 } }],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                cruiseSpeed: 36,
                acceleration: 48,
                deceleration: 48,
                arrivalRadius: 0.5
            })
        )
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.__emitMessage('intent', client, { type: 'move_to_object', seq: 1, objectId: 'station' })
        await flushRealtimeTasks()
        room.__tick(500)

        const ship = room.state.ships.get(shipId)
        expect(ship?.currentCommand).toBe('move_to_object')
        expect(ship?.hasTarget).toBe(true)
        expect(ship?.position.x).toBeGreaterThan(0)
        expect(ship?.position.x).toBeLessThan(72)
    })

    it('uses server-owned ship positions as dynamic blockers during fixed-tick movement', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockImplementation(actualMovement.findFreeSpawnPosition)
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: 0, y: 0, z: 0 },
                guardBoxes: [],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                spawnSafetyMargin: 0,
                spawnRingSpacing: 20,
                cruiseSpeed: 36,
                acceleration: 72,
                deceleration: 72,
                arrivalRadius: 0.5
            })
        )
        const firstClient = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const secondClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac', {
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ac'
            })
        })

        await room.onJoin(firstClient)
        await room.onJoin(secondClient)
        const firstShipId = (firstClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const secondShipId = (secondClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const firstBefore = room.state.ships.get(firstShipId)?.position
        const secondBefore = room.state.ships.get(secondShipId)?.position
        expect(firstBefore).toBeDefined()
        expect(secondBefore).toBeDefined()
        room.__emitMessage('intent', firstClient, { type: 'move_to_point', seq: 1, target: secondBefore })
        room.__emitMessage('intent', secondClient, { type: 'move_to_point', seq: 1, target: firstBefore })
        await flushRealtimeTasks()
        for (let tick = 0; tick < 20; tick += 1) {
            room.__tick(100)
        }

        const firstAfter = room.state.ships.get(firstShipId)
        const secondAfter = room.state.ships.get(secondShipId)
        expect(firstAfter).toBeDefined()
        expect(secondAfter).toBeDefined()
        const axisSeparation = {
            x: Math.abs((firstAfter?.position.x ?? 0) - (secondAfter?.position.x ?? 0)),
            y: Math.abs((firstAfter?.position.y ?? 0) - (secondAfter?.position.y ?? 0)),
            z: Math.abs((firstAfter?.position.z ?? 0) - (secondAfter?.position.z ?? 0))
        }
        expect({
            axisSeparation,
            aabbsOverlap: axisSeparation.x < 12 && axisSeparation.y < 4 && axisSeparation.z < 4
        }).toMatchObject({ aabbsOverlap: false })
        expect(firstAfter?.position).not.toEqual(secondAfter?.position)
    })

    it('blocks high-speed movement that would sweep through another ship between fixed ticks', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockReturnValueOnce({ x: 0, y: 0, z: 0 }).mockReturnValueOnce({ x: 50, y: 0, z: 0 })
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(resolveSafeTargetOutsideOccupiedEntities as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideOccupiedEntities)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: 0, y: 0, z: 0 },
                guardBoxes: [],
                controlledHalfExtents: { x: 4, y: 2, z: 4 },
                cruiseSpeed: 100,
                acceleration: 100,
                deceleration: 100,
                arrivalRadius: 0.5
            })
        )
        const movingClient = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const blockerClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac', {
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ac'
            })
        })

        await room.onJoin(movingClient)
        await room.onJoin(blockerClient)
        const movingShipId = (movingClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const blockerShipId = (blockerClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        expect(room.state.ships.get(blockerShipId)?.position).toEqual({ x: 50, y: 0, z: 0 })

        room.__emitMessage('intent', movingClient, { type: 'move_to_point', seq: 1, target: { x: 100, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(1000)

        const movingAfter = room.state.ships.get(movingShipId)
        expect(movingAfter?.currentCommand).toBe('stop')
        expect(movingAfter?.position.x).toBeCloseTo(41.98)
        expect(movingAfter?.position.y).toBe(0)
        expect(movingAfter?.position.z).toBe(0)
        expect(room.state.ships.get(blockerShipId)?.position).toEqual({ x: 50, y: 0, z: 0 })
    })

    it('resolves point targets inside another ship to a server-owned standoff target when ships move asynchronously', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockReturnValueOnce({ x: 0, y: 0, z: 0 }).mockReturnValueOnce({ x: 24, y: 0, z: 0 })
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(resolveSafeTargetOutsideOccupiedEntities as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideOccupiedEntities)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: 0, y: 0, z: 0 },
                guardBoxes: [],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                cruiseSpeed: 36,
                acceleration: 48,
                deceleration: 48,
                arrivalRadius: 0.5
            })
        )
        const leftClient = createClient('session-left', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const rightClient = createClient('session-right', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac', {
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ac'
            })
        })

        await room.onJoin(leftClient)
        await room.onJoin(rightClient)
        const leftShipId = (leftClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const rightShipId = (rightClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const rightOrigin = room.state.ships.get(rightShipId)?.position
        expect(rightOrigin).toEqual({ x: 24, y: 0, z: 0 })

        room.__emitMessage('intent', leftClient, { type: 'move_to_point', seq: 1, target: rightOrigin })
        room.__tick(100)
        room.__emitMessage('intent', rightClient, { type: 'move_to_point', seq: 1, target: { x: 0, y: 0, z: 0 } })
        await flushRealtimeTasks()
        for (let tick = 0; tick < 40; tick += 1) {
            room.__tick(100)
        }

        const leftAfter = room.state.ships.get(leftShipId)
        expect(leftAfter?.currentCommand).toBe('stop')
        expect(Math.hypot((leftAfter?.position.x ?? 0) - 24, leftAfter?.position.y ?? 0, leftAfter?.position.z ?? 0)).toBeGreaterThan(2)
        expect(leftAfter?.position.x).toBeLessThan(18)
    })

    it('resolves simultaneous proposed ship overlaps to the swept contact point', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockReturnValueOnce({ x: 0, y: 0, z: 0 }).mockReturnValueOnce({ x: 20, y: 0, z: 0 })
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(resolveSafeTargetOutsideOccupiedEntities as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideOccupiedEntities)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: 0, y: 0, z: 0 },
                guardBoxes: [],
                controlledHalfExtents: { x: 6, y: 2, z: 2 },
                cruiseSpeed: 10,
                acceleration: 10,
                deceleration: 10,
                arrivalRadius: 0.5
            })
        )
        const leftClient = createClient('session-left', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const rightClient = createClient('session-right', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac', {
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ac'
            })
        })

        await room.onJoin(leftClient)
        await room.onJoin(rightClient)
        const leftShipId = (leftClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const rightShipId = (rightClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.__emitMessage('intent', leftClient, { type: 'move_to_point', seq: 1, target: { x: 40, y: 0, z: 0 } })
        room.__emitMessage('intent', rightClient, { type: 'move_to_point', seq: 1, target: { x: -20, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(1000)

        expect(room.state.ships.get(leftShipId)).toMatchObject({
            currentCommand: 'stop',
            position: { y: 0, z: 0 }
        })
        expect(room.state.ships.get(rightShipId)).toMatchObject({
            currentCommand: 'stop',
            position: { y: 0, z: 0 }
        })
        expect(room.state.ships.get(leftShipId)?.position.x).toBeCloseTo(3.99)
        expect(room.state.ships.get(rightShipId)?.position.x).toBeCloseTo(16.01)
    })

    it('blocks crossing ship trajectories even when final positions do not overlap', async () => {
        const actualMovement = jest.requireActual<typeof import('@universo-react/colyseus-server/movement')>(
            '@universo-react/colyseus-server/movement'
        )
        ;(applyMoveToPointIntent as jest.Mock).mockImplementation(actualMovement.applyMoveToPointIntent)
        ;(applyStopIntent as jest.Mock).mockImplementation(actualMovement.applyStopIntent)
        ;(createStoppedMovementState as jest.Mock).mockImplementation(actualMovement.createStoppedMovementState)
        ;(findFreeSpawnPosition as jest.Mock).mockReturnValueOnce({ x: -100, y: 0, z: 0 }).mockReturnValueOnce({ x: 0, y: 0, z: -100 })
        ;(orientedBodyBoxesOverlap as jest.Mock).mockImplementation(actualMovement.orientedBodyBoxesOverlap)
        ;(resolveSweptOrientedBodyContact as jest.Mock).mockImplementation(actualMovement.resolveSweptOrientedBodyContact)
        ;(resolveSafeTargetOutsideGuards as jest.Mock).mockImplementation(actualMovement.resolveSafeTargetOutsideGuards)
        ;(stepFixedTickMovement as jest.Mock).mockImplementation(actualMovement.stepFixedTickMovement)
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { currentCommand: string; position: { x: number; y: number; z: number } }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(
            createSignedRoomOptions({
                initialPosition: { x: -100, y: 0, z: 0 },
                guardBoxes: [],
                controlledHalfExtents: { x: 4, y: 2, z: 4 },
                cruiseSpeed: 200,
                acceleration: 200,
                deceleration: 200,
                arrivalRadius: 0.5
            })
        )
        const horizontalClient = createClient('session-horizontal', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const verticalClient = createClient('session-vertical', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ac', {
                currentUserId: '018f8a78-7b8f-7c1d-a111-2222333346ac'
            })
        })

        await room.onJoin(horizontalClient)
        await room.onJoin(verticalClient)
        const horizontalShipId = (horizontalClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const verticalShipId = (verticalClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.__emitMessage('intent', horizontalClient, { type: 'move_to_point', seq: 1, target: { x: 200, y: 0, z: 0 } })
        room.__emitMessage('intent', verticalClient, { type: 'move_to_point', seq: 1, target: { x: 0, y: 0, z: 200 } })
        await flushRealtimeTasks()
        room.__tick(1000)

        expect(room.state.ships.get(horizontalShipId)).toMatchObject({
            currentCommand: 'stop',
            position: { y: 0, z: 0 }
        })
        expect(room.state.ships.get(verticalShipId)).toMatchObject({
            currentCommand: 'stop',
            position: { x: 0, y: 0 }
        })
        expect(room.state.ships.get(horizontalShipId)?.position.x).toBeCloseTo(-8.01)
        expect(room.state.ships.get(verticalShipId)?.position.z).toBeCloseTo(-8.01)
    })

    it('marks disconnected ships for reconnect without duplicating them', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never, options?: unknown): Promise<void>
            onDrop(client: never): void
            onReconnect(client: never): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const shipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.onDrop(client)
        expect(room.state.ships.size).toBe(1)
        expect(room.state.ships.get(shipId)?.connected).toBe(false)

        await room.onReconnect(client)
        expect(room.state.ships.size).toBe(1)
        expect(room.state.ships.get(shipId)?.connected).toBe(true)
        expect(client.send).toHaveBeenLastCalledWith('local_ship_assigned', {
            shipId
        })
    })

    it('removes ships on permanent Colyseus leaves without opening a reconnect window', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onLeave(client: never, code?: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        expect(room.state.ships.size).toBe(1)

        room.onLeave(client, 4000)
        expect(room.state.ships.size).toBe(0)
    })

    it('keeps a reused ship connected when one of multiple active same-user sessions drops', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
        }
        room.onCreate(createSignedRoomOptions())
        const firstClient = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const secondClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(firstClient)
        await room.onJoin(secondClient)
        const firstShipId = (firstClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        const secondShipId = (secondClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.onDrop(firstClient)

        expect(secondShipId).toBe(firstShipId)
        expect(room.state.ships.size).toBe(1)
        expect(room.state.ships.get(firstShipId)?.connected).toBe(true)

        room.onDrop(secondClient)

        expect(room.state.ships.size).toBe(1)
        expect(room.state.ships.get(firstShipId)?.connected).toBe(false)
    })

    it('removes a reconnecting ship when reconnect auth no longer matches the room', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
            onReconnect(client: never): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        room.onDrop(client)
        ;(client as never as { auth: Record<string, unknown> }).auth.scopeId =
            '018f8a78-7b8f-7c1d-a111-2222333346aa:member:workspace:widget:other'
        await room.onReconnect(client)

        expect(room.state.ships.size).toBe(0)
        expect(client.leave).toHaveBeenCalledWith(4423)
    })

    it('removes a reconnecting ship when fresh runtime access validation fails', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
            onReconnect(client: never): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        await room.onJoin(client)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => false)
        room.onDrop(client)
        await room.onReconnect(client)

        expect(room.state.ships.size).toBe(0)
        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(client.send).toHaveBeenCalledTimes(1)
    })

    it('rejects stale reconnect tokens after a reconnecting ship runtime was revoked', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
            onReconnect(client: never): Promise<void>
            revalidateConnectedClients(): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => false)

        await room.onJoin(client)
        room.onDrop(client)
        await room.revalidateConnectedClients()
        expect(room.state.ships.size).toBe(0)
        ;(client.leave as jest.Mock).mockClear()
        ;(client.close as jest.Mock).mockClear()
        await room.onReconnect(client)

        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(client.close).toHaveBeenCalledWith(4423)
        expect(room.state.ships.size).toBe(0)
    })

    it('cleans stale reconnect session mappings when access revokes a reconnecting ship', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
            onReconnect(client: never): Promise<void>
            revalidateConnectedClients(): Promise<void>
            getRuntimeForClient(client: never): unknown
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const replacementClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)
        const staleShipId = (client.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.onDrop(client)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => false)
        await room.revalidateConnectedClients()

        expect(room.state.ships.has(staleShipId)).toBe(false)
        expect(room.getRuntimeForClient(client)).toBeNull()

        await room.onReconnect(client)
        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(room.getRuntimeForClient(client)).toBeNull()

        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => true)
        await room.onJoin(replacementClient)
        const replacementShipId = (replacementClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        expect(room.state.ships.size).toBe(1)
        expect(replacementShipId).not.toBe(staleShipId)
        expect(room.state.ships.has(replacementShipId)).toBe(true)
    })

    it('fails closed before queueing the next intent when controlling access has been revoked', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean; lastProcessedInputSeq: number }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            __emitMessage(type: string, client: never, payload: unknown): void
            __tick(deltaMs: number): void
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        await room.onJoin(client)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(async () => false)

        room.__emitMessage('intent', client, { type: 'move_to_point', seq: 1, target: { x: 20, y: 0, z: 0 } })
        await flushRealtimeTasks()
        room.__tick(50)

        expect(room.state.ships.size).toBe(0)
        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(client.close).toHaveBeenCalledWith(4423)
    })

    it('closes connected controlling clients when periodic access revalidation fails', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            revalidateConnectedClients(): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const validateAccess = jest.fn(async () => true)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(validateAccess)

        await room.onJoin(client)
        expect(room.state.ships.size).toBe(1)
        validateAccess.mockResolvedValue(false)
        await room.revalidateConnectedClients()

        expect(validateAccess).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerUserId: '018f8a78-7b8f-7c1d-a111-2222333346ab',
                canControl: true
            }),
            expect.any(Object)
        )
        expect(room.state.ships.size).toBe(0)
        expect(client.leave).toHaveBeenCalledWith(4423)
        expect(client.close).toHaveBeenCalledWith(4423)
    })

    it('tracks and closes read-only member clients when periodic access revalidation fails', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            revalidateConnectedClients(): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        const observerClient = createClient(
            'session-observer',
            createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ad', { clientCanControl: false })
        )
        const validateAccess = jest.fn(async () => false)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(validateAccess)

        await room.onJoin(observerClient)
        expect(room.state.ships.size).toBe(0)
        await room.revalidateConnectedClients()

        expect(validateAccess).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerUserId: '018f8a78-7b8f-7c1d-a111-2222333346ad',
                canControl: false
            }),
            expect.any(Object)
        )
        expect(observerClient.leave).toHaveBeenCalledWith(4423)
        expect(observerClient.close).toHaveBeenCalledWith(4423)
    })

    it('tracks and closes public read-only clients when public runtime access is revoked', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            revalidateConnectedClients(): Promise<void>
        }
        const publicOptions = createSignedRoomOptions({
            scopeId: '018f8a78-7b8f-7c1d-a111-2222333346aa:public:global:widget:module',
            accessMode: 'public',
            currentUserId: null,
            clientCanControl: false
        })
        room.onCreate(publicOptions)
        const publicClient = createClient('session-public', {
            applicationId: publicOptions.applicationId,
            scopeId: publicOptions.scopeId,
            workspaceId: publicOptions.workspaceId,
            roomConfigHash: publicOptions.roomConfigHash,
            clientCanControl: false
        })
        const validateAccess = jest.fn(async () => false)
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(validateAccess)

        await room.onJoin(publicClient)
        expect(room.state.ships.size).toBe(0)
        await room.revalidateConnectedClients()

        expect(validateAccess).toHaveBeenCalledWith(
            expect.objectContaining({
                ownerUserId: null,
                canControl: false
            }),
            expect.objectContaining({
                accessMode: 'public',
                applicationId: publicOptions.applicationId
            })
        )
        expect(publicClient.leave).toHaveBeenCalledWith(4423)
        expect(publicClient.close).toHaveBeenCalledWith(4423)
    })

    it('fails closed when the room cannot reserve a safe spawn position', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
        }
        room.onCreate(createSignedRoomOptions())
        ;(findFreeSpawnPosition as jest.Mock).mockReturnValueOnce(null)
        const client = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(client)

        expect(room.state.ships.size).toBe(0)
        expect(client.send).not.toHaveBeenCalled()
        expect(client.leave).toHaveBeenCalledWith(4421)
        expect(client.close).toHaveBeenCalledWith(4421)
    })

    it('keeps an active reused ship when a stale reconnect window expires', async () => {
        const RoomClass = __applicationsRealtimeRuntimeTestUtils.createFixedTickSceneRoom(TestSchema, TestMapSchema as never, defineTypes)
        let rejectReconnect: ((reason?: unknown) => void) | null = null
        const room = new RoomClass() as never as {
            state: { ships: Map<string, { connected: boolean }> }
            allowReconnection: jest.Mock
            onCreate(options: unknown): void
            onJoin(client: never): Promise<void>
            onDrop(client: never): void
        }
        room.allowReconnection.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectReconnect = reject
                })
        )
        room.onCreate(createSignedRoomOptions())
        const firstClient = createClient('session-1', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })
        const secondClient = createClient('session-2', {
            ...createRoomAuth('018f8a78-7b8f-7c1d-a111-2222333346ab')
        })

        await room.onJoin(firstClient)
        const shipId = (firstClient.send as jest.Mock).mock.calls[0]?.[1]?.shipId
        room.onDrop(firstClient)
        await room.onJoin(secondClient)
        rejectReconnect?.(new Error('expired'))
        await Promise.resolve()

        expect(room.state.ships.size).toBe(1)
        expect(room.state.ships.get(shipId)?.connected).toBe(true)
        expect(secondClient.send).toHaveBeenLastCalledWith('local_ship_assigned', {
            shipId
        })
    })
})
