import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
}

function createPromiseController<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })

    return { promise, resolve, reject }
}

function snapshotQueries(queryClient: QueryClient, queryKey: readonly unknown[]) {
    return queryClient.getQueriesData({ queryKey }) as Array<[readonly unknown[], unknown]>
}

function patchListCache(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    updater: (items: Array<Record<string, unknown>>) => Array<Record<string, unknown>>,
    updateTotal = false
) {
    queryClient.setQueriesData({ queryKey }, (old: Record<string, unknown> | undefined) => {
        if (!old || !Array.isArray(old.items)) {
            return old
        }

        const nextItems = updater(old.items as Array<Record<string, unknown>>)

        return {
            ...old,
            items: nextItems,
            pagination:
                updateTotal && old.pagination && typeof old.pagination === 'object'
                    ? {
                          ...(old.pagination as Record<string, unknown>),
                          total: nextItems.length
                      }
                    : old.pagination
        }
    })
}

const mocks = vi.hoisted(() => ({
    enqueueSnackbar: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
    nextId: 1,
    hubsApi: {
        createHub: vi.fn(),
        updateHub: vi.fn(),
        deleteHub: vi.fn(),
        copyHub: vi.fn(),
        reorderHub: vi.fn()
    },
    catalogsApi: {
        createCatalogAtMetahub: vi.fn(),
        updateCatalogAtMetahub: vi.fn(),
        deleteCatalogDirect: vi.fn(),
        copyCatalog: vi.fn(),
        createCatalog: vi.fn(),
        updateCatalog: vi.fn(),
        deleteCatalog: vi.fn(),
        reorderCatalog: vi.fn()
    },
    setsApi: {
        createSetAtMetahub: vi.fn(),
        updateSetAtMetahub: vi.fn(),
        deleteSetDirect: vi.fn(),
        copySet: vi.fn(),
        createSet: vi.fn(),
        updateSet: vi.fn(),
        deleteSet: vi.fn(),
        reorderSet: vi.fn()
    },
    enumerationsApi: {
        createEnumerationAtMetahub: vi.fn(),
        updateEnumerationAtMetahub: vi.fn(),
        deleteEnumerationDirect: vi.fn(),
        copyEnumeration: vi.fn(),
        createEnumeration: vi.fn(),
        updateEnumeration: vi.fn(),
        deleteEnumeration: vi.fn(),
        reorderEnumeration: vi.fn(),
        createEnumerationValue: vi.fn(),
        updateEnumerationValue: vi.fn(),
        deleteEnumerationValue: vi.fn(),
        copyEnumerationValue: vi.fn()
    },
    layoutsApi: {
        createLayout: vi.fn(),
        updateLayout: vi.fn(),
        deleteLayout: vi.fn(),
        copyLayout: vi.fn()
    },
    publicationsApi: {
        createPublication: vi.fn(),
        updatePublication: vi.fn(),
        deletePublication: vi.fn(),
        syncPublication: vi.fn()
    }
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: mocks.t,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    __esModule: true,
    default: {
        resolvedLanguage: 'en',
        language: 'en'
    },
    useCommonTranslations: () => ({ t: mocks.t })
}))

