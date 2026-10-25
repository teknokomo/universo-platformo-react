import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Chip, CircularProgress, Divider, IconButton, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import FolderSharedRoundedIcon from '@mui/icons-material/FolderSharedRounded'
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import {
    FlowListTable,
    ItemCard,
    PaginationControls,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    type TableColumn
} from '../components/runtime-ui'
import { FormDialog, type FieldConfig } from '../components/dialogs/FormDialog'
import { ConfirmDeleteDialog } from '../components/dialogs/ConfirmDeleteDialog'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'
import {
    createRuntimeWorkspace,
    copyRuntimeWorkspace,
    deleteRuntimeWorkspace,
    convertRuntimeWorkspaceToShared,
    fetchRuntimeWorkspace,
    fetchRuntimeWorkspaceMembers,
    fetchRuntimeWorkspaces,
    inviteRuntimeWorkspaceMember,
    removeRuntimeWorkspaceMember,
    resetRuntimeWorkspaceSeededContent,
    updateRuntimeWorkspace,
    updateDefaultRuntimeWorkspace,
    RuntimeWorkspaceApiError,
    type RuntimeWorkspaceMember
} from '../api/workspaces'
import { appQueryKeys, workspaceQueryKeys } from '../api/mutations'
import { RuntimeWorkspaceSettingsPanel } from './RuntimeWorkspaceSettingsPanel'
import { RuntimeWorkspaceList } from './RuntimeWorkspaceList'
import { ConvertToSharedDialog, InviteMemberDialog, WorkspaceMetricCard } from './RuntimeWorkspaceDialogs'
import {
    PAGE_SIZE_OPTIONS,
    appendCopySuffixToLocalizedValue,
    ensureLocalizedString,
    readInputChangeValue,
    readName,
    resolveWorkspaceRoleLabel,
    toPagination,
    toPaginationActions
} from './runtimeWorkspaceHelpers'
import type { MemberViewRow, WorkspaceFormPayload, WorkspaceViewMode, WorkspaceViewRow } from './runtimeWorkspaceTypes'

interface RuntimeWorkspacesPageProps {
    applicationId: string
    apiBaseUrl: string
    locale: string
    routeWorkspaceId?: string | null
    routeSection?: 'dashboard' | 'access' | 'settings'
    /** Authenticated viewer id; gates the owner-only `Make shared` action against invited co-owners. */
    currentUserId?: string | null
    onNavigate?: (href: string) => void
}

type WorkspaceErrorTranslation = { key: string; fallback: string }

const WORKSPACE_ERROR_TRANSLATIONS: Record<string, WorkspaceErrorTranslation> = {
    USER_NOT_FOUND: { key: 'workspace.errors.userNotFound', fallback: 'User not found' },
    APPLICATION_MEMBER_REQUIRED: {
        key: 'workspace.errors.applicationMemberRequired',
        fallback: 'User must be an active application member before being added to a workspace'
    },
    LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED: {
        key: 'workspace.errors.lastOwnerRemovalBlocked',
        fallback: 'Cannot remove the last workspace owner'
    },
    WORKSPACE_OWNER_REQUIRED: { key: 'workspace.errors.ownerRequired', fallback: 'Only workspace owners can manage members' },
    WORKSPACE_ACCESS_DENIED: { key: 'workspace.errors.accessDenied', fallback: 'You do not have access to this workspace' },
    USER_NOT_MEMBER: { key: 'workspace.errors.userNotWorkspaceMember', fallback: 'User is not a member of this workspace' },
    WORKSPACE_MEMBER_NOT_FOUND: { key: 'workspace.errors.memberNotFound', fallback: 'Workspace member not found' },
    WORKSPACE_NOT_FOUND: { key: 'workspace.errors.workspaceNotFound', fallback: 'Workspace not found' },
    WORKSPACES_DISABLED: { key: 'workspace.errors.workspacesDisabled', fallback: 'Workspaces are not enabled for this application' },
    INVALID_REQUEST_BODY: { key: 'workspace.errors.invalidRequestBody', fallback: 'Invalid request body' },
    INVALID_ROUTE_PARAMETERS: { key: 'workspace.errors.invalidRequestBody', fallback: 'Invalid request body' },
    WORKSPACE_ROLE_NOT_FOUND: { key: 'workspace.errors.roleNotFound', fallback: 'Workspace role not found' },
    WORKSPACE_SETTING_NOT_ALLOWED: { key: 'workspace.errors.settingNotAllowed', fallback: 'This workspace setting is locked' },
    WORKSPACE_SETTING_VERSION_CONFLICT: {
        key: 'workspace.errors.settingVersionConflict',
        fallback: 'This workspace setting changed. Reload and try again.'
    },
    WORKSPACE_SEED_RESET_FAILED: {
        key: 'workspace.errors.seedResetFailed',
        fallback: 'Seeded workspace content could not be reset.'
    },
    WORKSPACE_COPY_REFERENCE_UNRESOLVED: {
        key: 'workspace.errors.copyReferenceUnresolved',
        fallback: 'Workspace copy contains a required reference that could not be copied.'
    },
    WORKSPACE_COPY_ACCESS_LINK_INTAKE_INVALID: {
        key: 'workspace.errors.copyAccessLinkIntakeInvalid',
        fallback: 'This workspace has invalid guest intake settings and could not be copied.'
    },
    WORKSPACE_COPY_TEMPLATE_MATERIALS_EXCLUDED: {
        key: 'workspace.errors.copyTemplateMaterialsExcluded',
        fallback: 'Some materials are linked to templates that are not included in the copy, so the workspace cannot be copied.'
    },
    PERSONAL_WORKSPACE_MUTATION_BLOCKED: {
        key: 'workspace.errors.personalMutationBlocked',
        fallback: 'Personal workspace cannot be changed'
    },
    WORKSPACE_CONVERSION_BLOCKED: {
        key: 'workspace.errors.conversionBlocked',
        fallback: 'Only the personal workspace owner can convert it to shared'
    }
}

