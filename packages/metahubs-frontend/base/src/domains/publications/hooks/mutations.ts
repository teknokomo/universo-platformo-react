import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { metahubsQueryKeys } from '../../shared'
import * as publicationsApi from '../api'
import type { CreatePublicationPayload, UpdatePublicationPayload } from '../api'

// Applications query keys for cross-domain invalidation
const applicationsQueryKeys = {
    all: ['applications'] as const,
    lists: () => [...applicationsQueryKeys.all, 'list'] as const
}

interface CreatePublicationParams {
    metahubId: string
    data: CreatePublicationPayload
}

interface UpdatePublicationParams {
    metahubId: string
    publicationId: string
    data: UpdatePublicationPayload
}

interface SyncPublicationParams {
    metahubId: string
    publicationId: string
    confirmDestructive?: boolean
}

interface DeletePublicationParams {
    metahubId: string
    publicationId: string
}

export function useCreatePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreatePublicationParams) => {
            return publicationsApi.createPublication(metahubId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            // If autoCreateApplication was enabled, invalidate applications cache
            if (variables.data.autoCreateApplication) {
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            }
            enqueueSnackbar(t('publications.messages.createSuccess', 'Information base created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.messages.createError', 'Failed to create information base'), { variant: 'error' })
        }
    })
}

export function useUpdatePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, data }: UpdatePublicationParams) => {
            return publicationsApi.updatePublication(metahubId, publicationId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.messages.updateSuccess', 'Publication updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.messages.updateError', 'Failed to update publication'), { variant: 'error' })
        }
    })
}

export function useSyncPublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, confirmDestructive = false }: SyncPublicationParams) => {
            return publicationsApi.syncPublication(metahubId, publicationId, confirmDestructive)
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })

            if (data.status === 'pending_confirmation') {
                enqueueSnackbar(t('publications.messages.syncPending', 'Destructive changes detected. Confirm to proceed.'), { variant: 'warning' })
            } else {
                enqueueSnackbar(t('publications.messages.syncSuccess', 'Schema synchronized'), { variant: 'success' })
            }
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.messages.syncError', 'Schema sync failed'), { variant: 'error' })
        }
    })
}

export function useDeletePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId }: DeletePublicationParams) => {
            return publicationsApi.deletePublication(metahubId, publicationId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.messages.deleteSuccess', 'Information base deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.messages.deleteError', 'Failed to delete information base'), { variant: 'error' })
        }
    })
}
