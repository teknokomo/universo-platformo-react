import { useState, useMemo, useCallback } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Chip, Tooltip } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { resolveLocalizedContent } from '@universo/utils'
import type { LocaleCode } from '@universo/types'
import { isValidLocaleCode } from '@universo/types'
import { useSnackbar } from 'notistack'
import { useQueryClient, useMutation } from '@tanstack/react-query'

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
    ViewHeaderMUI as ViewHeader,
    BaseEntityMenu
} from '@universo/template-mui'
import { ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import type { TriggerProps } from '@universo/template-mui'

import * as rolesApi from '../api/rolesApi'
import type { RoleListItem } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'
import { useIsSuperadmin } from '../hooks'
import roleActions from './RoleActions'

// Type for role update/create data
type RoleData = {
    name: string
    description?: string
}

/**
 * Roles List Page
 * Displays all RBAC roles with card/table view, pagination, and search
 */
const RolesList = () => {
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const navigate = useNavigate()
    const { instanceId } = useParams<{ instanceId: string }>()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const isSuperadmin = useIsSuperadmin()
    const { confirm } = useConfirm()

    // View state (card/list)
    const [view, setView] = useState(localStorage.getItem('adminRolesDisplayStyle') || 'card')

    // Delete dialog state
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        role: RoleListItem | null
    }>({ open: false, role: null })

    // Get current language for display names
    const langCode = i18n.language.split('-')[0] || 'en'
    const currentLang: LocaleCode = isValidLocaleCode(langCode) ? langCode : 'en'

    // Pagination hook
    const paginationResult = usePaginated<RoleListItem, 'codename' | 'created'>({
        queryKeyFn: (params) => rolesQueryKeys.list(params),
        queryFn: rolesApi.listRoles,
        initialLimit: 20,
        sortBy: 'codename',
        sortOrder: 'asc'
    })

    const { data: roles, isLoading, error } = paginationResult

    // Debounced search
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 300
    })

    // Update mutation
    const updateRoleMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<RoleListItem> }) => rolesApi.updateRole(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.lists() })
            // Invalidate assignable roles cache in case hasGlobalAccess changed
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
        }
    })

    // Delete mutation
    const deleteRoleMutation = useMutation({
        mutationFn: (id: string) => rolesApi.deleteRole(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.lists() })
            // Invalidate assignable roles cache in case a global role was deleted
            queryClient.invalidateQueries({ queryKey: rolesQueryKeys.assignable() })
            enqueueSnackbar(t('roles.deleteSuccess'), { variant: 'success' })
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || t('roles.deleteError'), { variant: 'error' })
        }
    })

    // Helper: Get localized role name from VLC
    const getRoleName = useCallback(
        (role: RoleListItem): string => {
            return resolveLocalizedContent(role.name, currentLang, role.codename)
        },
        [currentLang]
    )

    // Helper: Get localized description from VLC
    const getRoleDescription = useCallback(
        (role: RoleListItem): string => {
            return resolveLocalizedContent(role.description, currentLang, '')
        },
        [currentLang]
    )

    // Helper: Count permissions
    const countPermissions = useCallback(
        (role: RoleListItem): string => {
            // Superuser has infinite permissions
            if (role.isSuperuser) {
                return '∞' // infinity symbol
            }
            if (!role.permissions || role.permissions.length === 0) {
                return t('roles.noPermissions')
            }
            const hasFullAccess = role.permissions.some((p) => p.subject === '*' && p.action === '*')
            if (hasFullAccess) {
                return t('roles.fullAccess')
            }
            return String(role.permissions.length)
        },
        [t]
    )

    // Handlers
    const handleAddNew = () => {
        navigate(`/admin/instance/${instanceId}/roles/new`)
    }

    const handleViewChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('adminRolesDisplayStyle', nextView)
        setView(nextView)
    }

    // Table columns
    const roleColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name'),
                width: '20%',
                align: 'left' as const,
                render: (role: RoleListItem) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                            sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                backgroundColor: role.color,
                                border: '1px solid',
                                borderColor: 'divider',
                                flexShrink: 0
                            }}
                        />
                        <Link to={`/admin/instance/${instanceId}/roles/${role.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                                }}
                            >
                                {getRoleName(role)}
                            </Typography>
                        </Link>
                    </Box>
                )
            },
            {
                id: 'displayName',
                label: t('roles.table.displayName'),
                width: '20%',
                align: 'left' as const,
                render: (role: RoleListItem) => <Typography variant='body2'>{getRoleName(role)}</Typography>
            },
            {
                id: 'globalAccess',
                label: t('roles.table.globalAccess'),
                width: '15%',
                align: 'center' as const,
                render: (role: RoleListItem) => (
                    <Box display='flex' gap={0.5} justifyContent='center'>
                        {role.isSuperuser && (
                            <Chip size='small' label={t('roles.isSuperuser', 'Superuser')} color='error' variant='outlined' />
                        )}
                        {!role.isSuperuser && <Chip size='small' label={t('roles.normalRole', 'Normal')} variant='outlined' />}
                    </Box>
                )
            },
            {
                id: 'permissions',
                label: t('roles.table.permissions'),
                width: '12%',
                align: 'center' as const,
                render: (role: RoleListItem) => (
                    <Typography variant='body2' color='text.secondary'>
                        {countPermissions(role)}
                    </Typography>
                )
            },
            {
                id: 'type',
                label: t('roles.table.type'),
                width: '12%',
                align: 'center' as const,
                render: (role: RoleListItem) =>
                    role.isSystem ? (
                        <Tooltip title={t('roles.systemRoleHint')}>
                            <Chip
                                size='small'
                                icon={<SecurityRoundedIcon />}
                                label={t('roles.systemRole')}
                                color='primary'
                                variant='outlined'
                            />
                        </Tooltip>
                    ) : (
                        <Chip size='small' label={t('roles.customRole')} variant='outlined' />
                    )
            }
        ],
        [t, tc, instanceId, getRoleName, countPermissions]
    )

    // Context creator for BaseEntityMenu
    const createRoleContext = useCallback(
        (baseContext: { entity: RoleListItem; entityKind: string; t: (key: string, params?: Record<string, unknown>) => string }) => ({
            ...baseContext,
            meta: {
                navigate,
                instanceId
            },
            api: {
                updateEntity: async (id: string, patch: RoleData) => {
                    await updateRoleMutation.mutateAsync({ id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    await deleteRoleMutation.mutateAsync(id)
                }
            },
            helpers: {
                refreshList: async () => {
                    await queryClient.invalidateQueries({ queryKey: rolesQueryKeys.lists() })
                },
                confirm: async (spec: {
                    title?: string
                    titleKey?: string
                    description?: string
                    descriptionKey?: string
                    confirmKey?: string
                    cancelKey?: string
                    interpolate?: Record<string, unknown>
                }) => {
                    const confirmed = await confirm({
                        title: spec.titleKey ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title || '',
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : spec.description,
                        confirmButtonName: spec.confirmKey ? baseContext.t(spec.confirmKey) : tc('actions.delete'),
                        cancelButtonName: spec.cancelKey ? baseContext.t(spec.cancelKey) : tc('actions.cancel')
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
                openDeleteDialog: (role: RoleListItem) => {
                    setDeleteDialogState({ open: true, role })
                }
            }
        }),
        [confirm, deleteRoleMutation, enqueueSnackbar, instanceId, navigate, queryClient, tc, updateRoleMutation]
    )

    // Filter actions based on permissions
    const getFilteredActions = useCallback(
        (role: RoleListItem) => {
            return roleActions.filter((descriptor) => {
                // System roles cannot be deleted
                if (descriptor.id === 'delete' && role.isSystem) {
                    return false
                }
                // Only superadmins can edit/delete
                if ((descriptor.id === 'edit' || descriptor.id === 'delete') && !isSuperadmin) {
                    return false
                }
                return true
            })
        },
        [isSuperadmin]
    )

    return (
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
                    title={t('roles.errorLoading')}
                    description={t('errors.pleaseTryLater')}
                    action={{
                        label: t('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('roles.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('roles.title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleViewChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={
                                isSuperadmin
                                    ? {
                                          label: tc('addNew'),
                                          onClick: handleAddNew,
                                          startIcon: <AddRoundedIcon />
                                      }
                                    : undefined
                            }
                        />
                    </ViewHeader>

                    {isLoading && roles.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && roles.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No roles'
                            title={t('roles.empty.title')}
                            description={t('roles.empty.description')}
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
                                    {roles.map((role: RoleListItem) => {
                                        const descriptors = getFilteredActions(role)

                                        return (
                                            <ItemCard
                                                key={role.id}
                                                data={{
                                                    name: getRoleName(role),
                                                    description: getRoleDescription(role),
                                                    color: role.color
                                                }}
                                                colorDotSize={12}
                                                images={[]}
                                                href={`/admin/instance/${instanceId}/roles/${role.id}`}
                                                footerStartContent={
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        {role.isSystem ? (
                                                            <Tooltip title={t('roles.systemRoleHint')}>
                                                                <Chip
                                                                    size='small'
                                                                    icon={<SecurityRoundedIcon />}
                                                                    label={t('roles.systemRole')}
                                                                    color='primary'
                                                                    variant='outlined'
                                                                />
                                                            </Tooltip>
                                                        ) : (
                                                            <Chip size='small' label={t('roles.customRole')} variant='outlined' />
                                                        )}
                                                        {role.isSuperuser && (
                                                            <Chip
                                                                size='small'
                                                                label={t('roles.isSuperuser', 'Superuser')}
                                                                color='error'
                                                                variant='outlined'
                                                            />
                                                        )}
                                                    </Box>
                                                }
                                                footerEndContent={
                                                    <Typography variant='caption' color='text.secondary'>
                                                        {countPermissions(role)}
                                                    </Typography>
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<RoleListItem, RoleData>
                                                                entity={role}
                                                                entityKind='role'
                                                                descriptors={descriptors}
                                                                namespace='admin'
                                                                i18nInstance={i18n}
                                                                createContext={createRoleContext}
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
                                        data={roles}
                                        isLoading={isLoading}
                                        getRowLink={(row: RoleListItem) =>
                                            row?.id ? `/admin/instance/${instanceId}/roles/${row.id}` : undefined
                                        }
                                        customColumns={roleColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: RoleListItem) => {
                                            const descriptors = getFilteredActions(row)

                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<RoleListItem, RoleData>
                                                    entity={row}
                                                    entityKind='role'
                                                    descriptors={descriptors}
                                                    namespace='admin'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createRoleContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Pagination */}
                    {!isLoading && roles.length > 0 && (
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

            {/* Confirm Delete Dialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('roles.confirmDelete', 'Delete role?')}
                description={t('roles.confirmDeleteDescription', {
                    name: deleteDialogState.role ? getRoleName(deleteDialogState.role) : '',
                    defaultValue: 'Are you sure you want to delete role "{{name}}"?'
                })}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, role: null })}
                onConfirm={async () => {
                    if (deleteDialogState.role) {
                        try {
                            await deleteRoleMutation.mutateAsync(deleteDialogState.role.id)
                            setDeleteDialogState({ open: false, role: null })
                        } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : t('roles.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, role: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default RolesList
