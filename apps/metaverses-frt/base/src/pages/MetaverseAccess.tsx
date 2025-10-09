import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    ToggleButton,
    ToggleButtonGroup,
    Typography
} from '@mui/material'
import { IconCards, IconList, IconRefresh, IconUserPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import {
    Metaverse,
    MetaverseAssignableRole,
    MetaverseMember,
    MetaverseMembersResponse,
    MetaversePermissions,
    MetaverseRole
} from '../types'
import useConfirm from '@ui/hooks/useConfirm'
import ConfirmDialog from '@ui/ui-component/dialog/ConfirmDialog'
import ViewHeader from '@ui/layout/MainLayout/ViewHeader'
import { enqueueSnackbar as enqueueSnackbarAction } from '@ui/store/actions'
import { useAuth } from '@ui/utils/authProvider'

import MemberInviteDialog from '../components/dialogs/MemberInviteDialog'
import MemberEditDialog from '../components/dialogs/MemberEditDialog'

const rolePermissionsMap: Record<MetaverseRole, MetaversePermissions> = {
    owner: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    admin: {
        manageMembers: true,
        manageMetaverse: true,
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    editor: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: true,
        deleteContent: false
    },
    member: {
        manageMembers: false,
        manageMetaverse: false,
        createContent: false,
        editContent: false,
        deleteContent: false
    }
}

interface MetaverseAccessProps {
    metaverse?: Metaverse | null
}

const MetaverseAccess = ({ metaverse }: MetaverseAccessProps) => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')
    const dispatch = useDispatch()
    const { user } = useAuth()
    const currentUserId = user?.id ?? null
    const { confirm } = useConfirm()

    const [members, setMembers] = useState<MetaverseMember[]>([])
    const [permissions, setPermissions] = useState<MetaverseMembersResponse['permissions'] | null>(metaverse?.permissions ?? null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [viewType, setViewType] = useState<'card' | 'list'>('card')
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editingMember, setEditingMember] = useState<MetaverseMember | null>(null)

    const { request: fetchMembers, loading: loadingMembers } = useApi(metaversesApi.listMetaverseMembers)
    const { request: inviteMember, loading: invitingMember } = useApi(metaversesApi.inviteMetaverseMember)
    const { request: changeMemberRole, loading: updatingMember } = useApi(metaversesApi.updateMetaverseMemberRole)
    const { request: removeMember, loading: removingMember } = useApi(metaversesApi.removeMetaverseMember)

    const canManageMembers = permissions?.manageMembers ?? false
    const shouldLoadMembers = Boolean(metaverseId) && canManageMembers

    useEffect(() => {
        if (metaverse?.permissions) {
            setPermissions(metaverse.permissions)
        }
    }, [metaverse?.permissions])

    const loadMembers = useCallback(async () => {
        if (!shouldLoadMembers || !metaverseId) {
            setMembers([])
            setErrorMessage(null)
            return
        }
        try {
            setErrorMessage(null)
            const response = await fetchMembers(metaverseId)
            if (response) {
                setMembers(Array.isArray(response.members) ? response.members : [])
                setPermissions(response.permissions)
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.loadFailed', 'Failed to load members')
            setErrorMessage(String(message))
        }
    }, [fetchMembers, metaverseId, shouldLoadMembers, t])

    const enqueueSnackbar = useCallback(
        (payload: Parameters<typeof enqueueSnackbarAction>[0]) => dispatch(enqueueSnackbarAction(payload)),
        [dispatch]
    )

    useEffect(() => {
        if (!shouldLoadMembers) {
            setMembers([])
            setErrorMessage(null)
            return
        }
        loadMembers().catch((err) => console.error('Failed to load members', { metaverseId, error: err }))
    }, [loadMembers, shouldLoadMembers, metaverseId])

    const roleLabels = useMemo(
        () => ({
            owner: t('roles.owner'),
            admin: t('roles.admin'),
            editor: t('roles.editor'),
            member: t('roles.member')
        }),
        [t]
    )

    const handleInviteSubmit = async (data: { email: string; role: MetaverseAssignableRole; comment?: string }) => {
        if (!metaverseId || !canManageMembers) return
        try {
            setErrorMessage(null)
            const newMember = await inviteMember(metaverseId, data)
            if (newMember) {
                setMembers((prev) => {
                    const withoutDuplicate = prev.filter((member) => member.id !== newMember.id)
                    return [...withoutDuplicate, newMember]
                })
            }
        } catch (error: any) {
            const errorData = error?.response?.data
            const errorCode = errorData?.code
            const rawMessage = errorData?.error || error?.message

            if (errorCode === 'METAVERSE_MEMBER_EXISTS' || rawMessage === 'User already has access') {
                setErrorMessage(t('metaverses.access.errors.alreadyHasAccess'))
                return
            }

            if (typeof rawMessage === 'string' && rawMessage.trim().length > 0) {
                setErrorMessage(rawMessage)
                return
            }

            setErrorMessage(t('metaverses.access.errors.inviteFailed', 'Failed to invite member'))
        }
    }

    const handleEditSubmit = async (data: { role: MetaverseAssignableRole; comment?: string }) => {
        if (!metaverseId || !canManageMembers || !editingMember) return
        const isSelf = currentUserId && editingMember.userId === currentUserId
        if (isSelf && data.role !== 'admin') {
            const confirmed = await confirm({
                title: t('metaverses.access.confirm.downgradeTitle'),
                description: t('metaverses.access.confirm.downgradeDescription', { role: roleLabels[data.role] }),
                confirmButtonName: t('metaverses.access.confirm.confirmButton'),
                cancelButtonName: t('metaverses.access.confirm.cancelButton')
            })
            if (!confirmed) {
                return
            }
        }
        try {
            setErrorMessage(null)
            const updated = await changeMemberRole(metaverseId, editingMember.id, data)
            if (updated) {
                setMembers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
                if (currentUserId && updated.userId === currentUserId) {
                    const nextPermissions = rolePermissionsMap[updated.role as MetaverseRole]
                    setPermissions(nextPermissions)
                    if (!nextPermissions.manageMembers) {
                        enqueueSnackbar({
                            message: t('metaverses.access.notifications.selfDowngraded'),
                            options: { variant: 'warning' }
                        })
                        navigate(`/metaverses/${metaverseId}`, { replace: true })
                    }
                }
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.updateFailed', 'Failed to update member')
            setErrorMessage(String(message))
        } finally {
            // Error handling completed
        }
    }

    const openEditDialog = (member: MetaverseMember) => {
        setEditingMember(member)
        setEditDialogOpen(true)
    }

    const handleRemove = async (member: MetaverseMember) => {
        if (!metaverseId || !canManageMembers) return
        const isSelf = currentUserId && member.userId === currentUserId
        const confirmed = await confirm({
            title: t('metaverses.access.confirm.removeTitle'),
            description: isSelf
                ? t('metaverses.access.confirm.removeSelfDescription')
                : t('metaverses.access.confirm.removeDescription', {
                      email: member.email || member.userId
                  }),
            confirmButtonName: t('metaverses.access.confirm.confirmButton'),
            cancelButtonName: t('metaverses.access.confirm.cancelButton')
        })
        if (!confirmed) {
            return
        }
        try {
            setErrorMessage(null)
            await removeMember(metaverseId, member.id)
            setMembers((prev) => prev.filter((item) => item.id !== member.id))
            if (isSelf) {
                enqueueSnackbar({
                    message: t('metaverses.access.notifications.selfRemoved'),
                    options: { variant: 'warning' }
                })
                navigate('/metaverses', { replace: true })
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.removeFailed', 'Failed to remove member')
            setErrorMessage(String(message))
        } finally {
            // Error handling completed
        }
    }

    const isBusy = invitingMember || updatingMember || removingMember

    return (
        <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', width: '100%' }}>
            <Stack spacing={3} sx={{ p: 2 }}>
                <ViewHeader
                    title={t('metaverses.access.title')}
                    description={metaverse?.name ? t('metaverses.access.subtitle', { name: metaverse.name }) : undefined}
                    search={false}
                >
                    <Stack direction='row' spacing={1} alignItems='center'>
                        {loadingMembers && shouldLoadMembers && <CircularProgress size={18} />}
                        <IconButton
                            onClick={() => shouldLoadMembers && loadMembers()}
                            aria-label={t('metaverses.access.refresh')}
                            size='small'
                            disabled={!shouldLoadMembers}
                        >
                            <IconRefresh size={18} />
                        </IconButton>
                    </Stack>
                </ViewHeader>

                {errorMessage && <Alert severity='error'>{errorMessage}</Alert>}

                {!shouldLoadMembers && <Alert severity='info'>{t('metaverses.access.notAllowed')}</Alert>}

                {shouldLoadMembers && (
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                        <ToggleButtonGroup
                            value={viewType}
                            exclusive
                            onChange={(_, newView) => newView && setViewType(newView)}
                            size='small'
                        >
                            <ToggleButton value='card' aria-label={t('common.cardView')}>
                                <IconCards size={18} />
                            </ToggleButton>
                            <ToggleButton value='list' aria-label={t('common.listView')}>
                                <IconList size={18} />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <Button
                            variant='contained'
                            onClick={() => setInviteDialogOpen(true)}
                            disabled={isBusy}
                            startIcon={<IconUserPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            {t('metaverses.access.inviteButton')}
                        </Button>
                    </Stack>
                )}

                {shouldLoadMembers && (
                    <Box>
                        {loadingMembers ? (
                            <Box display='flex' justifyContent='center' p={3}>
                                <CircularProgress size={24} />
                            </Box>
                        ) : members.length === 0 ? (
                            <Box textAlign='center' p={3}>
                                <Typography variant='body2' color='text.secondary'>
                                    {t('metaverses.access.empty')}
                                </Typography>
                            </Box>
                        ) : viewType === 'card' ? (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: 2
                                }}
                            >
                                {members.map((member) => {
                                    const isOwner = member.role === 'owner'
                                    return (
                                        <Card
                                            key={member.id}
                                            sx={{
                                                p: 2,
                                                cursor: !isOwner ? 'pointer' : 'default',
                                                '&:hover': !isOwner
                                                    ? {
                                                          boxShadow: 3
                                                      }
                                                    : {}
                                            }}
                                            onClick={() => !isOwner && openEditDialog(member)}
                                        >
                                            <Box>
                                                <Typography variant='h6' component='div' gutterBottom>
                                                    {member.email || member.userId}
                                                </Typography>
                                                {member.comment && (
                                                    <Typography variant='body2' color='text.secondary' gutterBottom>
                                                        {member.comment}
                                                    </Typography>
                                                )}
                                                <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Chip
                                                        label={roleLabels[member.role as keyof typeof roleLabels]}
                                                        color={isOwner ? 'primary' : 'default'}
                                                        size='small'
                                                    />
                                                    <Typography variant='caption' color='text.secondary'>
                                                        {new Date(member.createdAt).toLocaleDateString()}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Card>
                                    )
                                })}
                            </Box>
                        ) : (
                            <TableContainer component={Box} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>{t('metaverses.access.table.email')}</TableCell>
                                            <TableCell>{t('metaverses.access.table.role')}</TableCell>
                                            <TableCell>{t('metaverses.access.dialogs.commentLabel', 'Comment')}</TableCell>
                                            <TableCell>{t('metaverses.access.table.added')}</TableCell>
                                            <TableCell align='right'>{t('metaverses.access.table.actions')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {members.map((member) => {
                                            const isOwner = member.role === 'owner'
                                            return (
                                                <TableRow key={member.id} hover>
                                                    <TableCell>{member.email || member.userId}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={roleLabels[member.role as keyof typeof roleLabels]}
                                                            color={isOwner ? 'primary' : 'default'}
                                                            size='small'
                                                        />
                                                    </TableCell>
                                                    <TableCell>{member.comment || '-'}</TableCell>
                                                    <TableCell>{new Date(member.createdAt).toLocaleDateString()}</TableCell>
                                                    <TableCell align='right'>
                                                        {!isOwner && (
                                                            <Stack direction='row' spacing={1}>
                                                                <Button
                                                                    size='small'
                                                                    onClick={() => openEditDialog(member)}
                                                                    disabled={!canManageMembers}
                                                                >
                                                                    {t('common.edit', 'Edit')}
                                                                </Button>
                                                                <Button
                                                                    size='small'
                                                                    color='error'
                                                                    onClick={() => handleRemove(member)}
                                                                    disabled={!canManageMembers}
                                                                >
                                                                    {t('metaverses.access.table.remove')}
                                                                </Button>
                                                            </Stack>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Box>
                )}
            </Stack>

            <MemberInviteDialog
                open={inviteDialogOpen}
                onClose={() => setInviteDialogOpen(false)}
                onSubmit={handleInviteSubmit}
                loading={invitingMember}
            />

            <MemberEditDialog
                open={editDialogOpen}
                member={editingMember}
                onClose={() => {
                    setEditDialogOpen(false)
                    setEditingMember(null)
                }}
                onSubmit={handleEditSubmit}
                loading={updatingMember}
            />

            <ConfirmDialog />
        </Card>
    )
}

export default MetaverseAccess
