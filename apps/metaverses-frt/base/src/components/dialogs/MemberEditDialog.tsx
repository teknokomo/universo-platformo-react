import { useState, useEffect } from 'react'
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
import { MetaverseAssignableRole, MetaverseMember } from '../../types'

interface MemberEditDialogProps {
    open: boolean
    member: MetaverseMember | null
    onClose: () => void
    onSubmit: (data: { role: MetaverseAssignableRole; comment?: string }) => Promise<void>
    loading?: boolean
}

const assignableRoles: MetaverseAssignableRole[] = ['admin', 'editor', 'member']

const MemberEditDialog = ({ open, member, onClose, onSubmit, loading }: MemberEditDialogProps) => {
    const { t } = useTranslation('metaverses')
    const [role, setRole] = useState<MetaverseAssignableRole>('member')
    const [comment, setComment] = useState('')

    const roleLabels = {
        admin: t('roles.admin'),
        editor: t('roles.editor'),
        member: t('roles.member')
    }

    useEffect(() => {
        if (member && open) {
            setRole(member.role as MetaverseAssignableRole)
            setComment(member.comment || '')
        }
    }, [member, open])

    const handleSubmit = async () => {
        try {
            await onSubmit({
                role,
                comment: comment.trim() || undefined
            })
            onClose()
        } catch (error) {
            // Error handling is managed by the parent component
        }
    }

    const handleClose = () => {
        if (!loading) {
            onClose()
        }
    }

    if (!member) return null

    return (
        <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth>
            <DialogTitle>
                {t('metaverses.access.dialogs.editTitle', 'Edit Member')} - {member.email || member.userId}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
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
                <Button onClick={handleSubmit} variant='contained' disabled={loading}>
                    {loading ? t('common.saving') : t('common.save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

export default MemberEditDialog
