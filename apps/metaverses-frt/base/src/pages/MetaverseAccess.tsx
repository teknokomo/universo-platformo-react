import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography
} from '@mui/material'
import { IconTrash, IconRefresh } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse, MetaverseAssignableRole, MetaverseMember, MetaverseMembersResponse } from '../types'

interface MetaverseAccessProps {
    metaverse?: Metaverse | null
}

const assignableRoles: MetaverseAssignableRole[] = ['admin', 'editor', 'member']

const MetaverseAccess = ({ metaverse }: MetaverseAccessProps) => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const { t } = useTranslation('metaverses')

    const [members, setMembers] = useState<MetaverseMember[]>([])
    const [permissions, setPermissions] = useState<MetaverseMembersResponse['permissions'] | null>(
        metaverse?.permissions ?? null
    )
    const [inviteEmail, setInviteEmail] = useState('')
    const [inviteRole, setInviteRole] = useState<MetaverseAssignableRole>('member')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)

    const {
        request: fetchMembers,
        loading: loadingMembers
    } = useApi(metaversesApi.listMetaverseMembers)
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

    useEffect(() => {
        if (!shouldLoadMembers) {
            setMembers([])
            setErrorMessage(null)
            return
        }
        loadMembers().catch((err) =>
            console.error('Failed to load members', { metaverseId, error: err })
        )
    }, [loadMembers, shouldLoadMembers])

    const roleLabels = useMemo(
        () => ({
            owner: t('metaverses.roles.owner'),
            admin: t('metaverses.roles.admin'),
            editor: t('metaverses.roles.editor'),
            member: t('metaverses.roles.member')
        }),
        [t]
    )

    const handleInvite = async () => {
        if (!metaverseId || !canManageMembers) return
        const email = inviteEmail.trim()
        if (!email) return
        try {
            setErrorMessage(null)
            const newMember = await inviteMember(metaverseId, { email, role: inviteRole })
            if (newMember) {
                setMembers((prev) => {
                    const withoutDuplicate = prev.filter((member) => member.id !== newMember.id)
                    return [...withoutDuplicate, newMember]
                })
                setInviteEmail('')
                setInviteRole('member')
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.inviteFailed', 'Failed to invite member')
            setErrorMessage(String(message))
        }
    }

    const handleRoleChange = async (member: MetaverseMember, role: MetaverseAssignableRole) => {
        if (!metaverseId || !canManageMembers) return
        try {
            setErrorMessage(null)
            setUpdatingMemberId(member.id)
            const updated = await changeMemberRole(metaverseId, member.id, { role })
            if (updated) {
                setMembers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
            }
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.updateFailed', 'Failed to update member')
            setErrorMessage(String(message))
        } finally {
            setUpdatingMemberId(null)
        }
    }

    const handleRemove = async (member: MetaverseMember) => {
        if (!metaverseId || !canManageMembers) return
        try {
            setErrorMessage(null)
            setUpdatingMemberId(member.id)
            await removeMember(metaverseId, member.id)
            setMembers((prev) => prev.filter((item) => item.id !== member.id))
        } catch (error: any) {
            const message =
                error?.response?.data?.error || error?.message || t('metaverses.access.errors.removeFailed', 'Failed to remove member')
            setErrorMessage(String(message))
        } finally {
            setUpdatingMemberId(null)
        }
    }

    const isBusy = invitingMember || updatingMember || removingMember

    return (
        <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', width: '100%' }}>
            <Stack spacing={3} sx={{ p: 2 }}>
                <Stack direction='row' alignItems='center' justifyContent='space-between'>
                    <Typography variant='h5'>{t('metaverses.access.title')}</Typography>
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
                </Stack>
                {metaverse?.name && (
                    <Typography variant='body2' color='text.secondary'>
                        {t('metaverses.access.subtitle', { name: metaverse.name })}
                    </Typography>
                )}

                {errorMessage && <Alert severity='error'>{errorMessage}</Alert>}

                {!shouldLoadMembers && (
                    <Alert severity='info'>{t('metaverses.access.notAllowed')}</Alert>
                )}

                {shouldLoadMembers && (
                    <Stack
                        spacing={2}
                        direction={{ xs: 'column', md: 'row' }}
                        alignItems={{ xs: 'stretch', md: 'flex-end' }}
                    >
                        <TextField
                            label={t('metaverses.access.emailLabel')}
                            placeholder={t('metaverses.access.emailPlaceholder')}
                            value={inviteEmail}
                            onChange={(event) => setInviteEmail(event.target.value)}
                            type='email'
                            fullWidth
                        />
                        <FormControl sx={{ minWidth: 160 }}>
                            <InputLabel id='invite-role-label'>{t('metaverses.access.roleLabel')}</InputLabel>
                            <Select
                                labelId='invite-role-label'
                                label={t('metaverses.access.roleLabel')}
                                value={inviteRole}
                                onChange={(event) => setInviteRole(event.target.value as MetaverseAssignableRole)}
                            >
                                {assignableRoles.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {roleLabels[role]}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant='contained'
                            onClick={handleInvite}
                            disabled={!inviteEmail.trim() || isBusy}
                        >
                            {t('metaverses.access.inviteButton')}
                        </Button>
                    </Stack>
                )}

                {shouldLoadMembers && (
                    <TableContainer
                        component={Box}
                        sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
                    >
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>{t('metaverses.access.table.email')}</TableCell>
                                    <TableCell>{t('metaverses.access.table.role')}</TableCell>
                                    <TableCell>{t('metaverses.access.table.added')}</TableCell>
                                    <TableCell align='right'>{t('metaverses.access.table.actions')}</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {members.map((member) => {
                                    const isOwner = member.role === 'owner'
                                    const isUpdating = updatingMemberId === member.id && isBusy
                                    return (
                                        <TableRow key={member.id} hover>
                                            <TableCell sx={{ minWidth: 200 }}>{member.email || member.userId}</TableCell>
                                            <TableCell sx={{ minWidth: 160 }}>
                                                {isOwner ? (
                                                    <Chip label={roleLabels.owner} color='primary' size='small' />
                                                ) : (
                                                    <FormControl size='small' fullWidth>
                                                        <Select
                                                            value={member.role as MetaverseAssignableRole}
                                                            onChange={(event) =>
                                                                handleRoleChange(member, event.target.value as MetaverseAssignableRole)
                                                            }
                                                            disabled={isUpdating || !canManageMembers}
                                                        >
                                                            {assignableRoles.map((role) => (
                                                                <MenuItem key={role} value={role}>
                                                                    {roleLabels[role]}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ minWidth: 200 }}>
                                                {new Date(member.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell align='right'>
                                                {isOwner ? null : (
                                                    <IconButton
                                                        aria-label={t('metaverses.access.table.remove')}
                                                        color='error'
                                                        onClick={() => handleRemove(member)}
                                                        disabled={isUpdating || !canManageMembers}
                                                    >
                                                        <IconTrash size={18} />
                                                    </IconButton>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {members.length === 0 && !loadingMembers && (
                                    <TableRow>
                                        <TableCell colSpan={4} align='center'>
                                            <Typography variant='body2' color='text.secondary'>
                                                {t('metaverses.access.empty')}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                                {loadingMembers && (
                                    <TableRow>
                                        <TableCell colSpan={4} align='center'>
                                            <CircularProgress size={24} />
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Stack>
        </Card>
    )
}

export default MetaverseAccess
