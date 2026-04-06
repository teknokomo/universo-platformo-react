import { Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress, Stack } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { mergeDialogPaperProps, mergeDialogSx, resolveDialogMaxWidth, useDialogPresentation } from '@universo/template-mui/components/dialogs'
import type { Connector } from '../types'
import { getVLCString } from '../types'

export interface ConnectorDeleteDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** The connector to be deleted */
    connector: Connector | null
    /** Application ID for the API call */
    applicationId: string
    /** Callback when dialog is closed */
    onClose: () => void
    /** Callback when delete is confirmed */
    onConfirm: (connector: Connector) => void
    /** Whether delete operation is in progress */
    isDeleting?: boolean
    /** Current UI locale for connector name display */
    uiLocale?: string
}

/**
 * Dialog for confirming connector deletion.
 * Simple confirmation dialog without blocking entities check.
 */
export function ConnectorDeleteDialog({
    open,
    connector,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: ConnectorDeleteDialogProps) {
    const { t } = useTranslation(['applications'])

    if (!connector) return null

    const connectorName = getVLCString(connector.name, uiLocale) || connector.codename

    const handleConfirm = () => {
        onConfirm(connector)
    }

    const handleClose = () => {
        if (!isDeleting) onClose()
    }

    const presentation = useDialogPresentation({ open, onClose: handleClose, fallbackMaxWidth: 'sm', isBusy: isDeleting })
    const titleNode = presentation.titleActions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box component='span' sx={{ minWidth: 0 }}>
                {t('connectors.deleteDialog.title')}
            </Box>
            {presentation.titleActions}
        </Box>
    ) : (
        t('connectors.deleteDialog.title')
    )

    return (
        <Dialog
            open={open}
            onClose={presentation.dialogProps.onClose}
            maxWidth={resolveDialogMaxWidth(presentation.dialogProps.maxWidth, 'sm')}
            fullWidth={presentation.dialogProps.fullWidth ?? true}
            disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
            PaperProps={mergeDialogPaperProps(undefined, presentation.dialogProps.PaperProps)}
        >
            <DialogTitle>{titleNode}</DialogTitle>
            <DialogContent sx={mergeDialogSx(presentation.contentSx)}>
                <Stack spacing={2}>
                    <Typography>{t('connectors.deleteDialog.confirmation', { name: connectorName })}</Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isDeleting}>
                    {t('connectors.deleteDialog.cancel')}
                </Button>
                <Button
                    onClick={handleConfirm}
                    color='error'
                    variant='contained'
                    disabled={isDeleting}
                    startIcon={isDeleting ? <CircularProgress size={16} /> : undefined}
                >
                    {t('connectors.deleteDialog.confirm')}
                </Button>
            </DialogActions>
            {presentation.resizeHandle}
        </Dialog>
    )
}

export default ConnectorDeleteDialog
