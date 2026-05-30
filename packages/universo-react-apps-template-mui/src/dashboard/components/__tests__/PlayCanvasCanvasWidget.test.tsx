import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import PlayCanvasCanvasWidget from '../PlayCanvasCanvasWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import enApps from '../../../i18n/locales/en/apps.json'
import ruApps from '../../../i18n/locales/ru/apps.json'

const playcanvasMocks = vi.hoisted(() => ({
    createBasicApplication: vi.fn(),
    createBoxEntity: vi.fn(),
    updateHandler: null as ((dt: number) => void) | null
}))

const moduleRuntimeMocks = vi.hoisted(() => ({
    executeClientModuleMethod: vi.fn()
}))

const colyseusMocks = vi.hoisted(() => ({
    joinOrCreate: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string | { defaultValue?: string }) =>
            typeof fallback === 'object' ? fallback.defaultValue ?? _key : fallback ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('../../runtime/browserModuleRuntime', () => ({
    executeClientModuleMethod: moduleRuntimeMocks.executeClientModuleMethod
}))

vi.mock('@universo-react/playcanvas-engine', () => {
    class Vec3 {
        x: number
        y: number
        z: number

        constructor(x = 0, y = 0, z = 0) {
            this.x = x
            this.y = y
            this.z = z
        }

        clone() {
            return new Vec3(this.x, this.y, this.z)
        }

        dot(value: Vec3) {
            return this.x * value.x + this.y * value.y + this.z * value.z
        }

        sub(value: Vec3) {
            this.x -= value.x
            this.y -= value.y
            this.z -= value.z
            return this
        }

        add(value: Vec3) {
            this.x += value.x
            this.y += value.y
            this.z += value.z
            return this
        }

        normalize() {
            const length = Math.hypot(this.x, this.y, this.z)
            if (length > 0.000001) {
                this.x /= length
                this.y /= length
                this.z /= length
            }
            return this
        }

        mulScalar(value: number) {
            this.x *= value
            this.y *= value
            this.z *= value
            return this
        }
    }

    class Color {
        constructor(public r = 0, public g = 0, public b = 0) {}
    }

    class Quat {
        x = 0
        y = 0
        z = 0
        w = 1

        setFromDirections(from: Vec3, to: Vec3) {
            const fromLength = Math.hypot(from.x, from.y, from.z) || 1
            const toLength = Math.hypot(to.x, to.y, to.z) || 1
            const source = new Vec3(from.x / fromLength, from.y / fromLength, from.z / fromLength)
            const target = new Vec3(to.x / toLength, to.y / toLength, to.z / toLength)
            const dotProduct = 1 + source.dot(target)
            if (dotProduct < Number.EPSILON) {
                if (Math.abs(source.x) > Math.abs(source.y)) {
                    this.x = -source.z
                    this.y = 0
                    this.z = source.x
                    this.w = 0
                } else {
                    this.x = 0
                    this.y = -source.z
                    this.z = source.y
                    this.w = 0
                }
            } else {
                this.x = source.y * target.z - source.z * target.y
                this.y = source.z * target.x - source.x * target.z
                this.z = source.x * target.y - source.y * target.x
                this.w = dotProduct
            }
            const length = Math.hypot(this.x, this.y, this.z, this.w) || 1
            this.x /= length
            this.y /= length
            this.z /= length
            this.w /= length
            return this
        }

        transformVector(vector: Vec3, out = new Vec3()) {
            const x = vector.x
            const y = vector.y
            const z = vector.z
            const qx = this.x
            const qy = this.y
            const qz = this.z
            const qw = this.w
            const ix = qw * x + qy * z - qz * y
            const iy = qw * y + qz * x - qx * z
            const iz = qw * z + qx * y - qy * x
            const iw = -qx * x - qy * y - qz * z
            out.x = ix * qw + iw * -qx + iy * -qz - iz * -qy
            out.y = iy * qw + iw * -qy + iz * -qx - ix * -qz
            out.z = iz * qw + iw * -qz + ix * -qy - iy * -qx
            return out
        }
    }

    class Entity {
        name: string
        camera?: {
            nearClip: number
            farClip: number
            screenToWorld: (screenX: number, screenY: number, clip: number) => Vec3
            worldToScreen: () => Vec3
        }
        private position = new Vec3()
        private rotation = new Quat()

        constructor(name: string) {
            this.name = name
        }

        addComponent(kind: string) {
            if (kind === 'camera') {
                this.camera = {
                    nearClip: 0.1,
                    farClip: 1000,
                    screenToWorld: (screenX: number, screenY: number, clip: number) => {
                        const perspective = clip > 1 ? 1 : 0
                        const planarZ = screenY > 300 ? clip * 0.01 : -clip * 0.01
                        return new Vec3((screenX - 300) * 0.01 * perspective, (300 - screenY) * 0.01 * perspective, planarZ)
                    },
                    worldToScreen: () => new Vec3(1, 1, 0)
                }
            }
        }

        setEulerAngles() {
            return undefined
        }

        addChild() {
            return undefined
        }

        setPosition(x: number, y: number, z: number) {
            this.position = new Vec3(x, y, z)
        }

        setLocalPosition(x: number, y: number, z: number) {
            this.position = new Vec3(x, y, z)
        }

        setLocalScale() {
            return undefined
        }

        getPosition() {
            return this.position
        }

        setRotation(rotation: Quat) {
            this.rotation = rotation
        }

        setLocalRotation(rotation: Quat) {
            this.rotation = rotation
        }

        getRotation() {
            return this.rotation
        }

        destroy() {
            return undefined
        }
    }

    playcanvasMocks.createBasicApplication.mockImplementation(() => ({
        scene: {},
        root: { addChild: vi.fn() },
        on: vi.fn((eventName: string, handler: (dt: number) => void) => {
            if (eventName === 'update') {
                playcanvasMocks.updateHandler = handler
            }
        }),
        start: vi.fn(),
        destroy: vi.fn()
    }))
    playcanvasMocks.createBoxEntity.mockImplementation(
        ({ name, position }: { name: string; position: { x: number; y: number; z: number } }) => {
            const entity = new Entity(name)
            entity.setPosition(position.x, position.y, position.z)
            return entity
        }
    )

    return {
        Color,
        Entity,
        Quat,
        Vec3,
        createBasicApplication: playcanvasMocks.createBasicApplication,
        createBoxEntity: playcanvasMocks.createBoxEntity,
        createStandardMaterial: vi.fn(() => ({})),
        resizeApplicationCanvas: vi.fn(),
        applyFollowCameraTransform: vi.fn(),
        rotateFollowCamera: (yaw: number, pitch: number, deltaYaw: number, deltaPitch: number) => ({
            yaw: yaw + deltaYaw,
            pitch: pitch + deltaPitch
        }),
        zoomFollowCamera: (distance: number, delta: number, minDistance: number, maxDistance: number) =>
            Math.min(maxDistance, Math.max(minDistance, distance + delta))
    }
})

vi.mock('@universo-react/colyseus-client', () => ({
    Client: class {
        async joinOrCreate(...args: unknown[]) {
            return colyseusMocks.joinOrCreate(...args)
        }
    },
    createMoveToObjectIntent: (objectId: string, seq?: number) => ({ type: 'move_to_object', objectId, seq }),
    createMoveToPointIntent: (target: unknown, seq?: number) => ({ type: 'move_to_point', target, seq }),
    createStopIntent: (seq?: number) => ({ type: 'stop', seq }),
    dropAcknowledgedPredictions: (predictions: Array<{ seq: number }>, lastProcessedInputSeq: number) =>
        predictions.filter((prediction) => prediction.seq > lastProcessedInputSeq),
    lerpVector3: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, alpha: number) => {
        const clamped = Math.min(1, Math.max(0, alpha))
        return {
            x: from.x + (to.x - from.x) * clamped,
            y: from.y + (to.y - from.y) * clamped,
            z: from.z + (to.z - from.z) * clamped
        }
    }
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const normalize3d = (value: { x: number; y: number; z: number }) => {
    const length = Math.hypot(value.x, value.y, value.z)
    return length > 0.000001 ? { x: value.x / length, y: value.y / length, z: value.z / length } : { x: 1, y: 0, z: 0 }
}

const dot3d = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
    const left = normalize3d(a)
    const right = normalize3d(b)
    return left.x * right.x + left.y * right.y + left.z * right.z
}

const renderWidget = (config: Record<string, unknown> = {}, detailsOverrides: Record<string, unknown> = {}) =>
    render(
        <QueryClientProvider client={createQueryClient()}>
            <DashboardDetailsProvider
                value={
                    {
                        title: 'Flight',
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        runtimeAccessMode: 'member',
                        permissions: { editContent: true },
                        rows: [],
                        columns: [],
                        ...detailsOverrides
                    } as never
                }
            >
                <PlayCanvasCanvasWidget
                    config={{
                        attachedToKind: 'metahub',
                        moduleCodename: 'flight-canvas-widget',
                        ...config
                    }}
                />
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )

const stubAvailableRuntimeModuleFetch = () =>
    vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL) => {
            const url = String(input)
            if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                return {
                    ok: true,
                    json: async () => ({
                        items: [
                            {
                                id: 'module-1',
                                codename: 'flight-canvas-widget',
                                attachedToKind: 'metahub',
                                attachedToId: null,
                                moduleRole: 'widget',
                                manifest: {
                                    methods: [{ name: 'mount', target: 'client' }]
                                }
                            }
                        ]
                    })
                } as Response
            }
            if (url.endsWith('/runtime/modules/module-1/client')) {
                return { ok: true, text: async () => 'module.exports = class FlightWidgetRuntime {}' } as Response
            }
            if (url.endsWith('/auth/csrf')) {
                return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
            }
            throw new Error(`Unexpected fetch request: ${url}`)
        })
    )

