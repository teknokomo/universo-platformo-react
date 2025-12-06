import { useState, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, IconButton, Alert, Chip } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DnsRoundedIcon from '@mui/icons-material/DnsRounded'
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

// project imports
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
    useConfirm
} from '@universo/template-mui'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useUpdateInstance } from '../hooks/instanceMutations'
import * as instancesApi from '../api/instancesApi'
import { instancesQueryKeys } from '../api/queryKeys'
import type { Instance, InstanceStatus } from '../types'
import { getInstanceActions } from './InstanceActions'

// Type for instance update data
type InstanceData = {
    name: string
    description?: string
}

type TranslateFn = TFunction<string, string>

/**
 * Get status chip color based on instance status
 */
const getStatusColor = (status: InstanceStatus): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
        case 'active':
            return 'success'
        case 'maintenance':
            return 'warning'
        case 'inactive':
            return 'error'
        default:
            return 'default'
    }
}

/**
 * Status Chip component for instances
 */
const StatusChip = ({ status, t }: { status: InstanceStatus; t: TranslateFn }) => (
    <Chip label={t(`instances.status.${status}`, status)} color={getStatusColor(status)} size='small' />
)

/**
 * Local/Remote Chip component
 */
const LocalChip = ({ isLocal, t }: { isLocal: boolean; t: TranslateFn }) =>
    isLocal ? (
        <Chip label={t('instances.local', 'Local')} variant='outlined' size='small' color='primary' />
    ) : (
        <Chip label={t('instances.remote', 'Remote')} variant='outlined' size='small' color='default' />
    )

/**
 * Instance List Page
 *
 * Displays list of platform instances with standard card/table view.
 * MVP: Only one pre-seeded "Local" instance, edit enabled, create/delete disabled.
 */
