/**
 * Real-server reconnection lifecycle integration suite.
 *
 * Boots the real Colyseus stack - @colyseus/core Server + WebSocketTransport +
 * the production FixedTickSceneRoom from applicationsRealtimeRuntime.ts - on a
 * loopback HTTP server and drives it with two real @colyseus/sdk clients
 * (through the workspace wrapper @universo-react/colyseus-client), proving the
 * reconnection lifecycle that mocked suites cannot cover.
 *
 * Only infrastructure boundaries are faked; matchmaking middleware, room auth
 * signing, JWT verification and the room lifecycle run unmodified:
 *   - `getPoolExecutor` returns an in-memory executor that answers the exact
 *     SQL shapes issued by guards/applicationsStore for synthetic applications.
 *   - Access tokens are real HS256 JWTs verified by verifySupabaseJwt through
 *     SUPABASE_JWT_SECRET.
 *   - Runtime access validation is injected via the module test seam
 *     (setRuntimeAccessValidatorForTests) so tests can grant or revoke fake
 *     users without touching Supabase.
 *
 * Scenario mechanisms:
 *   - Abrupt drops close the client's underlying websocket without a status code so
 *     the SDK observes NO_STATUS_RECEIVED and starts its automatic reconnection
 *     loop with the same options the production PlayCanvas widget uses. Dropped
 *     clients stop receiving patches, so surviving clients witness shared state.
 *   - Reconnection-window expiry is forced WITHOUT changing the production
 *     RECONNECT_WINDOW_SECONDS constant: the dropped user's access grant is
 *     revoked before its first retry lands, so onReconnect fail-closes the
 *     reserved seat and the SDK terminates with exactly one onLeave.
 *   - Room disposal is observed by polling matchMaker.getLocalRoomById until
 *     the disposed room disappears from the local driver registry.
 */

import { createHmac, randomUUID } from 'crypto'
import * as http from 'http'
import type { AddressInfo } from 'net'
import express from 'express'
import { Client, type Room } from '@universo-react/colyseus-client'
import { matchMaker } from '@universo-react/colyseus-server'
import {
    __applicationsRealtimeRuntimeTestUtils,
    attachApplicationsRealtimeRuntime,
    type ApplicationsRealtimeRuntimeHandle
} from '../../realtime/applicationsRealtimeRuntime'

const ROOM_AUTH_SECRET = 'integration-test-room-auth-secret'
const SUPABASE_JWT_SECRET = 'integration-test-supabase-jwt-secret'
const ROOM_NAME = 'fixed_tick_scene'
const SIGNAL_TIMEOUT_MS = 8000
const WAIT_TIMEOUT_MS = 10000

interface ReflectedVector3 {
    x: number
    y: number
    z: number
}

interface ReflectedShipState {
    shipId?: string
    connected?: boolean
    position?: ReflectedVector3
}

interface ReflectedShipsMap {
    get(key: string): ReflectedShipState | undefined
    has(key: string): boolean
    size: number
}

interface ReflectedSceneState {
    ships: ReflectedShipsMap
}

type SceneRoom = Room<unknown, ReflectedSceneState>

interface SceneJoinOptions {
    accessMode: 'member'
    applicationId: string
    widgetId: string
}

interface InjectedAccessSubject {
    ownerUserId: string | null
}

const WIDGET_SCENE_CONFIG = {
    scene: {
        objects: [
            { id: 'ship-spawn', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 } },
            { id: 'beacon', position: { x: 72, y: 0, z: -48 }, scale: { x: 48, y: 16, z: 16 }, guard: true }
        ]
    }
}

// Managed dynamic schemas must match /^app_[a-f0-9]+$/ (migrations-core identifier rules).
const fakeSchemaName = (applicationId: string): string => `app_${applicationId.replace(/-/g, '').slice(0, 16)}`
const mockApplicationsBySchema = new Map<string, FakeApplicationRegistration>()
const mockAccessGrantsByUser = new Map<string, boolean>()

const mockInjectedAccessValidator = jest.fn(async (subject: InjectedAccessSubject): Promise<boolean> => {
    if (!subject.ownerUserId) {
        return false
    }
    return mockAccessGrantsByUser.get(subject.ownerUserId) ?? false
})

