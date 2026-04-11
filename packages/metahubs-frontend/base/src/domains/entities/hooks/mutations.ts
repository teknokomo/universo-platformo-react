import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'

import { invalidateEntitiesQueries, invalidateEntityTypesQueries } from '../../shared'
import * as entitiesApi from '../api'

type EntityTypeCreateVariables = {
    metahubId: string
    data: entitiesApi.EntityTypePayload
}

type EntityTypeUpdateVariables = {
    metahubId: string
    entityTypeId: string
    data: entitiesApi.UpdateEntityTypePayload
}

type EntityTypeDeleteVariables = {
    metahubId: string
    entityTypeId: string
}

type EntityCreateVariables = {
    metahubId: string
    data: entitiesApi.EntityInstancePayload
}

type EntityUpdateVariables = {
    metahubId: string
    entityId: string
    data: entitiesApi.UpdateEntityInstancePayload
}

type EntityDeleteVariables = {
    metahubId: string
    entityId: string
    kind: string
}

type EntityRestoreVariables = {
    metahubId: string
    entityId: string
    kind: string
}

type EntityPermanentDeleteVariables = {
    metahubId: string
    entityId: string
    kind: string
}

type EntityCopyVariables = {
    metahubId: string
    entityId: string
    kind: string
    data: entitiesApi.CopyEntityInstancePayload
}

type EntityReorderVariables = {
    metahubId: string
    kind: string
    entityId: string
    newSortOrder: number
}

const getErrorMessage = (error: unknown, fallback: string) => {
    if (error && typeof error === 'object' && 'response' in error) {
        const responseData = (error as { response?: { data?: { message?: string; error?: string } } }).response?.data
        if (typeof responseData?.message === 'string' && responseData.message.trim().length > 0) {
            return responseData.message
        }
        if (typeof responseData?.error === 'string' && responseData.error.trim().length > 0) {
            return responseData.error
        }
    }
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message
    }
    return fallback
}

export const useCreateEntityType = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entityTypes', 'create'],
        mutationFn: async ({ metahubId, data }: EntityTypeCreateVariables) => {
            const response = await entitiesApi.createEntityType(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEntityTypesQueries.all(queryClient, variables.metahubId)
            enqueueSnackbar(t('entities.createSuccess', 'Entity type created'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.createError', 'Failed to create entity type')), { variant: 'error' })
        }
    })
}

export const useUpdateEntityType = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entityTypes', 'update'],
        mutationFn: async ({ metahubId, entityTypeId, data }: EntityTypeUpdateVariables) => {
            const response = await entitiesApi.updateEntityType(metahubId, entityTypeId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEntityTypesQueries.all(queryClient, variables.metahubId)
            invalidateEntityTypesQueries.detail(queryClient, variables.metahubId, variables.entityTypeId)
            enqueueSnackbar(t('entities.updateSuccess', 'Entity type updated'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.updateError', 'Failed to update entity type')), { variant: 'error' })
        }
    })
}

export const useDeleteEntityType = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entityTypes', 'delete'],
        mutationFn: async ({ metahubId, entityTypeId }: EntityTypeDeleteVariables) => {
            await entitiesApi.deleteEntityType(metahubId, entityTypeId)
        },
        onSuccess: (_data, variables) => {
            invalidateEntityTypesQueries.all(queryClient, variables.metahubId)
            enqueueSnackbar(t('entities.deleteSuccess', 'Entity type deleted'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.deleteError', 'Failed to delete entity type')), { variant: 'error' })
        }
    })
}

export const useCreateEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'create'],
        mutationFn: async ({ metahubId, data }: EntityCreateVariables) => {
            const response = await entitiesApi.createEntityInstance(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.data.kind)
            enqueueSnackbar(t('entities.instances.createSuccess', 'Entity created'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.createError', 'Failed to create entity')), { variant: 'error' })
        }
    })
}

export const useUpdateEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'update'],
        mutationFn: async ({ metahubId, entityId, data }: EntityUpdateVariables) => {
            const response = await entitiesApi.updateEntityInstance(metahubId, entityId, data)
            return response.data
        },
        onSuccess: (data, variables) => {
            const kind = typeof data?.kind === 'string' ? data.kind : undefined
            if (kind) {
                invalidateEntitiesQueries.all(queryClient, variables.metahubId, kind)
            }
            invalidateEntitiesQueries.detail(queryClient, variables.metahubId, variables.entityId)
            enqueueSnackbar(t('entities.instances.updateSuccess', 'Entity updated'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.updateError', 'Failed to update entity')), { variant: 'error' })
        }
    })
}

export const useDeleteEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'delete'],
        mutationFn: async ({ metahubId, entityId }: EntityDeleteVariables) => {
            await entitiesApi.deleteEntityInstance(metahubId, entityId)
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.kind)
            enqueueSnackbar(t('entities.instances.deleteSuccess', 'Entity deleted'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.deleteError', 'Failed to delete entity')), { variant: 'error' })
        }
    })
}

export const useRestoreEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'restore'],
        mutationFn: async ({ metahubId, entityId }: EntityRestoreVariables) => {
            await entitiesApi.restoreEntityInstance(metahubId, entityId)
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.kind)
            enqueueSnackbar(t('entities.instances.restoreSuccess', 'Entity restored'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.restoreError', 'Failed to restore entity')), { variant: 'error' })
        }
    })
}

export const usePermanentDeleteEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'deletePermanent'],
        mutationFn: async ({ metahubId, entityId }: EntityPermanentDeleteVariables) => {
            await entitiesApi.permanentlyDeleteEntityInstance(metahubId, entityId)
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.kind)
            enqueueSnackbar(t('entities.instances.deletePermanentSuccess', 'Entity permanently deleted'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.deletePermanentError', 'Failed to permanently delete entity')), {
                variant: 'error'
            })
        }
    })
}

export const useCopyEntityInstance = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'copy'],
        mutationFn: async ({ metahubId, entityId, data }: EntityCopyVariables) => {
            const response = await entitiesApi.copyEntityInstance(metahubId, entityId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.kind)
            enqueueSnackbar(t('entities.instances.copySuccess', 'Entity copied'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.copyError', 'Failed to copy entity')), { variant: 'error' })
        }
    })
}

export const useReorderEntityInstances = () => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['entities', 'reorder'],
        mutationFn: async ({ metahubId, kind, entityId, newSortOrder }: EntityReorderVariables) => {
            const response = await entitiesApi.reorderEntityInstances(metahubId, kind, entityId, newSortOrder)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEntitiesQueries.all(queryClient, variables.metahubId, variables.kind)
            enqueueSnackbar(t('entities.instances.reorderSuccess', 'Entity order updated'), { variant: 'success' })
        },
        onError: (error) => {
            enqueueSnackbar(getErrorMessage(error, t('entities.instances.reorderError', 'Failed to reorder entities')), {
                variant: 'error'
            })
        }
    })
}
