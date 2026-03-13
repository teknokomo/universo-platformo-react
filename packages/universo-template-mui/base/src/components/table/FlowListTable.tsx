import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { formatDate, getPendingAction, isPendingEntity, isPendingInteractionBlocked, shouldShowPendingFeedback } from '@universo/utils'
import { alpha, styled } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import {
    Box,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    Typography,
    useTheme
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import i18n from '@universo/i18n'
import { Link } from 'react-router-dom'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { SortableTableRow, SortableTableBody, InternalDndWrapper } from './FlowListTableDnd'
import { pendingRowSx } from '../../styles/pendingAnimations'

import type { StyledComponent } from '@emotion/styled'
import type { TableCellProps, TableRowProps } from '@mui/material'

export const StyledTableCell: StyledComponent<TableCellProps & { theme?: Theme }> = styled(TableCell)(({ theme }) => ({
    borderColor: (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08),

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    },
    // Compact mode: reduced heights applied via parent table className
    'table.FlowListTable-compact &': {
        [`&.${tableCellClasses.body}`]: {
            height: 40,
            fontSize: 13,
            padding: '4px 8px'
        },
        [`&.${tableCellClasses.head}`]: {
            padding: '4px 8px',
            fontSize: 13
        }
    }
}))

export const StyledTableRow: StyledComponent<TableRowProps & { theme?: Theme }> = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

// Generic data interface - requires at least id and name
export interface FlowListTableData {
    id: string
    name?: string
    templateName?: string
    updatedDate?: string
    updated_at?: string
    updatedAt?: string
    updatedOn?: string
    [key: string]: any
}

// Column definition with generic type support
export interface TableColumn<T extends FlowListTableData> {
    id: string
    label?: React.ReactNode
    width?: string | number
    align?: 'inherit' | 'left' | 'center' | 'right' | 'justify'
    render?: (row: T, index: number) => React.ReactNode
    sortable?: boolean
    sortAccessor?: (row: T) => string | number | null | undefined
}

export interface FlowListTableProps<T extends FlowListTableData = FlowListTableData> {
    data?: T[]
    images?: Record<string, any[]>
    isLoading?: boolean
    filterFunction?: (row: T) => boolean
    updateFlowsApi?: any
    setError?: (error: any) => void
    isAgentCanvas?: boolean
    isUnikTable?: boolean
    renderActions?: (row: T) => React.ReactNode
    getRowLink?: (row: T) => string | undefined
    customColumns?: TableColumn<T>[]
    i18nNamespace?: string
    /** Render expansion content below a row. Return null to skip. */
    renderRowExpansion?: (row: T, index: number) => React.ReactNode | null
    /** Compact mode: reduced row heights and font sizes */
    compact?: boolean

    // ── DnD support ──────────────────────────────────────────────────────
    /** Enable drag-and-drop row reordering. Adds a drag handle column and makes rows sortable. */
    sortableRows?: boolean
    /** Item IDs for SortableContext. Defaults to data.map(d => d.id) when sortableRows=true. */
    sortableItemIds?: string[]
    /** Container ID for useDroppable (for multi-container DnD with external DndContext). */
    droppableContainerId?: string
    /**
     * When true, FlowListTable does NOT create its own DndContext.
     * Use this when an external DndContext (e.g. a cross-list DnD provider) wraps the table.
     */
    externalDndContext?: boolean
    /** Called on drag end. Only used when externalDndContext is falsy. */
    onSortableDragEnd?: (event: DragEndEvent) => void
    /** Called on drag start. Only used when externalDndContext is falsy. */
    onSortableDragStart?: (event: DragStartEvent) => void
    /** Called on drag over. Only used when externalDndContext is falsy. */
    onSortableDragOver?: (event: DragOverEvent) => void
    /** Called on drag cancel. Only used when externalDndContext is falsy. */
    onSortableDragCancel?: () => void
    /** Render drag overlay content. Only used when externalDndContext is falsy. */
    renderDragOverlay?: (activeId: string | null) => React.ReactNode
    /** Accessible label for drag handle cells. */
    dragHandleAriaLabel?: string
    /** Disable all drag handles (e.g. during loading). */
    dragDisabled?: boolean
    /** Visual indicator that this table is a DnD drop target (e.g. during cross-list drag). */
    isDropTarget?: boolean
    /** Visual indicator that current DnD drop target is invalid (e.g. limit reached). */
    isDropTargetInvalid?: boolean
    /** Message to display when data is empty. Maintains droppable zone height for DnD. */
    emptyStateMessage?: string
    /** Called when a user tries to open an optimistic create/copy row before it is ready. */
    onPendingInteractionAttempt?: (row: T) => void
}

