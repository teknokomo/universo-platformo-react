import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { CatalogLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as catalogsApi from '../api'

interface CreateCatalogParams {
    metahubId: string
    hubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface CreateCatalogAtMetahubParams {
    metahubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface UpdateCatalogParams {
    metahubId: string
    hubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface UpdateCatalogAtMetahubParams {
    metahubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface DeleteCatalogParams {
    metahubId: string
    hubId?: string
    catalogId: string
    force?: boolean
}

export function useCreateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateCatalogAtMetahubParams) => {
            const response = await catalogsApi.createCatalogAtMetahub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            const hubIds = variables.data.hubIds ?? []
            hubIds.forEach((hubId: string) => {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, hubId) })
            })
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        }
    })
}

export function useCreateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: CreateCatalogParams) => {
            const response = await catalogsApi.createCatalog(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        }
    })
}

export function useUpdateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: UpdateCatalogParams) => {
            const response = await catalogsApi.updateCatalog(metahubId, hubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        }
    })
}

export function useUpdateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, catalogId, data }: UpdateCatalogAtMetahubParams) => {
            const response = await catalogsApi.updateCatalogAtMetahub(metahubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        }
    })
}

export function useDeleteCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, force }: DeleteCatalogParams) => {
            if (hubId) {
                await catalogsApi.deleteCatalog(metahubId, hubId, catalogId, force)
            } else {
                await catalogsApi.deleteCatalogDirect(metahubId, catalogId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.deleteSuccess', 'Catalog deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.deleteError', 'Failed to delete catalog'), { variant: 'error' })
        }
    })
}
