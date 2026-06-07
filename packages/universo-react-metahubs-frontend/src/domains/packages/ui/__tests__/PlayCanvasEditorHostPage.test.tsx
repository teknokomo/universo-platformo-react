import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import {
    PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    type PackageAuthoringHostDescriptor
} from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import '../../../../i18n'
import { packagesApi } from '../../api'
import PlayCanvasEditorHostPage from '../PlayCanvasEditorHostPage'

let compactViewport = false

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material')
    const React = await vi.importActual<typeof import('react')>('react')
    const Box = React.forwardRef<HTMLElement, Record<string, unknown>>(function MockBox(props, ref) {
        if (props.component === 'iframe') {
            const { component: _component, src, sx: _sx, ...iframeProps } = props
            return React.createElement('iframe', {
                ...iframeProps,
                'data-src': src,
                ref: (node: HTMLElement | null) => {
                    if (node) {
                        Object.defineProperty(node, 'contentWindow', {
                            configurable: true,
                            value: window
                        })
                    }
                    if (typeof ref === 'function') {
                        ref(node)
                    } else if (ref) {
                        ;(ref as { current: HTMLElement | null }).current = node
                    }
                }
            })
        }
        return React.createElement(actual.Box, props)
    })
    return {
        ...actual,
        Box,
        useMediaQuery: () => compactViewport
    }
})

vi.mock('../../api', () => ({
    packagesApi: {
        getAuthoringHost: vi.fn(),
        getPlayCanvasEditorCompatibilityConfig: vi.fn(),
        getCsrfToken: vi.fn()
    },
    playcanvasEditorBridgeApi: {
        sendCommand: vi.fn().mockResolvedValue({ ok: true })
    }
}))

const i18n = getI18nInstance()

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const hostDescriptor = (): PackageAuthoringHostDescriptor => ({
    metahubId: 'metahub-1',
    packageSlug: 'playcanvas-editor',
    packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
    version: '0.1.0',
    displayName: createLocalizedContent('en', 'PlayCanvas Editor'),
    description: createLocalizedContent('en', 'Authoring-only PlayCanvas Editor package.'),
    attachmentConfig: {
        schemaVersion: '1',
        kind: 'display',
        display: {
            mode: 'embeddedIframe',
            developmentUrl: null,
            showArtifactOnlyNotice: true
        },
        playcanvasProject: {
            defaultProjectId: '019e9146-fd1b-7d1d-a858-d1e96485d901'
        }
    },
    authoringSurface: {
        schemaVersion: '1',
        kind: 'playcanvasEditor',
        packageSlug: 'playcanvas-editor',
        supportedDisplayModes: ['embeddedIframe'],
        defaultConfig: {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'embeddedIframe',
                developmentUrl: null,
                showArtifactOnlyNotice: true
            }
        }
    },
    allowedDisplayModes: ['embeddedIframe'],
    artifactStatus: 'available',
    artifactUrl: '/editor-artifact/index.html',
    playcanvasEditor: {
        schemaVersion: '1',
        bridge: {
            sessionId: '019e9147-510a-7527-afb2-732e3ad7eb16',
            nonce: '019e9147510a7527afb2732e3ad7eb16019e9147510a7527afb2732e3ad7eb16',
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            bridgeVersion: '1',
            writeMode: 'manager',
            capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save']
        },
        selectedProject: {
            project: {
                id: '019e9146-fd1b-7d1d-a858-d1e96485d901',
                displayName: createLocalizedContent('en', 'Sandbox Project'),
                codename: createLocalizedContent('en', 'sandbox-project'),
                version: 1,
                defaultSceneId: '019e9147-16c4-738c-ab0f-b98c443ee676',
                compatibilityStatus: 'compatible',
                status: 'ready',
                sceneCount: 1,
                assetCount: 0,
                scriptCount: 0,
                generatedArtifactCount: 0,
                publishable: true
            },
            defaultSceneId: '019e9147-16c4-738c-ab0f-b98c443ee676'
        },
        compatibilityStatus: 'ready'
    }
})

const renderHostPageTree = (queryClient: QueryClient, options: { fullScreen?: boolean } = {}) => (
    <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
            <MemoryRouter
                initialEntries={[
                    options.fullScreen
                        ? '/metahub/metahub-1/resources/packages/playcanvas-editor/editor/fullscreen'
                        : '/metahub/metahub-1/resources/packages/playcanvas-editor/editor'
                ]}
            >
                <Routes>
                    <Route path='/metahub/:metahubId/resources/packages/:packageSlug/editor' element={<PlayCanvasEditorHostPage />} />
                    <Route
                        path='/metahub/:metahubId/resources/packages/:packageSlug/editor/fullscreen'
                        element={<PlayCanvasEditorHostPage fullScreen />}
                    />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    </I18nextProvider>
)