const getLocalStorageKeyName = (name: string, isAgentCanvas?: boolean): string => {
    if (isAgentCanvas) {
        return `agentcanvas_${name}`
    }
    return `canvaslist_${name}`
}

export const FlowListTable = <T extends FlowListTableData = FlowListTableData>({
    data,
    images,
    isLoading,
    filterFunction,
    updateFlowsApi,
    setError,
    isAgentCanvas,
    isUnikTable,
    renderActions,
    getRowLink,
    customColumns,
    i18nNamespace = 'flowList',
    renderRowExpansion,
    compact = false,
    // DnD props
    sortableRows = false,
    sortableItemIds,
    droppableContainerId,
    externalDndContext = false,
    onSortableDragEnd,
    onSortableDragStart,
    onSortableDragOver,
    onSortableDragCancel,
    renderDragOverlay,
    dragHandleAriaLabel,
    dragDisabled = false,
    isDropTarget = false,
    isDropTargetInvalid = false,
    emptyStateMessage,
    onPendingInteractionAttempt
}: FlowListTableProps<T>): React.ReactElement => {
    const { t } = useTranslation(i18nNamespace, { i18n })
    const theme = useTheme()
    const customization = useSelector((state: any) => state.customization)

    const localStorageKeyOrder = getLocalStorageKeyName('order', isAgentCanvas)
    const localStorageKeyOrderBy = getLocalStorageKeyName('orderBy', isAgentCanvas)

    const [order, setOrder] = useState<'asc' | 'desc'>((localStorage.getItem(localStorageKeyOrder) as 'asc' | 'desc') || 'desc')
    const [orderBy, setOrderBy] = useState<string>(localStorage.getItem(localStorageKeyOrderBy) || 'updatedDate')

    const handleRequestSort = (property: string) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder: 'asc' | 'desc' = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const resolveUpdatedDate = (item: T): string | undefined => item?.updatedDate || item?.updated_at || item?.updatedAt || item?.updatedOn

    const columnsToRender = !isUnikTable && Array.isArray(customColumns) && customColumns.length > 0 ? customColumns : null
    const activeSortableColumn = columnsToRender?.find((column) => column.sortable && column.id === orderBy) ?? null

    const sortedData = data
        ? [...data].sort((a, b) => {
              if (activeSortableColumn) {
                  const rawA = activeSortableColumn.sortAccessor
                      ? activeSortableColumn.sortAccessor(a)
                      : (a as any)?.[activeSortableColumn.id]
                  const rawB = activeSortableColumn.sortAccessor
                      ? activeSortableColumn.sortAccessor(b)
                      : (b as any)?.[activeSortableColumn.id]
                  const valueA = typeof rawA === 'string' ? rawA.toLowerCase() : rawA ?? ''
                  const valueB = typeof rawB === 'string' ? rawB.toLowerCase() : rawB ?? ''
                  if (valueA < valueB) return order === 'asc' ? -1 : 1
                  if (valueA > valueB) return order === 'asc' ? 1 : -1
                  return 0
              }

              if (sortableRows) {
                  return 0
              }

              const resolvedOrderBy = orderBy === 'name' || orderBy === 'updatedDate' ? orderBy : 'updatedDate'
              if (resolvedOrderBy === 'name') {
                  return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')
              }
              if (resolvedOrderBy === 'updatedDate') {
                  const dateA = resolveUpdatedDate(a)
                  const dateB = resolveUpdatedDate(b)
                  const parsedA = dateA ? new Date(dateA).getTime() : 0
                  const parsedB = dateB ? new Date(dateB).getTime() : 0
                  return order === 'asc' ? parsedA - parsedB : parsedB - parsedA
              }
              return 0
          })
        : []

    const buildEntityLink = (row: T): string | undefined => {
        if (typeof getRowLink === 'function') {
            return getRowLink(row)
        }

        if (isUnikTable) {
            return `/unik/${row.id}`
        }

        return `/${isAgentCanvas ? 'agentcanvas' : 'canvas'}/${row.id}`
    }

    const borderColor = (theme as any).vars?.palette?.outline ?? alpha(theme.palette.text.primary, 0.08)

    const activeFilter = typeof filterFunction === 'function' ? filterFunction : () => true
    const filteredSortedData = (sortedData || []).filter(activeFilter)
    // Effective item IDs for SortableContext must follow the actual rendered row order.
    // When callers pass sortableItemIds, treat them as the allowed DnD set, but preserve the table's visible order.
    const effectiveSortableIds = sortableRows
        ? filteredSortedData.map((row) => row.id).filter((id) => !sortableItemIds || sortableItemIds.includes(id))
        : []

    const getPendingRowStyles = (row: T) => {
        if (!isPendingEntity(row)) return undefined
        const action = getPendingAction(row)

        // Delete: visual fade-out + line-through + disable interaction
        if (action === 'delete') {
            return {
                opacity: 0.4,
                pointerEvents: 'none' as const,
                textDecoration: 'line-through',
                transition: 'opacity 0.3s ease-out'
            }
        }

        // Create/copy: show running shimmer bar after user clicks the pending row (deferred feedback)
        if ((action === 'create' || action === 'copy') && shouldShowPendingFeedback(row)) {
            return pendingRowSx
        }

        // Create/update/copy without deferred feedback: row looks 100% normal
        return undefined
    }

    const tableElement = (
        <TableContainer
            sx={{
                border: 1,
                borderColor: isDropTargetInvalid ? 'error.main' : isDropTarget ? 'primary.main' : borderColor,
                borderRadius: 1,
                ...((isDropTarget || isDropTargetInvalid) && {
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    backgroundColor: (th: any) =>
                        isDropTargetInvalid ? alpha(th.palette.error.main, 0.08) : alpha(th.palette.primary.main, 0.04),
                    transition: 'border-color 0.2s, background-color 0.2s',
                    // Prevent horizontal scrollbar jitter when a wider ghost row
                    // is injected during cross-list DnD (e.g. root → child table).
                    overflowX: 'hidden'
                })
            }}
            component={Paper}
        >
            <Table
                sx={{ minWidth: compact ? 400 : 900 }}
                size='small'
                aria-label='a dense table'
                className={compact ? 'FlowListTable-compact' : undefined}
            >
                {/* Hide table header when showing empty state placeholder */}
                {!(emptyStateMessage && !isLoading && filteredSortedData.length === 0) && (
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: compact ? 36 : 56
                        }}
                    >
                        <TableRow>
                            {/* Drag handle column header (when DnD enabled) */}
                            {sortableRows && <StyledTableCell align='center' sx={{ width: 40 }} />}
                            {columnsToRender ? (
                                <>
                                    {columnsToRender.map((column) => (
                                        <StyledTableCell
                                            key={column.id}
                                            style={{ width: column.width || '25%' }}
                                            align={column.align || 'left'}
                                        >
                                            {column.sortable ? (
                                                <TableSortLabel
                                                    active={orderBy === column.id}
                                                    direction={order}
                                                    onClick={() => handleRequestSort(column.id)}
                                                    sx={
                                                        column.align === 'center'
                                                            ? {
                                                                  display: 'inline-flex',
                                                                  alignItems: 'center',
                                                                  justifyContent: 'center',
                                                                  width: '100%',
                                                                  '& .MuiTableSortLabel-icon': {
                                                                      marginLeft: 0.5,
                                                                      marginRight: 0
                                                                  }
                                                              }
                                                            : undefined
                                                    }
                                                >
                                                    {column.label}
                                                </TableSortLabel>
                                            ) : (
                                                column.label
                                            )}
                                        </StyledTableCell>
                                    ))}
                                    {renderActions && (
                                        <StyledTableCell style={{ width: '10%' }} key='actions' align='center'>
                                            {t('common:columns.actions')}
                                        </StyledTableCell>
                                    )}
                                </>
                            ) : (
                                <>
                                    <StyledTableCell component='th' scope='row' style={{ width: '20%' }} key='0'>
                                        <TableSortLabel
                                            active={orderBy === 'name'}
                                            direction={order}
                                            onClick={() => handleRequestSort('name')}
                                        >
                                            {t('common:columns.name')}
                                        </TableSortLabel>
                                    </StyledTableCell>
                                    {isUnikTable ? (
                                        <StyledTableCell style={{ width: '55%' }} key='1'>
                                            {t('common:columns.spaces')}
                                        </StyledTableCell>
                                    ) : (
                                        <>
                                            <StyledTableCell style={{ width: '25%' }} key='1'>
                                                {t('common:columns.category')}
                                            </StyledTableCell>
                                            <StyledTableCell style={{ width: '30%' }} key='2'>
                                                {t('common:columns.nodes')}
                                            </StyledTableCell>
                                        </>
                                    )}
                                    <StyledTableCell style={{ width: '14%' }} key='3'>
                                        <TableSortLabel
                                            active={orderBy === 'updatedDate'}
                                            direction={order}
                                            onClick={() => handleRequestSort('updatedDate')}
                                        >
                                            {t('common:columns.lastModified')}
                                        </TableSortLabel>
                                    </StyledTableCell>
                                    <StyledTableCell style={{ width: '10%' }} key='4'>
                                        {t('common:columns.actions')}
                                    </StyledTableCell>
                                </>
                            )}
                        </TableRow>
                    </TableHead>
                )}
                {/* ── Table Body ─────────────────────────────────────── */}
                {(() => {
                    // Shared rendering logic for row cells (used by both normal and sortable paths)
                    const displayData = filteredSortedData

                    const renderRowCells = (row: T, index: number) => {
                        const rowPending = isPendingEntity(row)
                        const interactionBlocked = isPendingInteractionBlocked(row)
                        const linkTarget = rowPending ? undefined : buildEntityLink(row)
                        const displayName = row.templateName || row.name
                        const normalizedUpdatedDate = resolveUpdatedDate(row)

                        if (columnsToRender) {
                            return (
                                <>
                                    {columnsToRender.map((column) => (
                                        <StyledTableCell key={column.id} align={column.align || 'left'}>
                                            {column.render ? column.render(row, index) : null}
                                        </StyledTableCell>
                                    ))}
                                    {renderActions && (
                                        <StyledTableCell key='actions' align='center'>
                                            <Box
                                                onClickCapture={
                                                    interactionBlocked && onPendingInteractionAttempt
                                                        ? (event) => {
                                                              event.preventDefault()
                                                              event.stopPropagation()
                                                              onPendingInteractionAttempt(row)
                                                          }
                                                        : undefined
                                                }
                                                sx={interactionBlocked ? { cursor: 'wait' } : undefined}
                                            >
                                                <Stack
                                                    direction={{ xs: 'column', sm: 'row' }}
                                                    spacing={1}
                                                    justifyContent='center'
                                                    alignItems='center'
                                                    sx={interactionBlocked ? { opacity: 0.72 } : undefined}
                                                >
                                                    {renderActions(row)}
                                                </Stack>
                                            </Box>
                                        </StyledTableCell>
                                    )}
                                </>
                            )
                        }

                        // Default columns (name, category/spaces, nodes, date, actions)
                        return (
                            <>
                                <StyledTableCell key='0'>
                                    {interactionBlocked && onPendingInteractionAttempt ? (
                                        <Typography
                                            component='button'
                                            type='button'
                                            onClick={(event) => {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                onPendingInteractionAttempt(row)
                                            }}
                                            sx={{
                                                fontSize: 14,
                                                fontWeight: 500,
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word',
                                                color: 'primary.main',
                                                background: 'transparent',
                                                border: 0,
                                                p: 0,
                                                m: 0,
                                                textAlign: 'left',
                                                cursor: 'wait'
                                            }}
                                        >
                                            {displayName}
                                        </Typography>
                                    ) : (
                                        <Typography
                                            sx={{
                                                fontSize: 14,
                                                fontWeight: 500,
                                                wordBreak: 'break-word',
                                                overflowWrap: 'break-word'
                                            }}
                                        >
                                            {linkTarget ? (
                                                <Link to={linkTarget} style={{ color: '#2196f3', textDecoration: 'none' }}>
                                                    {displayName}
                                                </Link>
                                            ) : (
                                                displayName
                                            )}
                                        </Typography>
                                    )}
                                </StyledTableCell>
                                {isUnikTable ? (
                                    <StyledTableCell key='1'>
                                        <Typography sx={{ fontSize: 14 }}>
                                            {(row as any).spacesCount != null ? (row as any).spacesCount : 0}
                                        </Typography>
                                    </StyledTableCell>
                                ) : (
                                    <>
                                        <StyledTableCell key='1'>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'row',
                                                    flexWrap: 'wrap',
                                                    marginTop: 5
                                                }}
                                            >
                                                &nbsp;
                                                {(row as any).category &&
                                                    (row as any).category
                                                        .split(';')
                                                        .map((tag: string, tagIndex: number) => (
                                                            <Chip key={tagIndex} label={tag} style={{ marginRight: 5, marginBottom: 5 }} />
                                                        ))}
                                            </div>
                                        </StyledTableCell>
                                        <StyledTableCell key='2'>
                                            {images && images[row.id] && (
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'start',
                                                        gap: 1
                                                    }}
                                                >
                                                    {images[row.id]
                                                        .slice(0, images[row.id].length > 5 ? 5 : images[row.id].length)
                                                        .map((img: any) => (
                                                            <Box
                                                                key={img}
                                                                sx={{
                                                                    width: 30,
                                                                    height: 30,
                                                                    borderRadius: '50%',
                                                                    backgroundColor: customization.isDarkMode
                                                                        ? theme.palette.common.white
                                                                        : theme.palette.grey[300] + 75
                                                                }}
                                                            >
                                                                <img
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        padding: 5,
                                                                        objectFit: 'contain'
                                                                    }}
                                                                    alt=''
                                                                    src={img}
                                                                />
                                                            </Box>
                                                        ))}
                                                    {images[row.id].length > 5 && (
                                                        <Typography
                                                            sx={{
                                                                alignItems: 'center',
                                                                display: 'flex',
                                                                fontSize: '.9rem',
                                                                fontWeight: 200
                                                            }}
                                                        >
                                                            {t('common:more', { count: images[row.id].length - 5 })}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </StyledTableCell>
                                    </>
                                )}
                                <StyledTableCell key='3'>{formatDate(normalizedUpdatedDate, 'full')}</StyledTableCell>
                                <StyledTableCell key='4'>
                                    <Box
                                        onClickCapture={
                                            interactionBlocked && onPendingInteractionAttempt
                                                ? (event) => {
                                                      event.preventDefault()
                                                      event.stopPropagation()
                                                      onPendingInteractionAttempt(row)
                                                  }
                                                : undefined
                                        }
                                        sx={interactionBlocked ? { cursor: 'wait' } : undefined}
                                    >
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            justifyContent='center'
                                            alignItems='center'
                                            sx={interactionBlocked ? { opacity: 0.72 } : undefined}
                                        >
                                            {renderActions ? renderActions(row) : null}
                                        </Stack>
                                    </Box>
                                </StyledTableCell>
                            </>
                        )
                    }

                    // Total column count (for expansion row colSpan)
                    const totalCols = (columnsToRender?.length ?? 5) + (renderActions ? 1 : 0) + (sortableRows ? 1 : 0)

                    // Loading skeleton
                    const skeletonContent = (
                        <>
                            <StyledTableRow>
                                {sortableRows && (
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                )}
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                            </StyledTableRow>
                            <StyledTableRow>
                                {sortableRows && (
                                    <StyledTableCell>
                                        <Skeleton variant='text' />
                                    </StyledTableCell>
                                )}
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                                <StyledTableCell>
                                    <Skeleton variant='text' />
                                </StyledTableCell>
                            </StyledTableRow>
                        </>
                    )

                    // Data rows
                    const dataRows = displayData.map((row, index) => {
                        const rowPending = isPendingEntity(row)
                        const interactionBlocked = isPendingInteractionBlocked(row)
                        const expansionContent = renderRowExpansion ? renderRowExpansion(row, index) : null
                        const hasExpansion = Boolean(expansionContent)
                        const pendingRowInteractionProps =
                            interactionBlocked && onPendingInteractionAttempt
                                ? {
                                      onClickCapture: (event: React.MouseEvent<HTMLTableRowElement>) => {
                                          event.preventDefault()
                                          event.stopPropagation()
                                          onPendingInteractionAttempt(row)
                                      },
                                      onMouseDownCapture: (event: React.MouseEvent<HTMLTableRowElement>) => {
                                          event.preventDefault()
                                          event.stopPropagation()
                                      }
                                  }
                                : undefined
                        const rowPendingStyles = getPendingRowStyles(row)
                        const blockedPendingRowStyle = interactionBlocked ? { cursor: 'wait' as const } : undefined

                        const rowContent = (
                            <React.Fragment key={row.id}>
                                {sortableRows ? (
                                    <SortableTableRow
                                        id={row.id}
                                        disabled={dragDisabled || rowPending}
                                        hasExpansion={hasExpansion}
                                        dragHandleAriaLabel={dragHandleAriaLabel}
                                        sx={rowPendingStyles}
                                        rowStyle={blockedPendingRowStyle}
                                        onClickCapture={pendingRowInteractionProps?.onClickCapture}
                                        onMouseDownCapture={pendingRowInteractionProps?.onMouseDownCapture}
                                    >
                                        {renderRowCells(row, index)}
                                    </SortableTableRow>
                                ) : (
                                    <StyledTableRow
                                        style={blockedPendingRowStyle}
                                        onClickCapture={pendingRowInteractionProps?.onClickCapture}
                                        onMouseDownCapture={pendingRowInteractionProps?.onMouseDownCapture}
                                        sx={
                                            hasExpansion
                                                ? { '& td, & th': { borderBottom: 0 }, ...(rowPendingStyles ?? {}) }
                                                : rowPendingStyles
                                        }
                                    >
                                        {renderRowCells(row, index)}
                                    </StyledTableRow>
                                )}
                                {expansionContent && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={totalCols}
                                            sx={{ py: 0, px: 0, borderBottom: '1px solid', borderColor: 'divider' }}
                                        >
                                            {expansionContent}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        )
                        return rowContent
                    })

                    // Empty state row — maintains droppable zone height when no data rows
                    const emptyRow =
                        !isLoading && displayData.length === 0 && emptyStateMessage ? (
                            <TableRow>
                                <TableCell colSpan={totalCols} sx={{ textAlign: 'center', py: 3, borderBottom: 'none' }}>
                                    <Typography variant='body2' color='text.secondary'>
                                        {emptyStateMessage}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : null

                    const bodyContent = isLoading ? skeletonContent : dataRows.length > 0 ? dataRows : emptyRow

                    // Wrap in SortableTableBody or plain TableBody
                    if (sortableRows) {
                        return (
                            <SortableTableBody itemIds={effectiveSortableIds} droppableContainerId={droppableContainerId}>
                                {bodyContent}
                            </SortableTableBody>
                        )
                    }
                    return <TableBody>{bodyContent}</TableBody>
                })()}
            </Table>
        </TableContainer>
    )

    // When DnD is enabled and no external DndContext, wrap with InternalDndWrapper
    if (sortableRows && !externalDndContext) {
        return (
            <InternalDndWrapper
                onDragStart={onSortableDragStart}
                onDragEnd={onSortableDragEnd}
                onDragOver={onSortableDragOver}
                onDragCancel={onSortableDragCancel}
                renderDragOverlay={renderDragOverlay}
            >
                {tableElement}
            </InternalDndWrapper>
        )
    }

    return tableElement
}

export default FlowListTable
