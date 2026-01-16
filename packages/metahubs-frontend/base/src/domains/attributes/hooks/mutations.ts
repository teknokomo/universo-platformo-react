import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { AttributeLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as attributesApi from '../api'

interface CreateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface UpdateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface DeleteAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
}

interface MoveAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    direction: 'up' | 'down'
}

export function useCreateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.createAttribute(
                    metahubId,
                    hubId,
                    catalogId,
                    data as Parameters<typeof attributesApi.createAttribute>[3]
                )
                return response.data
            }
            const response = await attributesApi.createAttributeDirect(
                metahubId,
                catalogId,
                data as Parameters<typeof attributesApi.createAttributeDirect>[2]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.createError', 'Failed to create attribute'), { variant: 'error' })
        }
    })
}

export function useUpdateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: UpdateAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.updateAttribute(
                    metahubId,
                    hubId,
                    catalogId,
                    attributeId,
                    data as Parameters<typeof attributesApi.updateAttribute>[4]
                )
                return response.data
            }
            const response = await attributesApi.updateAttributeDirect(
                metahubId,
                catalogId,
                attributeId,
                data as Parameters<typeof attributesApi.updateAttributeDirect>[3]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.updateSuccess', 'Attribute updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.updateError', 'Failed to update attribute'), { variant: 'error' })
        }
    })
}

export function useDeleteAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: DeleteAttributeParams) => {
            if (hubId) {
                await attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
            } else {
                await attributesApi.deleteAttributeDirect(metahubId, catalogId, attributeId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        }
    })
}

export function useMoveAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, direction }: MoveAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.moveAttribute(metahubId, hubId, catalogId, attributeId, direction)
                return response.data
            }
            const response = await attributesApi.moveAttributeDirect(metahubId, catalogId, attributeId, direction)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.moveSuccess', 'Attribute order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.moveError', 'Failed to update attribute order'), { variant: 'error' })
        }
    })
}
