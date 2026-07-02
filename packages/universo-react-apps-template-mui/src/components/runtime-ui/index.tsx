import { isValidElement, useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import ViewColumnRoundedIcon from '@mui/icons-material/ViewColumnRounded'
import ViewComfyRoundedIcon from '@mui/icons-material/ViewComfyRounded'
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded'
import { alpha, styled } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import Checkbox from '@mui/material/Checkbox'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import ListItemText from '@mui/material/ListItemText'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import { tableCellClasses } from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Toolbar from '@mui/material/Toolbar'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import i18n from '@universo-react/i18n'
import { formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'

export interface ItemCardData {
    id?: string
    iconSrc?: string
    color?: string
    templateName?: string
    name?: string
    displayName?: string
    description?: string
}

export interface ItemCardProps<T extends ItemCardData = ItemCardData> {
    data: T
    images?: string[]
    onClick?: () => void
    href?: string
    allowStretch?: boolean
    footerStartContent?: ReactNode
    footerEndContent?: ReactNode
    titleEndContent?: ReactNode
    headerAction?: ReactNode
}

const readSafeItemCardTitle = (data: ItemCardData, locale: string, fallback: string): string => {
    const candidates = [data.displayName, data.name, data.templateName]
    for (const candidate of candidates) {
        const value = formatRuntimeSafeValue(candidate, locale)
        if (value) return value
    }
    return fallback
}

const readSafeTableRowLabel = (row: FlowListTableData, locale: string, fallback: string): string => {
    const record = row as FlowListTableData & Record<string, unknown>
    const dataRecord = record.data && typeof record.data === 'object' ? (record.data as Record<string, unknown>) : {}
    const candidates = [
        record.displayName,
        record.DisplayName,
        record.name,
        record.Name,
        record.title,
        record.Title,
        record.itemTitle,
        record.ItemTitle,
        record.label,
        record.Label,
        record.templateName,
        dataRecord.displayName,
        dataRecord.DisplayName,
        dataRecord.name,
        dataRecord.Name,
        dataRecord.title,
        dataRecord.Title,
        dataRecord.itemTitle,
        dataRecord.ItemTitle,
        dataRecord.label,
        dataRecord.Label
    ]
    for (const candidate of candidates) {
        const value = formatRuntimeSafeValue(candidate, locale)
        if (value) return value
    }

    for (const source of [record, dataRecord]) {
        for (const [key, candidate] of Object.entries(source)) {
            if (key === 'data' || key.startsWith('_') || isRuntimeTechnicalFieldName(key)) continue
            if (typeof candidate === 'number' || typeof candidate === 'boolean' || typeof candidate === 'bigint') continue

            const value = formatRuntimeSafeValue(candidate, locale)
            if (value) return value
        }
    }

    return fallback
}

const renderSafeTableCellValue = (value: unknown, locale: string): string => formatRuntimeSafeValue(value, locale) ?? ''

const renderSafeTableCellContent = (value: unknown, locale: string): ReactNode => {
    if (value == null || value === false) return ''
    if (isValidElement(value)) return value
    if (Array.isArray(value)) return value.map((item) => renderSafeTableCellContent(item, locale))
    return renderSafeTableCellValue(value, locale)
}

export function ItemCard<T extends ItemCardData = ItemCardData>({
    data,
    onClick,
    href,
    allowStretch = false,
    footerStartContent,
    footerEndContent,
    titleEndContent,
    headerAction
}: ItemCardProps<T>) {
    const { t } = useTranslation('apps', { i18n })
    const locale = i18n.language || 'en'
    const title = readSafeItemCardTitle(data, locale, t('runtime.card.untitled', 'Untitled item'))
    const description = formatRuntimeSafeValue(data.description, locale)
    const hasInlineActions = Boolean(headerAction || footerEndContent)
    const handleInteractiveCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return
        if (event.key !== 'Enter' && event.key !== ' ') return

        event.preventDefault()
        onClick?.()
    }
    const content = (
        <Card
            variant='outlined'
            role={onClick && hasInlineActions ? 'button' : undefined}
            tabIndex={onClick && hasInlineActions ? 0 : undefined}
            onClick={onClick && hasInlineActions ? onClick : undefined}
            onKeyDown={onClick && hasInlineActions ? handleInteractiveCardKeyDown : undefined}
            sx={{
                height: 180,
                width: '100%',
                minWidth: 220,
                maxWidth: allowStretch ? '100%' : 360,
                bgcolor: 'background.paper',
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: '0 2px 14px 0 rgb(32 40 45 / 8%)',
                transition: (theme) =>
                    theme.transitions.create(['border-color', 'box-shadow', 'background-color'], {
                        duration: theme.transitions.duration.shortest
                    }),
                '&:hover': {
                    bgcolor: 'action.hover',
                    boxShadow: '0 2px 14px 0 rgb(32 40 45 / 20%)'
                },
                ...(onClick && hasInlineActions
                    ? {
                          cursor: 'pointer',
                          '&:focus-visible': {
                              outline: (theme) => `2px solid ${theme.palette.primary.main}`,
                              outlineOffset: 2
                          }
                      }
                    : null)
            }}
        >
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0, position: 'relative' }}>
                <Stack direction='row' spacing={1} alignItems='flex-start' justifyContent='space-between' sx={{ minWidth: 0 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Stack direction='row' spacing={0.75} alignItems='center' sx={{ minWidth: 0 }}>
                            {data.color ? (
                                <Box
                                    aria-hidden='true'
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        flexShrink: 0,
                                        bgcolor: data.color
                                    }}
                                />
                            ) : null}
                            <Typography
                                sx={{
                                    fontSize: '1.25rem',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {title}
                            </Typography>
                            {titleEndContent}
                        </Stack>
                        {description ? (
                            <Typography
                                variant='body2'
                                color='text.secondary'
                                sx={{
                                    mt: 0.75,
                                    overflowWrap: 'anywhere',
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    WebkitLineClamp: 3,
                                    overflow: 'hidden'
                                }}
                            >
                                {description}
                            </Typography>
                        ) : null}
                    </Box>
                    {headerAction ? (
                        <Box sx={{ position: 'absolute', top: 4, right: 4 }} onClick={(event) => event.stopPropagation()}>
                            {headerAction}
                        </Box>
                    ) : null}
                </Stack>
                <Box sx={{ flexGrow: 1 }} />
                {footerStartContent || footerEndContent ? (
                    <Stack direction='row' spacing={1} alignItems='center' justifyContent='space-between'>
                        <Box>{footerStartContent}</Box>
                        <Box>{footerEndContent}</Box>
                    </Stack>
                ) : null}
            </Box>
        </Card>
    )

    if (href) {
        return (
            <CardActionArea component='a' href={href} sx={{ height: '100%', display: 'block' }}>
                {content}
            </CardActionArea>
        )
    }

    if (onClick && !hasInlineActions) {
        return (
            <CardActionArea onClick={onClick} sx={{ height: '100%', display: 'block', textAlign: 'inherit' }}>
                {content}
            </CardActionArea>
        )
    }

    return content
}

export interface TableColumn<T> {
    id: string
    label: ReactNode
    width?: number
    align?: 'left' | 'right' | 'center'
    sortable?: boolean
    render?: (row: T) => ReactNode
}

export interface FlowListTableData {
    id: string
    name?: string
    displayName?: string
    description?: string
}

export interface DragEndEvent {
    active: { id: string }
    over?: { id: string } | null
}

export interface FlowListTableProps<T extends FlowListTableData> {
    data: T[]
    customColumns?: TableColumn<T>[]
    isLoading?: boolean
    renderActions?: (row: T) => ReactNode
    sortableRows?: boolean
    onSortableDragEnd?: (event: DragEndEvent) => void
    sortStateId?: string
}

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: alpha(theme.palette.text.primary, 0.08),
    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900],
        fontWeight: 600
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

