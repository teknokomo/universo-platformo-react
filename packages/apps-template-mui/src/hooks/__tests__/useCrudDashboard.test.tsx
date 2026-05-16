import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { CrudDataAdapter } from '../../api/types'
import type { AppDataResponse } from '../../api/api'
import { useCrudDashboard, type CrudDashboardState } from '../useCrudDashboard'

const enqueueSnackbar = vi.fn()

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, options?: string | { defaultValue?: string; message?: string }) => {
            const translations: Record<string, string> = {
                'runtime.menu.more': 'More'
            }
            if (translations[_key]) {
                return translations[_key]
            }
            if (typeof options === 'string') {
                return options
            }
            if (options?.defaultValue && options?.message) {
                return options.defaultValue.replace('{{message}}', options.message)
            }
            return options?.defaultValue ?? options?.message ?? _key
        },
        i18n: { language: 'en' }
    })
}))

beforeEach(() => {
    vi.clearAllMocks()
    enqueueSnackbar.mockReset()
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

function createAppData(): AppDataResponse {
    return {
        section: {
            id: 'object-1',
            codename: 'products',
            tableName: 'products',
            name: 'Products'
        },
        objectCollection: {
            id: 'object-1',
            codename: 'products',
            tableName: 'products',
            name: 'Products'
        },
        sections: [
            {
                id: 'object-1',
                codename: 'products',
                tableName: 'products',
                name: 'Products'
            }
        ],
        objectCollections: [
            {
                id: 'object-1',
                codename: 'products',
                tableName: 'products',
                name: 'Products'
            }
        ],
        activeSectionId: 'object-1',
        activeObjectCollectionId: 'object-1',
        columns: [
            {
                id: 'col-1',
                codename: 'name',
                field: 'name',
                dataType: 'STRING',
                headerName: 'Name',
                isRequired: false,
                validationRules: {},
                uiConfig: {}
            }
        ],
        rows: [{ id: 'row-1', name: 'Original' }],
        pagination: {
            total: 1,
            limit: 20,
            offset: 0
        },
        layoutConfig: {},
        zoneWidgets: {
            left: [],
            right: [],
            center: []
        },
        menus: [],
        activeMenuId: null
    }
}

function createRuntimeSection(id: string, name: string): NonNullable<AppDataResponse['sections']>[number] {
    return {
        id,
        codename: id,
        tableName: id,
        name
    }
}

function createAdapter(overrides: Partial<CrudDataAdapter> = {}): CrudDataAdapter {
    return {
        queryKeyPrefix: ['runtime', 'app-1'],
        fetchList: vi.fn().mockResolvedValue(createAppData()),
        fetchRow: vi.fn().mockImplementation(async (rowId: string) => ({ id: rowId, name: 'Original' })),
        createRow: vi.fn().mockResolvedValue({ id: 'row-2', name: 'Created' }),
        updateRow: vi.fn().mockResolvedValue({ id: 'row-1', name: 'Updated' }),
        deleteRow: vi.fn().mockResolvedValue(undefined),
        copyRow: vi.fn().mockResolvedValue({ id: 'row-3', name: 'Copied' }),
        ...overrides
    }
}

function renderCrudDashboard(adapter: CrudDataAdapter) {
    const queryClient = createTestQueryClient()
    let latestState: CrudDashboardState | undefined

    function Probe() {
        latestState = useCrudDashboard({
            adapter,
            locale: 'en'
        })
        return null
    }

    render(
        <QueryClientProvider client={queryClient}>
            <Probe />
        </QueryClientProvider>
    )

    return {
        queryClient,
        getState: () => {
            if (!latestState) {
                throw new Error('Crud dashboard state is not ready yet')
            }
            return latestState
        }
    }
}

describe('useCrudDashboard optimistic mutations', () => {
    it('suppresses stale fallback section data while resolving the menu start section', async () => {
        const accessLinksSection = createRuntimeSection('access-links', 'Access Links')
        const welcomeSection = createRuntimeSection('welcome-page', 'Welcome')
        const secondList = createDeferred<AppDataResponse>()
        const fetchList = vi
            .fn()
            .mockResolvedValueOnce({
                ...createAppData(),
                section: accessLinksSection,
                objectCollection: accessLinksSection,
                sections: [accessLinksSection, welcomeSection],
                objectCollections: [accessLinksSection, welcomeSection],
                activeSectionId: 'access-links',
                activeObjectCollectionId: 'access-links',
                columns: [
                    {
                        id: 'access-slug',
                        codename: 'slug',
                        field: 'slug',
                        dataType: 'STRING',
                        headerName: 'Slug',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    }
                ],
                rows: [{ id: 'access-row-1', slug: 'demo-module' }],
                pagination: { total: 1, limit: 20, offset: 0 },
                menus: [
                    {
                        id: 'menu-1',
                        widgetId: 'runtime-menu',
                        showTitle: false,
                        title: 'Main',
                        startSectionId: 'welcome-page',
                        items: [
                            {
                                id: 'home',
                                kind: 'section',
                                title: 'Home',
                                objectCollectionId: 'welcome-page',
                                sectionId: 'welcome-page',
                                isActive: true
                            },
                            {
                                id: 'access',
                                kind: 'section',
                                title: 'Access Links',
                                objectCollectionId: 'access-links',
                                sectionId: 'access-links',
                                isActive: true
                            }
                        ],
                        overflowItems: []
                    }
                ],
                activeMenuId: 'menu-1'
            } satisfies AppDataResponse)
            .mockImplementationOnce(() => secondList.promise)

        const adapter = createAdapter({ fetchList })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(fetchList).toHaveBeenCalledTimes(2)
        })

        expect(fetchList).toHaveBeenLastCalledWith(
            expect.objectContaining({
                objectCollectionId: 'welcome-page',
                sectionId: 'welcome-page'
            })
        )
        expect(getState().isLoading).toBe(true)
        expect(getState().appData).toBeUndefined()
        expect(getState().rows).toEqual([])

        await act(async () => {
            secondList.resolve({
                ...createAppData(),
                section: welcomeSection,
                objectCollection: welcomeSection,
                sections: [accessLinksSection, welcomeSection],
                objectCollections: [accessLinksSection, welcomeSection],
                activeSectionId: 'welcome-page',
                activeObjectCollectionId: 'welcome-page',
                columns: [],
                rows: [],
                pagination: { total: 0, limit: 20, offset: 0 },
                menus: [
                    {
                        id: 'menu-1',
                        widgetId: 'runtime-menu',
                        showTitle: false,
                        title: 'Main',
                        startSectionId: 'welcome-page',
                        items: [
                            {
                                id: 'home',
                                kind: 'section',
                                title: 'Home',
                                objectCollectionId: 'welcome-page',
                                sectionId: 'welcome-page',
                                isActive: true
                            }
                        ],
                        overflowItems: []
                    }
                ],
                activeMenuId: 'menu-1'
            })
        })

        await waitFor(() => {
            expect(getState().isLoading).toBe(false)
            expect(getState().appData?.activeSectionId).toBe('welcome-page')
            expect(getState().selectedObjectCollectionId).toBe('welcome-page')
        })
    })

    it('exposes section aliases and section-aware menu items', async () => {
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                menus: [
                    {
                        id: 'menu-1',
                        widgetId: 'widget-1',
                        showTitle: true,
                        title: 'Sections',
                        items: [
                            {
                                id: 'item-1',
                                kind: 'section',
                                title: 'Products',
                                objectCollectionId: 'object-1',
                                sectionId: 'object-1',
                                isActive: true
                            }
                        ],
                        overflowItems: [
                            {
                                id: 'item-2',
                                kind: 'link',
                                title: 'Knowledge',
                                href: '/knowledge',
                                isActive: true
                            }
                        ],
                        overflowLabelKey: 'runtime.menu.more'
                    }
                ],
                activeMenuId: 'menu-1'
            })
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().activeSectionId).toBe('object-1')
            expect(getState().selectedSectionId).toBe('object-1')
        })

        expect(getState().dashboardMenuItems[0]).toMatchObject({
            kind: 'section',
            sectionId: 'object-1',
            objectCollectionId: 'object-1',
            selected: true
        })
        expect(getState().menuSlot).toMatchObject({
            activeSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            overflowLabel: 'More',
            overflowItems: [expect.objectContaining({ id: 'item-2', kind: 'link', href: '/knowledge' })]
        })
    })

    it('passes generic server list query models to the adapter', async () => {
        const fetchList = vi.fn().mockResolvedValue(createAppData())
        const adapter = createAdapter({ fetchList })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            getState().setSearchValue('Alpha')
            getState().setSortModel([{ field: 'score', sort: 'desc' }])
            getState().setFilterModel({
                items: [{ id: 1, field: 'name', operator: 'contains', value: 'Alpha' }]
            })
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    objectCollectionId: 'object-1',
                    sectionId: 'object-1',
                    search: 'Alpha',
                    sort: [{ field: 'score', direction: 'desc' }],
                    filters: [{ field: 'name', operator: 'contains', value: 'Alpha' }],
                    offset: 0
                })
            )
        })
    })

    it('resets section-scoped sort and filters when switching runtime sections', async () => {
        const secondarySection = createRuntimeSection('object-2', 'Lessons')
        const fetchList = vi.fn().mockImplementation(async ({ objectCollectionId }: { objectCollectionId?: string }) => ({
            ...createAppData(),
            section: objectCollectionId === 'object-2' ? secondarySection : createRuntimeSection('object-1', 'Products'),
            objectCollection: objectCollectionId === 'object-2' ? secondarySection : createRuntimeSection('object-1', 'Products'),
            sections: [createRuntimeSection('object-1', 'Products'), secondarySection],
            objectCollections: [createRuntimeSection('object-1', 'Products'), secondarySection],
            activeSectionId: objectCollectionId ?? 'object-1',
            activeObjectCollectionId: objectCollectionId ?? 'object-1'
        }))
        const adapter = createAdapter({ fetchList })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            getState().setSortModel([{ field: 'CompletedAt', sort: 'desc' }])
            getState().setFilterModel({
                items: [{ id: 1, field: 'SubmittedAt', operator: 'isNotEmpty' }]
            })
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    objectCollectionId: 'object-1',
                    sort: [{ field: 'CompletedAt', direction: 'desc' }],
                    filters: [{ field: 'SubmittedAt', operator: 'isNotEmpty' }]
                })
            )
        })

        await act(async () => {
            getState().onSelectObjectCollection('object-2')
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    objectCollectionId: 'object-2',
                    sectionId: 'object-2',
                    sort: [],
                    filters: [],
                    offset: 0
                })
            )
        })
        expect(getState().sortModel).toEqual([])
        expect(getState().filterModel).toEqual({ items: [] })
    })

    it('omits row action columns when runtime permissions make the section read-only', async () => {
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false
                }
            })
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().appData).toBeDefined()
        })

        expect(getState().columns.map((column) => column.field)).toEqual(['name'])
    })

    it('adds a pending create row immediately and closes the form right away', async () => {
        const deferredCreate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            createRow: vi.fn().mockImplementation(() => deferredCreate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            getState().handleOpenCreate()
        })
        await act(async () => {
            void getState().handleFormSubmit({ name: 'Created optimistic' })
            await Promise.resolve()
        })

        expect(getState().formOpen).toBe(false)

        await waitFor(() => {
            const pendingRow = getState().rows[0] as { id: string; name: string; __pendingAction?: string; __pending?: boolean }
            expect(pendingRow.name).toBe('Created optimistic')
            expect(pendingRow.__pending).toBe(true)
            expect(pendingRow.__pendingAction).toBe('create')
        })

        deferredCreate.resolve({ id: 'row-2', name: 'Created optimistic' })
        await act(async () => {
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(getState().formOpen).toBe(false)
        })
    })

    it('marks copied rows with the copy pending action and closes the form right away', async () => {
        const deferredCreate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            createRow: vi.fn().mockImplementation(() => deferredCreate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenCopy('row-1')
        })
        await waitFor(() => {
            expect(getState().copyRowId).toBe('row-1')
        })
        await act(async () => {
            void getState().handleFormSubmit({ name: 'Copied optimistic' })
            await Promise.resolve()
        })

        expect(getState().formOpen).toBe(false)
        expect(getState().copyRowId).toBe('row-1')

        await waitFor(() => {
            const pendingRow = getState().rows[0] as unknown as { name: string; __pendingAction?: string; __pending?: boolean }
            expect(pendingRow.name).toBe('Copied optimistic')
            expect(pendingRow.__pending).toBe(true)
            expect(pendingRow.__pendingAction).toBe('copy')
        })

        deferredCreate.resolve({ id: 'row-3', name: 'Copied optimistic' })
        await act(async () => {
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(getState().formOpen).toBe(false)
            expect(getState().copyRowId).toBe(null)
        })
    })

    it('marks updated rows as pending before the server responds and closes the form right away', async () => {
        const deferredUpdate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            updateRow: vi.fn().mockImplementation(() => deferredUpdate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenEdit('row-1')
        })
        await waitFor(() => {
            expect(getState().editRowId).toBe('row-1')
        })
        await act(async () => {
            void getState().handleFormSubmit({ name: 'Updated optimistic' })
            await Promise.resolve()
        })

        expect(getState().formOpen).toBe(false)
        expect(getState().editRowId).toBe('row-1')

        await waitFor(() => {
            const updatedRow = getState().rows.find((row) => row.id === 'row-1') as {
                id: string
                name: string
                __pendingAction?: string
                __pending?: boolean
            }
            expect(updatedRow.name).toBe('Updated optimistic')
            expect(updatedRow.__pending).toBe(true)
            expect(updatedRow.__pendingAction).toBe('update')
        })

        deferredUpdate.resolve({ id: 'row-1', name: 'Updated optimistic' })
        await act(async () => {
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(getState().formOpen).toBe(false)
            expect(getState().editRowId).toBe(null)
        })
    })

    it('removes deleted rows before the server responds and closes the delete dialog right away', async () => {
        const deferredDelete = createDeferred<void>()
        const adapter = createAdapter({
            deleteRow: vi.fn().mockImplementation(() => deferredDelete.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenDelete('row-1')
        })
        await waitFor(() => {
            expect(getState().deleteRowId).toBe('row-1')
        })
        await act(async () => {
            void getState().handleConfirmDelete()
            await Promise.resolve()
        })

        expect(getState().deleteRowId).toBe(null)

        await waitFor(() => {
            expect(getState().rows.find((row) => row.id === 'row-1')).toBeUndefined()
        })

        deferredDelete.resolve(undefined)
        await act(async () => {
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(getState().deleteRowId).toBe(null)
        })
    })

    it('reopens the form with an inline error if a background save fails', async () => {
        const deferredCreate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            createRow: vi.fn().mockImplementation(() => deferredCreate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            getState().handleOpenCreate()
        })
        await act(async () => {
            void getState().handleFormSubmit({ name: 'Broken create' })
            await Promise.resolve()
        })

        expect(getState().formOpen).toBe(false)

        deferredCreate.reject(new Error('backend exploded'))
        await act(async () => {
            await Promise.resolve()
        })

        await waitFor(() => {
            expect(getState().formOpen).toBe(true)
            expect(getState().formError).toContain('backend exploded')
        })
    })

    it('reopens the delete dialog with an inline error if a background delete fails', async () => {
        const deferredDelete = createDeferred<void>()
        const adapter = createAdapter({
            deleteRow: vi.fn().mockImplementation(() => deferredDelete.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenDelete('row-1')
        })
        await act(async () => {
            void getState().handleConfirmDelete()
            await Promise.resolve()
        })

        expect(getState().deleteRowId).toBe(null)

        deferredDelete.reject(new Error('delete exploded'))
        await act(async () => {
            await Promise.resolve()
        })

        await waitFor(() => {
            expect(getState().deleteRowId).toBe('row-1')
            expect(getState().deleteError).toContain('delete exploded')
        })
    })

    it('reveals deferred feedback and blocks unsafe interaction with pending copy rows', async () => {
        const deferredCreate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            createRow: vi.fn().mockImplementation(() => deferredCreate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenCopy('row-1')
        })
        await waitFor(() => {
            expect(getState().copyRowId).toBe('row-1')
        })
        await act(async () => {
            void getState().handleFormSubmit({ name: 'Copied optimistic' })
            await Promise.resolve()
        })

        let pendingRowId = ''
        await waitFor(() => {
            const pendingRow = getState().rows[0] as { id: string; __pendingAction?: string; __pendingFeedbackVisible?: boolean }
            pendingRowId = pendingRow.id
            expect(pendingRow.__pendingAction).toBe('copy')
            expect(pendingRow.__pendingFeedbackVisible).toBeUndefined()
        })

        act(() => {
            expect(getState().handlePendingInteractionAttempt(pendingRowId)).toBe(true)
        })

        await waitFor(() => {
            const pendingRow = getState().rows[0] as { __pendingFeedbackVisible?: boolean }
            expect(pendingRow.__pendingFeedbackVisible).toBe(true)
        })

        expect(enqueueSnackbar).toHaveBeenCalledWith('This item is still being created. Please wait a moment and try again.', {
            variant: 'info'
        })
    })

    it('runs record lifecycle commands through the adapter and refreshes runtime data', async () => {
        const fetchList = vi.fn().mockResolvedValue({
            ...createAppData(),
            objectCollection: {
                ...createAppData().objectCollection,
                recordBehavior: {
                    mode: 'transactional',
                    numbering: { enabled: true, scope: 'workspace', periodicity: 'none', minLength: 6 },
                    effectiveDate: { enabled: true, defaultToNow: true },
                    lifecycle: { enabled: true, states: [] },
                    posting: { mode: 'manual', targetLedgers: [] },
                    immutability: 'posted'
                }
            },
            rows: [{ id: 'row-1', name: 'Original', _app_record_state: 'draft' }]
        } satisfies AppDataResponse)
        const recordCommand = vi.fn().mockResolvedValue({ id: 'row-1', status: 'posted' })
        const adapter = createAdapter({ fetchList, recordCommand })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().handleRecordCommand).toBeDefined()
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            await getState().handleRecordCommand?.('row-1', 'post')
        })

        expect(recordCommand).toHaveBeenCalledWith('row-1', 'post', {
            objectCollectionId: 'object-1',
            sectionId: 'object-1'
        })
        expect(enqueueSnackbar).toHaveBeenCalledWith('Record posted.', { variant: 'success' })
        await waitFor(() => {
            expect(fetchList.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
    })

    it('runs metadata workflow actions with optimistic concurrency and refreshes runtime data', async () => {
        const fetchList = vi.fn().mockResolvedValue({
            ...createAppData(),
            objectCollection: {
                ...createAppData().objectCollection,
                workflowActions: [
                    {
                        codename: 'AcceptSubmission',
                        title: 'Accept submission',
                        from: ['submitted'],
                        to: 'accepted',
                        statusColumnName: 'Status',
                        requiredCapabilities: ['assignment.review']
                    }
                ]
            },
            rows: [{ id: 'row-1', name: 'Original', Status: 'submitted', _upl_version: 2 }]
        } satisfies AppDataResponse)
        const workflowAction = vi.fn().mockResolvedValue({ id: 'row-1', Status: 'accepted' })
        const adapter = createAdapter({ fetchList, workflowAction })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().handleWorkflowAction).toBeDefined()
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            await getState().handleWorkflowAction?.('row-1', 'AcceptSubmission')
        })

        expect(workflowAction).toHaveBeenCalledWith('row-1', 'AcceptSubmission', {
            objectCollectionId: 'object-1',
            sectionId: 'object-1',
            expectedVersion: 2
        })
        expect(enqueueSnackbar).toHaveBeenCalledWith('Workflow action completed.', { variant: 'success' })
        await waitFor(() => {
            expect(fetchList.mock.calls.length).toBeGreaterThanOrEqual(2)
        })
    })

    it('blocks workflow actions when the runtime row version is missing', async () => {
        const workflowAction = vi.fn().mockResolvedValue({ id: 'row-1', Status: 'accepted' })
        const adapter = createAdapter({ workflowAction })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().handleWorkflowAction).toBeDefined()
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            await getState().handleWorkflowAction?.('row-1', 'AcceptSubmission')
        })

        expect(workflowAction).not.toHaveBeenCalled()
        expect(enqueueSnackbar).toHaveBeenCalledWith('Workflow action requires a current row version. Please reload and try again.', {
            variant: 'error'
        })
    })

    it('surfaces record lifecycle command errors through the snackbar path', async () => {
        const recordCommand = vi.fn().mockRejectedValue(new Error('posting blocked'))
        const adapter = createAdapter({ recordCommand })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().handleRecordCommand).toBeDefined()
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            await getState().handleRecordCommand?.('row-1', 'post')
        })

        expect(enqueueSnackbar).toHaveBeenCalledWith('Record command failed: posting blocked', { variant: 'error' })
    })
})
