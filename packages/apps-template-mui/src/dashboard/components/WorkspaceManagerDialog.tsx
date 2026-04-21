import { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { fetchWithCsrf } from '../../api/api'
import ConfirmDeleteDialog from '../../components/dialogs/ConfirmDeleteDialog'

type WorkspaceItem = {
    id: string
    codename: string
    name: unknown
    workspaceType: string
    status: string
    isDefault: boolean
    roleCodename: string
}

type MemberItem = {
    userId: string
    roleCodename: string
}

const readName = (name: unknown): string => {
    if (typeof name === 'string') return name
    if (!name || typeof name !== 'object') return ''
    const locales = (name as Record<string, unknown>).locales
    if (!locales || typeof locales !== 'object') return ''
    const primary = (name as Record<string, unknown>)._primary
    if (typeof primary === 'string') {
        const content = (locales as Record<string, Record<string, unknown>>)[primary]?.content
        if (typeof content === 'string') return content
    }
    const en = (locales as Record<string, Record<string, unknown>>).en?.content
    if (typeof en === 'string') return en
    for (const entry of Object.values(locales as Record<string, Record<string, unknown>>)) {
        if (typeof entry?.content === 'string') return entry.content
    }
    return ''
}

interface WorkspaceManagerDialogProps {
    open: boolean
    onClose: () => void
}

export default function WorkspaceManagerDialog({ open, onClose }: WorkspaceManagerDialogProps) {
    const { t } = useTranslation('apps')
    const details = useDashboardDetails()
    const queryClient = useQueryClient()
    const applicationId = details?.applicationId
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'

    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
    const [newName, setNewName] = useState('')
    const [newCodename, setNewCodename] = useState('')
    const [inviteUserId, setInviteUserId] = useState('')
    const [inviteRole, setInviteRole] = useState<'member'>('member')
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null)

    const { data: workspaces = [] } = useQuery<WorkspaceItem[]>({
        queryKey: ['workspaces', applicationId],
        enabled: Boolean(applicationId && open),
        queryFn: async () => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            const url = new URL(`${baseUrl}/applications/${applicationId}/runtime/workspaces`, window.location.origin)
            const response = await fetch(url.toString(), { credentials: 'include' })
            if (!response.ok) throw new Error(t('workspace.errorLoad'))
            const payload = await response.json()
            return Array.isArray(payload.items) ? payload.items : []
        }
    })

    useEffect(() => {
        if (!open) return
        if (selectedWorkspaceId) return
        const defaultWorkspace = workspaces.find((workspace) => workspace.isDefault) ?? workspaces[0]
        setSelectedWorkspaceId(defaultWorkspace?.id ?? null)
    }, [open, selectedWorkspaceId, workspaces])

    const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
    const canManageMembers = selectedWorkspace?.workspaceType === 'shared' && selectedWorkspace.roleCodename === 'owner'

    const { data: members = [] } = useQuery<MemberItem[]>({
        queryKey: ['workspace-members', applicationId, selectedWorkspaceId],
        enabled: Boolean(applicationId && selectedWorkspaceId && open),
        queryFn: async () => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            const url = new URL(
                `${baseUrl}/applications/${applicationId}/runtime/workspaces/${selectedWorkspaceId}/members`,
                window.location.origin
            )
            const response = await fetch(url.toString(), { credentials: 'include' })
            if (!response.ok) return []
            const payload = await response.json()
            return Array.isArray(payload.items) ? payload.items : []
        }
    })

    const createMutation = useMutation({
        mutationFn: async () => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            await fetchWithCsrf(apiBaseUrl, `${baseUrl}/applications/${applicationId}/runtime/workspaces`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codename: newCodename, name: newName })
            })
        },
        onSuccess: () => {
            setNewName('')
            setNewCodename('')
            queryClient.invalidateQueries({ queryKey: ['workspaces', applicationId] })
        }
    })

    const inviteMutation = useMutation({
        mutationFn: async () => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            await fetchWithCsrf(apiBaseUrl, `${baseUrl}/applications/${applicationId}/runtime/workspaces/${selectedWorkspaceId}/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: inviteUserId, roleCodename: inviteRole })
            })
        },
        onSuccess: () => {
            setInviteUserId('')
            queryClient.invalidateQueries({ queryKey: ['workspace-members', applicationId, selectedWorkspaceId] })
        }
    })

    const removeMemberMutation = useMutation({
        mutationFn: async (userId: string) => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            await fetchWithCsrf(
                apiBaseUrl,
                `${baseUrl}/applications/${applicationId}/runtime/workspaces/${selectedWorkspaceId}/members/${userId}`,
                { method: 'DELETE' }
            )
        },
        onSuccess: () => {
            setMemberToRemove(null)
            queryClient.invalidateQueries({ queryKey: ['workspace-members', applicationId, selectedWorkspaceId] })
        }
    })

    const handleSelectWorkspace = (workspaceId: string) => {
        setSelectedWorkspaceId(workspaceId === selectedWorkspaceId ? null : workspaceId)
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {t('workspace.title')}
                <IconButton aria-label={t('workspace.close')} onClick={onClose} size='small'>
                    <CloseRoundedIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction='row' spacing={1} alignItems='flex-end'>
                        <TextField
                            label={t('workspace.createName')}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            size='small'
                            sx={{ flex: 1 }}
                        />
                        <TextField
                            label={t('workspace.createCodename')}
                            value={newCodename}
                            onChange={(e) => setNewCodename(e.target.value)}
                            size='small'
                            sx={{ flex: 1 }}
                        />
                        <Button
                            variant='contained'
                            size='small'
                            onClick={() => createMutation.mutate()}
                            disabled={!newName || !newCodename || createMutation.isPending}
                        >
                            {createMutation.isPending ? t('workspace.creating') : t('workspace.create')}
                        </Button>
                    </Stack>

                    <Divider />

                    <Typography variant='subtitle2'>{t('workspace.manage', 'Manage workspaces')}</Typography>
                    <List dense disablePadding>
                        {workspaces.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                {t('workspace.noWorkspaces')}
                            </Typography>
                        ) : null}
                        {workspaces.map((ws) => (
                            <ListItem key={ws.id} disablePadding>
                                <ListItemButton
                                    selected={ws.id === selectedWorkspaceId}
                                    onClick={() => handleSelectWorkspace(ws.id)}
                                    sx={{ borderRadius: 1 }}
                                >
                                    <ListItemText
                                        primary={readName(ws.name) || ws.codename}
                                        secondary={ws.workspaceType === 'personal' ? t('workspace.personal') : t('workspace.shared')}
                                    />
                                    {ws.roleCodename === 'owner' ? (
                                        <Chip label={t('workspace.roleOwner')} size='small' variant='outlined' />
                                    ) : null}
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    {selectedWorkspaceId && (
                        <>
                            <Divider />
                            <Typography variant='subtitle2'>{t('workspace.members')}</Typography>
                            <List dense disablePadding>
                                {members.length === 0 ? (
                                    <Typography variant='body2' color='text.secondary'>
                                        {t('workspace.noMembers', 'No members yet')}
                                    </Typography>
                                ) : null}
                                {members.map((member) => (
                                    <ListItem
                                        key={member.userId}
                                        secondaryAction={
                                            canManageMembers ? (
                                            <IconButton
                                                edge='end'
                                                size='small'
                                                onClick={() => setMemberToRemove(member.userId)}
                                                aria-label={t('workspace.removeMember')}
                                            >
                                                <DeleteOutlineRoundedIcon fontSize='small' />
                                            </IconButton>
                                            ) : undefined
                                        }
                                    >
                                        <ListItemText
                                            primary={member.userId}
                                            secondary={
                                                member.roleCodename === 'owner' ? t('workspace.roleOwner') : t('workspace.roleMember')
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                            {canManageMembers ? (
                                <Stack direction='row' spacing={1} alignItems='flex-end'>
                                <TextField
                                    label={t('workspace.inviteUserId')}
                                    value={inviteUserId}
                                    onChange={(e) => setInviteUserId(e.target.value)}
                                    size='small'
                                    sx={{ flex: 1 }}
                                />
                                <TextField
                                    select
                                    label={t('workspace.inviteRole')}
                                    value={inviteRole}
                                    onChange={(event) => setInviteRole(event.target.value as 'member')}
                                    size='small'
                                    sx={{ minWidth: 140 }}
                                >
                                    <MenuItem value='member'>{t('workspace.roleMember')}</MenuItem>
                                </TextField>
                                <Button
                                    variant='outlined'
                                    size='small'
                                    startIcon={<PersonAddRoundedIcon />}
                                    onClick={() => inviteMutation.mutate()}
                                    disabled={!inviteUserId || inviteMutation.isPending}
                                >
                                    {t('workspace.invite')}
                                </Button>
                                </Stack>
                            ) : null}
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('workspace.close')}</Button>
            </DialogActions>
            <ConfirmDeleteDialog
                open={Boolean(memberToRemove)}
                title={t('workspace.removeMemberTitle', 'Remove member')}
                description={t('workspace.removeMemberConfirm')}
                confirmButtonText={t('workspace.removeMember')}
                deletingButtonText={t('workspace.removing', 'Removing…')}
                cancelButtonText={t('workspace.close')}
                error={removeMemberMutation.isError ? t('workspace.errorRemove') : undefined}
                onCancel={() => {
                    if (!removeMemberMutation.isPending) {
                        setMemberToRemove(null)
                    }
                }}
                onConfirm={async () => {
                    if (!memberToRemove) return
                    await removeMemberMutation.mutateAsync(memberToRemove)
                }}
            />
        </Dialog>
    )
}
