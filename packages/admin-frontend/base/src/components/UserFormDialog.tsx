import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react'
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    type DialogProps,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Tab,
    Tabs,
    TextField
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { resolveLocalizedContent, getCodenamePrimary } from '@universo/utils'
import { isValidLocaleCode } from '@universo/types'
import { EntitySelectionPanel } from '@universo/template-mui'
import {
    mergeDialogPaperProps,
    mergeDialogSx,
    resolveDialogMaxWidth,
    useDialogPresentation
} from '@universo/template-mui/components/dialogs'

import type { RoleListItem } from '../api/rolesApi'

type RoleSelectionLabels = ComponentProps<typeof EntitySelectionPanel>['labels']

const EMPTY_ROLE_IDS: string[] = []

export interface UserFormDialogSubmitData {
    email: string
    password?: string
    roleIds: string[]
    comment?: string
}

export type UserFormDialogTab = 'main' | 'roles'

type UserFormDialogTranslator = (key: string, fallback: string) => string

interface UserFormDialogValidationInput {
    mode: 'create' | 'edit'
    email: string
    initialEmail: string
    password: string
    comment: string
    selectedRoleIds: string[]
    t: UserFormDialogTranslator
}

type UserFormDialogValidationResult =
    | {
          ok: true
          data: UserFormDialogSubmitData
      }
    | {
          ok: false
          error: string
          nextTab?: UserFormDialogTab
      }

export const validateUserFormDialog = ({
    mode,
    email,
    initialEmail,
    password,
    comment,
    selectedRoleIds,
    t
}: UserFormDialogValidationInput): UserFormDialogValidationResult => {
    const trimmedEmail = email.trim()

    if (mode === 'create' && !trimmedEmail) {
        return {
            ok: false,
            error: t('users.validation.emailRequired', 'Email is required')
        }
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return {
            ok: false,
            error: t('users.validation.emailInvalid', 'Enter a valid email address')
        }
    }

    if (mode === 'create' && selectedRoleIds.length === 0) {
        return {
            ok: false,
            error: t('users.validation.roleRequired', 'Select at least one role'),
            nextTab: 'roles'
        }
    }

    if (password && password.length < 8) {
        return {
            ok: false,
            error: t('users.validation.passwordMin', 'Password must contain at least 8 characters'),
            nextTab: 'main'
        }
    }

    return {
        ok: true,
        data: {
            email: trimmedEmail || initialEmail.trim(),
            password: password.trim() || undefined,
            roleIds: selectedRoleIds,
            comment: comment.trim() || undefined
        }
    }
}

interface UserFormDialogProps {
    open: boolean
    mode: 'create' | 'edit'
    title: string
    submitLabel: string
    roles: RoleListItem[]
    loading?: boolean
    error?: string | null
    initialEmail?: string
    initialComment?: string
    initialRoleIds?: string[]
    onClose: () => void
    onSubmit: (data: UserFormDialogSubmitData) => Promise<void> | void
}

