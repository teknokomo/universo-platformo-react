import { useId, type ReactNode } from 'react'
import Dialog, { type DialogProps } from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import type { TransitionProps } from '@mui/material/transitions'
import type { SxProps, Theme } from '@mui/material/styles'

export interface StandardDialogProps {
    open: boolean
    onClose: DialogProps['onClose']
    title: ReactNode
    children: ReactNode
    actions?: ReactNode
    maxWidth?: DialogProps['maxWidth']
    fullWidth?: boolean
    isBusy?: boolean
    onTransitionEntered?: TransitionProps['onEntered']
    /** Optional WAI-ARIA describedby id for danger framing or auxiliary copy. */
    ariaDescribedBy?: string
    paperSx?: SxProps<Theme>
    contentSx?: SxProps<Theme>
    actionsSx?: SxProps<Theme>
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
    isBusy = false,
    onTransitionEntered,
    ariaDescribedBy,
    paperSx,
    contentSx,
    actionsSx
}: StandardDialogProps) {
    const titleId = `runtime-standard-dialog-${useId().replace(/:/g, '')}`

    return (
        <Dialog
            open={open}
            onClose={isBusy ? undefined : onClose}
            aria-labelledby={titleId}
            {...(ariaDescribedBy ? { 'aria-describedby': ariaDescribedBy } : {})}
            maxWidth={maxWidth}
            fullWidth={fullWidth}
            slotProps={{
                ...(onTransitionEntered ? { transition: { onEntered: onTransitionEntered } } : {}),
                ...(paperSx ? { paper: { sx: paperSx } } : {})
            }}
        >
            <DialogTitle id={titleId}>{title}</DialogTitle>
            <DialogContent sx={contentSx}>{children}</DialogContent>
            {actions ? (
                <DialogActions sx={actionsSx ?? { p: 3, pt: 2, gap: 1, justifyContent: 'flex-end' }}>{actions}</DialogActions>
            ) : null}
        </Dialog>
    )
}

export default StandardDialog
