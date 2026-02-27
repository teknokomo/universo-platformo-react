import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { metahubsQueryKeys } from '../../shared'
import * as elementsApi from '../api'
import type { ElementCopyOptions } from '@universo/types'

interface CreateElementParams {
    metahubId: string
    hubId?: string
    catalogId: string
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

interface UpdateElementParams {
    metahubId: string
    hubId?: string
    catalogId: string
    elementId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

interface DeleteElementParams {
    metahubId: string
    hubId?: string
    catalogId: string
    elementId: string
}

interface CopyElementParams {
    metahubId: string
    hubId?: string
    catalogId: string
    elementId: string
    data?: Partial<ElementCopyOptions>
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('elements.deleteSuccess', 'Element deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.deleteError', 'Failed to delete element'), { variant: 'error' })
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.elements(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.elementsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('elements.copySuccess', 'Element copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('elements.copyError', 'Failed to copy element'), { variant: 'error' })
        }
    })
}
