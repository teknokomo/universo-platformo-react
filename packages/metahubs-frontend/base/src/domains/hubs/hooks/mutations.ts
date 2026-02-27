import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { HubLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as hubsApi from '../api'
import type { HubCopyInput } from '../api'

interface CreateHubParams {
    metahubId: string
    data: HubLocalizedPayload & { sortOrder?: number }
}

interface UpdateHubParams {
    metahubId: string
    hubId: string
    data: HubLocalizedPayload & { sortOrder?: number }
}

interface DeleteHubParams {
    metahubId: string
    hubId: string
}

interface CopyHubParams {
    metahubId: string
    hubId: string
    data: HubCopyInput
}

export function useCreateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateHubParams) => {
            const response = await hubsApi.createHub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('hubs.createSuccess', 'Hub created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.createError', 'Failed to create hub'), { variant: 'error' })
        }
    })
}

export function useUpdateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: UpdateHubParams) => {
            const response = await hubsApi.updateHub(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('hubs.updateSuccess', 'Hub updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.updateError', 'Failed to update hub'), { variant: 'error' })
        }
    })
}

export function useDeleteHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId }: DeleteHubParams) => {
            await hubsApi.deleteHub(metahubId, hubId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('hubs.deleteSuccess', 'Hub deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.deleteError', 'Failed to delete hub'), { variant: 'error' })
        }
    })
}

export function useCopyHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: CopyHubParams) => {
            const response = await hubsApi.copyHub(metahubId, hubId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            ])
            enqueueSnackbar(t('hubs.copySuccess', 'Hub copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.copyError', 'Failed to copy hub'), { variant: 'error' })
        }
    })
}
