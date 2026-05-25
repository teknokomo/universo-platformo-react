import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    generateOptimisticId,
    cleanupBreadcrumbCache,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate,
    getCurrentLanguageKey
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { getVLCString } from '@universo/utils/vlc'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../../shared'
import * as hubsApi from '../api/trees'
import type {
    CreateTreeEntityParams,
    UpdateTreeEntityParams,
    DeleteTreeEntityParams,
    CopyTreeEntityParams,
    ReorderTreeEntityParams
} from './hubMutationTypes'

export function useCreateTreeEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['treeEntities', 'create'],
        mutationFn: async ({ metahubId, kindKey, data }: CreateTreeEntityParams) => {
            const response = await hubsApi.createTreeEntity(metahubId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang) || data.codename || ''
            const queryKeyPrefix = metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                objectCollectionsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            const breadcrumbKey = ['breadcrumb', 'hub', metahubId, optimisticId, lang] as const

            console.info('[hub:create] onMutate', { metahubId, optimisticId, displayName })

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend',
                breadcrumb: { queryKey: breadcrumbKey, name: displayName }
            })

            return { ...context, breadcrumbKey }
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:create] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (context?.breadcrumbKey) {
                cleanupBreadcrumbCache(queryClient, context.breadcrumbKey)
            }
            enqueueSnackbar(error.message || t('hubs.createError', 'Failed to create hub'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            console.info('[hub:create] onSuccess', {
                metahubId: variables.metahubId,
                optimisticId: context?.optimisticId,
                realId: data?.id
            })
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.treeEntitiesScope(variables.metahubId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('hubs.createSuccess', 'Hub created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:create] onSettled', { metahubId: variables.metahubId })
            safeInvalidateQueries(
                queryClient,
                ['treeEntities'],
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateTreeEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['treeEntities', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: UpdateTreeEntityParams) => {
            const response = await hubsApi.updateTreeEntity(metahubId, treeEntityId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const lang = getCurrentLanguageKey()
            const displayName = data.name ? getVLCString(data.name, lang) : undefined

            console.info('[hub:update] onMutate', { metahubId, treeEntityId, displayName })

            const context = await applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey),
                entityId: treeEntityId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.treeEntityDetail(metahubId, treeEntityId, kindKey),
                breadcrumb: displayName ? { queryKey: ['breadcrumb', 'hub', metahubId, treeEntityId, lang], name: displayName } : undefined
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:update] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.updateError', 'Failed to update hub'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            console.info('[hub:update] onSuccess', { metahubId: variables.metahubId, treeEntityId: variables.treeEntityId })
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.treeEntitiesScope(variables.metahubId, variables.kindKey) })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.treeEntitiesScope(variables.metahubId, variables.kindKey),
                variables.treeEntityId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            // Seed detail cache
            if (data) {
                queryClient.setQueryData(
                    metahubsQueryKeys.treeEntityDetail(variables.metahubId, variables.treeEntityId, variables.kindKey),
                    data
                )
            }
            enqueueSnackbar(t('hubs.updateSuccess', 'Hub updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:update] onSettled', { metahubId: variables.metahubId, treeEntityId: variables.treeEntityId })
            safeInvalidateQueriesInactive(
                queryClient,
                ['treeEntities'],
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteTreeEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['treeEntities', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey }: DeleteTreeEntityParams) => {
            await hubsApi.deleteTreeEntity(metahubId, treeEntityId, kindKey)
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey }) => {
            console.info('[hub:delete] onMutate', { metahubId, treeEntityId })
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey),
                entityId: treeEntityId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:delete] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.deleteError', 'Failed to delete hub'), { variant: 'error' })
        },
        onSuccess: (_data, variables) => {
            console.info('[hub:delete] onSuccess', { metahubId: variables.metahubId, treeEntityId: variables.treeEntityId })
            enqueueSnackbar(t('hubs.deleteSuccess', 'Hub deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:delete] onSettled', { metahubId: variables.metahubId, treeEntityId: variables.treeEntityId })
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(
                queryClient,
                ['treeEntities'],
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useCopyTreeEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['treeEntities', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: CopyTreeEntityParams) => {
            const response = await hubsApi.copyTreeEntity(metahubId, treeEntityId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const queryKeyPrefix = metahubsQueryKeys.treeEntitiesScope(metahubId, kindKey)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingHub = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === treeEntityId)

            const optimisticEntity = {
                ...(existingHub ?? {}),
                id: optimisticId,
                codename: data.codename || (typeof existingHub?.codename === 'string' ? existingHub.codename : ''),
                name: data.name || existingHub?.name || { [lang]: t('hubs.copyInProgress', 'Copying…') },
                description: data.description ?? existingHub?.description,
                sortOrder: optimisticSortOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('copy')
            }

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })

            console.info('[optimistic-copy:treeEntities] onMutate', {
                metahubId,
                treeEntityId,
                optimisticId: context.optimisticId,
                codename: optimisticEntity.codename
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.copyError', 'Failed to copy hub'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.treeEntitiesScope(_variables.metahubId, _variables.kindKey),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            console.info('[optimistic-copy:treeEntities] onSuccess', {
                metahubId: _variables.metahubId,
                treeEntityId: _variables.treeEntityId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('hubs.copySuccess', 'Hub copied'), { variant: 'success' })
        },
        onSettled: async (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['treeEntities'],
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.allObjectCollections(variables.metahubId),
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            console.info('[optimistic-copy:treeEntities] onSettled', {
                metahubId: variables.metahubId,
                treeEntityId: variables.treeEntityId,
                hasError: Boolean(_error)
            })
        }
    })
}

export function useReorderTreeEntity() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['treeEntities', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, newSortOrder }: ReorderTreeEntityParams) => {
            const response = await hubsApi.reorderTreeEntity(metahubId, treeEntityId, newSortOrder, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const snapshots = await applyOptimisticReorder(
                queryClient,
                metahubsQueryKeys.treeEntitiesScope(variables.metahubId, variables.kindKey),
                variables.treeEntityId,
                variables.newSortOrder
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.snapshots)
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['treeEntities'],
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}
