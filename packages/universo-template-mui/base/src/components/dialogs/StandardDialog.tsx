import type { ReactNode } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    type DialogProps,
    type DialogTitleProps,
    type DialogContentProps,
    type DialogActionsProps
} from '@mui/material'

export interface StandardDialogProps {
    open: boolean
    onClose: DialogProps['onClose']
    title: ReactNode
    children: ReactNode
    actions?: ReactNode
    maxWidth?: DialogProps['maxWidth']
    fullWidth?: boolean
    paperProps?: DialogProps['PaperProps']
    dialogTitleProps?: DialogTitleProps
    dialogContentProps?: DialogContentProps
    dialogActionsProps?: DialogActionsProps
}

export function StandardDialog({
    open,
    onClose,
    title,
    children,
    actions,
    maxWidth = 'sm',
    fullWidth = true,
    paperProps,
    dialogTitleProps,
    dialogContentProps,
    dialogActionsProps
}: StandardDialogProps) {
    const paperSx = Array.isArray(paperProps?.sx)
        ? [{ borderRadius: 1 }, ...paperProps.sx]
        : paperProps?.sx
        ? [{ borderRadius: 1 }, paperProps.sx]
        : [{ borderRadius: 1 }]

    return (
        <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth={fullWidth} PaperProps={{ ...paperProps, sx: paperSx }}>
            <DialogTitle {...dialogTitleProps}>{title}</DialogTitle>
            <DialogContent {...dialogContentProps}>{children}</DialogContent>
            {actions ? <DialogActions {...dialogActionsProps}>{actions}</DialogActions> : null}
        </Dialog>
    )
}

export default StandardDialog