vi.mock('@universo/template-mui', () => ({
    generateOptimisticId: vi.fn(() => `optimistic-${mocks.nextId++}`),
    getCurrentLanguageKey: vi.fn(() => 'en'),
    getNextOptimisticSortOrderFromQueries: vi.fn((queryClient, queryKeyPrefix, startAt = 1) => {
        const queryEntries = queryClient.getQueriesData({ queryKey: queryKeyPrefix }) as Array<
            [readonly unknown[], { items?: Array<{ sortOrder?: number | null }> } | undefined]
        >
        let maxSortOrder = startAt - 1

        for (const [, entry] of queryEntries) {
            if (!entry || !Array.isArray(entry.items)) continue
            for (const item of entry.items) {
                if (typeof item?.sortOrder === 'number' && Number.isFinite(item.sortOrder)) {
                    maxSortOrder = Math.max(maxSortOrder, item.sortOrder)
                }
            }
        }

        return maxSortOrder + 1
    }),
    applyOptimisticCreate: vi.fn(async ({ queryClient, queryKeyPrefix, optimisticEntity, insertPosition = 'prepend', breadcrumb }) => {
        await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
        const previousSnapshots = snapshotQueries(queryClient, queryKeyPrefix)

        patchListCache(
            queryClient,
            queryKeyPrefix,
            (items) =>
                insertPosition === 'append'
                    ? [...items, optimisticEntity as Record<string, unknown>]
                    : [optimisticEntity as Record<string, unknown>, ...items],
            true
        )

        if (breadcrumb) {
            queryClient.setQueryData(breadcrumb.queryKey, breadcrumb.name)
        }

        return {
            previousSnapshots,
            optimisticId: optimisticEntity.id
        }
    }),
    applyOptimisticUpdate: vi.fn(async ({ queryClient, queryKeyPrefix, entityId, updater, detailQueryKey, breadcrumb }) => {
        await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
        const previousSnapshots = snapshotQueries(queryClient, queryKeyPrefix)

        if (detailQueryKey) {
            const detailData = queryClient.getQueryData(detailQueryKey)
            if (detailData !== undefined) {
                previousSnapshots.push([detailQueryKey, detailData])
            }
        }

        patchListCache(queryClient, queryKeyPrefix, (items) =>
            items.map((item) =>
                item.id === entityId
                    ? {
                          ...item,
                          ...updater,
                          __pending: true,
                          __pendingAction: 'update'
                      }
                    : item
            )
        )

        if (detailQueryKey) {
            queryClient.setQueryData(detailQueryKey, (old: Record<string, unknown> | undefined) => {
                if (!old) {
                    return old
                }

                return {
                    ...old,
                    ...updater,
                    __pending: true,
                    __pendingAction: 'update'
                }
            })
        }

        if (breadcrumb) {
            queryClient.setQueryData(breadcrumb.queryKey, breadcrumb.name)
        }

        return { previousSnapshots }
    }),
    applyOptimisticDelete: vi.fn(async ({ queryClient, queryKeyPrefix, entityId, strategy = 'remove' }) => {
        await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
        const previousSnapshots = snapshotQueries(queryClient, queryKeyPrefix)

        if (strategy === 'fade') {
            patchListCache(queryClient, queryKeyPrefix, (items) =>
                items.map((item) =>
                    item.id === entityId
                        ? {
                              ...item,
                              __pending: true,
                              __pendingAction: 'delete'
                          }
                        : item
                )
            )
        } else {
            patchListCache(queryClient, queryKeyPrefix, (items) => items.filter((item) => item.id !== entityId), true)
        }

        return { previousSnapshots }
    }),
    rollbackOptimisticSnapshots: vi.fn((queryClient, snapshots) => {
        if (!Array.isArray(snapshots)) {
            return
        }

        for (const [queryKey, data] of snapshots) {
            queryClient.setQueryData(queryKey, data)
        }
    }),
    cleanupBreadcrumbCache: vi.fn((queryClient, breadcrumbQueryKey) => {
        queryClient.removeQueries({ queryKey: breadcrumbQueryKey, exact: true })
    }),
    safeInvalidateQueries: vi.fn((queryClient, mutationKeyDomain, ...queryKeysToInvalidate) => {
        if (queryClient.isMutating({ mutationKey: mutationKeyDomain }) <= 1) {
            queryKeysToInvalidate.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey })
            })
        }
    }),
    safeInvalidateQueriesInactive: vi.fn((queryClient, mutationKeyDomain, ...queryKeysToInvalidate) => {
        if (queryClient.isMutating({ mutationKey: mutationKeyDomain }) <= 1) {
            queryKeysToInvalidate.forEach((queryKey) => {
                queryClient.invalidateQueries({ queryKey, refetchType: 'inactive' })
            })
        }
    }),
    confirmOptimisticUpdate: vi.fn((queryClient, queryKeyPrefix, entityId) => {
        queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old: Record<string, unknown> | undefined) => {
            if (!old || !Array.isArray(old.items)) {
                return old
            }

            return {
                ...old,
                items: old.items.map((item) =>
                    (item as Record<string, unknown>).id === entityId
                        ? {
                              ...item,
                              __pending: undefined,
                              __pendingAction: undefined,
                              __pendingFeedbackVisible: undefined
                          }
                        : item
                )
            }
        })
    }),
    confirmOptimisticCreate: vi.fn((queryClient, queryKeyPrefix, optimisticId, realId) => {
        queryClient.setQueriesData({ queryKey: queryKeyPrefix }, (old: Record<string, unknown> | undefined) => {
            if (!old || !Array.isArray(old.items)) {
                return old
            }

            return {
                ...old,
                items: old.items.map((item) =>
                    (item as Record<string, unknown>).id === optimisticId
                        ? {
                              ...item,
                              id: realId,
                              __pending: undefined,
                              __pendingAction: undefined,
                              __pendingFeedbackVisible: undefined
                          }
                        : item
                )
            }
        })
    })
}))

