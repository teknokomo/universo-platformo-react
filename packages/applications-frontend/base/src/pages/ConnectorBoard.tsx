/**
 * Universo Platformo | ConnectorBoard Component
 *
 * Displays connector details with schema sync functionality.
 * Adapted from metahubs PublicationBoard.
 *
 * This page is accessed via /a/:applicationId/admin/connector/:connectorId
 * It fetches the specific connector by ID.
 */

import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Typography,
    Stack,
    CircularProgress,
    Alert,
    Grid,
    Button,
    Card,
    CardContent,
    Chip,
    Divider
} from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import SyncIcon from '@mui/icons-material/Sync'
import StorageIcon from '@mui/icons-material/Storage'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import HistoryIcon from '@mui/icons-material/History'
import { useTranslation } from 'react-i18next'

// project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG } from '@universo/template-mui'
import { useConnectorDetails } from '../hooks/useConnectorPublications'
import { useSyncConnector } from '../hooks/mutations'
import { ConnectorDiffDialog } from '../components'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { getVLCString } from '../types'
import type { SchemaStatus } from '../types'

// ============================================================================
// Status Chip Component
// ============================================================================

interface StatusChipProps {
    status: SchemaStatus
}

const StatusChip = ({ status }: StatusChipProps) => {
    const { t } = useTranslation('applications')
    const statusConfig: Record<SchemaStatus, { color: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'; label: string }> = {
        draft: { color: 'default', label: t('connectors.status.draft', 'Draft') },
        pending: { color: 'primary', label: t('connectors.status.pending', 'Syncing...') },
        synced: { color: 'success', label: t('connectors.status.synced', 'Synced') },
        outdated: { color: 'warning', label: t('connectors.status.outdated', 'Outdated') },
        error: { color: 'error', label: t('connectors.status.error', 'Error') },
        update_available: { color: 'info', label: t('connectors.status.updateAvailable', 'Update Available') },
        maintenance: { color: 'warning', label: t('connectors.status.maintenance', 'Maintenance') }
    }
    const config = statusConfig[status] ?? statusConfig.draft
    return <Chip size="medium" color={config.color} label={config.label} />
}

// ============================================================================
// Info Card Component
// ============================================================================

interface InfoRowProps {
    label: string
    value: React.ReactNode
}

const InfoRow = ({ label, value }: InfoRowProps) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
        <Typography variant="body2" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {value}
        </Typography>
    </Box>
)

// ============================================================================
// Main Component
// ============================================================================

