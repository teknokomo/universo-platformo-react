import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import * as connectorMetahubsApi from '../api/connectorMetahubs'
import { applicationsQueryKeys } from '../api/queryKeys'

/**
 * Query key factory for connector metahubs
 */
export const connectorMetahubsQueryKeys = {
    all: ['connectorMetahubs'] as const,
    byConnector: (applicationId: string, connectorId: string) =>
        [...connectorMetahubsQueryKeys.all, applicationId, connectorId] as const,
    availableMetahubs: ['availableMetahubs'] as const,
}

/**
 * Hook to fetch metahubs linked to a connector
 */
export function useConnectorMetahubs(applicationId: string, connectorId: string) {
    return useQuery({
        queryKey: connectorMetahubsQueryKeys.byConnector(applicationId, connectorId),
        queryFn: () => connectorMetahubsApi.listConnectorMetahubs(applicationId, connectorId),
        enabled: Boolean(applicationId && connectorId),
    })
}

/**
 * Hook to fetch all available metahubs for selection
 */
export function useAvailableMetahubs() {
    return useQuery({
        queryKey: connectorMetahubsQueryKeys.availableMetahubs,
        queryFn: connectorMetahubsApi.listAvailableMetahubs,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    })
}

/**
 * Hook to link a metahub to a connector
 */
export function useLinkMetahub(applicationId: string, connectorId: string) {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: ({ metahubId, sortOrder = 0 }: { metahubId: string; sortOrder?: number }) =>
            connectorMetahubsApi.linkMetahub(applicationId, connectorId, metahubId, sortOrder),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: connectorMetahubsQueryKeys.byConnector(applicationId, connectorId),
            })
            enqueueSnackbar(t('connectors.metahubs.linkSuccess', 'Metahub linked successfully'), {
                variant: 'success',
            })
        },
        onError: () => {
            enqueueSnackbar(t('connectors.metahubs.linkError', 'Failed to link metahub'), {
                variant: 'error',
            })
        },
    })
}

/**
 * Hook to unlink a metahub from a connector
 */
export function useUnlinkMetahub(applicationId: string, connectorId: string) {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: (linkId: string) =>
            connectorMetahubsApi.unlinkMetahub(applicationId, connectorId, linkId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: connectorMetahubsQueryKeys.byConnector(applicationId, connectorId),
            })
            enqueueSnackbar(t('connectors.metahubs.unlinkSuccess', 'Metahub unlinked successfully'), {
                variant: 'success',
            })
        },
        onError: () => {
            enqueueSnackbar(t('connectors.metahubs.unlinkError', 'Failed to unlink metahub'), {
                variant: 'error',
            })
        },
    })
}
