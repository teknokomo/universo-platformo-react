import React, { useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, CircularProgress, Box, Alert } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'

/**
 * Props for the ConfirmDeleteDialog component
 */
export interface ConfirmDeleteDialogProps {
    /** Controls whether the dialog is visible */
    open: boolean
    /** Title of the dialog (e.g., "Delete Metaverse?") */
    title: string
    /** Detailed description or warning message */
    description: string
    /** Text for the confirm/delete button (default: "Delete") */
    confirmButtonText?: string
    /** Text shown on delete button while loading (e.g., "Deleting...") */
    deletingButtonText?: string
    /** Text for the cancel button (default: "Cancel") */
    cancelButtonText?: string
    /** Whether the delete operation is in progress */
    loading?: boolean
    /** Error message to display if deletion fails */
    error?: string
    /** Callback when the user cancels the dialog */
    onCancel: () => void
    /** Callback when the user confirms deletion */
    onConfirm: () => Promise<void> | void
    /** Name of the entity being deleted (for interpolation) */
    entityName?: string
    /** Type of entity being deleted (e.g., "metaverse", "cluster") - used for context */
    entityType?: string
}

/**
 * ConfirmDeleteDialog - A reusable dialog for confirming delete operations
 *
 * This component provides a consistent UX for delete confirmations across the application.
 * It includes loading states, error handling, and clear visual hierarchy (danger actions).
 *
 * @example
 * ```tsx
 * <ConfirmDeleteDialog
 *   open={showDeleteDialog}
 *   title={t('common:delete.title', { entity: 'Metaverse' })}
 *   description={t('common:delete.description', { name: metaverse.name })}
 *   confirmButtonText={t('common:delete.confirm')}
 *   cancelButtonText={t('common:delete.cancel')}
 *   loading={isDeleting}
 *   error={deleteError}
 *   onCancel={() => setShowDeleteDialog(false)}
 *   onConfirm={handleDelete}
 *   entityName={metaverse.name}
 *   entityType="metaverse"
 * />
 * ```
 */
export const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
    open,
    title,
    description,
    confirmButtonText = 'Delete',
    deletingButtonText,
    cancelButtonText = 'Cancel',
    loading = false,
    error,
    onCancel,
    onConfirm,
    entityName,
    entityType
}) => {
    // Internal loading state for when onConfirm is async
    const [isDeleting, setIsDeleting] = useState(false)

    const handleConfirm = async () => {
        setIsDeleting(true)
        try {
            await onConfirm()
            // Close dialog after successful delete
            onCancel()
        } catch (e) {
            // Error handling is done via the `error` prop from parent
            console.error('ConfirmDeleteDialog: Delete operation failed', e)
        } finally {
            setIsDeleting(false)
        }
    }

    // Combine external and internal loading states
    const isLoading = loading || isDeleting

    return (
        <Dialog
            open={open}
            onClose={isLoading ? undefined : onCancel}
            maxWidth='sm'
            fullWidth
            aria-labelledby='confirm-delete-dialog-title'
            aria-describedby='confirm-delete-dialog-description'
            disableEnforceFocus
            disableRestoreFocus
        >
            <DialogTitle id='confirm-delete-dialog-title'>{title}</DialogTitle>
            <DialogContent>
                <DialogContentText id='confirm-delete-dialog-description' sx={{ mb: error ? 2 : 0 }}>
                    {description}
                </DialogContentText>
                {error && (
                    <Alert severity='error' sx={{ mt: 2 }}>
                        {error}
                    </Alert>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onCancel} disabled={isLoading} color='inherit'>
                    {cancelButtonText}
                </Button>
                <Button
                    onClick={handleConfirm}
                    disabled={isLoading}
                    variant='contained'
                    color='error'
                    startIcon={isLoading ? <CircularProgress size={16} color='inherit' /> : <DeleteIcon />}
                    sx={{
                        minWidth: '100px', // Ensure button doesn't shrink too much
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    {isLoading ? (
                        <Box component='span' sx={{ ml: 1 }}>
                            {deletingButtonText || confirmButtonText || 'Deleting...'}
                        </Box>
                    ) : (
                        confirmButtonText
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default ConfirmDeleteDialog
