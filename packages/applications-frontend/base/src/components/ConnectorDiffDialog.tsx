/**
 * Universo Platformo | ConnectorDiffDialog Component
 *
 * Dialog for showing schema diff and confirming sync for a connector.
 * Adapted from metahubs PublicationDiffDialog.
 */

import { useEffect } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    CircularProgress,
    Alert,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider
} from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline'
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useTranslation } from 'react-i18next'
import { useConnectorDiff } from '../hooks/useConnectorSync'
import { useApplicationDiff } from '../hooks/useConnectorSync'
import type { Connector } from '../types'
import { getVLCString } from '../types'

// ============================================================================
// Types
// ============================================================================

export interface ConnectorDiffDialogProps {
    open: boolean
    connector?: Connector | null
    applicationId: string
    onClose: () => void
    onSync: (confirmDestructive: boolean) => Promise<void>
    isSyncing: boolean
    uiLocale: string
    schemaStatus?: SchemaStatus
}

type SchemaStatus = 'draft' | 'pending' | 'synced' | 'outdated' | 'error'

// ============================================================================
// Component
// ============================================================================

export function ConnectorDiffDialog({
    open,
    connector,
    applicationId,
    onClose,
    onSync,
    isSyncing,
    uiLocale,
    schemaStatus
}: ConnectorDiffDialogProps) {
    const { t } = useTranslation('applications')

    // Fetch diff when dialog opens - use applicationId
    const {
        data: diffData,
        isLoading: isDiffLoading,
        error: diffError,
        refetch: refetchDiff
    } = useApplicationDiff(applicationId, {
        enabled: open && Boolean(applicationId)
    })

    // Refetch diff when dialog opens
    useEffect(() => {
        if (open && applicationId) {
            refetchDiff()
        }
    }, [open, applicationId, refetchDiff])

    const hasDestructiveChanges = (diffData?.diff?.destructive?.length ?? 0) > 0
    const hasAdditiveChanges = (diffData?.diff?.additive?.length ?? 0) > 0
    const needsCreate = diffData?.schemaExists === false || schemaStatus === 'draft'
    const hasChanges =
        needsCreate || diffData?.diff?.hasChanges || hasDestructiveChanges || hasAdditiveChanges

    const handleSync = async (confirmDestructive: boolean) => {
        await onSync(confirmDestructive)
    }

    const connectorName = connector ? getVLCString(connector.name, uiLocale) : ''

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            aria-labelledby="connector-diff-dialog-title"
        >
            <DialogTitle id="connector-diff-dialog-title">
                {t('connectors.diffDialog.title', 'Schema Changes')}
                {connectorName && (
                    <Typography variant="subtitle2" color="text.secondary">
                        {connectorName}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isDiffLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : diffError ? (
                    <Alert severity="error">
                        {t('errors.connectionFailed', 'Failed to load schema changes')}
                    </Alert>
                ) : needsCreate ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <AddCircleOutlineIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6">
                            {t('connectors.diffDialog.schemaMissingTitle', 'Schema not created yet')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t(
                                'connectors.diffDialog.schemaNotExists',
                                'Schema does not exist yet. It will be created on first sync.'
                            )}
                        </Typography>
                    </Box>
                ) : !hasChanges ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant="h6">
                            {t('connectors.diffDialog.noChanges', 'No changes detected')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('connectors.diffDialog.schemaUpToDate', 'Schema matches current configuration')}
                        </Typography>
                    </Box>
                ) : (
                    <Box>
                        {/* Summary */}
                        {diffData?.diff?.summary && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                                {diffData.diff.summary}
                            </Alert>
                        )}

                        {/* Additive Changes */}
                        {hasAdditiveChanges && (
                            <Box sx={{ mb: 3 }}>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}
                                >
                                    {t('connectors.diffDialog.additiveChanges', 'Safe Changes (will be applied)')}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.additive?.map((change, index) => (
                                        <ListItem key={`additive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <AddCircleOutlineIcon color="success" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={change}
                                                primaryTypographyProps={{ fontFamily: 'monospace', fontSize: 13 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}

                        {/* Destructive Changes */}
                        {hasDestructiveChanges && (
                            <Box>
                                <Divider sx={{ my: 2 }} />
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    {t(
                                        'connectors.diffDialog.destructiveWarning',
                                        'These changes will delete data. Review carefully before confirming.'
                                    )}
                                </Alert>
                                <Typography
                                    variant="subtitle1"
                                    sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}
                                >
                                    {t(
                                        'connectors.diffDialog.destructiveChanges',
                                        'Destructive Changes (require confirmation)'
                                    )}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.destructive?.map((change, index) => (
                                        <ListItem key={`destructive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <RemoveCircleOutlineIcon color="error" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={change}
                                                primaryTypographyProps={{ fontFamily: 'monospace', fontSize: 13 }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={onClose} disabled={isSyncing}>
                    {t('common.cancel', 'Cancel')}
                </Button>
                {hasChanges && !hasDestructiveChanges && (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleSync(false)}
                        disabled={isSyncing || isDiffLoading}
                        startIcon={isSyncing ? <CircularProgress size={16} /> : null}
                    >
                        {isSyncing
                            ? t('common.loading', 'Loading...')
                            : needsCreate
                              ? t('connectors.diffDialog.createSchema', 'Create Schema')
                              : t('connectors.diffDialog.confirmSync', 'Apply Changes')}
                    </Button>
                )}
                {hasDestructiveChanges && (
                    <>
                        {hasAdditiveChanges && (
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={() => handleSync(false)}
                                disabled={isSyncing || isDiffLoading}
                            >
                                {t('connectors.diffDialog.applySafeChanges', 'Apply Safe Changes Only')}
                            </Button>
                        )}
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => handleSync(true)}
                            disabled={isSyncing || isDiffLoading}
                            startIcon={isSyncing ? <CircularProgress size={16} color="inherit" /> : null}
                        >
                            {isSyncing
                                ? t('common.loading', 'Loading...')
                                : t('connectors.diffDialog.confirmDestructive', 'Apply Including Destructive')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}

export default ConnectorDiffDialog
