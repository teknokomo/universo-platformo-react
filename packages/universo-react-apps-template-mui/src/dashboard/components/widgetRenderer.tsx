import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type MouseEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { GridColDef, GridFilterModel, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import Avatar from '@mui/material/Avatar'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormHelperText from '@mui/material/FormHelperText'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Select from '@mui/material/Select'
import type { SelectChangeEvent } from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import DriveFileMoveRoundedIcon from '@mui/icons-material/DriveFileMoveRounded'
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import NavigateBeforeRoundedIcon from '@mui/icons-material/NavigateBeforeRounded'
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import {
    detailsTableWidgetConfigSchema,
    detailsTabsWidgetConfigSchema,
    relationBuilderWidgetConfigSchema,
    readLocalizedTextValue,
    type ColumnsContainerConfig,
    type DetailsTableWidgetConfig,
    type DetailsTabsWidgetConfig,
    type ReportDefinition,
    type ResourceType,
    type RuntimePageBlock,
    type RuntimeDatasourceDescriptor,
    type SequencePolicy,
    type SequenceStep
} from '@universo-react/types'
import { COMPLETION_ITEM_STATUSES, evaluateSequenceStepAvailability } from '@universo-react/types'
import {
    exportRuntimeReportCsv,
    fetchAppData,
    fetchRuntimeLedgerFacts,
    fetchRuntimeLedgerProjection,
    fetchRuntimeRecordsUnion,
    reorderAppRows,
    restoreAppRow,
    runRuntimeReport,
    setRuntimeLibraryRelation,
    updateAppRow,
    updateLearningContentProgress
} from '../../api/api'
import type { AppDataResponse } from '../../api/api'
import { fetchRuntimeWorkspaceMembers, type RuntimeWorkspaceMember } from '../../api/workspaces'
import { ResourcePreview } from '../../components/resource-preview'
import { toGridColumns } from '../../utils/columns'
import { formatRuntimeColumnValue, formatRuntimeSafeValue, isRuntimeTechnicalFieldName } from '../../utils/displayValue'
import { getDefaultResourceTypeLabel } from '../../utils/resourceSourceLabels'
import { extractRuntimeErrorMessage } from '../../utils/runtimeErrors'
import { findRuntimeSectionIdByCodename } from '../../utils/runtimeSections'
import { mapGridFilterModel, mapGridSortModel } from '../../utils/runtimeListQuery'
import { useRuntimeColumnVisibilityPreference } from '../../hooks/useRuntimeColumnVisibility'
import {
    FlowListTable,
    ItemCard,
    PaginationControls,
    ToolbarControls,
    ViewHeaderMUI,
    useViewPreference,
    type DragEndEvent,
    type ItemCardData,
    type TableColumn
} from '../../components/runtime-ui'
import SelectContent from './SelectContent'
import MenuContent from './MenuContent'
import CardAlert from './CardAlert'
import CustomizedTreeView from './CustomizedTreeView'
import ChartUserByCountry from './ChartUserByCountry'
import CustomizedDataGrid from './CustomizedDataGrid'
import QuizWidget from './QuizWidget'
import PlayCanvasCanvasWidget from './PlayCanvasCanvasWidget'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import { RelationBuilderWidget } from './RelationBuilderWidget'
import InterpretationNetworkWorkspaceWidget from './InterpretationNetworkWorkspaceWidget'
import PageBlocksView from './PageBlocksView'
import type {
    DashboardCreateTarget,
    DashboardDetailsSlot,
    DashboardMenuSlot,
    DashboardMenusMap,
    DashboardRowTarget,
    DashboardRowTargetAction,
    ZoneWidgetItem
} from '../Dashboard'
import { useDashboardDetails } from '../DashboardDetailsContext'
import type { RuntimeRestoreTarget } from '../../api/types'

/**
 * Resolve the correct menu for a menuWidget using a 2-level fallback:
 * 1. widget.id → menus map lookup (direct widget ID match)
 * 2. Legacy single `menu` prop
 */
export function resolveMenuForWidget(
    widget: ZoneWidgetItem,
    menus?: DashboardMenusMap,
    fallbackMenu?: DashboardMenuSlot
): DashboardMenuSlot | undefined {
    if (menus?.[widget.id]) {
        return menus[widget.id]
    }
    return fallbackMenu
}

/**
 * Maximum nesting depth for columnsContainer widgets to prevent infinite recursion.
 * A columnsContainer inside another columnsContainer is blocked at render time.
 */
const MAX_CONTAINER_DEPTH = 1
const DATASOURCE_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
const REORDER_LIST_LIMIT = 100
const COMPLETION_STATUS_SET = new Set<string>(COMPLETION_ITEM_STATUSES)
const SEQUENCE_REASON_FALLBACK_LABELS: Record<string, string> = {
    missingStep: 'Missing step',
    scheduledNotStarted: 'Not started',
    scheduledExpired: 'Expired',
    sequentialLocked: 'Locked',
    prerequisiteLocked: 'Prerequisite locked'
}
const SEQUENCE_STEP_LABEL_FIELDS = ['Title', 'Name', 'DisplayName', 'title', 'name', 'displayName', 'Codename', 'codename'] as const

const readRuntimeRowVersion = (row: Record<string, unknown> | null | undefined): number | undefined => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : undefined
}

const readLocalizedWidgetText = (value: unknown, locale: string | undefined): string | undefined =>
    readLocalizedTextValue(value, locale ?? 'en')

type DetailsTableCreateTarget = NonNullable<DetailsTableWidgetConfig['createTargets']>[number]
type DetailsTableRestoreTarget = NonNullable<DetailsTableWidgetConfig['restoreTarget']>
type DetailsTableRowAction = NonNullable<DetailsTableWidgetConfig['rowActions']>[number]
type DetailsTableLibraryAction = Extract<DetailsTableRowAction, { kind: 'library.toggle' }>
type DetailsTableTargetFieldAction = Extract<DetailsTableRowAction, { kind: 'field.updateWithTarget' }>
type DetailsTableTargetPickerConfig = DetailsTableRestoreTarget | DetailsTableTargetFieldAction
type TranslateFn = (key: string, fallback: string, options?: Record<string, unknown>) => string

const humanizeRuntimeCodename = (value: string | null | undefined): string => {
    const normalized = value?.trim()
    if (!normalized) return ''

    return normalized
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
}

const capitalizeRuntimeLabel = (value: string): string => (value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '')

const formatDetailsTabFallbackLabel = (tabId: string, locale: string | undefined, fallback: string): string => {
    const safeId = formatRuntimeSafeValue(tabId, locale ?? 'en')
    const humanized = capitalizeRuntimeLabel(humanizeRuntimeCodename(safeId))
    return humanized || fallback
}

const resolveRuntimeObjectDisplayName = (details: DashboardDetailsSlot | undefined, codename: string | null | undefined): string => {
    const normalized = codename?.trim()
    if (!normalized) return ''

    const candidates = [...(details?.objectCollections ?? []), ...(details?.sections ?? [])]
    const matched = candidates.find((item) => item.codename === normalized)
    const matchedName =
        typeof (matched as unknown as { name?: unknown } | undefined)?.name === 'string'
            ? (matched as unknown as { name: string }).name.trim()
            : ''
    return matchedName || humanizeRuntimeCodename(matched?.codename ?? normalized)
}

const readCreateTargetResourceSourceType = (target: DetailsTableCreateTarget): ResourceType | null => {
    const resourceSourceDefault = target.createDefaults?.find((item) => typeof item.resourceSourceType === 'string')
    return (resourceSourceDefault?.resourceSourceType as ResourceType | undefined) ?? null
}

const resolveCreateTargetAvailability = (
    target: DetailsTableCreateTarget,
    details: DashboardDetailsSlot | undefined,
    translate: TranslateFn
): { disabled: boolean; disabledReason?: string } => {
    const metadataDisabledReason = target.disabledReason ? readLocalizedWidgetText(target.disabledReason, details?.locale) : undefined
    if (target.disabled) {
        return { disabled: true, disabledReason: metadataDisabledReason }
    }

    const resourceType = readCreateTargetResourceSourceType(target)
    if (!resourceType || !details?.resourceSourceTypes?.length) return { disabled: false }

    const configuredType = details.resourceSourceTypes.find((item) => item.resourceType === resourceType)
    const typeLabel =
        readLocalizedWidgetText(configuredType?.label, details.locale) ??
        translate(`resourceSource.types.${resourceType}`, getDefaultResourceTypeLabel(resourceType))

    if (!configuredType || configuredType.enabled === false) {
        return {
            disabled: true,
            disabledReason: translate('app.createTargetResourceTypeDisabled', '{{type}} is disabled in application settings.', {
                type: typeLabel
            })
        }
    }

    if (configuredType.deferred === true) {
        return {
            disabled: true,
            disabledReason: translate('app.createTargetResourceTypeDeferred', '{{type}} is planned for a later phase.', {
                type: typeLabel
            })
        }
    }

    return { disabled: false }
}

const createGridColumnSource = (columns: AppDataResponse['columns'], rows: AppDataResponse['rows'], total: number): AppDataResponse =>
    ({
        section: null,
        objectCollection: null,
        sections: [],
        objectCollections: [],
        activeSectionId: null,
        activeObjectCollectionId: null,
        columns,
        rows,
        pagination: {
            total,
            limit: rows.length,
            offset: 0
        },
        layoutConfig: {},
        zoneWidgets: {
            left: [],
            right: [],
            center: []
        },
        menus: [],
        activeMenuId: null
    } as unknown as AppDataResponse)

const isTechnicalUnionColumn = (column: AppDataResponse['columns'][number], hasTitleColumn: boolean): boolean => {
    const codename = column.codename || column.field || ''
    const field = column.field || ''
    const uiConfig = column.uiConfig ?? {}

    if (uiConfig.hidden === true || uiConfig.gridHidden === true) return true
    if (hasTitleColumn && (normalizeRuntimeColumnKey(codename) === 'name' || normalizeRuntimeColumnKey(field) === 'name')) return true

    return isRuntimeTechnicalFieldName(codename) || isRuntimeTechnicalFieldName(field)
}

const toUnionDisplayColumns = (columns: AppDataResponse['columns']): AppDataResponse['columns'] => {
    const hasTitleColumn = columns.some((column) => {
        const codename = (column.codename || column.field || '').trim().toLowerCase()
        const field = (column.field || '').trim().toLowerCase()
        return codename === 'title' || field === 'title'
    })
    const visibleColumns = columns.filter((column) => !isTechnicalUnionColumn(column, hasTitleColumn))
    const preferredFields = ['type', 'title', 'status', 'recentat', 'updatedat']
    const preferredColumns = preferredFields.flatMap((field) => {
        const matched = visibleColumns.find((column) => {
            const codename = (column.codename || column.field || '').trim().toLowerCase()
            const columnField = (column.field || '').trim().toLowerCase()
            return columnField === field || codename === field
        })
        return matched ? [matched] : []
    })
    const preferredColumnFields = new Set(preferredColumns.map((column) => column.field))
    return [...preferredColumns, ...visibleColumns.filter((column) => !preferredColumnFields.has(column.field))].slice(0, 8)
}

const toRuntimeDisplayColumns = (columns: AppDataResponse['columns']): AppDataResponse['columns'] => {
    const hasTitleColumn = columns.some((column) => {
        const codename = normalizeRuntimeColumnKey(column.codename)
        const field = normalizeRuntimeColumnKey(column.field)
        return codename === 'title' || field === 'title'
    })

    return columns.filter((column) => !isTechnicalUnionColumn(column, hasTitleColumn))
}

type RuntimeTableColumnPreset = NonNullable<DashboardDetailsSlot['tableDefaults']>['columnPreset']

const normalizeRuntimeColumnKey = (value: string | undefined): string => value?.trim().toLowerCase() ?? ''

const applyRuntimeTableColumnPreset = (
    columns: AppDataResponse['columns'],
    preset: RuntimeTableColumnPreset | undefined
): AppDataResponse['columns'] => {
    if (!preset?.columns?.length) return columns

    const columnsByKey = new Map<string, AppDataResponse['columns'][number]>()
    for (const column of columns) {
        columnsByKey.set(normalizeRuntimeColumnKey(column.field), column)
        columnsByKey.set(normalizeRuntimeColumnKey(column.codename), column)
    }

    const selectedColumns = preset.columns.flatMap((presetColumn) => {
        if (presetColumn.visible === false) return []

        const column = columnsByKey.get(normalizeRuntimeColumnKey(presetColumn.field))
        if (!column) return []

        return [
            {
                ...column,
                uiConfig: {
                    ...(column.uiConfig ?? {}),
                    ...(typeof presetColumn.width === 'number' ? { gridWidth: presetColumn.width } : {}),
                    ...(typeof presetColumn.flex === 'number' ? { gridFlex: presetColumn.flex } : {})
                }
            }
        ]
    })

    return selectedColumns.length > 0 ? selectedColumns : columns
}

const findRuntimeCardColumn = (
    columns: AppDataResponse['columns'],
    preferredFields: readonly string[]
): AppDataResponse['columns'][number] | undefined => {
    for (const preferredField of preferredFields) {
        const normalizedPreferredField = normalizeRuntimeColumnKey(preferredField)
        const matched = columns.find((column) => {
            const field = normalizeRuntimeColumnKey(column.field)
            const codename = normalizeRuntimeColumnKey(column.codename)
            return field === normalizedPreferredField || codename === normalizedPreferredField
        })
        if (matched) return matched
    }

    return undefined
}

const formatRuntimeCardValue = (
    row: Record<string, unknown>,
    column: AppDataResponse['columns'][number] | undefined,
    locale: string | undefined
): string | undefined => {
    if (!column) return undefined

    const value = formatRuntimeColumnValue(column, row[column.field], locale ?? 'en')
    if (!value) return undefined

    return value
}

const readRecordsListTarget = (datasource: RuntimeDatasourceDescriptor, details: DashboardDetailsSlot | undefined): string | undefined => {
    if (datasource.kind !== 'records.list') return undefined
    return (
        datasource.sectionId ??
        datasource.objectCollectionId ??
        findRuntimeSectionIdByCodename(details, datasource.sectionCodename ?? datasource.objectCollectionCodename) ??
        undefined
    )
}

const reorderRowsByIds = <T extends { id: string }>(rows: T[], activeId: string, overId: string | null | undefined): T[] => {
    if (!overId || activeId === overId) return rows

    const activeIndex = rows.findIndex((row) => row.id === activeId)
    const overIndex = rows.findIndex((row) => row.id === overId)
    if (activeIndex < 0 || overIndex < 0) return rows

    const nextRows = [...rows]
    const [movedRow] = nextRows.splice(activeIndex, 1)
    nextRows.splice(overIndex, 0, movedRow)
    return nextRows
}

const buildFlowListColumns = (
    columns: AppDataResponse['columns'],
    locale: string
): Array<TableColumn<Record<string, unknown> & { id: string }>> =>
    columns
        .filter((column) => column.field !== 'id' && column.field !== 'actions')
        .slice(0, 6)
        .map((column) => ({
            id: column.field,
            label: column.headerName || column.codename || column.field,
            render: (row) => formatRuntimeColumnValue(column, row[column.field], locale)
        }))

const readSequenceNumber = (row: Record<string, unknown>, field: string | undefined): number | undefined => {
    if (!field) return undefined
    const value = row[field]
    const numberValue =
        typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    return Number.isFinite(numberValue) ? numberValue : undefined
}

