import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Button, Chip, Alert, CircularProgress } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@universo/auth-frontend'
import { extractAxiosError, isHttpStatus, isApiError } from '@universo/utils'

import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'

// Project imports
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    RoleChip
} from '@universo/template-mui'
import type { TableColumn, TriggerProps, ActionContext } from '@universo/template-mui'
import { MemberFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { MemberFormData } from '@universo/template-mui'

import apiClient from '../api/apiClient'
import { createAdminApi } from '../api/adminApi'
import { adminQueryKeys } from '../api/queryKeys'
import { useIsSuperadmin, useGrantGlobalRole, useUpdateGlobalRole, useRevokeGlobalRole, useAssignableGlobalRoles } from '../hooks'
import { useInstanceDetails } from '../hooks/useInstanceDetails'
import type { GlobalUserMember, GlobalAssignableRole, PaginationParams, PaginatedResponse } from '../types'
import memberActions from './MemberActions'

// Singleton instance of adminApi
const adminApi = createAdminApi(apiClient)

/**
 * Type guard to check if data is MemberFormData
 */
function isMemberFormData(data: unknown): data is MemberFormData {
    if (!data || typeof data !== 'object') return false
    const d = data as Record<string, unknown>
    return typeof d.email === 'string' && typeof d.role === 'string'
}

/**
 * Confirm dialog specification with support for translation keys
 */
interface ConfirmSpec {
    title?: string
    titleKey?: string
    description?: string
    descriptionKey?: string
    confirmButtonName?: string
    confirmKey?: string
    cancelButtonName?: string
    cancelKey?: string
    interpolate?: Record<string, string | number>
}

/**
 * Instance Access Page
 * Manages global users (superadmins and supermoderators) within an instance context
 */
const InstanceAccess = () => {
    const { instanceId } = useParams<{ instanceId: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { i18n } = useTranslation(['admin', 'roles', 'common', 'flowList'])
    const { t } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isInviteDialogOpen, setInviteDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.ADMIN_ACCESS_DISPLAY_STYLE)

    // State management for invite dialog error (special handling for 404/409)
    const [inviteDialogError, setInviteDialogError] = useState<string | null>(null)

    const isSuperadmin = useIsSuperadmin()

    // Load roles dynamically for global user assignment
    const { roleOptions: availableRoles, roleLabels, isLoading: isLoadingRoles, error: rolesError } = useAssignableGlobalRoles()

    // Fetch instance details
    const { data: instance, isLoading: instanceLoading, error: instanceError, isError: instanceIsError } = useInstanceDetails(instanceId)

    // Use paginated hook for global users list
    const paginationResult = usePaginated<GlobalUserMember, 'email' | 'role' | 'created'>({
        queryKeyFn: (params: PaginationParams) => adminQueryKeys.globalUsersList(params),
        queryFn: async (params: PaginationParams): Promise<PaginatedResponse<GlobalUserMember>> => {
            return adminApi.listGlobalUsers(params)
        },
        initialLimit: 20,
        sortBy: 'created',
        sortOrder: 'desc',
        enabled: !instanceLoading && !instanceIsError
    })

    const { data: members = [], isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [removeDialogState, setRemoveDialogState] = useState<{
        open: boolean
        member: GlobalUserMember | null
    }>({ open: false, member: null })

    const { confirm } = useConfirm()

    // Mutation hooks
    const grantMutation = useGrantGlobalRole()
    const updateMutation = useUpdateGlobalRole()
    const revokeMutation = useRevokeGlobalRole()

    // Memoize images object (empty for global users - no avatars)
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(members)) {
            members.forEach((member) => {
                if (member?.id) {
                    imagesMap[member.id] = []
                }
            })
        }
        return imagesMap
    }, [members])

    const handleAddNew = () => {
        setInviteDialogOpen(true)
    }

    const handleInviteDialogClose = () => {
        setInviteDialogOpen(false)
        setInviteDialogError(null)
    }

    const handleInviteDialogSave = () => {
        setInviteDialogOpen(false)
        setInviteDialogError(null)
    }

    const handleInviteMember = async (data: { email: string; role: string; comment?: string }) => {
        setInviteDialogError(null)
        try {
            await grantMutation.mutateAsync({
                email: data.email,
                role: data.role as GlobalAssignableRole,
                comment: data.comment
            })
            // Success: close dialog (notification handled by mutation hook)
            handleInviteDialogSave()
        } catch (error: unknown) {
            let message = t('access.grantError', 'Failed to grant access')

            // Use type-safe axios error utilities for special cases
            if (isHttpStatus(error, 404)) {
                message = tc('members.userNotFound', { email: data.email })
            } else if (isHttpStatus(error, 409) && isApiError(error, 'GLOBAL_USER_EXISTS')) {
                message = t('access.userAlreadyHasAccess', { email: data.email, defaultValue: 'User {{email}} already has global access' })
            } else {
                // Extract generic error message
                const apiError = extractAxiosError(error)
                message = apiError.message || message
            }

            // Error: show error message but DON'T close dialog
            setInviteDialogError(message)
            console.error('Failed to grant global access', error)
        }
    }

    const handleChange = (_event: React.MouseEvent<HTMLElement> | null, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const memberColumns = [
        {
            id: 'email',
            label: tc('members.table.email'),
            width: '30%',
            align: 'left',
            render: (row: GlobalUserMember) => {
                if (!row.email) return null
                return <Typography variant='body2'>{row.email}</Typography>
            }
        },
        {
            id: 'nickname',
            label: tc('members.table.nickname'),
            width: '20%',
            align: 'left',
            render: (row: GlobalUserMember) => {
                if (!row.nickname) return null
                return <Typography variant='body2'>{row.nickname}</Typography>
            }
        },
        {
            id: 'comment',
            label: tc('members.table.comment'),
            width: '20%',
            align: 'left',
            render: (row: GlobalUserMember) => {
                if (!row.comment) return null
                return (
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {row.comment}
                    </Typography>
                )
            }
        },
        {
            id: 'role',
            label: tc('members.table.role'),
            width: '15%',
            align: 'center',
            render: (row: GlobalUserMember) => {
                return <RoleChip role={row.roleName || row.role} roleMetadata={row.roleMetadata} />
            }
        },
        {
            id: 'added',
            label: tc('members.table.added'),
            width: '15%',
            align: 'left',
            render: (row: GlobalUserMember) => {
                if (!row.createdAt) return null
                return <Typography variant='body2'>{new Date(row.createdAt).toLocaleDateString()}</Typography>
            }
        }
    ] satisfies TableColumn<GlobalUserMember>[]

    const createMemberContext = useCallback(
        (baseContext: Partial<ActionContext<GlobalUserMember, MemberFormData>>): ActionContext<GlobalUserMember, MemberFormData> => ({
            ...baseContext,
            resource: baseContext.resource!,
            resourceKind: 'member',
            t: baseContext.t!,
            // Pass dynamic roles loaded from API to action handlers
            meta: {
                ...baseContext.meta,
                dynamicRoles: availableRoles,
                dynamicRoleLabels: roleLabels
            },
            api: {
                updateEntity: async (id: string, data: MemberFormData) => {
                    // Validate data
                    if (!isMemberFormData(data)) {
                        throw new Error('Invalid member data format')
                    }
                    await updateMutation.mutateAsync({
                        memberId: id,
                        role: data.role as GlobalAssignableRole,
                        comment: data.comment
                    })
                },
                deleteEntity: async (id: string) => {
                    await revokeMutation.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    // Explicit cache invalidation
                    await queryClient.invalidateQueries({
                        queryKey: adminQueryKeys.globalUsers()
                    })
                },
                confirm: async (spec: ConfirmSpec) => {
                    // Support both direct strings and translation keys
                    const confirmed = await confirm({
                        title: spec.titleKey && baseContext.t ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title || '',
                        description:
                            spec.descriptionKey && baseContext.t
                                ? baseContext.t(spec.descriptionKey, spec.interpolate)
                                : spec.description || '',
                        confirmButtonName:
                            spec.confirmKey && baseContext.t
                                ? baseContext.t(spec.confirmKey)
                                : spec.confirmButtonName || (baseContext.t ? baseContext.t('confirm.remove.confirm') : 'Confirm'),
                        cancelButtonName:
                            spec.cancelKey && baseContext.t
                                ? baseContext.t(spec.cancelKey)
                                : spec.cancelButtonName || (baseContext.t ? baseContext.t('confirm.remove.cancel') : 'Cancel')
                    })
                    return confirmed
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (member: GlobalUserMember) => {
                    setRemoveDialogState({ open: true, member })
                }
            }
        }),
        [availableRoles, confirm, enqueueSnackbar, queryClient, revokeMutation, roleLabels, updateMutation]
    )

    // Instance loading state
    if (instanceLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('access.loading', 'Loading...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Instance error state
    if (instanceIsError || !instance) {
        const errorMessage = instanceError instanceof Error ? instanceError.message : t('access.instanceNotFound', 'Instance not found')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Instance not found'
                    title={t('access.instanceNotFound', 'Instance not found')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
                <Box display='flex' justifyContent='center'>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/admin')}>
                        {t('common.back', 'Back')}
                    </Button>
                </Box>
            </Stack>
        )
    }

    return (
        <>
            {/* Instance Status Chips - outside MainCard to allow edge alignment */}
            <Box sx={{ pb: 2 }}>
                <Stack direction='row' spacing={1} alignItems='center'>
                    <Chip
                        label={t(`instances.status.${instance.status}`, instance.status)}
                        color={instance.status === 'active' ? 'success' : instance.status === 'maintenance' ? 'warning' : 'error'}
                        size='small'
                    />
                    {instance.is_local && <Chip label={t('instances.local', 'Local')} variant='outlined' size='small' color='primary' />}
                </Stack>
            </Box>

            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                {error ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Connection error'
                        title={tc('errors.connectionFailed')}
                        description={
                            !(error as { response?: { status?: number } })?.response?.status
                                ? tc('errors.checkConnection')
                                : tc('errors.pleaseTryLater')
                        }
                        action={{
                            label: tc('actions.retry'),
                            onClick: () => paginationResult.actions.goToPage(1)
                        }}
                    />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 1 }}>
                        <ViewHeader
                            search={true}
                            searchPlaceholder={t('access.searchPlaceholder', 'Search by email or nickname...')}
                            onSearchChange={handleSearchChange}
                            title={t('access.title', 'Global Access Management')}
                        >
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={
                                    isSuperadmin
                                        ? {
                                              label: tc('actions.add', 'Add'),
                                              onClick: handleAddNew,
                                              startIcon: <AddRoundedIcon />
                                          }
                                        : undefined
                                }
                            />
                        </ViewHeader>

                        {isLoading && members.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid />
                            ) : (
                                <Skeleton variant='rectangular' height={120} />
                            )
                        ) : !isLoading && members.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No global users'
                                title={t('access.noUsersFound', 'No global users found')}
                            />
                        ) : (
                            <>
                                {view === 'card' ? (
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gap: gridSpacing,
                                            mx: { xs: -1.5, md: -2 },
                                            gridTemplateColumns: {
                                                xs: '1fr',
                                                sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                                lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                            },
                                            justifyContent: 'start',
                                            alignContent: 'start'
                                        }}
                                    >
                                        {members.map((member: GlobalUserMember) => {
                                            // Filter actions: only superadmin can manage, can't manage self
                                            const descriptors = isSuperadmin && member.userId !== user?.id ? memberActions : []

                                            return (
                                                <ItemCard
                                                    key={member.id}
                                                    data={{
                                                        ...member,
                                                        name: member.email || tc('noEmail'),
                                                        description:
                                                            [member.nickname, member.comment].filter(Boolean).join('\n') || undefined
                                                    }}
                                                    images={images[member.id] || []}
                                                    onClick={undefined}
                                                    footerEndContent={
                                                        <RoleChip
                                                            role={member.roleName || member.role}
                                                            roleMetadata={member.roleMetadata}
                                                            size='small'
                                                        />
                                                    }
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(e) => e.stopPropagation()}>
                                                                <BaseEntityMenu<GlobalUserMember, MemberFormData>
                                                                    entity={member}
                                                                    entityKind='member'
                                                                    descriptors={descriptors}
                                                                    namespace='admin'
                                                                    i18nInstance={i18n}
                                                                    createContext={createMemberContext}
                                                                    renderTrigger={(props: TriggerProps) => (
                                                                        <IconButton
                                                                            size='small'
                                                                            sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                                            {...props}
                                                                        >
                                                                            <MoreVertRoundedIcon fontSize='small' />
                                                                        </IconButton>
                                                                    )}
                                                                />
                                                            </Box>
                                                        ) : null
                                                    }
                                                />
                                            )
                                        })}
                                    </Box>
                                ) : (
                                    <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                        <FlowListTable
                                            data={members}
                                            images={images}
                                            isLoading={isLoading}
                                            getRowLink={() => undefined}
                                            customColumns={memberColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: GlobalUserMember) => {
                                                // Only superadmin can manage, can't manage self
                                                if (!isSuperadmin || row.userId === user?.id) {
                                                    return null
                                                }

                                                const descriptors = memberActions

                                                return (
                                                    <BaseEntityMenu<GlobalUserMember, MemberFormData>
                                                        entity={row}
                                                        entityKind='member'
                                                        descriptors={descriptors}
                                                        namespace='admin'
                                                        menuButtonLabelKey='flowList:menu.button'
                                                        i18nInstance={i18n}
                                                        createContext={createMemberContext}
                                                    />
                                                )
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}

                        {/* Table Pagination at bottom - only show when there's data */}
                        {!isLoading && members.length > 0 && (
                            <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                                <PaginationControls
                                    pagination={paginationResult.pagination}
                                    actions={paginationResult.actions}
                                    isLoading={paginationResult.isLoading}
                                    rowsPerPageOptions={[10, 20, 50, 100]}
                                    namespace='common'
                                />
                            </Box>
                        )}
                    </Stack>
                )}

                <MemberFormDialog
                    open={isInviteDialogOpen}
                    mode='create'
                    title={t('access.addUser', 'Add Global User')}
                    emailLabel={tc('members.emailLabel')}
                    roleLabel={tc('members.roleLabel')}
                    commentLabel={tc('members.commentLabel')}
                    commentPlaceholder={tc('members.commentPlaceholder')}
                    commentCharacterCountFormatter={(count, max) => tc('members.validation.commentCharacterCount', { count, max })}
                    saveButtonText={tc('actions.save', 'Save')}
                    savingButtonText={tc('actions.saving', 'Saving...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    loading={grantMutation.isPending || isLoadingRoles}
                    error={inviteDialogError || (rolesError ? t('access.rolesLoadError') : undefined)}
                    onClose={handleInviteDialogClose}
                    onSave={handleInviteMember}
                    autoCloseOnSuccess={false}
                    availableRoles={availableRoles}
                    roleLabels={roleLabels}
                />

                {/* Independent ConfirmDeleteDialog for Remove button in edit dialog */}
                <ConfirmDeleteDialog
                    open={removeDialogState.open}
                    title={
                        removeDialogState.member?.userId === user?.id
                            ? t('access.selfActionWarning', 'Cannot remove yourself')
                            : t('access.confirmRemove', 'Remove global access?')
                    }
                    description={
                        removeDialogState.member?.userId === user?.id
                            ? t('access.selfActionWarning', 'Cannot remove yourself')
                            : t('access.confirmRemoveDescription', {
                                  email: removeDialogState.member?.email || '',
                                  defaultValue: 'Remove global access for {{email}}?'
                              })
                    }
                    confirmButtonText={tc('actions.remove', 'Remove')}
                    deletingButtonText={tc('actions.deleting', 'Removing...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setRemoveDialogState({ open: false, member: null })}
                    onConfirm={async () => {
                        if (removeDialogState.member) {
                            try {
                                await revokeMutation.mutateAsync(removeDialogState.member.userId)
                                setRemoveDialogState({ open: false, member: null })
                            } catch (err: unknown) {
                                const responseMessage =
                                    err && typeof err === 'object' && 'response' in err
                                        ? (err as { response?: { data?: { message?: string } } })?.response?.data?.message
                                        : undefined
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : err instanceof Error
                                        ? err.message
                                        : typeof err === 'string'
                                        ? err
                                        : t('access.revokeError', 'Failed to revoke access')
                                enqueueSnackbar(message, { variant: 'error' })
                                setRemoveDialogState({ open: false, member: null })
                            }
                        }
                    }}
                />

                <ConfirmDialog />
            </MainCard>
        </>
    )
}

export default InstanceAccess
