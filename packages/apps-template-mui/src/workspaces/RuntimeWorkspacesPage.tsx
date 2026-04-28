import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'
import {
    FlowListTable,
    ItemCard,
    PaginationControls,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    type FlowListTableData,
    type TableColumn
} from '@universo/template-mui'
import { FormDialog, type FieldConfig } from '../components/dialogs/FormDialog'
import { ConfirmDeleteDialog } from '../components/dialogs/ConfirmDeleteDialog'
import {
    createRuntimeWorkspace,
    copyRuntimeWorkspace,
    deleteRuntimeWorkspace,
    fetchRuntimeWorkspace,
    fetchRuntimeWorkspaceMembers,
    fetchRuntimeWorkspaces,
    inviteRuntimeWorkspaceMember,
    removeRuntimeWorkspaceMember,
    updateRuntimeWorkspace,
    updateDefaultRuntimeWorkspace,
    type RuntimeWorkspace,
    type RuntimeWorkspaceMember
} from '../api/workspaces'
import { appQueryKeys, workspaceQueryKeys } from '../api/mutations'

interface RuntimeWorkspacesPageProps {
    applicationId: string
    apiBaseUrl: string
    locale: string
    routeWorkspaceId?: string | null
    routeSection?: 'dashboard' | 'access'
}

type WorkspaceViewRow = FlowListTableData &
    RuntimeWorkspace & {
        displayName: string
        rawName: unknown
        rawDescription: unknown
        description: string
    }
type MemberViewRow = FlowListTableData & RuntimeWorkspaceMember & { name: string; description: string }
type ViewMode = 'card' | 'list'
type WorkspaceFormPayload = { name: unknown; description: unknown }

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const readName = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const record = value as Record<string, unknown>
    const locales = record.locales
    if (!locales || typeof locales !== 'object') return ''
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const primary = typeof record._primary === 'string' ? record._primary : normalizedLocale
    const entries = locales as Record<string, { content?: unknown }>
    const candidates = [normalizedLocale, primary, 'en']
    for (const candidate of candidates) {
        const content = entries[candidate]?.content
        if (typeof content === 'string' && content.trim()) return content
    }
    for (const entry of Object.values(entries)) {
        if (typeof entry?.content === 'string' && entry.content.trim()) return entry.content
    }
    return ''
}

const normalizeLocale = (locale: string): 'en' | 'ru' => (locale.split(/[-_]/)[0]?.toLowerCase() === 'ru' ? 'ru' : 'en')

const isLocalizedRecord = (
    value: unknown
): value is {
    _schema?: unknown
    _primary?: unknown
    locales?: Record<string, { content?: unknown }>
} => Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

const ensureLocalizedString = (value: unknown, locale: string) => {
    if (isLocalizedRecord(value) && value._schema === '1') return value
    return createLocalizedContent(normalizeLocale(locale), typeof value === 'string' ? value : readName(value, locale))
}

const appendCopySuffixToLocalizedValue = (value: unknown, fallback: string, locale: string): unknown => {
    const suffixForLocale = (localeCode: string) => (localeCode.toLowerCase().startsWith('ru') ? ' (копия)' : ' (copy)')
    if (!isLocalizedRecord(value) || value._schema !== '1') {
        return createLocalizedContent(normalizeLocale(locale), `${fallback}${appendCopySuffix('', locale)}`)
    }

    const primary = typeof value._primary === 'string' ? value._primary : normalizeLocale(locale)
    let next = value as ReturnType<typeof createLocalizedContent>
    const locales = value.locales ?? {}
    for (const [localeCode, entry] of Object.entries(locales)) {
        const content = typeof entry?.content === 'string' ? entry.content : ''
        next = updateLocalizedContentLocale(next, localeCode as 'en' | 'ru', `${content}${suffixForLocale(localeCode)}`)
    }

    if (Object.keys(locales).length === 0) {
        return createLocalizedContent(normalizeLocale(locale), `${fallback}${appendCopySuffix('', locale)}`)
    }

    return {
        ...next,
        _primary: primary
    }
}

