import type { ReactNode } from 'react'
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    type DialogProps,
    type DialogTitleProps,
    type DialogContentProps,
    type DialogActionsProps
} from '@mui/material'
import { mergeDialogPaperProps, mergeDialogSx, useDialogPresentation } from './dialogPresentation'

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
    disablePresentationControls?: boolean
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
    dialogActionsProps,
    disablePresentationControls = false
}: StandardDialogProps) {
    const presentation = useDialogPresentation({
        open,
        onClose: onClose ?? (() => undefined),
        fallbackMaxWidth: maxWidth,
        disablePresentationControls
    })
    const titleNode = presentation.titleActions ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box component='span' sx={{ minWidth: 0 }}>
                {title}
            </Box>
            {presentation.titleActions}
        </Box>
    ) : (
        title
    )
    const mergedPaperProps = mergeDialogPaperProps(
        { sx: { borderRadius: 1 } },
        mergeDialogPaperProps(paperProps, presentation.dialogProps.PaperProps)
    )

    return (
        <Dialog
            open={open}
            onClose={presentation.dialogProps.onClose}
            maxWidth={presentation.dialogProps.maxWidth ?? maxWidth}
            fullWidth={presentation.dialogProps.fullWidth ?? fullWidth}
            disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
            PaperProps={mergedPaperProps}
        >
            <DialogTitle {...dialogTitleProps}>{titleNode}</DialogTitle>
            <DialogContent {...dialogContentProps} sx={mergeDialogSx(presentation.contentSx, dialogContentProps?.sx)}>
                {children}
            </DialogContent>
            {actions ? (
                <DialogActions
                    {...dialogActionsProps}
                    sx={mergeDialogSx({ p: 3, pt: 2, gap: 1, justifyContent: 'flex-end' }, dialogActionsProps?.sx)}
                >
                    {actions}
                </DialogActions>
            ) : null}
            {presentation.resizeHandle}
        </Dialog>
    )
}

export default StandardDialog
