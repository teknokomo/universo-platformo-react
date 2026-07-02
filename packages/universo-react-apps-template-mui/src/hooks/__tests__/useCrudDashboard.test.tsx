import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import type { CrudDataAdapter } from '../../api/types'
import type { AppDataResponse } from '../../api/api'
import { useCrudDashboard, type CrudDashboardState, type UseCrudDashboardOptions } from '../useCrudDashboard'

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

function renderCrudDashboard(adapter: CrudDataAdapter, options: Partial<Omit<UseCrudDashboardOptions, 'adapter' | 'locale'>> = {}) {
    const queryClient = createTestQueryClient()
    let latestState: CrudDashboardState | undefined
    let currentOptions = options

    function Probe() {
        latestState = useCrudDashboard({
            adapter,
            locale: 'en',
            ...currentOptions
        })
        return null
    }

    const rendered = render(
        <QueryClientProvider client={queryClient}>
            <Probe />
        </QueryClientProvider>
    )

    return {
        queryClient,
        rerender: (nextOptions: Partial<Omit<UseCrudDashboardOptions, 'adapter' | 'locale'>>) => {
            currentOptions = nextOptions
            rendered.rerender(
                <QueryClientProvider client={queryClient}>
                    <Probe />
                </QueryClientProvider>
            )
        },
        getState: () => {
            if (!latestState) {
                throw new Error('Crud dashboard state is not ready yet')
            }
            return latestState
        }
    }
}

