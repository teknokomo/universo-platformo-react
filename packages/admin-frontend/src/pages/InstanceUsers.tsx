import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Button, Chip, Alert, CircularProgress, OutlinedInput } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { IconSearch } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@universo/auth-frontend'
import { getCodenamePrimary } from '@universo/utils'

import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
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
    RoleChip,
    FilterToolbar,
    BaseEntityMenu,
    ViewHeaderMUI as ViewHeader
} from '@universo/template-mui'
import type { TableColumn, TriggerProps, ActionContext, FilterConfig, FilterValues } from '@universo/template-mui'

import apiClient from '../api/apiClient'
import { createAdminApi, type AdminCreateUserPayload, type ListGlobalUsersParams } from '../api/adminApi'
import { adminQueryKeys } from '../api/queryKeys'
import { useAdminPermission, useRoles } from '../hooks'
import { useInstanceDetails } from '../hooks/useInstanceDetails'
import type { GlobalUserMember, PaginationParams, PaginatedResponse } from '../types'
import type { RoleListItem } from '../api/rolesApi'
import UserFormDialog from '../components/UserFormDialog'
import type { UserFormDialogSubmitData } from '../components/UserFormDialog'
import userActions from './UserActions'

const adminApi = createAdminApi(apiClient)

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

interface UserActionContext extends ActionContext<GlobalUserMember, UserFormDialogSubmitData> {
    meta?: {
        roles?: RoleListItem[]
        loading?: boolean
        error?: string | null
    }
}

