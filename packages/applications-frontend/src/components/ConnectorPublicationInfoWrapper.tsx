import { useMemo } from 'react'
import { CircularProgress, Box, Typography, Alert, Stack } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import { useTranslation } from 'react-i18next'
import { useConnectorPublications, useAvailablePublications } from '../hooks/useConnectorPublications'
import { PublicationSelectionPanel } from './PublicationSelectionPanel'

export interface ConnectorPublicationInfoWrapperProps {
    /** Application ID for the connector */
    applicationId: string
    /** Connector ID to fetch metahub links for */
    connectorId: string
    /** Current UI locale for display */
    uiLocale?: string
}

/**
 * Wrapper component that loads metahub data and renders PublicationSelectionPanel.
 * This allows lazy loading of metahub relationships when the edit dialog opens.
 *
 * Internally works with publications (Connector -> Publication -> Metahub), but
 * UI shows Metahub names to users.
 *
 * Currently shows a locked (disabled) interface since metahub editing is not
 * yet supported. The locked banner explains this to users.
 */
export const ConnectorPublicationInfoWrapper = ({ applicationId, connectorId, uiLocale = 'en' }: ConnectorPublicationInfoWrapperProps) => {
    const { t } = useTranslation('applications')
    const noop = () => undefined

    const {
        data: connectorPublicationsResponse,
        isLoading: isLoadingLinked,
        isError: isErrorLinked
    } = useConnectorPublications(applicationId, connectorId)

    const { data: availablePublications = [], isLoading: isLoadingAvailable, isError: isErrorAvailable } = useAvailablePublications()

    const linkedPublications = connectorPublicationsResponse?.items
    const selectedPublicationIds = useMemo(
        () => (linkedPublications ?? []).map((linkedPublication) => linkedPublication.publicationId),
        [linkedPublications]
    )

    const isLoading = isLoadingLinked || isLoadingAvailable

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography color='text.secondary'>{t('common.loading', 'Loading...')}</Typography>
            </Box>
        )
    }

    if (isErrorLinked || isErrorAvailable) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color='error'>{t('connectors.metahubs.loadError', 'Failed to load metahub information')}</Typography>
            </Box>
        )
    }

    // No-op handlers since the panel is disabled
    return (
        <Stack spacing={2}>
            {/* Info alert about locked settings */}
            <Alert severity='info' icon={<InfoIcon />}>
                {t(
                    'connectors.metahubInfo.locked',
                    'Metahub links and constraints are currently locked. This functionality will be available in a future update.'
                )}
            </Alert>

            <PublicationSelectionPanel
                availablePublications={availablePublications}
                selectedPublicationIds={selectedPublicationIds}
                onSelectionChange={noop}
                isRequiredPublication={true}
                onRequiredPublicationChange={noop}
                isSinglePublication={true}
                onSinglePublicationChange={noop}
                disabled={true}
                uiLocale={uiLocale}
            />
        </Stack>
    )
}

export default ConnectorPublicationInfoWrapper
