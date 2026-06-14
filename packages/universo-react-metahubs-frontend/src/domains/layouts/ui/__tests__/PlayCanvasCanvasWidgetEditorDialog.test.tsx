import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PlayCanvasCanvasWidgetEditorDialog from '../PlayCanvasCanvasWidgetEditorDialog'

const mocks = vi.hoisted(() => ({
    listModules: vi.fn(),
    listPublishedRuntimeManifests: vi.fn(),
    listAttachedPackages: vi.fn(),
    fetchAllPaginatedItems: vi.fn(),
    listEntityTypes: vi.fn(),
    listEntityInstances: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()

    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string, params?: Record<string, unknown>) => {
                if (!fallback) return _key
                return Object.entries(params ?? {}).reduce(
                    (value, [key, replacement]) => value.replace(`{{${key}}}`, String(replacement)),
                    fallback
                )
            },
            i18n: { language: 'en' }
        })
    }
})

vi.mock('../../../modules/api/modulesApi', () => ({
    modulesApi: {
        list: mocks.listModules
    }
}))

vi.mock('../../../packages/api', () => ({
    packagesApi: {
        listAttached: mocks.listAttachedPackages
    },
    playcanvasProjectsApi: {
        listPublishedRuntimeManifests: mocks.listPublishedRuntimeManifests
    }
}))

vi.mock('../../../shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../shared')>()
    return {
        ...actual,
        fetchAllPaginatedItems: mocks.fetchAllPaginatedItems
    }
})

vi.mock('../../../entities/api/entityTypes', () => ({
    listEntityTypes: mocks.listEntityTypes
}))

vi.mock('../../../entities/api/entityInstances', () => ({
    listEntityInstances: mocks.listEntityInstances
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

const vlc = (content: string) => ({
    _schema: 'v1',
    _primary: 'en',
    locales: {
        en: { content }
    }
})

const createModuleRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'module-1',
    version: 1,
    codename: vlc('flight-canvas-widget'),
    presentation: {
        name: vlc('Flight Canvas Widget'),
        description: vlc('Browser-side MMOOMM canvas')
    },
    attachedToKind: 'metahub',
    attachedToId: null,
    moduleRole: 'widget',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    manifest: {
        className: 'FlightCanvasWidget',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['rpc.client'],
        methods: [{ name: 'mount', target: 'client' }]
    },
    checksum: 'checksum-1',
    isActive: true,
    ...overrides
})

const renderDialog = (props: Partial<ComponentProps<typeof PlayCanvasCanvasWidgetEditorDialog>> = {}) => {
    const queryClient = createQueryClient()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
        <QueryClientProvider client={queryClient}>
            <PlayCanvasCanvasWidgetEditorDialog open metahubId='metahub-1' onSave={onSave} onCancel={onCancel} {...props} />
        </QueryClientProvider>
    )

    return { onSave, onCancel }
}