const mockExecutorQuery = jest.fn(async <TRow = unknown>(sql: string, params?: readonly unknown[]): Promise<TRow[]> => {
    const normalizedSql = sql.toLowerCase()
    const sqlParams = Array.isArray(params) ? params : []
    if (normalizedSql.includes('admin.is_superuser')) {
        return [{ is_super: false }] as TRow[]
    }
    if (normalizedSql.includes('admin.has_permission')) {
        return [{ has_perm: false }] as TRow[]
    }
    if (normalizedSql.includes('rel_application_users')) {
        const [applicationId, userId] = sqlParams
        return [
            { userId: String(userId ?? ''), applicationId: String(applicationId ?? ''), role: 'owner', _uplCreatedAt: new Date() }
        ] as TRow[]
    }
    if (normalizedSql.includes('from applications.obj_applications')) {
        const applicationId = String(sqlParams[0] ?? '')
        return [
            {
                id: applicationId,
                schemaName: fakeSchemaName(applicationId),
                workspacesEnabled: false,
                settings: {}
            }
        ] as TRow[]
    }
    if (normalizedSql.includes('_app_widgets')) {
        const schemaName = /"([^"]+)"\."_app_layouts"/.exec(sql)?.[1] ?? ''
        const registration = mockApplicationsBySchema.get(schemaName)
        if (!registration) {
            throw new Error(`No fake application registered for schema "${schemaName}"`)
        }
        return [{ widgetId: registration.widgetId, config: WIDGET_SCENE_CONFIG }] as TRow[]
    }
    throw new Error(`Unexpected SQL reached realtime integration executor: ${sql.slice(0, 160)}`)
})

const mockRealtimeDbExecutor = {
    query: mockExecutorQuery,
    transaction: jest.fn(
        async <TRow>(handler: (tx: typeof mockRealtimeDbExecutor) => Promise<TRow>): Promise<TRow> => handler(mockRealtimeDbExecutor)
    ),
    isReleased: jest.fn(() => false)
}

jest.mock('@universo-react/database', () => ({
    ...jest.requireActual('@universo-react/database'),
    getPoolExecutor: () => mockRealtimeDbExecutor
}))

const encodeBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url')

const mintAccessToken = (userId: string): string => {
    const issuedAtSeconds = Math.floor(Date.now() / 1000)
    const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const claims = encodeBase64Url(
        JSON.stringify({
            sub: userId,
            role: 'authenticated',
            aud: 'authenticated',
            iat: issuedAtSeconds,
            exp: issuedAtSeconds + 600
        })
    )
    const signature = createHmac('sha256', SUPABASE_JWT_SECRET).update(`${header}.${claims}`).digest('base64url')
    return `${header}.${claims}.${signature}`
}

const registerFakeApplication = (): { applicationId: string; widgetId: string } => {
    const applicationId = randomUUID()
    const registration = { applicationId, widgetId: randomUUID() }
    mockApplicationsBySchema.set(fakeSchemaName(applicationId), registration)
    return registration
}

const registerFakeUser = (): string => {
    const userId = randomUUID()
    mockAccessGrantsByUser.set(userId, true)
    return userId
}

const waitFor = async (description: string, probe: () => boolean, timeoutMs = WAIT_TIMEOUT_MS, intervalMs = 25): Promise<void> => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (probe()) {
            return
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(`Timed out after ${timeoutMs}ms waiting for ${description}`)
}

const trackLeaves = (room: SceneRoom): number[] => {
    const codes: number[] = []
    room.onLeave((code: number) => {
        codes.push(code)
    })
    return codes
}

const requestLocalShipId = async (room: SceneRoom): Promise<string> => {
    const assigned = new Promise<{ shipId?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timed out waiting for local_ship_assigned')), SIGNAL_TIMEOUT_MS)
        room.onMessage('local_ship_assigned', (payload: { shipId?: string }) => {
            clearTimeout(timeout)
            resolve(payload)
        })
    })
    room.send('identify_local_ship')
    const payload = await assigned
    if (!payload?.shipId) {
        throw new Error('local_ship_assigned payload did not contain a shipId')
    }
    return payload.shipId
}

const dropConnection = (room: SceneRoom): void => {
    const transport = room.connection.transport as unknown as { ws?: { close(): void } }
    if (!transport.ws) {
        throw new Error('Underlying websocket is not initialised')
    }
    // Bare close() sends a close frame without a status code: the SDK classifies the
    // result as NO_STATUS_RECEIVED (its automatic-reconnection trigger), while the
    // server sees a non-consented disconnect and routes it through onDrop.
    transport.ws.close()
}

