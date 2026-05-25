import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { metahubsQueryKeys } from '../../shared'
import { createPublicationApplication } from '../api'
import type { CreatePublicationApplicationPayload } from '../api'

// Cross-domain invalidation keys — mirrors applicationsQueryKeys from @universo/applications-frontend.
// Kept inline to avoid adding a cross-package dependency.
const applicationsQueryKeys = {
    all: ['applications'] as const,
    lists: () => [...applicationsQueryKeys.all, 'list'] as const
}

interface CreatePublicationApplicationParams {
    metahubId: string
    publicationId: string
    data: CreatePublicationApplicationPayload
}

export function useCreatePublicationApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, data }: CreatePublicationApplicationParams) => {
            return createPublicationApplication(metahubId, publicationId, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationApplicationsList(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId)
            })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            enqueueSnackbar(t('publications.applications.createSuccess', 'Application created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.applications.createError', 'Failed to create application'), {
                variant: 'error'
            })
        }
    })
}