const ConnectorBoard = () => {
    const { applicationId, connectorId } = useParams<{ applicationId: string; connectorId: string }>()
    const { t, i18n } = useTranslation('applications')
    const navigate = useNavigate()

    // Diff dialog state
    const [diffDialogOpen, setDiffDialogOpen] = useState(false)

    // Fetch application details for schema status
    const { data: application, isLoading: isAppLoading } = useApplicationDetails(applicationId ?? '', {
        enabled: Boolean(applicationId)
    })

    // Fetch the connector by ID with linked metahub info
    const {
        data: connectorData,
        isLoading: isConnectorLoading,
        error,
        isError
    } = useConnectorDetails(applicationId ?? '', connectorId ?? '', {
        enabled: Boolean(applicationId) && Boolean(connectorId)
    })

    // Combined loading state
    const isLoading = isAppLoading || isConnectorLoading

    // Sync mutation
    const syncMutation = useSyncConnector()

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems="center" minHeight={400} justifyContent="center">
                    <CircularProgress size={40} />
                    <Typography variant="body2" color="text.secondary">
                        {t('common.loading', 'Loading...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (isError || !connectorData?.connector) {
        const errorMessage = error instanceof Error
            ? error.message
            : t('errors.connectionFailed', 'Failed to load data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt="Error loading connector"
                    title={t('errors.connectionFailed', 'Failed to load data')}
                />
                <Alert severity="error" sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    const { connector, publication } = connectorData
    const connectorName = getVLCString(connector.name, i18n.language)
    const connectorDescription = getVLCString(connector.description, i18n.language)
    const metahubName = publication?.metahub ? getVLCString(publication.metahub.name, i18n.language) : null

    // Schema info from Application (each Application has its own schema)
    const schemaName = application?.schemaName ?? (applicationId ? `app_${applicationId.replace(/-/g, '')}` : 'app_unknown')
    const schemaStatus: SchemaStatus = (application?.schemaStatus as SchemaStatus) ?? 'draft'
    const schemaSyncedAt = application?.schemaSyncedAt // Still from application for now
    const schemaError = application?.schemaError // Still from application for now

    const handleSyncClick = () => {
        setDiffDialogOpen(true)
    }

    const handleSyncConfirm = async (confirmDestructive: boolean) => {
        if (!applicationId) {
            return
        }
        try {
            await syncMutation.mutateAsync({
                applicationId,
                confirmDestructive
            })
            setDiffDialogOpen(false)
        } catch (error) {
            console.error('[ConnectorBoard] Sync failed:', error)
            // Error handled in mutation
        }
    }

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '—'
        return new Date(dateString).toLocaleString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={connectorName || t('connectors.title', 'Connector')}
                    description={connectorDescription || t('connectors.description', 'Data container for application schema')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, px: { xs: 1.5, md: 2 } }}>
                <Grid container spacing={3} columns={12}>
                    {/* Schema Status Card */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <StorageIcon color="primary" />
                                    <Typography variant="h6">
                                        {t('connectors.schema.title', 'Schema')}
                                    </Typography>
                                </Stack>
                                <Divider sx={{ mb: 2 }} />

                                <InfoRow
                                    label={t('connectors.schema.name', 'Schema Name')}
                                    value={
                                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                            {schemaName}
                                        </Typography>
                                    }
                                />
                                <InfoRow
                                    label={t('connectors.schema.status', 'Status')}
                                    value={<StatusChip status={schemaStatus} />}
                                />
                                <InfoRow
                                    label={t('connectors.schema.lastSync', 'Last Synced')}
                                    value={formatDate(schemaSyncedAt)}
                                />
                                {metahubName && (
                                    <InfoRow
                                        label={t('connectors.schema.source', 'Source Metahub')}
                                        value={metahubName}
                                    />
                                )}

                                {schemaError && (
                                    <Alert severity="error" sx={{ mt: 2 }}>
                                        {schemaError}
                                    </Alert>
                                )}

                                <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<SyncIcon />}
                                        onClick={handleSyncClick}
                                        disabled={schemaStatus === 'pending' || syncMutation.isPending || !publication}
                                        fullWidth
                                    >
                                        {syncMutation.isPending
                                            ? t('connectors.sync.syncing', 'Syncing...')
                                            : schemaStatus === 'draft'
                                            ? t('connectors.sync.createButton', 'Create Schema')
                                            : t('connectors.sync.button', 'Sync Schema')}
                                    </Button>
                                </Box>
                                <Button
                                    variant="outlined"
                                    startIcon={<HistoryIcon />}
                                    onClick={() => navigate(`/a/${applicationId}/admin/migrations`)}
                                    fullWidth
                                    sx={{ mt: 1 }}
                                >
                                    {t('connectors.board.viewMigrations', 'View Migration History')}
                                </Button>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Details Card */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <InfoOutlinedIcon color="primary" />
                                    <Typography variant="h6">
                                        {t('common.details', 'Details')}
                                    </Typography>
                                </Stack>
                                <Divider sx={{ mb: 2 }} />

                                <InfoRow
                                    label={t('connectors.table.created', 'Created')}
                                    value={formatDate(connector.createdAt)}
                                />
                                <InfoRow
                                    label={t('common.updated', 'Updated')}
                                    value={formatDate(connector.updatedAt)}
                                />

                                {/* Status Description */}
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {schemaStatus === 'synced'
                                            ? t('connectors.statusDescription.synced', 'Schema matches current configuration')
                                            : schemaStatus === 'outdated'
                                            ? t('connectors.statusDescription.outdated', 'Schema has pending changes')
                                            : schemaStatus === 'error'
                                            ? t('connectors.statusDescription.error', 'Last sync failed')
                                            : schemaStatus === 'update_available'
                                            ? t('connectors.statusDescription.updateAvailable', 'A recommended update is available')
                                            : schemaStatus === 'maintenance'
                                            ? t('connectors.statusDescription.maintenance', 'Application is in maintenance mode')
                                            : schemaStatus === 'pending'
                                            ? t('connectors.statusDescription.pending', 'Synchronization in progress')
                                            : t('connectors.statusDescription.draft', 'Schema not yet created')}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Back Button */}
                <Box display="flex" justifyContent="center" sx={{ mt: 4 }}>
                    <Button
                        variant="text"
                        startIcon={<ArrowBackRoundedIcon />}
                        onClick={() => navigate(`/a/${applicationId}/admin/connectors`)}
                    >
                        {t('connectors.board.backToConnectors', 'Back to Connectors')}
                    </Button>
                </Box>
            </Box>

            {/* Diff Dialog */}
            {applicationId && (
                <ConnectorDiffDialog
                    open={diffDialogOpen}
                    connector={connector}
                    applicationId={applicationId}
                    onClose={() => setDiffDialogOpen(false)}
                    onSync={handleSyncConfirm}
                    isSyncing={syncMutation.isPending}
                    uiLocale={i18n.language}
                    schemaStatus={schemaStatus}
                />
            )}
        </Stack>
    )
}

export default ConnectorBoard
