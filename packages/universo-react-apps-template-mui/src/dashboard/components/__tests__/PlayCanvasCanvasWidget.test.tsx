import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayCanvasCanvasWidget from '../PlayCanvasCanvasWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const playcanvasMocks = vi.hoisted(() => ({
    createBasicApplication: vi.fn(),
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
        t: (_key: string, fallback?: string) => fallback ?? _key,
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

        setFromDirections() {
            return this
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
                        return new Vec3((screenX - 300) * 0.01 * perspective, (300 - screenY) * 0.01 * perspective, -clip * 0.01)
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

        getPosition() {
            return this.position
        }

        setRotation(rotation: Quat) {
            this.rotation = rotation
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

    return {
        Color,
        Entity,
        Quat,
        Vec3,
        createBasicApplication: playcanvasMocks.createBasicApplication,
        createBoxEntity: ({ name, position }: { name: string; position: { x: number; y: number; z: number } }) => {
            const entity = new Entity(name)
            entity.setPosition(position.x, position.y, position.z)
            return entity
        },
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
    createMoveToObjectIntent: (objectId: string) => ({ kind: 'move_to_object', objectId }),
    createMoveToPointIntent: (target: unknown) => ({ kind: 'move_to_point', target }),
    createStopIntent: () => ({ kind: 'stop' }),
    lerpVector3: (_from: unknown, to: unknown) => to
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderWidget = (config: Record<string, unknown> = {}) =>
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
                        columns: []
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
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
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

    it('uses a long 3D ray target for double-click movement and turns the ship toward it', async () => {
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
        expect(Math.hypot(target.x, target.y, target.z)).toBeGreaterThan(700)
        expect(Math.abs(target.y)).toBeGreaterThan(100)
        expect(canvas).toHaveAttribute('data-ship-turning', 'true')
        expect(Math.abs(Number(canvas.getAttribute('data-ship-forward-y')))).toBeGreaterThan(0.005)
        expect(Math.abs(Number(canvas.getAttribute('data-ship-forward-y')))).toBeLessThan(0.2)

        act(() => {
            playcanvasMocks.updateHandler?.(1)
        })

        expect(Math.abs(Number(canvas.getAttribute('data-ship-forward-y')))).toBeGreaterThan(0.1)
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

    it('shows a localized disconnected state when realtime authentication fails', async () => {
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

        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('disconnected'))
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

    it('shows restored and failed reconnect states after room leave events', async () => {
        let firstLeaveHandler: (() => void) | null = null
        const firstRoom = {
            state: { ship: { position: { x: 0, y: 0, z: 0 } } },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onLeave: vi.fn((handler: () => void) => {
                firstLeaveHandler = handler
            })
        }
        const restoredRoom = {
            state: { ship: { position: { x: 1, y: 0, z: 0 } } },
            send: vi.fn(),
            leave: vi.fn(),
            onStateChange: vi.fn(),
            onLeave: vi.fn()
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
        colyseusMocks.joinOrCreate
            .mockResolvedValueOnce(firstRoom)
            .mockResolvedValueOnce(restoredRoom)
            .mockRejectedValueOnce({ status: 503 })

        renderWidget()
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('connected'))
        act(() => {
            firstLeaveHandler?.()
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('reconnecting'))
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('restored'), { timeout: 2000 })

        act(() => {
            restoredRoom.onLeave.mock.calls[0]?.[0]()
        })
        await waitFor(() => expect(screen.getByTestId('playcanvas-realtime-status')).toHaveTextContent('failed_reconnect'), {
            timeout: 2000
        })
    })
})
