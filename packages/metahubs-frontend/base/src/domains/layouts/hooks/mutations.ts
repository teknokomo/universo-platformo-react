import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { MetahubLayoutLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as layoutsApi from '../api'

interface CreateLayoutParams {
    metahubId: string
    data: MetahubLayoutLocalizedPayload
}

interface UpdateLayoutParams {
    metahubId: string
    layoutId: string
    data: Partial<MetahubLayoutLocalizedPayload>
}

interface DeleteLayoutParams {
    metahubId: string
    layoutId: string
}

export function useCreateLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateLayoutParams) => {
            const response = await layoutsApi.createLayout(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layouts(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('layouts.createSuccess', 'Layout created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('layouts.createError', 'Failed to create layout'), { variant: 'error' })
        }
    })
}

export function useUpdateLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, layoutId, data }: UpdateLayoutParams) => {
            const response = await layoutsApi.updateLayout(metahubId, layoutId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layouts(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('layouts.updateSuccess', 'Layout updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('layouts.updateError', 'Failed to update layout'), { variant: 'error' })
        }
    })
}

export function useDeleteLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, layoutId }: DeleteLayoutParams) => {
            await layoutsApi.deleteLayout(metahubId, layoutId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layouts(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('layouts.deleteSuccess', 'Layout deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('layouts.deleteError', 'Failed to delete layout'), { variant: 'error' })
        }
    })
}
