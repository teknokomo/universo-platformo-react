import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEnqueueSnackbar = vi.fn()
const mockGetInstance = vi.fn()
const mockUpdateInstance = vi.fn()
const mockListInstances = vi.fn()
const mockListProjects = vi.fn()
const mockCreateProject = vi.fn()
const mockPublishProject = vi.fn()
const mockRemoveProject = vi.fn()
const mockWindowOpen = vi.fn()

// Drives the shared `usePlayCanvasEditorHostQuery` hook return. The real
// `resolveEditorDisplayMode` + `openPlayCanvasEditor` helpers run against this,
// so the tests exercise the shared editor-host module end to end.
let editorHostData: unknown = undefined

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string | Record<string, unknown>) => (typeof defaultValue === 'string' ? defaultValue : key),
        i18n: { language: 'en' }
    }),
    initReactI18next: { type: '3rdParty', init: () => undefined },
    Trans: ({ children }: { children?: React.ReactNode }) => children ?? null
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar })
}))

vi.mock('../../../packages/api', async () => {
    const actual = await vi.importActual<typeof import('../../../packages/api')>('../../../packages/api')
    return {
        ...actual,
        playcanvasProjectsApi: {
            list: (...args: unknown[]) => mockListProjects(...args),
            create: (...args: unknown[]) => mockCreateProject(...args),
            publish: (...args: unknown[]) => mockPublishProject(...args),
            remove: (...args: unknown[]) => mockRemoveProject(...args)
        },
        // Override only the data-fetching hook; keep the real
        // `resolveEditorDisplayMode` / `openPlayCanvasEditor` helpers.
        usePlayCanvasEditorHostQuery: () => ({ data: editorHostData })
    }
})

vi.mock('../../api/entityInstances', () => ({
    getEntityInstance: (...args: unknown[]) => mockGetInstance(...args),
    updateEntityInstance: (...args: unknown[]) => mockUpdateInstance(...args),
    listEntityInstances: (...args: unknown[]) => mockListInstances(...args)
}))

import { ProjectBindingSurface } from '../ProjectBindingSurface'

const vlc = (value: string) => ({ _schema: '1', _primary: 'en', locales: { en: { content: value } } })

const boundProject = {
    id: '0190aaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    codename: vlc('mmoomm_world'),
    displayName: vlc('MMOOMM World'),
    description: null,
    compatibilityStatus: 'compatible' as const,
    status: 'ready' as const,
    sceneCount: 2,
    assetCount: 5,
    scriptCount: 3,
    generatedArtifactCount: 1,
    publishable: true,
    version: 1
}

// The surface is always rendered as the "PlayCanvas" tab of the entity form
// dialog: ids come from props (the dialog route is the instances list and has
// no :entityId). A fresh QueryClient is returned so tests can assert cache
// invalidation.
const renderPage = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
    const utils = render(
        <QueryClientProvider client={client}>
            <ProjectBindingSurface metahubId='mh-1' entityId='inst-1' />
        </QueryClientProvider>
    )
    return { ...utils, client, invalidateSpy }
}

const renderEmbedded = renderPage

