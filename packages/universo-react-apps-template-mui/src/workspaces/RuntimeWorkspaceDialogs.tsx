import { useEffect, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { emailSchema } from '@universo-react/types'
import { StandardDialog } from '../components/dialogs/StandardDialog'
import { readInputChangeValue, readWorkspaceRoleChangeValue } from './runtimeWorkspaceHelpers'

export function WorkspaceMetricCard({ title, value }: { title: string; value: string }) {
    return (
        <Card
            variant='outlined'
            data-testid='runtime-workspace-metric-card'
            sx={{
                borderRadius: 1,
                height: '100%',
                minHeight: 112,
                flexGrow: 1
            }}
        >
            <CardContent>
                <Typography
                    component='h2'
                    variant='subtitle2'
                    gutterBottom
                    sx={{
                        color: 'text.secondary'
                    }}
                >
                    {title}
                </Typography>
                <Typography variant='h5' component='p' sx={{ overflowWrap: 'anywhere' }}>
                    {value}
                </Typography>
            </CardContent>
        </Card>
    )
}

export function ConvertToSharedDialog({
    open,
    error,
    loading,
    onCancel,
    onConfirm
}: {
    open: boolean
    error?: string
    loading: boolean
    onCancel: () => void
    onConfirm: () => void
}) {
    const { t } = useTranslation('apps')
    const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
    const descriptionId = 'runtime-convert-shared-description'

    // MUI Dialog autofocuses the dialog container itself; for an irreversible
    // destructive confirmation the DOM-first safe action must hold the initial
    // focus, so the dialog moves it explicitly on open.
    useEffect(() => {
        if (!open) return
        const frame = requestAnimationFrame(() => cancelButtonRef.current?.focus())
        return () => cancelAnimationFrame(frame)
    }, [open])

    return (
        <StandardDialog
            open={open}
            onClose={onCancel}
            title={t('workspace.convertTitle', 'Convert to shared workspace?')}
            isBusy={loading}
            ariaDescribedBy={descriptionId}
            actions={
                <>
                    {/* Cancel is rendered DOM-first so the initial (autofocused)
                        focus lands on the safe action for an irreversible change. */}
                    <Button ref={cancelButtonRef} onClick={onCancel} disabled={loading}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        variant='contained'
                        color='error'
                        onClick={() => {
                            void Promise.resolve(onConfirm()).catch(() => undefined)
                        }}
                        disabled={loading}
                    >
                        {loading ? t('workspace.convertBusy', 'Converting…') : t('workspace.convertConfirm', 'Convert to shared')}
                    </Button>
                </>
            }
        >
            <Stack id={descriptionId} spacing={1.5} useFlexGap>
                {error ? <Alert severity='error'>{error}</Alert> : null}
                <Alert severity='warning'>{t('workspace.convertOneWayLine', 'This change is permanent and cannot be undone.')}</Alert>
                <Typography variant='body2' component='div'>
                    <Box component='ul' sx={{ m: 0, pl: 3, display: 'grid', gap: 0.5 }}>
                        <li>
                            {t(
                                'workspace.convertVisibilityLine',
                                'Every application member sees this workspace with baseline member rights; existing owner roles are kept.'
                            )}
                        </li>
                        <li>
                            {t(
                                'workspace.convertGuestLinksLine',
                                'Existing guest links in this workspace become eligible when configured. Anonymous public access is not enabled automatically.'
                            )}
                        </li>
                        <li>{t('workspace.convertDataLine', 'The workspace, its records and links are preserved.')}</li>
                    </Box>
                </Typography>
            </Stack>
        </StandardDialog>
    )
}

export function InviteMemberDialog({
    open,
    error,
    isSubmitting,
    onClose,
    onSubmit
}: {
    open: boolean
    error: string | null
    isSubmitting: boolean
    onClose: () => void
    onSubmit: (data: { email: string; roleCodename: 'owner' | 'member' }) => Promise<unknown>
}) {
    const { t } = useTranslation('apps')
    const [email, setEmail] = useState('')
    const [emailInvalid, setEmailInvalid] = useState(false)
    const [roleCodename, setRoleCodename] = useState<'owner' | 'member'>('member')

    useEffect(() => {
        if (open) {
            return
        }
        setEmail('')
        setEmailInvalid(false)
        setRoleCodename('member')
    }, [open])

    return (
        <Dialog open={open} onClose={isSubmitting ? undefined : onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{t('workspace.addMemberTitle', 'Add member')}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                    {error ? <Alert severity='error'>{error}</Alert> : null}
                    <TextField
                        type='email'
                        label={t('workspace.fields.email', 'Email')}
                        value={email}
                        onChange={(event) => {
                            setEmail(readInputChangeValue(event))
                            setEmailInvalid(false)
                        }}
                        autoComplete='email'
                        error={emailInvalid}
                        helperText={emailInvalid ? t('workspace.errors.emailInvalid', 'Enter a valid email address.') : undefined}
                        fullWidth
                    />
                    <TextField
                        select
                        label={t('workspace.fields.role', 'Role')}
                        value={roleCodename}
                        onChange={(event) => setRoleCodename(readWorkspaceRoleChangeValue(event))}
                        fullWidth
                    >
                        <MenuItem value='member'>{t('workspace.roleMember', 'Member')}</MenuItem>
                        <MenuItem value='owner'>{t('workspace.roleOwner', 'Owner')}</MenuItem>
                    </TextField>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 3, pt: 2 }}>
                <Button onClick={onClose} disabled={isSubmitting}>
                    {t('app.cancel', 'Cancel')}
                </Button>
                <Button
                    variant='contained'
                    onClick={() => {
                        const trimmedEmail = email.trim()
                        if (!emailSchema.safeParse(trimmedEmail).success) {
                            setEmailInvalid(true)
                            return
                        }
                        void onSubmit({ email: trimmedEmail, roleCodename }).catch(() => undefined)
                    }}
                    disabled={isSubmitting || email.trim().length === 0}
                >
                    {isSubmitting ? t('app.saving', 'Saving...') : t('workspace.addMember', 'Add')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