vi.mock('../../hubs/api', () => mocks.hubsApi)
vi.mock('../../catalogs/api', () => mocks.catalogsApi)
vi.mock('../../sets/api', () => mocks.setsApi)
vi.mock('../../enumerations/api', () => mocks.enumerationsApi)
vi.mock('../../layouts/api', () => mocks.layoutsApi)
vi.mock('../../publications/api', () => mocks.publicationsApi)

import * as hubHooks from '../../hubs/hooks/mutations'
import * as catalogHooks from '../../catalogs/hooks/mutations'
import * as setHooks from '../../sets/hooks/mutations'
import * as enumerationHooks from '../../enumerations/hooks/mutations'
import * as layoutHooks from '../../layouts/hooks/mutations'
import * as publicationHooks from '../../publications/hooks/mutations'
import { metahubsQueryKeys } from '../queryKeys'

type CreateHubParams = Parameters<ReturnType<typeof hubHooks.useCreateHub>['mutate']>[0]
type UpdateHubParams = Parameters<ReturnType<typeof hubHooks.useUpdateHub>['mutate']>[0]
type CopyHubParams = Parameters<ReturnType<typeof hubHooks.useCopyHub>['mutate']>[0]
type CopyCatalogParams = Parameters<ReturnType<typeof catalogHooks.useCopyCatalog>['mutate']>[0]
type CreateSetParams = Parameters<ReturnType<typeof setHooks.useCreateSetAtMetahub>['mutate']>[0]
type UpdateSetParams = Parameters<ReturnType<typeof setHooks.useUpdateSetAtMetahub>['mutate']>[0]
type CopySetParams = Parameters<ReturnType<typeof setHooks.useCopySet>['mutate']>[0]
type CreateEnumerationParams = Parameters<ReturnType<typeof enumerationHooks.useCreateEnumerationAtMetahub>['mutate']>[0]
type UpdateEnumerationParams = Parameters<ReturnType<typeof enumerationHooks.useUpdateEnumerationAtMetahub>['mutate']>[0]
type CopyEnumerationParams = Parameters<ReturnType<typeof enumerationHooks.useCopyEnumeration>['mutate']>[0]
type CreateEnumerationValueParams = Parameters<ReturnType<typeof enumerationHooks.useCreateEnumerationValue>['mutate']>[0]
type UpdateEnumerationValueParams = Parameters<ReturnType<typeof enumerationHooks.useUpdateEnumerationValue>['mutate']>[0]
type CopyEnumerationValueParams = Parameters<ReturnType<typeof enumerationHooks.useCopyEnumerationValue>['mutate']>[0]
type CreateLayoutParams = Parameters<ReturnType<typeof layoutHooks.useCreateLayout>['mutate']>[0]
type UpdateLayoutParams = Parameters<ReturnType<typeof layoutHooks.useUpdateLayout>['mutate']>[0]
type CopyLayoutParams = Parameters<ReturnType<typeof layoutHooks.useCopyLayout>['mutate']>[0]
type CreatePublicationParams = Parameters<ReturnType<typeof publicationHooks.useCreatePublication>['mutate']>[0]
type UpdatePublicationParams = Parameters<ReturnType<typeof publicationHooks.useUpdatePublication>['mutate']>[0]

