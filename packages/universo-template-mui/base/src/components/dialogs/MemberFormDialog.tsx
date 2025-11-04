import React, { useEffect } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, MenuItem, Alert } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { memberFormSchema, type MemberFormData } from '@universo/types'

export type AssignableRole = 'admin' | 'editor' | 'member'

export interface MemberFormDialogProps {
    open: boolean
    title: string
    /** Mode of the dialog: 'create' for invite, 'edit' for existing member */
    mode?: 'create' | 'edit'
    emailLabel: string
    roleLabel: string
    commentLabel?: string
    commentPlaceholder?: string
    saveButtonText?: string
    savingButtonText?: string
    cancelButtonText?: string
    initialEmail?: string
    initialRole?: AssignableRole
    initialComment?: string
    loading?: boolean
    error?: string
    /** Show warning when trying to downgrade or remove self */
    selfActionWarning?: string
    onClose: () => void
    onSave: (data: { email: string; role: AssignableRole; comment?: string }) => Promise<void> | void
    /** Optional callback called after successful save */
    onSuccess?: () => void
    /** If true (default), the dialog will auto-close after a successful save */
    autoCloseOnSuccess?: boolean
    /** Available roles to select from */
    availableRoles?: AssignableRole[]
    /** Role labels for dropdown */
    roleLabels?: Record<AssignableRole, string>
}

/**
 * MemberFormDialog component for inviting or editing metaverse members
 * Supports email validation, role selection, and optional comment field
 */
export const MemberFormDialog: React.FC<MemberFormDialogProps> = ({
    open,
    title,
    mode = 'create',
    emailLabel,
    roleLabel,
    commentLabel = 'Comment (optional)',
    commentPlaceholder = 'Add a note about this member...',
    saveButtonText = 'Save',
    savingButtonText,
    cancelButtonText = 'Cancel',
    initialEmail = '',
    initialRole = 'member',
    initialComment = '',
    loading = false,
    error,
    selfActionWarning,
    onClose,
    onSave,
    onSuccess,
    autoCloseOnSuccess = true,
    availableRoles = ['admin', 'editor', 'member'],
    roleLabels = {
        admin: 'Admin',
        editor: 'Editor',
        member: 'Member'
    }
}) => {
    const {
        control,
        handleSubmit,
        reset,
        formState: { errors: fieldErrors, isSubmitting }
    } = useForm<MemberFormData>({
        resolver: zodResolver(memberFormSchema),
        defaultValues: {
            email: initialEmail,
            role: initialRole,
            comment: initialComment
        }
    })

    // Reset form when dialog opens with new initial values
    useEffect(() => {
        if (open) {
            reset({
                email: initialEmail,
                role: initialRole,
                comment: initialComment
            })
        }
    }, [open, initialEmail, initialRole, initialComment, reset])

    const onSubmit = async (data: MemberFormData) => {
        try {
            await onSave({
                email: data.email.trim(),
                role: data.role,
                comment: data.comment?.trim() || undefined
            })

            // Call optional success callback
            try {
                onSuccess && onSuccess()
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error('MemberFormDialog onSuccess handler error:', e)
            }

            if (autoCloseOnSuccess) {
                onClose()
            }
        } catch (e) {
            // error is shown via `error` prop from parent
            // eslint-disable-next-line no-console
            console.error('MemberFormDialog save error:', e)
        }
    }

    const isLoading = loading || isSubmitting

    const handleClose = () => {
        if (!isLoading) onClose()
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth PaperProps={{ sx: { borderRadius: 1 } }}>
            <DialogTitle>{title}</DialogTitle>
            <form onSubmit={handleSubmit(onSubmit)}>
                <DialogContent sx={{ overflowY: 'visible' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        {/* Self-action warning */}
                        {selfActionWarning && (
                            <Alert severity='warning' sx={{ borderRadius: 1 }}>
                                {selfActionWarning}
                            </Alert>
                        )}

                        {/* Error message */}
                        {error && (
                            <Alert severity='error' sx={{ borderRadius: 1 }}>
                                {error}
                            </Alert>
                        )}

                        {/* Email field */}
                        <Controller
                            name='email'
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label={emailLabel}
                                    placeholder='user@example.com'
                                    fullWidth
                                    required
                                    disabled={isLoading || mode === 'edit'}
                                    autoFocus={mode === 'create'}
                                    variant='outlined'
                                    type='email'
                                    error={!!fieldErrors.email}
                                    helperText={fieldErrors.email?.message}
                                    sx={{ borderRadius: 1 }}
                                />
                            )}
                        />

                        {/* Role dropdown */}
                        <Controller
                            name='role'
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label={roleLabel}
                                    fullWidth
                                    required
                                    disabled={isLoading}
                                    variant='outlined'
                                    select
                                    error={!!fieldErrors.role}
                                    helperText={fieldErrors.role?.message}
                                    sx={{ borderRadius: 1 }}
                                >
                                    {availableRoles.map((roleOption) => (
                                        <MenuItem key={roleOption} value={roleOption}>
                                            {roleLabels[roleOption]}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            )}
                        />

                        {/* Comment field */}
                        {commentLabel && (
                            <Controller
                                name='comment'
                                control={control}
                                render={({ field }) => (
                                    <TextField
                                        {...field}
                                        label={commentLabel}
                                        placeholder={commentPlaceholder}
                                        fullWidth
                                        disabled={isLoading}
                                        variant='outlined'
                                        multiline
                                        rows={3}
                                        sx={{ borderRadius: 1 }}
                                    />
                                )}
                            />
                        )}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={handleClose} disabled={isLoading} sx={{ borderRadius: 1 }}>
                        {cancelButtonText}
                    </Button>
                    <Button type='submit' variant='contained' disabled={isLoading} sx={{ borderRadius: 1 }}>
                        {isLoading && savingButtonText ? savingButtonText : saveButtonText}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    )
}

export default MemberFormDialog