export function FlowListTable<T extends FlowListTableData>({
    data,
    customColumns,
    isLoading = false,
    renderActions,
    sortableRows = false,
    onSortableDragEnd
}: FlowListTableProps<T>) {
    const { t } = useTranslation('apps', { i18n })
    const locale = i18n.language || 'en'
    const columns = customColumns?.length
        ? customColumns
        : ([
              {
                  id: 'name',
                  label: t('runtime.table.name'),
                  render: (row: T) => readSafeTableRowLabel(row, locale, t('runtime.table.untitled', 'Untitled row'))
              },
              {
                  id: 'description',
                  label: t('runtime.table.description'),
                  render: (row: T) => renderSafeTableCellValue(row.description, locale)
              }
          ] satisfies TableColumn<T>[])
    const minimumTableWidth =
        columns.reduce((total, column) => total + (column.width ?? 160), sortableRows ? 88 : 0) + (renderActions ? 72 : 0)

    const moveRow = (row: T, direction: -1 | 1) => {
        const index = data.findIndex((item) => item.id === row.id)
        const target = data[index + direction]
        if (!target) return
        onSortableDragEnd?.({ active: { id: row.id }, over: { id: target.id } })
    }

    return (
        <TableContainer
            component={Paper}
            variant='outlined'
            data-testid='runtime-list-surface'
            sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: 'none',
                overflowX: 'auto'
            }}
        >
            <Table size='small' aria-busy={isLoading} sx={{ minWidth: minimumTableWidth }}>
                <TableHead>
                    <TableRow>
                        {sortableRows ? <StyledTableCell width={88} /> : null}
                        {columns.map((column) => (
                            <StyledTableCell key={column.id} align={column.align} width={column.width}>
                                {column.label}
                            </StyledTableCell>
                        ))}
                        {renderActions ? <StyledTableCell align='right' /> : null}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <StyledTableCell colSpan={columns.length + (renderActions ? 1 : 0) + (sortableRows ? 1 : 0)} align='center'>
                                <CircularProgress size={24} />
                            </StyledTableCell>
                        </TableRow>
                    ) : null}
                    {!isLoading && data.length === 0 ? (
                        <TableRow>
                            <StyledTableCell colSpan={columns.length + (renderActions ? 1 : 0) + (sortableRows ? 1 : 0)} align='center'>
                                <Typography variant='body2' color='text.secondary'>
                                    {t('runtime.table.noRecords', 'No records')}
                                </Typography>
                            </StyledTableCell>
                        </TableRow>
                    ) : null}
                    {!isLoading
                        ? data.map((row) => {
                              const rowLabel = readSafeTableRowLabel(row, locale, t('runtime.table.untitled'))
                              return (
                                  <StyledTableRow key={row.id} hover>
                                      {sortableRows ? (
                                          <StyledTableCell>
                                              <Stack direction='row' spacing={0.5}>
                                                  <Tooltip title={t('runtime.table.moveUpRow', { row: rowLabel })}>
                                                      <span>
                                                          <IconButton
                                                              size='small'
                                                              onClick={() => moveRow(row, -1)}
                                                              disabled={data[0]?.id === row.id}
                                                              aria-label={t('runtime.table.moveUpRow', { row: rowLabel })}
                                                              data-testid={`runtime-row-move-up-${row.id}`}
                                                          >
                                                              <KeyboardArrowUpRoundedIcon fontSize='small' />
                                                          </IconButton>
                                                      </span>
                                                  </Tooltip>
                                                  <Tooltip title={t('runtime.table.moveDownRow', { row: rowLabel })}>
                                                      <span>
                                                          <IconButton
                                                              size='small'
                                                              onClick={() => moveRow(row, 1)}
                                                              disabled={data[data.length - 1]?.id === row.id}
                                                              aria-label={t('runtime.table.moveDownRow', { row: rowLabel })}
                                                              data-testid={`runtime-row-move-down-${row.id}`}
                                                          >
                                                              <KeyboardArrowDownRoundedIcon fontSize='small' />
                                                          </IconButton>
                                                      </span>
                                                  </Tooltip>
                                              </Stack>
                                          </StyledTableCell>
                                      ) : null}
                                      {columns.map((column) => (
                                          <StyledTableCell key={column.id} align={column.align}>
                                              {column.render
                                                  ? renderSafeTableCellContent(column.render(row), locale)
                                                  : renderSafeTableCellValue(row[column.id as keyof T], locale)}
                                          </StyledTableCell>
                                      ))}
                                      {renderActions ? <StyledTableCell align='right'>{renderActions(row)}</StyledTableCell> : null}
                                  </StyledTableRow>
                              )
                          })
                        : null}
                </TableBody>
            </Table>
        </TableContainer>
    )
}

