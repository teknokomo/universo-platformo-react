import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import * as connectorPublicationsApi from '../api/connectorPublications'
import * as connectorsApi from '../api/connectors'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { Connector, PublicationSummary } from '../types'

/**
 * Query key factory for connector publications
 */
export const connectorPublicationsQueryKeys = {
    all: ['connectorPublications'] as const,
    byConnector: (applicationId: string, connectorId: string) =>
        [...connectorPublicationsQueryKeys.all, applicationId, connectorId] as const,
    availablePublications: ['availablePublications'] as const
}

/**
 * Hook to fetch publications linked to a connector
 */
export function useConnectorPublications(applicationId: string, connectorId: string) {
    return useQuery({
        queryKey: connectorPublicationsQueryKeys.byConnector(applicationId, connectorId),
        queryFn: () => connectorPublicationsApi.listConnectorPublications(applicationId, connectorId),
        enabled: Boolean(applicationId && connectorId)
    })
}

/**
 * Hook to fetch all available publications for selection
 */
export function useAvailablePublications() {
    return useQuery({
        queryKey: connectorPublicationsQueryKeys.availablePublications,
        queryFn: connectorPublicationsApi.listAvailablePublications,
        staleTime: 1000 * 60 * 5 // Cache for 5 minutes
    })
}

/**
 * Hook to link a publication to a connector
 */
export function useLinkPublication(applicationId: string, connectorId: string) {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: ({ publicationId, sortOrder = 0 }: { publicationId: string; sortOrder?: number }) =>
            connectorPublicationsApi.linkPublication(applicationId, connectorId, publicationId, sortOrder),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: connectorPublicationsQueryKeys.byConnector(applicationId, connectorId)
            })
            enqueueSnackbar(t('connectors.publications.linkSuccess', 'Publication linked successfully'), {
                variant: 'success'
            })
        },
        onError: () => {
            enqueueSnackbar(t('connectors.publications.linkError', 'Failed to link publication'), {
                variant: 'error'
            })
        }
    })
}

/**
 * Hook to unlink a publication from a connector
 */
export function useUnlinkPublication(applicationId: string, connectorId: string) {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: (linkId: string) => connectorPublicationsApi.unlinkPublication(applicationId, connectorId, linkId),
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: connectorPublicationsQueryKeys.byConnector(applicationId, connectorId)
            })
            enqueueSnackbar(t('connectors.publications.unlinkSuccess', 'Publication unlinked successfully'), {
                variant: 'success'
            })
        },
        onError: () => {
            enqueueSnackbar(t('connectors.publications.unlinkError', 'Failed to unlink publication'), {
                variant: 'error'
            })
        }
    })
}

/**
 * Result type for useConnectorDetails
 */
export interface ConnectorDetailsResult {
    connector: Connector
    publication: PublicationSummary | null
}

/**
 * Hook to fetch connector details along with its linked publication
 * Used by ConnectorBoard for schema sync functionality
 */
export function useConnectorDetails(applicationId: string, connectorId: string, options?: { enabled?: boolean }) {
    return useQuery<ConnectorDetailsResult, Error>({
        queryKey: [...applicationsQueryKeys.connectorDetail(applicationId, connectorId), 'withPublication'],
        queryFn: async (): Promise<ConnectorDetailsResult> => {
            // Fetch connector details
            const connectorResponse = await connectorsApi.getConnector(applicationId, connectorId)
            const connector = connectorResponse.data

            // Fetch linked publications
            const publicationsData = await connectorPublicationsApi.listConnectorPublications(applicationId, connectorId)
            const linkedPublications = publicationsData.items || []

            // Get the first linked publication (primary one for sync)
            // Backend now returns publication object nested in each ConnectorPublication item
            const publication = linkedPublications.length > 0 ? linkedPublications[0].publication ?? null : null

            return { connector, publication }
        },
        enabled: options?.enabled !== false && Boolean(applicationId) && Boolean(connectorId),
        staleTime: 30 * 1000
    })
}

/**
 * Hook to fetch the first (default) connector for an application with its linked publication
 * Used by ConnectorBoard when navigating from Publication (without connectorId in URL)
 */
export function useFirstConnectorDetails(applicationId: string, options?: { enabled?: boolean }) {
    return useQuery<ConnectorDetailsResult, Error>({
        queryKey: [...applicationsQueryKeys.connectors(applicationId), 'first', 'withPublication'],
        queryFn: async (): Promise<ConnectorDetailsResult> => {
            // Fetch list of connectors for this application
            const connectorsResponse = await connectorsApi.listConnectors(applicationId, { limit: 1 })
            const connectors = connectorsResponse.items || []

            if (connectors.length === 0) {
                throw new Error('No connectors found for this application')
            }

            const connector = connectors[0]

            // Fetch linked publications for this connector
            const publicationsData = await connectorPublicationsApi.listConnectorPublications(applicationId, connector.id)
            const linkedPublications = publicationsData.items || []

            // Get the first linked publication (primary one for sync)
            // Backend now returns publication object nested in each ConnectorPublication item
            const publication = linkedPublications.length > 0 ? linkedPublications[0].publication ?? null : null

            return { connector, publication }
        },
        enabled: options?.enabled !== false && Boolean(applicationId),
        staleTime: 30 * 1000
    })
}
