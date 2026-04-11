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
import * as catalogsApi from '../api'
import type {
    CreateCatalogParams,
    CreateCatalogAtMetahubParams,
    UpdateCatalogParams,
    UpdateCatalogAtMetahubParams,
    DeleteCatalogParams,
    CopyCatalogParams,
    ReorderCatalogParams
} from './mutationTypes'

const invalidateCatalogCompatibilityEntityQueries = (queryClient: ReturnType<typeof useQueryClient>, metahubId: string) =>
    safeInvalidateQueriesInactive(queryClient, ['entities'], [...metahubsQueryKeys.detail(metahubId), 'entities'])

export function useCreateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['catalogs', 'create'],
        mutationFn: async ({ metahubId, data }: CreateCatalogAtMetahubParams) => {
            const response = await catalogsApi.createCatalogAtMetahub(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allCatalogs(metahubId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                attributesCount: 0,
                elementsCount: 0,
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
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.allCatalogs(variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['catalogs'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['catalogs'],
                    metahubsQueryKeys.allCatalogs(variables.metahubId),
                    ...(variables.data.hubIds ?? []).map((hubId) => metahubsQueryKeys.catalogs(variables.metahubId, hubId))
                )
                invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            }
        }
    })
}

export function useCreateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['catalogs', 'create'],
        mutationFn: async ({ metahubId, hubId, data }: CreateCatalogParams) => {
            const response = await catalogsApi.createCatalog(metahubId, hubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.catalogs(metahubId, hubId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                attributesCount: 0,
                elementsCount: 0,
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
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['catalogs'],
                metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allCatalogs(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['catalogs', 'update'],
        mutationFn: async ({ metahubId, hubId, catalogId, data }: UpdateCatalogParams) => {
            const response = await catalogsApi.updateCatalog(metahubId, hubId, catalogId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, catalogId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.catalogs(metahubId, hubId),
                entityId: catalogId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId), variables.catalogId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['catalogs'],
                metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allCatalogs(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useUpdateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['catalogs', 'update'],
        mutationFn: async ({ metahubId, catalogId, data }: UpdateCatalogAtMetahubParams) => {
            const response = await catalogsApi.updateCatalogAtMetahub(metahubId, catalogId, data)
            return response.data
        },
        onMutate: async ({ metahubId, catalogId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allCatalogs(metahubId),
                entityId: catalogId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.allCatalogs(variables.metahubId), variables.catalogId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['catalogs'],
                metahubsQueryKeys.allCatalogs(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
        }
    })
}

export function useDeleteCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['catalogs', 'delete'],
        mutationFn: async ({ metahubId, hubId, catalogId, force }: DeleteCatalogParams) => {
            if (hubId) {
                await catalogsApi.deleteCatalog(metahubId, hubId, catalogId, force)
            } else {
                await catalogsApi.deleteCatalogDirect(metahubId, catalogId)
            }
        },
        onMutate: async ({ metahubId, hubId, catalogId }) => {
            const queryKeyPrefix = hubId ? metahubsQueryKeys.catalogs(metahubId, hubId) : metahubsQueryKeys.allCatalogs(metahubId)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: catalogId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('catalogs.deleteError', 'Failed to delete catalog'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('catalogs.deleteSuccess', 'Catalog deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(
                queryClient,
                ['catalogs'],
                metahubsQueryKeys.allCatalogs(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.hubId) {
                safeInvalidateQueries(queryClient, ['catalogs'], metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId))
            }
        }
    })
}

export function useCopyCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['catalogs', 'copy'],
        mutationFn: async ({ metahubId, catalogId, data }: CopyCatalogParams) => {
            const response = await catalogsApi.copyCatalog(metahubId, catalogId, data)
            return response.data
        },
        onMutate: async ({ metahubId, catalogId, data }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allCatalogs(metahubId)
            const existingCatalog = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === catalogId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: catalogId,
                entitySegment: 'catalogs',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (hubId) => metahubsQueryKeys.catalogs(metahubId, hubId),
                knownHubIds: Array.isArray(existingCatalog?.hubs)
                    ? existingCatalog.hubs
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((hubId): hubId is string => Boolean(hubId))
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
            enqueueSnackbar(error.message || t('catalogs.copyError', 'Failed to copy catalog'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allCatalogs(variables.metahubId)],
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('catalogs.copySuccess', 'Catalog copied'), { variant: 'success' })
        },
        onSettled: async (copiedCatalog, _error, variables) => {
            // Use active refetch to ensure copied entity is visible
            if (queryClient.isMutating({ mutationKey: ['catalogs'] }) <= 1) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId), refetchType: 'inactive' })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId), refetchType: 'inactive' })
                invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
                if (copiedCatalog && Array.isArray(copiedCatalog.hubs)) {
                    for (const hub of copiedCatalog.hubs as Array<{ id: string }>) {
                        queryClient.invalidateQueries({
                            queryKey: metahubsQueryKeys.catalogs(variables.metahubId, hub.id),
                            refetchType: 'inactive'
                        })
                    }
                }
            }
        }
    })
}

export function useReorderCatalog() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['catalogs', 'reorder'],
        mutationFn: async ({ metahubId, hubId, catalogId, newSortOrder }: ReorderCatalogParams) => {
            const response = await catalogsApi.reorderCatalog(metahubId, catalogId, newSortOrder, hubId)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                          variables.catalogId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allCatalogs(variables.metahubId),
                          variables.catalogId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allCatalogs(variables.metahubId),
                          variables.catalogId,
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
                ['catalogs'],
                metahubsQueryKeys.allCatalogs(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            invalidateCatalogCompatibilityEntityQueries(queryClient, variables.metahubId)
            if (variables.hubId) {
                safeInvalidateQueriesInactive(queryClient, ['catalogs'], metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId))
            }
        }
    })
}