const LEGACY_WORKSPACE_ERROR_TRANSLATIONS: Array<[string, WorkspaceErrorTranslation]> = [
    ['User not found', WORKSPACE_ERROR_TRANSLATIONS.USER_NOT_FOUND],
    ['User must be an active application member', WORKSPACE_ERROR_TRANSLATIONS.APPLICATION_MEMBER_REQUIRED],
    ['Cannot remove the last workspace owner', WORKSPACE_ERROR_TRANSLATIONS.LAST_WORKSPACE_OWNER_REMOVAL_BLOCKED],
    ['Only workspace owners can manage members', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACE_OWNER_REQUIRED],
    ['You do not have access to this workspace', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACE_ACCESS_DENIED],
    ['User is not a member of this workspace', WORKSPACE_ERROR_TRANSLATIONS.USER_NOT_MEMBER],
    ['Workspace member not found', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACE_MEMBER_NOT_FOUND],
    ['Workspace not found', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACE_NOT_FOUND],
    ['Workspaces are not enabled for this application', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACES_DISABLED],
    ['Invalid request body', WORKSPACE_ERROR_TRANSLATIONS.INVALID_REQUEST_BODY],
    ['Workspace copy contains a required reference', WORKSPACE_ERROR_TRANSLATIONS.WORKSPACE_COPY_REFERENCE_UNRESOLVED],
    ['Personal workspace cannot be deleted', WORKSPACE_ERROR_TRANSLATIONS.PERSONAL_WORKSPACE_MUTATION_BLOCKED]
]