const readSequenceString = (row: Record<string, unknown>, field: string | undefined): string | undefined => {
    if (!field) return undefined
    const value = row[field]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

const readSequenceStatus = (row: Record<string, unknown>) => {
    const candidates = [row.ProgressStatus, row.CompletionStatus, row.Status, row.status]
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0)
    if (typeof value !== 'string') return 'notStarted' as const
    return COMPLETION_STATUS_SET.has(value) ? (value as (typeof COMPLETION_ITEM_STATUSES)[number]) : ('notStarted' as const)
}

const isSequenceRowCompleted = (row: Record<string, unknown>): boolean =>
    readSequenceStatus(row) === 'completed' ||
    (readSequenceNumber(row, 'ProgressPercent') ?? readSequenceNumber(row, 'progressPercent') ?? 0) >= 100

const readSequenceScopeKey = (row: Record<string, unknown>, field: string | undefined): string => {
    if (!field) return '__all__'
    const value = row[field]
    if (value === null || value === undefined) return '__missing__'
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id
    return JSON.stringify(value)
}

const readRuntimeRowFieldValue = (row: Record<string, unknown>, field: string): unknown => {
    if (field in row) return row[field]

    const normalizedField = normalizeRuntimeColumnKey(field)
    const matchedKey = Object.keys(row).find((key) => normalizeRuntimeColumnKey(key) === normalizedField)
    return matchedKey ? row[matchedKey] : undefined
}

const formatSequenceStepLabel = (
    row: Record<string, unknown>,
    columns: AppDataResponse['columns'] | undefined,
    locale: string | undefined,
    fallback: string
): string => {
    for (const field of SEQUENCE_STEP_LABEL_FIELDS) {
        const value = formatRuntimeSafeValue(readRuntimeRowFieldValue(row, field), locale ?? 'en')
        if (value) return value
    }

    for (const column of toRuntimeDisplayColumns(columns ?? [])) {
        if (normalizeRuntimeColumnKey(column.field) === 'id' || normalizeRuntimeColumnKey(column.field) === 'actions') continue
        const value = formatRuntimeSafeValue(readRuntimeRowFieldValue(row, column.field), locale ?? 'en')
        if (value) return value
    }

    return fallback
}

function DetailsTableCreateTargetMenu({ createTargets }: { createTargets?: DetailsTableWidgetConfig['createTargets'] }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
    const targets = useMemo(() => createTargets?.filter((target) => target.id && target.label) ?? [], [createTargets])
    const open = Boolean(anchorEl)

    if (!targets.length || !details?.onOpenCreateTarget) return null

    const readTargetLabel = (target: DetailsTableCreateTarget): string =>
        readLocalizedWidgetText(target.label, details.locale) ||
        resolveRuntimeObjectDisplayName(
            details,
            target.sectionCodename ?? target.objectCollectionCodename ?? target.sectionId ?? target.objectCollectionId
        ) ||
        t('app.createTargetFallback', 'Record')

    const handleOpenMenu = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget)
    }

    const handleCloseMenu = () => {
        setAnchorEl(null)
    }

    const handleSelectTarget = (target: DetailsTableCreateTarget) => {
        if (resolveCreateTargetAvailability(target, details, t).disabled) return
        details.onOpenCreateTarget?.(target as DashboardCreateTarget)
        handleCloseMenu()
    }

    return (
        <>
            <Button
                type='button'
                data-testid='records-union-create-target-menu-button'
                variant='contained'
                size='small'
                startIcon={<AddRoundedIcon fontSize='small' />}
                endIcon={<KeyboardArrowDownRoundedIcon fontSize='small' />}
                aria-haspopup='menu'
                aria-expanded={open ? 'true' : undefined}
                onClick={handleOpenMenu}
                sx={{ height: 40, minHeight: 40, borderRadius: 1, flexShrink: 0 }}
            >
                {t('app.createRow', 'Create')}
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleCloseMenu}
                MenuListProps={{ 'aria-label': t('app.createTargetMenu', 'Create content') }}
            >
                {targets.map((target) => {
                    const label = readTargetLabel(target)
                    const availability = resolveCreateTargetAvailability(target, details, t)
                    const disabledReason = availability.disabledReason

                    return (
                        <MenuItem
                            key={target.id}
                            disabled={availability.disabled}
                            onClick={() => handleSelectTarget(target)}
                            sx={{ minWidth: 220, alignItems: 'flex-start' }}
                        >
                            <Stack spacing={0.25}>
                                <Typography variant='body2'>{label}</Typography>
                                {availability.disabled && disabledReason ? (
                                    <Typography variant='caption' color='text.secondary'>
                                        {disabledReason}
                                    </Typography>
                                ) : null}
                            </Stack>
                        </MenuItem>
                    )
                })}
            </Menu>
        </>
    )
}

const readSequencePrerequisiteIds = (row: Record<string, unknown>, field: string | undefined): string[] => {
    if (!field) return []
    const value = row[field]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (typeof value !== 'string') return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

const addSequenceAvailabilityState = (
    rows: Array<Record<string, unknown> & { id: string }>,
    sequencePolicy: SequencePolicy | undefined,
    options?: {
        columns?: AppDataResponse['columns']
        locale?: string
        lockedByFallback?: string
    }
): Array<Record<string, unknown> & { id: string }> => {
    if (!sequencePolicy) return rows

    const rowsByScope = new Map<string, Array<Record<string, unknown> & { id: string }>>()
    rows.forEach((row) => {
        const scopeKey = readSequenceScopeKey(row, sequencePolicy.scopeFieldCodename)
        rowsByScope.set(scopeKey, [...(rowsByScope.get(scopeKey) ?? []), row])
    })

    const stepsByScope = new Map<string, SequenceStep[]>()
    rowsByScope.forEach((scopedRows, scopeKey) => {
        const scopedSteps = scopedRows.flatMap((row) => {
            const id = typeof row.id === 'string' ? row.id : null
            if (!id) return []

            return [
                {
                    id,
                    order: readSequenceNumber(row, sequencePolicy.orderFieldCodename),
                    availableFrom: readSequenceString(row, sequencePolicy.availableFromFieldCodename),
                    availableTo: readSequenceString(row, sequencePolicy.availableToFieldCodename),
                    status: readSequenceStatus(row),
                    progressPercent: readSequenceNumber(row, 'ProgressPercent') ?? readSequenceNumber(row, 'progressPercent'),
                    prerequisiteStepIds: readSequencePrerequisiteIds(row, sequencePolicy.prerequisiteFieldCodename)
                }
            ]
        })
        stepsByScope.set(scopeKey, scopedSteps)
    })

    const lockedByLabelFallback = options?.lockedByFallback ?? 'Required step'
    const labelsByScope = new Map<string, Map<string, string>>()
    rowsByScope.forEach((scopedRows, scopeKey) => {
        const labels = new Map<string, string>()
        scopedRows.forEach((row) => {
            labels.set(row.id, formatSequenceStepLabel(row, options?.columns, options?.locale, lockedByLabelFallback))
        })
        labelsByScope.set(scopeKey, labels)
    })

    return rows.map((row) => {
        const id = typeof row.id === 'string' ? row.id : null
        if (!id) return row
        const scopeKey = readSequenceScopeKey(row, sequencePolicy.scopeFieldCodename)
        const steps = stepsByScope.get(scopeKey) ?? []
        const availability = evaluateSequenceStepAvailability(sequencePolicy, steps, id)
        const labels = labelsByScope.get(scopeKey)
        const lockedByLabels = availability.lockedByStepIds.map((stepId) => labels?.get(stepId) ?? lockedByLabelFallback)
        return {
            ...row,
            __runtimeSequenceAvailability: availability.reason,
            __runtimeSequenceLockedBy: lockedByLabels.join(', ')
        }
    })
}

const readRecordsUnionTargets = (
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }>,
    details: DashboardDetailsSlot | undefined
): Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }>['targets'] =>
    datasource.targets.flatMap((target) => {
        const sectionId =
            target.sectionId ??
            target.objectCollectionId ??
            findRuntimeSectionIdByCodename(details, target.sectionCodename ?? target.objectCollectionCodename)

        const sectionCodename = target.sectionCodename ?? target.objectCollectionCodename ?? null
        if (!sectionId && !sectionCodename) return []

        return [
            {
                sectionId,
                sectionCodename: target.sectionCodename,
                objectCollectionCodename: target.objectCollectionCodename,
                displayType: target.displayType,
                typeField: target.typeField,
                titleField: target.titleField,
                statusField: target.statusField,
                projectField: target.projectField,
                updatedAtField: target.updatedAtField
            }
        ]
    })

const normalizeTargetFilterValue = (value: string | null | undefined): string =>
    String(value ?? '')
        .trim()
        .toLowerCase()

const recordsUnionTargetMatchesFilter = (
    target: Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }>['targets'][number],
    filter: NonNullable<DetailsTableWidgetConfig['targetFilters']>[number]
): boolean => {
    const displayTypes = new Set((filter.targetDisplayTypes ?? []).map(normalizeTargetFilterValue))
    const sectionCodenames = new Set((filter.targetSectionCodenames ?? []).map(normalizeTargetFilterValue))
    const objectCollectionCodenames = new Set((filter.targetObjectCollectionCodenames ?? []).map(normalizeTargetFilterValue))
    const sectionIds = new Set((filter.targetSectionIds ?? []).map(normalizeTargetFilterValue))
    const objectCollectionIds = new Set((filter.targetObjectCollectionIds ?? []).map(normalizeTargetFilterValue))

    return (
        (displayTypes.size > 0 && displayTypes.has(normalizeTargetFilterValue(target.displayType))) ||
        (sectionCodenames.size > 0 && sectionCodenames.has(normalizeTargetFilterValue(target.sectionCodename))) ||
        (objectCollectionCodenames.size > 0 &&
            objectCollectionCodenames.has(normalizeTargetFilterValue(target.objectCollectionCodename))) ||
        (sectionIds.size > 0 && sectionIds.has(normalizeTargetFilterValue(target.sectionId))) ||
        (objectCollectionIds.size > 0 && objectCollectionIds.has(normalizeTargetFilterValue(target.objectCollectionId)))
    )
}

const readRecordsUnionRowTarget = (row: Record<string, unknown> | null): DashboardRowTarget | null => {
    if (!row) return null

    const rowId = typeof row.__runtimeSourceRowId === 'string' && row.__runtimeSourceRowId.trim() ? row.__runtimeSourceRowId.trim() : null
    if (!rowId) return null

    return {
        rowId,
        objectCollectionId:
            typeof row.__runtimeObjectCollectionId === 'string' && row.__runtimeObjectCollectionId.trim()
                ? row.__runtimeObjectCollectionId.trim()
                : null,
        objectCollectionCodename:
            typeof row.__runtimeObjectCollectionCodename === 'string' && row.__runtimeObjectCollectionCodename.trim()
                ? row.__runtimeObjectCollectionCodename.trim()
                : null
    }
}

const DEFAULT_RESTORE_TARGET_LABEL_FIELDS = ['Name', 'Title', 'DisplayName', 'name', 'title', 'displayName']

const resolveTargetPickerObjectCollectionId = (
    target: DetailsTableTargetPickerConfig | undefined,
    details: DashboardDetailsSlot | undefined
): string | undefined =>
    target?.targetSectionId ??
    target?.targetObjectCollectionId ??
    findRuntimeSectionIdByCodename(details, target?.targetSectionCodename ?? target?.targetObjectCollectionCodename)

const resolveTargetPickerObjectCollectionCodename = (target: DetailsTableTargetPickerConfig | undefined): string | null =>
    target?.targetSectionCodename ?? target?.targetObjectCollectionCodename ?? null

type TargetPickerOptionLookup = {
    rowValuesByNormalizedKey: Map<string, unknown>
    columnsByNormalizedKey: Map<string, AppDataResponse['columns'][number]>
}

const buildTargetPickerOptionLookup = (
    row: Record<string, unknown>,
    columns: AppDataResponse['columns'] | undefined
): TargetPickerOptionLookup => {
    const rowValuesByNormalizedKey = new Map<string, unknown>()
    for (const [key, value] of Object.entries(row)) {
        rowValuesByNormalizedKey.set(normalizeRuntimeColumnKey(key), value)
    }

    const columnsByNormalizedKey = new Map<string, AppDataResponse['columns'][number]>()
    for (const column of columns ?? []) {
        columnsByNormalizedKey.set(normalizeRuntimeColumnKey(column.codename), column)
        columnsByNormalizedKey.set(normalizeRuntimeColumnKey(column.field), column)
        columnsByNormalizedKey.set(normalizeRuntimeColumnKey(column.headerName), column)
    }

    return { rowValuesByNormalizedKey, columnsByNormalizedKey }
}

const readTargetPickerOptionValue = (
    row: Record<string, unknown>,
    field: string,
    columns: AppDataResponse['columns'] | undefined,
    lookup = buildTargetPickerOptionLookup(row, columns)
): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field]

    const normalizedField = normalizeRuntimeColumnKey(field)
    if (lookup.rowValuesByNormalizedKey.has(normalizedField)) return lookup.rowValuesByNormalizedKey.get(normalizedField)

    const matchedColumn = lookup.columnsByNormalizedKey.get(normalizedField)
    if (!matchedColumn) return undefined

    if (Object.prototype.hasOwnProperty.call(row, matchedColumn.field)) return row[matchedColumn.field]
    if (Object.prototype.hasOwnProperty.call(row, matchedColumn.codename)) return row[matchedColumn.codename]
    return undefined
}

const readTargetPickerFallbackLabel = (
    row: Record<string, unknown>,
    columns: AppDataResponse['columns'] | undefined,
    locale: string,
    lookup = buildTargetPickerOptionLookup(row, columns)
): string => {
    const readableColumns = (columns ?? []).filter((column) => !isRuntimeTechnicalFieldName(column.codename || column.field))
    for (const column of readableColumns) {
        const value = formatRuntimeSafeValue(
            readTargetPickerOptionValue(row, column.codename || column.field, columns, lookup),
            locale
        ).trim()
        if (value) return value
    }

    for (const [key, value] of Object.entries(row)) {
        if (key.startsWith('__') || normalizeRuntimeColumnKey(key) === 'codename' || isRuntimeTechnicalFieldName(key)) continue
        const formatted = formatRuntimeSafeValue(value, locale).trim()
        if (formatted) return formatted
    }

    return ''
}

const formatTargetPickerOptionLabel = (
    row: Record<string, unknown>,
    target: DetailsTableTargetPickerConfig | undefined,
    locale: string | undefined,
    fallback: string,
    columns?: AppDataResponse['columns']
): string => {
    const fields = target?.labelFields?.length ? target.labelFields : DEFAULT_RESTORE_TARGET_LABEL_FIELDS
    const lookup = buildTargetPickerOptionLookup(row, columns)
    for (const field of fields) {
        if (normalizeRuntimeColumnKey(field) === 'codename') continue
        const value = formatRuntimeSafeValue(readTargetPickerOptionValue(row, field, columns, lookup), locale ?? 'en').trim()
        if (value) return value
    }
    const fallbackLabel = readTargetPickerFallbackLabel(row, columns, locale ?? 'en', lookup)
    if (fallbackLabel) return fallbackLabel

    return fallback
}

const formatWorkspaceMemberOptionLabel = (member: RuntimeWorkspaceMember, fallback: string, locale = 'en'): string => {
    const name = formatRuntimeSafeValue(member.nickname, locale)
    const email = formatRuntimeSafeValue(member.email, locale)
    if (name && email) return `${name} (${email})`
    if (name) return name
    if (email) return email
    return fallback
}

