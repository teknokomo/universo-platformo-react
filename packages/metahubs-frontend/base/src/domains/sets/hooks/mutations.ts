import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import {
    applyOptimisticCreateToQueryKeyPrefixes,
    applyOptimisticReorder,
    collectMetahubCopyQueryKeyPrefixes,
    confirmOptimisticCreateInQueryKeyPrefixes,
    metahubsQueryKeys,
    rollbackReorderSnapshots
} from '../../shared'
import * as setsApi from '../api'
import type {
    CreateSetParams,
    CreateSetAtMetahubParams,
    UpdateSetParams,
    UpdateSetAtMetahubParams,
    DeleteSetParams,
    CopySetParams,
    ReorderSetParams
} from './mutationTypes'

export function useCreateSetAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['sets', 'create'],
        mutationFn: async ({ metahubId, data }: CreateSetAtMetahubParams) => {
            const response = await setsApi.createSetAtMetahub(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allSets(metahubId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                constantsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.createError', 'Failed to create set'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.allSets(variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('sets.createSuccess', 'Set created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['sets'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['sets'],
                    metahubsQueryKeys.allSets(variables.metahubId),
                    ...(variables.data.hubIds ?? []).map((hubId) => metahubsQueryKeys.sets(variables.metahubId, hubId))
                )
            }
        }
    })
}

export function useCreateSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['sets', 'create'],
        mutationFn: async ({ metahubId, hubId, data }: CreateSetParams) => {
            const response = await setsApi.createSet(metahubId, hubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.sets(metahubId, hubId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                constantsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.createError', 'Failed to create set'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('sets.createSuccess', 'Set created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['sets'],
                metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allSets(variables.metahubId)
            )
        }
    })
}

export function useUpdateSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['sets', 'update'],
        mutationFn: async ({ metahubId, hubId, setId, data }: UpdateSetParams) => {
            const response = await setsApi.updateSet(metahubId, hubId, setId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, setId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.sets(metahubId, hubId),
                entityId: setId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.updateError', 'Failed to update set'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.sets(variables.metahubId, variables.hubId), variables.setId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['sets'],
                metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allSets(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateSetAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['sets', 'update'],
        mutationFn: async ({ metahubId, setId, data }: UpdateSetAtMetahubParams) => {
            const response = await setsApi.updateSetAtMetahub(metahubId, setId, data)
            return response.data
        },
        onMutate: async ({ metahubId, setId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allSets(metahubId),
                entityId: setId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.updateError', 'Failed to update set'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.allSets(variables.metahubId), variables.setId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['sets'],
                metahubsQueryKeys.allSets(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['sets', 'delete'],
        mutationFn: async ({ metahubId, hubId, setId, force }: DeleteSetParams) => {
            if (hubId) {
                await setsApi.deleteSet(metahubId, hubId, setId, force)
            } else {
                await setsApi.deleteSetDirect(metahubId, setId)
            }
        },
        onMutate: async ({ metahubId, hubId, setId }) => {
            const queryKeyPrefix = hubId ? metahubsQueryKeys.sets(metahubId, hubId) : metahubsQueryKeys.allSets(metahubId)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: setId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.deleteError', 'Failed to delete set'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('sets.deleteSuccess', 'Set deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['sets'],
                metahubsQueryKeys.allSets(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.hubId) {
                safeInvalidateQueriesInactive(queryClient, ['sets'], metahubsQueryKeys.sets(variables.metahubId, variables.hubId))
            }
        }
    })
}

export function useCopySet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['sets', 'copy'],
        mutationFn: async ({ metahubId, setId, data }: CopySetParams) => {
            const response = await setsApi.copySet(metahubId, setId, data)
            return response.data
        },
        onMutate: async ({ metahubId, setId, data }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allSets(metahubId)
            const existingSet = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === setId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: setId,
                entitySegment: 'sets',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (hubId) => metahubsQueryKeys.sets(metahubId, hubId),
                knownHubIds: Array.isArray(existingSet?.hubs)
                    ? existingSet.hubs
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((hubId): hubId is string => Boolean(hubId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingSet ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingSet?.name || {},
                description: data.description ?? existingSet?.description,
                sortOrder: optimisticSortOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('copy')
            }

            const context = await applyOptimisticCreateToQueryKeyPrefixes({
                queryClient,
                queryKeyPrefixes,
                optimisticEntity,
                insertPosition: 'prepend'
            })

            return {
                ...context,
                queryKeyPrefixes
            }
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('sets.copyError', 'Failed to copy set'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allSets(variables.metahubId)],
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('sets.copySuccess', 'Set copied'), { variant: 'success' })
        },
        onSettled: async (copiedSet, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['sets'] }) <= 1) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId), refetchType: 'inactive' })
                if (copiedSet && Array.isArray(copiedSet.hubs)) {
                    for (const hub of copiedSet.hubs as Array<{ id: string }>) {
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.sets(variables.metahubId, hub.id),
                            refetchType: 'inactive'
                        })
                    }
                }
            }
        }
    })
}

export function useReorderSet() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['sets', 'reorder'],
        mutationFn: async ({ metahubId, hubId, setId, newSortOrder }: ReorderSetParams) => {
            const response = await setsApi.reorderSet(metahubId, setId, newSortOrder, hubId)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
                          variables.setId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allSets(variables.metahubId),
                          variables.setId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allSets(variables.metahubId),
                          variables.setId,
                          variables.newSortOrder
                      )
                    : []

            return { listSnapshots, globalSnapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.listSnapshots)
            rollbackReorderSnapshots(queryClient, context?.globalSnapshots)
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['sets'],
                metahubsQueryKeys.allSets(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.hubId) {
                safeInvalidateQueriesInactive(queryClient, ['sets'], metahubsQueryKeys.sets(variables.metahubId, variables.hubId))
            }
        }
    })
}
