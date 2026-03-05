import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../shared'
import * as elementsApi from '../api'
import type { ElementCopyOptions } from '@universo/types'

interface BaseElementScope {
    metahubId: string
    hubId?: string
    catalogId: string
}

interface CreateElementParams extends BaseElementScope {
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

interface UpdateElementParams extends BaseElementScope {
    elementId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

interface DeleteElementParams extends BaseElementScope {
    elementId: string
}

interface CopyElementParams extends BaseElementScope {
    elementId: string
    data?: Partial<ElementCopyOptions>
}

interface MoveElementParams extends BaseElementScope {
    elementId: string
    direction: 'up' | 'down'
}

interface ReorderElementParams extends BaseElementScope {
    elementId: string
    newSortOrder: number
}

const invalidateElementScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseElementScope): Promise<void> => {
    if (variables.hubId) {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
        })
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
    } else {
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId) })
    }
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
}

export function useCreateElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateElementParams) => {
            if (hubId) {
                const response = await elementsApi.createElement(metahubId, hubId, catalogId, data)
                return response.data
            }
            const response = await elementsApi.createElementDirect(metahubId, catalogId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
            enqueueSnackbar(t('elements.createSuccess', 'Element created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.createError', 'Failed to create element'), { variant: 'error' })
        }
    })
}

export function useUpdateElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, data }: UpdateElementParams) => {
            if (hubId) {
                const response = await elementsApi.updateElement(metahubId, hubId, catalogId, elementId, data)
                return response.data
            }
            const response = await elementsApi.updateElementDirect(metahubId, catalogId, elementId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
            enqueueSnackbar(t('elements.updateSuccess', 'Element updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.updateError', 'Failed to update element'), { variant: 'error' })
        }
    })
}

export function useDeleteElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, elementId }: DeleteElementParams) => {
            if (hubId) {
                await elementsApi.deleteElement(metahubId, hubId, catalogId, elementId)
            } else {
                await elementsApi.deleteElementDirect(metahubId, catalogId, elementId)
            }
        },
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
            enqueueSnackbar(t('elements.deleteSuccess', 'Element deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.deleteError', 'Failed to delete element'), { variant: 'error' })
        }
    })
}

export function useMoveElement() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, direction }: MoveElementParams) => {
            if (hubId) {
                const response = await elementsApi.moveElement(metahubId, hubId, catalogId, elementId, direction)
                return response.data
            }
            const response = await elementsApi.moveElementDirect(metahubId, catalogId, elementId, direction)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
        }
    })
}

export function useReorderElement() {
    const queryClient = useQueryClient()

    return useMutation({
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
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
        }
    })
}

export function useCopyElement() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, elementId, data }: CopyElementParams) => {
            if (hubId) {
                const response = await elementsApi.copyElement(metahubId, hubId, catalogId, elementId, data)
                return response.data
            }
            const response = await elementsApi.copyElementDirect(metahubId, catalogId, elementId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateElementScopes(queryClient, variables)
            enqueueSnackbar(t('elements.copySuccess', 'Element copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.copyError', 'Failed to copy element'), { variant: 'error' })
        }
    })
}