const renderHostPage = (options: { fullScreen?: boolean } = {}) => {
    const queryClient = createQueryClient()
    return {
        queryClient,
        ...render(renderHostPageTree(queryClient, options))
    }
}

const dispatchArtifactMessage = (iframe: HTMLElement, data: Record<string, unknown>) => {
    const event = new MessageEvent('message', {
        data: {
            sessionId: '019e9147-510a-7527-afb2-732e3ad7eb16',
            nonce: '019e9147510a7527afb2732e3ad7eb16019e9147510a7527afb2732e3ad7eb16',
            source: 'universo-playcanvas-editor-artifact',
            ...data
        },
        origin: window.location.origin
    })
    Object.defineProperty(event, 'source', {
        value: (iframe as HTMLIFrameElement).contentWindow
    })
    window.dispatchEvent(event)
}

const createDeferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((nextResolve) => {
        resolve = nextResolve
    })
    return { promise, resolve }
}

describe('PlayCanvasEditorHostPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        compactViewport = false
        vi.mocked(packagesApi.getAuthoringHost).mockResolvedValue(hostDescriptor())
        vi.mocked(packagesApi.getPlayCanvasEditorCompatibilityConfig).mockResolvedValue({
            mode: 'universo-full-upstream-ui',
            accessToken: 'test-full-boot-token-000000000000000000',
            project: {
                id: 101,
                name: 'PlayCanvas Project',
                permissions: { read: [101], write: [101], admin: [] },
                settings: { id: 'project_101' }
            },
            scene: { id: 202, uniqueId: 202 },
            self: { id: 303, username: 'test-user' },
            owner: { id: 404, username: 'owner' },
            branch: { id: 202, name: 'Main' },
            url: {
                api: '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901',
                home: '/',
                frontend: 'http://localhost:3000/editor-artifact/',
                engine: 'http://localhost:3000/editor-artifact/js/playcanvas-engine.js',
                images: '/',
                static: '/',
                store: '/store',
                howdoi: '/jobs',
                realtime: {
                    http: 'ws://localhost:3000/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/realtime'
                },
                messenger: {
                    ws: 'ws://localhost:3000/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/messenger'
                },
                relay: {
                    ws: 'ws://localhost:3000/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/relay?accessToken=test-full-boot-token-000000000000000000'
                }
            },
            schema: { asset: {}, scene: {}, settings: {} },
            engineVersions: {},
            store: {},
            aws: {},
            wasmModules: {},
            sentry: {},
            metrics: {},
            selfHosted: true,
            universoHosted: true,
            universoBridge: null
        } as any)
        vi.mocked(packagesApi.getCsrfToken).mockResolvedValue('test-host-csrf-token')
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true
            })
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('keeps the loaded editor iframe mounted when the viewport becomes compact', async () => {
        const { queryClient, rerender } = renderHostPage()
        const iframe = await screen.findByTestId('playcanvas-editor-frame')
        await waitFor(() =>
            expect(packagesApi.getPlayCanvasEditorCompatibilityConfig).toHaveBeenCalledWith(
                'metahub-1',
                '019e9146-fd1b-7d1d-a858-d1e96485d901',
                'http://localhost:3000',
                'http://localhost:3000/editor-artifact/',
                PLAYCANVAS_EDITOR_FULL_BOOT_MODE
            )
        )

        fireEvent.load(iframe)
        act(() => {
            dispatchArtifactMessage(iframe, { type: 'editor.ready' })
        })
        expect(await screen.findByText('Editor is ready.')).toBeInTheDocument()
        expect(screen.getAllByTestId('playcanvas-editor-host-status-alert')).toHaveLength(1)
        expect(screen.getAllByText('Editor is ready.')).toHaveLength(1)

        compactViewport = true
        rerender(renderHostPageTree(queryClient))

        expect(screen.getByTestId('playcanvas-editor-frame')).toBeInTheDocument()
        expect(
            screen.getByText('PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.')
        ).toBeInTheDocument()
    })

    it('renders a chrome-free fullscreen host surface without changing the artifact iframe boundary', async () => {
        renderHostPage({ fullScreen: true })

        expect(await screen.findByTestId('playcanvas-editor-fullscreen-host')).toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-fullscreen-chrome')).not.toBeInTheDocument()
        const iframe = await screen.findByTestId('playcanvas-editor-frame')
        expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin')
        fireEvent.load(iframe)
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
        expect(screen.queryByRole('dialog', { name: 'Unsaved changes' })).not.toBeInTheDocument()
        expect(screen.queryByText('The editor reports unsaved changes.')).not.toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-host')).not.toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-host-chrome')).not.toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-host-status-alert')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Back to packages' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    })

    it('shows a saved state after the sandboxed artifact clears a dirty scene through compatibility REST', async () => {
        renderHostPage()
        const iframe = await screen.findByTestId('playcanvas-editor-frame')

        act(() => {
            dispatchArtifactMessage(iframe, { type: 'bridge.dirtyState', dirty: true })
        })
        expect(await screen.findByText('Unsaved changes')).toBeInTheDocument()

        act(() => {
            dispatchArtifactMessage(iframe, { type: 'bridge.dirtyState', dirty: false })
        })
        expect(await screen.findByText('Scene saved.')).toBeInTheDocument()
    })

    it('shows a save conflict when the sandboxed artifact reports a compatibility REST conflict', async () => {
        renderHostPage()
        const iframe = await screen.findByTestId('playcanvas-editor-frame')

        act(() => {
            dispatchArtifactMessage(iframe, {
                type: 'bridge.saveError',
                ok: false,
                code: 'saveConflict',
                status: 409
            })
        })

        expect(await screen.findAllByText('The scene changed elsewhere. Reload the latest scene before saving again.')).not.toHaveLength(0)
        expect(await screen.findByRole('dialog', { name: 'Save conflict' })).toBeInTheDocument()
    })

    it('fails closed when the config endpoint returns the legacy REST-minimal mode', async () => {
        const compatibilityConfig = createDeferred<Awaited<ReturnType<typeof packagesApi.getPlayCanvasEditorCompatibilityConfig>>>()
        vi.mocked(packagesApi.getPlayCanvasEditorCompatibilityConfig).mockReturnValue(compatibilityConfig.promise)

        renderHostPage()
        const iframe = (await screen.findByTestId('playcanvas-editor-frame')) as HTMLIFrameElement
        dispatchArtifactMessage(iframe, {
            type: 'editor.bootstrap.requestInit',
            bootstrapRequestId: 'bootstrap-before-config'
        })

        await act(async () => {
            compatibilityConfig.resolve({
                schemaVersion: '1',
                mode: 'universo-compatibility-rest-minimal',
                protocol: {
                    schemaVersion: '1',
                    mode: 'universo-bridge-minimal',
                    capabilities: ['editor.ready', 'protocol.describe', 'project.loadSelected', 'scene.list', 'scene.read', 'scene.save'],
                    endpoints: {
                        bridgeCommands: '/api/v1/metahub/metahub-1/playcanvas/editor-bridge/commands',
                        compatibilityRest:
                            '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901'
                    },
                    limits: {
                        maxSceneJsonBytes: 512000,
                        maxSettingsJsonBytes: 64000
                    },
                    cloudOnly: {
                        jobs: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                        store: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                        publishing: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                        collaboration: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' }
                    }
                },
                projectId: '019e9146-fd1b-7d1d-a858-d1e96485d901',
                defaultSceneId: '019e9147-16c4-738c-ab0f-b98c443ee676',
                userId: 'test-user',
                permissions: { read: true, write: true, admin: false },
                auth: {
                    scheme: 'signed-header',
                    headerName: 'X-PlayCanvas-Editor-Token',
                    accessToken: 'test-compat-token-0000000000000000',
                    expiresAt: new Date(Date.now() + 60_000).toISOString()
                },
                csrf: { tokenUrl: '/api/v1/auth/csrf', headerName: 'X-CSRF-Token' },
                endpoints: {
                    scenes: '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/scenes',
                    assets: '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/assets',
                    settings:
                        '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/settings',
                    cloudOnly:
                        '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/cloud-only'
                }
            } as any)
        })

        expect(await screen.findByText('Failed to prepare PlayCanvas Editor.')).toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-frame')).not.toBeInTheDocument()
    })

    it('fails closed when full-boot compatibility config loading fails', async () => {
        vi.mocked(packagesApi.getPlayCanvasEditorCompatibilityConfig).mockRejectedValue(new Error('compatibility config unavailable'))

        renderHostPage()

        expect(await screen.findByText('Failed to prepare PlayCanvas Editor.')).toBeInTheDocument()
        expect(screen.queryByTestId('playcanvas-editor-frame')).not.toBeInTheDocument()
        expect(packagesApi.getCsrfToken).not.toHaveBeenCalled()
    })
})
