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
import { usePublicationDiff, type Publication } from '../domains/publications'
import { getVLCString } from '../types'

// ============================================================================
// Types
// ============================================================================

interface PublicationDiffDialogProps {
    open: boolean
    publication?: Publication | null
    metahubId: string
    onClose: () => void
    onSync: (confirmDestructive: boolean) => Promise<void>
    isSyncing: boolean
    uiLocale: string
}

// ============================================================================
// Component
// ============================================================================

const PublicationDiffDialog = ({ open, publication, metahubId, onClose, onSync, isSyncing, uiLocale }: PublicationDiffDialogProps) => {
    const { t } = useTranslation('metahubs')

    // Fetch diff when dialog opens
    const {
        data: diffData,
        isLoading: isDiffLoading,
        error: diffError,
        refetch: refetchDiff
    } = usePublicationDiff(metahubId, publication?.id ?? '', {
        enabled: open && !!publication?.id && !!metahubId
    })

    // Refetch diff when dialog opens
    useEffect(() => {
        if (open && publication?.id) {
            refetchDiff()
        }
    }, [open, publication?.id, refetchDiff])

    const hasDestructiveChanges = (diffData?.diff?.destructive?.length ?? 0) > 0
    const hasAdditiveChanges = (diffData?.diff?.additive?.length ?? 0) > 0
    const hasChanges = diffData?.diff?.hasChanges ?? (hasDestructiveChanges || hasAdditiveChanges)

    const handleSync = async (confirmDestructive: boolean) => {
        await onSync(confirmDestructive)
    }

    const publicationName = publication ? getVLCString(publication.name, uiLocale) : ''

    return (
        <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth aria-labelledby='publication-diff-dialog-title'>
            <DialogTitle id='publication-diff-dialog-title'>
                {t('publications.diffDialog.title', 'Schema Changes')}
                {publicationName && (
                    <Typography variant='subtitle2' color='text.secondary'>
                        {publicationName}
                    </Typography>
                )}
            </DialogTitle>
            <DialogContent dividers>
                {isDiffLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : diffError ? (
                    <Alert severity='error'>{t('errors.connectionFailed', 'Failed to load schema changes')}</Alert>
                ) : !hasChanges ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
                        <Typography variant='h6'>{t('publications.diffDialog.noChanges', 'No changes detected')}</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {t('publications.statusDescription.synced', 'Schema matches current configuration')}
                        </Typography>
                    </Box>
                ) : (
                    <Box>
                        {/* Summary */}
                        {diffData?.diff?.summary && (
                            <Alert severity='info' sx={{ mb: 2 }}>
                                {diffData.diff.summary}
                            </Alert>
                        )}

                        {/* Additive Changes */}
                        {hasAdditiveChanges && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'success.main' }}>
                                    {t('publications.diffDialog.additiveChanges', 'Safe Changes (will be applied)')}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.additive?.map((change, index) => (
                                        <ListItem key={`additive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <AddCircleOutlineIcon color='success' />
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
                                <Alert severity='warning' sx={{ mb: 2 }}>
                                    {t(
                                        'publications.diffDialog.destructiveWarning',
                                        'These changes will delete data. Review carefully before confirming.'
                                    )}
                                </Alert>
                                <Typography variant='subtitle1' sx={{ fontWeight: 600, mb: 1, color: 'error.main' }}>
                                    {t('publications.diffDialog.destructiveChanges', 'Destructive Changes (require confirmation)')}
                                </Typography>
                                <List dense>
                                    {diffData?.diff?.destructive?.map((change, index) => (
                                        <ListItem key={`destructive-${index}`}>
                                            <ListItemIcon sx={{ minWidth: 36 }}>
                                                <RemoveCircleOutlineIcon color='error' />
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
                        variant='contained'
                        color='primary'
                        onClick={() => handleSync(false)}
                        disabled={isSyncing || isDiffLoading}
                        startIcon={isSyncing ? <CircularProgress size={16} /> : null}
                    >
                        {isSyncing ? t('common.loading', 'Loading...') : t('publications.diffDialog.confirmSync', 'Apply Changes')}
                    </Button>
                )}
                {hasDestructiveChanges && (
                    <>
                        {hasAdditiveChanges && (
                            <Button
                                variant='outlined'
                                color='primary'
                                onClick={() => handleSync(false)}
                                disabled={isSyncing || isDiffLoading}
                            >
                                {t('publications.diffDialog.applySafeChanges', 'Apply Safe Changes Only')}
                            </Button>
                        )}
                        <Button
                            variant='contained'
                            color='error'
                            onClick={() => handleSync(true)}
                            disabled={isSyncing || isDiffLoading}
                            startIcon={isSyncing ? <CircularProgress size={16} color='inherit' /> : null}
                        >
                            {isSyncing
                                ? t('common.loading', 'Loading...')
                                : t('publications.diffDialog.confirmDestructive', 'Apply Including Destructive')}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    )
}

export { PublicationDiffDialog }
export default PublicationDiffDialog