const InstanceUsers = () => {
    const { instanceId } = useParams<{ instanceId: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { i18n } = useTranslation(['admin', 'roles', 'common', 'flowList'])
    const { t } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [view, setView] = useViewPreference(STORAGE_KEYS.INSTANCE_USERS_DISPLAY_STYLE)
    const [dialogState, setDialogState] = useState<{ open: boolean; mode: 'create' | 'edit'; member: GlobalUserMember | null }>({
        open: false,
        mode: 'create',
        member: null
    })
    const [dialogError, setDialogError] = useState<string | null>(null)
    const [filterValues, setFilterValues] = useState<FilterValues>({ roleId: 'all' })
    const filterValuesRef = useRef(filterValues)

    useEffect(() => {
        filterValuesRef.current = filterValues
    }, [filterValues])

    const canCreateUsers = useAdminPermission('create', 'User')
    const canUpdateUsers = useAdminPermission('update', 'User')

    const { roles: allRoles, roleLabelsById, isLoading: isLoadingAllRoles } = useRoles({ filter: 'all' })

    const filterConfigs: FilterConfig[] = useMemo(
        () => [
            {
                key: 'roleId',
                type: 'select',
                label: t('users.filters.role', 'Role'),
                placeholder: t('users.filters.allRoles', 'All roles'),
                options: allRoles.map((role) => ({
                    value: role.id,
                    label: roleLabelsById[role.id] || getCodenamePrimary(role.codename)
                }))
            }
        ],
        [allRoles, roleLabelsById, t]
    )

    const handleFilterChange = useCallback(
        (nextFilters: FilterValues) => {
            filterValuesRef.current = nextFilters
            setFilterValues(nextFilters)
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
        },
        [queryClient]
    )

    const { data: instance, isLoading: instanceLoading, error: instanceError, isError: instanceIsError } = useInstanceDetails(instanceId)

    const paginationResult = usePaginated<GlobalUserMember, 'email' | 'created'>({
        queryKeyFn: (params: PaginationParams) => {
            const currentFilters = filterValuesRef.current
            const fullParams: ListGlobalUsersParams = {
                ...params,
                roleId: currentFilters.roleId === 'all' ? undefined : String(currentFilters.roleId)
            }
            return adminQueryKeys.globalUsersList(fullParams)
        },
        queryFn: async (params: PaginationParams): Promise<PaginatedResponse<GlobalUserMember>> => {
            const currentFilters = filterValuesRef.current
            const fullParams: ListGlobalUsersParams = {
                ...params,
                roleId: currentFilters.roleId === 'all' ? undefined : String(currentFilters.roleId)
            }
            return adminApi.listGlobalUsers(fullParams)
        },
        initialLimit: 20,
        sortBy: 'created',
        sortOrder: 'desc',
        enabled: !instanceLoading && !instanceIsError
    })

    const { data: members = [], isLoading, error } = paginationResult

    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const { confirm } = useConfirm()

    const createUserMutation = useMutation({
        mutationFn: (payload: AdminCreateUserPayload) => adminApi.createUser(payload),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
            await queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboardStats() })
            enqueueSnackbar(t('users.createSuccess', 'User created successfully'), { variant: 'success' })
            setDialogState({ open: false, mode: 'create', member: null })
            setDialogError(null)
        },
        onError: (mutationError: Error) => {
            setDialogError(mutationError.message || t('users.createError', 'Failed to create user'))
        }
    })

    const setUserRolesMutation = useMutation({
        mutationFn: ({ userId, roleIds, comment }: { userId: string; roleIds: string[]; comment?: string }) =>
            adminApi.setUserRoles({ userId, roleIds, comment }),
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
            await queryClient.invalidateQueries({ queryKey: adminQueryKeys.dashboardStats() })
            enqueueSnackbar(
                variables.roleIds.length > 0
                    ? t('users.updateSuccess', 'User roles updated successfully')
                    : t('users.clearRolesSuccess', 'All user roles cleared successfully'),
                { variant: 'success' }
            )
        }
    })

    const dialogLoading = createUserMutation.isPending || setUserRolesMutation.isPending

    const editErrorMessage = setUserRolesMutation.error instanceof Error ? setUserRolesMutation.error.message : null

    const images = useMemo(() => {
        const map: Record<string, unknown[]> = {}
        members.forEach((member) => {
            map[member.id] = []
        })
        return map
    }, [members])

    const renderRoleChips = useCallback(
        (member: GlobalUserMember, size: 'small' | 'medium' = 'small', compact = false) => {
            if (member.roles.length === 0) {
                return <Chip size={size} label={t('users.noRoles', 'No roles')} variant='outlined' />
            }

            const visibleRoles = compact ? member.roles.slice(0, 1) : member.roles
            const hiddenRolesCount = compact ? member.roles.length - visibleRoles.length : 0

            return (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: size === 'small' ? 'flex-start' : 'center' }}>
                    {visibleRoles.map((role) => (
                        <RoleChip
                            key={role.id}
                            role={role.codename}
                            roleMetadata={{
                                codename: role.codename,
                                name: role.name,
                                color: role.color,
                                isSuperuser: role.isSuperuser
                            }}
                            size={size}
                        />
                    ))}
                    {hiddenRolesCount > 0 && <Chip size={size} label={`+${hiddenRolesCount}`} variant='outlined' />}
                </Box>
            )
        },
        [t]
    )

    const handleChange = (_event: React.MouseEvent<HTMLElement> | null, nextView: string | null) => {
        if (!nextView) {
            return
        }
        setView(nextView as 'card' | 'table')
    }

    const openCreateDialog = useCallback(() => {
        if (!canCreateUsers) {
            return
        }

        setDialogError(null)
        setDialogState({ open: true, mode: 'create', member: null })
    }, [canCreateUsers])

    const closeDialog = useCallback(() => {
        if (dialogLoading) {
            return
        }

        setDialogState({ open: false, mode: 'create', member: null })
        setDialogError(null)
    }, [dialogLoading])

    const handleDialogSubmit = useCallback(
        async (data: UserFormDialogSubmitData) => {
            if (dialogState.mode === 'create') {
                if (!canCreateUsers) {
                    return
                }

                await createUserMutation.mutateAsync({
                    email: data.email,
                    password: data.password,
                    roleIds: data.roleIds,
                    comment: data.comment
                })
                return
            }

            if (!dialogState.member) {
                return
            }

            if (!canUpdateUsers) {
                return
            }

            await setUserRolesMutation.mutateAsync({
                userId: dialogState.member.userId,
                roleIds: data.roleIds,
                comment: data.comment
            })

            setDialogState({ open: false, mode: 'create', member: null })
            setDialogError(null)
        },
        [canCreateUsers, canUpdateUsers, createUserMutation, dialogState, setUserRolesMutation]
    )

    const memberColumns = [
        {
            id: 'email',
            label: tc('members.table.email'),
            width: '28%',
            align: 'left',
            render: (row: GlobalUserMember) => (row.email ? <Typography variant='body2'>{row.email}</Typography> : null)
        },
        {
            id: 'nickname',
            label: tc('members.table.nickname'),
            width: '18%',
            align: 'left',
            render: (row: GlobalUserMember) => (row.nickname ? <Typography variant='body2'>{row.nickname}</Typography> : null)
        },
        {
            id: 'roles',
            label: t('users.table.roles', 'Roles'),
            width: '29%',
            align: 'left',
            render: (row: GlobalUserMember) => renderRoleChips(row)
        },
        {
            id: 'onboarding',
            label: t('users.table.onboarding', 'Onboarding'),
            width: '12%',
            align: 'left',
            render: (row: GlobalUserMember) =>
                row.onboardingCompleted ? (
                    <Chip size='small' label={t('users.onboardingCompleted', 'Completed')} color='success' variant='outlined' />
                ) : (
                    <Chip size='small' label={t('users.onboardingPending', 'Pending')} color='warning' variant='outlined' />
                )
        },
        {
            id: 'registered',
            label: t('users.table.registered', 'Registered'),
            width: '13%',
            align: 'left',
            render: (row: GlobalUserMember) => (
                <Typography variant='body2'>{row.registeredAt ? new Date(row.registeredAt).toLocaleDateString() : '-'}</Typography>
            )
        }
    ] satisfies TableColumn<GlobalUserMember>[]

    const createUserContext = useCallback(
        (baseContext: Partial<ActionContext<GlobalUserMember, UserFormDialogSubmitData>>): UserActionContext => ({
            ...baseContext,
            entity: baseContext.entity!,
            entityKind: 'user',
            resource: baseContext.resource!,
            t: baseContext.t!,
            meta: {
                ...baseContext.meta,
                roles: allRoles,
                loading: dialogLoading,
                error: editErrorMessage
            },
            api: {
                updateEntity: async (userId: string, data: UserFormDialogSubmitData) => {
                    await setUserRolesMutation.mutateAsync({
                        userId,
                        roleIds: data.roleIds,
                        comment: data.comment
                    })
                },
                deleteEntity: async (userId: string) => {
                    await setUserRolesMutation.mutateAsync({ userId, roleIds: [] })
                }
            },
            helpers: {
                refreshList: async () => {
                    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
                },
                confirm: async (spec: ConfirmSpec) =>
                    confirm({
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
                    }),
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                }
            }
        }),
        [allRoles, confirm, dialogLoading, editErrorMessage, enqueueSnackbar, queryClient, setUserRolesMutation]
    )

    if (instanceLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('users.loading', 'Loading...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    if (instanceIsError || !instance) {
        const errorMessage = instanceError instanceof Error ? instanceError.message : t('users.instanceNotFound', 'Instance not found')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Instance not found'
                    title={t('users.instanceNotFound', 'Instance not found')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
                <Box display='flex' justifyContent='center'>
                    <Button variant='text' startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate('/admin')}>
                        {tc('back', 'Back')}
                    </Button>
                </Box>
            </Stack>
        )
    }

    return (
        <>
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
                        <ViewHeader title={t('users.title', 'Users Management')}>
                            <ToolbarControls
                                viewToggleEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={
                                    canCreateUsers
                                        ? {
                                              label: t('users.createUser', 'Create'),
                                              onClick: openCreateDialog,
                                              startIcon: <AddRoundedIcon />
                                          }
                                        : undefined
                                }
                            />
                        </ViewHeader>

                        <Box
                            sx={{
                                mx: { xs: -1.5, md: -2 },
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 2,
                                px: 2,
                                py: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                bgcolor: 'background.paper'
                            }}
                        >
                            <OutlinedInput
                                size='small'
                                sx={{
                                    width: { xs: '100%', sm: '300px' },
                                    height: 36,
                                    borderRadius: 1,
                                    '& .MuiOutlinedInput-notchedOutline': { borderRadius: 1 }
                                }}
                                placeholder={t('users.searchPlaceholder', 'Search by email or nickname...')}
                                onChange={handleSearchChange}
                                startAdornment={
                                    <Box sx={{ color: 'grey.400', display: 'flex', alignItems: 'center', mr: 1 }}>
                                        <IconSearch style={{ width: 16, height: 16 }} />
                                    </Box>
                                }
                                type='search'
                            />

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <FilterToolbar
                                    filters={filterConfigs}
                                    values={filterValues}
                                    onChange={handleFilterChange}
                                    loading={isLoadingAllRoles}
                                    compact
                                />
                            </Box>
                        </Box>

                        {isLoading && members.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid />
                            ) : (
                                <Skeleton variant='rectangular' height={120} />
                            )
                        ) : !isLoading && members.length === 0 ? (
                            <EmptyListState
                                image={APIEmptySVG}
                                imageAlt='No users'
                                title={t('users.noUsersFound', 'No users found')}
                                description={
                                    filterValues.roleId !== 'all' ? t('users.tryAdjustFilters', 'Try adjusting your filters') : undefined
                                }
                            />
                        ) : (
                            <>
                                {view === 'card' ? (
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gap: gridSpacing,
                                            mt: 2,
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
                                        {members.map((member) => {
                                            const descriptors =
                                                canUpdateUsers && member.userId !== user?.id
                                                    ? userActions.filter(
                                                          (descriptor) => descriptor.id !== 'clearRoles' || member.roles.length > 0
                                                      )
                                                    : []

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
                                                    footerEndContent={renderRoleChips(member, 'small', true)}
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(event) => event.stopPropagation()}>
                                                                <BaseEntityMenu<GlobalUserMember, UserFormDialogSubmitData>
                                                                    entity={member}
                                                                    entityKind='user'
                                                                    descriptors={descriptors}
                                                                    namespace='admin'
                                                                    i18nInstance={i18n}
                                                                    createContext={createUserContext}
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
                                    <Box sx={{ mt: 2, mx: { xs: -1.5, md: -2 } }}>
                                        <FlowListTable
                                            data={members}
                                            images={images}
                                            isLoading={isLoading}
                                            getRowLink={() => undefined}
                                            customColumns={memberColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: GlobalUserMember) => {
                                                if (!canUpdateUsers || row.userId === user?.id) {
                                                    return null
                                                }

                                                const descriptors = userActions.filter(
                                                    (descriptor) => descriptor.id !== 'clearRoles' || row.roles.length > 0
                                                )

                                                return (
                                                    <BaseEntityMenu<GlobalUserMember, UserFormDialogSubmitData>
                                                        entity={row}
                                                        entityKind='user'
                                                        descriptors={descriptors}
                                                        namespace='admin'
                                                        menuButtonLabelKey='flowList:menu.button'
                                                        i18nInstance={i18n}
                                                        createContext={createUserContext}
                                                    />
                                                )
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}

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

                <UserFormDialog
                    open={dialogState.open}
                    mode={dialogState.mode}
                    title={dialogState.mode === 'create' ? t('users.createDialogTitle', 'Create User') : t('users.editUser', 'Edit user')}
                    submitLabel={dialogState.mode === 'create' ? t('users.createSubmit', 'Create') : tc('actions.save')}
                    roles={allRoles}
                    loading={dialogLoading}
                    error={dialogState.mode === 'create' ? dialogError : editErrorMessage}
                    initialEmail={dialogState.member?.email ?? ''}
                    initialComment={dialogState.member?.comment ?? ''}
                    initialRoleIds={dialogState.member?.roles.map((role) => role.id) ?? []}
                    onClose={closeDialog}
                    onSubmit={handleDialogSubmit}
                />

                <ConfirmDialog />
            </MainCard>
        </>
    )
}

export default InstanceUsers
