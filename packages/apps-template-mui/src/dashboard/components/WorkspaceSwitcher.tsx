import { useEffect, useState } from 'react'
import Select, { selectClasses, type SelectChangeEvent } from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListSubheader from '@mui/material/ListSubheader'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import { styled } from '@mui/material/styles'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { fetchRuntimeWorkspaces, updateDefaultRuntimeWorkspace, type RuntimeWorkspace } from '../../api/workspaces'
import { appQueryKeys, workspaceQueryKeys } from '../../api/mutations'

const readName = (name: unknown, locale: string): string => {
    if (typeof name === 'string') return name
    if (!name || typeof name !== 'object') return ''
    const locales = (name as Record<string, unknown>).locales
    if (!locales || typeof locales !== 'object') return ''
    const primary = (name as Record<string, unknown>)._primary
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const localizedContent = (locales as Record<string, Record<string, unknown>>)[normalizedLocale]?.content
    if (typeof localizedContent === 'string') return localizedContent
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

const readSelectValue = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const target = (value as { target?: { value?: unknown } }).target
    return typeof target?.value === 'string' ? target.value : ''
}

const MANAGE_WORKSPACES_VALUE = '__manage_workspaces__'

const WorkspaceAvatar = styled(Avatar)(({ theme }) => ({
    width: 28,
    height: 28,
    backgroundColor: (theme.vars || theme).palette.background.paper,
    color: (theme.vars || theme).palette.text.secondary,
    border: `1px solid ${(theme.vars || theme).palette.divider}`
}))

const WorkspaceListItemAvatar = styled(ListItemAvatar)({
    minWidth: 0,
    marginRight: 12
})

interface WorkspaceSwitcherProps {
    variant?: 'inline' | 'sidebar'
}

