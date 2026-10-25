import type { ReactNode } from 'react'
import { Alert, Box, Chip, CircularProgress, Stack, Tooltip } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import {
    FlowListTable,
    ItemCard,
    PaginationControls,
    ToolbarControls,
    ViewHeaderMUI as ViewHeader,
    type TableColumn
} from '../components/runtime-ui'
import {
    PAGE_SIZE_OPTIONS,
    readInputChangeValue,
    resolveWorkspaceRoleLabel,
    toPagination,
    toPaginationActions
} from './runtimeWorkspaceHelpers'
import type { WorkspaceViewMode, WorkspaceViewRow } from './runtimeWorkspaceTypes'

type RuntimeWorkspaceListProps = {
    rows: WorkspaceViewRow[]
    columns: TableColumn<WorkspaceViewRow>[]
    isError: boolean
    isLoading: boolean
    isFetching: boolean
    searchValue: string
    onSearchChange: (value: string) => void
    viewMode: WorkspaceViewMode
    onViewModeChange: (mode: WorkspaceViewMode) => void
    canCreate: boolean
    onCreate: () => void
    onOpen: (workspace: WorkspaceViewRow) => void
    renderActions: (workspace: WorkspaceViewRow) => ReactNode
    limit: number
    offset: number
    total: number
    onLimitChange: (limit: number) => void
    onOffsetChange: (offset: number) => void
    onPaginationSearchChange: (search: string) => void
}

export function RuntimeWorkspaceList({
    rows,
    columns,
    isError,
    isLoading,
    isFetching,
    searchValue,
    onSearchChange,
    viewMode,
    onViewModeChange,
    canCreate,
    onCreate,
    onOpen,
    renderActions,
    limit,
    offset,
    total,
    onLimitChange,
    onOffsetChange,
    onPaginationSearchChange
}: RuntimeWorkspaceListProps) {
    const { t } = useTranslation('apps')

    return (
        <>
            <ViewHeader
                title={t('workspace.title', 'Workspaces')}
                search
                searchValue={searchValue}
                searchPlaceholder={t('workspace.searchPlaceholder', 'Search workspaces')}
                onSearchChange={(event) => onSearchChange(readInputChangeValue(event))}
                controlsWrap
            >
                <ToolbarControls
                    viewToggleEnabled
                    viewMode={viewMode}
                    onViewModeChange={onViewModeChange}
                    cardViewTitle={t('toolbar.cardView', 'Card view')}
                    listViewTitle={t('toolbar.tableView', 'Table view')}
                    primaryAction={
                        canCreate
                            ? {
                                  label: t('app.create', 'Create'),
                                  startIcon: <AddRoundedIcon />,
                                  onClick: onCreate
                              }
                            : undefined
                    }
                />
            </ViewHeader>

            <Box sx={{ mt: 3 }}>
                {isError ? (
                    <Alert severity='error'>{t('workspace.errorLoad', 'Failed to load workspaces')}</Alert>
                ) : isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        {rows.length === 0 ? <Alert severity='info'>{t('workspace.noWorkspaces')}</Alert> : null}
                        {viewMode === 'card' ? (
                            <Box
                                data-testid='runtime-workspaces-card-view'
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
                                    gap: 2
                                }}
                            >
                                {rows.map((workspace) => (
                                    <Box
                                        key={workspace.id}
                                        data-testid='runtime-workspace-card'
                                        data-workspace-id={workspace.id}
                                        sx={{ minWidth: 0 }}
                                    >
                                        <ItemCard
                                            data={workspace}
                                            allowStretch
                                            onClick={() => onOpen(workspace)}
                                            headerAction={renderActions(workspace)}
                                            titleEndContent={
                                                workspace.isDefault ? (
                                                    <Tooltip title={t('workspace.default', 'Default')}>
                                                        <StarRoundedIcon
                                                            fontSize='small'
                                                            color='primary'
                                                            aria-label={t('workspace.default', 'Default')}
                                                        />
                                                    </Tooltip>
                                                ) : null
                                            }
                                            footerStartContent={
                                                <Chip
                                                    size='small'
                                                    variant='outlined'
                                                    label={resolveWorkspaceRoleLabel(workspace.roleCodename, t)}
                                                />
                                            }
                                        />
                                    </Box>
                                ))}
                            </Box>
                        ) : (
                            <FlowListTable
                                data={rows}
                                customColumns={columns}
                                isLoading={isFetching}
                                renderActions={(row) => (
                                    <Stack direction='row' spacing={1} sx={{ justifyContent: 'flex-end' }}>
                                        {renderActions(row)}
                                    </Stack>
                                )}
                            />
                        )}

                        <PaginationControls
                            namespace='apps'
                            rowsPerPageOptions={PAGE_SIZE_OPTIONS}
                            pagination={toPagination(limit, offset, total)}
                            actions={toPaginationActions(limit, offset, onLimitChange, onOffsetChange, onPaginationSearchChange)}
                            isLoading={isFetching}
                        />
                    </Stack>
                )}
            </Box>
        </>
    )
}