export interface PaginationState {
    currentPage: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
}

export interface PaginationActions {
    goToPage: (page: number) => void
    nextPage: () => void
    previousPage: () => void
    setSearch: (search: string) => void
    setSort: (sort: string) => void
    setPageSize: (pageSize: number) => void
}

export interface PaginationControlsProps {
    namespace?: string
    rowsPerPageOptions?: number[]
    pagination: PaginationState
    actions: PaginationActions
    isLoading?: boolean
}

export function PaginationControls({
    namespace = 'apps',
    rowsPerPageOptions = [10, 20, 50, 100],
    pagination,
    actions,
    isLoading = false
}: PaginationControlsProps) {
    const { t } = useTranslation(namespace, { i18n })
    const muiPage = pagination.currentPage - 1

    return (
        <Box
            data-testid='runtime-pagination-surface'
            sx={{
                mt: 2,
                display: 'flex',
                justifyContent: 'flex-end',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                overflow: 'hidden'
            }}
        >
            <TablePagination
                component='div'
                count={pagination.totalItems}
                page={muiPage}
                onPageChange={(_event, newPage) => actions.goToPage(newPage + 1)}
                rowsPerPage={pagination.pageSize}
                onRowsPerPageChange={(event) => actions.setPageSize(Number.parseInt(event.target.value, 10))}
                rowsPerPageOptions={rowsPerPageOptions}
                labelRowsPerPage={t('pagination.rowsPerPage', 'Rows per page:')}
                labelDisplayedRows={({ from, to, count }) =>
                    count === -1
                        ? `${from}-${to} ${t('pagination.moreThan', 'of more than')} ${to}`
                        : t('pagination.displayedRows', '{{from}}-{{to}} of {{count}}', { from, to, count })
                }
                disabled={isLoading}
                showFirstButton
                showLastButton
                sx={{
                    '& .MuiTablePagination-selectLabel': {
                        display: { xs: 'none', sm: 'block' }
                    },
                    '& .MuiTablePagination-select': {
                        py: 0.25,
                        px: 0,
                        paddingRight: '12px !important',
                        marginLeft: { xs: '0 !important', sm: '16px !important' },
                        marginRight: '16px !important'
                    },
                    '& .MuiTablePagination-input': {
                        height: 36,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        boxShadow: 'none',
                        marginRight: 0
                    },
                    '& .MuiTablePagination-displayedRows': {
                        marginLeft: 0
                    }
                }}
            />
        </Box>
    )
}