describe('remaining metahubs optimistic mutation hooks', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.nextId = 1
    })

    it('applies optimistic create, update, delete, and copy state for hubs', async () => {
        const metahubId = 'metahub-1'
        const listKey = metahubsQueryKeys.hubsList(metahubId)
        const detailKey = metahubsQueryKeys.hubDetail(metahubId, 'hub-1')
        const breadcrumbKey = ['breadcrumb', 'hub', metahubId, 'hub-1', 'en'] as const

        const createHubRequest = createPromiseController<{ data: { id: string } }>()
        const updateHubRequest = createPromiseController<{ data: { id: string } }>()
        const deleteHubRequest = createPromiseController<void>()
        const copyHubRequest = createPromiseController<{ data: { id: string } }>()

        mocks.hubsApi.createHub.mockReturnValue(createHubRequest.promise)
        mocks.hubsApi.updateHub.mockReturnValue(updateHubRequest.promise)
        mocks.hubsApi.deleteHub.mockReturnValue(deleteHubRequest.promise)
        mocks.hubsApi.copyHub.mockReturnValue(copyHubRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'hub-1', codename: 'hub-1', name: { en: 'Hub 1' }, catalogsCount: 1 }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(detailKey, {
            id: 'hub-1',
            codename: 'hub-1',
            name: { en: 'Hub 1' },
            catalogsCount: 1
        })

        let createHub: ReturnType<typeof hubHooks.useCreateHub> | undefined
        let updateHub: ReturnType<typeof hubHooks.useUpdateHub> | undefined
        let deleteHub: ReturnType<typeof hubHooks.useDeleteHub> | undefined
        let copyHub: ReturnType<typeof hubHooks.useCopyHub> | undefined

        function Probe() {
            createHub = hubHooks.useCreateHub()
            updateHub = hubHooks.useUpdateHub()
            deleteHub = hubHooks.useDeleteHub()
            copyHub = hubHooks.useCopyHub()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createHub!.mutate({ metahubId, data: { codename: 'hub-2', name: { en: 'Hub 2' } } } as CreateHubParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const optimisticHub = data?.items.at(0)
            expect(optimisticHub?.codename).toBe('hub-2')
            expect(optimisticHub?.__pendingAction).toBe('create')
            expect(queryClient.getQueryData(['breadcrumb', 'hub', metahubId, 'optimistic-1', 'en'])).toBe('Hub 2')
        })

        createHubRequest.resolve({ data: { id: 'hub-2' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub created', { variant: 'success' })
        })

        act(() => {
            updateHub!.mutate({ metahubId, hubId: 'hub-1', data: { name: { en: 'Hub 1 updated' } } } as UpdateHubParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const updatedHub = data?.items.find((item) => item.id === 'hub-1')
            const detail = queryClient.getQueryData<Record<string, unknown>>(detailKey)

            expect(updatedHub?.name).toEqual({ en: 'Hub 1 updated' })
            expect(updatedHub?.__pendingAction).toBe('update')
            expect(detail?.name).toEqual({ en: 'Hub 1 updated' })
            expect(detail?.__pendingAction).toBe('update')
            expect(queryClient.getQueryData(breadcrumbKey)).toBe('Hub 1 updated')
        })

        updateHubRequest.resolve({ data: { id: 'hub-1' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub updated', { variant: 'success' })
        })

        act(() => {
            deleteHub!.mutate({ metahubId, hubId: 'hub-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const deletedHub = data?.items.find((item) => item.id === 'hub-1')
            expect(deletedHub).toBeUndefined()
        })

        deleteHubRequest.resolve()

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub deleted', { variant: 'success' })
        })

        act(() => {
            copyHub!.mutate({ metahubId, hubId: 'hub-1', data: { codename: 'hub-copy' } } as CopyHubParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const copiedHub = data?.items.at(0)
            expect(copiedHub?.__pendingAction).toBe('copy')
            expect(copiedHub?.name).toEqual({ en: 'Copying…' })
        })

        copyHubRequest.resolve({ data: { id: 'hub-copy' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub copied', { variant: 'success' })
        })
    })

    it('rolls back failed hub create and removes optimistic breadcrumb', async () => {
        const metahubId = 'metahub-rollback'
        const listKey = metahubsQueryKeys.hubsList(metahubId)

        mocks.hubsApi.createHub.mockRejectedValue(new Error('hub create failed'))

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'hub-1', codename: 'hub-1', name: { en: 'Hub 1' } }],
            pagination: { total: 1 }
        })

        let createHub: ReturnType<typeof hubHooks.useCreateHub> | undefined

        function Probe() {
            createHub = hubHooks.useCreateHub()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        await act(async () => {
            await expect(
                createHub!.mutateAsync({ metahubId, data: { codename: 'hub-2', name: { en: 'Hub 2' } } } as CreateHubParams)
            ).rejects.toThrow('hub create failed')
        })

        const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
        expect(data?.items).toHaveLength(1)
        expect(queryClient.getQueryData(['breadcrumb', 'hub', metahubId, 'optimistic-1', 'en'])).toBeUndefined()
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('hub create failed', { variant: 'error' })
    })

    it('applies optimistic state for set mutations at metahub scope', async () => {
        const metahubId = 'metahub-sets'
        const listKey = metahubsQueryKeys.allSetsList(metahubId)
        const hubListKey = metahubsQueryKeys.setsList(metahubId, 'hub-1')

        const createSetRequest = createPromiseController<{ data: { id: string } }>()
        const updateSetRequest = createPromiseController<{ data: { id: string } }>()
        const deleteSetRequest = createPromiseController<void>()
        const copySetRequest = createPromiseController<{ data: { id: string; hubs: Array<{ id: string }> } }>()

        mocks.setsApi.createSetAtMetahub.mockReturnValue(createSetRequest.promise)
        mocks.setsApi.updateSetAtMetahub.mockReturnValue(updateSetRequest.promise)
        mocks.setsApi.deleteSetDirect.mockReturnValue(deleteSetRequest.promise)
        mocks.setsApi.copySet.mockReturnValue(copySetRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'set-1', codename: 'set-1', name: { en: 'Set 1' }, constantsCount: 1, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'set-1', codename: 'set-1', name: { en: 'Set 1' }, constantsCount: 1, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let createSet: ReturnType<typeof setHooks.useCreateSetAtMetahub> | undefined
        let updateSet: ReturnType<typeof setHooks.useUpdateSetAtMetahub> | undefined
        let deleteSet: ReturnType<typeof setHooks.useDeleteSet> | undefined
        let copySet: ReturnType<typeof setHooks.useCopySet> | undefined

        function Probe() {
            createSet = setHooks.useCreateSetAtMetahub()
            updateSet = setHooks.useUpdateSetAtMetahub()
            deleteSet = setHooks.useDeleteSet()
            copySet = setHooks.useCopySet()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createSet!.mutate({ metahubId, data: { codename: 'set-2', name: { en: 'Set 2' }, hubIds: ['hub-1'] } } as CreateSetParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('create')
        })

        createSetRequest.resolve({ data: { id: 'set-2' } })

        act(() => {
            updateSet!.mutate({ metahubId, setId: 'set-1', data: { name: { en: 'Set 1 updated' } } } as UpdateSetParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'set-1')?.__pendingAction).toBe('update')
        })

        updateSetRequest.resolve({ data: { id: 'set-1' } })

        act(() => {
            deleteSet!.mutate({ metahubId, setId: 'set-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'set-1')).toBeUndefined()
        })

        deleteSetRequest.resolve()

        act(() => {
            copySet!.mutate({ metahubId, setId: 'set-1', data: { name: { en: 'Set 1 copy' } } } as CopySetParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            const copiedSet = data?.items.at(0)
            const copiedSetInHub = hubData?.items.at(0)
            expect(copiedSet?.__pendingAction).toBe('copy')
            expect(copiedSet?.codename).toBe('')
            expect(copiedSetInHub?.__pendingAction).toBe('copy')
        })

        copySetRequest.resolve({ data: { id: 'set-copy', hubs: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Set copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('set-copy')
        })
    })

    it('applies optimistic copy state for catalogs in both metahub and hub scopes', async () => {
        const metahubId = 'metahub-catalogs'
        const listKey = metahubsQueryKeys.allCatalogsList(metahubId)
        const hubListKey = metahubsQueryKeys.catalogsList(metahubId, 'hub-1')
        const copyCatalogRequest = createPromiseController<{ data: { id: string; hubs: Array<{ id: string }> } }>()

        mocks.catalogsApi.copyCatalog.mockReturnValue(copyCatalogRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'catalog-1', codename: 'catalog-1', name: { en: 'Catalog 1' }, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'catalog-1', codename: 'catalog-1', name: { en: 'Catalog 1' }, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let copyCatalog: ReturnType<typeof catalogHooks.useCopyCatalog> | undefined

        function Probe() {
            copyCatalog = catalogHooks.useCopyCatalog()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            copyCatalog!.mutate({ metahubId, catalogId: 'catalog-1', data: { name: { en: 'Catalog 1 copy' } } } as CopyCatalogParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            const copiedCatalog = data?.items.at(0)
            const copiedCatalogInHub = hubData?.items.at(0)
            expect(copiedCatalog?.__pendingAction).toBe('copy')
            expect(copiedCatalog?.codename).toBe('')
            expect(copiedCatalogInHub?.__pendingAction).toBe('copy')
            expect(copiedCatalogInHub?.codename).toBe('')
        })

        copyCatalogRequest.resolve({ data: { id: 'catalog-copy', hubs: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Catalog copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('catalog-copy')
        })
    })

    it('applies optimistic state for enumeration mutations at metahub scope', async () => {
        const metahubId = 'metahub-enums'
        const listKey = metahubsQueryKeys.allEnumerationsList(metahubId)
        const hubListKey = metahubsQueryKeys.enumerationsList(metahubId, 'hub-1')

        const createEnumerationRequest = createPromiseController<{ data: { id: string } }>()
        const updateEnumerationRequest = createPromiseController<{ data: { id: string } }>()
        const deleteEnumerationRequest = createPromiseController<void>()
        const copyEnumerationRequest = createPromiseController<{ data: { id: string; hubs: Array<{ id: string }> } }>()

        mocks.enumerationsApi.createEnumerationAtMetahub.mockReturnValue(createEnumerationRequest.promise)
        mocks.enumerationsApi.updateEnumerationAtMetahub.mockReturnValue(updateEnumerationRequest.promise)
        mocks.enumerationsApi.deleteEnumerationDirect.mockReturnValue(deleteEnumerationRequest.promise)
        mocks.enumerationsApi.copyEnumeration.mockReturnValue(copyEnumerationRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'enum-1', codename: 'enum-1', name: { en: 'Enum 1' }, valuesCount: 2, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'enum-1', codename: 'enum-1', name: { en: 'Enum 1' }, valuesCount: 2, hubs: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let createEnumeration: ReturnType<typeof enumerationHooks.useCreateEnumerationAtMetahub> | undefined
        let updateEnumeration: ReturnType<typeof enumerationHooks.useUpdateEnumerationAtMetahub> | undefined
        let deleteEnumeration: ReturnType<typeof enumerationHooks.useDeleteEnumeration> | undefined
        let copyEnumeration: ReturnType<typeof enumerationHooks.useCopyEnumeration> | undefined

        function Probe() {
            createEnumeration = enumerationHooks.useCreateEnumerationAtMetahub()
            updateEnumeration = enumerationHooks.useUpdateEnumerationAtMetahub()
            deleteEnumeration = enumerationHooks.useDeleteEnumeration()
            copyEnumeration = enumerationHooks.useCopyEnumeration()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createEnumeration!.mutate({
                metahubId,
                data: { codename: 'enum-2', name: { en: 'Enum 2' }, hubIds: ['hub-1'] }
            } as CreateEnumerationParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('create')
        })

        createEnumerationRequest.resolve({ data: { id: 'enum-2' } })

        act(() => {
            updateEnumeration!.mutate({
                metahubId,
                enumerationId: 'enum-1',
                data: { name: { en: 'Enum 1 updated' } }
            } as UpdateEnumerationParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'enum-1')?.__pendingAction).toBe('update')
        })

        updateEnumerationRequest.resolve({ data: { id: 'enum-1' } })

        act(() => {
            deleteEnumeration!.mutate({ metahubId, enumerationId: 'enum-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'enum-1')).toBeUndefined()
        })

        deleteEnumerationRequest.resolve()

        act(() => {
            copyEnumeration!.mutate({
                metahubId,
                enumerationId: 'enum-1',
                data: { name: { en: 'Enum 1 copy' } }
            } as CopyEnumerationParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            const copiedEnumeration = data?.items.at(0)
            const copiedEnumerationInHub = hubData?.items.at(0)
            expect(copiedEnumeration?.__pendingAction).toBe('copy')
            expect(copiedEnumeration?.codename).toBe('')
            expect(copiedEnumerationInHub?.__pendingAction).toBe('copy')
            expect(copiedEnumerationInHub?.codename).toBe('')
        })

        copyEnumerationRequest.resolve({ data: { id: 'enum-copy', hubs: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Enumeration copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('enum-copy')
        })
    })

    it('applies optimistic state for enumeration value mutations', async () => {
        const metahubId = 'metahub-enum-values'
        const enumerationId = 'enum-1'
        const listKey = metahubsQueryKeys.enumerationValuesList(metahubId, enumerationId)

        const createValueRequest = createPromiseController<{ data: { id: string } }>()
        const updateValueRequest = createPromiseController<{ data: { id: string } }>()
        const deleteValueRequest = createPromiseController<void>()
        const copyValueRequest = createPromiseController<{ data: { id: string } }>()

        mocks.enumerationsApi.createEnumerationValue.mockReturnValue(createValueRequest.promise)
        mocks.enumerationsApi.updateEnumerationValue.mockReturnValue(updateValueRequest.promise)
        mocks.enumerationsApi.deleteEnumerationValue.mockReturnValue(deleteValueRequest.promise)
        mocks.enumerationsApi.copyEnumerationValue.mockReturnValue(copyValueRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [
                {
                    id: 'value-1',
                    objectId: enumerationId,
                    codename: 'value-1',
                    name: { en: 'Value 1' },
                    description: { en: 'Original' },
                    sortOrder: 1,
                    isDefault: false,
                    version: 1
                }
            ],
            pagination: { total: 1 }
        })

        let createValue: ReturnType<typeof enumerationHooks.useCreateEnumerationValue> | undefined
        let updateValue: ReturnType<typeof enumerationHooks.useUpdateEnumerationValue> | undefined
        let deleteValue: ReturnType<typeof enumerationHooks.useDeleteEnumerationValue> | undefined
        let copyValue: ReturnType<typeof enumerationHooks.useCopyEnumerationValue> | undefined

        function Probe() {
            createValue = enumerationHooks.useCreateEnumerationValue()
            updateValue = enumerationHooks.useUpdateEnumerationValue()
            deleteValue = enumerationHooks.useDeleteEnumerationValue()
            copyValue = enumerationHooks.useCopyEnumerationValue()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createValue!.mutate({
                metahubId,
                enumerationId,
                data: {
                    codename: 'value-2',
                    name: { en: 'Value 2' },
                    description: { en: 'Created' },
                    isDefault: false
                }
            } as CreateEnumerationValueParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const optimisticValue = data?.items.at(0)
            expect(optimisticValue?.codename).toBe('value-2')
            expect(optimisticValue?.__pendingAction).toBe('create')
        })

        createValueRequest.resolve({ data: { id: 'value-2' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Enumeration value created', { variant: 'success' })
        })

        act(() => {
            updateValue!.mutate({
                metahubId,
                enumerationId,
                valueId: 'value-1',
                data: { name: { en: 'Value 1 updated' }, isDefault: true }
            } as UpdateEnumerationValueParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const updatedValue = data?.items.find((item) => item.id === 'value-1')
            expect(updatedValue?.name).toEqual({ en: 'Value 1 updated' })
            expect(updatedValue?.isDefault).toBe(true)
            expect(updatedValue?.__pendingAction).toBe('update')
        })

        updateValueRequest.resolve({ data: { id: 'value-1' } })

        act(() => {
            deleteValue!.mutate({ metahubId, enumerationId, valueId: 'value-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'value-1')).toBeUndefined()
        })

        deleteValueRequest.resolve()

        act(() => {
            copyValue!.mutate({
                metahubId,
                enumerationId,
                valueId: 'value-2',
                data: { name: { en: 'Value 2 copy' }, codename: 'value-2-copy', isDefault: false }
            } as CopyEnumerationValueParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const copiedValue = data?.items.at(0)
            expect(copiedValue?.codename).toBe('value-2-copy')
            expect(copiedValue?.name).toEqual({ en: 'Value 2 copy' })
            expect(copiedValue?.__pendingAction).toBe('copy')
        })

        copyValueRequest.resolve({ data: { id: 'value-2-copy' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Enumeration value copied', { variant: 'success' })
        })
    })

    it('applies optimistic state for layout mutations and updates breadcrumb caches', async () => {
        const metahubId = 'metahub-layouts'
        const listKey = metahubsQueryKeys.layoutsList(metahubId)
        const detailKey = metahubsQueryKeys.layoutDetail(metahubId, 'layout-1')

        const createLayoutRequest = createPromiseController<{ data: { id: string } }>()
        const updateLayoutRequest = createPromiseController<{ data: { id: string } }>()
        const deleteLayoutRequest = createPromiseController<void>()
        const copyLayoutRequest = createPromiseController<{ data: { id: string } }>()

        mocks.layoutsApi.createLayout.mockReturnValue(createLayoutRequest.promise)
        mocks.layoutsApi.updateLayout.mockReturnValue(updateLayoutRequest.promise)
        mocks.layoutsApi.deleteLayout.mockReturnValue(deleteLayoutRequest.promise)
        mocks.layoutsApi.copyLayout.mockReturnValue(copyLayoutRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'layout-1', templateKey: 'dashboard', name: { en: 'Layout 1' }, version: 1 }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(detailKey, {
            id: 'layout-1',
            templateKey: 'dashboard',
            name: { en: 'Layout 1' },
            version: 1
        })

        let createLayout: ReturnType<typeof layoutHooks.useCreateLayout> | undefined
        let updateLayout: ReturnType<typeof layoutHooks.useUpdateLayout> | undefined
        let deleteLayout: ReturnType<typeof layoutHooks.useDeleteLayout> | undefined
        let copyLayout: ReturnType<typeof layoutHooks.useCopyLayout> | undefined

        function Probe() {
            createLayout = layoutHooks.useCreateLayout()
            updateLayout = layoutHooks.useUpdateLayout()
            deleteLayout = layoutHooks.useDeleteLayout()
            copyLayout = layoutHooks.useCopyLayout()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createLayout!.mutate({
                metahubId,
                data: { templateKey: 'dashboard', name: { en: 'Layout 2' } }
            } as CreateLayoutParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('create')
            expect(queryClient.getQueryData(['breadcrumb', 'layout', metahubId, 'optimistic-1', 'en'])).toBe('Layout 2')
        })

        createLayoutRequest.resolve({ data: { id: 'layout-2' } })

        act(() => {
            updateLayout!.mutate({
                metahubId,
                layoutId: 'layout-1',
                data: { name: { en: 'Layout 1 updated' } }
            } as UpdateLayoutParams)
        })

        await waitFor(() => {
            const detail = queryClient.getQueryData<Record<string, unknown>>(detailKey)
            expect(detail?.__pendingAction).toBe('update')
            expect(queryClient.getQueryData(['breadcrumb', 'layout', metahubId, 'layout-1', 'en'])).toBe('Layout 1 updated')
        })

        updateLayoutRequest.resolve({ data: { id: 'layout-1' } })

        act(() => {
            deleteLayout!.mutate({ metahubId, layoutId: 'layout-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'layout-1')).toBeUndefined()
        })

        deleteLayoutRequest.resolve()

        act(() => {
            copyLayout!.mutate({
                metahubId,
                layoutId: 'layout-1',
                data: { name: { en: 'Layout 1 copy' } }
            } as CopyLayoutParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('copy')
            expect(queryClient.getQueryData(['breadcrumb', 'layout', metahubId, 'optimistic-2', 'en'])).toBe('Layout 1 copy')
        })

        copyLayoutRequest.resolve({ data: { id: 'layout-copy' } })
    })

    it('applies optimistic publication state and invalidates application lists for auto-created applications', async () => {
        const metahubId = 'metahub-pubs'
        const listKey = metahubsQueryKeys.publicationsList(metahubId)
        const detailKey = metahubsQueryKeys.publicationDetail(metahubId, 'pub-1')

        const createPublicationRequest = createPromiseController<{ id: string }>()
        const updatePublicationRequest = createPromiseController<{ id: string }>()
        const deletePublicationRequest = createPromiseController<{ success: boolean; message: string }>()

        mocks.publicationsApi.createPublication.mockReturnValue(createPublicationRequest.promise)
        mocks.publicationsApi.updatePublication.mockReturnValue(updatePublicationRequest.promise)
        mocks.publicationsApi.deletePublication.mockReturnValue(deletePublicationRequest.promise)

        const queryClient = createTestQueryClient()
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

        queryClient.setQueryData(listKey, {
            items: [{ id: 'pub-1', name: { en: 'Publication 1' }, schemaStatus: 'ready', autoCreateApplication: false }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(detailKey, {
            id: 'pub-1',
            name: { en: 'Publication 1' },
            schemaStatus: 'ready'
        })

        let createPublication: ReturnType<typeof publicationHooks.useCreatePublication> | undefined
        let updatePublication: ReturnType<typeof publicationHooks.useUpdatePublication> | undefined
        let deletePublication: ReturnType<typeof publicationHooks.useDeletePublication> | undefined

        function Probe() {
            createPublication = publicationHooks.useCreatePublication()
            updatePublication = publicationHooks.useUpdatePublication()
            deletePublication = publicationHooks.useDeletePublication()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createPublication!.mutate({
                metahubId,
                data: { name: { en: 'Publication 2' }, autoCreateApplication: true }
            } as CreatePublicationParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const optimisticPublication = data?.items.at(0)
            expect(optimisticPublication?.schemaStatus).toBe('pending')
            expect(optimisticPublication?.__pendingAction).toBe('create')
        })

        createPublicationRequest.resolve({ id: 'pub-2' })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const createdPublication = data?.items.find((item) => item.id === 'pub-2')
            expect(createdPublication).toBeTruthy()
            expect(createdPublication?.__pending).toBeUndefined()
            expect(createdPublication?.__pendingAction).toBeUndefined()
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['applications', 'list'] })
        })

        act(() => {
            updatePublication!.mutate({
                metahubId,
                publicationId: 'pub-1',
                data: { name: { en: 'Publication 1 updated' } }
            } as UpdatePublicationParams)
        })

        await waitFor(() => {
            const detail = queryClient.getQueryData<Record<string, unknown>>(detailKey)
            expect(detail?.__pendingAction).toBe('update')
            expect(queryClient.getQueryData(['breadcrumb', 'metahub-publication', metahubId, 'pub-1', 'en'])).toBe('Publication 1 updated')
        })

        updatePublicationRequest.resolve({ id: 'pub-1' })

        act(() => {
            deletePublication!.mutate({ metahubId, publicationId: 'pub-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'pub-1')).toBeUndefined()
        })

        deletePublicationRequest.resolve({ success: true, message: 'deleted' })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Information base deleted', { variant: 'success' })
        })
    })
})