const readShipPosition = (room: SceneRoom, shipId: string): { x: number; z: number } => {
    const ship = room.state.ships.get(shipId)
    if (!ship?.position) {
        throw new Error(`Ship "${shipId}" has no observed position in the reflected room state`)
    }
    return { x: ship.position.x, z: ship.position.z }
}

const travelledDistance = (from: { x: number; z: number }, to: { x: number; z: number }): number => Math.hypot(to.x - from.x, to.z - from.z)

let runtimeHandle: ApplicationsRealtimeRuntimeHandle | null = null
let httpServer: http.Server | null = null
let listenPort = 0

const joinSceneRoom = async (userId: string, options: SceneJoinOptions): Promise<SceneRoom> => {
    const client = new Client(`ws://127.0.0.1:${listenPort}`, {
        headers: { Authorization: `Bearer ${mintAccessToken(userId)}` }
    })
    const room = await client.joinOrCreate<ReflectedSceneState>(ROOM_NAME, options)
    // Same automatic-reconfiguration contract as the production PlayCanvas widget.
    Object.assign(room.reconnection, {
        enabled: true,
        minUptime: 0,
        maxRetries: 10,
        minDelay: 50,
        maxDelay: 200
    })
    return room
}

describe('applications realtime runtime real-server reconnection lifecycle', () => {
    beforeAll(async () => {
        process.env.UNIVERSO_REALTIME_ROOM_AUTH_SECRET = ROOM_AUTH_SECRET
        process.env.SUPABASE_JWT_SECRET = SUPABASE_JWT_SECRET
        process.env.SUPERUSER_ENABLED = 'false'
        process.env.GLOBAL_ROLES_ENABLED = 'false'

        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(mockInjectedAccessValidator)

        const app = express()
        httpServer = http.createServer(app)
        runtimeHandle = await attachApplicationsRealtimeRuntime(httpServer, {})
        // Production mounts the middleware at the application root; the middleware itself
        // gates on the shared `/matchmake/` prefix (see core-backend/src/index.ts).
        app.use(runtimeHandle.matchmakeMiddleware)

        await new Promise<void>((resolve, reject) => {
            httpServer?.once('error', reject)
            httpServer?.listen(0, '127.0.0.1', () => resolve())
        })
        const address = httpServer?.address() as AddressInfo | null
        if (!address) {
            throw new Error('Realtime HTTP server did not report a listening address')
        }
        listenPort = address.port
    }, 30000)

    afterAll(async () => {
        __applicationsRealtimeRuntimeTestUtils.setRuntimeAccessValidatorForTests(null)
        if (runtimeHandle) {
            await runtimeHandle.gameServer.gracefullyShutdown(false)
        }
        await new Promise<void>((resolve, reject) => {
            if (!httpServer || !httpServer.listening) {
                resolve()
                return
            }
            httpServer.close((error) => (error ? reject(error) : resolve()))
        })
    }, 20000)

    it('restores the controller seat after an abrupt socket loss without emitting leave', async () => {
        const { applicationId, widgetId } = registerFakeApplication()
        const alphaUserId = registerFakeUser()
        const bravoUserId = registerFakeUser()

        const alphaRoom = await joinSceneRoom(alphaUserId, { accessMode: 'member', applicationId, widgetId })
        const bravoRoom = await joinSceneRoom(bravoUserId, { accessMode: 'member', applicationId, widgetId })

        expect(alphaRoom.roomId).toBe(bravoRoom.roomId)
        expect(bravoRoom.sessionId).not.toBe(alphaRoom.sessionId)

        const alphaShipId = await requestLocalShipId(alphaRoom)
        const bravoShipId = await requestLocalShipId(bravoRoom)
        expect(alphaShipId).not.toBe(bravoShipId)
        await waitFor('two ships to appear in the shared scene state', () => alphaRoom.state.ships.size === 2)

        const alphaLeaves = trackLeaves(alphaRoom)
        const alphaSessionIdBeforeDrop = alphaRoom.sessionId
        let alphaReconnectEvents = 0
        alphaRoom.onReconnect(() => {
            alphaReconnectEvents += 1
        })

        // Slow the first retry so the seat-reservation phase (connected=false) is
        // observable before the automatic reconnection restores the seat.
        Object.assign(alphaRoom.reconnection, { enabled: true, minUptime: 0, maxRetries: 10, minDelay: 400, maxDelay: 400 })

        const alphaReconnected = new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timed out waiting for the client onReconnect event')), SIGNAL_TIMEOUT_MS)
            alphaRoom.onReconnect(() => {
                clearTimeout(timer)
                resolve()
            })
        })

        dropConnection(alphaRoom)

        // The dropped client stops receiving patches, so bravo witnesses the reserved
        // seat: connected flips false while the seat is held.
        await waitFor(
            'dropped ship to be marked disconnected while its seat is reserved',
            () => bravoRoom.state.ships.get(alphaShipId)?.connected === false
        )
        expect(alphaLeaves).toHaveLength(0)

        const serverTickAtDrop = bravoRoom.state.serverTick

        // A dropped client keeps a frozen local state, so the reconnection itself must
        // be awaited through the SDK event, not through stale state probes.
        await alphaReconnected

        // Fresh ticks prove the restored seat receives live patches again.
        await waitFor('restored seat to receive fresh server ticks', () => alphaRoom.state.serverTick > serverTickAtDrop)

        expect(alphaLeaves).toHaveLength(0)
        expect(alphaReconnectEvents).toBe(1)
        expect(alphaRoom.sessionId).toBe(alphaSessionIdBeforeDrop)
        expect(alphaRoom.state.ships.has(alphaShipId)).toBe(true)
        expect(alphaRoom.state.ships.size).toBe(2)
    }, 20000)

    it('keeps streaming movement patches to the remaining partner while a peer reconnects', async () => {
        const { applicationId, widgetId } = registerFakeApplication()
        const moverUserId = registerFakeUser()
        const observerUserId = registerFakeUser()

        const moverRoom = await joinSceneRoom(moverUserId, { accessMode: 'member', applicationId, widgetId })
        const observerRoom = await joinSceneRoom(observerUserId, { accessMode: 'member', applicationId, widgetId })
        expect(observerRoom.roomId).toBe(moverRoom.roomId)

        const moverShipId = await requestLocalShipId(moverRoom)
        await requestLocalShipId(observerRoom)
        await waitFor('two ships to appear in the shared scene state', () => moverRoom.state.ships.size === 2)

        const moverPositionBeforeDrop = readShipPosition(observerRoom, moverShipId)
        moverRoom.send('intent', { type: 'move_to_point', seq: 1, target: { x: -600, y: 0, z: 600 } })

        // Slow the observer's first retry so its downtime (~1s) comfortably exceeds
        // the time the partner needs to accumulate observable movement.
        Object.assign(observerRoom.reconnection, {
            enabled: true,
            minUptime: 0,
            maxRetries: 10,
            delay: 500,
            minDelay: 500,
            maxDelay: 1000
        })
        dropConnection(observerRoom)
        await waitFor('observer connection to drop', () => !observerRoom.connection.isOpen)

        const moverPositionAtDrop = readShipPosition(moverRoom, moverShipId)

        // While the peer seat is reserved, the surviving client must keep receiving patches.
        await waitFor(
            'partner ship to keep moving while the peer connection is down',
            () => travelledDistance(moverPositionAtDrop, readShipPosition(moverRoom, moverShipId)) > 10
        )

        await waitFor(
            'reconnected observer to observe the partner movement',
            () => travelledDistance(moverPositionBeforeDrop, readShipPosition(observerRoom, moverShipId)) > 10
        )
    }, 20000)

    it('fail-closes a revoked seat exactly once instead of leaking participants', async () => {
        const { applicationId, widgetId } = registerFakeApplication()
        const revokedUserId = registerFakeUser()
        const partnerUserId = registerFakeUser()

        const revokedRoom = await joinSceneRoom(revokedUserId, { accessMode: 'member', applicationId, widgetId })
        const partnerRoom = await joinSceneRoom(partnerUserId, { accessMode: 'member', applicationId, widgetId })
        expect(partnerRoom.roomId).toBe(revokedRoom.roomId)

        const revokedShipId = await requestLocalShipId(revokedRoom)
        const partnerShipId = await requestLocalShipId(partnerRoom)
        await waitFor('two ships to appear in the shared scene state', () => revokedRoom.state.ships.size === 2)

        const revokedLeaves = trackLeaves(revokedRoom)
        const partnerLeaves = trackLeaves(partnerRoom)

        dropConnection(revokedRoom)
        // Expiry forcing: deny access before the first retry lands so the reserved
        // seat fail-closes in onReconnect instead of waiting out the production window.
        mockAccessGrantsByUser.set(revokedUserId, false)

        await waitFor('exactly one leave event for the revoked controller', () => revokedLeaves.length >= 1)
        // The revoked client is gone, so the partner witnesses the shared scene state.
        await waitFor('revoked ship to disappear from the shared scene state', () => !partnerRoom.state.ships.has(revokedShipId))

        await new Promise((resolve) => setTimeout(resolve, 300))
        expect(revokedLeaves).toHaveLength(1)
        expect(partnerRoom.state.ships.size).toBe(1)
        expect(partnerRoom.state.ships.get(partnerShipId)?.connected).toBe(true)
        expect(partnerLeaves).toHaveLength(0)
    }, 20000)

    it('removes the ship immediately on consented leave', async () => {
        const { applicationId, widgetId } = registerFakeApplication()
        const leaverUserId = registerFakeUser()
        const witnessUserId = registerFakeUser()

        const witnessRoom = await joinSceneRoom(witnessUserId, { accessMode: 'member', applicationId, widgetId })
        const leaverRoom = await joinSceneRoom(leaverUserId, { accessMode: 'member', applicationId, widgetId })
        expect(leaverRoom.roomId).toBe(witnessRoom.roomId)

        const leaverShipId = await requestLocalShipId(leaverRoom)
        await requestLocalShipId(witnessRoom)
        await waitFor('two ships to appear in the shared scene state', () => witnessRoom.state.ships.size === 2)

        const leaverLeaves = trackLeaves(leaverRoom)
        const witnessLeaves = trackLeaves(witnessRoom)

        await leaverRoom.leave(true)

        expect(leaverLeaves).toHaveLength(1)
        // The leaver no longer receives patches, so the witness observes the removal.
        await waitFor('consented ship removal to reach the shared scene state', () => !witnessRoom.state.ships.has(leaverShipId))
        expect(witnessRoom.state.ships.size).toBe(1)
        expect(witnessLeaves).toHaveLength(0)

        // The surviving controller can still leave cleanly and the room disposes.
        await witnessRoom.leave(true)
        expect(witnessLeaves).toHaveLength(1)
        await waitFor('empty room to be disposed', () => !matchMaker.getLocalRoomById(witnessRoom.roomId))
    }, 20000)

    it('disposes normally after dropping a client whose ship mapping was already removed', async () => {
        const { applicationId, widgetId } = registerFakeApplication()
        const phantomUserId = registerFakeUser()
        const survivorUserId = registerFakeUser()

        const phantomRoom = await joinSceneRoom(phantomUserId, { accessMode: 'member', applicationId, widgetId })
        const survivorRoom = await joinSceneRoom(survivorUserId, { accessMode: 'member', applicationId, widgetId })
        expect(survivorRoom.roomId).toBe(phantomRoom.roomId)

        const phantomShipId = await requestLocalShipId(phantomRoom)
        await requestLocalShipId(survivorRoom)
        await waitFor('two ships to appear in the shared scene state', () => phantomRoom.state.ships.size === 2)

        const phantomLeaves = trackLeaves(phantomRoom)
        const survivorLeaves = trackLeaves(survivorRoom)

        // Simulate access revocation: the next intent makes the server remove the whole
        // ship runtime (mapping included) and close the socket, so the subsequent drop
        // lands on a session without any ship mapping - the phantom-seat guard path.
        mockAccessGrantsByUser.set(phantomUserId, false)
        phantomRoom.send('intent', { type: 'move_to_point', seq: 1, target: { x: 600, y: 0, z: -600 } })

        await waitFor('phantom controller to receive exactly one leave', () => phantomLeaves.length >= 1)
        // The phantom client is gone, so the survivor witnesses the shared scene state.
        await waitFor(
            'phantom ship removal to reach the shared scene state',
            () => !survivorRoom.state.ships.has(phantomShipId) && survivorRoom.state.ships.size === 1
        )

        await survivorRoom.leave(true)
        expect(survivorLeaves).toHaveLength(1)

        // No lingering reservation may keep the room alive after the last client leaves.
        await waitFor('room disposal after the phantom drop', () => !matchMaker.getLocalRoomById(phantomRoom.roomId))
    }, 20000)
})
