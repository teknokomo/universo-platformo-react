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
        t: (_key: string, options?: { defaultValue?: string; message?: string }) => {
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
            id: 'catalog-1',
            codename: 'products',
            tableName: 'products',
            name: 'Products'
        },
        catalog: {
            id: 'catalog-1',
            codename: 'products',
            tableName: 'products',
            name: 'Products'
        },
        sections: [
            {
                id: 'catalog-1',
                codename: 'products',
                tableName: 'products',
                name: 'Products'
            }
        ],
        catalogs: [
            {
                id: 'catalog-1',
                codename: 'products',
                tableName: 'products',
                name: 'Products'
            }
        ],
        activeSectionId: 'catalog-1',
        activeCatalogId: 'catalog-1',
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
    it('exposes section aliases and section-aware menu items while keeping catalog compatibility', async () => {
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
                                kind: 'catalog',
                                title: 'Products',
                                catalogId: 'catalog-1',
                                sectionId: 'catalog-1',
                                isActive: true
                            }
                        ]
                    }
                ],
                activeMenuId: 'menu-1'
            })
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().activeSectionId).toBe('catalog-1')
            expect(getState().selectedSectionId).toBe('catalog-1')
        })

        expect(getState().dashboardMenuItems[0]).toMatchObject({
            kind: 'section',
            sectionId: 'catalog-1',
            catalogId: 'catalog-1',
            selected: true
        })
        expect(getState().menuSlot).toMatchObject({
            activeSectionId: 'catalog-1',
            activeCatalogId: 'catalog-1'
        })
    })

    it('adds a pending create row immediately and closes the form right away', async () => {
        const deferredCreate = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            createRow: vi.fn().mockImplementation(() => deferredCreate.promise)
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().selectedCatalogId).toBe('catalog-1')
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
            expect(getState().selectedCatalogId).toBe('catalog-1')
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
})