describe('useCrudDashboard optimistic mutations', () => {
    it('gives the route section precedence over a stale object collection query parameter', async () => {
        const previousUrl = window.location.href
        window.history.replaceState({}, '', '/a/app-1/route-section?objectCollectionId=stale-section')
        const fetchList = vi.fn().mockResolvedValue(createAppData())
        const adapter = createAdapter({ fetchList })

        try {
            renderCrudDashboard(adapter, { initialSectionId: 'route-section' })

            await waitFor(() => {
                expect(fetchList).toHaveBeenCalled()
            })
            expect(fetchList.mock.calls[0]?.[0]).toEqual(
                expect.objectContaining({
                    sectionId: 'route-section',
                    objectCollectionId: undefined
                })
            )
        } finally {
            window.history.replaceState({}, '', previousUrl)
        }
    })

    it('applies create-target defaults only to safe writable create fields', async () => {
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                columns: [
                    {
                        id: 'col-resource-type',
                        codename: 'ResourceType',
                        field: 'cmp_resource_type',
                        dataType: 'REF',
                        headerName: 'Resource Type',
                        isRequired: true,
                        validationRules: {},
                        refTargetEntityKind: 'enumeration',
                        enumOptions: [
                            { id: 'enum-invalid', label: 'Invalid', codename: { localized: 'Url' } as unknown as string },
                            { id: 'enum-page', label: 'Page', codename: 'Page' },
                            { id: 'enum-url', label: 'URL', codename: 'Url' }
                        ],
                        uiConfig: {}
                    },
                    {
                        id: 'col-source',
                        codename: 'Source',
                        field: 'cmp_source',
                        dataType: 'JSON',
                        headerName: 'Source',
                        isRequired: true,
                        validationRules: {},
                        uiConfig: { widget: 'resourceSource' }
                    },
                    {
                        id: 'col-title',
                        codename: 'Title',
                        field: 'Title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'col-navigation-mode',
                        codename: 'NavigationMode',
                        field: 'NavigationMode',
                        dataType: 'STRING',
                        headerName: 'Navigation Mode',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: { widget: 'select' }
                    },
                    {
                        id: 'col-completion-condition',
                        codename: 'CompletionCondition',
                        field: 'CompletionCondition',
                        dataType: 'STRING',
                        headerName: 'Completion Condition',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: { widget: 'select' }
                    },
                    {
                        id: 'col-status-format',
                        codename: 'StatusFormat',
                        field: 'StatusFormat',
                        dataType: 'STRING',
                        headerName: 'Status Format',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: { widget: 'select' }
                    },
                    {
                        id: 'col-created-by',
                        codename: 'CreatedBy',
                        field: 'CreatedBy',
                        dataType: 'STRING',
                        headerName: 'Created By',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'col-hidden',
                        codename: 'HiddenNotes',
                        field: 'HiddenNotes',
                        dataType: 'STRING',
                        headerName: 'Hidden Notes',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: { hidden: true }
                    },
                    {
                        id: 'col-lifecycle-state',
                        codename: 'LifecycleState',
                        field: 'LifecycleState',
                        dataType: 'STRING',
                        headerName: 'Lifecycle State',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    }
                ]
            })
        })
        const { getState } = renderCrudDashboard(adapter, {
            createDefaultContext: {
                learningContent: {
                    courseCompletionPolicy: {
                        navigationMode: 'sequential',
                        completionCondition: 'selectedItems',
                        statusFormat: 'passedFailed',
                        unsafeObject: { value: 'ignored' }
                    }
                }
            }
        })

        await waitFor(() => expect(getState().isLoading).toBe(false))

        act(() => {
            getState().handleOpenCreate([
                { fieldCodename: 'ResourceType', enumCodename: 'Url' },
                { fieldCodename: 'Source', resourceSourceType: 'url' },
                { fieldCodename: 'Title', value: 'New link' },
                { fieldCodename: 'NavigationMode', contextPath: 'learningContent.courseCompletionPolicy.navigationMode' },
                { fieldCodename: 'CompletionCondition', contextPath: 'learningContent.courseCompletionPolicy.completionCondition' },
                { fieldCodename: 'StatusFormat', contextPath: 'learningContent.courseCompletionPolicy.statusFormat' },
                { fieldCodename: 'Title', contextPath: 'learningContent.courseCompletionPolicy.unsafeObject' },
                { fieldCodename: 'Title', contextPath: 'learningContent.courseCompletionPolicy.missing' },
                { fieldCodename: 'CreatedBy', value: 'attacker' },
                { fieldCodename: 'workspace_id', value: 'workspace-2' },
                { fieldCodename: 'ProgressPercent', value: 100 },
                { fieldCodename: 'LifecycleState', value: 'approved' },
                { fieldCodename: '_upl_created_by', value: 'attacker' },
                { fieldCodename: 'HiddenNotes', value: 'hidden' }
            ])
        })

        expect(getState().formInitialData).toEqual({
            cmp_resource_type: 'enum-url',
            cmp_source: { type: 'url', url: '' },
            Title: 'New link',
            NavigationMode: 'sequential',
            CompletionCondition: 'selectedItems',
            StatusFormat: 'passedFailed'
        })

        act(() => {
            getState().handleCloseForm()
        })

        expect(getState().formInitialData).toBeUndefined()
    })

    it('suppresses stale fallback section data while resolving the menu start section', async () => {
        const accessLinksSection = createRuntimeSection('access-links', 'Access Links')
        const welcomeSection = {
            id: 'welcome-page',
            codename: 'welcome-page',
            tableName: null,
            name: 'Welcome',
            pageBlocks: []
        }
        const secondList = createDeferred<AppDataResponse>()
        const fetchList = vi
            .fn()
            .mockResolvedValueOnce({
                ...createAppData(),
                section: accessLinksSection,
                objectCollection: accessLinksSection,
                sections: [accessLinksSection, welcomeSection],
                objectCollections: [accessLinksSection],
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
                rows: [{ id: 'access-row-1', slug: 'demo-content' }],
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
                                objectCollectionId: null,
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
                objectCollectionId: undefined,
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
                objectCollection: accessLinksSection,
                sections: [accessLinksSection, welcomeSection],
                objectCollections: [accessLinksSection],
                activeSectionId: 'welcome-page',
                activeObjectCollectionId: undefined,
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
                                objectCollectionId: null,
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
            expect(getState().selectedObjectCollectionId).toBeUndefined()
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

    it('passes page-backed menu sections as sectionId without objectCollectionId', async () => {
        const fetchList = vi.fn().mockImplementation(async ({ sectionId, objectCollectionId }) => ({
            ...createAppData(),
            section: createRuntimeSection(sectionId === 'page-intro' ? 'page-intro' : 'object-1', 'Current'),
            objectCollection: createRuntimeSection('object-1', 'Products'),
            sections: [createRuntimeSection('page-intro', 'Intro'), createRuntimeSection('object-1', 'Products')],
            objectCollections: [createRuntimeSection('object-1', 'Products')],
            activeSectionId: sectionId ?? 'object-1',
            activeObjectCollectionId: objectCollectionId ?? 'object-1',
            menus: [
                {
                    id: 'menu-1',
                    widgetId: 'menu-widget',
                    title: 'Menu',
                    showTitle: false,
                    startSectionId: 'page-intro',
                    overflowLabelKey: 'runtime.menu.more',
                    items: [
                        {
                            id: 'intro',
                            title: 'Intro',
                            icon: null,
                            kind: 'section',
                            sectionId: 'page-intro',
                            objectCollectionId: null,
                            isActive: true
                        },
                        {
                            id: 'structures',
                            title: 'Structures',
                            icon: null,
                            kind: 'section',
                            sectionId: 'object-1',
                            objectCollectionId: 'object-1',
                            isActive: true
                        }
                    ],
                    overflowItems: []
                }
            ],
            activeMenuId: 'menu-1'
        }))
        const adapter = createAdapter({ fetchList })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().menuSlot).toBeDefined()
        })

        await act(async () => {
            getState().menuSlot?.onSelectObjectCollection?.('object-1')
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    sectionId: 'object-1',
                    objectCollectionId: 'object-1'
                })
            )
        })

        await act(async () => {
            getState().menuSlot?.onSelectSection?.('page-intro')
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    sectionId: 'page-intro',
                    objectCollectionId: undefined
                })
            )
        })
    })

    it('does not carry the previous object collection target into page-backed sections', async () => {
        const fetchRow = vi.fn().mockResolvedValue({ id: 'row-1', title: 'Intro row' })
        const fetchList = vi.fn().mockImplementation(async ({ sectionId, objectCollectionId }) => {
            const activeId = sectionId ?? objectCollectionId ?? 'object-1'
            const introPage = {
                id: 'page-intro',
                codename: 'intro',
                tableName: null,
                name: 'Intro',
                pageBlocks: []
            }
            return {
                ...createAppData(),
                section: activeId === 'page-intro' ? introPage : createRuntimeSection('object-1', 'Products'),
                objectCollection: createRuntimeSection('object-1', 'Products'),
                sections: [createRuntimeSection('object-1', 'Products'), introPage],
                objectCollections: [createRuntimeSection('object-1', 'Products')],
                activeSectionId: activeId,
                activeObjectCollectionId: objectCollectionId,
                menus: [
                    {
                        id: 'menu-1',
                        widgetId: 'widget-1',
                        showTitle: false,
                        title: null,
                        items: [
                            {
                                id: 'object-item',
                                kind: 'section',
                                title: 'Products',
                                sectionId: 'object-1',
                                objectCollectionId: 'object-1',
                                isActive: true
                            },
                            {
                                id: 'page-item',
                                kind: 'section',
                                title: 'Intro',
                                sectionId: 'page-intro',
                                objectCollectionId: 'page-intro',
                                isActive: true
                            }
                        ],
                        overflowItems: []
                    }
                ],
                activeMenuId: 'menu-1'
            } satisfies AppDataResponse
        })
        const adapter = createAdapter({ fetchList, fetchRow })
        const { getState } = renderCrudDashboard(adapter, { initialSectionId: 'object-1' })

        await waitFor(() => {
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            getState().menuSlot?.onSelectSection?.('page-intro')
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(expect.objectContaining({ sectionId: 'page-intro', objectCollectionId: undefined }))
        })
        await waitFor(() => {
            expect(getState().activeSectionId).toBe('page-intro')
            expect(getState().activeObjectCollectionId).toBeUndefined()
            expect(getState().selectedObjectCollectionId).toBeUndefined()
        })
        fetchRow.mockClear()

        await act(async () => {
            getState().handleOpenEdit('row-1')
        })

        await waitFor(() => {
            expect(fetchRow).toHaveBeenCalledWith('row-1', { sectionId: 'page-intro', objectCollectionId: undefined })
        })
    })

    it('retargets list and mutations when the route section changes while mounted', async () => {
        const secondarySection = createRuntimeSection('object-2', 'Services')
        const fetchList = vi.fn().mockImplementation(async ({ sectionId, objectCollectionId }) => {
            const activeId = sectionId ?? objectCollectionId ?? 'object-1'

            return {
                ...createAppData(),
                section: activeId === 'object-2' ? secondarySection : createRuntimeSection('object-1', 'Products'),
                objectCollection: activeId === 'object-2' ? secondarySection : createRuntimeSection('object-1', 'Products'),
                sections: [createRuntimeSection('object-1', 'Products'), secondarySection],
                objectCollections: [createRuntimeSection('object-1', 'Products'), secondarySection],
                activeSectionId: activeId,
                activeObjectCollectionId: objectCollectionId ?? activeId,
                rows: [{ id: activeId === 'object-2' ? 'row-2' : 'row-1', name: activeId }]
            } satisfies AppDataResponse
        })
        const createRow = vi.fn().mockResolvedValue({ id: 'created-row', name: 'Created' })
        const updateRow = vi.fn().mockResolvedValue({ id: 'row-2', name: 'Updated' })
        const deleteRow = vi.fn().mockResolvedValue(undefined)
        const copyRow = vi.fn().mockResolvedValue({ id: 'copied-row', name: 'Copied' })
        const adapter = createAdapter({ fetchList, createRow, updateRow, deleteRow, copyRow })
        const { getState, rerender } = renderCrudDashboard(adapter, { initialSectionId: 'object-1' })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(expect.objectContaining({ sectionId: 'object-1', objectCollectionId: 'object-1' }))
        })

        await act(async () => {
            rerender({ initialSectionId: 'object-2' })
        })

        await waitFor(() => {
            expect(fetchList).toHaveBeenLastCalledWith(expect.objectContaining({ sectionId: 'object-2', objectCollectionId: 'object-2' }))
        })
        expect(getState().selectedSectionId).toBe('object-2')
        expect(getState().selectedObjectCollectionId).toBe('object-2')

        await act(async () => {
            getState().handleOpenCreate()
        })
        await act(async () => {
            await getState().handleFormSubmit({ name: 'Created' })
        })
        expect(createRow).toHaveBeenCalledWith({ name: 'Created' }, { objectCollectionId: 'object-2', sectionId: 'object-2' })

        await act(async () => {
            getState().handleOpenCopy('row-2')
        })
        await act(async () => {
            await getState().handleFormSubmit({ name: 'Copied' })
        })
        expect(copyRow).toHaveBeenCalledWith(
            'row-2',
            expect.objectContaining({ objectCollectionId: 'object-2', sectionId: 'object-2', data: { name: 'Copied' } })
        )

        await act(async () => {
            getState().handleOpenEdit('row-2')
        })
        await act(async () => {
            await getState().handleFormSubmit({ name: 'Updated' })
        })
        expect(updateRow).toHaveBeenCalledWith(
            'row-2',
            { name: 'Updated' },
            { objectCollectionId: 'object-2', sectionId: 'object-2' },
            undefined
        )

        await act(async () => {
            getState().handleOpenDelete('row-2')
        })
        await act(async () => {
            await getState().handleConfirmDelete()
        })
        expect(deleteRow).toHaveBeenCalledWith('row-2', { objectCollectionId: 'object-2', sectionId: 'object-2' }, undefined)
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
        const deferredCopy = createDeferred<Record<string, unknown>>()
        const copyRow = vi.fn().mockImplementation(() => deferredCopy.promise)
        const adapter = createAdapter({
            copyRow
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

        expect(copyRow).toHaveBeenCalledWith('row-1', {
            objectCollectionId: 'object-1',
            sectionId: 'object-1',
            copyChildTables: true,
            data: { name: 'Copied optimistic' },
            expectedVersion: undefined
        })
        expect(getState().formOpen).toBe(false)
        expect(getState().copyRowId).toBe('row-1')

        await waitFor(() => {
            const pendingRow = getState().rows[0] as unknown as { name: string; __pendingAction?: string; __pending?: boolean }
            expect(pendingRow.name).toBe('Copied optimistic')
            expect(pendingRow.__pending).toBe(true)
            expect(pendingRow.__pendingAction).toBe('copy')
        })

        deferredCopy.resolve({ id: 'row-3', name: 'Copied optimistic' })
        await act(async () => {
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(getState().formOpen).toBe(false)
            expect(getState().copyRowId).toBe(null)
        })
    })

    it('passes runtime row version and copy overrides to copy mutations', async () => {
        const copyRow = vi.fn().mockResolvedValue({ id: 'row-3', name: 'Copied optimistic' })
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                rows: [{ id: 'row-1', name: 'Original', _upl_version: 9 }]
            } satisfies AppDataResponse),
            copyRow
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenCopy('row-1')
        })
        await act(async () => {
            await getState().handleFormSubmit({ name: 'Copied optimistic' })
        })

        expect(copyRow).toHaveBeenCalledWith('row-1', {
            objectCollectionId: 'object-1',
            sectionId: 'object-1',
            copyChildTables: true,
            data: { name: 'Copied optimistic' },
            expectedVersion: 9
        })
    })

    it('passes runtime row version to update mutations', async () => {
        const updateRow = vi.fn().mockResolvedValue({ id: 'row-1', name: 'Updated' })
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                rows: [{ id: 'row-1', name: 'Original', _upl_version: 6 }]
            } satisfies AppDataResponse),
            updateRow
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenEdit('row-1')
        })
        await act(async () => {
            await getState().handleFormSubmit({ name: 'Updated' })
        })

        expect(updateRow).toHaveBeenCalledWith('row-1', { name: 'Updated' }, { objectCollectionId: 'object-1', sectionId: 'object-1' }, 6)
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

    it('passes runtime row version to delete mutations when the row exposes optimistic metadata', async () => {
        const deleteRow = vi.fn().mockResolvedValue(undefined)
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                rows: [{ id: 'row-1', name: 'Original', _upl_version: 7 }]
            } satisfies AppDataResponse),
            deleteRow
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(1)
        })

        await act(async () => {
            getState().handleOpenDelete('row-1')
        })
        await act(async () => {
            await getState().handleConfirmDelete()
        })

        expect(deleteRow).toHaveBeenCalledWith('row-1', { objectCollectionId: 'object-1', sectionId: 'object-1' }, 7)
    })

    it('passes runtime row version maps to reorder mutations', async () => {
        const reorderRows = vi.fn().mockResolvedValue(undefined)
        const adapter = createAdapter({
            fetchList: vi.fn().mockResolvedValue({
                ...createAppData(),
                rows: [
                    { id: 'row-1', name: 'Original', _upl_version: 7 },
                    { id: 'row-2', name: 'Next', _upl_version: 8 }
                ]
            } satisfies AppDataResponse),
            reorderRows
        })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().rows).toHaveLength(2)
        })

        await act(async () => {
            await getState().handlePersistRowReorder(['row-2', 'row-1'])
        })

        expect(reorderRows).toHaveBeenCalledWith({
            objectCollectionId: 'object-1',
            sectionId: 'object-1',
            orderedRowIds: ['row-2', 'row-1'],
            expectedVersionsByRowId: {
                'row-2': 8,
                'row-1': 7
            }
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
            expect(getState().formError).toBe('Create failed: Please try again or reload the page.')
            expect(getState().formError).not.toContain('backend exploded')
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
            expect(getState().deleteError).toBe('Delete failed: Please try again or reload the page.')
            expect(getState().deleteError).not.toContain('delete exploded')
        })
    })

    it('reveals deferred feedback and blocks unsafe interaction with pending copy rows', async () => {
        const deferredCopy = createDeferred<Record<string, unknown>>()
        const adapter = createAdapter({
            copyRow: vi.fn().mockImplementation(() => deferredCopy.promise)
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
            rows: [{ id: 'row-1', name: 'Original', _app_record_state: 'draft', _upl_version: 4 }]
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
            sectionId: 'object-1',
            expectedVersion: 4
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

    it('sanitizes technical record lifecycle command errors before showing snackbars', async () => {
        const recordCommand = vi
            .fn()
            .mockRejectedValue(new Error('duplicate key value violates unique constraint "app_rows_019e44fc-a16a-760c-8190-280c4d9dc720"'))
        const adapter = createAdapter({ recordCommand })
        const { getState } = renderCrudDashboard(adapter)

        await waitFor(() => {
            expect(getState().handleRecordCommand).toBeDefined()
            expect(getState().selectedObjectCollectionId).toBe('object-1')
        })

        await act(async () => {
            await getState().handleRecordCommand?.('row-1', 'post')
        })

        expect(enqueueSnackbar).toHaveBeenCalledWith('Record command failed: Please try again or reload the page.', { variant: 'error' })
    })
})
