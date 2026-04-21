import { Fragment, useState } from 'react'
import Select, { selectClasses, type SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { fetchWithCsrf } from '../../api/api'
import WorkspaceManagerDialog from './WorkspaceManagerDialog'

type WorkspaceItem = {
    id: string
    codename: string
    name: unknown
    workspaceType: string
    status: string
    isDefault: boolean
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

export default function WorkspaceSwitcher() {
    const { t } = useTranslation('apps')
    const details = useDashboardDetails()
    const queryClient = useQueryClient()
    const applicationId = details?.applicationId
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'
    const currentWorkspaceId = details?.currentWorkspaceId ?? ''
    const workspacesEnabled = details?.workspacesEnabled ?? false

    const [open, setOpen] = useState(false)
    const [managerOpen, setManagerOpen] = useState(false)

    const { data: workspaces = [], isLoading } = useQuery<WorkspaceItem[]>({
        queryKey: ['workspaces', applicationId],
        enabled: Boolean(applicationId && workspacesEnabled),
        queryFn: async () => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            const url = new URL(`${baseUrl}/applications/${applicationId}/runtime/workspaces`, window.location.origin)
            const response = await fetch(url.toString(), { credentials: 'include' })
            if (!response.ok) throw new Error(t('workspace.errorLoad'))
            const payload = await response.json()
            return Array.isArray(payload.items) ? payload.items : []
        }
    })

    const switchMutation = useMutation({
        mutationFn: async (workspaceId: string) => {
            const baseUrl = apiBaseUrl.replace(/\/$/, '')
            await fetchWithCsrf(apiBaseUrl, `${baseUrl}/applications/${applicationId}/runtime/workspaces/${workspaceId}/default`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' }
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces', applicationId] })
            queryClient.invalidateQueries({ queryKey: ['runtime', applicationId] })
        }
    })

    if (!workspacesEnabled || !applicationId) {
        return null
    }

    if (isLoading) {
        return (
            <Stack direction='row' spacing={0.5} alignItems='center'>
                <CircularProgress size={16} />
            </Stack>
        )
    }

    if (workspaces.length === 0) {
        return null
    }

    const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) ?? workspaces[0]
    const currentName = currentWorkspace ? readName(currentWorkspace.name) || currentWorkspace.codename : ''
    const currentIsPersonal = currentWorkspace?.workspaceType === 'personal'

    const handleChange = (event: SelectChangeEvent) => {
        const value = event.target.value
        if (value && value !== currentWorkspaceId) {
            switchMutation.mutate(value)
        }
        setOpen(false)
    }

    return (
        <Fragment>
            <Stack direction='row' spacing={0.5} alignItems='center'>
                <Tooltip title={t('workspace.switch')}>
                    <Select
                        value={currentWorkspace.id}
                        open={open}
                        onOpen={() => setOpen(true)}
                        onClose={() => setOpen(false)}
                        onChange={handleChange}
                        size='small'
                        displayEmpty
                        disabled={switchMutation.isPending || isLoading}
                        renderValue={() => (
                            <Stack direction='row' spacing={0.75} alignItems='center'>
                                {currentIsPersonal ? (
                                    <PersonRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                ) : (
                                    <FolderRoundedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                )}
                                <Typography variant='body2' noWrap>
                                    {currentName}
                                </Typography>
                                {switchMutation.isPending || isLoading ? <CircularProgress size={14} /> : null}
                            </Stack>
                        )}
                        sx={{
                            minWidth: 150,
                            maxWidth: 220,
                            [`& .${selectClasses.select}`]: {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                                py: 0.5,
                                px: 1
                            }
                        }}
                    >
                        {workspaces.map((ws) => {
                            const name = readName(ws.name)
                            const isPersonal = ws.workspaceType === 'personal'
                            return (
                                <MenuItem key={ws.id} value={ws.id}>
                                    {isPersonal ? (
                                        <PersonRoundedIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                    ) : (
                                        <FolderRoundedIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                                    )}
                                    <ListItemText
                                        primary={name || ws.codename}
                                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                    />
                                    {ws.roleCodename === 'owner' ? (
                                        <Chip
                                            label={t('workspace.roleOwner')}
                                            size='small'
                                            variant='outlined'
                                            sx={{ ml: 0.5, height: 20, fontSize: '0.65rem' }}
                                        />
                                    ) : null}
                                </MenuItem>
                            )
                        })}
                    </Select>
                </Tooltip>

                <Tooltip title={t('workspace.manage')}>
                    <IconButton size='small' onClick={() => setManagerOpen(true)} aria-label={t('workspace.manage')}>
                        <ManageAccountsRoundedIcon fontSize='small' />
                    </IconButton>
                </Tooltip>
            </Stack>

            <WorkspaceManagerDialog open={managerOpen} onClose={() => setManagerOpen(false)} />
        </Fragment>
    )
}