const readInputChangeValue = (value: unknown): string => {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''
    const target = (value as { target?: { value?: unknown } }).target
    return typeof target?.value === 'string' ? target.value : ''
}

const readWorkspaceRoleChangeValue = (value: unknown): 'owner' | 'member' => {
    const role = readInputChangeValue(value)
    return role === 'owner' ? 'owner' : 'member'
}

const appendCopySuffix = (value: string, locale: string): string => `${value} ${locale.startsWith('ru') ? '(копия)' : '(copy)'}`

const toPagination = (limit: number, offset: number, total: number) => {
    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.max(1, Math.ceil(total / limit))
    return {
        currentPage,
        pageSize: limit,
        totalItems: total,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
    }
}

const toPaginationActions = (
    limit: number,
    offset: number,
    setLimit: (limit: number) => void,
    setOffset: (offset: number) => void,
    setSearch: (search: string) => void
) => ({
    goToPage: (page: number) => setOffset((page - 1) * limit),
    nextPage: () => setOffset(offset + limit),
    previousPage: () => setOffset(Math.max(0, offset - limit)),
    setSearch,
    setSort: () => undefined,
    setPageSize: (pageSize: number) => {
        setLimit(pageSize)
        setOffset(0)
    }
})

export function RuntimeWorkspacesPage({
    applicationId,
    apiBaseUrl,
    locale,
    routeWorkspaceId = null,
    routeSection = 'dashboard'
}: RuntimeWorkspacesPageProps) {
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [viewMode, setViewMode] = useState<ViewMode>('card')
    const [memberViewMode, setMemberViewMode] = useState<ViewMode>('card')
    const [workspaceSearch, setWorkspaceSearch] = useState('')
    const [workspaceLimit, setWorkspaceLimit] = useState(20)
    const [workspaceOffset, setWorkspaceOffset] = useState(0)
    const [memberSearch, setMemberSearch] = useState('')
    const [memberLimit, setMemberLimit] = useState(20)
    const [memberOffset, setMemberOffset] = useState(0)
    const [createOpen, setCreateOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<WorkspaceViewRow | null>(null)
    const [copyTarget, setCopyTarget] = useState<WorkspaceViewRow | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<WorkspaceViewRow | null>(null)
    const [workspaceMenuAnchor, setWorkspaceMenuAnchor] = useState<HTMLElement | null>(null)
    const [workspaceMenuTarget, setWorkspaceMenuTarget] = useState<WorkspaceViewRow | null>(null)
    const [inviteOpen, setInviteOpen] = useState(false)
    const [removeTarget, setRemoveTarget] = useState<RuntimeWorkspaceMember | null>(null)
    const [formError, setFormError] = useState<string | null>(null)

    useEffect(() => {
        setMemberOffset(0)
        setMemberSearch('')
    }, [routeWorkspaceId])

    const workspaceParams = useMemo(
        () => ({ limit: workspaceLimit, offset: workspaceOffset, search: workspaceSearch || undefined }),
        [workspaceLimit, workspaceOffset, workspaceSearch]
    )
    const workspacesQuery = useQuery({
        queryKey: workspaceQueryKeys.list(applicationId, workspaceParams),
        queryFn: () => fetchRuntimeWorkspaces({ apiBaseUrl, applicationId, params: workspaceParams })
    })
    const workspaces = useMemo(() => workspacesQuery.data?.items ?? [], [workspacesQuery.data?.items])
    const workspaceDetailQuery = useQuery({
        queryKey: routeWorkspaceId
            ? workspaceQueryKeys.detail(applicationId, routeWorkspaceId)
            : ['runtime-workspace-detail', applicationId, 'none'],
        enabled: Boolean(routeWorkspaceId),
        queryFn: () => fetchRuntimeWorkspace({ apiBaseUrl, applicationId, workspaceId: routeWorkspaceId! })
    })
    const selectedWorkspace = routeWorkspaceId
        ? workspaceDetailQuery.data ?? workspaces.find((item) => item.id === routeWorkspaceId) ?? null
        : null
    const selectedWorkspaceOwner = selectedWorkspace?.roleCodename === 'owner'
    const selectedWorkspaceIsLoading = Boolean(routeWorkspaceId && (workspaceDetailQuery.isLoading || workspacesQuery.isLoading))
    const selectedWorkspaceLoadFailed = Boolean(routeWorkspaceId && (workspaceDetailQuery.isError || workspacesQuery.isError))

    const memberParams = useMemo(
        () => ({ limit: memberLimit, offset: memberOffset, search: memberSearch || undefined }),
        [memberLimit, memberOffset, memberSearch]
    )
    const membersQuery = useQuery({
        queryKey: routeWorkspaceId
            ? workspaceQueryKeys.members(applicationId, routeWorkspaceId, memberParams)
            : ['runtime-workspace-members', applicationId, 'none'],
        enabled: Boolean(routeWorkspaceId),
        queryFn: () =>
            fetchRuntimeWorkspaceMembers({
                apiBaseUrl,
                applicationId,
                workspaceId: routeWorkspaceId!,
                params: memberParams
            })
    })

    const invalidateWorkspaceData = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.all(applicationId) }),
            queryClient.invalidateQueries({ queryKey: appQueryKeys.list(applicationId) }),
            queryClient.invalidateQueries({ queryKey: ['runtime', applicationId] })
        ])
    }

    const translateWorkspaceError = (message: string): string => {
        if (message.includes('User not found')) {
            return t('workspace.errors.userNotFound', 'User not found')
        }
        if (message.includes('User must be an active application member')) {
            return t(
                'workspace.errors.applicationMemberRequired',
                'User must be an active application member before being added to a workspace'
            )
        }
        if (message.includes('Cannot remove the last workspace owner')) {
            return t('workspace.errors.lastOwnerRemovalBlocked', 'Cannot remove the last workspace owner')
        }
        if (message.includes('Only workspace owners can manage members')) {
            return t('workspace.errors.ownerRequired', 'Only workspace owners can manage members')
        }
        if (message.includes('You do not have access to this workspace')) {
            return t('workspace.errors.accessDenied', 'You do not have access to this workspace')
        }
        if (message.includes('User is not a member of this workspace')) {
            return t('workspace.errors.userNotWorkspaceMember', 'User is not a member of this workspace')
        }
        if (message.includes('Workspace member not found')) {
            return t('workspace.errors.memberNotFound', 'Workspace member not found')
        }
        if (message.includes('Workspace not found')) {
            return t('workspace.errors.workspaceNotFound', 'Workspace not found')
        }
        if (message.includes('Workspaces are not enabled for this application')) {
            return t('workspace.errors.workspacesDisabled', 'Workspaces are not enabled for this application')
        }
        if (message.includes('Invalid request body')) {
            return t('workspace.errors.invalidRequestBody', 'Invalid request body')
        }
        if (message.includes('Personal workspace cannot be deleted')) {
            return t('workspace.errors.personalDeleteBlocked', 'Personal workspace cannot be deleted')
        }
        return message
    }

    const createMutation = useMutation({
        mutationFn: (data: WorkspaceFormPayload) => createRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async (result) => {
            setCreateOpen(false)
            setFormError(null)
            await invalidateWorkspaceData()
            window.location.assign(buildWorkspaceHref(applicationId, result.id))
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const updateMutation = useMutation({
        mutationFn: (data: { workspaceId: string; name?: unknown; description?: unknown }) =>
            updateRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async () => {
            setEditTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const copyMutation = useMutation({
        mutationFn: (data: { workspaceId: string } & WorkspaceFormPayload) => copyRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async (result) => {
            setCopyTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
            window.location.assign(buildWorkspaceHref(applicationId, result.id))
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const deleteMutation = useMutation({
        mutationFn: (workspace: WorkspaceViewRow) => deleteRuntimeWorkspace({ apiBaseUrl, applicationId, workspaceId: workspace.id }),
        onSuccess: async () => {
            setDeleteTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const defaultMutation = useMutation({
        mutationFn: (workspaceId: string) => updateDefaultRuntimeWorkspace({ apiBaseUrl, applicationId, workspaceId }),
        onSuccess: invalidateWorkspaceData
    })

    const inviteMutation = useMutation({
        mutationFn: (data: { email: string; roleCodename: 'owner' | 'member' }) =>
            inviteRuntimeWorkspaceMember({
                apiBaseUrl,
                applicationId,
                workspaceId: routeWorkspaceId!,
                email: data.email,
                roleCodename: data.roleCodename
            }),
        onSuccess: async () => {
            setInviteOpen(false)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const removeMutation = useMutation({
        mutationFn: (member: RuntimeWorkspaceMember) =>
            removeRuntimeWorkspaceMember({ apiBaseUrl, applicationId, workspaceId: routeWorkspaceId!, userId: member.userId }),
        onSuccess: async () => {
            setRemoveTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error.message))
    })

    const workspaceRows = useMemo<WorkspaceViewRow[]>(
        () =>
            workspaces.map((workspace) => {
                const displayName = readName(workspace.name, locale) || workspace.id
                const description = readName(workspace.description, locale)
                return {
                    ...workspace,
                    name: displayName,
                    displayName,
                    rawName: workspace.name,
                    rawDescription: workspace.description,
                    description
                }
            }),
        [locale, workspaces]
    )

    const memberRows = useMemo<MemberViewRow[]>(
        () =>
            (membersQuery.data?.items ?? []).map((member) => ({
                ...member,
                id: member.userId,
                name: member.nickname || member.email || member.userId,
                description: member.email || member.userId
            })),
        [membersQuery.data?.items]
    )

    const workspaceColumns = useMemo<TableColumn<WorkspaceViewRow>[]>(
        () => [
            { id: 'name', label: t('workspace.fields.name', 'Name'), render: (row) => row.displayName },
            { id: 'description', label: t('workspace.fields.description', 'Description'), render: (row) => row.description || '-' },
            {
                id: 'type',
                label: t('workspace.fields.type', 'Type'),
                render: (row) => (row.workspaceType === 'personal' ? t('workspace.personal', 'Personal') : t('workspace.shared', 'Shared'))
            },
            {
                id: 'role',
                label: t('workspace.fields.role', 'Role'),
                render: (row) => (
                    <Chip
                        size='small'
                        variant='outlined'
                        label={row.roleCodename === 'owner' ? t('workspace.roleOwner', 'Owner') : t('workspace.roleMember', 'Member')}
                    />
                )
            }
        ],
        [t]
    )

    const memberColumns = useMemo<TableColumn<MemberViewRow>[]>(
        () => [
            { id: 'name', label: t('workspace.fields.member', 'Member'), render: (row) => row.name },
            { id: 'email', label: t('workspace.fields.email', 'Email'), render: (row) => row.email ?? '-' },
            {
                id: 'role',
                label: t('workspace.fields.role', 'Role'),
                render: (row) => (
                    <Chip
                        size='small'
                        variant='outlined'
                        label={row.roleCodename === 'owner' ? t('workspace.roleOwner', 'Owner') : t('workspace.roleMember', 'Member')}
                    />
                )
            }
        ],
        [t]
    )

    const canManageSelectedMembers = Boolean(selectedWorkspaceOwner)
    const renderMemberActions = (member: MemberViewRow) =>
        canManageSelectedMembers && member.canRemove ? (
            <Tooltip title={t('workspace.removeMember', 'Remove member')}>
                <span>
                    <IconButton
                        size='small'
                        onClick={() => {
                            setFormError(null)
                            setRemoveTarget(member)
                        }}
                        aria-label={t('workspace.removeMember', 'Remove member')}
                    >
                        <DeleteRoundedIcon fontSize='small' />
                    </IconButton>
                </span>
            </Tooltip>
        ) : null

    const workspaceName = selectedWorkspace ? readName(selectedWorkspace.name, locale) || selectedWorkspace.id : ''
    const workspaceDescription = selectedWorkspace ? readName(selectedWorkspace.description, locale) : ''

    const workspaceFormFields = useMemo<FieldConfig[]>(
        () => [
            {
                id: 'name',
                label: t('workspace.createName', 'Workspace name'),
                type: 'STRING',
                required: true,
                validationRules: { localized: true, minLength: 1 }
            },
            {
                id: 'description',
                label: t('workspace.createDescription', 'Workspace description'),
                type: 'STRING',
                widget: 'textarea',
                multilineRows: 3,
                validationRules: { localized: true }
            }
        ],
        [t]
    )

    const closeWorkspaceMenu = () => {
        setWorkspaceMenuAnchor(null)
        setWorkspaceMenuTarget(null)
    }

    const openWorkspaceMenu = (event: MouseEvent<HTMLElement>, workspace: WorkspaceViewRow) => {
        event.preventDefault()
        event.stopPropagation()
        setWorkspaceMenuAnchor(event.currentTarget)
        setWorkspaceMenuTarget(workspace)
    }

    const renderWorkspaceActions = (workspace: WorkspaceViewRow) => (
        <IconButton
            size='small'
            aria-label={t('workspace.actions.openMenu', 'Workspace actions')}
            onClick={(event) => openWorkspaceMenu(event, workspace)}
            sx={{ width: 28, height: 28, minWidth: 28, p: 0.25, borderRadius: 1 }}
        >
            <MoreVertRoundedIcon fontSize='small' />
        </IconButton>
    )

    const renderWorkspaceList = () => (
        <>
            <ViewHeader
                title={t('workspace.title', 'Workspaces')}
                search
                searchValue={workspaceSearch}
                searchPlaceholder={t('workspace.searchPlaceholder', 'Search workspaces')}
                onSearchChange={(event) => {
                    setWorkspaceSearch(readInputChangeValue(event))
                    setWorkspaceOffset(0)
                }}
                controlsWrap
            >
                <ToolbarControls
                    viewToggleEnabled
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    cardViewTitle={t('toolbar.cardView', 'Card view')}
                    listViewTitle={t('toolbar.tableView', 'Table view')}
                    primaryAction={{
                        label: t('app.create', 'Create'),
                        startIcon: <AddRoundedIcon />,
                        onClick: () => {
                            setFormError(null)
                            setCreateOpen(true)
                        }
                    }}
                />
            </ViewHeader>

            <Box sx={{ mt: 3 }}>
                {workspacesQuery.isError ? (
                    <Alert severity='error'>{t('workspace.errorLoad', 'Failed to load workspaces')}</Alert>
                ) : workspacesQuery.isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        {workspaceRows.length === 0 ? <Alert severity='info'>{t('workspace.noWorkspaces')}</Alert> : null}
                        {viewMode === 'card' ? (
                            <Box
                                data-testid='runtime-workspaces-card-view'
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 2
                                }}
                            >
                                {workspaceRows.map((workspace) => (
                                    <Box
                                        key={workspace.id}
                                        data-testid='runtime-workspace-card'
                                        data-workspace-id={workspace.id}
                                        sx={{ minWidth: 0 }}
                                    >
                                        <ItemCard
                                            data={workspace}
                                            allowStretch
                                            onClick={() => window.location.assign(buildWorkspaceHref(applicationId, workspace.id))}
                                            headerAction={renderWorkspaceActions(workspace)}
                                            footerStartContent={
                                                <Chip
                                                    size='small'
                                                    variant='outlined'
                                                    label={
                                                        workspace.roleCodename === 'owner'
                                                            ? t('workspace.roleOwner', 'Owner')
                                                            : t('workspace.roleMember', 'Member')
                                                    }
                                                />
                                            }
                                            footerEndContent={
                                                workspace.isDefault ? (
                                                    <Chip
                                                        size='small'
                                                        icon={<StarRoundedIcon />}
                                                        label={t('workspace.default', 'Default')}
                                                    />
                                                ) : (
                                                    <Button
                                                        size='small'
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            defaultMutation.mutate(workspace.id)
                                                        }}
                                                    >
                                                        {t('workspace.setDefault', 'Set default')}
                                                    </Button>
                                                )
                                            }
                                        />
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <FlowListTable
                                data={workspaceRows}
                                customColumns={workspaceColumns}
                                isLoading={workspacesQuery.isFetching}
                                renderActions={(row) => (
                                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                                        {row.isDefault ? (
                                            <Chip size='small' icon={<StarRoundedIcon />} label={t('workspace.default', 'Default')} />
                                        ) : (
                                            <Button size='small' onClick={() => defaultMutation.mutate(row.id)}>
                                                {t('workspace.setDefault', 'Set default')}
                                            </Button>
                                        )}
                                        {renderWorkspaceActions(row)}
                                    </Stack>
                                )}
                            />
                        )}

                        <PaginationControls
                            namespace='apps'
                            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                            pagination={toPagination(workspaceLimit, workspaceOffset, workspacesQuery.data?.total ?? 0)}
                            actions={toPaginationActions(
                                workspaceLimit,
                                workspaceOffset,
                                setWorkspaceLimit,
                                setWorkspaceOffset,
                                setWorkspaceSearch
                            )}
                            isLoading={workspacesQuery.isFetching}
                        />
                    </Stack>
                )}
            </Box>
        </>
    )

    const renderWorkspaceDashboard = () => (
        <>
            <ViewHeader
                title={workspaceName || t('workspace.dashboard', 'Dashboard')}
                description={workspaceDescription || t('workspace.dashboardDescription', 'Workspace overview and current access state.')}
            />
            {selectedWorkspace ? (
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: 2
                    }}
                >
                    <WorkspaceMetricCard
                        title={t('workspace.fields.type', 'Type')}
                        value={
                            selectedWorkspace.workspaceType === 'personal'
                                ? t('workspace.personal', 'Personal')
                                : t('workspace.shared', 'Shared')
                        }
                    />
                    <WorkspaceMetricCard
                        title={t('workspace.fields.role', 'Role')}
                        value={
                            selectedWorkspace.roleCodename === 'owner'
                                ? t('workspace.roleOwner', 'Owner')
                                : t('workspace.roleMember', 'Member')
                        }
                    />
                    <WorkspaceMetricCard
                        title={t('workspace.members', 'Members')}
                        value={membersQuery.isFetching ? t('cards.loading', 'Loading...') : String(membersQuery.data?.total ?? 0)}
                    />
                </Box>
            ) : selectedWorkspaceIsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : selectedWorkspaceLoadFailed ? (
                <Alert severity='error'>{t('workspace.errorLoad', 'Failed to load workspaces')}</Alert>
            ) : (
                <Alert severity='warning'>{t('workspace.notFound', 'Workspace not found')}</Alert>
            )}
        </>
    )

    const renderWorkspaceAccess = () => (
        <>
            <ViewHeader
                title={workspaceName ? `${workspaceName}: ${t('workspace.access', 'Access')}` : t('workspace.access', 'Access')}
                description={t('workspace.accessDescription', 'Workspace members and roles.')}
                search
                searchValue={memberSearch}
                searchPlaceholder={t('workspace.memberSearchPlaceholder', 'Search members')}
                onSearchChange={(event) => {
                    setMemberSearch(readInputChangeValue(event))
                    setMemberOffset(0)
                }}
                controlsWrap
            >
                <ToolbarControls
                    viewToggleEnabled
                    viewMode={memberViewMode}
                    onViewModeChange={setMemberViewMode}
                    cardViewTitle={t('workspace.memberCardView', 'Member card view')}
                    listViewTitle={t('workspace.memberListView', 'Member list view')}
                    primaryAction={{
                        label: t('workspace.addMember', 'Add'),
                        startIcon: <GroupAddRoundedIcon />,
                        disabled: !selectedWorkspace || !selectedWorkspaceOwner,
                        onClick: () => {
                            setFormError(null)
                            setInviteOpen(true)
                        }
                    }}
                />
            </ViewHeader>

            {!selectedWorkspace && !selectedWorkspaceIsLoading && selectedWorkspaceLoadFailed ? (
                <Alert severity='error'>{t('workspace.errorLoad', 'Failed to load workspaces')}</Alert>
            ) : !selectedWorkspace && !selectedWorkspaceIsLoading ? (
                <Alert severity='warning'>{t('workspace.notFound', 'Workspace not found')}</Alert>
            ) : membersQuery.isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Stack spacing={2}>
                    {memberRows.length === 0 && !membersQuery.isFetching ? (
                        <Alert severity='info'>{t('workspace.noMembers', 'No members yet')}</Alert>
                    ) : memberViewMode === 'card' ? (
                        <Box
                            data-testid='runtime-workspace-members-card-view'
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'repeat(2, minmax(0, 1fr))',
                                    lg: 'repeat(3, minmax(0, 1fr))'
                                },
                                gap: 2
                            }}
                        >
                            {memberRows.map((member) => (
                                <Box key={member.id} sx={{ minWidth: 0 }}>
                                    <ItemCard
                                        data={member}
                                        allowStretch
                                        footerStartContent={
                                            <Chip
                                                size='small'
                                                variant='outlined'
                                                label={
                                                    member.roleCodename === 'owner'
                                                        ? t('workspace.roleOwner', 'Owner')
                                                        : t('workspace.roleMember', 'Member')
                                                }
                                            />
                                        }
                                        footerEndContent={renderMemberActions(member)}
                                    />
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <FlowListTable
                            data={memberRows}
                            customColumns={memberColumns}
                            isLoading={membersQuery.isFetching}
                            renderActions={renderMemberActions}
                        />
                    )}

                    <PaginationControls
                        namespace='apps'
                        rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                        pagination={toPagination(memberLimit, memberOffset, membersQuery.data?.total ?? 0)}
                        actions={toPaginationActions(memberLimit, memberOffset, setMemberLimit, setMemberOffset, setMemberSearch)}
                        isLoading={membersQuery.isFetching}
                    />
                </Stack>
            )}
        </>
    )

    return (
        <Box data-testid='runtime-workspaces-page' sx={{ width: '100%', minWidth: 0 }}>
            {routeWorkspaceId ? (routeSection === 'access' ? renderWorkspaceAccess() : renderWorkspaceDashboard()) : renderWorkspaceList()}

            <Menu
                open={Boolean(workspaceMenuAnchor)}
                anchorEl={workspaceMenuAnchor}
                onClose={closeWorkspaceMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        if (workspaceMenuTarget) {
                            window.location.assign(buildWorkspaceHref(applicationId, workspaceMenuTarget.id))
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <OpenInNewRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.open', 'Open')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (workspaceMenuTarget) {
                            setFormError(null)
                            setEditTarget(workspaceMenuTarget)
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <EditRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.actions.edit', 'Edit')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (workspaceMenuTarget) {
                            setFormError(null)
                            setCopyTarget(workspaceMenuTarget)
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <ContentCopyRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.actions.copy', 'Copy')}
                </MenuItem>
                <Divider />
                <MenuItem
                    disabled={workspaceMenuTarget?.workspaceType === 'personal'}
                    onClick={() => {
                        if (workspaceMenuTarget) {
                            setFormError(null)
                            setDeleteTarget(workspaceMenuTarget)
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <DeleteRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.actions.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <FormDialog
                open={createOpen}
                title={t('workspace.createTitle', 'Create workspace')}
                fields={workspaceFormFields}
                locale={locale}
                error={formError}
                isSubmitting={createMutation.isPending}
                saveButtonText={t('app.create', 'Create')}
                savingButtonText={t('workspace.creating', 'Creating...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                onClose={() => {
                    setFormError(null)
                    setCreateOpen(false)
                }}
                onSubmit={async (data) => {
                    await createMutation.mutateAsync({
                        name: ensureLocalizedString(data.name, locale),
                        description: ensureLocalizedString(data.description, locale)
                    })
                }}
            />

            <FormDialog
                open={Boolean(editTarget)}
                title={t('workspace.editTitle', 'Edit workspace')}
                fields={workspaceFormFields}
                initialData={editTarget ? { name: editTarget.rawName, description: editTarget.rawDescription } : undefined}
                locale={locale}
                error={editTarget ? formError : null}
                isSubmitting={updateMutation.isPending}
                saveButtonText={t('app.save', 'Save')}
                savingButtonText={t('app.saving', 'Saving...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                onClose={() => {
                    setFormError(null)
                    setEditTarget(null)
                }}
                onSubmit={async (data) => {
                    if (!editTarget) return
                    const payload: { workspaceId: string; name?: unknown; description?: unknown } = {
                        workspaceId: editTarget.id,
                        name: ensureLocalizedString(data.name, locale),
                        description: ensureLocalizedString(data.description, locale)
                    }
                    await updateMutation.mutateAsync(payload)
                }}
            />

            <FormDialog
                open={Boolean(copyTarget)}
                title={t('workspace.copyTitle', 'Copy workspace')}
                fields={workspaceFormFields}
                initialData={
                    copyTarget
                        ? {
                              name: appendCopySuffixToLocalizedValue(copyTarget.rawName, copyTarget.displayName, locale),
                              description: copyTarget.rawDescription
                          }
                        : undefined
                }
                locale={locale}
                error={copyTarget ? formError : null}
                isSubmitting={copyMutation.isPending}
                saveButtonText={t('workspace.actions.copy', 'Copy')}
                savingButtonText={t('workspace.copying', 'Copying...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                onClose={() => {
                    setFormError(null)
                    setCopyTarget(null)
                }}
                onSubmit={async (data) => {
                    if (!copyTarget) return
                    await copyMutation.mutateAsync({
                        workspaceId: copyTarget.id,
                        name: ensureLocalizedString(data.name, locale),
                        description: ensureLocalizedString(data.description, locale)
                    })
                }}
            />

            <InviteMemberDialog
                open={inviteOpen}
                error={formError}
                isSubmitting={inviteMutation.isPending}
                onClose={() => setInviteOpen(false)}
                onSubmit={(data) => inviteMutation.mutateAsync(data)}
            />

            <ConfirmDeleteDialog
                open={Boolean(deleteTarget)}
                title={t('workspace.deleteTitle', 'Delete workspace')}
                description={t('workspace.deleteConfirm', 'Delete this workspace and its data?')}
                confirmButtonText={t('workspace.actions.delete', 'Delete')}
                deletingButtonText={t('workspace.deleting', 'Deleting...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                error={deleteTarget ? formError ?? undefined : undefined}
                loading={deleteMutation.isPending}
                onCancel={() => {
                    setFormError(null)
                    setDeleteTarget(null)
                }}
                onConfirm={() => (deleteTarget ? deleteMutation.mutateAsync(deleteTarget) : undefined)}
            />

            <ConfirmDeleteDialog
                open={Boolean(removeTarget)}
                title={t('workspace.removeMemberTitle', 'Remove member')}
                description={t('workspace.removeMemberConfirm', 'Remove this member from the workspace?')}
                confirmButtonText={t('workspace.removeMember', 'Remove member')}
                deletingButtonText={t('workspace.removing', 'Removing...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                error={removeTarget ? formError ?? undefined : undefined}
                loading={removeMutation.isPending}
                onCancel={() => {
                    setFormError(null)
                    setRemoveTarget(null)
                }}
                onConfirm={() => (removeTarget ? removeMutation.mutateAsync(removeTarget) : undefined)}
            />
        </Box>
    )
}

function WorkspaceMetricCard({ title, value }: { title: string; value: string }) {
    return (
        <Box
            sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                minHeight: 112,
                bgcolor: 'background.paper'
            }}
        >
            <Typography variant='body2' color='text.secondary'>
                {title}
            </Typography>
            <Typography variant='h5' sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                {value}
            </Typography>
        </Box>
    )
}

function InviteMemberDialog({
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
    const [roleCodename, setRoleCodename] = useState<'owner' | 'member'>('member')

    useEffect(() => {
        if (open) {
            return
        }
        setEmail('')
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
                        onChange={(event) => setEmail(readInputChangeValue(event))}
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
                        void onSubmit({ email: email.trim(), roleCodename }).catch(() => undefined)
                    }}
                    disabled={isSubmitting || email.trim().length === 0}
                >
                    {isSubmitting ? t('app.saving', 'Saving...') : t('workspace.addMember', 'Add')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

const buildWorkspaceHref = (applicationId: string, workspaceId: string): string =>
    `/a/${encodeURIComponent(applicationId)}/workspaces/${encodeURIComponent(workspaceId)}`

export default RuntimeWorkspacesPage
