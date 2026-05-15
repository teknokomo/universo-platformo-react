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
    componentsApi: {
        reorderComponent: vi.fn(),
        reorderComponentDirect: vi.fn()
    },
    hubsApi: {
        createTreeEntity: vi.fn(),
        updateTreeEntity: vi.fn(),
        deleteTreeEntity: vi.fn(),
        copyTreeEntity: vi.fn(),
        reorderTreeEntity: vi.fn()
    },
    objectCollectionsApi: {
        createObjectCollectionAtMetahub: vi.fn(),
        updateObjectCollectionAtMetahub: vi.fn(),
        deleteObjectCollectionDirect: vi.fn(),
        copyObjectCollection: vi.fn(),
        createObjectCollection: vi.fn(),
        updateObjectCollection: vi.fn(),
        deleteObjectCollection: vi.fn(),
        reorderObjectCollection: vi.fn()
    },
    fixedValuesApi: {
        reorderFixedValue: vi.fn(),
        reorderFixedValueDirect: vi.fn()
    },
    setsApi: {
        createValueGroupAtMetahub: vi.fn(),
        updateValueGroupAtMetahub: vi.fn(),
        deleteValueGroupDirect: vi.fn(),
        copyValueGroup: vi.fn(),
        createValueGroup: vi.fn(),
        updateValueGroup: vi.fn(),
        deleteValueGroup: vi.fn(),
        reorderValueGroup: vi.fn()
    },
    enumerationsApi: {
        createOptionListAtMetahub: vi.fn(),
        updateOptionListAtMetahub: vi.fn(),
        deleteOptionListDirect: vi.fn(),
        copyOptionList: vi.fn(),
        createOptionList: vi.fn(),
        updateOptionList: vi.fn(),
        deleteOptionList: vi.fn(),
        reorderOptionList: vi.fn(),
        createOptionValue: vi.fn(),
        updateOptionValue: vi.fn(),
        deleteOptionValue: vi.fn(),
        copyOptionValue: vi.fn(),
        reorderOptionValue: vi.fn()
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

vi.mock('../../entities/metadata/component/api', () => mocks.componentsApi)
vi.mock('../../entities/presets/api/trees', () => mocks.hubsApi)
vi.mock('../../entities/presets/api/objectCollections', () => mocks.objectCollectionsApi)
vi.mock('../../entities/metadata/fixedValue/api', () => mocks.fixedValuesApi)
vi.mock('../../entities/presets/api/valueGroups', () => mocks.setsApi)
vi.mock('../../entities/presets/api/optionLists', () => mocks.enumerationsApi)
vi.mock('../../layouts/api', () => mocks.layoutsApi)
vi.mock('../../publications/api', () => mocks.publicationsApi)

import * as componentHooks from '../../entities/metadata/component/hooks/mutations'
import * as hubHooks from '../../entities/presets/hooks/treeEntityMutations'
import * as objectCollectionHooks from '../../entities/presets/hooks/objectCollectionMutations'
import * as setHooks from '../../entities/presets/hooks/valueGroupMutations'
import * as constantHooks from '../../entities/metadata/fixedValue/hooks/mutations'
import * as enumerationHooks from '../../entities/presets/hooks/optionListMutations'
import * as layoutHooks from '../../layouts/hooks/mutations'
import * as publicationHooks from '../../publications/hooks/mutations'
import { metahubsQueryKeys } from '../queryKeys'

type ReorderComponentParams = Parameters<ReturnType<typeof componentHooks.useReorderComponent>['mutate']>[0]
type CreateTreeEntityParams = Parameters<ReturnType<typeof hubHooks.useCreateTreeEntity>['mutate']>[0]
type UpdateTreeEntityParams = Parameters<ReturnType<typeof hubHooks.useUpdateTreeEntity>['mutate']>[0]
type CopyTreeEntityParams = Parameters<ReturnType<typeof hubHooks.useCopyTreeEntity>['mutate']>[0]
type CopyObjectCollectionParams = Parameters<ReturnType<typeof objectCollectionHooks.useCopyObjectCollection>['mutate']>[0]
type CreateValueGroupParams = Parameters<ReturnType<typeof setHooks.useCreateValueGroupAtMetahub>['mutate']>[0]
type UpdateValueGroupParams = Parameters<ReturnType<typeof setHooks.useUpdateValueGroupAtMetahub>['mutate']>[0]
type CopyValueGroupParams = Parameters<ReturnType<typeof setHooks.useCopyValueGroup>['mutate']>[0]
type ReorderConstantParams = Parameters<ReturnType<typeof constantHooks.useReorderFixedValue>['mutate']>[0]
type CreateOptionListParams = Parameters<ReturnType<typeof enumerationHooks.useCreateOptionListAtMetahub>['mutate']>[0]
type UpdateOptionListParams = Parameters<ReturnType<typeof enumerationHooks.useUpdateOptionListAtMetahub>['mutate']>[0]
type CopyOptionListParams = Parameters<ReturnType<typeof enumerationHooks.useCopyOptionList>['mutate']>[0]
type CreateOptionValueParams = Parameters<ReturnType<typeof enumerationHooks.useCreateOptionValue>['mutate']>[0]
type UpdateOptionValueParams = Parameters<ReturnType<typeof enumerationHooks.useUpdateOptionValue>['mutate']>[0]
type CopyOptionValueParams = Parameters<ReturnType<typeof enumerationHooks.useCopyOptionValue>['mutate']>[0]
type ReorderOptionValueParams = Parameters<ReturnType<typeof enumerationHooks.useReorderOptionValue>['mutate']>[0]
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

    it('applies optimistic create, update, delete, and copy state for treeEntities', async () => {
        const metahubId = 'metahub-1'
        const listKey = metahubsQueryKeys.treeEntitiesList(metahubId)
        const detailKey = metahubsQueryKeys.treeEntityDetail(metahubId, 'hub-1')
        const breadcrumbKey = ['breadcrumb', 'hub', metahubId, 'hub-1', 'en'] as const

        const createTreeEntityRequest = createPromiseController<{ data: { id: string } }>()
        const updateHubRequest = createPromiseController<{ data: { id: string } }>()
        const deleteHubRequest = createPromiseController<void>()
        const copyHubRequest = createPromiseController<{ data: { id: string } }>()

        mocks.hubsApi.createTreeEntity.mockReturnValue(createTreeEntityRequest.promise)
        mocks.hubsApi.updateTreeEntity.mockReturnValue(updateHubRequest.promise)
        mocks.hubsApi.deleteTreeEntity.mockReturnValue(deleteHubRequest.promise)
        mocks.hubsApi.copyTreeEntity.mockReturnValue(copyHubRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'hub-1', codename: 'hub-1', name: { en: 'TreeEntity 1' }, objectCollectionsCount: 1 }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(detailKey, {
            id: 'hub-1',
            codename: 'hub-1',
            name: { en: 'TreeEntity 1' },
            objectCollectionsCount: 1
        })

        let createTreeEntity: ReturnType<typeof hubHooks.useCreateTreeEntity> | undefined
        let updateTreeEntity: ReturnType<typeof hubHooks.useUpdateTreeEntity> | undefined
        let deleteTreeEntity: ReturnType<typeof hubHooks.useDeleteTreeEntity> | undefined
        let copyTreeEntity: ReturnType<typeof hubHooks.useCopyTreeEntity> | undefined

        function Probe() {
            createTreeEntity = hubHooks.useCreateTreeEntity()
            updateTreeEntity = hubHooks.useUpdateTreeEntity()
            deleteTreeEntity = hubHooks.useDeleteTreeEntity()
            copyTreeEntity = hubHooks.useCopyTreeEntity()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createTreeEntity!.mutate({ metahubId, data: { codename: 'hub-2', name: { en: 'TreeEntity 2' } } } as CreateTreeEntityParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const optimisticHub = data?.items.at(0)
            expect(optimisticHub?.codename).toBe('hub-2')
            expect(optimisticHub?.__pendingAction).toBe('create')
            expect(queryClient.getQueryData(['breadcrumb', 'hub', metahubId, 'optimistic-1', 'en'])).toBe('TreeEntity 2')
        })

        createTreeEntityRequest.resolve({ data: { id: 'hub-2' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub created', { variant: 'success' })
        })

        act(() => {
            updateTreeEntity!.mutate({
                metahubId,
                treeEntityId: 'hub-1',
                data: { name: { en: 'TreeEntity 1 updated' } }
            } as UpdateTreeEntityParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const updatedHub = data?.items.find((item) => item.id === 'hub-1')
            const detail = queryClient.getQueryData<Record<string, unknown>>(detailKey)

            expect(updatedHub?.name).toEqual({ en: 'TreeEntity 1 updated' })
            expect(updatedHub?.__pendingAction).toBe('update')
            expect(detail?.name).toEqual({ en: 'TreeEntity 1 updated' })
            expect(detail?.__pendingAction).toBe('update')
            expect(queryClient.getQueryData(breadcrumbKey)).toBe('TreeEntity 1 updated')
        })

        updateHubRequest.resolve({ data: { id: 'hub-1' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Hub updated', { variant: 'success' })
        })

        act(() => {
            deleteTreeEntity!.mutate({ metahubId, treeEntityId: 'hub-1' })
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
            copyTreeEntity!.mutate({ metahubId, treeEntityId: 'hub-1', data: { codename: 'hub-copy' } } as CopyTreeEntityParams)
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
        const listKey = metahubsQueryKeys.treeEntitiesList(metahubId)

        mocks.hubsApi.createTreeEntity.mockRejectedValue(new Error('hub create failed'))

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'hub-1', codename: 'hub-1', name: { en: 'TreeEntity 1' } }],
            pagination: { total: 1 }
        })

        let createTreeEntity: ReturnType<typeof hubHooks.useCreateTreeEntity> | undefined

        function Probe() {
            createTreeEntity = hubHooks.useCreateTreeEntity()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        await act(async () => {
            await expect(
                createTreeEntity!.mutateAsync({
                    metahubId,
                    data: { codename: 'hub-2', name: { en: 'TreeEntity 2' } }
                } as CreateTreeEntityParams)
            ).rejects.toThrow('hub create failed')
        })

        const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
        expect(data?.items).toHaveLength(1)
        expect(queryClient.getQueryData(['breadcrumb', 'hub', metahubId, 'optimistic-1', 'en'])).toBeUndefined()
        expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('hub create failed', { variant: 'error' })
    })

    it('applies optimistic state for set mutations at metahub scope', async () => {
        const metahubId = 'metahub-valueGroups'
        const listKey = metahubsQueryKeys.allValueGroupsList(metahubId)
        const hubListKey = metahubsQueryKeys.valueGroupsList(metahubId, 'hub-1')

        const createValueGroupRequest = createPromiseController<{ data: { id: string } }>()
        const updateSetRequest = createPromiseController<{ data: { id: string } }>()
        const deleteSetRequest = createPromiseController<void>()
        const copySetRequest = createPromiseController<{ data: { id: string; treeEntities: Array<{ id: string }> } }>()

        mocks.setsApi.createValueGroupAtMetahub.mockReturnValue(createValueGroupRequest.promise)
        mocks.setsApi.updateValueGroupAtMetahub.mockReturnValue(updateSetRequest.promise)
        mocks.setsApi.deleteValueGroupDirect.mockReturnValue(deleteSetRequest.promise)
        mocks.setsApi.copyValueGroup.mockReturnValue(copySetRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'set-1', codename: 'set-1', name: { en: 'Set 1' }, fixedValuesCount: 1, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'set-1', codename: 'set-1', name: { en: 'Set 1' }, fixedValuesCount: 1, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let createValueGroup: ReturnType<typeof setHooks.useCreateValueGroupAtMetahub> | undefined
        let updateValueGroup: ReturnType<typeof setHooks.useUpdateValueGroupAtMetahub> | undefined
        let deleteValueGroup: ReturnType<typeof setHooks.useDeleteValueGroup> | undefined
        let copyValueGroup: ReturnType<typeof setHooks.useCopyValueGroup> | undefined

        function Probe() {
            createValueGroup = setHooks.useCreateValueGroupAtMetahub()
            updateValueGroup = setHooks.useUpdateValueGroupAtMetahub()
            deleteValueGroup = setHooks.useDeleteValueGroup()
            copyValueGroup = setHooks.useCopyValueGroup()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createValueGroup!.mutate({
                metahubId,
                data: { codename: 'set-2', name: { en: 'Set 2' }, treeEntityIds: ['hub-1'] }
            } as CreateValueGroupParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('create')
        })

        createValueGroupRequest.resolve({ data: { id: 'set-2' } })

        act(() => {
            updateValueGroup!.mutate({
                metahubId,
                valueGroupId: 'set-1',
                data: { name: { en: 'Set 1 updated' } }
            } as UpdateValueGroupParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'set-1')?.__pendingAction).toBe('update')
        })

        updateSetRequest.resolve({ data: { id: 'set-1' } })

        act(() => {
            deleteValueGroup!.mutate({ metahubId, valueGroupId: 'set-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'set-1')).toBeUndefined()
        })

        deleteSetRequest.resolve()

        act(() => {
            copyValueGroup!.mutate({ metahubId, valueGroupId: 'set-1', data: { name: { en: 'Set 1 copy' } } } as CopyValueGroupParams)
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

        copySetRequest.resolve({ data: { id: 'set-copy', treeEntities: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Set copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('set-copy')
        })
    })

    it('isolates optimistic set create state to the requested standard kind scope', async () => {
        const metahubId = 'metahub-valueGroups-kind'
        const kindKey = 'set'
        const scopedListKey = metahubsQueryKeys.allValueGroupsList(metahubId, { limit: 100, offset: 0, sortOrder: 'asc', kindKey })
        const unscopedListKey = metahubsQueryKeys.allValueGroupsList(metahubId)

        const createValueGroupRequest = createPromiseController<{ data: { id: string } }>()
        mocks.setsApi.createValueGroupAtMetahub.mockReturnValue(createValueGroupRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(scopedListKey, {
            items: [{ id: 'set-custom-1', codename: 'set-custom-1', name: { en: 'Scoped Set 1' }, fixedValuesCount: 1 }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(unscopedListKey, {
            items: [{ id: 'set-legacy-1', codename: 'set-legacy-1', name: { en: 'Legacy Set 1' }, fixedValuesCount: 1 }],
            pagination: { total: 1 }
        })

        let createValueGroup: ReturnType<typeof setHooks.useCreateValueGroupAtMetahub> | undefined

        function Probe() {
            createValueGroup = setHooks.useCreateValueGroupAtMetahub()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createValueGroup!.mutate({
                metahubId,
                kindKey,
                data: { codename: 'set-custom-2', name: { en: 'Scoped Set 2' } }
            } as CreateValueGroupParams)
        })

        await waitFor(() => {
            const scopedData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(scopedListKey)
            const unscopedData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(unscopedListKey)
            expect(scopedData?.items.at(0)?.codename).toBe('set-custom-2')
            expect(scopedData?.items.at(0)?.__pendingAction).toBe('create')
            expect(unscopedData?.items).toHaveLength(1)
            expect(unscopedData?.items.at(0)?.id).toBe('set-legacy-1')
        })

        createValueGroupRequest.resolve({ data: { id: 'set-custom-2' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Set created', { variant: 'success' })
        })
    })

    it('applies optimistic copy state for objectCollections in both metahub and hub scopes', async () => {
        const metahubId = 'metahub-objectCollections'
        const listKey = metahubsQueryKeys.allObjectCollectionsList(metahubId)
        const hubListKey = metahubsQueryKeys.objectCollectionsList(metahubId, 'hub-1')
        const copyObjectRequest = createPromiseController<{ data: { id: string; treeEntities: Array<{ id: string }> } }>()

        mocks.objectCollectionsApi.copyObjectCollection.mockReturnValue(copyObjectRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'object-1', codename: 'object-1', name: { en: 'ObjectCollectionEntity 1' }, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'object-1', codename: 'object-1', name: { en: 'ObjectCollectionEntity 1' }, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let copyObjectCollection: ReturnType<typeof objectCollectionHooks.useCopyObjectCollection> | undefined

        function Probe() {
            copyObjectCollection = objectCollectionHooks.useCopyObjectCollection()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            copyObjectCollection!.mutate({
                metahubId,
                objectCollectionId: 'object-1',
                data: { name: { en: 'ObjectCollectionEntity 1 copy' } }
            } as CopyObjectCollectionParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            const copiedObject = data?.items.at(0)
            const copiedObjectInHub = hubData?.items.at(0)
            expect(copiedObject?.__pendingAction).toBe('copy')
            expect(copiedObject?.codename).toBe('')
            expect(copiedObjectInHub?.__pendingAction).toBe('copy')
            expect(copiedObjectInHub?.codename).toBe('')
        })

        copyObjectRequest.resolve({ data: { id: 'object-copy', treeEntities: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Object copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('object-copy')
        })
    })

    it('applies optimistic state for enumeration mutations at metahub scope', async () => {
        const metahubId = 'metahub-enums'
        const listKey = metahubsQueryKeys.allOptionListsList(metahubId)
        const hubListKey = metahubsQueryKeys.optionListsList(metahubId, 'hub-1')

        const createOptionListRequest = createPromiseController<{ data: { id: string } }>()
        const updateEnumerationRequest = createPromiseController<{ data: { id: string } }>()
        const deleteEnumerationRequest = createPromiseController<void>()
        const copyEnumerationRequest = createPromiseController<{ data: { id: string; treeEntities: Array<{ id: string }> } }>()

        mocks.enumerationsApi.createOptionListAtMetahub.mockReturnValue(createOptionListRequest.promise)
        mocks.enumerationsApi.updateOptionListAtMetahub.mockReturnValue(updateEnumerationRequest.promise)
        mocks.enumerationsApi.deleteOptionListDirect.mockReturnValue(deleteEnumerationRequest.promise)
        mocks.enumerationsApi.copyOptionList.mockReturnValue(copyEnumerationRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [{ id: 'enum-1', codename: 'enum-1', name: { en: 'Enum 1' }, optionValuesCount: 2, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(hubListKey, {
            items: [{ id: 'enum-1', codename: 'enum-1', name: { en: 'Enum 1' }, optionValuesCount: 2, treeEntities: [{ id: 'hub-1' }] }],
            pagination: { total: 1 }
        })

        let createOptionList: ReturnType<typeof enumerationHooks.useCreateOptionListAtMetahub> | undefined
        let updateOptionList: ReturnType<typeof enumerationHooks.useUpdateOptionListAtMetahub> | undefined
        let deleteOptionList: ReturnType<typeof enumerationHooks.useDeleteOptionList> | undefined
        let copyOptionList: ReturnType<typeof enumerationHooks.useCopyOptionList> | undefined

        function Probe() {
            createOptionList = enumerationHooks.useCreateOptionListAtMetahub()
            updateOptionList = enumerationHooks.useUpdateOptionListAtMetahub()
            deleteOptionList = enumerationHooks.useDeleteOptionList()
            copyOptionList = enumerationHooks.useCopyOptionList()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createOptionList!.mutate({
                metahubId,
                data: { codename: 'enum-2', name: { en: 'Enum 2' }, treeEntityIds: ['hub-1'] }
            } as CreateOptionListParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.at(0)?.__pendingAction).toBe('create')
        })

        createOptionListRequest.resolve({ data: { id: 'enum-2' } })

        act(() => {
            updateOptionList!.mutate({
                metahubId,
                optionListId: 'enum-1',
                data: { name: { en: 'Enum 1 updated' } }
            } as UpdateOptionListParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'enum-1')?.__pendingAction).toBe('update')
        })

        updateEnumerationRequest.resolve({ data: { id: 'enum-1' } })

        act(() => {
            deleteOptionList!.mutate({ metahubId, optionListId: 'enum-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'enum-1')).toBeUndefined()
        })

        deleteEnumerationRequest.resolve()

        act(() => {
            copyOptionList!.mutate({
                metahubId,
                optionListId: 'enum-1',
                data: { name: { en: 'Enum 1 copy' } }
            } as CopyOptionListParams)
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

        copyEnumerationRequest.resolve({ data: { id: 'enum-copy', treeEntities: [{ id: 'hub-1' }] } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Enumeration copied', { variant: 'success' })
            const hubData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(hubListKey)
            expect(hubData?.items.at(0)?.id).toBe('enum-copy')
        })
    })

    it('isolates optimistic enumeration create state to the requested standard kind scope', async () => {
        const metahubId = 'metahub-enums-kind'
        const kindKey = 'enumeration'
        const scopedListKey = metahubsQueryKeys.allOptionListsList(metahubId, { limit: 100, offset: 0, sortOrder: 'asc', kindKey })
        const unscopedListKey = metahubsQueryKeys.allOptionListsList(metahubId)

        const createOptionListRequest = createPromiseController<{ data: { id: string } }>()
        mocks.enumerationsApi.createOptionListAtMetahub.mockReturnValue(createOptionListRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(scopedListKey, {
            items: [{ id: 'enum-custom-1', codename: 'enum-custom-1', name: { en: 'Scoped Enum 1' }, optionValuesCount: 1 }],
            pagination: { total: 1 }
        })
        queryClient.setQueryData(unscopedListKey, {
            items: [{ id: 'enum-legacy-1', codename: 'enum-legacy-1', name: { en: 'Legacy Enum 1' }, optionValuesCount: 1 }],
            pagination: { total: 1 }
        })

        let createOptionList: ReturnType<typeof enumerationHooks.useCreateOptionListAtMetahub> | undefined

        function Probe() {
            createOptionList = enumerationHooks.useCreateOptionListAtMetahub()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createOptionList!.mutate({
                metahubId,
                kindKey,
                data: { codename: 'enum-custom-2', name: { en: 'Scoped Enum 2' } }
            } as CreateOptionListParams)
        })

        await waitFor(() => {
            const scopedData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(scopedListKey)
            const unscopedData = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(unscopedListKey)
            expect(scopedData?.items.at(0)?.codename).toBe('enum-custom-2')
            expect(scopedData?.items.at(0)?.__pendingAction).toBe('create')
            expect(unscopedData?.items).toHaveLength(1)
            expect(unscopedData?.items.at(0)?.id).toBe('enum-legacy-1')
        })

        createOptionListRequest.resolve({ data: { id: 'enum-custom-2' } })

        await waitFor(() => {
            expect(mocks.enqueueSnackbar).toHaveBeenCalledWith('Enumeration created', { variant: 'success' })
        })
    })

    it('applies optimistic state for enumeration value mutations', async () => {
        const metahubId = 'metahub-enum-values'
        const optionListId = 'enum-1'
        const listKey = metahubsQueryKeys.optionValuesList(metahubId, optionListId)

        const createValueRequest = createPromiseController<{ data: { id: string } }>()
        const updateValueRequest = createPromiseController<{ data: { id: string } }>()
        const deleteValueRequest = createPromiseController<void>()
        const copyValueRequest = createPromiseController<{ data: { id: string } }>()

        mocks.enumerationsApi.createOptionValue.mockReturnValue(createValueRequest.promise)
        mocks.enumerationsApi.updateOptionValue.mockReturnValue(updateValueRequest.promise)
        mocks.enumerationsApi.deleteOptionValue.mockReturnValue(deleteValueRequest.promise)
        mocks.enumerationsApi.copyOptionValue.mockReturnValue(copyValueRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [
                {
                    id: 'value-1',
                    objectId: optionListId,
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

        let createValue: ReturnType<typeof enumerationHooks.useCreateOptionValue> | undefined
        let updateValue: ReturnType<typeof enumerationHooks.useUpdateOptionValue> | undefined
        let deleteValue: ReturnType<typeof enumerationHooks.useDeleteOptionValue> | undefined
        let copyValue: ReturnType<typeof enumerationHooks.useCopyOptionValue> | undefined

        function Probe() {
            createValue = enumerationHooks.useCreateOptionValue()
            updateValue = enumerationHooks.useUpdateOptionValue()
            deleteValue = enumerationHooks.useDeleteOptionValue()
            copyValue = enumerationHooks.useCopyOptionValue()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            createValue!.mutate({
                metahubId,
                optionListId,
                data: {
                    codename: 'value-2',
                    name: { en: 'Value 2' },
                    description: { en: 'Created' },
                    isDefault: false
                }
            } as CreateOptionValueParams)
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
                optionListId,
                valueId: 'value-1',
                data: { name: { en: 'Value 1 updated' }, isDefault: true }
            } as UpdateOptionValueParams)
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
            deleteValue!.mutate({ metahubId, optionListId, valueId: 'value-1' })
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.find((item) => item.id === 'value-1')).toBeUndefined()
        })

        deleteValueRequest.resolve()

        act(() => {
            copyValue!.mutate({
                metahubId,
                optionListId,
                valueId: 'value-2',
                data: { name: { en: 'Value 2 copy' }, codename: 'value-2-copy', isDefault: false }
            } as CopyOptionValueParams)
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

    it('keeps locked shared fixedValues fixed while optimistically reordering merged local rows', async () => {
        const metahubId = 'metahub-fixedValues'
        const treeEntityId = 'hub-1'
        const valueGroupId = 'set-1'
        const listKey = metahubsQueryKeys.fixedValuesList(metahubId, treeEntityId, valueGroupId, {
            limit: 100,
            offset: 0,
            sortOrder: 'asc',
            includeShared: true
        })
        const reorderRequest = createPromiseController<{ data: { id: string } }>()

        mocks.fixedValuesApi.reorderFixedValue.mockReturnValue(reorderRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [
                {
                    id: 'constant-shared',
                    sortOrder: 1,
                    effectiveSortOrder: 1,
                    isShared: true,
                    sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: true }
                },
                { id: 'constant-local-1', sortOrder: 2, effectiveSortOrder: 2 },
                { id: 'constant-local-2', sortOrder: 3, effectiveSortOrder: 3 }
            ],
            pagination: { total: 3 }
        })

        let reorderConstant: ReturnType<typeof constantHooks.useReorderFixedValue> | undefined

        function Probe() {
            reorderConstant = constantHooks.useReorderFixedValue()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            reorderConstant!.mutate({
                metahubId,
                treeEntityId,
                valueGroupId,
                fixedValueId: 'constant-local-2',
                newSortOrder: 2,
                mergedOrderIds: ['constant-local-2', 'constant-local-1']
            } as ReorderConstantParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.map((item) => item.id)).toEqual(['constant-shared', 'constant-local-2', 'constant-local-1'])
        })

        reorderRequest.resolve({ data: { id: 'constant-local-2' } })
    })

    it('keeps locked shared components fixed while optimistically reordering merged local rows', async () => {
        const metahubId = 'metahub-components'
        const treeEntityId = 'hub-1'
        const objectCollectionId = 'object-1'
        const listKey = metahubsQueryKeys.componentsList(metahubId, treeEntityId, objectCollectionId, {
            limit: 100,
            offset: 0,
            sortOrder: 'asc',
            includeShared: true
        })
        const reorderRequest = createPromiseController<{ data: { id: string } }>()

        mocks.componentsApi.reorderComponent.mockReturnValue(reorderRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [
                {
                    id: 'component-shared',
                    sortOrder: 1,
                    effectiveSortOrder: 1,
                    isShared: true,
                    sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: true }
                },
                { id: 'component-local-1', sortOrder: 2, effectiveSortOrder: 2 },
                { id: 'component-local-2', sortOrder: 3, effectiveSortOrder: 3 }
            ],
            pagination: { total: 3 }
        })

        let reorderComponent: ReturnType<typeof componentHooks.useReorderComponent> | undefined

        function Probe() {
            reorderComponent = componentHooks.useReorderComponent()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            reorderComponent!.mutate({
                metahubId,
                treeEntityId,
                objectCollectionId,
                componentId: 'component-local-2',
                newSortOrder: 2,
                mergedOrderIds: ['component-local-2', 'component-local-1']
            } as ReorderComponentParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.map((item) => item.id)).toEqual(['component-shared', 'component-local-2', 'component-local-1'])
        })

        reorderRequest.resolve({ data: { id: 'component-local-2' } })
    })

    it('keeps locked shared enumeration values fixed while optimistically reordering merged local rows', async () => {
        const metahubId = 'metahub-enum-values-reorder'
        const optionListId = 'enum-merged'
        const listKey = metahubsQueryKeys.optionValuesList(metahubId, optionListId, { includeShared: true })
        const reorderRequest = createPromiseController<{ data: { id: string } }>()

        mocks.enumerationsApi.reorderOptionValue.mockReturnValue(reorderRequest.promise)

        const queryClient = createTestQueryClient()
        queryClient.setQueryData(listKey, {
            items: [
                {
                    id: 'value-shared',
                    sortOrder: 1,
                    effectiveSortOrder: 1,
                    isShared: true,
                    sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: true }
                },
                { id: 'value-local-1', sortOrder: 2, effectiveSortOrder: 2 },
                { id: 'value-local-2', sortOrder: 3, effectiveSortOrder: 3 }
            ],
            pagination: { total: 3 }
        })

        let reorderValue: ReturnType<typeof enumerationHooks.useReorderOptionValue> | undefined

        function Probe() {
            reorderValue = enumerationHooks.useReorderOptionValue()
            return null
        }

        render(createElement(QueryClientProvider, { client: queryClient }, createElement(Probe)))

        act(() => {
            reorderValue!.mutate({
                metahubId,
                optionListId,
                valueId: 'value-local-2',
                newSortOrder: 2,
                mergedOrderIds: ['value-local-2', 'value-local-1']
            } as ReorderOptionValueParams)
        })

        await waitFor(() => {
            const data = queryClient.getQueryData<{ items: Array<Record<string, unknown>> }>(listKey)
            expect(data?.items.map((item) => item.id)).toEqual(['value-shared', 'value-local-2', 'value-local-1'])
        })

        reorderRequest.resolve({ data: { id: 'value-local-2' } })
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