const InstanceList = () => {
    const { t, i18n } = useTranslation(['admin', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [view, setView] = useState(localStorage.getItem('adminInstanceDisplayStyle') || 'card')

    // Use paginated hook for instances list
    const paginationResult = usePaginated<Instance, 'name' | 'created' | 'status'>({
        queryKeyFn: instancesQueryKeys.list,
        queryFn: instancesApi.listInstances,
        initialLimit: 20,
        sortBy: 'name',
        sortOrder: 'asc'
    })

    const { data: instances, isLoading, error } = paginationResult

    // Instant search for better UX
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    const { confirm } = useConfirm()
    const updateInstanceMutation = useUpdateInstance()

    // Memoize empty images object
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(instances)) {
            instances.forEach((instance) => {
                if (instance?.id) {
                    imagesMap[instance.id] = []
                }
            })
        }
        return imagesMap
    }, [instances])

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('adminInstanceDisplayStyle', nextView)
        setView(nextView)
    }

    // Instance table columns
    const instanceColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '25%',
                align: 'left',
                render: (row: Instance) => (
                    <Link to={`/admin/instance/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Stack direction='row' alignItems='center' spacing={1}>
                            {row.is_local ? (
                                <DnsRoundedIcon color='primary' fontSize='small' />
                            ) : (
                                <CloudOffRoundedIcon color='disabled' fontSize='small' />
                            )}
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </Stack>
                    </Link>
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left',
                render: (row: Instance) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'status',
                label: tc('table.status', 'Status'),
                width: '15%',
                align: 'center',
                render: (row: Instance) => <StatusChip status={row.status} t={t} />
            },
            {
                id: 'type',
                label: t('instances.type', 'Type'),
                width: '15%',
                align: 'center',
                render: (row: Instance) => <LocalChip isLocal={row.is_local} t={t} />
            }
        ],
        [t, tc]
    )

    // Create context for BaseEntityMenu
    const createInstanceContext = useCallback(
        (baseContext: { t: (key: string, interpolate?: Record<string, string>) => string }) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: InstanceData) => {
                    await updateInstanceMutation.mutateAsync({ id, data: patch })
                }
                // deleteEntity not implemented for MVP
            },
            helpers: {
                refreshList: async () => {
                    await queryClient.invalidateQueries({
                        queryKey: instancesQueryKeys.lists()
                    })
                },
                confirm: async (spec: {
                    titleKey?: string
                    descriptionKey?: string
                    title?: string
                    description?: string
                    confirmKey?: string
                    cancelKey?: string
                    confirmButtonName?: string
                    cancelButtonName?: string
                    interpolate?: Record<string, string>
                }) => {
                    const confirmed = await confirm({
                        title: spec.titleKey ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title || '',
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : spec.description || '',
                        confirmButtonName: spec.confirmKey
                            ? baseContext.t(spec.confirmKey)
                            : spec.confirmButtonName || baseContext.t('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? baseContext.t(spec.cancelKey)
                            : spec.cancelButtonName || baseContext.t('confirm.delete.cancel')
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
                }
            }
        }),
        [confirm, enqueueSnackbar, queryClient, updateInstanceMutation]
    )

    // Get instance actions with delete disabled for MVP
    const instanceActions = useMemo(() => getInstanceActions(), [])

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
                    title={t('instances.error', 'Failed to load instances')}
                    description={
                        !(error as { response?: { status?: number } })?.response?.status
                            ? t('errors.checkConnection', 'Check your connection')
                            : t('errors.pleaseTryLater', 'Please try again later')
                    }
                    action={{
                        label: t('actions.retry', 'Retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('instances.searchPlaceholder', 'Search instances...')}
                        onSearchChange={handleSearchChange}
                        title={t('instances.title', 'Instances')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView', 'Card View')}
                            listViewTitle={tc('listView', 'List View')}
                            primaryAction={{
                                label: tc('addNew', 'Add'),
                                // MVP: Button disabled - remote instances will be available in future versions
                                onClick: () => {},
                                startIcon: <AddRoundedIcon />,
                                disabled: true
                            }}
                        />
                    </ViewHeader>

                    {isLoading && instances.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && instances.length === 0 ? (
                        <EmptyListState image={APIEmptySVG} imageAlt='No instances' title={t('instances.empty', 'No instances found')} />
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
                                    {instances.map((instance: Instance) => (
                                        <ItemCard
                                            key={instance.id}
                                            data={instance}
                                            images={images[instance.id] || []}
                                            href={`/admin/instance/${instance.id}`}
                                            footerStartContent={
                                                <Stack direction='row' spacing={0.5} alignItems='center'>
                                                    {instance.is_local ? (
                                                        <DnsRoundedIcon color='primary' fontSize='small' />
                                                    ) : (
                                                        <CloudOffRoundedIcon color='disabled' fontSize='small' />
                                                    )}
                                                    <LocalChip isLocal={instance.is_local} t={t} />
                                                </Stack>
                                            }
                                            footerEndContent={<StatusChip status={instance.status} t={t} />}
                                            headerAction={
                                                instanceActions.length > 0 ? (
                                                    <Box onClick={(e) => e.stopPropagation()}>
                                                        <BaseEntityMenu<Instance, InstanceData>
                                                            entity={instance}
                                                            entityKind='instance'
                                                            descriptors={instanceActions}
                                                            namespace='admin'
                                                            i18nInstance={i18n}
                                                            createContext={createInstanceContext}
                                                            renderTrigger={(props: TriggerProps) => (
                                                                <IconButton
                                                                    size='small'
                                                                    sx={{
                                                                        color: 'text.secondary',
                                                                        width: 28,
                                                                        height: 28,
                                                                        p: 0.25
                                                                    }}
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
                                    ))}
                                </Box>
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    <FlowListTable
                                        data={instances}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: Instance) => (row?.id ? `/admin/instance/${row.id}` : undefined)}
                                        customColumns={instanceColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: Instance) => {
                                            if (!instanceActions.length) return null

                                            return (
                                                <BaseEntityMenu<Instance, InstanceData>
                                                    entity={row}
                                                    entityKind='instance'
                                                    descriptors={instanceActions}
                                                    namespace='admin'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createInstanceContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* MVP Notice - shown above pagination only when data exists */}
                    {!isLoading && instances.length > 0 && (
                        <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                            <Alert severity='info'>
                                {t('instances.mvpNotice', 'Remote instances management will be available in future versions.')}
                            </Alert>
                        </Box>
                    )}

                    {/* Table Pagination at bottom - only show when there's data */}
                    {!isLoading && instances.length > 0 && (
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

            <ConfirmDialog />
        </MainCard>
    )
}

export default InstanceList