describe('PlayCanvasCanvasWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        playcanvasMocks.updateHandler = null
        moduleRuntimeMocks.executeClientModuleMethod.mockResolvedValue({ scene: null })
        colyseusMocks.joinOrCreate.mockResolvedValue({
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        })
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {
                    return undefined
                }
                disconnect() {
                    return undefined
                }
            }
        )
    })

    it('keeps realtime failure and reconnect states localized in English and Russian resources', () => {
        const keys = [
            'unauthorized',
            'room_full',
            'version_mismatch',
            'reconnecting',
            'failed_reconnect',
            'unauthorizedDescription',
            'roomFullDescription',
            'versionMismatchDescription',
            'reconnectingDescription',
            'failedReconnectDescription'
        ] as const
        const enRealtime = enApps.playcanvasCanvas.realtime as Record<(typeof keys)[number], string>
        const ruRealtime = ruApps.playcanvasCanvas.realtime as Record<(typeof keys)[number], string>

        for (const key of keys) {
            expect(enRealtime[key], `English realtime key ${key}`).toEqual(expect.any(String))
            expect(ruRealtime[key], `Russian realtime key ${key}`).toEqual(expect.any(String))
            expect(ruRealtime[key], `Russian realtime key ${key} must be localized`).not.toBe(enRealtime[key])
            expect(ruRealtime[key], `Russian realtime key ${key} must not expose protocol details`).not.toMatch(
                /4003|4423|4214|4421|websocket|protocol|room-\d/i
            )
        }
    })

    it('fails closed when the configured runtime module is unavailable', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return { ok: true, json: async () => ({ items: [] }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        renderWidget()

        expect(await screen.findByText('The 3D runtime module is unavailable.')).toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-canvas')).not.toBeInTheDocument()
        expect(playcanvasMocks.createBasicApplication).not.toHaveBeenCalled()
    })

    it('starts the canvas only after the configured runtime module bundle is available', async () => {
        const fetchMock = vi.fn(async (input: string | URL) => {
            const url = String(input)
            if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                return {
                    ok: true,
                    json: async () => ({
                        items: [
                            {
                                id: 'module-1',
                                codename: 'flight-canvas-widget',
                                attachedToKind: 'metahub',
                                attachedToId: null,
                                moduleRole: 'widget',
                                manifest: {
                                    methods: [{ name: 'mount', target: 'client' }]
                                }
                            }
                        ]
                    })
                } as Response
            }
            if (url.endsWith('/runtime/modules/module-1/client')) {
                return { ok: true, text: async () => 'module.exports = class FlightWidgetRuntime {}' } as Response
            }
            if (url.endsWith('/auth/csrf')) {
                return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
            }
            throw new Error(`Unexpected fetch request: ${url}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        renderWidget()

        expect(await screen.findByTestId('playcanvas-canvas')).toBeInTheDocument()
        await waitFor(() => expect(playcanvasMocks.createBasicApplication).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(moduleRuntimeMocks.executeClientModuleMethod).toHaveBeenCalledTimes(1))
        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/runtime/modules/module-1/client'), {
            credentials: 'include'
        })
        expect(screen.getByTestId('playcanvas-canvas')).toHaveAttribute('data-runtime-module-executed', 'true')
        expect(screen.getByTestId('playcanvas-canvas')).toHaveAttribute('data-runtime-module-codename', 'flight-canvas-widget')
    })

    it('keeps mouse wheel input inside the canvas and maps it to follow-camera zoom', async () => {
        stubAvailableRuntimeModuleFetch()
        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(playcanvasMocks.updateHandler).toBeTypeOf('function'))
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })
        const initialDistance = Number(canvas.getAttribute('data-camera-distance'))
        expect(initialDistance).toBeGreaterThan(0)

        const wheelEvent = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
        act(() => {
            canvas.dispatchEvent(wheelEvent)
            playcanvasMocks.updateHandler?.(0.016)
        })

        expect(wheelEvent.defaultPrevented).toBe(true)
        expect(Number(canvas.getAttribute('data-camera-distance'))).toBeLessThan(initialDistance)
    })

    it('uses 3D double-click movement and turns the ship smoothly toward vertical targets', async () => {
        stubAvailableRuntimeModuleFetch()
        renderWidget({
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: [
                    { id: 'ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
                    { id: 'station', position: { x: 200, y: 0, z: -200 }, scale: { x: 48, y: 16, z: 16 }, selectable: true, guard: true }
                ]
            }
        })

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement
        Object.defineProperty(canvas, 'width', { configurable: true, value: 600 })
        Object.defineProperty(canvas, 'height', { configurable: true, value: 400 })
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width: 600,
                height: 400,
                right: 600,
                bottom: 400,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect)
        await waitFor(() => expect(playcanvasMocks.updateHandler).toBeTypeOf('function'))
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))

        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
            canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 500, clientY: 100, bubbles: true }))
            playcanvasMocks.updateHandler?.(0.016)
        })

        expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
        const target = {
            x: Number(canvas.getAttribute('data-last-intent-target-x')),
            y: Number(canvas.getAttribute('data-last-intent-target-y')),
            z: Number(canvas.getAttribute('data-last-intent-target-z'))
        }
        expect(Math.hypot(target.x, target.y, target.z)).toBeGreaterThan(600)
        expect(Math.abs(target.y)).toBeGreaterThan(100)
        expect(canvas).toHaveAttribute('data-ship-turning', 'true')
        const expectedForward = normalize3d(target)

        const samples = [
            {
                x: Number(canvas.getAttribute('data-ship-forward-x')),
                y: Number(canvas.getAttribute('data-ship-forward-y')),
                z: Number(canvas.getAttribute('data-ship-forward-z'))
            }
        ]

        act(() => {
            for (let step = 0; step < 8; step += 1) {
                playcanvasMocks.updateHandler?.(0.016)
                samples.push({
                    x: Number(canvas.getAttribute('data-ship-forward-x')),
                    y: Number(canvas.getAttribute('data-ship-forward-y')),
                    z: Number(canvas.getAttribute('data-ship-forward-z'))
                })
            }
        })

        for (let index = 1; index < samples.length; index += 1) {
            const previous = samples[index - 1]
            const current = samples[index]
            expect(Math.hypot(current.x, current.y, current.z)).toBeGreaterThan(0.99)
            expect(Math.hypot(current.x, current.y, current.z)).toBeLessThan(1.01)
            expect(dot3d(previous, current)).toBeGreaterThan(0.99)
            expect(dot3d(current, expectedForward)).toBeGreaterThanOrEqual(dot3d(previous, expectedForward) - 0.001)
        }
        expect(Math.abs(samples[samples.length - 1].y)).toBeGreaterThan(0.05)
        expect(Number(canvas.getAttribute('data-ship-visual-forward-y'))).toBeCloseTo(Number(canvas.getAttribute('data-ship-forward-y')), 3)
        expect(Math.abs(Number(canvas.getAttribute('data-ship-visual-forward-y')))).toBeGreaterThan(0.05)
    })

    it('keeps lower-screen double-click movement travelling into the scene instead of back toward the camera', async () => {
        stubAvailableRuntimeModuleFetch()
        renderWidget({
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: [
                    { id: 'ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
                    { id: 'station', position: { x: 200, y: 0, z: -200 }, scale: { x: 48, y: 16, z: 16 }, selectable: true, guard: true }
                ]
            }
        })

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement
        Object.defineProperty(canvas, 'width', { configurable: true, value: 600 })
        Object.defineProperty(canvas, 'height', { configurable: true, value: 400 })
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width: 600,
                height: 400,
                right: 600,
                bottom: 400,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect)
        await waitFor(() => expect(playcanvasMocks.updateHandler).toBeTypeOf('function'))
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))

        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
            canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 300, clientY: 360, bubbles: true }))
            playcanvasMocks.updateHandler?.(0.016)
        })

        expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
        expect(Number(canvas.getAttribute('data-last-intent-target-z'))).toBeLessThan(-600)
        expect(
            Math.hypot(
                Number(canvas.getAttribute('data-last-intent-target-x')),
                Number(canvas.getAttribute('data-last-intent-target-y')),
                Number(canvas.getAttribute('data-last-intent-target-z'))
            )
        ).toBeCloseTo(720, 0)
    })

    it('allows empty-space double-click movement to target a different vertical level', async () => {
        stubAvailableRuntimeModuleFetch()
        renderWidget({
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                cruiseSpeed: 36,
                intentDistance: 720,
                objects: [
                    { id: 'ship', position: { x: 0, y: 0, z: 0 }, scale: { x: 12, y: 4, z: 4 }, selectable: true },
                    { id: 'station', position: { x: 200, y: 0, z: -200 }, scale: { x: 48, y: 16, z: 16 }, selectable: true, guard: true }
                ]
            }
        })

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement
        Object.defineProperty(canvas, 'width', { configurable: true, value: 600 })
        Object.defineProperty(canvas, 'height', { configurable: true, value: 400 })
        canvas.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width: 600,
                height: 400,
                right: 600,
                bottom: 400,
                x: 0,
                y: 0,
                toJSON: () => ({})
            } as DOMRect)
        await waitFor(() => expect(playcanvasMocks.updateHandler).toBeTypeOf('function'))
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))

        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
            canvas.dispatchEvent(new MouseEvent('dblclick', { clientX: 300, clientY: 40, bubbles: true }))
            playcanvasMocks.updateHandler?.(0.016)
        })

        expect(canvas).toHaveAttribute('data-last-intent-kind', 'move_to_point')
        expect(Number(canvas.getAttribute('data-last-intent-target-y'))).toBeGreaterThan(100)
        expect(
            Math.hypot(
                Number(canvas.getAttribute('data-last-intent-target-x')),
                Number(canvas.getAttribute('data-last-intent-target-y')),
                Number(canvas.getAttribute('data-last-intent-target-z'))
            )
        ).toBeCloseTo(720, 0)
    })

    it('executes the discovered runtime module when moduleCodename is omitted', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'default-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class DefaultCanvasWidget {}' } as Response
                }
                if (url.endsWith('/auth/csrf')) {
                    return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        renderWidget({ moduleCodename: undefined })

        expect(await screen.findByTestId('playcanvas-canvas')).toBeInTheDocument()
        await waitFor(() => expect(moduleRuntimeMocks.executeClientModuleMethod).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('playcanvas-canvas')).toHaveAttribute('data-runtime-module-executed', 'true')
        expect(screen.getByTestId('playcanvas-canvas')).toHaveAttribute('data-runtime-module-codename', 'default-canvas-widget')
    })

    it('fails closed when the configured runtime module does not expose the mount method', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'flight-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'configure', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class FlightWidgetRuntime {}' } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        renderWidget()

        expect(await screen.findByText('The 3D runtime module is unavailable.')).toBeInTheDocument()
        expect(moduleRuntimeMocks.executeClientModuleMethod).not.toHaveBeenCalled()
        expect(playcanvasMocks.createBasicApplication).not.toHaveBeenCalled()
    })

    it('shows a localized unauthorized state when realtime authentication fails', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'flight-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class FlightWidgetRuntime {}' } as Response
                }
                if (url.endsWith('/auth/csrf')) {
                    return { ok: false, status: 403, json: async () => ({ error: 'Forbidden', roomId: 'room-1' }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        renderWidget()

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('unauthorized'))
        expect(screen.getByText('Realtime control is not available for your account.')).toBeInTheDocument()
        expect(screen.queryByText(/forbidden|room-1|csrf/i)).not.toBeInTheDocument()
    })

    it('maps room-full realtime failures to localized states without protocol leakage', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'flight-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class FlightCanvasWidget {}' } as Response
                }
                if (url.endsWith('/auth/csrf')) {
                    return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )
        colyseusMocks.joinOrCreate.mockRejectedValueOnce({ status: 429, roomId: 'room-1' })

        renderWidget()

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('room_full'))
        expect(screen.queryByText(/room-1|429/i)).not.toBeInTheDocument()
    })

    it('maps room-unavailable join close codes to localized room-full states', async () => {
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockRejectedValueOnce({ code: 4421, roomId: 'room-unavailable' })

        renderWidget()

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('room_full'))
        expect(screen.getByText('Realtime room is full. Try again later.')).toBeInTheDocument()
        expect(screen.queryByText(/4421|room-unavailable|protocol|websocket/i)).not.toBeInTheDocument()
    })

    it('maps version-mismatch realtime failures to localized states without protocol leakage', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'flight-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class FlightCanvasWidget {}' } as Response
                }
                if (url.endsWith('/auth/csrf')) {
                    return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )
        colyseusMocks.joinOrCreate.mockRejectedValueOnce({ status: 426, roomId: 'room-2' })

        renderWidget()

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('version_mismatch'))
        expect(screen.queryByText(/room-2|426/i)).not.toBeInTheDocument()
    })

    it('shows restored and failed reconnect states from Colyseus reconnect events', async () => {
        let dropHandler: (() => void) | null = null
        let reconnectHandler: (() => void) | null = null
        let leaveHandler: ((code?: number) => void) | null = null
        const firstRoom = {
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onDrop: vi.fn((handler: () => void) => {
                dropHandler = handler
            }),
            onReconnect: vi.fn((handler: () => void) => {
                reconnectHandler = handler
            }),
            onLeave: vi.fn((handler: () => void) => {
                leaveHandler = handler
            })
        }

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.includes('/runtime/modules?attachedToKind=metahub')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'module-1',
                                    codename: 'flight-canvas-widget',
                                    attachedToKind: 'metahub',
                                    attachedToId: null,
                                    moduleRole: 'widget',
                                    manifest: {
                                        methods: [{ name: 'mount', target: 'client' }]
                                    }
                                }
                            ]
                        })
                    } as Response
                }
                if (url.endsWith('/runtime/modules/module-1/client')) {
                    return { ok: true, text: async () => 'module.exports = class FlightCanvasWidget {}' } as Response
                }
                if (url.endsWith('/auth/csrf')) {
                    return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(firstRoom)

        renderWidget()
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('connected'))
        const canvas = await screen.findByTestId('playcanvas-canvas')
        expect(firstRoom.reconnection).toMatchObject({
            enabled: true,
            minUptime: 0,
            maxRetries: 10,
            minDelay: 250,
            maxDelay: 2000
        })
        firstRoom.send.mockClear()
        act(() => {
            dropHandler?.()
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('reconnecting'))
        act(() => {
            ;(canvas as HTMLCanvasElement & { __playcanvasMoveToTarget?: (target: null) => void }).__playcanvasMoveToTarget?.(null)
        })
        act(() => {
            fireEvent.keyDown(canvas, { key: 'Enter' })
        })
        act(() => {
            screen.getByRole('button', { name: 'Stop' }).click()
        })
        expect(firstRoom.send).not.toHaveBeenCalledWith('intent', expect.anything())
        act(() => {
            reconnectHandler?.()
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('restored'), { timeout: 2000 })
        expect(firstRoom.send).toHaveBeenCalledWith('identify_local_ship', {})

        act(() => {
            leaveHandler?.(4214)
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('failed_reconnect'), {
            timeout: 2000
        })
    })

    it('keeps rendered ship counts stable while reconnect restores an existing room session', async () => {
        let dropHandler: (() => void) | null = null
        let reconnectHandler: (() => void) | null = null
        const room = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 24, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn((handler: () => void) => {
                dropHandler = handler
            }),
            onReconnect: vi.fn((handler: () => void) => {
                reconnectHandler = handler
            }),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()
        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas).toHaveAttribute('data-remote-ship-count', '1'))
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
            dropHandler?.()
        })
        await waitFor(() => expect(canvas).toHaveAttribute('data-realtime-status', 'reconnecting'))
        expect(canvas).toHaveAttribute('data-remote-ship-count', '1')

        act(() => {
            reconnectHandler?.()
            playcanvasMocks.updateHandler?.(0.016)
        })

        await waitFor(() => expect(canvas).toHaveAttribute('data-reconnect-restored', 'true'))
        expect(canvas).toHaveAttribute('data-remote-ship-count', '1')
        expect(screen.getByTestId('playcanvas-participants-status')).toHaveTextContent('Ships: 2')
        expect(room.send).toHaveBeenCalledWith('identify_local_ship', {})
    })

    it('cleans up PlayCanvas and Colyseus resources on unmount before remounting a fresh room', async () => {
        let stateHandler: ((state: unknown) => void) | null = null
        let dropHandler: (() => void) | null = null
        let reconnectHandler: (() => void) | null = null
        let leaveHandler: ((code?: number) => void) | null = null
        const disconnectSpy = vi.fn()
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {
                    return undefined
                }
                disconnect = disconnectSpy
            }
        )
        const firstRoom = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 24, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn((handler: (state: unknown) => void) => {
                stateHandler = handler
            }),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn((handler: () => void) => {
                dropHandler = handler
            }),
            onReconnect: vi.fn((handler: () => void) => {
                reconnectHandler = handler
            }),
            onLeave: vi.fn((handler: (code?: number) => void) => {
                leaveHandler = handler
            })
        }
        const secondRoom = {
            ...firstRoom,
            state: {
                ships: new Map([['ship-local-2', { shipId: 'ship-local-2', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]])
            },
            send: vi.fn(),
            leave: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local-2' })
            })
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(firstRoom).mockResolvedValueOnce(secondRoom)

        const firstRender = renderWidget()
        const firstCanvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(firstCanvas).toHaveAttribute('data-remote-ship-count', '1'))
        const firstApp = playcanvasMocks.createBasicApplication.mock.results[0]?.value
        expect((firstCanvas as HTMLCanvasElement & { __playcanvasMoveToTarget?: unknown }).__playcanvasMoveToTarget).toEqual(
            expect.any(Function)
        )

        firstRender.unmount()

        expect(firstRoom.leave).toHaveBeenCalledWith(true)
        expect(firstApp.destroy).toHaveBeenCalled()
        expect(disconnectSpy).toHaveBeenCalled()
        expect((firstCanvas as HTMLCanvasElement & { __playcanvasMoveToTarget?: unknown }).__playcanvasMoveToTarget).toBeUndefined()
        expect((firstCanvas as HTMLCanvasElement & { __playcanvasPickAt?: unknown }).__playcanvasPickAt).toBeUndefined()

        act(() => {
            stateHandler?.(firstRoom.state)
            dropHandler?.()
            reconnectHandler?.()
            leaveHandler?.(4214)
        })
        expect(screen.queryByTestId('playcanvas-canvas')).not.toBeInTheDocument()

        renderWidget()
        const secondCanvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(secondCanvas).toHaveAttribute('data-remote-ship-count', '0'))
        expect(colyseusMocks.joinOrCreate).toHaveBeenCalledTimes(2)
        expect(playcanvasMocks.createBasicApplication).toHaveBeenCalledTimes(2)
    })

    it('treats Colyseus failed-reconnect closes during an active reconnect window as a failed reconnect', async () => {
        let dropHandler: (() => void) | null = null
        let leaveHandler: ((code?: number) => void) | null = null
        const room = {
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn(),
            onDrop: vi.fn((handler: () => void) => {
                dropHandler = handler
            }),
            onReconnect: vi.fn(),
            onLeave: vi.fn((handler: (code?: number) => void) => {
                leaveHandler = handler
            })
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('connected'))

        act(() => {
            dropHandler?.()
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('reconnecting'))

        act(() => {
            leaveHandler?.(4003)
        })

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('failed_reconnect'))
        expect(screen.getByText('Realtime control could not reconnect.')).toBeInTheDocument()
        expect(screen.queryByText(/4003|room|protocol|websocket/i)).not.toBeInTheDocument()
    })

    it('maps access revocation room closes to a localized unauthorized state', async () => {
        let leaveHandler: ((code?: number) => void) | null = null
        const room = {
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn(),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn((handler: (code?: number) => void) => {
                leaveHandler = handler
            })
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('connected'))

        act(() => {
            leaveHandler?.(4423)
        })

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('unauthorized'))
        expect(screen.getByText('Realtime control is not available for your account.')).toBeInTheDocument()
        expect(screen.queryByText(/4423|room|protocol|websocket/i)).not.toBeInTheDocument()
    })

    it('maps room-unavailable closes to a localized room-full state', async () => {
        let leaveHandler: ((code?: number) => void) | null = null
        const room = {
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn(),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn((handler: (code?: number) => void) => {
                leaveHandler = handler
            })
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('connected'))

        act(() => {
            leaveHandler?.(4421)
        })

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('room_full'))
        expect(screen.getByText('Realtime room is full. Try again later.')).toBeInTheDocument()
        expect(screen.queryByText(/4421|protocol|websocket/i)).not.toBeInTheDocument()
    })

    it('renders remote ship probes and sends sequenced movement intents for the local ship', async () => {
        const room = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 30, y: 0, z: -10 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-remote-ship-count', '1'))
        expect(canvas).toHaveAttribute('data-ship-count', '2')
        expect(canvas).toHaveAttribute('data-remote-ship-x', '30.00')
        expect(screen.getByTestId('playcanvas-participants-status')).toHaveTextContent('Ships: 2 (you + 1 remote)')
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })
        expect(canvas).toHaveAttribute('data-local-ship-id-assigned', 'true')
        const renderedEntityNames = playcanvasMocks.createBoxEntity.mock.calls.map(([options]) => (options as { name?: string }).name)
        expect(renderedEntityNames).toEqual(['controlled', 'target', 'remote-ship-remote'])
        expect(renderedEntityNames.some((name) => typeof name === 'string' && name.includes('nose-marker'))).toBe(false)

        const stopButton = screen.getByRole('button', { name: 'Stop' })
        act(() => {
            stopButton.click()
        })

        expect(room.send).toHaveBeenCalledWith('intent', { type: 'stop', seq: 1 })
    })

    it('rebinds the current authoritative state when the local ship assignment arrives after multi-ship state', async () => {
        let localShipHandler: ((payload: unknown) => void) | null = null
        const room = {
            state: {
                ships: new Map([
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-local', { shipId: 'ship-local', position: { x: 24, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                localShipHandler = handler
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-ship-count', '2'))
        const stopButton = screen.getByRole('button', { name: 'Stop' })
        expect(stopButton).toBeDisabled()
        ;(room.send as Mock).mockClear()

        act(() => {
            stopButton.click()
        })

        expect(room.send).not.toHaveBeenCalled()

        act(() => {
            localShipHandler?.({ shipId: 'ship-local' })
        })

        expect(canvas).toHaveAttribute('data-local-ship-id-assigned', 'true')
        await waitFor(() => expect(stopButton).not.toBeDisabled())
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })
        expect(canvas).toHaveAttribute('data-ship-x', '24.00')
        expect(canvas).toHaveAttribute('data-remote-ship-x', '0.00')
    })

    it('continues movement intent sequencing when a session attaches to a reused local ship', async () => {
        const room = {
            state: {
                ships: new Map([['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 12 }]])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-last-processed-input-seq', '12'))

        act(() => {
            screen.getByRole('button', { name: 'Stop' }).click()
        })

        expect(room.send).toHaveBeenCalledWith('intent', { type: 'stop', seq: 13 })
    })

    it('clears acknowledged local predictions and reconciles to divergent authoritative state', async () => {
        let stateChangeHandler: ((state: unknown) => void) | null = null
        const room = {
            state: {
                ships: new Map([['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn((handler: (state: unknown) => void) => {
                stateChangeHandler = handler
            }),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement & {
            __playcanvasMoveToTarget?: (target: { x: number; y: number; z: number }) => void
        }
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))

        act(() => {
            canvas.__playcanvasMoveToTarget?.({ x: 100, y: 0, z: 0 })
        })
        act(() => {
            playcanvasMocks.updateHandler?.(0.1)
        })
        expect(room.send).toHaveBeenCalledWith('intent', { type: 'move_to_point', target: { x: 100, y: 0, z: 0 }, seq: 1 })
        expect(canvas).toHaveAttribute('data-prediction-active', 'true')
        expect(Number(canvas.getAttribute('data-ship-x'))).toBeGreaterThan(0)

        room.state.ships.set('ship-local', {
            shipId: 'ship-local',
            position: { x: 8, y: 0, z: 0 },
            lastProcessedInputSeq: 1
        })
        act(() => {
            stateChangeHandler?.(room.state)
        })
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })

        await waitFor(() => expect(canvas).toHaveAttribute('data-pending-prediction-count', '0'))
        expect(canvas).toHaveAttribute('data-last-processed-input-seq', '1')
        expect(canvas).toHaveAttribute('data-prediction-active', 'false')
        expect(canvas).toHaveAttribute('data-ship-x', '8.00')
    })

    it('keeps local prediction smooth while an acknowledged server target is still active', async () => {
        let stateChangeHandler: ((state: unknown) => void) | null = null
        const room = {
            state: {
                ships: new Map([['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn((handler: (state: unknown) => void) => {
                stateChangeHandler = handler
            }),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement & {
            __playcanvasMoveToTarget?: (target: { x: number; y: number; z: number }) => void
        }
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))

        act(() => {
            canvas.__playcanvasMoveToTarget?.({ x: 100, y: 0, z: 0 })
            playcanvasMocks.updateHandler?.(0.1)
        })
        const predictedXBeforeAck = Number(canvas.getAttribute('data-ship-x'))
        expect(predictedXBeforeAck).toBeGreaterThan(0)

        room.state.ships.set('ship-local', {
            shipId: 'ship-local',
            position: { x: 0.5, y: 0, z: 0 },
            target: { x: 100, y: 0, z: 0 },
            hasTarget: true,
            speed: 4.8,
            lastProcessedInputSeq: 1
        })
        act(() => {
            stateChangeHandler?.(room.state)
            playcanvasMocks.updateHandler?.(0.016)
        })

        await waitFor(() => expect(canvas).toHaveAttribute('data-pending-prediction-count', '0'))
        expect(canvas).toHaveAttribute('data-prediction-active', 'true')
        expect(Number(canvas.getAttribute('data-ship-x'))).toBeGreaterThan(predictedXBeforeAck)
    })

    it('does not locally predict through a rendered remote ship body', async () => {
        const room = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 12, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = (await screen.findByTestId('playcanvas-canvas')) as HTMLCanvasElement & {
            __playcanvasMoveToTarget?: (target: { x: number; y: number; z: number }) => void
        }
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-remote-ship-count', '1'))

        act(() => {
            canvas.__playcanvasMoveToTarget?.({ x: 100, y: 0, z: 0 })
        })
        act(() => {
            playcanvasMocks.updateHandler?.(0.5)
        })

        expect(room.send).toHaveBeenCalledWith('intent', { type: 'move_to_point', target: { x: 100, y: 0, z: 0 }, seq: 1 })
        expect(canvas).toHaveAttribute('data-prediction-active', 'false')
        expect(canvas).toHaveAttribute('data-ship-x', '0.00')
    })

    it('does not interpolate a remote ship through the local visual hull', async () => {
        let stateChangeHandler: ((state: unknown) => void) | null = null
        const room = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 12, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn((handler: (state: unknown) => void) => {
                stateChangeHandler = handler
            }),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-remote-ship-count', '1'))
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })
        expect(Number(canvas.getAttribute('data-remote-rendered-ship-x'))).toBeGreaterThanOrEqual(12)

        room.state.ships.set('ship-remote', {
            shipId: 'ship-remote',
            position: { x: 4, y: 0, z: 0 },
            lastProcessedInputSeq: 0,
            heading: { x: -1, y: 0, z: 0 }
        })
        act(() => {
            stateChangeHandler?.(room.state)
            playcanvasMocks.updateHandler?.(0.1)
        })

        expect(Number(canvas.getAttribute('data-remote-rendered-ship-x'))).toBeGreaterThanOrEqual(12)
    })

    it('does not reconcile an authoritative correction through a rendered remote ship body', async () => {
        let stateChangeHandler: ((state: unknown) => void) | null = null
        const room = {
            state: {
                ships: new Map([
                    ['ship-local', { shipId: 'ship-local', position: { x: 0, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-remote', { shipId: 'ship-remote', position: { x: 12, y: 0, z: 0 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn((handler: (state: unknown) => void) => {
                stateChangeHandler = handler
            }),
            onMessage: vi.fn((_type: string, handler: (payload: unknown) => void) => {
                handler({ shipId: 'ship-local' })
            }),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget()

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-remote-ship-count', '1'))

        room.state.ships.set('ship-local', {
            shipId: 'ship-local',
            position: { x: 20, y: 0, z: 0 },
            lastProcessedInputSeq: 0
        })
        act(() => {
            stateChangeHandler?.(room.state)
            playcanvasMocks.updateHandler?.(0.016)
        })

        expect(canvas).toHaveAttribute('data-pending-prediction-count', '0')
        expect(canvas).toHaveAttribute('data-ship-x', '0.00')
    })

    it('binds read-only observers to one authoritative ship instead of rendering a phantom local prototype', async () => {
        const room = {
            state: {
                ships: new Map([
                    ['ship-a', { shipId: 'ship-a', position: { x: 10, y: 0, z: 0 }, lastProcessedInputSeq: 0 }],
                    ['ship-b', { shipId: 'ship-b', position: { x: 40, y: 0, z: -10 }, lastProcessedInputSeq: 0 }]
                ])
            },
            reconnection: { enabled: false, minUptime: 1000, maxRetries: 3, minDelay: 1000, maxDelay: 5000 },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onMessage: vi.fn(),
            onDrop: vi.fn(),
            onReconnect: vi.fn(),
            onLeave: vi.fn()
        }
        stubAvailableRuntimeModuleFetch()
        colyseusMocks.joinOrCreate.mockResolvedValueOnce(room)

        renderWidget({}, { permissions: { editContent: false } })

        const canvas = await screen.findByTestId('playcanvas-canvas')
        await waitFor(() => expect(canvas.getAttribute('data-realtime-status')).toBe('connected'))
        await waitFor(() => expect(canvas).toHaveAttribute('data-observed-ship-assigned', 'true'))
        act(() => {
            playcanvasMocks.updateHandler?.(0.016)
        })
        expect(canvas).toHaveAttribute('data-ship-count', '2')
        expect(canvas).toHaveAttribute('data-remote-ship-count', '1')
        expect(canvas).toHaveAttribute('data-ship-x', '10.00')
        expect(canvas).toHaveAttribute('data-remote-ship-x', '40.00')
        expect(screen.getByTestId('playcanvas-participants-status')).toHaveTextContent('Ships: 2 (view only)')
        expect(screen.getByRole('button', { name: 'Move to target' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()
    })
})
