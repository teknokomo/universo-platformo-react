import { useState } from 'react'
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { MetaverseAssignableRole } from '../../types'

interface MemberInviteDialogProps {
    open: boolean
    onClose: () => void
    onSubmit: (data: { email: string; role: MetaverseAssignableRole; comment?: string }) => Promise<void>
    loading?: boolean
}

const assignableRoles: MetaverseAssignableRole[] = ['admin', 'editor', 'member']

const MemberInviteDialog = ({ open, onClose, onSubmit, loading }: MemberInviteDialogProps) => {
    const { t } = useTranslation('metaverses')
    const [email, setEmail] = useState('')
    const [role, setRole] = useState<MetaverseAssignableRole>('member')
    const [comment, setComment] = useState('')

    const roleLabels = {
        admin: t('roles.admin'),
        editor: t('roles.editor'),
        member: t('roles.member')
    }

    const handleSubmit = async () => {
        if (!email.trim()) return

        try {
            await onSubmit({
                email: email.trim(),
                role,
                comment: comment.trim() || undefined
            })
            setEmail('')
            setRole('member')
            setComment('')
            onClose()
        } catch (error) {
            // Error handling is managed by the parent component
        }
    }

    const handleClose = () => {
        if (!loading) {
            setEmail('')
            setRole('member')
            setComment('')
            onClose()
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>{t('metaverses.access.dialogs.inviteTitle', 'Invite Member')}</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <TextField
                        label={t('metaverses.access.emailLabel')}
                        placeholder={t('metaverses.access.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type='email'
                        fullWidth
                        required
                        disabled={loading}
                    />
                    <FormControl fullWidth required disabled={loading}>
                        <InputLabel>{t('metaverses.access.roleLabel')}</InputLabel>
                        <Select
                            value={role}
                            label={t('metaverses.access.roleLabel')}
                            onChange={(e) => setRole(e.target.value as MetaverseAssignableRole)}
                        >
                            {assignableRoles.map((roleOption) => (
                                <MenuItem key={roleOption} value={roleOption}>
                                    {roleLabels[roleOption]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label={t('metaverses.access.dialogs.commentLabel', 'Comment')}
                        placeholder={t('metaverses.access.dialogs.commentPlaceholder', 'Optional comment about this member')}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        disabled={loading}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    {t('common.cancel')}
                </Button>
                <Button onClick={handleSubmit} variant='contained' disabled={!email.trim() || loading}>
                    {loading ? t('common.saving') : t('metaverses.access.inviteButton')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default MemberInviteDialog