describe('ProjectBindingSurface', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.stubGlobal('open', mockWindowOpen)
        mockUpdateInstance.mockResolvedValue({ data: {} })
        mockListInstances.mockResolvedValue({ items: [], pagination: { total: 0 } })
        editorHostData = undefined
    })

    it('shows the empty state and creates & binds a project', async () => {
        mockGetInstance.mockResolvedValue({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 1 })
        mockListProjects.mockResolvedValue([])
        mockCreateProject.mockResolvedValue(boundProject)

        renderPage()

        expect(await screen.findByText('No PlayCanvas project bound yet')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Create & bind project' }))
        await userEvent.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => expect(mockCreateProject).toHaveBeenCalledWith('mh-1', expect.objectContaining({ description: null })))
        await waitFor(() =>
            expect(mockUpdateInstance).toHaveBeenCalledWith(
                'mh-1',
                'inst-1',
                expect.objectContaining({
                    config: expect.objectContaining({
                        projectBinding: expect.objectContaining({ provider: 'playcanvasEditor', projectCodename: 'mmoomm_world' })
                    })
                })
            )
        )
    })

    it('renders the bound project card without leaking raw UUIDs and opens the editor in openSeparately mode with the bound projectId', async () => {
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: boundProject.id } },
            version: 1
        })
        mockListProjects.mockResolvedValue([boundProject])
        editorHostData = {
            attachmentConfig: { kind: 'display', display: { mode: 'openSeparately' } }
        }

        const { container } = renderPage()

        expect(await screen.findByText('MMOOMM World')).toBeInTheDocument()
        expect(screen.getByText('Ready')).toBeInTheDocument()
        // No raw project UUID rendered on the normal surface.
        expect(container.textContent).not.toContain(boundProject.id)

        await userEvent.click(screen.getByRole('button', { name: 'Open editor' }))
        await waitFor(() =>
            expect(mockWindowOpen).toHaveBeenCalledWith(
                `/metahub/mh-1/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${boundProject.id}`,
                '_blank',
                'noopener,noreferrer'
            )
        )
    })

    it('opens the live PlayCanvas project resolved by codename when the cached binding id is stale after snapshot import', async () => {
        const staleProjectId = '0190ffff-eeee-dddd-cccc-bbbbbbbbbbbb'
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: staleProjectId } },
            version: 1
        })
        mockListProjects.mockResolvedValue([boundProject])
        editorHostData = {
            attachmentConfig: { kind: 'display', display: { mode: 'openSeparately' } }
        }

        renderPage()

        expect(await screen.findByText('MMOOMM World')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Open editor' }))

        await waitFor(() =>
            expect(mockWindowOpen).toHaveBeenCalledWith(
                `/metahub/mh-1/resources/packages/playcanvas-editor/editor/fullscreen?projectId=${boundProject.id}`,
                '_blank',
                'noopener,noreferrer'
            )
        )
        expect(mockWindowOpen).not.toHaveBeenCalledWith(expect.stringContaining(staleProjectId), expect.anything(), expect.anything())
    })

    it('routes the Open editor click to the inline route in embeddedIframe mode (no popup)', async () => {
        const originalLocation = window.location
        // jsdom does not allow reassigning `window.location` directly; stub
        // the assign method so we can assert it without leaving jsdom.
        const mockAssign = vi.fn()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, assign: mockAssign }
        })
        try {
            mockGetInstance.mockResolvedValue({
                id: 'inst-1',
                kind: 'project',
                codename: vlc('World'),
                config: {
                    projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: boundProject.id }
                },
                version: 1
            })
            mockListProjects.mockResolvedValue([boundProject])
            editorHostData = {
                attachmentConfig: { kind: 'display', display: { mode: 'embeddedIframe' } }
            }

            renderPage()
            await screen.findByText('MMOOMM World')
            await userEvent.click(screen.getByRole('button', { name: 'Open editor' }))
            expect(mockWindowOpen).not.toHaveBeenCalled()
            expect(mockAssign).toHaveBeenCalledWith(
                `/metahub/mh-1/resources/packages/playcanvas-editor/editor?projectId=${boundProject.id}`
            )
        } finally {
            Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        }
    })

    it('publishes the bound project runtime', async () => {
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: boundProject.id } },
            version: 1
        })
        mockListProjects.mockResolvedValue([boundProject])
        mockPublishProject.mockResolvedValue([{ id: 'manifest-1' }])

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Publish runtime' }))
        await waitFor(() => expect(mockPublishProject).toHaveBeenCalledWith('mh-1', boundProject.id))
    })

    it('unbinds the project by sending an explicit null binding so the shallow-merge clears it', async () => {
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: {
                sortOrder: 7,
                projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: boundProject.id }
            },
            version: 3
        })
        mockListProjects.mockResolvedValue([boundProject])

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Unbind' }))
        const dialog = await screen.findByRole('dialog')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Unbind' }))

        // Regression guard: the PATCH endpoint shallow-merges `config`, so simply
        // omitting `projectBinding` would leave the old binding in place. We must
        // send `projectBinding: null` (the documented clear signal) while keeping
        // unrelated config (sortOrder) untouched.
        await waitFor(() =>
            expect(mockUpdateInstance).toHaveBeenCalledWith('mh-1', 'inst-1', {
                config: { sortOrder: 7, projectBinding: null },
                expectedVersion: 3
            })
        )
    })

    it('renders the "project no longer available" warning when the binding points to a missing project', async () => {
        // The instance config still carries the binding, but the project
        // list returns no matching row. This is the "the PlayCanvas project
        // was deleted out from under us" branch and must offer an Unbind
        // escape hatch, not an Open editor one.
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: {
                projectBinding: {
                    provider: 'playcanvasEditor',
                    projectCodename: 'vanished_project',
                    projectId: '01900000-0000-0000-0000-000000000000'
                }
            },
            version: 2
        })
        mockListProjects.mockResolvedValue([])

        renderPage()

        expect(await screen.findByText('The bound PlayCanvas project is no longer available.')).toBeInTheDocument()
        // Only Unbind is offered in the warning state — no Open editor / Publish.
        expect(screen.queryByRole('button', { name: 'Open editor' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Publish runtime' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Unbind' })).toBeInTheDocument()
    })

    it('shows a localized error snackbar when create-and-bind fails', async () => {
        mockGetInstance.mockResolvedValue({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 1 })
        mockListProjects.mockResolvedValue([])
        mockCreateProject.mockRejectedValue(new Error('boom'))

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Create & bind project' }))
        await userEvent.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() =>
            expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
                'Failed to create and bind the PlayCanvas project',
                expect.objectContaining({ variant: 'error' })
            )
        )
    })

    it('rolls back the orphan PlayCanvas project when writeBinding fails after create', async () => {
        mockGetInstance.mockResolvedValue({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 1 })
        mockListProjects.mockResolvedValue([])
        const orphanProject = { ...boundProject, id: '0190bbbb-cccc-dddd-eeee-ffffffffffff', version: 7 }
        mockCreateProject.mockResolvedValue(orphanProject)
        mockUpdateInstance.mockRejectedValue(new Error('writeBinding failed'))
        mockRemoveProject.mockResolvedValue(undefined)

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Create & bind project' }))
        await userEvent.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => expect(mockRemoveProject).toHaveBeenCalledWith('mh-1', orphanProject.id, orphanProject.version))
    })

    it('localizes the empty-state and bound card copy through the consolidated metahubs i18n namespace (ru + en)', async () => {
        // Use the real i18next-backed namespace consolidation so this test
        // catches the bug where `projects.*` keys were dropped from the
        // consolidated resource (Phase 1 fix). Loading both locales also
        // ensures the consolidation preserves top-level key groups.
        const { getMetahubsTranslations } = await import('../../../../i18n')

        const ru = getMetahubsTranslations('ru') as {
            projects?: { binding?: { title?: string; resourceTabTitle?: string; actions?: { openEditor?: string } } }
        }
        const en = getMetahubsTranslations('en') as {
            projects?: { binding?: { title?: string; resourceTabTitle?: string; actions?: { openEditor?: string } } }
        }

        expect(ru.projects?.binding?.title).toBe('Проект PlayCanvas')
        expect(ru.projects?.binding?.resourceTabTitle).toBe('PlayCanvas')
        expect(ru.projects?.binding?.actions?.openEditor).toBe('Открыть редактор')
        expect(en.projects?.binding?.title).toBe('PlayCanvas project')
        expect(en.projects?.binding?.resourceTabTitle).toBe('PlayCanvas')
        expect(en.projects?.binding?.actions?.openEditor).toBe('Open editor')
    })

    it('shows a loading state and hides mutation actions until data settles in the embedded tab', async () => {
        // The instance request never resolves during this test: the embedded
        // surface must show the loading state and expose NO Create/Unbind
        // actions (which would otherwise write config from an empty object or
        // clear a still-loading valid binding).
        let resolveInstance: ((value: unknown) => void) | undefined
        mockGetInstance.mockReturnValue(
            new Promise((resolve) => {
                resolveInstance = resolve
            })
        )
        mockListProjects.mockResolvedValue([])

        renderEmbedded()

        expect(await screen.findByText('Loading PlayCanvas project binding...')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create & bind project' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Unbind' })).not.toBeInTheDocument()

        // Settle so the deferred query does not leak into other tests.
        resolveInstance?.({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 1 })
        await waitFor(() => expect(screen.getByRole('button', { name: 'Create & bind project' })).toBeInTheDocument())
    })

    it('invalidates the shared entity-detail and entities caches after unbinding from the embedded tab', async () => {
        mockGetInstance.mockResolvedValue({
            id: 'inst-1',
            kind: 'project',
            codename: vlc('World'),
            config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'mmoomm_world', projectId: boundProject.id } },
            version: 3
        })
        mockListProjects.mockResolvedValue([boundProject])

        const { invalidateSpy } = renderEmbedded()

        await userEvent.click(await screen.findByRole('button', { name: 'Unbind' }))
        const dialog = await screen.findByRole('dialog')
        await userEvent.click(within(dialog).getByRole('button', { name: 'Unbind' }))

        await waitFor(() => expect(mockUpdateInstance).toHaveBeenCalled())
        // Canonical entity caches (not a private key) are invalidated so the
        // surrounding list/edit surfaces drop stale config/version data.
        await waitFor(() => {
            const keys = invalidateSpy.mock.calls.map((call) => JSON.stringify(call[0]?.queryKey))
            // entities(metahubId, kind) prefix — refreshes every list variant.
            expect(keys.some((key) => key?.includes('"entities"') && key.includes('"project"'))).toBe(true)
            // entityDetail(metahubId, entityId).
            expect(keys.some((key) => key?.includes('"entity"') && key.includes('"inst-1"'))).toBe(true)
        })
    })

    it('binds an existing PlayCanvas project from the picker, writing its codename + id into config', async () => {
        mockGetInstance.mockResolvedValue({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 4 })
        const existingProject = { ...boundProject, id: '0190cccc-dddd-eeee-ffff-000000000000', codename: vlc('existing_world') }
        mockListProjects.mockResolvedValue([existingProject])

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Bind existing project' }))
        const dialog = await screen.findByRole('dialog', { name: 'Bind existing PlayCanvas project' })
        // Pick the existing project from the autocomplete.
        await userEvent.click(within(dialog).getByRole('combobox'))
        await userEvent.click(await screen.findByRole('option', { name: /MMOOMM World/ }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Bind' }))

        await waitFor(() =>
            expect(mockUpdateInstance).toHaveBeenCalledWith(
                'mh-1',
                'inst-1',
                expect.objectContaining({
                    config: expect.objectContaining({
                        projectBinding: expect.objectContaining({
                            provider: 'playcanvasEditor',
                            projectCodename: 'existing_world',
                            projectId: existingProject.id
                        })
                    }),
                    expectedVersion: 4
                })
            )
        )
    })

    it('filters the bind-existing picker to unbound projects by default and reveals bound ones when toggled off', async () => {
        mockGetInstance.mockResolvedValue({ id: 'inst-1', kind: 'project', codename: vlc('World'), config: {}, version: 1 })
        const unbound = { ...boundProject, id: '0190aaaa-0000-0000-0000-000000000001', codename: vlc('free_project') }
        const taken = { ...boundProject, id: '0190aaaa-0000-0000-0000-000000000002', codename: vlc('taken_project') }
        mockListProjects.mockResolvedValue([unbound, taken])
        // Another Projects instance already binds `taken_project`.
        mockListInstances.mockResolvedValue({
            items: [
                {
                    id: 'inst-2',
                    kind: 'project',
                    config: { projectBinding: { provider: 'playcanvasEditor', projectCodename: 'taken_project', projectId: taken.id } }
                }
            ],
            pagination: { total: 1 }
        })

        renderPage()

        await userEvent.click(await screen.findByRole('button', { name: 'Bind existing project' }))
        const dialog = await screen.findByRole('dialog', { name: 'Bind existing PlayCanvas project' })
        await userEvent.click(within(dialog).getByRole('combobox'))

        // Unbound-only (default): the already-bound project's codename is hidden.
        await waitFor(() => expect(screen.getByText('free_project')).toBeInTheDocument())
        expect(screen.queryByText('taken_project')).not.toBeInTheDocument()
        await userEvent.keyboard('{Escape}')

        // Toggle the filter off → the bound project appears (with the "Already bound" badge).
        await userEvent.click(screen.getByLabelText('Show only unbound projects'))
        await userEvent.click(within(dialog).getByRole('combobox'))
        await waitFor(() => expect(screen.getByText('taken_project')).toBeInTheDocument())
        expect(screen.getByText('Already bound')).toBeInTheDocument()
    })
})
