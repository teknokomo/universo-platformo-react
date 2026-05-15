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
import * as objectsApi from '../api/objectCollections'
import type {
    CreateObjectCollectionParams,
    CreateObjectCollectionAtMetahubParams,
    UpdateObjectCollectionParams,
    UpdateObjectCollectionAtMetahubParams,
    DeleteObjectCollectionParams,
    CopyObjectCollectionParams,
    ReorderObjectCollectionParams
} from './objectMutationTypes'

const invalidateObjectCompatibilityEntityQueries = (queryClient: ReturnType<typeof useQueryClient>, metahubId: string) =>
    safeInvalidateQueriesInactive(queryClient, ['entities'], [...metahubsQueryKeys.detail(metahubId), 'entities'])

export function useCreateObjectCollectionAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['objectCollections', 'create'],
        mutationFn: async ({ metahubId, kindKey, data }: CreateObjectCollectionAtMetahubParams) => {
            const response = await objectsApi.createObjectCollectionAtMetahub(metahubId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allObjectCollectionsScope(metahubId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                componentsCount: 0,
                recordsCount: 0,
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
            enqueueSnackbar(error.message || t('objects.createError', 'Failed to create object'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('objects.createSuccess', 'Object created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['objectCollections'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['objectCollections'],
                    metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                    ...(variables.data.treeEntityIds ?? []).map((treeEntityId) =>
                        metahubsQueryKeys.objectCollections(variables.metahubId, treeEntityId)
                    )
                )
                invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
            }
        }
    })
}

export function useCreateObjectCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['objectCollections', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: CreateObjectCollectionParams) => {
            const response = await objectsApi.createObjectCollection(metahubId, treeEntityId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.objectCollectionsScope(metahubId, treeEntityId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                componentsCount: 0,
                recordsCount: 0,
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
            enqueueSnackbar(error.message || t('objects.createError', 'Failed to create object'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('objects.createSuccess', 'Object created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['objectCollections'],
                metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey)
            )
            invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateObjectCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['objectCollections', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, kindKey, data }: UpdateObjectCollectionParams) => {
            const response = await objectsApi.updateObjectCollection(
                metahubId,
                treeEntityId,
                objectCollectionId,
                kindKey ? { ...data, kindKey } : data
            )
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, objectCollectionId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.objectCollectionsScope(metahubId, treeEntityId, kindKey),
                entityId: objectCollectionId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('objects.updateError', 'Failed to update object'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                variables.objectCollectionId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('objects.updateSuccess', 'Object updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['objectCollections'],
                metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateObjectCollectionAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['objectCollections', 'update'],
        mutationFn: async ({ metahubId, objectCollectionId, kindKey, data }: UpdateObjectCollectionAtMetahubParams) => {
            const response = await objectsApi.updateObjectCollectionAtMetahub(
                metahubId,
                objectCollectionId,
                kindKey ? { ...data, kindKey } : data
            )
            return response.data
        },
        onMutate: async ({ metahubId, objectCollectionId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allObjectCollectionsScope(metahubId, kindKey),
                entityId: objectCollectionId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('objects.updateError', 'Failed to update object'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                variables.objectCollectionId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('objects.updateSuccess', 'Object updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['objectCollections'],
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useDeleteObjectCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['objectCollections', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, force, kindKey }: DeleteObjectCollectionParams) => {
            if (treeEntityId) {
                await objectsApi.deleteObjectCollection(metahubId, treeEntityId, objectCollectionId, force, kindKey)
            } else {
                await objectsApi.deleteObjectCollectionDirect(metahubId, objectCollectionId, kindKey)
            }
        },
        onMutate: async ({ metahubId, treeEntityId, objectCollectionId, kindKey }) => {
            const queryKeyPrefix = treeEntityId
                ? metahubsQueryKeys.objectCollectionsScope(metahubId, treeEntityId, kindKey)
                : metahubsQueryKeys.allObjectCollectionsScope(metahubId, kindKey)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: objectCollectionId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('objects.deleteError', 'Failed to delete object'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('objects.deleteSuccess', 'Object deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(
                queryClient,
                ['objectCollections'],
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.treeEntityId) {
                safeInvalidateQueries(
                    queryClient,
                    ['objectCollections'],
                    metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
                )
            }
        }
    })
}

export function useCopyObjectCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['objectCollections', 'copy'],
        mutationFn: async ({ metahubId, objectCollectionId, data, kindKey }: CopyObjectCollectionParams) => {
            const response = await objectsApi.copyObjectCollection(metahubId, objectCollectionId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, objectCollectionId, data, kindKey }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allObjectCollectionsScope(metahubId, kindKey)
            const existingObject = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === objectCollectionId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: objectCollectionId,
                entitySegment: 'objectCollections',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (treeEntityId) => metahubsQueryKeys.objectCollectionsScope(metahubId, treeEntityId, kindKey),
                knownTreeEntityIds: Array.isArray(existingObject?.treeEntities)
                    ? existingObject.treeEntities
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((treeEntityId): treeEntityId is string => Boolean(treeEntityId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingObject ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingObject?.name || {},
                description: data.description ?? existingObject?.description,
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
            enqueueSnackbar(error.message || t('objects.copyError', 'Failed to copy object'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey)],
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('objects.copySuccess', 'Object copied'), { variant: 'success' })
        },
        onSettled: async (copiedObject, _error, variables) => {
            // Use active refetch to ensure copied entity is visible
            if (queryClient.isMutating({ mutationKey: ['objectCollections'] }) <= 1) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                    refetchType: 'inactive'
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntities(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId), refetchType: 'inactive' })
                invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
                if (copiedObject && Array.isArray(copiedObject.treeEntities)) {
                    for (const hub of copiedObject.treeEntities as Array<{ id: string }>) {
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.objectCollectionsScope(variables.metahubId, hub.id, variables.kindKey),
                            refetchType: 'inactive'
                        })
                    }
                }
            }
        }
    })
}

export function useReorderObjectCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['objectCollections', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, newSortOrder, kindKey }: ReorderObjectCollectionParams) => {
            const response = await objectsApi.reorderObjectCollection(metahubId, objectCollectionId, newSortOrder, treeEntityId, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                          variables.objectCollectionId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                          variables.objectCollectionId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                          variables.objectCollectionId,
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
                ['objectCollections'],
                metahubsQueryKeys.allObjectCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateObjectCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.treeEntityId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['objectCollections'],
                    metahubsQueryKeys.objectCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
                )
            }
        }
    })
}
