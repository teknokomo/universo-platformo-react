import { useMemo } from 'react'
import { CircularProgress, Box, Typography, Alert, Stack } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import { useTranslation } from 'react-i18next'
import { useConnectorMetahubs, useAvailableMetahubs } from '../hooks/useConnectorMetahubs'
import { MetahubSelectionPanel } from './MetahubSelectionPanel'

export interface ConnectorMetahubInfoWrapperProps {
    /** Application ID for the connector */
    applicationId: string
    /** Connector ID to fetch metahub links for */
    connectorId: string
    /** Current UI locale for display */
    uiLocale?: string
}

/**
 * Wrapper component that loads metahub data and renders MetahubSelectionPanel.
 * This allows lazy loading of metahub relationships when the edit dialog opens.
 * 
 * Currently shows a locked (disabled) interface since metahub editing is not
 * yet supported. The locked banner explains this to users.
 */
export const ConnectorMetahubInfoWrapper = ({
    applicationId,
    connectorId,
    uiLocale = 'en'
}: ConnectorMetahubInfoWrapperProps) => {
    const { t } = useTranslation('applications')

    const { 
        data: connectorMetahubsResponse, 
        isLoading: isLoadingLinked,
        isError: isErrorLinked
    } = useConnectorMetahubs(applicationId, connectorId)

    const {
        data: availableMetahubs = [],
        isLoading: isLoadingAvailable,
        isError: isErrorAvailable
    } = useAvailableMetahubs()

    // Extract items array from response - API returns ConnectorMetahubsResponse with items field
    const linkedMetahubs = connectorMetahubsResponse?.items ?? []
    
    // Convert linked metahubs to selected IDs
    const selectedMetahubIds = useMemo(
        () => linkedMetahubs.map(lm => lm.metahubId),
        [linkedMetahubs]
    )

    const isLoading = isLoadingLinked || isLoadingAvailable

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                <Typography color="text.secondary">
                    {t('common.loading', 'Loading...')}
                </Typography>
            </Box>
        )
    }

    if (isErrorLinked || isErrorAvailable) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography color="error">
                    {t('connectors.metahubs.loadError', 'Failed to load metahub information')}
                </Typography>
            </Box>
        )
    }

    // No-op handlers since the panel is disabled
    const handleSelectionChange = () => {}
    const handleRequiredChange = () => {}
    const handleSingleChange = () => {}

    return (
        <Stack spacing={2}>
            {/* Info alert about locked settings */}
            <Alert severity="info" icon={<InfoIcon />}>
                {t('connectors.metahubInfo.locked', 'Связи с метахабами и ограничения сейчас заблокированы. Эта функциональность будет доступна в будущем обновлении.')}
            </Alert>

            <MetahubSelectionPanel
                availableMetahubs={availableMetahubs}
                selectedMetahubIds={selectedMetahubIds}
                onSelectionChange={handleSelectionChange}
                isRequiredMetahub={true}
                onRequiredMetahubChange={handleRequiredChange}
                isSingleMetahub={true}
                onSingleMetahubChange={handleSingleChange}
                disabled={true}
                uiLocale={uiLocale}
            />
        </Stack>
    )
}