export default function WorkspaceSwitcher({ variant = 'inline' }: WorkspaceSwitcherProps) {
    const { t, i18n } = useTranslation('apps')
    const details = useDashboardDetails()
    const queryClient = useQueryClient()
    const applicationId = details?.applicationId
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'
    const detailsWorkspaceId = details?.currentWorkspaceId ?? ''
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(detailsWorkspaceId)
    const currentWorkspaceId = selectedWorkspaceId || detailsWorkspaceId
    const workspacesEnabled = details?.workspacesEnabled ?? false

    const [open, setOpen] = useState(false)

    useEffect(() => {
        setSelectedWorkspaceId(detailsWorkspaceId)
    }, [detailsWorkspaceId])

    const { data, isLoading } = useQuery({
        queryKey: applicationId ? workspaceQueryKeys.list(applicationId, { limit: 100, offset: 0 }) : ['runtime-workspaces', 'missing'],
        enabled: Boolean(applicationId && workspacesEnabled),
        queryFn: () => fetchRuntimeWorkspaces({ apiBaseUrl, applicationId: applicationId!, params: { limit: 100, offset: 0 } })
    })
    const workspaces: RuntimeWorkspace[] = data?.items ?? []

    const switchMutation = useMutation({
        mutationFn: (workspaceId: string) => updateDefaultRuntimeWorkspace({ apiBaseUrl, applicationId: applicationId!, workspaceId }),
        onSuccess: async (_data, workspaceId) => {
            if (!applicationId) return
            setSelectedWorkspaceId(workspaceId)
            const invalidations = [
                queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all(applicationId) }),
                queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) }),
                queryClient.invalidateQueries({ queryKey: ['runtime', applicationId] })
            ]
            if (details?.runtimeQueryKeyPrefix) {
                invalidations.push(queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix }))
                invalidations.push(queryClient.refetchQueries({ queryKey: details.runtimeQueryKeyPrefix, type: 'active' }))
            }
            await Promise.all(invalidations)
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
    const locale = i18n.language || 'en'
    const currentName = currentWorkspace ? readName(currentWorkspace.name, locale) || currentWorkspace.id : ''
    const currentIsPersonal = currentWorkspace?.workspaceType === 'personal'
    const currentTypeLabel = currentIsPersonal ? t('workspace.personal', 'Personal') : t('workspace.shared', 'Shared')
    const currentRoleLabel =
        currentWorkspace?.roleCodename === 'owner' ? t('workspace.roleOwner', 'Owner') : t('workspace.roleMember', 'Member')

    const handleChange = (event: SelectChangeEvent) => {
        const value = readSelectValue(event)
        if (value === MANAGE_WORKSPACES_VALUE) {
            setOpen(false)
            window.location.assign(`/a/${applicationId}/workspaces`)
            return
        }
        if (value && value !== currentWorkspaceId) {
            switchMutation.mutate(value)
        }
        setOpen(false)
    }

    const switcher = (
        <Select
            data-testid='runtime-workspace-switcher'
            value={currentWorkspace.id}
            open={open}
            onOpen={() => setOpen(true)}
            onClose={() => setOpen(false)}
            onChange={handleChange}
            displayEmpty
            fullWidth={variant === 'sidebar'}
            disabled={switchMutation.isPending || isLoading}
            inputProps={{ 'aria-label': t('workspace.switch', 'Switch workspace') }}
            title={t('workspace.switch', 'Switch workspace')}
            renderValue={() => (
                <Stack direction='row' alignItems='center' sx={{ minWidth: 0, width: '100%' }}>
                    <WorkspaceListItemAvatar>
                        <WorkspaceAvatar alt={currentName}>
                            {currentIsPersonal ? (
                                <PersonRoundedIcon sx={{ fontSize: '1rem' }} />
                            ) : (
                                <FolderRoundedIcon sx={{ fontSize: '1rem' }} />
                            )}
                        </WorkspaceAvatar>
                    </WorkspaceListItemAvatar>
                    <ListItemText
                        primary={currentName}
                        secondary={currentRoleLabel ? `${currentTypeLabel} · ${currentRoleLabel}` : currentTypeLabel}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true, fontWeight: 600 }}
                        secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                        sx={{ minWidth: 0, my: 0 }}
                    />
                    {switchMutation.isPending ? <CircularProgress size={16} sx={{ ml: 1 }} /> : null}
                </Stack>
            )}
            sx={{
                maxHeight: 56,
                width: variant === 'sidebar' ? '100%' : 215,
                '&.MuiList-root': {
                    p: '8px'
                },
                [`& .${selectClasses.select}`]: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    pl: 1
                }
            }}
        >
            <ListSubheader sx={{ pt: 0 }}>{t('workspace.title', 'Workspaces')}</ListSubheader>
            {workspaces.map((ws) => {
                const name = readName(ws.name, locale) || ws.id
                const isPersonal = ws.workspaceType === 'personal'
                const typeLabel = isPersonal ? t('workspace.personal', 'Personal') : t('workspace.shared', 'Shared')
                const roleLabel = ws.roleCodename === 'owner' ? t('workspace.roleOwner', 'Owner') : t('workspace.roleMember', 'Member')
                return (
                    <MenuItem key={ws.id} value={ws.id}>
                        <WorkspaceListItemAvatar>
                            <WorkspaceAvatar alt={name}>
                                {isPersonal ? (
                                    <PersonRoundedIcon sx={{ fontSize: '1rem' }} />
                                ) : (
                                    <FolderRoundedIcon sx={{ fontSize: '1rem' }} />
                                )}
                            </WorkspaceAvatar>
                        </WorkspaceListItemAvatar>
                        <ListItemText
                            primary={name}
                            secondary={`${typeLabel} · ${roleLabel}`}
                            primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                            secondaryTypographyProps={{ variant: 'caption', noWrap: true }}
                        />
                    </MenuItem>
                )
            })}
            <Divider sx={{ mx: -1 }} />
            <MenuItem value={MANAGE_WORKSPACES_VALUE}>
                <ListItemIcon>
                    <ManageAccountsRoundedIcon />
                </ListItemIcon>
                <ListItemText primary={t('workspace.manage', 'Manage workspaces')} secondary={t('workspace.title', 'Workspaces')} />
            </MenuItem>
        </Select>
    )

    if (variant !== 'sidebar') {
        return switcher
    }

    return <Box sx={{ width: '100%' }}>{switcher}</Box>
}