/**
 * Inner component for detailsTable widget that consumes DashboardDetailsContext.
 * Must be a proper React component (not a plain function) to use hooks.
 */
function RecordsListDetailsTableWidget({
    datasource,
    enableRowReordering,
    rowCountWarning,
    sequencePolicy
}: {
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.list' }>
    enableRowReordering?: boolean
    rowCountWarning?: {
        threshold: number
        message: string | Record<string, unknown>
    }
    sequencePolicy?: SequencePolicy
}) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [orderedRows, setOrderedRows] = useState<Array<Record<string, unknown> & { id: string }>>([])
    const [rowActionsAnchorEl, setRowActionsAnchorEl] = useState<HTMLElement | null>(null)
    const [rowActionsRowId, setRowActionsRowId] = useState<string | null>(null)
    const targetSectionId = readRecordsListTarget(datasource, details)
    const staticSearch = datasource.query?.search?.trim() || undefined
    const runtimeSort = useMemo(
        () => [...(datasource.query?.sort ?? []), ...mapGridSortModel(sortModel)],
        [datasource.query?.sort, sortModel]
    )
    const runtimeFilters = useMemo(
        () => [...(datasource.query?.filters ?? []), ...mapGridFilterModel(filterModel)],
        [datasource.query?.filters, filterModel]
    )
    const limit = enableRowReordering ? REORDER_LIST_LIMIT : paginationModel.pageSize
    const offset = enableRowReordering ? 0 : paginationModel.page * paginationModel.pageSize
    const queryKey = useMemo(
        () =>
            [
                ...(details?.runtimeQueryKeyPrefix ?? []),
                'widget-datasource',
                datasource,
                { limit, offset, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [details?.runtimeQueryKeyPrefix, datasource, limit, offset, runtimeSort, runtimeFilters]
    )

    const query = useQuery({
        queryKey,
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit,
                offset,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                workspaceId: details?.currentWorkspaceId ?? null,
                lifecycleState: datasource.query?.lifecycleState,
                search: staticSearch,
                sort: runtimeSort,
                filters: runtimeFilters
            }),
        enabled: Boolean(details?.apiBaseUrl && details?.applicationId && targetSectionId),
        placeholderData: (previous) => previous
    })

    useEffect(() => {
        setOrderedRows((query.data?.rows ?? []) as Array<Record<string, unknown> & { id: string }>)
    }, [query.data?.rows])

    const presetColumns = useMemo(
        () => applyRuntimeTableColumnPreset(toRuntimeDisplayColumns(query.data?.columns ?? []), details?.tableDefaults?.columnPreset),
        [details?.tableDefaults?.columnPreset, query.data?.columns]
    )
    const effectivePermissions = query.data?.permissions ?? details?.permissions
    const canOpenRowActions =
        effectivePermissions?.editContent === true ||
        effectivePermissions?.createContent === true ||
        effectivePermissions?.deleteContent === true
    const canUseTargetRowActions = Boolean(details?.onOpenRowTarget && targetSectionId)
    const canUseHostRowActions = Boolean(details?.onOpenRowMenu)
    const handleOpenRowActions = useCallback(
        (event: MouseEvent<HTMLElement>, rowId: string) => {
            if (canUseTargetRowActions) {
                event.preventDefault()
                event.stopPropagation()
                setRowActionsAnchorEl(event.currentTarget)
                setRowActionsRowId(rowId)
                return
            }

            details?.onOpenRowMenu?.(event, rowId)
        },
        [canUseTargetRowActions, details]
    )
    const handleCloseRowActions = useCallback(() => {
        setRowActionsAnchorEl(null)
        setRowActionsRowId(null)
    }, [])
    const handleSelectRowAction = useCallback(
        (action: DashboardRowTargetAction) => {
            const rowId = rowActionsRowId
            handleCloseRowActions()
            if (!rowId || !targetSectionId) return

            details?.onOpenRowTarget?.(
                {
                    rowId,
                    sectionId: targetSectionId,
                    sectionCodename: datasource.sectionCodename,
                    objectCollectionId: targetSectionId,
                    objectCollectionCodename: datasource.sectionCodename
                },
                action
            )
        },
        [datasource.sectionCodename, details, handleCloseRowActions, rowActionsRowId, targetSectionId]
    )

    const reorderMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-reorder', targetSectionId],
        mutationFn: async (nextRows: Array<Record<string, unknown> & { id: string }>) => {
            if (!details?.apiBaseUrl || !details.applicationId || !targetSectionId) {
                throw new Error(t('app.reorderUnavailable', 'Row reordering is not available for this table.'))
            }

            await reorderAppRows({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                objectCollectionId: targetSectionId,
                sectionId: targetSectionId,
                workspaceId: details.currentWorkspaceId,
                orderedRowIds: nextRows.map((row) => row.id),
                expectedVersionsByRowId: nextRows.reduce<Record<string, number>>((acc, row) => {
                    const version = readRuntimeRowVersion(row)
                    if (typeof version === 'number') acc[row.id] = version
                    return acc
                }, {})
            })
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })

    const columns = useMemo(() => {
        if (!query.data) return []
        const baseColumns = toGridColumns(createGridColumnSource(presetColumns, query.data.rows, query.data.pagination.total), {
            locale: details?.locale ?? 'en',
            onMenuOpen: canOpenRowActions && (canUseTargetRowActions || canUseHostRowActions) ? handleOpenRowActions : undefined,
            actionsAriaLabel: t('app.actions', 'Actions')
        })
        if (!sequencePolicy) return baseColumns

        const sequenceColumns = [
            {
                field: '__runtimeSequenceAvailability',
                headerName: t('sequence.availability', 'Availability'),
                minWidth: 150,
                sortable: false,
                filterable: false,
                renderCell: (params) => {
                    const reason = String(params.value ?? 'available')
                    const isAvailable = reason === 'available'
                    return (
                        <Chip
                            size='small'
                            color={isAvailable ? 'success' : 'default'}
                            variant={isAvailable ? 'filled' : 'outlined'}
                            label={
                                isAvailable
                                    ? t('sequence.available', 'Available')
                                    : t(
                                          `sequence.reasons.${reason}`,
                                          SEQUENCE_REASON_FALLBACK_LABELS[reason] ?? reason.replace(/([A-Z])/g, ' $1').toLowerCase()
                                      )
                            }
                        />
                    )
                }
            },
            {
                field: '__runtimeSequenceLockedBy',
                headerName: t('sequence.lockedBy', 'Locked by'),
                minWidth: 160,
                sortable: false,
                filterable: false,
                renderCell: (params) => (
                    <Typography variant='body2' color='text.secondary'>
                        {String(params.value ?? '')}
                    </Typography>
                )
            }
        ] satisfies GridColDef[]

        return [...sequenceColumns, ...baseColumns]
    }, [
        canOpenRowActions,
        canUseHostRowActions,
        canUseTargetRowActions,
        details?.locale,
        handleOpenRowActions,
        presetColumns,
        query.data,
        sequencePolicy,
        t
    ])
    const flowListColumns = useMemo(() => buildFlowListColumns(presetColumns, details?.locale ?? 'en'), [details?.locale, presetColumns])

    const setPaginationModel = (model: GridPaginationModel) => {
        setPaginationModelState(model)
    }

    const setSortModel = (model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const setFilterModel = (model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    if (!details?.apiBaseUrl || !details.applicationId || !targetSectionId) {
        return <CurrentDetailsTableWidget />
    }

    const canPersistRowReordering =
        enableRowReordering === true &&
        (query.data?.pagination.total ?? 0) === orderedRows.length &&
        orderedRows.length <= REORDER_LIST_LIMIT &&
        orderedRows.length > 0
    const totalRows = query.data?.pagination.total ?? 0
    const warningText =
        rowCountWarning && totalRows >= rowCountWarning.threshold ? readLocalizedWidgetText(rowCountWarning.message, details.locale) : null
    const loadErrorText =
        query.isError && query.error
            ? extractRuntimeErrorMessage(
                  query.error,
                  t('runtime.datasourceLoadError', 'This content view could not be loaded.'),
                  details?.locale ?? 'en'
              )
            : null

    const handleSortableDragEnd = (event: DragEndEvent) => {
        if (!canPersistRowReordering || reorderMutation.isPending) return

        const activeId = String(event.active.id)
        const overId = event.over ? String(event.over.id) : null
        setOrderedRows((rows) => {
            const nextRows = reorderRowsByIds(rows, activeId, overId)
            void reorderMutation.mutateAsync(nextRows).catch(() => {
                setOrderedRows(rows)
            })
            return nextRows
        })
    }

    if (enableRowReordering) {
        return (
            <Stack spacing={1}>
                {warningText ? <Alert severity='warning'>{warningText}</Alert> : null}
                {loadErrorText ? <Alert severity='error'>{loadErrorText}</Alert> : null}
                {!canPersistRowReordering ? (
                    <Typography variant='caption' color='text.secondary'>
                        {t(
                            'app.reorderRequiresCompleteDataset',
                            'Row reordering is available only when all rows are loaded and search is cleared.'
                        )}
                    </Typography>
                ) : null}
                <FlowListTable<Record<string, unknown> & { id: string }>
                    data={orderedRows}
                    customColumns={flowListColumns}
                    isLoading={query.isLoading || query.isFetching || reorderMutation.isPending}
                    sortableRows={canPersistRowReordering}
                    onSortableDragEnd={handleSortableDragEnd}
                    sortStateId={`datasource-${targetSectionId}-row-order`}
                />
            </Stack>
        )
    }

    return (
        <Stack spacing={1}>
            {warningText ? <Alert severity='warning'>{warningText}</Alert> : null}
            {loadErrorText ? <Alert severity='error'>{loadErrorText}</Alert> : null}
            <CustomizedDataGrid
                rows={addSequenceAvailabilityState(
                    (query.data?.rows ?? []) as Array<Record<string, unknown> & { id: string }>,
                    sequencePolicy,
                    {
                        columns: query.data?.columns,
                        locale: details?.locale,
                        lockedByFallback: t('sequence.untitledStep', 'Required step')
                    }
                )}
                columns={columns}
                loading={query.isLoading || query.isFetching}
                rowCount={totalRows}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                sortModel={sortModel}
                onSortModelChange={setSortModel}
                filterModel={filterModel}
                onFilterModelChange={setFilterModel}
                pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                localeText={details.localeText}
            />
            {canUseTargetRowActions ? (
                <Menu
                    anchorEl={rowActionsAnchorEl}
                    open={Boolean(rowActionsAnchorEl)}
                    onClose={handleCloseRowActions}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    {effectivePermissions?.editContent === true ? (
                        <MenuItem onClick={() => handleSelectRowAction('edit')}>
                            <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('app.edit', 'Edit')}
                        </MenuItem>
                    ) : null}
                    {effectivePermissions?.createContent === true ? (
                        <MenuItem onClick={() => handleSelectRowAction('copy')}>
                            <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('app.copy', 'Copy')}
                        </MenuItem>
                    ) : null}
                    {effectivePermissions?.deleteContent === true ? (
                        <MenuItem onClick={() => handleSelectRowAction('delete')} sx={{ color: 'error.main' }}>
                            <DeleteOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {t('app.delete', 'Delete')}
                        </MenuItem>
                    ) : null}
                </Menu>
            ) : null}
        </Stack>
    )
}

