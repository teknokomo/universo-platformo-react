/**
 * MetaHub mutations hooks
 *
 * This file contains all mutation hooks for the metahubs module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'

import * as metahubsApi from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateMetahubParams {
    id: string
    data: { name?: string; description?: string }
}

interface CreateEntityParams {
    metahubId: string
    data: { name: string; codename: string; description?: string }
}

interface DeleteEntityParams {
    metahubId: string
    entityId: string
}

interface CreateFieldParams {
    metahubId: string
    entityId: string
    data: {
        name: string
        codename: string
        fieldType: string
        isRequired?: boolean
        config?: Record<string, unknown>
    }
}

interface DeleteFieldParams {
    metahubId: string
    entityId: string
    fieldId: string
}

interface CreateRecordParams {
    metahubId: string
    entityId: string
    data: Record<string, unknown>
}

interface UpdateRecordParams {
    metahubId: string
    entityId: string
    recordId: string
    data: Record<string, unknown>
}

interface DeleteRecordParams {
    metahubId: string
    entityId: string
    recordId: string
}

// ============================================================================
// MetaHub Mutations
// ============================================================================

/**
 * Hook for creating a metahub
 */
export function useCreateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            return metahubsApi.createMetahub(data)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('notifications.metahubCreated', 'MetaHub created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a metahub
 */
export function useUpdateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateMetahubParams) => {
            return metahubsApi.updateMetahub(id, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.id) })
            enqueueSnackbar(t('notifications.metahubUpdated', 'MetaHub updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a metahub
 */
export function useDeleteMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (id: string) => {
            return metahubsApi.deleteMetahub(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('notifications.metahubDeleted', 'MetaHub deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Entity Mutations
// ============================================================================

/**
 * Hook for creating an entity
 */
export function useCreateEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateEntityParams) => {
            return metahubsApi.createEntity(metahubId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entities(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('notifications.entityCreated', 'Entity created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an entity
 */
export function useDeleteEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId }: DeleteEntityParams) => {
            return metahubsApi.deleteEntity(metahubId, entityId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entities(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('notifications.entityDeleted', 'Entity deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Field Mutations
// ============================================================================

/**
 * Hook for creating a field
 */
export function useCreateField() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId, data }: CreateFieldParams) => {
            return metahubsApi.createField(metahubId, entityId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entityDetail(variables.metahubId, variables.entityId) })
            enqueueSnackbar(t('notifications.fieldCreated', 'Field created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a field
 */
export function useDeleteField() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId, fieldId }: DeleteFieldParams) => {
            return metahubsApi.deleteField(metahubId, entityId, fieldId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.entityDetail(variables.metahubId, variables.entityId) })
            enqueueSnackbar(t('notifications.fieldDeleted', 'Field deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Record Mutations
// ============================================================================

/**
 * Hook for creating a record
 */
export function useCreateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId, data }: CreateRecordParams) => {
            return metahubsApi.createRecord(metahubId, entityId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.entityId) })
            enqueueSnackbar(t('notifications.recordCreated', 'Record created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a record
 */
export function useUpdateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId, recordId, data }: UpdateRecordParams) => {
            return metahubsApi.updateRecord(metahubId, entityId, recordId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.entityId) })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.recordDetail(variables.metahubId, variables.entityId, variables.recordId)
            })
            enqueueSnackbar(t('notifications.recordUpdated', 'Record updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a record
 */
export function useDeleteRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, entityId, recordId }: DeleteRecordParams) => {
            return metahubsApi.deleteRecord(metahubId, entityId, recordId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.entityId) })
            enqueueSnackbar(t('notifications.recordDeleted', 'Record deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}