export interface ViewHeaderMUIProps {
    title?: ReactNode
    description?: ReactNode
    search?: boolean
    searchValue?: string
    searchPlaceholder?: string
    onSearchChange?: (event: ChangeEvent<HTMLInputElement>) => void
    controlsWrap?: boolean
    children?: ReactNode
}

export function ViewHeaderMUI({
    title,
    description,
    search = false,
    searchValue,
    searchPlaceholder,
    onSearchChange,
    controlsWrap = false,
    children
}: ViewHeaderMUIProps) {
    const { t } = useTranslation('apps', { i18n })
    const effectiveSearchPlaceholder = searchPlaceholder ?? t('toolbar.search')

    return (
        <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            {title || description ? (
                <Box sx={{ minWidth: 0 }}>
                    {title ? (
                        <Typography component='h2' variant='h6' sx={{ overflowWrap: 'anywhere' }}>
                            {title}
                        </Typography>
                    ) : null}
                    {description ? (
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                            {description}
                        </Typography>
                    ) : null}
                </Box>
            ) : null}
            <Toolbar
                disableGutters
                sx={{
                    gap: 1.5,
                    minHeight: 'auto',
                    alignItems: controlsWrap ? 'stretch' : 'center',
                    flexWrap: controlsWrap ? 'wrap' : 'nowrap'
                }}
            >
                {search ? (
                    <TextField
                        size='small'
                        value={searchValue ?? ''}
                        placeholder={effectiveSearchPlaceholder}
                        onChange={onSearchChange}
                        inputProps={{ 'aria-label': effectiveSearchPlaceholder }}
                        sx={{ minWidth: { xs: '100%', sm: 260 } }}
                    />
                ) : null}
                <Box sx={{ flexGrow: 1 }} />
                {children}
            </Toolbar>
        </Stack>
    )
}

export interface ToolbarControlsProps {
    viewToggleEnabled?: boolean
    viewMode?: 'card' | 'list'
    onViewModeChange?: (mode: 'card' | 'list') => void
    cardViewTitle?: string
    listViewTitle?: string
    primaryAction?: {
        label: string
        onClick: () => void
        disabled?: boolean
        startIcon?: ReactNode
    }
    columnVisibilityControl?: {
        options: Array<{ field: string; label: string; visible: boolean; disabled?: boolean }>
        onToggle: (field: string, visible: boolean) => void
        buttonLabel?: string
        menuLabel?: string
    }
}