function RecordsUnionDetailsTableWidget({
    datasource,
    showViewToggle,
    showSearch,
    targetFilters,
    createTargets,
    rowActions,
    restoreTarget
}: {
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'records.union' }>
    showViewToggle?: boolean
    showSearch?: boolean
    targetFilters?: DetailsTableWidgetConfig['targetFilters']
    createTargets?: DetailsTableWidgetConfig['createTargets']
    rowActions?: DetailsTableWidgetConfig['rowActions']
    restoreTarget?: DetailsTableWidgetConfig['restoreTarget']
}) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const queryClient = useQueryClient()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [searchValue, setSearchValue] = useState('')
    const [selectedTargetFilterId, setSelectedTargetFilterId] = useState('')
    const [rowMenuAnchorEl, setRowMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [rowMenuTarget, setRowMenuTarget] = useState<DashboardRowTarget | null>(null)
    const [rowMenuRow, setRowMenuRow] = useState<Record<string, unknown> | null>(null)
    const [restoreDialogRow, setRestoreDialogRow] = useState<Record<string, unknown> | null>(null)
    const [selectedRestoreTargetId, setSelectedRestoreTargetId] = useState('')
    const [targetActionDialog, setTargetActionDialog] = useState<{
        action: DetailsTableTargetFieldAction
        row: Record<string, unknown>
    } | null>(null)
    const [selectedTargetActionTargetId, setSelectedTargetActionTargetId] = useState('')
    const [shareDialog, setShareDialog] = useState<{
        action: DetailsTableLibraryAction
        row: Record<string, unknown>
    } | null>(null)
    const [selectedSharePrincipalId, setSelectedSharePrincipalId] = useState('')
    const defaultViewMode = details?.tableDefaults?.defaultViewMode ?? 'table'
    const [viewMode, setViewMode] = useViewPreference(`records-union-details-view:${datasource.id ?? 'default'}`, defaultViewMode)
    const targets = useMemo(() => readRecordsUnionTargets(datasource, details), [datasource, details])
    const availableTargetFilters = useMemo(
        () => (targetFilters ?? []).filter((filter) => targets.some((target) => recordsUnionTargetMatchesFilter(target, filter))),
        [targetFilters, targets]
    )
    useEffect(() => {
        if (selectedTargetFilterId && !availableTargetFilters.some((filter) => filter.id === selectedTargetFilterId)) {
            setSelectedTargetFilterId('')
        }
    }, [availableTargetFilters, selectedTargetFilterId])
    const selectedTargetFilter = availableTargetFilters.find((filter) => filter.id === selectedTargetFilterId)
    const filteredTargets = useMemo(
        () => (selectedTargetFilter ? targets.filter((target) => recordsUnionTargetMatchesFilter(target, selectedTargetFilter)) : targets),
        [selectedTargetFilter, targets]
    )
    const libraryRowActions = useMemo(
        () => (rowActions ?? []).filter((action): action is DetailsTableLibraryAction => action.kind === 'library.toggle'),
        [rowActions]
    )
    const targetFieldActions = useMemo(
        () => (rowActions ?? []).filter((action): action is DetailsTableTargetFieldAction => action.kind === 'field.updateWithTarget'),
        [rowActions]
    )
    const staticSearch = datasource.query?.search?.trim() || undefined
    const runtimeSearch = searchValue.trim() || staticSearch
    const runtimeSort = useMemo(
        () => [...(datasource.query?.sort ?? []), ...mapGridSortModel(sortModel)],
        [datasource.query?.sort, sortModel]
    )
    const runtimeFilters = useMemo(
        () => [...(datasource.query?.filters ?? []), ...mapGridFilterModel(filterModel)],
        [datasource.query?.filters, filterModel]
    )
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const requestDatasource = useMemo(
        () => ({
            ...datasource,
            targets: filteredTargets,
            query: {
                ...(datasource.query ?? {}),
                ...(runtimeSearch ? { search: runtimeSearch } : {}),
                ...(runtimeSort.length > 0 ? { sort: runtimeSort } : {}),
                ...(runtimeFilters.length > 0 ? { filters: runtimeFilters } : {})
            }
        }),
        [datasource, filteredTargets, runtimeFilters, runtimeSearch, runtimeSort]
    )
    const queryKey = useMemo(
        () =>
            [
                ...(details?.runtimeQueryKeyPrefix ?? []),
                'widget-datasource-union',
                requestDatasource,
                { limit, offset, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [details?.runtimeQueryKeyPrefix, requestDatasource, limit, offset, runtimeSort, runtimeFilters]
    )

    const query = useQuery({
        queryKey,
        queryFn: async () => {
            const response = await fetchRuntimeRecordsUnion({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                locale: details?.locale ?? 'en',
                limit,
                offset,
                workspaceId: details?.currentWorkspaceId ?? null,
                datasource: requestDatasource
            })
            return {
                columns: applyRuntimeTableColumnPreset(toUnionDisplayColumns(response.columns), details?.tableDefaults?.columnPreset),
                total: response.pagination.total ?? response.rows.length,
                rows: response.rows
            }
        },
        enabled: Boolean(details?.apiBaseUrl && details?.applicationId && filteredTargets.length > 0),
        placeholderData: (previous) => previous
    })
    const restoreTargetObjectCollectionId = resolveTargetPickerObjectCollectionId(restoreTarget, details)
    const restoreTargetObjectCollectionCodename = resolveTargetPickerObjectCollectionCodename(restoreTarget)
    const restoreTargetQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'widget-datasource-union-restore-targets',
            restoreTargetObjectCollectionId ?? restoreTargetObjectCollectionCodename,
            { workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                limit: 100,
                offset: 0,
                locale: details?.locale ?? 'en',
                objectCollectionId: restoreTargetObjectCollectionId,
                objectCollectionCodename: restoreTargetObjectCollectionId ? undefined : restoreTargetObjectCollectionCodename,
                workspaceId: details?.currentWorkspaceId ?? null
            }),
        enabled: Boolean(
            restoreDialogRow &&
                restoreTarget &&
                details?.apiBaseUrl &&
                details?.applicationId &&
                (restoreTargetObjectCollectionId || restoreTargetObjectCollectionCodename)
        )
    })
    const activeTargetFieldAction = targetActionDialog?.action
    const targetActionObjectCollectionId = resolveTargetPickerObjectCollectionId(activeTargetFieldAction, details)
    const targetActionObjectCollectionCodename = resolveTargetPickerObjectCollectionCodename(activeTargetFieldAction)
    const targetActionQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'widget-datasource-union-target-field-targets',
            activeTargetFieldAction?.id ?? null,
            targetActionObjectCollectionId ?? targetActionObjectCollectionCodename,
            { workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                limit: 100,
                offset: 0,
                locale: details?.locale ?? 'en',
                objectCollectionId: targetActionObjectCollectionId,
                objectCollectionCodename: targetActionObjectCollectionId ? undefined : targetActionObjectCollectionCodename,
                workspaceId: details?.currentWorkspaceId ?? null
            }),
        enabled: Boolean(
            targetActionDialog &&
                activeTargetFieldAction &&
                details?.apiBaseUrl &&
                details?.applicationId &&
                (targetActionObjectCollectionId || targetActionObjectCollectionCodename)
        )
    })
    const shareMembersQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'widget-datasource-union-share-members',
            { workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            fetchRuntimeWorkspaceMembers({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                workspaceId: details!.currentWorkspaceId!,
                params: { limit: 100, offset: 0 }
            }),
        enabled: Boolean(
            shareDialog &&
                details?.apiBaseUrl &&
                details?.applicationId &&
                details?.currentWorkspaceId &&
                shareDialog.action.principalTarget === 'workspaceMember'
        )
    })

    const restoreMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-union-restore'],
        mutationFn: async ({ row, target }: { row: Record<string, unknown>; target?: RuntimeRestoreTarget }) => {
            const sourceRowId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : null
            const objectCollectionId = typeof row.__runtimeObjectCollectionId === 'string' ? row.__runtimeObjectCollectionId : null
            if (!details?.apiBaseUrl || !details.applicationId || !sourceRowId || !objectCollectionId) {
                throw new Error(t('trash.restoreUnavailable', 'Restore is not available for this row.'))
            }

            await restoreAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: sourceRowId,
                objectCollectionId,
                sectionId: objectCollectionId,
                expectedVersion: readRuntimeRowVersion(row),
                restoreTarget: target
            })
        },
        onSuccess: async () => {
            setRestoreDialogRow(null)
            setSelectedRestoreTargetId('')
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })
    const libraryRelationMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-union-library-relation'],
        mutationFn: async ({
            row,
            relationKey,
            active,
            principalType,
            principalId
        }: {
            row: Record<string, unknown>
            relationKey: 'starred' | 'shared'
            active: boolean
            principalType?: 'workspaceMember' | 'user'
            principalId?: string
        }) => {
            const sourceRowId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : null
            const objectCollectionId = typeof row.__runtimeObjectCollectionId === 'string' ? row.__runtimeObjectCollectionId : null
            if (!details?.apiBaseUrl || !details.applicationId || !sourceRowId || !objectCollectionId) {
                throw new Error(t('runtime.libraryActionUnavailable', 'This action is not available for this row.'))
            }

            await setRuntimeLibraryRelation({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: sourceRowId,
                objectCollectionId,
                relationKey,
                active,
                principalType,
                principalId
            })
        },
        onSuccess: async () => {
            setShareDialog(null)
            setSelectedSharePrincipalId('')
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })
    const targetFieldMutation = useMutation({
        mutationKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'widget-datasource-union-target-field-update'],
        mutationFn: async ({
            row,
            action,
            target
        }: {
            row: Record<string, unknown>
            action: DetailsTableTargetFieldAction
            target: Record<string, unknown>
        }) => {
            const sourceRowId = typeof row.__runtimeSourceRowId === 'string' ? row.__runtimeSourceRowId : null
            const objectCollectionId = typeof row.__runtimeObjectCollectionId === 'string' ? row.__runtimeObjectCollectionId : null
            const targetRecordId = typeof target.id === 'string' && target.id.trim() ? target.id.trim() : null
            if (!details?.apiBaseUrl || !details.applicationId || !sourceRowId || !objectCollectionId || !targetRecordId) {
                throw new Error(t('runtime.targetActionUnavailable', 'This action is not available for this row.'))
            }

            await updateAppRow({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                rowId: sourceRowId,
                objectCollectionId,
                sectionId: objectCollectionId,
                workspaceId: details.currentWorkspaceId,
                expectedVersion: readRuntimeRowVersion(row),
                data: { [action.fieldCodename]: targetRecordId }
            })
        },
        onSuccess: async () => {
            setTargetActionDialog(null)
            setSelectedTargetActionTargetId('')
            await queryClient.invalidateQueries({ queryKey })
            if (details?.runtimeQueryKeyPrefix) {
                await queryClient.invalidateQueries({ queryKey: details.runtimeQueryKeyPrefix })
            }
        }
    })
    const restoreTargetOptions = restoreTargetQuery.data?.rows ?? []
    const selectedRestoreTarget = restoreTargetOptions.find((row) => row.id === selectedRestoreTargetId)
    const selectedRestoreTargetObjectCollectionId =
        restoreTargetObjectCollectionId ??
        restoreTargetQuery.data?.activeObjectCollectionId ??
        (typeof selectedRestoreTarget?.__runtimeObjectCollectionId === 'string'
            ? selectedRestoreTarget.__runtimeObjectCollectionId
            : undefined)
    const restoreTargetDialogTitle =
        (restoreTarget?.dialogTitle ? readLocalizedWidgetText(restoreTarget.dialogTitle, details?.locale) : undefined) ??
        t('trash.restoreTargetTitle', 'Restore to target')
    const restoreTargetLabel =
        (restoreTarget?.targetLabel ? readLocalizedWidgetText(restoreTarget.targetLabel, details?.locale) : undefined) ??
        t('trash.restoreTargetLabel', 'Target')
    const restoreTargetHelp = restoreTargetQuery.isLoading
        ? t('trash.restoreTargetLoading', 'Loading available targets...')
        : restoreTargetOptions.length === 0
        ? t('trash.restoreTargetEmpty', 'No available targets were found.')
        : t('trash.restoreTargetHelp', 'Choose where this record should be restored.')
    const targetActionOptions = targetActionQuery.data?.rows ?? []
    const selectedTargetActionTarget = targetActionOptions.find((row) => row.id === selectedTargetActionTargetId)
    const targetActionDialogTitle =
        (activeTargetFieldAction?.dialogTitle
            ? readLocalizedWidgetText(activeTargetFieldAction.dialogTitle, details?.locale)
            : undefined) ?? t('runtime.targetActionTitle', 'Choose target')
    const targetActionLabel =
        (activeTargetFieldAction?.targetLabel
            ? readLocalizedWidgetText(activeTargetFieldAction.targetLabel, details?.locale)
            : undefined) ?? t('runtime.targetActionLabel', 'Target')
    const targetActionSubmitLabel =
        (activeTargetFieldAction?.label ? readLocalizedWidgetText(activeTargetFieldAction.label, details?.locale) : undefined) ??
        t('runtime.targetActionSubmit', 'Apply')
    const targetActionHelp = targetActionQuery.isLoading
        ? t('runtime.targetActionLoading', 'Loading available targets...')
        : targetActionOptions.length === 0
        ? t('runtime.targetActionEmpty', 'No available targets were found.')
        : t('runtime.targetActionHelp', 'Choose the target for this action.')
    const shareMemberOptions = shareMembersQuery.data?.items ?? []
    const selectedShareMember = shareMemberOptions.find((member) => member.userId === selectedSharePrincipalId)
    const shareDialogTitle =
        (shareDialog?.action.dialogTitle ? readLocalizedWidgetText(shareDialog.action.dialogTitle, details?.locale) : undefined) ??
        t('runtime.shareTitle', 'Share')
    const shareTargetLabel =
        (shareDialog?.action.targetLabel ? readLocalizedWidgetText(shareDialog.action.targetLabel, details?.locale) : undefined) ??
        t('runtime.shareTargetLabel', 'Workspace member')
    const shareHelp = shareMembersQuery.isLoading
        ? t('runtime.shareLoading', 'Loading workspace members...')
        : shareMemberOptions.length === 0
        ? t('runtime.shareEmpty', 'No workspace members were found.')
        : t('runtime.shareHelp', 'Choose who should get access to this item.')
    const handleRestoreRow = useCallback(
        (row: Record<string, unknown>) => {
            restoreMutation.reset()
            if (restoreTarget) {
                setRestoreDialogRow(row)
                setSelectedRestoreTargetId('')
                return
            }
            restoreMutation.mutate({ row })
        },
        [restoreMutation, restoreTarget]
    )
    const handleCloseRestoreDialog = useCallback(() => {
        if (restoreMutation.isPending) return
        restoreMutation.reset()
        setRestoreDialogRow(null)
        setSelectedRestoreTargetId('')
    }, [restoreMutation])
    const handleConfirmRestoreTarget = useCallback(() => {
        if (!restoreDialogRow || !restoreTarget || !selectedRestoreTarget) return
        const targetObjectCollectionId = selectedRestoreTargetObjectCollectionId
        if (typeof targetObjectCollectionId !== 'string' || !targetObjectCollectionId.trim()) return

        restoreMutation.mutate({
            row: restoreDialogRow,
            target: {
                mode: 'target',
                targetObjectCollectionId: targetObjectCollectionId.trim(),
                targetRecordId: selectedRestoreTarget.id,
                targetWorkspaceId: details?.currentWorkspaceId ?? null,
                parentFieldCodename: restoreTarget.parentFieldCodename
            }
        })
    }, [
        details?.currentWorkspaceId,
        restoreDialogRow,
        restoreMutation,
        restoreTarget,
        selectedRestoreTargetObjectCollectionId,
        selectedRestoreTarget
    ])
    const hasLibraryRowActions = libraryRowActions.length > 0 && Boolean(details?.apiBaseUrl && details?.applicationId)
    const hasTargetFieldActions =
        targetFieldActions.length > 0 &&
        details?.permissions?.editContent === true &&
        Boolean(details?.apiBaseUrl && details?.applicationId)
    const canOpenRowTargetActions =
        datasource.query?.lifecycleState !== 'deleted' &&
        (hasLibraryRowActions ||
            hasTargetFieldActions ||
            (Boolean(details?.onOpenRowTarget) &&
                (details?.permissions?.editContent === true ||
                    details?.permissions?.createContent === true ||
                    details?.permissions?.deleteContent === true)))
    const handleOpenRowTargetMenu = useCallback(
        (event: MouseEvent<HTMLElement>, rowId: string) => {
            if (!canOpenRowTargetActions) return

            const row = query.data?.rows.find((candidate) => String(candidate.id) === rowId) ?? null
            const target = readRecordsUnionRowTarget(row)
            if (!target) return

            event.preventDefault()
            event.stopPropagation()
            setRowMenuAnchorEl(event.currentTarget)
            setRowMenuTarget(target)
            setRowMenuRow(row)
        },
        [canOpenRowTargetActions, query.data?.rows]
    )
    const handleCloseRowTargetMenu = useCallback(() => {
        setRowMenuAnchorEl(null)
        setRowMenuTarget(null)
        setRowMenuRow(null)
    }, [])
    const handleSelectTargetFieldAction = useCallback(
        (action: DetailsTableTargetFieldAction) => {
            const row = rowMenuRow
            handleCloseRowTargetMenu()
            if (!row) return
            targetFieldMutation.reset()
            setTargetActionDialog({ action, row })
            setSelectedTargetActionTargetId('')
        },
        [handleCloseRowTargetMenu, rowMenuRow, targetFieldMutation]
    )
    const handleCloseTargetActionDialog = useCallback(() => {
        if (targetFieldMutation.isPending) return
        targetFieldMutation.reset()
        setTargetActionDialog(null)
        setSelectedTargetActionTargetId('')
    }, [targetFieldMutation])
    const handleConfirmTargetFieldAction = useCallback(() => {
        if (!targetActionDialog || !selectedTargetActionTarget) return
        targetFieldMutation.mutate({
            row: targetActionDialog.row,
            action: targetActionDialog.action,
            target: selectedTargetActionTarget
        })
    }, [selectedTargetActionTarget, targetActionDialog, targetFieldMutation])
    const handleCloseShareDialog = useCallback(() => {
        if (libraryRelationMutation.isPending) return
        libraryRelationMutation.reset()
        setShareDialog(null)
        setSelectedSharePrincipalId('')
    }, [libraryRelationMutation])
    const handleConfirmShareDialog = useCallback(() => {
        if (!shareDialog || !selectedShareMember) return
        libraryRelationMutation.mutate({
            row: shareDialog.row,
            relationKey: 'shared',
            active: true,
            principalType: 'workspaceMember',
            principalId: selectedShareMember.userId
        })
    }, [libraryRelationMutation, selectedShareMember, shareDialog])
    const handleSelectRowTargetAction = useCallback(
        (action: DashboardRowTargetAction) => {
            const target = rowMenuTarget
            handleCloseRowTargetMenu()
            if (!target) return
            details?.onOpenRowTarget?.(target, action)
        },
        [details, handleCloseRowTargetMenu, rowMenuTarget]
    )
    const handleSelectLibraryRowAction = useCallback(
        (action: DetailsTableLibraryAction) => {
            const row = rowMenuRow
            const active = action.libraryView === 'shared' ? row?.__runtimeShared === true : row?.__runtimeStarred === true
            handleCloseRowTargetMenu()
            if (!row) return
            if (action.libraryView === 'shared' && action.principalTarget === 'workspaceMember') {
                libraryRelationMutation.reset()
                setShareDialog({ action, row })
                setSelectedSharePrincipalId('')
                return
            }
            libraryRelationMutation.mutate({ row, relationKey: action.libraryView, active: !active })
        },
        [handleCloseRowTargetMenu, libraryRelationMutation, rowMenuRow]
    )
    const buildRowActionsLabel = useCallback(
        (row: Record<string, unknown>) => {
            const locale = details?.locale ?? 'en'
            const readableName =
                formatRuntimeSafeValue(
                    row.title ?? row.Title ?? row.name ?? row.Name ?? row.displayName ?? row.DisplayName,
                    locale
                ).trim() || t('app.createTargetFallback', 'Record')
            return t('app.rowActionsFor', 'Actions for {{name}}', { name: readableName })
        },
        [details?.locale, t]
    )
    const buildCardRowAction = (row: Record<string, unknown> & { id: string }) => {
        if (datasource.query?.lifecycleState === 'deleted') {
            return (
                <Tooltip title={t('trash.restore', 'Restore')}>
                    <span>
                        <IconButton
                            size='small'
                            aria-label={t('trash.restore', 'Restore')}
                            disabled={restoreMutation.isPending}
                            onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                handleRestoreRow(row)
                            }}
                            sx={{ width: 28, height: 28, p: 0.25 }}
                        >
                            <RestoreRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </span>
                </Tooltip>
            )
        }

        if (!canOpenRowTargetActions || !readRecordsUnionRowTarget(row)) return undefined

        return (
            <IconButton
                size='small'
                data-testid={`records-union-card-actions-${row.id}`}
                aria-label={buildRowActionsLabel(row)}
                onClick={(event) => handleOpenRowTargetMenu(event, String(row.id))}
                sx={{ width: 28, height: 28, p: 0.25 }}
            >
                <MoreVertRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
        )
    }

    const columns = useMemo(() => {
        if (!query.data) return []
        const baseColumns = toGridColumns(createGridColumnSource(query.data.columns, query.data.rows, query.data.total), {
            locale: details?.locale ?? 'en',
            actionsAriaLabel: t('app.actions', 'Actions'),
            getRowActionsAriaLabel: buildRowActionsLabel,
            onMenuOpen: canOpenRowTargetActions ? handleOpenRowTargetMenu : undefined
        })

        if (datasource.query?.lifecycleState !== 'deleted') {
            return baseColumns
        }

        return [
            ...baseColumns,
            {
                field: '__runtimeRestore',
                headerName: t('trash.actions', 'Actions'),
                width: 130,
                sortable: false,
                filterable: false,
                disableColumnMenu: true,
                renderCell: (params) => (
                    <Button
                        type='button'
                        size='small'
                        variant='outlined'
                        startIcon={<RestoreRoundedIcon fontSize='small' />}
                        disabled={restoreMutation.isPending}
                        onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            handleRestoreRow(params.row)
                        }}
                    >
                        {t('trash.restore', 'Restore')}
                    </Button>
                )
            } satisfies GridColDef
        ]
    }, [
        canOpenRowTargetActions,
        buildRowActionsLabel,
        datasource.query?.lifecycleState,
        details?.locale,
        handleOpenRowTargetMenu,
        handleRestoreRow,
        query.data,
        restoreMutation,
        t
    ])
    const [columnVisibilityModel, setColumnVisibilityModel, columnVisibilityOptions] = useRuntimeColumnVisibilityPreference(
        `records-union:${details?.applicationId ?? 'app'}:${
            datasource.id ??
            (targets
                .map(
                    (target) =>
                        target.objectCollectionId ??
                        target.objectCollectionCodename ??
                        target.sectionId ??
                        target.sectionCodename ??
                        target.displayType ??
                        ''
                )
                .filter(Boolean)
                .join('|') ||
                'default')
        }`,
        columns
    )

    const setPaginationModel = (model: GridPaginationModel) => {
        setPaginationModelState(model)
    }

    const setSortModel = (model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const setFilterModel = (model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearchValue(event.target.value)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    const handleTargetFilterChange = (event: SelectChangeEvent) => {
        setSelectedTargetFilterId(String(event.target.value))
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    if (!details?.apiBaseUrl || !details.applicationId || filteredTargets.length === 0) {
        return (
            <Stack spacing={1} data-testid='records-union-details-table'>
                <Alert severity='info'>
                    {t(
                        'runtime.datasourceUnavailable',
                        'This content view is not available yet. Check the application runtime configuration.'
                    )}
                </Alert>
            </Stack>
        )
    }

    const totalRows = query.data?.total ?? 0
    const pageSize = paginationModel.pageSize
    const page = paginationModel.page
    const paginationState = {
        currentPage: page + 1,
        pageSize,
        totalItems: totalRows,
        totalPages: Math.ceil(totalRows / pageSize) || 1,
        hasNextPage: (page + 1) * pageSize < totalRows,
        hasPreviousPage: page > 0
    }
    const paginationActions = {
        goToPage: (nextPage: number) => setPaginationModel({ page: Math.max(0, nextPage - 1), pageSize }),
        nextPage: () => setPaginationModel({ page: page + 1, pageSize }),
        previousPage: () => setPaginationModel({ page: Math.max(0, page - 1), pageSize }),
        setPageSize: (nextPageSize: number) => setPaginationModel({ page: 0, pageSize: nextPageSize }),
        setSearch: () => undefined,
        setSort: () => undefined
    }
    const cardColumns = (query.data?.columns ?? []).filter((column) => column.field !== 'id' && column.field !== 'actions')
    const showColumnVisibilityControl = viewMode === 'table' && columnVisibilityOptions.length > 1
    const showTargetFilter = availableTargetFilters.length > 0
    const targetFilterLabel = t('toolbar.typeFilter', 'Type')
    const showToolbar = showSearch || showTargetFilter || showViewToggle || (createTargets?.length ?? 0) > 0 || showColumnVisibilityControl
    const loadErrorText =
        query.isError && query.error
            ? extractRuntimeErrorMessage(
                  query.error,
                  t('runtime.datasourceLoadError', 'This content view could not be loaded.'),
                  details?.locale ?? 'en'
              )
            : null

    return (
        <Stack spacing={2} data-testid='records-union-details-table'>
            {showToolbar ? (
                <ViewHeaderMUI
                    search={showSearch}
                    searchValue={searchValue}
                    onSearchChange={handleSearchChange}
                    controlsWrap={showSearch || showTargetFilter}
                >
                    <Stack
                        direction='row'
                        spacing={1}
                        sx={{
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            justifyContent: { xs: 'stretch', sm: 'flex-start' },
                            minWidth: 0,
                            width: { xs: '100%', sm: 'auto' }
                        }}
                    >
                        {showTargetFilter ? (
                            <FormControl
                                size='small'
                                data-testid='records-union-target-filter'
                                sx={{
                                    flex: { xs: '1 1 100%', sm: '0 0 auto' },
                                    maxWidth: { xs: 'calc(100vw - 48px)', sm: 'none' },
                                    minWidth: { xs: 0, sm: 180 },
                                    width: { xs: '100%', sm: 'auto' }
                                }}
                            >
                                <InputLabel id={`records-union-target-filter-${datasource.id ?? 'default'}-label`}>
                                    {targetFilterLabel}
                                </InputLabel>
                                <Select
                                    labelId={`records-union-target-filter-${datasource.id ?? 'default'}-label`}
                                    label={targetFilterLabel}
                                    value={selectedTargetFilterId}
                                    onChange={handleTargetFilterChange}
                                    inputProps={{ 'aria-label': targetFilterLabel }}
                                >
                                    <MenuItem value=''>{t('toolbar.allTypes', 'All types')}</MenuItem>
                                    {availableTargetFilters.map((filter) => (
                                        <MenuItem key={filter.id} value={filter.id}>
                                            {readLocalizedWidgetText(filter.label, details?.locale)}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : null}
                        <DetailsTableCreateTargetMenu createTargets={createTargets} />
                        {showViewToggle || showColumnVisibilityControl ? (
                            <ToolbarControls
                                viewToggleEnabled={showViewToggle}
                                viewMode={viewMode === 'card' ? 'card' : 'list'}
                                onViewModeChange={(mode) => setViewMode(mode === 'card' ? 'card' : 'table')}
                                columnVisibilityControl={
                                    showColumnVisibilityControl
                                        ? {
                                              options: columnVisibilityOptions,
                                              onToggle: (field, visible) =>
                                                  setColumnVisibilityModel({ ...columnVisibilityModel, [field]: visible })
                                          }
                                        : undefined
                                }
                            />
                        ) : null}
                    </Stack>
                </ViewHeaderMUI>
            ) : null}
            {loadErrorText ? <Alert severity='error'>{loadErrorText}</Alert> : null}
            {viewMode === 'card' ? (
                <>
                    <Grid container spacing={2} data-testid='records-union-card-view'>
                        {(query.data?.rows ?? []).map((row) => {
                            const titleColumn =
                                findRuntimeCardColumn(cardColumns, ['title', 'name', 'displayName']) ??
                                cardColumns.find((column) => normalizeRuntimeColumnKey(column.field) !== 'type') ??
                                cardColumns[0]
                            const descriptionColumns = [
                                findRuntimeCardColumn(cardColumns, ['status', 'publicationStatus', 'resourceType', 'type']),
                                ...cardColumns
                            ].filter((column): column is AppDataResponse['columns'][number] => {
                                if (!column) return false
                                return column.field !== titleColumn?.field && !isTechnicalUnionColumn(column, true)
                            })
                            const description = descriptionColumns
                                .map((column) => formatRuntimeCardValue(row, column, details?.locale))
                                .find((value): value is string => Boolean(value))
                            const cardData: ItemCardData = {
                                name:
                                    formatRuntimeCardValue(row, titleColumn, details?.locale) ??
                                    t('runtime.card.untitled', 'Untitled item'),
                                description
                            }

                            return (
                                <Grid key={row.id} size={{ xs: 12, sm: 6, md: 4 }}>
                                    <ItemCard data={cardData} allowStretch headerAction={buildCardRowAction(row)} />
                                </Grid>
                            )
                        })}
                    </Grid>
                    {totalRows > 0 ? <PaginationControls pagination={paginationState} actions={paginationActions} /> : null}
                </>
            ) : (
                <CustomizedDataGrid
                    rows={query.data?.rows ?? []}
                    columns={columns}
                    loading={query.isLoading || query.isFetching}
                    rowCount={totalRows}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    sortModel={sortModel}
                    onSortModelChange={setSortModel}
                    filterModel={filterModel}
                    onFilterModelChange={setFilterModel}
                    columnVisibilityModel={columnVisibilityModel}
                    onColumnVisibilityModelChange={setColumnVisibilityModel}
                    pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                    localeText={details.localeText}
                />
            )}
            <Dialog open={Boolean(restoreDialogRow)} onClose={handleCloseRestoreDialog} fullWidth maxWidth='xs'>
                <DialogTitle>{restoreTargetDialogTitle}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        {restoreTargetQuery.isFetching ? <LinearProgress /> : null}
                        {restoreTargetQuery.isError ? (
                            <Alert severity='error'>{t('trash.restoreTargetError', 'Restore targets could not be loaded.')}</Alert>
                        ) : null}
                        {restoreMutation.isError ? (
                            <Alert severity='error'>
                                {extractRuntimeErrorMessage(
                                    restoreMutation.error,
                                    t('trash.restoreError', 'Record could not be restored.'),
                                    details?.locale ?? 'en'
                                )}
                            </Alert>
                        ) : null}
                        <FormControl fullWidth size='small' disabled={restoreMutation.isPending || restoreTargetQuery.isFetching}>
                            <InputLabel id='records-union-restore-target-label'>{restoreTargetLabel}</InputLabel>
                            <Select
                                labelId='records-union-restore-target-label'
                                label={restoreTargetLabel}
                                value={selectedRestoreTargetId}
                                onChange={(event) => setSelectedRestoreTargetId(String(event.target.value))}
                            >
                                {restoreTargetOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {formatTargetPickerOptionLabel(
                                            option,
                                            restoreTarget,
                                            details?.locale,
                                            t('trash.restoreTargetUntitled', 'Untitled target'),
                                            restoreTargetQuery.data?.columns
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{restoreTargetHelp}</FormHelperText>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button type='button' onClick={handleCloseRestoreDialog} disabled={restoreMutation.isPending}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={<RestoreRoundedIcon fontSize='small' />}
                        disabled={
                            restoreMutation.isPending ||
                            restoreTargetQuery.isFetching ||
                            !selectedRestoreTarget ||
                            !selectedRestoreTargetObjectCollectionId
                        }
                        onClick={handleConfirmRestoreTarget}
                    >
                        {t('trash.restore', 'Restore')}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={Boolean(targetActionDialog)} onClose={handleCloseTargetActionDialog} fullWidth maxWidth='xs'>
                <DialogTitle>{targetActionDialogTitle}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        {targetActionQuery.isFetching ? <LinearProgress /> : null}
                        {targetActionQuery.isError ? (
                            <Alert severity='error'>{t('runtime.targetActionError', 'Targets could not be loaded.')}</Alert>
                        ) : null}
                        {targetFieldMutation.isError ? (
                            <Alert severity='error'>
                                {extractRuntimeErrorMessage(
                                    targetFieldMutation.error,
                                    t('runtime.targetActionUpdateError', 'Record could not be updated.'),
                                    details?.locale ?? 'en'
                                )}
                            </Alert>
                        ) : null}
                        <FormControl fullWidth size='small' disabled={targetFieldMutation.isPending || targetActionQuery.isFetching}>
                            <InputLabel id='records-union-target-action-label'>{targetActionLabel}</InputLabel>
                            <Select
                                labelId='records-union-target-action-label'
                                label={targetActionLabel}
                                value={selectedTargetActionTargetId}
                                onChange={(event) => setSelectedTargetActionTargetId(String(event.target.value))}
                            >
                                {targetActionOptions.map((option) => (
                                    <MenuItem key={option.id} value={option.id}>
                                        {formatTargetPickerOptionLabel(
                                            option,
                                            activeTargetFieldAction,
                                            details?.locale,
                                            t('runtime.targetActionUntitled', 'Untitled target'),
                                            targetActionQuery.data?.columns
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{targetActionHelp}</FormHelperText>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button type='button' onClick={handleCloseTargetActionDialog} disabled={targetFieldMutation.isPending}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={<DriveFileMoveRoundedIcon fontSize='small' />}
                        disabled={targetFieldMutation.isPending || targetActionQuery.isFetching || !selectedTargetActionTarget}
                        onClick={handleConfirmTargetFieldAction}
                    >
                        {targetActionSubmitLabel}
                    </Button>
                </DialogActions>
            </Dialog>
            <Dialog open={Boolean(shareDialog)} onClose={handleCloseShareDialog} fullWidth maxWidth='xs'>
                <DialogTitle>{shareDialogTitle}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.5} sx={{ pt: 1 }}>
                        {shareMembersQuery.isFetching ? <LinearProgress /> : null}
                        {shareMembersQuery.isError ? (
                            <Alert severity='error'>{t('runtime.shareError', 'Workspace members could not be loaded.')}</Alert>
                        ) : null}
                        {libraryRelationMutation.isError ? (
                            <Alert severity='error'>
                                {extractRuntimeErrorMessage(
                                    libraryRelationMutation.error,
                                    t('runtime.shareUpdateError', 'Access could not be updated.'),
                                    details?.locale ?? 'en'
                                )}
                            </Alert>
                        ) : null}
                        <FormControl fullWidth size='small' disabled={libraryRelationMutation.isPending || shareMembersQuery.isFetching}>
                            <InputLabel id='records-union-share-member-label'>{shareTargetLabel}</InputLabel>
                            <Select
                                labelId='records-union-share-member-label'
                                label={shareTargetLabel}
                                value={selectedSharePrincipalId}
                                onChange={(event) => setSelectedSharePrincipalId(String(event.target.value))}
                            >
                                {shareMemberOptions.map((member) => (
                                    <MenuItem key={member.userId} value={member.userId}>
                                        {formatWorkspaceMemberOptionLabel(
                                            member,
                                            t('runtime.shareUntitledMember', 'Workspace member'),
                                            details?.locale ?? 'en'
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                            <FormHelperText>{shareHelp}</FormHelperText>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button type='button' onClick={handleCloseShareDialog} disabled={libraryRelationMutation.isPending}>
                        {t('app.cancel', 'Cancel')}
                    </Button>
                    <Button
                        type='button'
                        variant='contained'
                        startIcon={<ShareRoundedIcon fontSize='small' />}
                        disabled={libraryRelationMutation.isPending || shareMembersQuery.isFetching || !selectedShareMember}
                        onClick={handleConfirmShareDialog}
                    >
                        {t('runtime.shareSubmit', 'Share')}
                    </Button>
                </DialogActions>
            </Dialog>
            <Menu
                anchorEl={rowMenuAnchorEl}
                open={Boolean(rowMenuAnchorEl)}
                onClose={handleCloseRowTargetMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                {libraryRowActions.map((action) => {
                    const active =
                        action.libraryView === 'shared' ? rowMenuRow?.__runtimeShared === true : rowMenuRow?.__runtimeStarred === true
                    const showActiveState = action.principalTarget !== 'workspaceMember'
                    const label =
                        readLocalizedTextValue(showActiveState && active ? action.activeLabel : action.label, details?.locale ?? 'en') ??
                        (action.libraryView === 'shared'
                            ? showActiveState && active
                                ? t('app.removeFromShared', 'Remove from shared')
                                : action.principalTarget === 'workspaceMember'
                                ? t('runtime.shareSubmit', 'Share')
                                : t('app.addToShared', 'Add to shared')
                            : active
                            ? t('app.unstar', 'Remove from starred')
                            : t('app.star', 'Add to starred'))
                    const Icon = action.libraryView === 'shared' ? ShareRoundedIcon : active ? StarRoundedIcon : StarBorderRoundedIcon

                    return (
                        <MenuItem
                            key={action.id}
                            onClick={() => handleSelectLibraryRowAction(action)}
                            disabled={libraryRelationMutation.isPending}
                        >
                            <Icon fontSize='small' sx={{ mr: 1 }} />
                            {label}
                        </MenuItem>
                    )
                })}
                {targetFieldActions.map((action) => {
                    const label = readLocalizedTextValue(action.label, details?.locale ?? 'en') ?? t('runtime.targetActionSubmit', 'Apply')

                    return details?.permissions?.editContent === true ? (
                        <MenuItem
                            key={action.id}
                            onClick={() => handleSelectTargetFieldAction(action)}
                            disabled={targetFieldMutation.isPending}
                        >
                            <DriveFileMoveRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                            {label}
                        </MenuItem>
                    ) : null
                })}
                {(libraryRowActions.length > 0 || targetFieldActions.length > 0) &&
                (details?.permissions?.editContent === true ||
                    details?.permissions?.createContent === true ||
                    details?.permissions?.deleteContent === true) ? (
                    <Divider />
                ) : null}
                {details?.permissions?.editContent === true ? (
                    <MenuItem onClick={() => handleSelectRowTargetAction('edit')}>
                        <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.edit', 'Edit')}
                    </MenuItem>
                ) : null}
                {details?.permissions?.createContent === true ? (
                    <MenuItem onClick={() => handleSelectRowTargetAction('copy')}>
                        <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.copy', 'Copy')}
                    </MenuItem>
                ) : null}
                {details?.permissions?.deleteContent === true ? (
                    <MenuItem onClick={() => handleSelectRowTargetAction('delete')} sx={{ color: 'error.main' }}>
                        <DeleteOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                        {t('app.delete', 'Delete')}
                    </MenuItem>
                ) : null}
            </Menu>
        </Stack>
    )
}

const toLedgerGridRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { id: string }> =>
    rows.map((row, index) => {
        const data = row.data && typeof row.data === 'object' && !Array.isArray(row.data) ? (row.data as Record<string, unknown>) : row
        const rowId = typeof row.id === 'string' ? row.id : `ledger-row-${index}`
        const gridRow: Record<string, unknown> & { id: string } = {
            ...(typeof row.createdAt !== 'undefined' ? { createdAt: row.createdAt } : {}),
            ...data,
            id: rowId
        }

        if (typeof row.createdAt !== 'undefined') {
            gridRow.createdAt = row.createdAt
        }

        return gridRow
    })

const toLedgerGridHeader = (field: string): string => {
    const humanized = humanizeRuntimeCodename(field)
    if (!humanized) return field

    return humanized.replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase())
}

const toLedgerGridColumns = (rows: Array<Record<string, unknown>>, locale: string): GridColDef[] => {
    const keys = Array.from(
        new Set(
            rows.flatMap((row) =>
                Object.keys(row).filter((key) => key !== 'id' && !key.startsWith('__') && !isRuntimeTechnicalFieldName(key))
            )
        )
    )
    return keys.map((key) => ({
        field: key,
        headerName: toLedgerGridHeader(key),
        flex: 1,
        minWidth: 140,
        renderCell: (params) => formatRuntimeSafeValue(params.value, locale)
    }))
}

function LedgerDetailsTableWidget({
    datasource
}: {
    datasource: Extract<RuntimeDatasourceDescriptor, { kind: 'ledger.facts' | 'ledger.projection' }>
}) {
    const details = useDashboardDetails()
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const targetLedgerId = datasource.ledgerId ?? null
    const targetLedgerCodename = datasource.ledgerCodename ?? null
    const canFetch = Boolean(
        details?.apiBaseUrl &&
            details.applicationId &&
            (targetLedgerId || targetLedgerCodename) &&
            (datasource.kind !== 'ledger.projection' || datasource.projectionCodename)
    )

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'ledger-datasource',
            datasource,
            { limit, offset, locale: details?.locale ?? 'en' }
        ],
        queryFn: async () => {
            if (datasource.kind === 'ledger.facts') {
                return {
                    rows: toLedgerGridRows(
                        (
                            await fetchRuntimeLedgerFacts({
                                apiBaseUrl: details!.apiBaseUrl!,
                                applicationId: details!.applicationId!,
                                ledgerId: targetLedgerId,
                                ledgerCodename: targetLedgerCodename,
                                limit,
                                offset
                            })
                        ).rows
                    )
                }
            }

            return {
                rows: toLedgerGridRows(
                    (
                        await fetchRuntimeLedgerProjection({
                            apiBaseUrl: details!.apiBaseUrl!,
                            applicationId: details!.applicationId!,
                            ledgerId: targetLedgerId,
                            ledgerCodename: targetLedgerCodename,
                            projectionCodename: datasource.projectionCodename,
                            filters: datasource.filters,
                            limit,
                            offset
                        })
                    ).rows
                )
            }
        },
        enabled: canFetch,
        placeholderData: (previous) => previous
    })

    const rows = useMemo(() => query.data?.rows ?? [], [query.data?.rows])
    const columns = useMemo(() => toLedgerGridColumns(rows, details?.locale ?? 'en'), [rows, details?.locale])

    if (!canFetch) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <CustomizedDataGrid
            rows={rows}
            columns={columns}
            loading={query.isLoading || query.isFetching}
            rowCount={rows.length}
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModelState}
            pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
            localeText={details?.localeText}
        />
    )
}

function CurrentDetailsTableWidget() {
    const details = useDashboardDetails()
    if (!details) return null
    return (
        <CustomizedDataGrid
            rows={details.rows}
            columns={details.columns}
            loading={details.loading}
            rowCount={details.rowCount}
            paginationModel={details.paginationModel}
            onPaginationModelChange={details.onPaginationModelChange}
            sortModel={details.sortModel}
            onSortModelChange={details.onSortModelChange}
            filterModel={details.filterModel}
            onFilterModelChange={details.onFilterModelChange}
            pageSizeOptions={details.pageSizeOptions}
            localeText={details.localeText}
        />
    )
}

const toReportGridRows = (rows: Array<Record<string, unknown>>): Array<Record<string, unknown> & { id: string }> =>
    rows.map((row, index) => ({
        id: typeof row.id === 'string' ? row.id : `report-row-${index}`,
        ...row
    }))

const isPrimitiveReportValue = (value: unknown): boolean =>
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'

const formatReportGridValue = (value: unknown, field: string, locale: string): string => {
    if (isRuntimeTechnicalFieldName(field) && isPrimitiveReportValue(value)) return ''
    return formatRuntimeSafeValue(value, locale)
}

const normalizeRuntimeLabel = (value: string): string =>
    value
        .trim()
        .replace(/[-_\s]+/g, '')
        .toLowerCase()

const isSafeExplicitReportLabel = (label: unknown, field: string, locale: string): boolean => {
    const labelText = readLocalizedWidgetText(label, locale)?.trim()
    if (!labelText) return false

    const normalizedLabel = normalizeRuntimeLabel(labelText)
    if (!normalizedLabel || isRuntimeTechnicalFieldName(labelText)) return false

    const normalizedField = normalizeRuntimeLabel(field)
    const normalizedHumanizedField = normalizeRuntimeLabel(humanizeRuntimeCodename(field))
    return normalizedLabel !== normalizedField && normalizedLabel !== normalizedHumanizedField
}

const shouldRenderReportColumn = (column: ReportDefinition['columns'][number], locale: string): boolean =>
    !isRuntimeTechnicalFieldName(column.field) || isSafeExplicitReportLabel(column.label, column.field, locale)

const toReportGridColumns = (definition: ReportDefinition, locale: string): GridColDef[] =>
    definition.columns
        .filter((column) => shouldRenderReportColumn(column, locale))
        .map((column) => ({
            field: column.field,
            headerName: readLocalizedWidgetText(column.label, locale) ?? humanizeRuntimeCodename(column.field) ?? column.field,
            flex: 1,
            minWidth: column.type === 'number' ? 120 : 160,
            type: column.type === 'number' || column.type === 'boolean' ? column.type : 'string',
            renderCell: (params) => formatReportGridValue(params.value, column.field, locale)
        }))

const sanitizeReportFilenameSegment = (value: string): string => {
    const normalized = value.trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

    if (!normalized) return ''

    return normalized
        .replace(/[^\p{L}\p{N} ._-]+/gu, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 96)
}

const buildReportDownloadFilename = (definition: ReportDefinition | undefined, reportCodename: string, locale: string): string => {
    const reportTitle = definition ? readLocalizedWidgetText(definition.title, locale) : undefined
    const filenameSource = reportTitle?.trim() || humanizeRuntimeCodename(reportCodename) || 'runtime-report'
    return `${sanitizeReportFilenameSegment(filenameSource) || 'runtime-report'}.csv`
}

function ReportDetailsTableWidget({ definition, reportCodename }: { definition?: ReportDefinition; reportCodename: string }) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const [paginationModel, setPaginationModelState] = useState<GridPaginationModel>({ page: 0, pageSize: 20 })
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [isExporting, setIsExporting] = useState(false)
    const [exportError, setExportError] = useState<string | null>(null)
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const canFetch = Boolean(details?.apiBaseUrl && details.applicationId)
    const runtimeFilters = useMemo(() => mapGridFilterModel(filterModel), [filterModel])

    const query = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'report-definition',
            reportCodename,
            { limit, offset, filters: runtimeFilters, locale: details?.locale ?? 'en', workspaceId: details?.currentWorkspaceId ?? null }
        ],
        queryFn: () =>
            runRuntimeReport({
                apiBaseUrl: details!.apiBaseUrl!,
                applicationId: details!.applicationId!,
                reportCodename,
                filters: runtimeFilters,
                limit,
                offset,
                locale: details?.locale ?? 'en',
                workspaceId: details?.currentWorkspaceId
            }),
        enabled: canFetch,
        placeholderData: (previous) => previous
    })

    const rows = useMemo(() => toReportGridRows(query.data?.rows ?? []), [query.data?.rows])
    const resolvedDefinition = query.data?.definition ?? definition
    const columns = useMemo(
        () => (resolvedDefinition ? toReportGridColumns(resolvedDefinition, details?.locale ?? 'en') : []),
        [details?.locale, resolvedDefinition]
    )
    const locale = details?.locale ?? 'en'
    const reportLoadError = query.isError
        ? extractRuntimeErrorMessage(query.error, t('reports.loadError', 'Report could not be loaded.'), locale)
        : null

    const handleExport = async () => {
        if (!details?.apiBaseUrl || !details.applicationId) return

        setIsExporting(true)
        setExportError(null)
        try {
            const blob = await exportRuntimeReportCsv({
                apiBaseUrl: details.apiBaseUrl,
                applicationId: details.applicationId,
                reportCodename,
                filters: runtimeFilters,
                limit: 5000,
                offset: 0,
                locale: details.locale ?? 'en',
                workspaceId: details.currentWorkspaceId
            })
            if (typeof URL.createObjectURL !== 'function') {
                throw new Error(t('reports.exportUnsupported'))
            }

            const objectUrl = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = objectUrl
            link.download = buildReportDownloadFilename(resolvedDefinition, reportCodename, details.locale ?? 'en')
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(objectUrl)
        } catch (error) {
            setExportError(
                extractRuntimeErrorMessage(error, t('reports.exportGenericError', 'Report could not be exported.'), details.locale ?? 'en')
            )
        } finally {
            setIsExporting(false)
        }
    }

    const setFilterModel = (model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModelState((current) => ({ ...current, page: 0 }))
    }

    if (!canFetch) {
        return <CurrentDetailsTableWidget />
    }

    return (
        <Stack spacing={1.5} data-testid='runtime-report-details-table'>
            <Stack direction='row' justifyContent='flex-end'>
                <Button
                    type='button'
                    size='small'
                    variant='outlined'
                    startIcon={<FileDownloadRoundedIcon fontSize='small' />}
                    disabled={isExporting}
                    onClick={handleExport}
                >
                    {isExporting ? t('reports.exporting') : t('reports.exportCsv')}
                </Button>
            </Stack>
            {reportLoadError ? <Alert severity='error'>{reportLoadError}</Alert> : null}
            {exportError ? <Alert severity='error'>{t('reports.exportError', { message: exportError })}</Alert> : null}
            <CustomizedDataGrid
                rows={rows}
                columns={columns}
                loading={query.isLoading || query.isFetching}
                rowCount={query.data?.total ?? 0}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModelState}
                filterModel={filterModel}
                onFilterModelChange={setFilterModel}
                pageSizeOptions={DATASOURCE_TABLE_PAGE_SIZE_OPTIONS}
                localeText={details?.localeText}
            />
        </Stack>
    )
}

function ResourcePreviewWidget({ config }: { config?: Record<string, unknown> }) {
    const details = useDashboardDetails()

    return (
        <ResourcePreview
            source={config?.source}
            title={readLocalizedWidgetText(config?.title, details?.locale)}
            description={readLocalizedWidgetText(config?.description, details?.locale)}
        />
    )
}

type LearnerPlayerConfig = {
    parentDatasource?: RuntimeDatasourceDescriptor
    itemsDatasource?: RuntimeDatasourceDescriptor
    parentLabel?: unknown
    parentFieldCodename?: string
    itemTitleFieldCodename?: string
    targetObjectCodenameField?: string
    targetObjectCodename?: string
    targetRecordIdField?: string
    completionTargetObjectCodename?: string
    sequencePolicy?: SequencePolicy
    targetContent?: {
        titleFieldCodename?: string
        descriptionFieldCodename?: string
        sourceFieldCodename?: string
        bodyFieldCodename?: string
    }
}

const readWidgetString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const readWidgetRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

const readLearnerPlayerConfig = (config: Record<string, unknown> | undefined): LearnerPlayerConfig => {
    const targetContent = readWidgetRecord(config?.targetContent)
    return {
        parentDatasource: readWidgetRecord(config?.parentDatasource) as RuntimeDatasourceDescriptor | undefined,
        itemsDatasource: readWidgetRecord(config?.itemsDatasource) as RuntimeDatasourceDescriptor | undefined,
        parentLabel: config?.parentLabel,
        parentFieldCodename: readWidgetString(config?.parentFieldCodename),
        itemTitleFieldCodename: readWidgetString(config?.itemTitleFieldCodename) ?? 'Title',
        targetObjectCodenameField: readWidgetString(config?.targetObjectCodenameField) ?? 'TargetObjectCodename',
        targetObjectCodename: readWidgetString(config?.targetObjectCodename),
        targetRecordIdField: readWidgetString(config?.targetRecordIdField) ?? 'TargetRecordId',
        completionTargetObjectCodename: readWidgetString(config?.completionTargetObjectCodename),
        sequencePolicy: readWidgetRecord(config?.sequencePolicy) as SequencePolicy | undefined,
        targetContent: {
            titleFieldCodename: readWidgetString(targetContent?.titleFieldCodename) ?? 'Title',
            descriptionFieldCodename: readWidgetString(targetContent?.descriptionFieldCodename) ?? 'Description',
            sourceFieldCodename: readWidgetString(targetContent?.sourceFieldCodename) ?? 'Source',
            bodyFieldCodename: readWidgetString(targetContent?.bodyFieldCodename) ?? 'Body'
        }
    }
}

const readSafeRowText = (row: Record<string, unknown> | undefined, field: string | undefined, locale: string | undefined): string => {
    if (!row || !field) return ''
    return formatRuntimeSafeValue(row[field], locale ?? 'en')
}

const readRowString = (row: Record<string, unknown> | undefined, field: string | undefined): string | undefined => {
    if (!row || !field) return undefined
    const value = row[field]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    return undefined
}

type RuntimeColumnAlias = {
    codename?: unknown
    field?: unknown
}

const addColumnCodenameAliases = (
    row: Record<string, unknown> & { id: string },
    columns: readonly RuntimeColumnAlias[] | undefined
): Record<string, unknown> & { id: string } => {
    if (!columns?.length) return row

    const aliases = columns.reduce<Record<string, unknown>>((acc, column) => {
        if (typeof column.codename !== 'string' || typeof column.field !== 'string') {
            return acc
        }
        if (column.codename === column.field || Object.prototype.hasOwnProperty.call(row, column.codename)) {
            return acc
        }
        if (Object.prototype.hasOwnProperty.call(row, column.field)) {
            acc[column.codename] = row[column.field]
        }
        return acc
    }, {})

    return Object.keys(aliases).length > 0 ? { ...row, ...aliases } : row
}

function LearnerPlayerWidget({ config }: { config?: Record<string, unknown> }) {
    const details = useDashboardDetails()
    const queryClient = useQueryClient()
    const { t } = useTranslation('apps')
    const widgetConfig = useMemo(() => readLearnerPlayerConfig(config), [config])
    const parentDatasource = widgetConfig.parentDatasource
    const itemsDatasource = widgetConfig.itemsDatasource
    const applicationId = details?.applicationId
    const apiBaseUrl = details?.apiBaseUrl
    const locale = details?.locale ?? 'en'
    const workspaceId = details?.currentWorkspaceId ?? null
    const showPlayerOutline = details?.pagePlayer?.showOutline ?? true
    const showPlayerProgressHeader = details?.pagePlayer?.showProgressHeader ?? true
    const completeButtonMode = details?.pagePlayer?.completeButtonMode ?? 'manual'

    const parentSectionId = useMemo(
        () => (parentDatasource ? readRecordsListTarget(parentDatasource, details) : undefined),
        [details, parentDatasource]
    )
    const itemsSectionId = useMemo(
        () => (itemsDatasource ? readRecordsListTarget(itemsDatasource, details) : undefined),
        [details, itemsDatasource]
    )

    const parentQuery = useQuery({
        queryKey: [...(details?.runtimeQueryKeyPrefix ?? []), 'learner-player-parents', parentDatasource, workspaceId, locale],
        enabled: Boolean(applicationId && apiBaseUrl && parentDatasource?.kind === 'records.list' && parentSectionId),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: parentSectionId,
                workspaceId,
                limit: 50,
                offset: 0,
                locale,
                sort: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.sort : undefined,
                filters: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.filters : undefined,
                search: parentDatasource?.kind === 'records.list' ? parentDatasource.query?.search : undefined
            })
    })

    const parentRows = useMemo(() => {
        const sourceRows = parentQuery.data?.rows ?? details?.rows ?? []
        const columns = parentQuery.data?.rows ? parentQuery.data.columns : details?.columns
        return sourceRows.map((row) => addColumnCodenameAliases(row, columns))
    }, [details?.columns, details?.rows, parentQuery.data?.columns, parentQuery.data?.rows])
    const [selectedParentId, setSelectedParentId] = useState<string>('')

    useEffect(() => {
        if (parentRows.length === 0) {
            setSelectedParentId('')
            return
        }
        if (parentRows.some((row) => row.id === selectedParentId)) return
        setSelectedParentId(parentRows[0].id)
    }, [parentRows, selectedParentId])

    const itemFilters = useMemo(() => {
        const filters = itemsDatasource?.kind === 'records.list' ? [...(itemsDatasource.query?.filters ?? [])] : []
        if (widgetConfig.parentFieldCodename && selectedParentId) {
            filters.push({ field: widgetConfig.parentFieldCodename, operator: 'equals', value: selectedParentId })
        }
        return filters
    }, [itemsDatasource, selectedParentId, widgetConfig.parentFieldCodename])

    const itemsQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'learner-player-items',
            itemsDatasource,
            selectedParentId,
            workspaceId,
            locale
        ],
        enabled: Boolean(applicationId && apiBaseUrl && itemsDatasource?.kind === 'records.list' && itemsSectionId && selectedParentId),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: itemsSectionId,
                workspaceId,
                limit: 100,
                offset: 0,
                locale,
                sort: itemsDatasource?.kind === 'records.list' ? itemsDatasource.query?.sort : undefined,
                filters: itemFilters,
                search: itemsDatasource?.kind === 'records.list' ? itemsDatasource.query?.search : undefined
            })
    })

    const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(() => new Set())
    const viewedTargetKeyRef = useRef<string | null>(null)
    const viewedCompletionTargetKeyRef = useRef<string | null>(null)
    const autoCompletedItemKeyRef = useRef<string | null>(null)
    const playerRows = useMemo(() => {
        const rows = (itemsQuery.data?.rows ?? []).map((row) => {
            const aliasedRow = addColumnCodenameAliases(row, itemsQuery.data?.columns)
            return completedItemIds.has(row.id) ? { ...aliasedRow, ProgressStatus: 'completed', ProgressPercent: 100 } : aliasedRow
        })
        return addSequenceAvailabilityState(rows, widgetConfig.sequencePolicy, {
            columns: itemsQuery.data?.columns,
            locale,
            lockedByFallback: t('sequence.untitledStep', 'Required step')
        })
    }, [completedItemIds, itemsQuery.data?.columns, itemsQuery.data?.rows, locale, t, widgetConfig.sequencePolicy])
    const completedPlayerItemIds = useMemo(() => {
        const ids = new Set<string>()
        playerRows.forEach((row) => {
            if (completedItemIds.has(row.id) || isSequenceRowCompleted(row)) ids.add(row.id)
        })
        return ids
    }, [completedItemIds, playerRows])
    const [selectedItemId, setSelectedItemId] = useState<string>('')

    useEffect(() => {
        if (playerRows.length === 0) {
            setSelectedItemId('')
            return
        }
        if (playerRows.some((row) => row.id === selectedItemId)) return
        setSelectedItemId(playerRows[0].id)
    }, [playerRows, selectedItemId])

    const selectedItem = playerRows.find((row) => row.id === selectedItemId) ?? playerRows[0]
    const selectedItemIndex = selectedItem ? playerRows.findIndex((row) => row.id === selectedItem.id) : -1
    const selectedItemCompleted = Boolean(selectedItem && completedPlayerItemIds.has(selectedItem.id))
    const selectedItemLocked = Boolean(
        selectedItem?.__runtimeSequenceAvailability && selectedItem.__runtimeSequenceAvailability !== 'available'
    )
    const selectedTargetObjectCodename =
        readRowString(selectedItem, widgetConfig.targetObjectCodenameField) ?? widgetConfig.targetObjectCodename
    const selectedTargetRecordId = readRowString(selectedItem, widgetConfig.targetRecordIdField)
    const selectedCompletionTargetObjectCodename =
        widgetConfig.completionTargetObjectCodename ??
        (itemsDatasource?.kind === 'records.list' ? itemsDatasource.sectionCodename : undefined) ??
        'RuntimeItem'
    const targetSectionId = useMemo(
        () => (selectedTargetObjectCodename ? findRuntimeSectionIdByCodename(details, selectedTargetObjectCodename) : undefined),
        [details, selectedTargetObjectCodename]
    )

    const targetQuery = useQuery({
        queryKey: [
            ...(details?.runtimeQueryKeyPrefix ?? []),
            'learner-player-target',
            selectedTargetObjectCodename,
            selectedTargetRecordId,
            workspaceId,
            locale
        ],
        enabled: Boolean(applicationId && apiBaseUrl && targetSectionId && selectedTargetRecordId && !selectedItemLocked),
        queryFn: () =>
            fetchAppData({
                apiBaseUrl: apiBaseUrl!,
                applicationId: applicationId!,
                objectCollectionId: targetSectionId,
                workspaceId,
                limit: 100,
                offset: 0,
                locale
            })
    })
    const targetRows = useMemo(
        () => (targetQuery.data?.rows ?? []).map((row) => addColumnCodenameAliases(row, targetQuery.data?.columns)),
        [targetQuery.data?.columns, targetQuery.data?.rows]
    )
    const targetRecord = targetRows.find((row) => row.id === selectedTargetRecordId)

    useEffect(() => {
        if (
            !apiBaseUrl ||
            !applicationId ||
            !targetRecord ||
            selectedItemLocked ||
            !selectedTargetObjectCodename ||
            !selectedTargetRecordId
        ) {
            return
        }

        const viewKey = `${selectedTargetObjectCodename}:${selectedTargetRecordId}`
        if (viewedTargetKeyRef.current === viewKey) return
        viewedTargetKeyRef.current = viewKey
        void updateLearningContentProgress({
            apiBaseUrl,
            applicationId,
            targetObjectCodename: selectedTargetObjectCodename,
            targetRecordId: selectedTargetRecordId,
            action: 'view'
        })
            .then((progress) => {
                if (!selectedItem || !progress.persisted) return
                if (isSequenceRowCompleted({ ProgressStatus: progress.status, ProgressPercent: progress.progressPercent })) {
                    setCompletedItemIds((current) => new Set(current).add(selectedItem.id))
                }
            })
            .catch(() => undefined)
    }, [apiBaseUrl, applicationId, selectedItem, selectedItemLocked, selectedTargetObjectCodename, selectedTargetRecordId, targetRecord])

    useEffect(() => {
        if (!apiBaseUrl || !applicationId || !selectedItem || selectedItemLocked || !selectedCompletionTargetObjectCodename) {
            return
        }

        const viewKey = `${selectedCompletionTargetObjectCodename}:${selectedItem.id}`
        if (viewedCompletionTargetKeyRef.current === viewKey || completedPlayerItemIds.has(selectedItem.id)) return
        viewedCompletionTargetKeyRef.current = viewKey
        void updateLearningContentProgress({
            apiBaseUrl,
            applicationId,
            targetObjectCodename: selectedCompletionTargetObjectCodename,
            targetRecordId: selectedItem.id,
            action: 'view'
        })
            .then((progress) => {
                if (!progress.persisted) return
                if (isSequenceRowCompleted({ ProgressStatus: progress.status, ProgressPercent: progress.progressPercent })) {
                    setCompletedItemIds((current) => new Set(current).add(selectedItem.id))
                }
            })
            .catch(() => undefined)
    }, [apiBaseUrl, applicationId, completedPlayerItemIds, selectedCompletionTargetObjectCodename, selectedItem, selectedItemLocked])

    const completeMutation = useMutation({
        mutationFn: async () => {
            if (!apiBaseUrl || !applicationId || !selectedItem) return
            await updateLearningContentProgress({
                apiBaseUrl,
                applicationId,
                targetObjectCodename: selectedCompletionTargetObjectCodename,
                targetRecordId: selectedItem.id,
                action: 'complete'
            })
        },
        onSuccess: async () => {
            if (!selectedItem) return
            setCompletedItemIds((current) => new Set(current).add(selectedItem.id))
            await queryClient.invalidateQueries({ queryKey: details?.runtimeQueryKeyPrefix ?? [] })
        }
    })

    useEffect(() => {
        if (
            completeButtonMode !== 'autoAfterOpen' ||
            !targetRecord ||
            !selectedItem ||
            selectedItemLocked ||
            selectedItemCompleted ||
            completeMutation.isPending
        ) {
            return
        }

        const autoCompleteKey = `${selectedItem.id}:${selectedTargetObjectCodename ?? ''}:${selectedTargetRecordId ?? ''}`
        if (autoCompletedItemKeyRef.current === autoCompleteKey) return
        autoCompletedItemKeyRef.current = autoCompleteKey
        completeMutation.mutate()
    }, [
        completeButtonMode,
        completeMutation,
        selectedItem,
        selectedItemCompleted,
        selectedItemLocked,
        selectedTargetObjectCodename,
        selectedTargetRecordId,
        targetRecord
    ])

    if (!parentDatasource || !itemsDatasource) {
        return null
    }

    if (parentQuery.isLoading || (parentRows.length > 0 && !selectedParentId) || itemsQuery.isLoading) {
        return <Alert severity='info'>{t('learnerPlayer.loading', 'Loading player...')}</Alert>
    }

    if (parentRows.length === 0) {
        return <Alert severity='info'>{t('learnerPlayer.emptyParent', 'No learning content is available yet.')}</Alert>
    }

    const selectedParent = parentRows.find((row) => row.id === selectedParentId) ?? parentRows[0]
    const completedPlayerItemCount = completedPlayerItemIds.size
    const progressPercent = playerRows.length > 0 ? Math.round((completedPlayerItemCount / playerRows.length) * 100) : 0
    const targetSource = targetRecord?.[widgetConfig.targetContent?.sourceFieldCodename ?? 'Source']
    const targetBody = targetRecord?.[widgetConfig.targetContent?.bodyFieldCodename ?? 'Body']
    const targetBlocks = Array.isArray(targetBody) ? (targetBody as RuntimePageBlock[]) : []
    const untitledContentLabel = t('learnerPlayer.untitledContent', 'Untitled content')
    const untitledItemLabel = t('learnerPlayer.untitledItem', 'Untitled item')
    const readParentTitle = (row: Record<string, unknown> | undefined) =>
        readSafeRowText(row, 'Title', locale) || readSafeRowText(row, 'Name', locale) || untitledContentLabel
    const readItemTitle = (row: Record<string, unknown> | undefined) =>
        readSafeRowText(row, widgetConfig.itemTitleFieldCodename, locale) || untitledItemLabel
    const selectedTitle = readItemTitle(selectedItem)
    const selectedParentTitle = readParentTitle(selectedParent)
    const selectedTargetObjectLabel =
        resolveRuntimeObjectDisplayName(details, selectedTargetObjectCodename) || t('learnerPlayer.contentTypeFallback', 'Learning content')

    return (
        <Stack data-testid='learner-player' spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant='h6' sx={{ fontWeight: 700 }}>
                        {selectedParentTitle}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        {showPlayerProgressHeader
                            ? t('learnerPlayer.progress', '{{completed}} of {{total}} completed', {
                                  completed: completedPlayerItemCount,
                                  total: playerRows.length
                              })
                            : selectedTargetObjectLabel}
                    </Typography>
                    {showPlayerProgressHeader ? (
                        <LinearProgress
                            aria-label={t('learnerPlayer.progressLabel', 'Learner progress')}
                            variant='determinate'
                            value={progressPercent}
                            sx={{ mt: 1 }}
                        />
                    ) : null}
                </Box>
                {parentRows.length > 1 ? (
                    <FormControl size='small' sx={{ minWidth: { xs: '100%', md: 260 } }}>
                        <InputLabel id='learner-player-parent-label'>
                            {readLocalizedWidgetText(widgetConfig.parentLabel, locale) ?? t('learnerPlayer.parentLabel', 'Content')}
                        </InputLabel>
                        <Select
                            data-testid='learner-player-parent-select'
                            labelId='learner-player-parent-label'
                            value={selectedParentId}
                            label={readLocalizedWidgetText(widgetConfig.parentLabel, locale) ?? t('learnerPlayer.parentLabel', 'Content')}
                            onChange={(event) => setSelectedParentId(String(event.target.value))}
                        >
                            {parentRows.map((row) => (
                                <MenuItem key={row.id} value={row.id}>
                                    {readParentTitle(row)}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                ) : null}
                <Stack direction='row' spacing={1}>
                    <Button
                        size='small'
                        variant='outlined'
                        startIcon={<NavigateBeforeRoundedIcon />}
                        disabled={selectedItemIndex <= 0}
                        onClick={() => setSelectedItemId(playerRows[selectedItemIndex - 1]?.id ?? selectedItemId)}
                    >
                        {t('learnerPlayer.previous', 'Previous')}
                    </Button>
                    <Button
                        size='small'
                        variant='outlined'
                        endIcon={<NavigateNextRoundedIcon />}
                        disabled={selectedItemIndex < 0 || selectedItemIndex >= playerRows.length - 1}
                        onClick={() => setSelectedItemId(playerRows[selectedItemIndex + 1]?.id ?? selectedItemId)}
                    >
                        {t('learnerPlayer.next', 'Next')}
                    </Button>
                </Stack>
            </Stack>

            <Grid container spacing={2}>
                {showPlayerOutline ? (
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={1} data-testid='learner-player-outline'>
                            {playerRows.map((row, index) => {
                                const locked = row.__runtimeSequenceAvailability && row.__runtimeSequenceAvailability !== 'available'
                                const completed = completedPlayerItemIds.has(row.id)
                                return (
                                    <Button
                                        key={row.id}
                                        fullWidth
                                        variant={row.id === selectedItem?.id ? 'contained' : 'outlined'}
                                        color={locked ? 'inherit' : 'primary'}
                                        startIcon={locked ? <LockRoundedIcon /> : completed ? <CheckCircleRoundedIcon /> : undefined}
                                        onClick={() => setSelectedItemId(row.id)}
                                        sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                                    >
                                        <Stack direction='row' spacing={1} alignItems='center' sx={{ minWidth: 0, width: '100%' }}>
                                            <Typography component='span' variant='body2' sx={{ flex: 1, minWidth: 0 }} noWrap>
                                                {index + 1}. {readItemTitle(row)}
                                            </Typography>
                                            {locked ? <Chip size='small' label={t('learnerPlayer.locked', 'Locked')} /> : null}
                                        </Stack>
                                    </Button>
                                )
                            })}
                        </Stack>
                    </Grid>
                ) : null}
                <Grid size={{ xs: 12, md: showPlayerOutline ? 8 : 12 }}>
                    <Stack spacing={2} data-testid='learner-player-content'>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                                    {selectedTitle}
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    {selectedTargetObjectLabel}
                                </Typography>
                            </Box>
                            {completeButtonMode === 'manual' ? (
                                <Button
                                    size='small'
                                    variant='contained'
                                    startIcon={<CheckCircleRoundedIcon />}
                                    disabled={
                                        !selectedItem || Boolean(selectedItemLocked) || selectedItemCompleted || completeMutation.isPending
                                    }
                                    onClick={() => completeMutation.mutate()}
                                >
                                    {t('learnerPlayer.complete', 'Complete')}
                                </Button>
                            ) : null}
                        </Stack>

                        {selectedItemLocked ? (
                            <Alert severity='warning'>
                                {t('learnerPlayer.lockedMessage', 'Complete previous items to unlock this content.')}
                            </Alert>
                        ) : targetQuery.isLoading ? (
                            <Alert severity='info'>{t('learnerPlayer.loadingContent', 'Loading content...')}</Alert>
                        ) : targetRecord ? (
                            <>
                                {targetSource ? (
                                    <ResourcePreview
                                        source={targetSource}
                                        title={
                                            readSafeRowText(targetRecord, widgetConfig.targetContent?.titleFieldCodename, locale) ||
                                            selectedTitle
                                        }
                                        description={readSafeRowText(
                                            targetRecord,
                                            widgetConfig.targetContent?.descriptionFieldCodename,
                                            locale
                                        )}
                                    />
                                ) : null}
                                {targetBlocks.length > 0 ? (
                                    <PageBlocksView
                                        blocks={targetBlocks}
                                        showOutline={showPlayerOutline}
                                        showProgressHeader={false}
                                        completeButtonMode='hidden'
                                    />
                                ) : null}
                                {!targetSource && targetBlocks.length === 0 ? (
                                    <Alert severity='info'>
                                        {t('learnerPlayer.noPreview', 'This content item does not have a previewable source yet.')}
                                    </Alert>
                                ) : null}
                            </>
                        ) : (
                            <Alert severity='info'>{t('learnerPlayer.targetNotFound', 'The selected content record was not found.')}</Alert>
                        )}
                    </Stack>
                </Grid>
            </Grid>
        </Stack>
    )
}

function DetailsTableWidget({ config }: { config?: Record<string, unknown> }) {
    const parsed = detailsTableWidgetConfigSchema.safeParse(config ?? {})
    const reportDefinition = parsed.success ? parsed.data.reportDefinition : undefined
    const reportCodename = parsed.success ? parsed.data.reportCodename ?? reportDefinition?.codename : undefined
    if (reportCodename) {
        return <ReportDetailsTableWidget definition={reportDefinition} reportCodename={reportCodename} />
    }
    const datasource = parsed.success ? parsed.data.datasource : undefined
    const enableRowReordering = parsed.success ? parsed.data.enableRowReordering : undefined
    const rowCountWarning = parsed.success ? parsed.data.rowCountWarning : undefined
    const sequencePolicy = parsed.success ? parsed.data.sequencePolicy : undefined
    if (datasource?.kind === 'records.list') {
        return (
            <RecordsListDetailsTableWidget
                datasource={datasource}
                enableRowReordering={enableRowReordering}
                rowCountWarning={rowCountWarning}
                sequencePolicy={sequencePolicy}
            />
        )
    }
    if (datasource?.kind === 'records.union') {
        return (
            <RecordsUnionDetailsTableWidget
                datasource={datasource}
                showViewToggle={parsed.success ? parsed.data.showViewToggle : undefined}
                showSearch={parsed.success ? parsed.data.showSearch : undefined}
                targetFilters={parsed.success ? parsed.data.targetFilters : undefined}
                createTargets={parsed.success ? parsed.data.createTargets : undefined}
                rowActions={parsed.success ? parsed.data.rowActions : undefined}
                restoreTarget={parsed.success ? parsed.data.restoreTarget : undefined}
            />
        )
    }
    if (datasource?.kind === 'ledger.facts' || datasource?.kind === 'ledger.projection') {
        return <LedgerDetailsTableWidget datasource={datasource} />
    }
    return <CurrentDetailsTableWidget />
}

function RuntimeRelationBuilderWidget({ config }: { config?: Record<string, unknown> }) {
    const parsed = relationBuilderWidgetConfigSchema.safeParse(config ?? {})
    if (!parsed.success) return null
    return <RelationBuilderWidget config={parsed.data} />
}

function DetailsTabsWidget({
    config,
    menus,
    fallbackMenu,
    depth
}: {
    config?: Record<string, unknown>
    menus?: DashboardMenusMap
    fallbackMenu?: DashboardMenuSlot
    depth: number
}) {
    const details = useDashboardDetails()
    const { t } = useTranslation('apps')
    const parsed = detailsTabsWidgetConfigSchema.safeParse(config ?? {})
    const tabs = useMemo(() => {
        if (!parsed.success) return [] as DetailsTabsWidgetConfig['tabs']
        return parsed.data.tabs
            .filter((tab) => tab.isActive !== false)
            .map((tab) => ({
                ...tab,
                widgets: (tab.widgets ?? [])
                    .filter((widget) => widget.isActive !== false)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            }))
            .filter((tab) => tab.widgets.length > 0)
    }, [parsed])
    const [activeTabId, setActiveTabId] = useState<string | false>(tabs[0]?.id ?? false)

    useEffect(() => {
        if (tabs.length === 0) {
            setActiveTabId(false)
            return
        }
        if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
            setActiveTabId(tabs[0].id)
        }
    }, [activeTabId, tabs])

    if (tabs.length === 0 || activeTabId === false) return null

    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

    return (
        <Box data-testid='runtime-details-tabs'>
            <Tabs
                value={activeTabId}
                onChange={(_, value: string) => setActiveTabId(value)}
                variant='scrollable'
                scrollButtons='auto'
                sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
            >
                {tabs.map((tab) => (
                    <Tab
                        key={tab.id}
                        value={tab.id}
                        label={
                            readLocalizedWidgetText(tab.label, details?.locale) ??
                            formatDetailsTabFallbackLabel(tab.id, details?.locale, t('detailsTabs.untitledTab', 'Details'))
                        }
                        sx={{ minHeight: 40, textTransform: 'none' }}
                    />
                ))}
            </Tabs>
            <Box sx={{ pt: 2 }}>
                {activeTab.widgets.map((widget, index) => {
                    const inner: ZoneWidgetItem = {
                        id: widget.id ?? `${activeTab.id}-w${index}`,
                        widgetKey: widget.widgetKey,
                        sortOrder: typeof widget.sortOrder === 'number' ? widget.sortOrder : index,
                        config: widget.config ?? {}
                    }

                    return (
                        <Box key={inner.id} sx={index > 0 ? { mt: 2 } : undefined}>
                            {renderWidget(inner, menus, fallbackMenu, depth)}
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
}

/**
 * Shared widget renderer used by both left and right sidebars.
 * Maps widget keys to concrete React components.
 *
 * @param depth - Current nesting depth for columnsContainer (0 = top level). Used internally for recursion guard.
 */
export function renderWidget(
    widget: ZoneWidgetItem,
    menus?: DashboardMenusMap,
    fallbackMenu?: DashboardMenuSlot,
    depth = 0,
    menuVariant: 'wide' | 'compact' = 'wide'
): ReactNode {
    switch (widget.widgetKey) {
        case 'brandSelector':
            return (
                <Box key={widget.id} sx={{ display: 'flex', p: 1.5 }}>
                    <SelectContent />
                </Box>
            )
        case 'divider':
            return <Divider key={widget.id} />
        case 'menuWidget': {
            const resolved = resolveMenuForWidget(widget, menus, fallbackMenu)
            return <MenuContent key={widget.id} menu={resolved} variant={menuVariant} />
        }
        case 'workspaceSwitcher':
            return (
                <Box key={widget.id} sx={{ p: 1.5, pb: 0.75 }}>
                    <WorkspaceSwitcher variant='sidebar' />
                </Box>
            )
        case 'spacer':
            return <Box key={widget.id} sx={{ flexGrow: 1 }} />
        case 'infoCard':
            return <CardAlert key={widget.id} />
        case 'userProfile':
            return (
                <Stack
                    key={widget.id}
                    direction='row'
                    sx={{
                        p: 2,
                        gap: 1,
                        alignItems: 'center',
                        borderTop: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Avatar sizes='small' sx={{ width: 36, height: 36 }}>
                        <PersonRoundedIcon fontSize='small' />
                    </Avatar>
                    <Box sx={{ mr: 'auto' }}>
                        <Typography variant='body2' sx={{ fontWeight: 500, lineHeight: '16px' }}>
                            User
                        </Typography>
                    </Box>
                </Stack>
            )
        case 'productTree':
            return <CustomizedTreeView key={widget.id} />
        case 'usersByCountryChart':
            return <ChartUserByCountry key={widget.id} />
        case 'detailsTable':
            return <DetailsTableWidget key={widget.id} config={widget.config} />
        case 'learnerPlayer':
            return <LearnerPlayerWidget key={widget.id} config={widget.config} />
        case 'relationBuilder':
            return <RuntimeRelationBuilderWidget key={widget.id} config={widget.config} />
        case 'interpretationNetworkWorkspace':
            return <InterpretationNetworkWorkspaceWidget key={widget.id} config={widget.config} />
        case 'detailsTabs':
            return <DetailsTabsWidget key={widget.id} config={widget.config} menus={menus} fallbackMenu={fallbackMenu} depth={depth} />
        case 'quizWidget':
            return <QuizWidget key={widget.id} config={widget.config} />
        case 'playcanvasCanvas':
            return <PlayCanvasCanvasWidget key={widget.id} widgetId={widget.id} config={widget.config} />
        case 'resourcePreview':
            return <ResourcePreviewWidget key={widget.id} config={widget.config} />
        case 'columnsContainer': {
            // Guard against infinite recursion if a columnsContainer nests another
            if (depth >= MAX_CONTAINER_DEPTH) return null
            const colConfig = widget.config as unknown as ColumnsContainerConfig | undefined
            if (!colConfig?.columns || !Array.isArray(colConfig.columns) || colConfig.columns.length === 0) return null
            const activeColumns = colConfig.columns
                .map((col) => ({
                    ...col,
                    widgets: (col.widgets ?? []).filter((childWidget) => childWidget.isActive !== false)
                }))
                .filter((col) => col.widgets.length > 0)
            if (activeColumns.length === 0) return null
            return (
                <Grid key={widget.id} container spacing={2} sx={{ width: '100%', minWidth: 0 }}>
                    {activeColumns.map((col) => (
                        <Grid key={col.id} size={{ xs: 12, md: col.width }} sx={{ minWidth: 0 }}>
                            {col.widgets.map((w, wIdx) => {
                                const inner: ZoneWidgetItem = {
                                    id: w.id ?? `${col.id}-w${wIdx}`,
                                    widgetKey: w.widgetKey,
                                    sortOrder: typeof w.sortOrder === 'number' ? w.sortOrder : wIdx,
                                    config: w.config ?? {}
                                }
                                return (
                                    <Box key={inner.id} sx={wIdx > 0 ? { mt: 2 } : undefined}>
                                        {renderWidget(inner, menus, fallbackMenu, depth + 1)}
                                    </Box>
                                )
                            })}
                        </Grid>
                    ))}
                </Grid>
            )
        }
        default:
            return null
    }
}
