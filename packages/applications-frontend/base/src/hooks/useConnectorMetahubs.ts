import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import * as connectorMetahubsApi from '../api/connectorMetahubs'
import * as connectorsApi from '../api/connectors'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { Connector, MetahubSummary } from '../types'

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

/**
 * Result type for useConnectorDetails
 */
export interface ConnectorDetailsResult {
    connector: Connector
    metahub: MetahubSummary | null
}

/**
 * Hook to fetch connector details along with its linked metahub
 * Used by ConnectorBoard for schema sync functionality
 */
export function useConnectorDetails(
    applicationId: string,
    connectorId: string,
    options?: { enabled?: boolean }
) {
    return useQuery<ConnectorDetailsResult, Error>({
        queryKey: [...applicationsQueryKeys.connectorDetail(applicationId, connectorId), 'withMetahub'],
        queryFn: async (): Promise<ConnectorDetailsResult> => {
            // Fetch connector details
            const connectorResponse = await connectorsApi.getConnector(applicationId, connectorId)
            const connector = connectorResponse.data

            // Fetch linked metahubs
            const metahubsData = await connectorMetahubsApi.listConnectorMetahubs(applicationId, connectorId)
            const linkedMetahubs = metahubsData.items || []

            // Get the first linked metahub (primary one for sync)
            // Backend now returns metahub object nested in each ConnectorMetahub item
            const metahub = linkedMetahubs.length > 0 ? linkedMetahubs[0].metahub ?? null : null

            return { connector, metahub }
        },
        enabled: options?.enabled !== false && Boolean(applicationId) && Boolean(connectorId),
        staleTime: 30 * 1000
    })
}

/**
 * Hook to fetch the first (default) connector for an application with its linked metahub
 * Used by ConnectorBoard when navigating from Publication (without connectorId in URL)
 */
export function useFirstConnectorDetails(
    applicationId: string,
    options?: { enabled?: boolean }
) {
    return useQuery<ConnectorDetailsResult, Error>({
        queryKey: [...applicationsQueryKeys.connectors(applicationId), 'first', 'withMetahub'],
        queryFn: async (): Promise<ConnectorDetailsResult> => {
            // Fetch list of connectors for this application
            const connectorsResponse = await connectorsApi.listConnectors(applicationId, { limit: 1 })
            const connectors = connectorsResponse.items || []

            if (connectors.length === 0) {
                throw new Error('No connectors found for this application')
            }

            const connector = connectors[0]

            // Fetch linked metahubs for this connector
            const metahubsData = await connectorMetahubsApi.listConnectorMetahubs(applicationId, connector.id)
            const linkedMetahubs = metahubsData.items || []

            // Get the first linked metahub (primary one for sync)
            // Backend now returns metahub object nested in each ConnectorMetahub item
            const metahub = linkedMetahubs.length > 0 ? linkedMetahubs[0].metahub ?? null : null

            return { connector, metahub }
        },
        enabled: options?.enabled !== false && Boolean(applicationId),
        staleTime: 30 * 1000
    })
}