describe('PlayCanvasCanvasWidgetEditorDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.listModules.mockResolvedValue([
            createModuleRecord(),
            createModuleRecord({
                id: 'module-2',
                codename: vlc('fixed-tick-flight-runtime'),
                presentation: {
                    name: vlc('Fixed Tick Flight Runtime'),
                    description: vlc('Server-authoritative MMOOMM simulation')
                },
                moduleRole: 'module',
                manifest: {
                    className: 'FixedTickFlightRuntime',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'module',
                    sourceKind: 'embedded',
                    capabilities: ['metadata.read'],
                    methods: [{ name: 'tick', target: 'server' }]
                }
            })
        ])
        mocks.listPublishedRuntimeManifests.mockResolvedValue([
            {
                projectId: '019e8afa-0000-7000-8000-000000000001',
                sceneId: '019e8afa-0000-7000-8000-000000000002',
                checksum: 'a'.repeat(64),
                publishedAt: '2026-06-10T10:00:00.000Z',
                runtimeManifest: {
                    schemaVersion: '1',
                    projectId: '019e8afa-0000-7000-8000-000000000001',
                    sceneId: '019e8afa-0000-7000-8000-000000000002',
                    checksum: 'a'.repeat(64),
                    assets: [],
                    scripts: [],
                    metadata: {
                        projectName: 'MMOOMM Authoring',
                        sceneName: 'Flight Arena'
                    }
                }
            },
            {
                projectId: '019e8afa-0000-7000-8000-000000000099',
                sceneId: '019e8afa-0000-7000-8000-000000000098',
                checksum: 'b'.repeat(64),
                runtimeManifest: {
                    schemaVersion: '1',
                    projectId: '019e8afa-0000-7000-8000-000000000099',
                    sceneId: '019e8afa-0000-7000-8000-000000000098',
                    checksum: 'b'.repeat(64),
                    assets: [],
                    scripts: [],
                    metadata: { sceneName: 'Unserialized Scene' }
                }
            }
        ])
        mocks.listAttachedPackages.mockResolvedValue([
            {
                id: 'package-attachment-1',
                metahubId: 'metahub-1',
                packageId: 'package-1',
                packageName: '@universo-react/playcanvas-editor-frontend',
                version: '0.1.0',
                displayName: vlc('PlayCanvas Editor'),
                source: { kind: 'workspace', packageName: '@universo-react/playcanvas-editor-frontend' },
                authoringSurface: {
                    schemaVersion: '1',
                    kind: 'none',
                    supportedDisplayModes: [],
                    defaultConfig: { schemaVersion: '1', kind: 'none' }
                },
                config: {
                    schemaVersion: '1',
                    kind: 'display',
                    display: { mode: 'embeddedIframe', showArtifactOnlyNotice: false },
                    playcanvasProject: { defaultProjectId: '019e8afa-0000-7000-8000-000000000001' }
                },
                attachedAt: '2026-06-10T10:00:00.000Z',
                isActive: true
            }
        ])
        mocks.fetchAllPaginatedItems.mockImplementation(async (fetchPage: (params: Record<string, unknown>) => Promise<unknown>) =>
            fetchPage({})
        )
        mocks.listEntityTypes.mockResolvedValue({
            items: [
                {
                    kindKey: 'object',
                    codename: vlc('Object'),
                    ui: {},
                    capabilities: { layoutConfig: { enabled: true } }
                }
            ],
            pagination: { hasMore: false }
        })
        mocks.listEntityInstances.mockResolvedValue({
            items: [
                {
                    id: 'section-space-id',
                    kind: 'object',
                    codename: vlc('FlightWorld'),
                    name: vlc('Space'),
                    sortOrder: 1
                }
            ],
            pagination: { hasMore: false }
        })
    })

    it('uses user-facing selectors while keeping internal identifiers out of visible labels', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog()

        await waitFor(() => {
            expect(mocks.listModules).toHaveBeenCalledWith('metahub-1')
        })

        expect(screen.queryByLabelText(/codename/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/019e8afa/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/aaaaaaaaaaaa/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('combobox', { name: 'Client module' }))
        await user.click(screen.getByRole('option', { name: 'Flight Canvas Widget' }))

        await user.click(screen.getByRole('combobox', { name: 'Realtime server module' }))
        await user.click(screen.getByRole('option', { name: 'Fixed Tick Flight Runtime' }))

        await user.click(screen.getByRole('combobox', { name: 'Published scene' }))
        expect(screen.queryByRole('option', { name: 'Unserialized Scene' })).not.toBeInTheDocument()
        await user.click(screen.getByRole('option', { name: /Flight Arena · MMOOMM Authoring/ }))

        await user.click(screen.getByRole('combobox', { name: 'Visible in sections' }))
        await user.click(screen.getByRole('option', { name: 'Space · Object' }))
        await user.keyboard('{Escape}')

        const dialog = screen.getByRole('dialog', { name: 'PlayCanvas canvas widget' })
        expect(
            within(dialog).queryByText(/flight-canvas-widget|fixed-tick-flight-runtime|FlightWorld|019e8afa|aaaaaaaaaaaa/i)
        ).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                moduleCodename: 'flight-canvas-widget',
                serverModuleCodename: 'fixed-tick-flight-runtime',
                visibleFor: { sectionIds: ['section-space-id'], sectionCodenames: ['FlightWorld'] },
                runtimeManifest: expect.objectContaining({
                    projectId: '019e8afa-0000-7000-8000-000000000001',
                    sceneId: '019e8afa-0000-7000-8000-000000000002',
                    checksum: 'a'.repeat(64)
                })
            })
        )
    })

    it('shows a localized validation error instead of silently ignoring invalid saved config', async () => {
        const user = userEvent.setup()
        renderDialog()

        await user.clear(screen.getByLabelText('Minimum height'))
        await user.type(screen.getByLabelText('Minimum height'), '128')

        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(screen.getByText('Check the PlayCanvas canvas widget settings and try again.')).toBeInTheDocument()
    })
})
