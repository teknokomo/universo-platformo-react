import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { metahubsQueryKeys } from '../../shared'
import * as recordsApi from '../api'

interface CreateRecordParams {
    metahubId: string
    hubId?: string
    catalogId: string
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

interface UpdateRecordParams {
    metahubId: string
    hubId?: string
    catalogId: string
    recordId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

interface DeleteRecordParams {
    metahubId: string
    hubId?: string
    catalogId: string
    recordId: string
}

export function useCreateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateRecordParams) => {
            if (hubId) {
                const response = await recordsApi.createRecord(metahubId, hubId, catalogId, data)
                return response.data
            }
            const response = await recordsApi.createRecordDirect(metahubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('records.createSuccess', 'Record created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.createError', 'Failed to create record'), { variant: 'error' })
        }
    })
}

export function useUpdateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, recordId, data }: UpdateRecordParams) => {
            if (hubId) {
                const response = await recordsApi.updateRecord(metahubId, hubId, catalogId, recordId, data)
                return response.data
            }
            const response = await recordsApi.updateRecordDirect(metahubId, catalogId, recordId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('records.updateSuccess', 'Record updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.updateError', 'Failed to update record'), { variant: 'error' })
        }
    })
}

export function useDeleteRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, recordId }: DeleteRecordParams) => {
            if (hubId) {
                await recordsApi.deleteRecord(metahubId, hubId, catalogId, recordId)
            } else {
                await recordsApi.deleteRecordDirect(metahubId, catalogId, recordId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('records.deleteSuccess', 'Record deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.deleteError', 'Failed to delete record'), { variant: 'error' })
        }
    })
}
