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
import * as catalogsApi from '../api/linkedCollections'
import type {
    CreateLinkedCollectionParams,
    CreateLinkedCollectionAtMetahubParams,
    UpdateLinkedCollectionParams,
    UpdateLinkedCollectionAtMetahubParams,
    DeleteLinkedCollectionParams,
    CopyLinkedCollectionParams,
    ReorderLinkedCollectionParams
} from './catalogMutationTypes'

const invalidateCatalogCompatibilityEntityQueries = (queryClient: ReturnType<typeof useQueryClient>, metahubId: string) =>
    safeInvalidateQueriesInactive(queryClient, ['entities'], [...metahubsQueryKeys.detail(metahubId), 'entities'])

export function useCreateLinkedCollectionAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['linkedCollections', 'create'],
        mutationFn: async ({ metahubId, kindKey, data }: CreateLinkedCollectionAtMetahubParams) => {
            const response = await catalogsApi.createLinkedCollectionAtMetahub(metahubId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                fieldDefinitionsCount: 0,
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
            enqueueSnackbar(error.message || t('linkedCollections.createError', 'Failed to create linked collection'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('linkedCollections.createSuccess', 'LinkedCollectionEntity created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['linkedCollections'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['linkedCollections'],
                    metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                    ...(variables.data.treeEntityIds ?? []).map((treeEntityId) =>
                        metahubsQueryKeys.linkedCollections(variables.metahubId, treeEntityId)
                    )
                )
                invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            }
        }
    })
}

export function useCreateLinkedCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['linkedCollections', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: CreateLinkedCollectionParams) => {
            const response = await catalogsApi.createLinkedCollection(metahubId, treeEntityId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                fieldDefinitionsCount: 0,
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
            enqueueSnackbar(error.message || t('linkedCollections.createError', 'Failed to create linked collection'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('linkedCollections.createSuccess', 'LinkedCollectionEntity created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['linkedCollections'],
                metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateLinkedCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['linkedCollections', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, kindKey, data }: UpdateLinkedCollectionParams) => {
            const response = await catalogsApi.updateLinkedCollection(
                metahubId,
                treeEntityId,
                linkedCollectionId,
                kindKey ? { ...data, kindKey } : data
            )
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, linkedCollectionId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey),
                entityId: linkedCollectionId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('linkedCollections.updateError', 'Failed to update linked collection'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                variables.linkedCollectionId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('linkedCollections.updateSuccess', 'LinkedCollectionEntity updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['linkedCollections'],
                metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateLinkedCollectionAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['linkedCollections', 'update'],
        mutationFn: async ({ metahubId, linkedCollectionId, kindKey, data }: UpdateLinkedCollectionAtMetahubParams) => {
            const response = await catalogsApi.updateLinkedCollectionAtMetahub(
                metahubId,
                linkedCollectionId,
                kindKey ? { ...data, kindKey } : data
            )
            return response.data
        },
        onMutate: async ({ metahubId, linkedCollectionId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey),
                entityId: linkedCollectionId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('linkedCollections.updateError', 'Failed to update linked collection'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                variables.linkedCollectionId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('linkedCollections.updateSuccess', 'LinkedCollectionEntity updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['linkedCollections'],
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useDeleteLinkedCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['linkedCollections', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, force, kindKey }: DeleteLinkedCollectionParams) => {
            if (treeEntityId) {
                await catalogsApi.deleteLinkedCollection(metahubId, treeEntityId, linkedCollectionId, force, kindKey)
            } else {
                await catalogsApi.deleteLinkedCollectionDirect(metahubId, linkedCollectionId, kindKey)
            }
        },
        onMutate: async ({ metahubId, treeEntityId, linkedCollectionId, kindKey }) => {
            const queryKeyPrefix = treeEntityId
                ? metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey)
                : metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: linkedCollectionId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('linkedCollections.deleteError', 'Failed to delete linked collection'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('linkedCollections.deleteSuccess', 'LinkedCollectionEntity deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(
                queryClient,
                ['linkedCollections'],
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.treeEntityId) {
                safeInvalidateQueries(
                    queryClient,
                    ['linkedCollections'],
                    metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
                )
            }
        }
    })
}

export function useCopyLinkedCollection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['linkedCollections', 'copy'],
        mutationFn: async ({ metahubId, linkedCollectionId, data, kindKey }: CopyLinkedCollectionParams) => {
            const response = await catalogsApi.copyLinkedCollection(metahubId, linkedCollectionId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, linkedCollectionId, data, kindKey }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allLinkedCollectionsScope(metahubId, kindKey)
            const existingCatalog = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === linkedCollectionId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: linkedCollectionId,
                entitySegment: 'linkedCollections',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (treeEntityId) => metahubsQueryKeys.linkedCollectionsScope(metahubId, treeEntityId, kindKey),
                knownTreeEntityIds: Array.isArray(existingCatalog?.treeEntities)
                    ? existingCatalog.treeEntities
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((treeEntityId): treeEntityId is string => Boolean(treeEntityId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingCatalog ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingCatalog?.name || {},
                description: data.description ?? existingCatalog?.description,
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
            enqueueSnackbar(error.message || t('linkedCollections.copyError', 'Failed to copy linked collection'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey)],
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('linkedCollections.copySuccess', 'LinkedCollectionEntity copied'), { variant: 'success' })
        },
        onSettled: async (copiedCatalog, _error, variables) => {
            // Use active refetch to ensure copied entity is visible
            if (queryClient.isMutating({ mutationKey: ['linkedCollections'] }) <= 1) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                    refetchType: 'inactive'
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.treeEntities(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId), refetchType: 'inactive' })
                invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
                if (copiedCatalog && Array.isArray(copiedCatalog.treeEntities)) {
                    for (const hub of copiedCatalog.treeEntities as Array<{ id: string }>) {
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, hub.id, variables.kindKey),
                            refetchType: 'inactive'
                        })
                    }
                }
            }
        }
    })
}

export function useReorderLinkedCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['linkedCollections', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, newSortOrder, kindKey }: ReorderLinkedCollectionParams) => {
            const response = await catalogsApi.reorderLinkedCollection(metahubId, linkedCollectionId, newSortOrder, treeEntityId, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                          variables.linkedCollectionId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                          variables.linkedCollectionId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                          variables.linkedCollectionId,
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
                ['linkedCollections'],
                metahubsQueryKeys.allLinkedCollectionsScope(variables.metahubId, variables.kindKey),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.treeEntityId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['linkedCollections'],
                    metahubsQueryKeys.linkedCollectionsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
                )
            }
        }
    })
}
