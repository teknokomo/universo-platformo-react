import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    rollbackOptimisticSnapshots,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../shared'
import * as elementsApi from '../api'
import type {
    BaseElementScope,
    CreateElementParams,
    UpdateElementParams,
    DeleteElementParams,
    CopyElementParams,
    MoveElementParams,
    ReorderElementParams
} from './mutationTypes'

const invalidateElementScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseElementScope): Promise<void> => {
    if (variables.hubId) {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId),
            refetchType: 'inactive'
        })
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
            refetchType: 'inactive'
        })
    } else {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId),
            refetchType: 'inactive'
        })
    }
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId),
        refetchType: 'inactive'
    })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId), refetchType: 'inactive' })
}

const getElementQueryKeyPrefix = (variables: BaseElementScope) =>
    variables.hubId
        ? metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
        : metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId)

export function useCreateElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['elements', 'create'],
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateElementParams) => {
            if (hubId) {
                const response = await elementsApi.createElement(metahubId, hubId, catalogId, data)
                return response.data
            }
            const response = await elementsApi.createElementDirect(metahubId, catalogId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getElementQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    data: variables.data.data,
                    ownerId: null,
                    sortOrder: optimisticSortOrder,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    ...makePendingMarkers('create')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getElementQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('elements.createSuccess', 'Element created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('elements.createError', 'Failed to create element'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useUpdateElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['elements', 'update'],
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, data }: UpdateElementParams) => {
            if (hubId) {
                const response = await elementsApi.updateElement(metahubId, hubId, catalogId, elementId, data)
                return response.data
            }
            const response = await elementsApi.updateElementDirect(metahubId, catalogId, elementId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getElementQueryKeyPrefix(variables),
                entityId: variables.elementId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getElementQueryKeyPrefix(variables) })
            confirmOptimisticUpdate(queryClient, getElementQueryKeyPrefix(variables), variables.elementId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('elements.updateSuccess', 'Element updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('elements.updateError', 'Failed to update element'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useDeleteElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['elements', 'delete'],
        mutationFn: async ({ metahubId, hubId, catalogId, elementId }: DeleteElementParams) => {
            if (hubId) {
                await elementsApi.deleteElement(metahubId, hubId, catalogId, elementId)
            } else {
                await elementsApi.deleteElementDirect(metahubId, catalogId, elementId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getElementQueryKeyPrefix(variables),
                entityId: variables.elementId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('elements.deleteSuccess', 'Element deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('elements.deleteError', 'Failed to delete element'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useMoveElement() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['elements', 'move'],
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, direction }: MoveElementParams) => {
            if (hubId) {
                const response = await elementsApi.moveElement(metahubId, hubId, catalogId, elementId, direction)
                return response.data
            }
            const response = await elementsApi.moveElementDirect(metahubId, catalogId, elementId, direction)
            return response.data
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useReorderElement() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['elements', 'reorder'],
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, newSortOrder }: ReorderElementParams) => {
            if (hubId) {
                const response = await elementsApi.reorderElement(metahubId, hubId, catalogId, elementId, newSortOrder)
                return response.data
            }
            const response = await elementsApi.reorderElementDirect(metahubId, catalogId, elementId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const snapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId),
                          variables.elementId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId),
                          variables.elementId,
                          variables.newSortOrder
                      )

            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.snapshots)
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useCopyElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['elements', 'copy'],
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, data }: CopyElementParams) => {
            if (hubId) {
                const response = await elementsApi.copyElement(metahubId, hubId, catalogId, elementId, data)
                return response.data
            }
            const response = await elementsApi.copyElementDirect(metahubId, catalogId, elementId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getElementQueryKeyPrefix(variables)
            const existingElement = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.elementId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingElement ?? {}),
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getElementQueryKeyPrefix(_variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            console.info('[optimistic-copy:elements] onSuccess', {
                metahubId: _variables.metahubId,
                catalogId: _variables.catalogId,
                elementId: _variables.elementId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('elements.copySuccess', 'Element copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('elements.copyError', 'Failed to copy element'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['elements'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
            console.info('[optimistic-copy:elements] onSettled', {
                metahubId: variables.metahubId,
                catalogId: variables.catalogId,
                elementId: variables.elementId,
                hasError: Boolean(_error)
            })
        }
    })
}
