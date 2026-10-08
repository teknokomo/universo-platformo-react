import { useId, type ReactNode } from 'react'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'

export interface StandardDialogProps {
    open: boolean
    onClose: DialogProps['onClose']
    title: ReactNode
    children: ReactNode
    actions?: ReactNode
    maxWidth?: DialogProps['maxWidth']
    fullWidth?: boolean
    isBusy?: boolean
}

/**
 * Canonical dialog shell for the isolated published-app runtime package.
 * Keeps title labelling and action spacing consistent without importing the
 * legacy template package.
 */
export function StandardDialog({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = 'sm',
    fullWidth = true,
    isBusy = false
}: StandardDialogProps) {
    const titleId = `runtime-standard-dialog-${useId().replace(/:/g, '')}`

    return (
        <Dialog open={open} onClose={isBusy ? undefined : onClose} aria-labelledby={titleId} maxWidth={maxWidth} fullWidth={fullWidth}>
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogContent>{children}</DialogContent>
            {actions ? <DialogActions sx={{ p: 3, pt: 2, gap: 1, justifyContent: 'flex-end' }}>{actions}</DialogActions> : null}
        </Dialog>
    )
}

export default StandardDialog
