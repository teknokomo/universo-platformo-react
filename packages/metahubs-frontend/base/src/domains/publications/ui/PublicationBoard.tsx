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
import { useTranslation } from 'react-i18next'

// project imports
import {
    ViewHeaderMUI as ViewHeader,
    EmptyListState,
    APIEmptySVG
} from '@universo/template-mui'

import { usePublicationDetails, type Publication } from '../hooks/usePublications'
import { useSyncPublication } from '../hooks/mutations'
import { PublicationDiffDialog } from '../../../components'
import { getVLCString } from '../../../types'

// ============================================================================
// Status Chip Component
// ============================================================================

type StatusChipProps = {
    status: Publication['schemaStatus']
}

const StatusChip = ({ status }: StatusChipProps) => {
    const { t } = useTranslation('metahubs')
    const statusConfig: Record<Publication['schemaStatus'], { color: 'default' | 'primary' | 'success' | 'warning' | 'error'; label: string }> = {
        draft: { color: 'default', label: t('publications.status.draft', 'Draft') },
        pending: { color: 'primary', label: t('publications.status.pending', 'Syncing...') },
        synced: { color: 'success', label: t('publications.status.synced', 'Synced') },
        outdated: { color: 'warning', label: t('publications.status.outdated', 'Outdated') },
        error: { color: 'error', label: t('publications.status.error', 'Error') }
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

const PublicationBoard = () => {
    const { metahubId, publicationId } = useParams<{ metahubId: string; publicationId: string }>()
    const { t, i18n } = useTranslation('metahubs')
    const navigate = useNavigate()

    // Diff dialog state
    const [diffDialogOpen, setDiffDialogOpen] = useState(false)

    // Fetch publication details with TanStack Query
    const {
        data: publication,
        isLoading,
        error,
        isError
    } = usePublicationDetails(metahubId ?? '', publicationId ?? '', {
        enabled: Boolean(metahubId) && Boolean(publicationId)
    })

    // Sync mutation
    const syncPublicationMutation = useSyncPublication()

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
    if (isError || !publication) {
        const errorMessage = error instanceof Error ? error.message : t('errors.connectionFailed', 'Failed to load data')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt="Error loading publication"
                    title={t('errors.connectionFailed', 'Failed to load data')}
                />
                <Alert severity="error" sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    const publicationName = getVLCString(publication.name, i18n.language)
    const publicationDescription = getVLCString(publication.description, i18n.language)

    const handleSyncClick = () => {
        setDiffDialogOpen(true)
    }

    const handleSyncConfirm = async (confirmDestructive: boolean) => {
        if (!metahubId || !publicationId) return
        try {
            await syncPublicationMutation.mutateAsync({
                metahubId,
                publicationId,
                confirmDestructive
            })
            setDiffDialogOpen(false)
        } catch (e) {
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
                    title={publicationName || t('publications.title', 'Information Base')}
                    description={publicationDescription || t('publications.description', 'Runtime instance with real database tables')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, px: { xs: 1.5, md: 2 } }}>
                <Grid container spacing={3} columns={12}>
                    {/* Schema Status Card */}
                    <Grid item xs={12} md={6}>
                        <Card variant="outlined">
                            <CardContent>
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                                    <StorageIcon color="primary" />
                                    <Typography variant="h6">
                                        {t('publications.table.schemaName', 'Schema')}
                                    </Typography>
                                </Stack>
                                <Divider sx={{ mb: 2 }} />

                                <InfoRow
                                    label={t('publications.table.schemaName', 'Schema Name')}
                                    value={
                                        <Typography sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                            {publication.schemaName}
                                        </Typography>
                                    }
                                />
                                <InfoRow
                                    label={t('publications.table.status', 'Status')}
                                    value={<StatusChip status={publication.schemaStatus} />}
                                />
                                <InfoRow
                                    label={t('publications.table.lastSync', 'Last Synced')}
                                    value={formatDate(publication.schemaSyncedAt)}
                                />

                                {publication.schemaError && (
                                    <Alert severity="error" sx={{ mt: 2 }}>
                                        {publication.schemaError}
                                    </Alert>
                                )}

                                <Box sx={{ mt: 3 }}>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<SyncIcon />}
                                        onClick={handleSyncClick}
                                        disabled={publication.schemaStatus === 'pending' || syncPublicationMutation.isPending}
                                        fullWidth
                                    >
                                        {syncPublicationMutation.isPending
                                            ? t('common.loading', 'Loading...')
                                            : t('publications.sync', 'Sync Schema')}
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Details Card */}
                    <Grid item xs={12} md={6}>
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
                                    label={t('publications.table.created', 'Created')}
                                    value={formatDate(publication.createdAt)}
                                />
                                <InfoRow
                                    label={t('common.updated', 'Updated')}
                                    value={formatDate(publication.updatedAt)}
                                />

                                {/* Status Description */}
                                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        {t(`publications.statusDescription.${publication.schemaStatus}`, '')}
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
                        onClick={() => navigate(`/metahub/${metahubId}/publications`)}
                    >
                        {t('actions.backToList', 'Back to List')}
                    </Button>
                </Box>
            </Box>

            {/* Diff Dialog */}
            <PublicationDiffDialog
                open={diffDialogOpen}
                publication={publication}
                metahubId={metahubId ?? ''}
                onClose={() => setDiffDialogOpen(false)}
                onSync={handleSyncConfirm}
                isSyncing={syncPublicationMutation.isPending}
                uiLocale={i18n.language}
            />
        </Stack>
    )
}

export default PublicationBoard
