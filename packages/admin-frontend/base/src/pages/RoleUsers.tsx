import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, Avatar, Chip } from '@mui/material'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useQuery } from '@tanstack/react-query'
import { formatDate } from '@universo/utils'

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
    ViewHeaderMUI as ViewHeader
} from '@universo/template-mui'

import { getRoleUsers, getRole, type RoleUser, type UserStatus } from '../api/rolesApi'
import { rolesQueryKeys } from '../api/queryKeys'

/**
 * Get initials from name
 */
const getInitials = (name: string): string => {
    const parts = name.split(' ')
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
}

/**
 * Status chip component with proper colors
 */
const StatusChip = ({ status, t }: { status: UserStatus; t: (key: string) => string }) => {
    const config: Record<UserStatus, { color: 'success' | 'default' | 'warning' | 'error'; labelKey: string }> = {
        active: { color: 'success', labelKey: 'roles.users.status.active' },
        inactive: { color: 'default', labelKey: 'roles.users.status.inactive' },
        pending: { color: 'warning', labelKey: 'roles.users.status.pending' },
        banned: { color: 'error', labelKey: 'roles.users.status.banned' }
    }

    const { color, labelKey } = config[status] || config.inactive

    return <Chip size='small' color={color} label={t(labelKey)} />
}

/**
 * Role Users Page
 * Displays users assigned to a specific role with card/table view, search, and pagination
 */
const RoleUsers = () => {
    const { t, i18n } = useTranslation('admin')
    const { t: tc } = useCommonTranslations()
    const { roleId } = useParams<{ roleId: string; instanceId: string }>()

    // View state (card/list)
    const [view, setView] = useState(localStorage.getItem('roleUsersDisplayStyle') || 'list')

    // Get current language for display names
    const currentLang = i18n.language.split('-')[0] || 'en'

    // Fetch role details to show role name
    const { data: role, isLoading: isLoadingRole } = useQuery({
        queryKey: rolesQueryKeys.detail(roleId || ''),
        queryFn: () => getRole(roleId || ''),
        enabled: Boolean(roleId)
    })

    // Use paginated hook for role users list (server-side pagination)
    const paginationResult = usePaginated<RoleUser, 'email' | 'assigned_at'>({
        queryKeyFn: (params) => rolesQueryKeys.usersList(roleId || '', params),
        queryFn: (params) => getRoleUsers(roleId || '', params),
        initialLimit: 20,
        sortBy: 'assigned_at',
        sortOrder: 'desc',
        enabled: Boolean(roleId)
    })

    const { data: users, isLoading: isLoadingUsers, error } = paginationResult

    // Instant search for better UX
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // Get role display name
    const roleDisplayName = useMemo(() => {
        if (!role) return ''
        const displayNameObj = role.displayName
        if (displayNameObj) {
            return displayNameObj[currentLang] || displayNameObj['en'] || displayNameObj['ru'] || role.name
        }
        return role.name
    }, [role, currentLang])

    // View change handler
    const handleViewChange = useCallback((_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('roleUsersDisplayStyle', nextView)
        setView(nextView)
    }, [])

    const isLoading = isLoadingRole || isLoadingUsers

    // Table columns
    const userColumns = useMemo(
        () => [
            {
                id: 'user',
                label: t('roles.users.table.user'),
                width: '30%',
                align: 'left' as const,
                render: (row: RoleUser) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem' }}>
                            {row.fullName ? getInitials(row.fullName) : <PersonRoundedIcon fontSize='small' />}
                        </Avatar>
                        <Typography variant='body2' fontWeight={500}>
                            {row.fullName || t('roles.users.anonymous')}
                        </Typography>
                    </Box>
                )
            },
            {
                id: 'email',
                label: t('roles.users.table.email'),
                width: '30%',
                align: 'left' as const,
                render: (row: RoleUser) => (
                    <Typography variant='body2' color='text.secondary'>
                        {row.email || '-'}
                    </Typography>
                )
            },
            {
                id: 'assignedAt',
                label: t('roles.users.table.assignedAt'),
                width: '20%',
                align: 'left' as const,
                render: (row: RoleUser) => (
                    <Typography variant='body2' color='text.secondary'>
                        {formatDate(row.assignedAt, 'short')}
                    </Typography>
                )
            },
            {
                id: 'status',
                label: t('roles.users.table.status'),
                width: '20%',
                align: 'center' as const,
                render: (row: RoleUser) => <StatusChip status={row.status} t={t} />
            }
        ],
        [t]
    )

    // Error state
    if (error) {
        return (
            <MainCard
                sx={{ maxWidth: '100%', width: '100%' }}
                contentSX={{ px: 0, py: 0 }}
                disableContentPadding
                disableHeader
                border={false}
                shadow={false}
            >
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={tc('errors.connectionFailed')}
                    description={tc('errors.pleaseTryLater')}
                />
            </MainCard>
        )
    }

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <Stack flexDirection='column' sx={{ gap: 1 }}>
                <ViewHeader
                    search={true}
                    searchPlaceholder={t('roles.users.searchPlaceholder')}
                    onSearchChange={handleSearchChange}
                    title={t('roles.users.title')}
                    description={t('roles.users.description', { roleName: roleDisplayName })}
                >
                    <ToolbarControls
                        viewToggleEnabled
                        viewMode={view as 'card' | 'list'}
                        onViewModeChange={(mode: string) => handleViewChange(null, mode)}
                        cardViewTitle={tc('cardView')}
                        listViewTitle={tc('listView')}
                    />
                </ViewHeader>

                {isLoading && users.length === 0 ? (
                    view === 'card' ? (
                        <SkeletonGrid />
                    ) : (
                        <Skeleton variant='rectangular' height={200} />
                    )
                ) : !isLoading && users.length === 0 ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='No users'
                        title={t('roles.users.empty.title')}
                        description={t('roles.users.empty.description')}
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
                                {users.map((user: RoleUser) => (
                                    <ItemCard
                                        key={user.id}
                                        data={{
                                            name: user.fullName || t('roles.users.anonymous'),
                                            description: user.email
                                        }}
                                        images={[]}
                                        footerStartContent={<StatusChip status={user.status} t={t} />}
                                        footerEndContent={
                                            <Typography variant='caption' color='text.secondary'>
                                                {formatDate(user.assignedAt, 'short')}
                                            </Typography>
                                        }
                                    />
                                ))}
                            </Box>
                        ) : (
                            <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                <FlowListTable data={users} isLoading={isLoading} customColumns={userColumns} i18nNamespace='flowList' />
                            </Box>
                        )}
                    </>
                )}

                {/* Pagination */}
                {!isLoading && users.length > 0 && (
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
        </MainCard>
    )
}

export default RoleUsers
