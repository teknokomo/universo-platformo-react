import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInstance as getI18nInstance } from '@universo-react/i18n/instance'
import type { PackageAuthoringHostDescriptor } from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import '../../../../i18n'
import { packagesApi } from '../../api'
import PlayCanvasEditorHostPage from '../PlayCanvasEditorHostPage'

let compactViewport = false

vi.mock('@mui/material', async () => {
    const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material')
    return {
        ...actual,
        useMediaQuery: () => compactViewport
    }
})

vi.mock('../../api', () => ({
    packagesApi: {
        getAuthoringHost: vi.fn(),
        getPlayCanvasEditorCompatibilityConfig: vi.fn(),
        getCsrfToken: vi.fn()
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
    packageName: '@universo-react/playcanvas-editor-frontend',
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

const renderHostPageTree = (queryClient: QueryClient) => (
    <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/metahub/metahub-1/resources/packages/playcanvas-editor/editor']}>
                <Routes>
                    <Route path='/metahub/:metahubId/resources/packages/:packageSlug/editor' element={<PlayCanvasEditorHostPage />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    </I18nextProvider>
)

const renderHostPage = () => {
    const queryClient = createQueryClient()
    return {
        queryClient,
        ...render(renderHostPageTree(queryClient))
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
                settings: '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/settings',
                cloudOnly: '/api/v1/metahub/metahub-1/playcanvas/editor-compatible/projects/019e9146-fd1b-7d1d-a858-d1e96485d901/cloud-only'
            }
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
                'http://localhost:3000'
            )
        )

        fireEvent.load(iframe)
        expect(await screen.findByText('Editor artifact is ready.')).toBeInTheDocument()

        compactViewport = true
        rerender(renderHostPageTree(queryClient))

        expect(screen.getByTestId('playcanvas-editor-frame')).toBeInTheDocument()
        expect(
            screen.getByText('PlayCanvas Editor is available on larger screens. Open it on a desktop or tablet to edit this project.')
        ).toBeInTheDocument()
    })

    it('shows a saved state after the sandboxed artifact clears a dirty scene through compatibility REST', async () => {
        renderHostPage()
        const iframe = await screen.findByTestId('playcanvas-editor-frame')

        act(() => {
            dispatchArtifactMessage(iframe, { type: 'bridge.dirtyState', dirty: true })
        })
        expect(await screen.findByText('The editor reports unsaved changes.')).toBeInTheDocument()

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

        expect(await screen.findByText('The scene changed elsewhere. Reload the latest scene before saving again.')).toBeInTheDocument()
        expect(await screen.findByRole('dialog', { name: 'Save conflict' })).toBeInTheDocument()
    })

    it('replays a pending bootstrap request after compatibility config and CSRF queries resolve', async () => {
        const compatibilityConfig = createDeferred<Awaited<ReturnType<typeof packagesApi.getPlayCanvasEditorCompatibilityConfig>>>()
        const csrfToken = createDeferred<string>()
        vi.mocked(packagesApi.getPlayCanvasEditorCompatibilityConfig).mockReturnValue(compatibilityConfig.promise)
        vi.mocked(packagesApi.getCsrfToken).mockReturnValue(csrfToken.promise)

        renderHostPage()
        const iframe = (await screen.findByTestId('playcanvas-editor-frame')) as HTMLIFrameElement
        const postMessage = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

        dispatchArtifactMessage(iframe, {
            type: 'editor.bootstrap.requestInit',
            bootstrapRequestId: 'bootstrap-before-config'
        })
        expect(postMessage).not.toHaveBeenCalled()

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
            csrfToken.resolve('late-host-csrf-token')
        })

        await waitFor(() =>
            expect(postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'editor.bootstrap.init',
                    bootstrapRequestId: 'bootstrap-before-config',
                    descriptor: expect.objectContaining({
                        compatibilityCsrfToken: {
                            headerName: 'X-CSRF-Token',
                            token: 'late-host-csrf-token'
                        }
                    })
                }),
                expect.any(String)
            )
        )
    })

    it('keeps the bridge bootstrap fallback available when compatibility config loading fails', async () => {
        vi.mocked(packagesApi.getPlayCanvasEditorCompatibilityConfig).mockRejectedValue(new Error('compatibility config unavailable'))

        renderHostPage()
        const iframe = (await screen.findByTestId('playcanvas-editor-frame')) as HTMLIFrameElement
        const postMessage = vi.spyOn(iframe.contentWindow as Window, 'postMessage')

        act(() => {
            dispatchArtifactMessage(iframe, {
                type: 'editor.bootstrap.requestInit',
                bootstrapRequestId: 'bootstrap-after-config-error'
            })
        })

        await waitFor(() =>
            expect(postMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'editor.bootstrap.init',
                    bootstrapRequestId: 'bootstrap-after-config-error',
                    descriptor: expect.objectContaining({
                        compatibilityConfig: null,
                        compatibilityCsrfToken: null
                    })
                }),
                expect.any(String)
            )
        )
        expect(packagesApi.getCsrfToken).not.toHaveBeenCalled()
    })
})