export function RuntimeWorkspacesPage({
    applicationId,
    apiBaseUrl,
    locale,
    routeWorkspaceId = null,
    routeSection = 'dashboard',
    currentUserId = null,
    onNavigate
}: RuntimeWorkspacesPageProps) {
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [viewMode, setViewMode] = useState<WorkspaceViewMode>('card')
    const [memberViewMode, setMemberViewMode] = useState<WorkspaceViewMode>('card')
    const [workspaceSearch, setWorkspaceSearch] = useState('')
    const [workspaceLimit, setWorkspaceLimit] = useState(20)
    const [workspaceOffset, setWorkspaceOffset] = useState(0)
    const [memberSearch, setMemberSearch] = useState('')
    const [memberLimit, setMemberLimit] = useState(20)
    const [memberOffset, setMemberOffset] = useState(0)
    const [createOpen, setCreateOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<WorkspaceViewRow | null>(null)
    const [copyTarget, setCopyTarget] = useState<WorkspaceViewRow | null>(null)
    const [convertTarget, setConvertTarget] = useState<WorkspaceViewRow | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<WorkspaceViewRow | null>(null)
    const [workspaceMenuAnchor, setWorkspaceMenuAnchor] = useState<HTMLElement | null>(null)
    const [workspaceMenuTarget, setWorkspaceMenuTarget] = useState<WorkspaceViewRow | null>(null)
    const [inviteOpen, setInviteOpen] = useState(false)
    const [removeTarget, setRemoveTarget] = useState<RuntimeWorkspaceMember | null>(null)
    const [resetSeededContentOpen, setResetSeededContentOpen] = useState(false)
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
    const canCreateSharedWorkspace = workspacesQuery.data?.permissions?.canCreateSharedWorkspace === true
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
        enabled: Boolean(routeWorkspaceId) && (routeSection === 'access' || routeSection === 'dashboard'),
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
    const navigateTo = (href: string) => {
        if (onNavigate) {
            onNavigate(href)
            return
        }
        window.history.pushState(null, '', href)
    }

    const untitledWorkspaceLabel = t('workspace.untitled', 'Untitled workspace')
    const untitledMemberLabel = t('workspace.untitledMember', 'Workspace member')

    const translateWorkspaceError = (error: unknown): string => {
        const message = error instanceof Error ? error.message : String(error)
        const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : ''
        const codedTranslation = WORKSPACE_ERROR_TRANSLATIONS[code]
        if (codedTranslation) {
            return t(codedTranslation.key, codedTranslation.fallback)
        }
        for (const [needle, translation] of LEGACY_WORKSPACE_ERROR_TRANSLATIONS) {
            if (message.includes(needle)) {
                return t(translation.key, translation.fallback)
            }
        }
        return extractRuntimeErrorMessage(error, t('app.errorGenericMessage', 'Please try again or reload the page.'), locale)
    }

    const createMutation = useMutation({
        mutationFn: (data: WorkspaceFormPayload) => createRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async (result) => {
            setCreateOpen(false)
            setFormError(null)
            await invalidateWorkspaceData()
            navigateTo(buildWorkspaceHref(applicationId, result.id))
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const updateMutation = useMutation({
        mutationFn: (data: { workspaceId: string; name?: unknown; description?: unknown }) =>
            updateRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async () => {
            setEditTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const copyMutation = useMutation({
        mutationFn: (data: { workspaceId: string } & WorkspaceFormPayload) => copyRuntimeWorkspace({ apiBaseUrl, applicationId, ...data }),
        onSuccess: async (result) => {
            setCopyTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
            navigateTo(buildWorkspaceHref(applicationId, result.id))
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const deleteMutation = useMutation({
        mutationFn: (workspace: WorkspaceViewRow) => deleteRuntimeWorkspace({ apiBaseUrl, applicationId, workspaceId: workspace.id }),
        onSuccess: async () => {
            setDeleteTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const convertMutation = useMutation({
        mutationFn: (workspace: WorkspaceViewRow) =>
            convertRuntimeWorkspaceToShared({ apiBaseUrl, applicationId, workspaceId: workspace.id }),
        onSuccess: async () => {
            setConvertTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => {
            // The conversion-specific gate lives behind WORKSPACE_OWNER_REQUIRED; the
            // generic member-management copy would be misleading here.
            const code = error instanceof RuntimeWorkspaceApiError ? error.code : (error as { code?: string }).code
            if (code === 'WORKSPACE_OWNER_REQUIRED') {
                setFormError(t('workspace.errors.conversionOwnerRequired', 'Only the personal workspace owner can convert it to shared.'))
                return
            }
            setFormError(translateWorkspaceError(error))
        }
    })

    const defaultMutation = useMutation({
        mutationFn: (workspaceId: string) => updateDefaultRuntimeWorkspace({ apiBaseUrl, applicationId, workspaceId }),
        onSuccess: invalidateWorkspaceData
    })

    const resetSeededContentMutation = useMutation({
        mutationFn: () =>
            resetRuntimeWorkspaceSeededContent({
                apiBaseUrl,
                applicationId,
                workspaceId: routeWorkspaceId!
            }),
        onSuccess: async () => {
            setResetSeededContentOpen(false)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
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
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const removeMutation = useMutation({
        mutationFn: (member: RuntimeWorkspaceMember) =>
            removeRuntimeWorkspaceMember({ apiBaseUrl, applicationId, workspaceId: routeWorkspaceId!, userId: member.userId }),
        onSuccess: async () => {
            setRemoveTarget(null)
            setFormError(null)
            await invalidateWorkspaceData()
        },
        onError: (error: Error) => setFormError(translateWorkspaceError(error))
    })

    const workspaceRows = useMemo<WorkspaceViewRow[]>(
        () =>
            workspaces.map((workspace) => {
                const displayName = readName(workspace.name, locale) || untitledWorkspaceLabel
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
        [locale, untitledWorkspaceLabel, workspaces]
    )

    const memberRows = useMemo<MemberViewRow[]>(
        () =>
            (membersQuery.data?.items ?? []).map((member) => ({
                ...member,
                id: member.userId,
                name: member.nickname || member.email || untitledMemberLabel,
                description: member.email || ''
            })),
        [membersQuery.data?.items, untitledMemberLabel]
    )

    const workspaceColumns = useMemo<TableColumn<WorkspaceViewRow>[]>(
        () => [
            {
                id: 'name',
                label: t('workspace.fields.name', 'Name'),
                render: (row) => (
                    <Stack direction='row' spacing={0.75} sx={{ minWidth: 0, alignItems: 'center' }}>
                        <Typography component='span' noWrap>
                            {row.displayName}
                        </Typography>
                        {row.isDefault ? (
                            <Tooltip title={t('workspace.default', 'Default')}>
                                <StarRoundedIcon
                                    fontSize='small'
                                    color='primary'
                                    aria-label={t('workspace.default', 'Default')}
                                    sx={{ flexShrink: 0 }}
                                />
                            </Tooltip>
                        ) : null}
                    </Stack>
                )
            },
            { id: 'description', label: t('workspace.fields.description', 'Description'), render: (row) => row.description || '-' },
            {
                id: 'type',
                label: t('workspace.fields.type', 'Type'),
                render: (row) => (row.workspaceType === 'personal' ? t('workspace.personal', 'Personal') : t('workspace.shared', 'Shared'))
            },
            {
                id: 'role',
                label: t('workspace.fields.role', 'Role'),
                render: (row) => <Chip size='small' variant='outlined' label={resolveWorkspaceRoleLabel(row.roleCodename, t)} />
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
                render: (row) => <Chip size='small' variant='outlined' label={resolveWorkspaceRoleLabel(row.roleCodename, t)} />
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

    const workspaceName = selectedWorkspace ? readName(selectedWorkspace.name, locale) || untitledWorkspaceLabel : ''
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

    const canManageWorkspace = workspaceMenuTarget?.roleCodename === 'owner'
    const canDeleteWorkspace = canManageWorkspace && workspaceMenuTarget?.workspaceType === 'shared'
    // Conversion is a caller-owned `personal` → `shared` flip (server verifies
    // `personal_user_id = current_user`). The action stays disabled until the
    // viewer identity is known — callers that cannot resolve it (standalone
    // dashboards) never show an enabled conversion affordance — and for an
    // invited co-owner it stays disabled instead of hitting the typed 403.
    const canConvertWorkspace =
        canManageWorkspace &&
        workspaceMenuTarget?.workspaceType === 'personal' &&
        currentUserId != null &&
        (workspaceMenuTarget?.personalUserId == null || workspaceMenuTarget?.personalUserId === currentUserId)

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
                        value={resolveWorkspaceRoleLabel(selectedWorkspace.roleCodename, t)}
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
                                                label={resolveWorkspaceRoleLabel(member.roleCodename, t)}
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
            {routeWorkspaceId ? (
                routeSection === 'access' ? (
                    renderWorkspaceAccess()
                ) : routeSection === 'settings' ? (
                    <RuntimeWorkspaceSettingsPanel
                        applicationId={applicationId}
                        apiBaseUrl={apiBaseUrl}
                        workspaceId={routeWorkspaceId}
                        workspaceName={workspaceName}
                        workspaceExists={Boolean(selectedWorkspace)}
                        workspaceIsLoading={selectedWorkspaceIsLoading}
                        workspaceLoadFailed={selectedWorkspaceLoadFailed}
                        error={formError}
                        isResettingSeededContent={resetSeededContentMutation.isPending}
                        onClearError={() => setFormError(null)}
                        onResetSeededContent={() => setResetSeededContentOpen(true)}
                        onMutationError={(error) => setFormError(translateWorkspaceError(error))}
                    />
                ) : (
                    renderWorkspaceDashboard()
                )
            ) : (
                <RuntimeWorkspaceList
                    rows={workspaceRows}
                    columns={workspaceColumns}
                    isError={workspacesQuery.isError}
                    isLoading={workspacesQuery.isLoading}
                    isFetching={workspacesQuery.isFetching}
                    searchValue={workspaceSearch}
                    onSearchChange={(value) => {
                        setWorkspaceSearch(value)
                        setWorkspaceOffset(0)
                    }}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    canCreate={canCreateSharedWorkspace}
                    onCreate={() => {
                        setFormError(null)
                        setCreateOpen(true)
                    }}
                    onOpen={(workspace) => navigateTo(buildWorkspaceHref(applicationId, workspace.id))}
                    renderActions={renderWorkspaceActions}
                    limit={workspaceLimit}
                    offset={workspaceOffset}
                    total={workspacesQuery.data?.total ?? 0}
                    onLimitChange={setWorkspaceLimit}
                    onOffsetChange={setWorkspaceOffset}
                    onPaginationSearchChange={setWorkspaceSearch}
                />
            )}

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
                            navigateTo(buildWorkspaceHref(applicationId, workspaceMenuTarget.id))
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <OpenInNewRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.open', 'Open')}
                </MenuItem>
                <MenuItem
                    disabled={workspaceMenuTarget?.isDefault === true || defaultMutation.isPending}
                    onClick={() => {
                        if (workspaceMenuTarget) {
                            defaultMutation.mutate(workspaceMenuTarget.id)
                        }
                        closeWorkspaceMenu()
                    }}
                >
                    <StarRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('workspace.setDefault', 'Set default')}
                </MenuItem>
                {canManageWorkspace ? (
                    <>
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
                        <MenuItem
                            disabled={!canConvertWorkspace}
                            onClick={() => {
                                if (workspaceMenuTarget && canConvertWorkspace) {
                                    setFormError(null)
                                    setConvertTarget(workspaceMenuTarget)
                                }
                                closeWorkspaceMenu()
                            }}
                        >
                            <FolderSharedRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                            {t('workspace.actions.makeShared', 'Make shared')}
                        </MenuItem>
                        <Divider />
                        <MenuItem
                            disabled={!canDeleteWorkspace}
                            onClick={() => {
                                if (workspaceMenuTarget && canDeleteWorkspace) {
                                    setFormError(null)
                                    setDeleteTarget(workspaceMenuTarget)
                                }
                                closeWorkspaceMenu()
                            }}
                        >
                            <DeleteRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                            {t('workspace.actions.delete', 'Delete')}
                        </MenuItem>
                    </>
                ) : null}
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

            <ConvertToSharedDialog
                open={Boolean(convertTarget)}
                error={convertTarget ? formError ?? undefined : undefined}
                loading={convertMutation.isPending}
                onCancel={() => {
                    setFormError(null)
                    setConvertTarget(null)
                }}
                onConfirm={() => (convertTarget ? convertMutation.mutateAsync(convertTarget) : undefined)}
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

            <ConfirmDeleteDialog
                open={resetSeededContentOpen}
                title={t('workspace.resetSeededContentTitle', 'Reset seeded content?')}
                description={t(
                    'workspace.resetSeededContentConfirm',
                    'This restores records that are still owned by the published template source. Authored records remain unchanged.'
                )}
                confirmButtonText={t('workspace.resetSeededContentAction', 'Reset content')}
                deletingButtonText={t('workspace.resettingSeededContent', 'Resetting...')}
                cancelButtonText={t('app.cancel', 'Cancel')}
                error={resetSeededContentOpen ? formError ?? undefined : undefined}
                loading={resetSeededContentMutation.isPending}
                onCancel={() => {
                    setFormError(null)
                    setResetSeededContentOpen(false)
                }}
                onConfirm={async () => {
                    await resetSeededContentMutation.mutateAsync()
                }}
            />
        </Box>
    )
}

const buildWorkspaceHref = (applicationId: string, workspaceId: string): string =>
    `/a/${encodeURIComponent(applicationId)}/workspaces/${encodeURIComponent(workspaceId)}`

export default RuntimeWorkspacesPage