export default function UserFormDialog({
    open,
    mode,
    title,
    submitLabel,
    roles,
    loading = false,
    error = null,
    initialEmail = '',
    initialComment = '',
    initialRoleIds = EMPTY_ROLE_IDS,
    onClose,
    onSubmit
}: UserFormDialogProps) {
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const [activeTab, setActiveTab] = useState<'main' | 'roles'>('main')
    const [email, setEmail] = useState(initialEmail)
    const [password, setPassword] = useState('')
    const [comment, setComment] = useState(initialComment)
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(initialRoleIds)
    const [validationError, setValidationError] = useState<string | null>(null)
    const initialRoleIdsKey = useMemo(() => initialRoleIds.join(','), [initialRoleIds])
    const normalizedInitialRoleIds = useMemo(() => (initialRoleIdsKey.length > 0 ? initialRoleIdsKey.split(',') : []), [initialRoleIdsKey])

    useEffect(() => {
        if (!open) {
            return
        }

        setActiveTab('main')
        setEmail(initialEmail)
        setPassword('')
        setComment(initialComment)
        setSelectedRoleIds(normalizedInitialRoleIds)
        setValidationError(null)
    }, [initialComment, initialEmail, normalizedInitialRoleIds, open])

    const currentLocale = useMemo(() => {
        const value = i18n.language.split('-')[0] || 'en'
        return isValidLocaleCode(value) ? value : 'en'
    }, [i18n.language])

    const roleLabel = useCallback(
        (role: RoleListItem) => resolveLocalizedContent(role.name, currentLocale, getCodenamePrimary(role.codename)),
        [currentLocale]
    )

    const roleSelectionLabels = useMemo<RoleSelectionLabels>(
        () => ({
            title: t('users.dialog.roleSelection.title', 'Assigned Roles'),
            addButton: t('users.dialog.roleSelection.addButton', 'Add Role'),
            dialogTitle: t('users.dialog.roleSelection.dialogTitle', 'Select Roles'),
            emptyMessage: t('users.dialog.roleSelection.emptyMessage', 'No roles assigned. Click "Add Role" to assign.'),
            noAvailableMessage: t('users.dialog.roleSelection.noAvailableMessage', 'All roles are already assigned.'),
            searchPlaceholder: t('users.dialog.roleSelection.searchPlaceholder', 'Search roles...'),
            cancelButton: tc('actions.cancel'),
            confirmButton: t('users.dialog.roleSelection.confirmButton', 'Add'),
            removeTitle: t('users.dialog.roleSelection.removeTitle', 'Remove role'),
            nameHeader: t('users.dialog.roleSelection.nameHeader', 'Name'),
            codenameHeader: t('users.dialog.roleSelection.codenameHeader', 'Codename')
        }),
        [t, tc]
    )

    const validate = useCallback(() => {
        const result = validateUserFormDialog({
            mode,
            email,
            initialEmail,
            password,
            comment,
            selectedRoleIds,
            t: (key, fallback) => t(key, fallback)
        })

        if (!result.ok) {
            setValidationError(result.error)

            if (result.nextTab) {
                setActiveTab(result.nextTab)
            }

            return null
        }

        setValidationError(null)
        return result.data
    }, [comment, email, initialEmail, mode, password, selectedRoleIds, t])

    const handleSubmit = useCallback(async () => {
        const payload = validate()
        if (!payload) {
            return
        }

        await onSubmit(payload)
    }, [onSubmit, validate])

    const handleClose = useCallback(() => {
        if (!loading) onClose()
    }, [loading, onClose])

    const presentation = useDialogPresentation({ open, onClose: handleClose, fallbackMaxWidth: 'sm', isBusy: loading })

    return (
        <Dialog
            open={open}
            onClose={presentation.dialogProps.onClose}
            maxWidth={resolveDialogMaxWidth(presentation.dialogProps.maxWidth, 'sm') as DialogProps['maxWidth']}
            fullWidth={presentation.dialogProps.fullWidth ?? true}
            disableEscapeKeyDown={presentation.dialogProps.disableEscapeKeyDown}
            PaperProps={mergeDialogPaperProps(undefined, presentation.dialogProps.PaperProps)}
        >
            <DialogTitle>
                {presentation.titleActions ? (
                    <Stack direction='row' alignItems='center' justifyContent='space-between' spacing={2}>
                        <span>{title}</span>
                        {presentation.titleActions}
                    </Stack>
                ) : (
                    title
                )}
            </DialogTitle>
            <DialogContent sx={mergeDialogSx(presentation.contentSx, { pt: '8px !important' })}>
                <Stack spacing={2.5}>
                    {(error || validationError) && (
                        <Alert severity='error' onClose={() => setValidationError(null)}>
                            {validationError || error}
                        </Alert>
                    )}

                    <Tabs value={activeTab} onChange={(_event, nextValue) => setActiveTab(nextValue)}>
                        <Tab value='main' label={t('users.dialog.tabs.main', 'Основное')} />
                        <Tab value='roles' label={t('users.dialog.tabs.roles', 'Роли')} />
                    </Tabs>

                    {activeTab === 'main' && (
                        <Stack spacing={2.5}>
                            <TextField
                                label={t('users.dialog.email', 'Email')}
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                disabled={loading || mode === 'edit'}
                                required
                                fullWidth
                            />

                            {mode === 'create' && (
                                <TextField
                                    label={t('users.dialog.password', 'Password')}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    disabled={loading}
                                    type='password'
                                    fullWidth
                                    helperText={t(
                                        'users.dialog.passwordHint',
                                        'Optional. Leave empty to send an email invitation instead of setting a password manually.'
                                    )}
                                />
                            )}

                            <TextField
                                label={t('users.dialog.comment', 'Comment')}
                                value={comment}
                                onChange={(event) => setComment(event.target.value)}
                                disabled={loading}
                                fullWidth
                                multiline
                                minRows={3}
                                maxRows={6}
                                helperText={t('users.dialog.commentHint', 'Optional internal note for administrators.')}
                            />
                        </Stack>
                    )}

                    {activeTab === 'roles' && (
                        <EntitySelectionPanel
                            availableEntities={roles}
                            selectedIds={selectedRoleIds}
                            onSelectionChange={setSelectedRoleIds}
                            getDisplayName={roleLabel}
                            getCodename={(role: RoleListItem) => getCodenamePrimary(role.codename)}
                            labels={roleSelectionLabels}
                            disabled={loading}
                            error={undefined}
                            isRequired={false}
                            onRequiredChange={undefined}
                            isSingle={false}
                            onSingleChange={undefined}
                            togglesDisabled={false}
                            filterEntity={undefined}
                            headerActions={undefined}
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 2 }}>
                <Button onClick={handleClose} disabled={loading}>
                    {tc('actions.cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : null}
                >
                    {submitLabel}
                </Button>
            </DialogActions>
            {presentation.resizeHandle}
        </Dialog>
    )
}
