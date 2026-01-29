import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Alert } from '@mui/material'
import { WarningAmber as WarningIcon } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import type { ConflictInfo } from '@universo/utils'

export interface ConflictResolutionDialogProps {
    open: boolean
    conflict: ConflictInfo | null
    /** Called when user chooses to overwrite with their local changes */
    onOverwrite: () => void
    /** Called when user chooses to reload/use server version (discards local changes) */
    onReload?: () => void
    onCancel: () => void
    isLoading?: boolean
}

export function ConflictResolutionDialog({
    open,
    conflict,
    onOverwrite,
    onReload,
    onCancel,
    isLoading = false
}: ConflictResolutionDialogProps) {
    const { t } = useTranslation()

    if (!conflict) return null

    const formattedDate = conflict.updatedAt
        ? new Date(conflict.updatedAt).toLocaleString()
        : t('common:unknown', 'Unknown')

    // Display email (uuid) format if available
    const updatedByEmail = (conflict as any).updatedByEmail
    const updatedByUuid = conflict.updatedBy
    const updatedBy = updatedByEmail
        ? `${updatedByEmail} (${updatedByUuid})`
        : updatedByUuid || t('common:unknown', 'Unknown')

    return (
        <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" />
                {t('conflict.title')}
            </DialogTitle>
            <DialogContent>
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {t('conflict.description')}
                </Alert>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        {t('conflict.modifiedBy')}: <strong>{updatedBy}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('conflict.modifiedAt')}: <strong>{formattedDate}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('conflict.yourVersion')}: <strong>{conflict.expectedVersion}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {t('conflict.serverVersion')}: <strong>{conflict.actualVersion}</strong>
                    </Typography>
                </Box>
                <Typography variant="body2">
                    {t('conflict.chooseAction')}
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onCancel} disabled={isLoading}>
                    {t('common:actions.cancel', 'Cancel')}
                </Button>
                {onReload && (
                    <Button onClick={onReload} variant="outlined" disabled={isLoading}>
                        {t('conflict.useServerVersion', 'Use Server Version')}
                    </Button>
                )}
                <Button onClick={onOverwrite} variant="contained" color="warning" disabled={isLoading}>
                    {t('conflict.overwrite')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ConflictResolutionDialog
