import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button, Box, MenuItem, Alert } from '@mui/material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { memberFormSchema, type MemberFormData, type MemberRole, type VersionedLocalizedContent } from '@universo/types'
import { LocalizedInlineField } from '../forms/LocalizedInlineField'

export interface MemberFormDialogProps {
    open: boolean
    title: string
    /** Mode of the dialog: 'create' for invite, 'edit' for existing member */
    mode?: 'create' | 'edit'
    emailLabel: string
    roleLabel: string
    commentLabel?: string
    commentPlaceholder?: string
    /** Function to format character count text, receives current count and max length */
    commentCharacterCountFormatter?: (count: number, max: number) => string
    saveButtonText?: string
    savingButtonText?: string
    cancelButtonText?: string
    initialEmail?: string
    initialRole?: MemberRole
    initialComment?: string
    initialCommentVlc?: VersionedLocalizedContent<string> | null
    commentMode?: 'plain' | 'localized'
    uiLocale?: string
    loading?: boolean
    error?: string
    /** Show warning when trying to downgrade or remove self */
    selfActionWarning?: string
    onClose: () => void
    onSave: (data: {
        email: string
        role: MemberRole
        comment?: string
        commentVlc?: VersionedLocalizedContent<string> | null
    }) => Promise<void> | void
    /** Optional callback called after successful save */
    onSuccess?: () => void
    /** If true (default), the dialog will auto-close after a successful save */
    autoCloseOnSuccess?: boolean
    /** Localized message shown when the localized comment exceeds 500 characters */
    commentTooLongMessage?: string
    /** Available roles to select from */
    availableRoles?: MemberRole[]
    /** Role labels for dropdown */
    roleLabels?: Partial<Record<MemberRole, string>>
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
    commentCharacterCountFormatter,
    saveButtonText = 'Save',
    savingButtonText,
    cancelButtonText = 'Cancel',
    initialEmail = '',
    initialRole = 'member',
    initialComment = '',
    initialCommentVlc = null,
    commentMode = 'plain',
    uiLocale = 'en',
    loading = false,
    error,
    selfActionWarning,
    onClose,
    onSave,
    onSuccess,
    autoCloseOnSuccess = true,
    commentTooLongMessage,
    availableRoles = ['admin', 'editor', 'member'],
    roleLabels = {
        admin: 'Admin',
        editor: 'Editor',
        member: 'Member'
    }
}) => {
    const emailInputRef = useRef<HTMLInputElement | null>(null)
    const [commentVlcState, setCommentVlcState] = useState<VersionedLocalizedContent<string> | null>(initialCommentVlc ?? null)
    const [commentVlcError, setCommentVlcError] = useState<string | null>(null)
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
            if (commentMode === 'localized') {
                setCommentVlcState(initialCommentVlc ?? null)
                setCommentVlcError(null)
            }
        }
    }, [open, initialEmail, initialRole, initialComment, initialCommentVlc, commentMode, reset])

    useEffect(() => {
        if (open && mode === 'create') {
            emailInputRef.current?.focus()
        }
    }, [open, mode])

    const normalizedCommentVlc = useMemo(() => {
        if (!commentVlcState?.locales) return null
        const nextLocales = Object.entries(commentVlcState.locales).reduce<Record<string, any>>((acc, [locale, entry]) => {
            if (!entry || typeof entry.content !== 'string') return acc
            const trimmed = entry.content.trim()
            if (trimmed.length === 0) return acc
            acc[locale] = { ...entry, content: trimmed }
            return acc
        }, {})

        const localeCodes = Object.keys(nextLocales)
        if (localeCodes.length === 0) return null
        const primary = nextLocales[commentVlcState._primary] ? commentVlcState._primary : localeCodes[0]
        return {
            ...commentVlcState,
            _primary: primary,
            locales: nextLocales
        } as VersionedLocalizedContent<string>
    }, [commentVlcState])

    const localizedMaxLength = useMemo(() => {
        if (!commentVlcState?.locales) return 0
        return Object.values(commentVlcState.locales).reduce((max, entry: any) => {
            const length = typeof entry?.content === 'string' ? entry.content.trim().length : 0
            return Math.max(max, length)
        }, 0)
    }, [commentVlcState])

    const onSubmit = async (data: MemberFormData) => {
        try {
            if (commentMode === 'localized') {
                if (localizedMaxLength > 500) {
                    setCommentVlcError(commentTooLongMessage || 'Comment must be 500 characters or less')
                    return
                }
            }

            await onSave({
                email: data.email.trim(),
                role: data.role,
                comment: commentMode === 'plain' ? data.comment?.trim() || undefined : undefined,
                commentVlc: commentMode === 'localized' ? normalizedCommentVlc : undefined
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
        if (isLoading) return
        reset()
        onClose()
    }

    const localizedCharacterCountText = commentCharacterCountFormatter
        ? commentCharacterCountFormatter(localizedMaxLength, 500)
        : `${localizedMaxLength}/500 characters (after trim)`

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
                            render={({ field: { ref, ...field } }) => (
                                <TextField
                                    {...field}
                                    inputRef={(instance) => {
                                        ref(instance)
                                        emailInputRef.current = instance
                                    }}
                                    label={emailLabel}
                                    placeholder='user@example.com'
                                    fullWidth
                                    required
                                    disabled={isLoading || mode === 'edit'}
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
                        {commentLabel && commentMode === 'plain' && (
                            <Controller
                                name='comment'
                                control={control}
                                render={({ field }) => {
                                    const trimmedLength = (field.value || '').trim().length
                                    const maxLength = 500
                                    const isOverLimit = trimmedLength > maxLength
                                    const characterCountText = commentCharacterCountFormatter
                                        ? commentCharacterCountFormatter(trimmedLength, maxLength)
                                        : `${trimmedLength}/${maxLength} characters (after trim)`

                                    return (
                                        <TextField
                                            {...field}
                                            label={commentLabel}
                                            placeholder={commentPlaceholder}
                                            fullWidth
                                            disabled={isLoading}
                                            variant='outlined'
                                            multiline
                                            minRows={2}
                                            maxRows={4}
                                            error={isOverLimit || !!fieldErrors.comment}
                                            helperText={fieldErrors.comment?.message || characterCountText}
                                            slotProps={{
                                                htmlInput: {
                                                    maxLength: 510 // Buffer allows whitespace before trim. Real-time validation
                                                    // below shows error when trimmed length exceeds 500.
                                                }
                                            }}
                                        />
                                    )
                                }}
                            />
                        )}

                        {commentLabel && commentMode === 'localized' && (
                            <LocalizedInlineField
                                mode='localized'
                                label={commentLabel}
                                value={commentVlcState}
                                onChange={(next) => {
                                    setCommentVlcState(next)
                                    if (commentVlcError) setCommentVlcError(null)
                                }}
                                disabled={isLoading}
                                uiLocale={uiLocale}
                                multiline
                                rows={3}
                                maxLength={510}
                                helperText={commentVlcError || localizedCharacterCountText}
                                error={commentVlcError}
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