export function ToolbarControls({
    viewToggleEnabled = false,
    viewMode = 'list',
    onViewModeChange,
    cardViewTitle,
    listViewTitle,
    primaryAction,
    columnVisibilityControl
}: ToolbarControlsProps) {
    const { t } = useTranslation('apps', { i18n })
    const effectiveCardViewTitle = cardViewTitle ?? t('toolbar.cardView', 'Card view')
    const effectiveListViewTitle = listViewTitle ?? t('toolbar.tableView', 'Table view')

    return (
        <Stack
            direction='row'
            spacing={1}
            alignItems='center'
            sx={{
                flexWrap: 'wrap',
                justifyContent: { xs: 'flex-end', sm: 'flex-start' },
                minWidth: 0,
                width: { xs: '100%', sm: 'auto' }
            }}
        >
            {columnVisibilityControl?.options.length ? <ColumnVisibilityControl {...columnVisibilityControl} /> : null}
            {viewToggleEnabled ? (
                <ToggleButtonGroup
                    aria-label={t('toolbar.viewMode', 'View mode')}
                    exclusive
                    size='small'
                    value={viewMode}
                    onChange={(_event, nextMode: 'card' | 'list' | null) => {
                        if (nextMode) onViewModeChange?.(nextMode)
                    }}
                    sx={{
                        height: 40,
                        '& .MuiToggleButton-root': {
                            width: 40,
                            minWidth: 40,
                            height: 40,
                            p: 1
                        }
                    }}
                >
                    <ToggleButton value='card' aria-label={effectiveCardViewTitle}>
                        <Tooltip title={effectiveCardViewTitle}>
                            <ViewComfyRoundedIcon fontSize='small' />
                        </Tooltip>
                    </ToggleButton>
                    <ToggleButton value='list' aria-label={effectiveListViewTitle}>
                        <Tooltip title={effectiveListViewTitle}>
                            <ViewListRoundedIcon fontSize='small' />
                        </Tooltip>
                    </ToggleButton>
                </ToggleButtonGroup>
            ) : null}
            {primaryAction ? (
                <Button
                    variant='contained'
                    size='small'
                    startIcon={primaryAction.startIcon ?? <AddRoundedIcon />}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled}
                    sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
                >
                    {primaryAction.label}
                </Button>
            ) : null}
        </Stack>
    )
}

export function ColumnVisibilityControl({
    options,
    onToggle,
    buttonLabel,
    menuLabel
}: NonNullable<ToolbarControlsProps['columnVisibilityControl']>) {
    const { t } = useTranslation('apps')
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const visibleCount = options.filter((option) => option.visible).length
    const effectiveButtonLabel = buttonLabel ?? t('toolbar.columns', 'Columns')
    const effectiveMenuLabel = menuLabel ?? t('toolbar.columnsMenu', 'Table columns')

    if (options.length < 2) return null

    return (
        <>
            <Button
                type='button'
                variant='outlined'
                size='small'
                startIcon={<ViewColumnRoundedIcon fontSize='small' />}
                aria-haspopup='menu'
                aria-expanded={anchorEl ? 'true' : undefined}
                onClick={(event) => setAnchorEl(event.currentTarget)}
                data-testid='runtime-column-visibility-button'
                sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
            >
                {effectiveButtonLabel}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                MenuListProps={{ 'aria-label': effectiveMenuLabel }}
            >
                {options.map((option) => {
                    const disabled = option.disabled || (option.visible && visibleCount <= 1)
                    return (
                        <MenuItem
                            key={option.field}
                            dense
                            disabled={disabled}
                            onClick={() => {
                                if (disabled) return
                                onToggle(option.field, !option.visible)
                            }}
                            data-testid={`runtime-column-visibility-option-${option.field}`}
                        >
                            <Checkbox size='small' checked={option.visible} disabled={disabled} sx={{ p: 0.5, mr: 1 }} />
                            <ListItemText primary={option.label} />
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}

export function useViewPreference<TMode extends string>(key: string, defaultMode: TMode) {
    const storageKey = `apps-template.view.${key}`
    const [mode, setModeState] = useState<TMode>(defaultMode)

    const setMode = useCallback(
        (next: TMode) => {
            setModeState(next)
            if (typeof window !== 'undefined') {
                try {
                    window.localStorage.setItem(storageKey, next)
                } catch {
                    // Ignore storage failures; the visible runtime state remains authoritative.
                }
            }
        },
        [storageKey]
    )

    useEffect(() => {
        if (typeof window === 'undefined') {
            setModeState(defaultMode)
            return
        }

        try {
            const stored = window.localStorage.getItem(storageKey)
            setModeState(stored ? (stored as TMode) : defaultMode)
        } catch {
            setModeState(defaultMode)
        }
    }, [defaultMode, storageKey])

    return useMemo(() => [mode, setMode] as const, [mode, setMode])
}
