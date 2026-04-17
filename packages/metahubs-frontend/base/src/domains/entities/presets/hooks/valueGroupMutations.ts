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
} from '../../../shared'
import * as setsApi from '../api/valueGroups'
import type {
    CreateValueGroupParams,
    CreateValueGroupAtMetahubParams,
    UpdateValueGroupParams,
    UpdateValueGroupAtMetahubParams,
    DeleteValueGroupParams,
    CopyValueGroupParams,
    ReorderValueGroupParams
} from './setMutationTypes'

export function useCreateValueGroupAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['valueGroups', 'create'],
        mutationFn: async ({ metahubId, kindKey, data }: CreateValueGroupAtMetahubParams) => {
            const response = await setsApi.createValueGroupAtMetahub(metahubId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                fixedValuesCount: 0,
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
            enqueueSnackbar(error.message || t('valueGroups.createError', 'Failed to create value group'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('valueGroups.createSuccess', 'Value group created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['valueGroups'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['valueGroups'],
                    metahubsQueryKeys.allValueGroups(variables.metahubId),
                    ...(variables.data.treeEntityIds ?? []).map((treeEntityId) =>
                        metahubsQueryKeys.valueGroups(variables.metahubId, treeEntityId)
                    )
                )
            }
        }
    })
}

export function useCreateValueGroup() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['valueGroups', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: CreateValueGroupParams) => {
            const response = await setsApi.createValueGroup(metahubId, treeEntityId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                fixedValuesCount: 0,
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
            enqueueSnackbar(error.message || t('valueGroups.createError', 'Failed to create value group'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.valueGroupsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('valueGroups.createSuccess', 'Value group created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['valueGroups'],
                metahubsQueryKeys.valueGroups(variables.metahubId, variables.treeEntityId),
                metahubsQueryKeys.allValueGroups(variables.metahubId)
            )
        }
    })
}

export function useUpdateValueGroup() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['valueGroups', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, data }: UpdateValueGroupParams) => {
            const response = await setsApi.updateValueGroup(metahubId, treeEntityId, valueGroupId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, valueGroupId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, kindKey),
                entityId: valueGroupId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('valueGroups.updateError', 'Failed to update value group'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.valueGroupsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.valueGroupsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                variables.valueGroupId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('valueGroups.updateSuccess', 'Value group updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['valueGroups'],
                metahubsQueryKeys.valueGroups(variables.metahubId, variables.treeEntityId),
                metahubsQueryKeys.allValueGroups(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateValueGroupAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['valueGroups', 'update'],
        mutationFn: async ({ metahubId, valueGroupId, kindKey, data }: UpdateValueGroupAtMetahubParams) => {
            const response = await setsApi.updateValueGroupAtMetahub(metahubId, valueGroupId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, valueGroupId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey),
                entityId: valueGroupId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('valueGroups.updateError', 'Failed to update value group'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey) })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey),
                variables.valueGroupId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('valueGroups.updateSuccess', 'Value group updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['valueGroups'],
                metahubsQueryKeys.allValueGroups(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteValueGroup() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['valueGroups', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, force, kindKey }: DeleteValueGroupParams) => {
            if (treeEntityId) {
                await setsApi.deleteValueGroup(metahubId, treeEntityId, valueGroupId, force, kindKey)
            } else {
                await setsApi.deleteValueGroupDirect(metahubId, valueGroupId, kindKey)
            }
        },
        onMutate: async ({ metahubId, treeEntityId, valueGroupId, kindKey }) => {
            const queryKeyPrefix = treeEntityId
                ? metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, kindKey)
                : metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: valueGroupId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('valueGroups.deleteError', 'Failed to delete value group'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('valueGroups.deleteSuccess', 'Value group deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['valueGroups'],
                metahubsQueryKeys.allValueGroups(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.treeEntityId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['valueGroups'],
                    metahubsQueryKeys.valueGroups(variables.metahubId, variables.treeEntityId)
                )
            }
        }
    })
}

export function useCopyValueGroup() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['valueGroups', 'copy'],
        mutationFn: async ({ metahubId, valueGroupId, kindKey, data }: CopyValueGroupParams) => {
            const response = await setsApi.copyValueGroup(metahubId, valueGroupId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, valueGroupId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allValueGroupsScope(metahubId, kindKey)
            const existingValueGroup = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === valueGroupId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: valueGroupId,
                entitySegment: 'valueGroups',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (treeEntityId) => metahubsQueryKeys.valueGroupsScope(metahubId, treeEntityId, kindKey),
                knownTreeEntityIds: Array.isArray(existingValueGroup?.treeEntities)
                    ? existingValueGroup.treeEntities
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((treeEntityId): treeEntityId is string => Boolean(treeEntityId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingValueGroup ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingValueGroup?.name || {},
                description: data.description ?? existingValueGroup?.description,
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
            enqueueSnackbar(error.message || t('valueGroups.copyError', 'Failed to copy value group'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey)],
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('valueGroups.copySuccess', 'Value group copied'), { variant: 'success' })
        },
        onSettled: async (copiedValueGroup, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['valueGroups'] }) <= 1) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allValueGroups(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntities(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId), refetchType: 'inactive' })
                if (copiedValueGroup && Array.isArray(copiedValueGroup.treeEntities)) {
                    for (const hub of copiedValueGroup.treeEntities as Array<{ id: string }>) {
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.valueGroups(variables.metahubId, hub.id),
                            refetchType: 'inactive'
                        })
                    }
                }
            }
        }
    })
}

export function useReorderValueGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['valueGroups', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, newSortOrder, kindKey }: ReorderValueGroupParams) => {
            const response = await setsApi.reorderValueGroup(metahubId, valueGroupId, newSortOrder, treeEntityId, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.valueGroupsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                          variables.valueGroupId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey),
                          variables.valueGroupId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allValueGroupsScope(variables.metahubId, variables.kindKey),
                          variables.valueGroupId,
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
                ['valueGroups'],
                metahubsQueryKeys.allValueGroups(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.treeEntityId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['valueGroups'],
                    metahubsQueryKeys.valueGroups(variables.metahubId, variables.treeEntityId)
                )
            }
        }
    })
}
