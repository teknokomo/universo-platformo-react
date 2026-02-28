import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { metahubsQueryKeys } from '../../shared'
import { createPublicationVersion, updatePublicationVersion, activatePublicationVersion, deletePublicationVersion } from '../api'
import type { CreateVersionPayload, UpdateVersionPayload } from '../api'

interface CreateVersionParams {
    metahubId: string
    publicationId: string
    data: CreateVersionPayload
}

interface UpdateVersionParams {
    metahubId: string
    publicationId: string
    versionId: string
    data: UpdateVersionPayload
}

interface ActivateVersionParams {
    metahubId: string
    publicationId: string
    versionId: string
}

interface DeleteVersionParams {
    metahubId: string
    publicationId: string
    versionId: string
}

export function useCreatePublicationVersion() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, data }: CreateVersionParams) => {
            return createPublicationVersion(metahubId, publicationId, data)
        },
        onSuccess: (result, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationVersionsList(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.versions.createSuccess', 'Version created'), { variant: 'success' })
            if (result?.isDuplicate) {
                enqueueSnackbar(t('publications.versions.duplicateWarning', 'Version matches the previous one'), {
                    variant: 'warning'
                })
            }
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.createError', 'Failed to create version'), { variant: 'error' })
        }
    })
}

export function useUpdatePublicationVersion() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, versionId, data }: UpdateVersionParams) => {
            return updatePublicationVersion(metahubId, publicationId, versionId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationVersionsList(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.versions.updateSuccess', 'Version updated'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.updateError', 'Failed to update version'), { variant: 'error' })
        }
    })
}

export function useActivatePublicationVersion() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, versionId }: ActivateVersionParams) => {
            return activatePublicationVersion(metahubId, publicationId, versionId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationVersionsList(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.versions.activateSuccess', 'Version activated'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.activateError', 'Failed to activate version'), { variant: 'error' })
        }
    })
}

export function useDeletePublicationVersion() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, versionId }: DeleteVersionParams) => {
            return deletePublicationVersion(metahubId, publicationId, versionId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationVersionsList(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('publications.versions.deleteSuccess', 'Version deleted'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('publications.versions.deleteError', 'Failed to delete version'), { variant: 'error' })
        }
    })
}
