import type { ChangeEvent, ReactNode } from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import type { PendingAction } from '@universo/utils'
import { APIEmptySVG } from '../../assets'
import { EmptyListState, SkeletonGrid } from '../feedback'
import { FlowListTable } from '../table/FlowListTable'
import ToolbarControls from '../toolbar/ToolbarControls'
import ViewHeaderMUI from '../headers/ViewHeader'
import ItemCard from '../cards/ItemCard'
import { gridSpacing } from '../../constants'

export type LayoutAuthoringListItem = {
    id: string
    title: string
    description?: string
    meta?: string
    metaContent?: ReactNode
    titleContent?: ReactNode
    descriptionContent?: ReactNode
    statusContent: ReactNode
    headerAction?: ReactNode
    rowAction?: ReactNode
    rowHref?: string
    onClick?: () => void
    pending?: boolean
    pendingAction?: PendingAction | null
    onPendingInteractionAttempt?: () => void
}

export type LayoutAuthoringListProps = {
    title?: string
    description?: string
    search?: boolean
    searchPlaceholder?: string
    onSearchChange?: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
    adaptiveSearch?: boolean
    controlsAlign?: 'start' | 'end'
    toolbarSx?: SxProps<Theme>
    headerExtras?: ReactNode
    primaryAction?: {
        label: string
        onClick: () => void
    }
    viewMode: 'card' | 'list'
    onViewModeChange: (mode: 'card' | 'list') => void
    cardViewTitle: string
    listViewTitle: string
    loading?: boolean
    items: LayoutAuthoringListItem[]
    error?: boolean
    errorTitle: string
    errorDescription?: string
    retryLabel?: string
    onRetry?: () => void
    emptyTitle: string
    emptyDescription?: string
    metaColumnLabel: string
    statusColumnLabel: string
    listContentTestId: string
    footerContent?: ReactNode
}

export function LayoutAuthoringList({
    title,
    description,
    search = true,
    searchPlaceholder,
    onSearchChange,
    adaptiveSearch = false,
    controlsAlign = 'start',
    toolbarSx,
    headerExtras,
    primaryAction,
    viewMode,
    onViewModeChange,
    cardViewTitle,
    listViewTitle,
    loading = false,
    items,
    error = false,
    errorTitle,
    errorDescription,
    retryLabel,
    onRetry,
    emptyTitle,
    emptyDescription,
    metaColumnLabel,
    statusColumnLabel,
    listContentTestId,
    footerContent
}: LayoutAuthoringListProps) {
    const columns = [
        {
            id: 'name',
            label: 'Name',
            width: '25%',
            align: 'left' as const,
            render: (row: LayoutAuthoringListItem) => row.titleContent ?? row.title
        },
        {
            id: 'description',
            label: 'Description',
            width: '30%',
            align: 'left' as const,
            render: (row: LayoutAuthoringListItem) => row.descriptionContent ?? row.description ?? '—'
        },
        {
            id: 'meta',
            label: metaColumnLabel,
            width: '15%',
            align: 'left' as const,
            render: (row: LayoutAuthoringListItem) => row.metaContent ?? row.meta ?? '—'
        },
        {
            id: 'status',
            label: statusColumnLabel,
            width: '30%',
            align: 'left' as const,
            render: (row: LayoutAuthoringListItem) => row.statusContent
        }
    ]

    return (
        <>
            <ViewHeaderMUI
                search={search}
                title={title}
                description={description}
                searchPlaceholder={searchPlaceholder}
                onSearchChange={onSearchChange}
                adaptiveSearch={adaptiveSearch}
                controlsAlign={controlsAlign}
            >
                <ToolbarControls
                    viewToggleEnabled
                    viewMode={viewMode}
                    onViewModeChange={(mode: string) => onViewModeChange(mode === 'list' ? 'list' : 'card')}
                    cardViewTitle={cardViewTitle}
                    listViewTitle={listViewTitle}
                    sx={toolbarSx}
                    primaryAction={
                        primaryAction
                            ? {
                                  label: primaryAction.label,
                                  onClick: primaryAction.onClick,
                                  startIcon: <AddRoundedIcon />
                              }
                            : undefined
                    }
                />
                {headerExtras}
            </ViewHeaderMUI>

            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt={errorTitle}
                    title={errorTitle}
                    description={errorDescription}
                    action={onRetry ? { label: retryLabel || 'Retry', onClick: onRetry } : undefined}
                />
            ) : loading && items.length === 0 ? (
                viewMode === 'card' ? (
                    <SkeletonGrid insetMode='content' />
                ) : (
                    <Box sx={{ height: 120, border: 1, borderColor: 'divider', borderRadius: 1 }} />
                )
            ) : items.length === 0 ? (
                <EmptyListState image={APIEmptySVG} imageAlt={emptyTitle} title={emptyTitle} description={emptyDescription} />
            ) : viewMode === 'card' ? (
                <Box
                    data-testid={listContentTestId}
                    sx={{
                        display: 'grid',
                        gap: gridSpacing,
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
                            lg: 'repeat(auto-fit, minmax(260px, 1fr))'
                        }
                    }}
                >
                    {items.map((item) => (
                        <ItemCard
                            key={item.id}
                            data={{ id: item.id, name: item.title, description: item.description ?? '' }}
                            onClick={item.onClick}
                            pending={item.pending}
                            pendingAction={item.pendingAction ?? undefined}
                            onPendingInteractionAttempt={item.onPendingInteractionAttempt}
                            footerEndContent={item.statusContent}
                            headerAction={item.headerAction}
                        />
                    ))}
                </Box>
            ) : (
                <Box data-testid={listContentTestId}>
                    <FlowListTable
                        data={items}
                        images={{}}
                        isLoading={loading}
                        getRowLink={(row: LayoutAuthoringListItem) => row.rowHref}
                        onPendingInteractionAttempt={(row: LayoutAuthoringListItem) => row.onPendingInteractionAttempt?.()}
                        customColumns={columns}
                        i18nNamespace='flowList'
                        renderActions={(row: LayoutAuthoringListItem) => row.rowAction ?? null}
                    />
                </Box>
            )}

            {footerContent}
        </>
    )
}

export default LayoutAuthoringList
