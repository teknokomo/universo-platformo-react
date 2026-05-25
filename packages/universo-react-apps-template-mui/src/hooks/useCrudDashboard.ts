import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { GridColDef, GridFilterModel, GridLocaleText, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { isPendingInteractionBlocked, makePendingMarkers } from '@universo-react/utils'
import { normalizeDashboardLayoutConfig } from '@universo-react/utils'
import type { CreateTargetDefault, DashboardLayoutConfig, ResourceType } from '@universo-react/types'
import type { PendingAction } from '@universo-react/utils'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    confirmOptimisticCreate,
    confirmOptimisticUpdate,
    generateOptimisticId,
    revealPendingEntityFeedback,
    rollbackOptimisticSnapshots,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive
} from './optimisticCrud'
import type { AppDataResponse } from '../api/api'
import type { CrudDataAdapter, CellRendererOverrides, RuntimeRecordCommand } from '../api/types'
import type { DashboardMenuItem, DashboardMenuSlot } from '../dashboard/Dashboard'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { buildDefaultResourceSourceForType } from '../utils/resourceSourceDefaults'
import { toGridColumns, toFieldConfigs } from '../utils/columns'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { mapGridFilterModel, mapGridSortModel } from '../utils/runtimeListQuery'
import { extractRuntimeErrorMessage } from '../utils/runtimeErrors'

// ---------------------------------------------------------------------------
//  Stable empty key prefix (avoids new [] allocation on each render)
// ---------------------------------------------------------------------------

const EMPTY_KEY_PREFIX: readonly unknown[] = []

const readInitialObjectCollectionId = (): string | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
        return new URLSearchParams(window.location.search).get('objectCollectionId') ?? undefined
    } catch {
        return undefined
    }
}

const normalizeLocale = (locale: string) => locale.split(/[-_]/)[0]?.toLowerCase() || 'en'

const getCopySuffix = (locale: string) => (normalizeLocale(locale) === 'ru' ? ' (копия)' : ' (copy)')
const getCopyLabel = (locale: string) => (normalizeLocale(locale) === 'ru' ? 'Копия' : 'Copy')

const isLocalizedContent = (value: unknown): value is { _primary?: string; locales?: Record<string, { content?: string }> } =>
    Boolean(value && typeof value === 'object' && 'locales' in (value as Record<string, unknown>))

const appendCopySuffixToFirstStringField = (params: {
    sourceData: Record<string, unknown>
    fieldConfigs: FieldConfig[]
    locale: string
}): Record<string, unknown> => {
    const { sourceData, fieldConfigs, locale } = params
    const firstStringField = fieldConfigs.find((field) => field.type === 'STRING')
    if (!firstStringField) return sourceData

    const fieldId = firstStringField.id
    const rawValue = sourceData[fieldId]
    const fallbackSuffix = getCopySuffix(locale)

    if (typeof rawValue === 'string') {
        const content = rawValue.trim()
        return {
            ...sourceData,
            [fieldId]: content.length > 0 ? `${content}${fallbackSuffix}` : fallbackSuffix.trim()
        }
    }

    if (isLocalizedContent(rawValue)) {
        const nextLocales = { ...(rawValue.locales ?? {}) }
        let hasAnyContent = false
        for (const [localeKey, localeValue] of Object.entries(nextLocales)) {
            const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
            if (!content) continue
            hasAnyContent = true
            nextLocales[localeKey] = {
                ...(localeValue ?? {}),
                content: `${content}${getCopySuffix(localeKey)}`
            }
        }
        if (!hasAnyContent) {
            const primaryLocale = normalizeLocale(rawValue._primary || locale)
            nextLocales[primaryLocale] = {
                content: `${getCopyLabel(primaryLocale)}${getCopySuffix(primaryLocale)}`
            }
        }

        return {
            ...sourceData,
            [fieldId]: {
                ...rawValue,
                locales: nextLocales
            }
        }
    }

    return {
        ...sourceData,
        [fieldId]: `${getCopyLabel(locale)}${fallbackSuffix}`
    }
}

const normalizeCreateDefaultFieldKey = (value: unknown): string =>
    (typeof value === 'string' ? value : '')
        .trim()
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()

const blockedCreateDefaultFieldKeys = new Set([
    'id',
    'workspace',
    'workspaceid',
    'owner',
    'ownerid',
    'owneruserid',
    'user',
    'userid',
    'assigneduserid',
    'createdby',
    'updatedby',
    'deletedby',
    'targetrecordid',
    'targetobjectid',
    'targetobjectcodename',
    'sourceobjectcodename',
    'sourcerowid',
    'sourcelineid',
    'principalid',
    'apprecordstate',
    'appdeleted'
])

const isUnsafeCreateDefaultField = (fieldCodename: string): boolean => {
    const normalized = normalizeCreateDefaultFieldKey(fieldCodename)
    return (
        normalized.startsWith('upl') ||
        normalized.startsWith('progress') ||
        normalized.startsWith('lifecycle') ||
        normalized.includes('workspaceid') ||
        normalized.includes('ownerid') ||
        normalized.includes('userid') ||
        blockedCreateDefaultFieldKeys.has(normalized)
    )
}

const isWritableCreateDefaultField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return (
        field.type !== 'TABLE' &&
        uiConfig.hidden !== true &&
        uiConfig.formHidden !== true &&
        uiConfig.readOnly !== true &&
        uiConfig.readonly !== true &&
        uiConfig.disabled !== true &&
        uiConfig.serverOwned !== true
    )
}

const isResourceSourceCreateDefaultField = (field: FieldConfig): boolean => {
    const uiConfig = field.uiConfig ?? {}
    return field.type === 'JSON' && (uiConfig.widget === 'resourceSource' || uiConfig.resourceSource === true || uiConfig.resource === true)
}

const resolveEnumDefaultValue = (field: FieldConfig, enumCodename: string): string | null => {
    if (field.type !== 'REF' || field.refTargetEntityKind !== 'enumeration') return null

    const targetCodename = normalizeCreateDefaultFieldKey(enumCodename)
    const options = [...(field.enumOptions ?? []), ...(field.refOptions ?? [])]
    return options.find((option) => normalizeCreateDefaultFieldKey(option.codename) === targetCodename)?.id ?? null
}

const coerceScalarCreateDefaultValue = (field: FieldConfig, value: string | number | boolean | null): unknown => {
    if (value === null) return null
    if (field.type === 'STRING' && typeof value === 'string') return value
    if (field.type === 'NUMBER' && typeof value === 'number' && Number.isFinite(value)) return value
    if (field.type === 'BOOLEAN' && typeof value === 'boolean') return value
    if (field.type === 'DATE' && typeof value === 'string') return value
    return undefined
}

const readCreateDefaultContextPath = (context: Record<string, unknown> | undefined, path: string): unknown => {
    if (!context) return undefined

    let current: unknown = context
    for (const segment of path.split('.')) {
        if (!current || typeof current !== 'object') return undefined
        if (segment === '__proto__' || segment === 'prototype' || segment === 'constructor') return undefined

        const record = current as Record<string, unknown>
        if (!Object.prototype.hasOwnProperty.call(record, segment)) return undefined
        current = record[segment]
    }

    return current
}

const buildSafeCreateInitialData = (
    createDefaults: readonly CreateTargetDefault[] | undefined,
    fieldConfigs: readonly FieldConfig[],
    createDefaultContext?: Record<string, unknown>
): Record<string, unknown> | undefined => {
    if (!createDefaults?.length || fieldConfigs.length === 0) return undefined

    const fieldsByCodename = new Map<string, FieldConfig>()
    for (const field of fieldConfigs) {
        fieldsByCodename.set(normalizeCreateDefaultFieldKey(field.id), field)
        if (field.codename) {
            fieldsByCodename.set(normalizeCreateDefaultFieldKey(field.codename), field)
        }
    }
    const initialData: Record<string, unknown> = {}

    for (const item of createDefaults) {
        if (isUnsafeCreateDefaultField(item.fieldCodename)) continue

        const field = fieldsByCodename.get(normalizeCreateDefaultFieldKey(item.fieldCodename))
        if (!field || !isWritableCreateDefaultField(field)) continue

        if (typeof item.enumCodename === 'string') {
            const enumValueId = resolveEnumDefaultValue(field, item.enumCodename)
            if (enumValueId) {
                initialData[field.id] = enumValueId
            }
            continue
        }

        if (typeof item.resourceSourceType === 'string') {
            if (isResourceSourceCreateDefaultField(field)) {
                initialData[field.id] = buildDefaultResourceSourceForType(item.resourceSourceType as ResourceType)
            }
            continue
        }

        if (typeof item.contextPath === 'string') {
            const rawValue = readCreateDefaultContextPath(createDefaultContext, item.contextPath)
            if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean') {
                const nextValue = coerceScalarCreateDefaultValue(field, rawValue)
                if (typeof nextValue !== 'undefined') {
                    initialData[field.id] = nextValue
                }
            }
            continue
        }

        if (Object.prototype.hasOwnProperty.call(item, 'value')) {
            const nextValue = coerceScalarCreateDefaultValue(field, item.value as string | number | boolean | null)
            if (typeof nextValue !== 'undefined') {
                initialData[field.id] = nextValue
            }
        }
    }

    return Object.keys(initialData).length > 0 ? initialData : undefined
}

const stripReadOnlyEnumerationLabelFields = (params: {
    payload: Record<string, unknown>
    fieldConfigs: FieldConfig[]
}): Record<string, unknown> => {
    const { payload, fieldConfigs } = params
    const result: Record<string, unknown> = {}

    for (const field of fieldConfigs) {
        if (!Object.prototype.hasOwnProperty.call(payload, field.id)) continue

        if (field.type === 'REF' && field.refTargetEntityKind === 'enumeration' && field.enumPresentationMode === 'label') {
            continue
        }

        if (field.type === 'TABLE') {
            const rawRows = payload[field.id]
            if (!Array.isArray(rawRows)) {
                result[field.id] = rawRows
                continue
            }

            const childFields = field.childFields ?? []
            const sanitizedRows = rawRows.map((row) => {
                if (!row || typeof row !== 'object') return row
                const rowRecord = row as Record<string, unknown>
                const sanitizedRow: Record<string, unknown> = {}

                for (const childField of childFields) {
                    if (!Object.prototype.hasOwnProperty.call(rowRecord, childField.id)) continue
                    if (
                        childField.type === 'REF' &&
                        childField.refTargetEntityKind === 'enumeration' &&
                        childField.enumPresentationMode === 'label'
                    ) {
                        continue
                    }
                    sanitizedRow[childField.id] = rowRecord[childField.id]
                }

                return sanitizedRow
            })

            result[field.id] = sanitizedRows
            continue
        }

        result[field.id] = payload[field.id]
    }

    return result
}

const readRuntimeRowVersion = (row: Record<string, unknown> | null | undefined): number | null => {
    const rawValue = row?._upl_version
    const value =
        typeof rawValue === 'number' ? rawValue : typeof rawValue === 'string' && rawValue.trim().length > 0 ? Number(rawValue) : Number.NaN
    return Number.isInteger(value) && value > 0 ? value : null
}

// ---------------------------------------------------------------------------
//  Helper: convert menu items to DashboardMenuItem[]
// ---------------------------------------------------------------------------

function mapMenuItems(
    items: AppDataResponse['menus'][number]['items'],
    sections: AppDataResponse['sections'],
    activeSectionId: string | undefined
): DashboardMenuItem[] {
    return items.flatMap((item): DashboardMenuItem[] => {
        if (!item.isActive) return []

        if (item.kind === 'section') {
            const targetSectionId = item.sectionId ?? item.objectCollectionId ?? null
            return [
                {
                    id: item.id,
                    label: item.title,
                    icon: item.icon ?? null,
                    kind: 'section' as const,
                    sectionId: targetSectionId,
                    objectCollectionId: item.objectCollectionId ?? targetSectionId,
                    href: null,
                    selected: targetSectionId != null && targetSectionId === activeSectionId
                }
            ]
        }

        if (item.kind === 'hub') {
            return [
                {
                    id: item.id,
                    label: item.title,
                    icon: item.icon ?? null,
                    kind: 'hub' as const,
                    sectionId: null,
                    objectCollectionId: null,
                    treeEntityId: item.treeEntityId ?? null,
                    href: null,
                    selected: false
                }
            ]
        }

        return [
            {
                id: item.id,
                label: item.title,
                icon: item.icon ?? null,
                kind: 'link' as const,
                sectionId: null,
                objectCollectionId: null,
                href: item.href ?? null,
                selected: false
            }
        ]
    })
}

// ---------------------------------------------------------------------------
//  Hook options
// ---------------------------------------------------------------------------

export interface UseCrudDashboardOptions {
    /** Adapter that provides all CRUD operations. Pass `null` to disable queries. */
    adapter: CrudDataAdapter | null
    /** BCP-47 locale string, e.g. `"en"`, `"ru"`. */
    locale: string
    /** i18n namespace for `useTranslation`. @default 'apps' */
    i18nNamespace?: string
    /** Default page size. @default 20 */
    defaultPageSize?: number
    /** Page size options shown in the DataGrid footer. @default [10, 20, 50] */
    pageSizeOptions?: number[]
    /** React Query staleTime (ms). @default 0 */
    staleTime?: number
    /** Initial runtime section id resolved from route params. */
    initialSectionId?: string
    /**
     * Per-dataType cell renderer overrides.
     * Allows consumers to inject custom rendering (e.g. inline checkbox editing).
     */
    cellRenderers?: CellRendererOverrides
    /**
     * Curated host context used by metadata-defined create defaults.
     * The resolver receives the already-loaded runtime app data and must not return secrets or raw settings blobs.
     */
    createDefaultContext?: Record<string, unknown> | ((appData: AppDataResponse | undefined) => Record<string, unknown> | undefined)
}

// ---------------------------------------------------------------------------
//  Hook return type
// ---------------------------------------------------------------------------

export interface CrudDashboardState {
    // Data & loading
    appData: AppDataResponse | undefined
    isLoading: boolean
    isFetching: boolean
    isError: boolean

    // Layout
    layoutConfig: NonNullable<DashboardLayoutConfig>

    // Table
    columns: GridColDef[]
    fieldConfigs: FieldConfig[]
    rows: Array<Record<string, unknown> & { id: string }>
    rowCount: number | undefined
    paginationModel: GridPaginationModel
    setPaginationModel: (model: GridPaginationModel) => void
    sortModel: GridSortModel
    setSortModel: (model: GridSortModel) => void
    filterModel: GridFilterModel
    setFilterModel: (model: GridFilterModel) => void
    searchValue: string
    setSearchValue: (value: string) => void
    pageSizeOptions: number[]
    localeText: Partial<GridLocaleText> | undefined
    handlePendingInteractionAttempt: (rowId: string) => boolean

    // Section selection aliases (object fields remain for compatibility)
    activeSectionId: string | undefined
    selectedSectionId: string | undefined
    onSelectSection: (sectionId: string) => void
    activeObjectCollectionId: string | undefined
    selectedObjectCollectionId: string | undefined
    onSelectObjectCollection: (objectCollectionId: string) => void

    // Menus
    activeMenu: AppDataResponse['menus'][number] | null
    dashboardMenuItems: DashboardMenuItem[]
    /** Menu slot object ready for `<Dashboard menu={…} />`. */
    menuSlot: DashboardMenuSlot | undefined
    /** Map of menus by widget ID, ready for `<Dashboard menus={…} />`. */
    menusMap: { [widgetId: string]: DashboardMenuSlot }

    // CRUD form
    formOpen: boolean
    editRowId: string | null
    formError: string | null
    formInitialData: Record<string, unknown> | undefined
    isFormReady: boolean
    isSubmitting: boolean
    isReordering: boolean
    canPersistRowReorder: boolean
    handleOpenCreate: (createDefaults?: readonly CreateTargetDefault[]) => void
    handleOpenEdit: (rowId: string) => void
    handleCloseForm: () => void
    handleFormSubmit: (data: Record<string, unknown>) => Promise<void>
    handlePersistRowReorder: (orderedRowIds: string[]) => Promise<void>

    // Delete dialog
    deleteRowId: string | null
    deleteError: string | null
    isDeleting: boolean
    handleOpenDelete: (rowId: string) => void
    handleCloseDelete: () => void
    handleConfirmDelete: () => Promise<void>

    // Copy dialog
    copyRowId: string | null
    copyError: string | null
    isCopying: boolean
    handleOpenCopy: (rowId: string) => void
    handleCloseCopy: () => void

    // Row actions menu
    menuAnchorEl: HTMLElement | null
    menuRowId: string | null
    handleOpenMenu: (event: React.MouseEvent<HTMLElement>, rowId: string) => void
    handleCloseMenu: () => void
    handleRecordCommand?: (rowId: string, command: RuntimeRecordCommand) => Promise<void>
    isRecordCommandPending?: boolean
    handleWorkflowAction?: (rowId: string, actionCodename: string) => Promise<void>
    isWorkflowActionPending?: boolean
}

// ---------------------------------------------------------------------------
//  Hook implementation
// ---------------------------------------------------------------------------

export function useCrudDashboard(options: UseCrudDashboardOptions): CrudDashboardState {
    const {
        adapter,
        locale,
        i18nNamespace = 'apps',
        defaultPageSize = 20,
        pageSizeOptions = [10, 20, 50],
        staleTime = 0,
        initialSectionId,
        cellRenderers,
        createDefaultContext: createDefaultContextOption
    } = options

    const { t } = useTranslation(i18nNamespace)
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    // ----- Pagination & section selection -----
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: defaultPageSize
    })
    const [sortModel, setSortModelState] = useState<GridSortModel>([])
    const [filterModel, setFilterModelState] = useState<GridFilterModel>({ items: [] })
    const [searchValue, setSearchValueState] = useState('')
    const [selectedObjectCollectionId, setSelectedObjectCollectionId] = useState<string | undefined>(
        () => initialSectionId ?? readInitialObjectCollectionId()
    )

    // ----- CRUD dialog state -----
    const [formOpen, setFormOpen] = useState(false)
    const [editRowId, setEditRowId] = useState<string | null>(null)
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [copyRowId, setCopyRowId] = useState<string | null>(null)
    const [createInitialData, setCreateInitialData] = useState<Record<string, unknown> | undefined>(undefined)
    const [formError, setFormError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [copyError, setCopyError] = useState<string | null>(null)

    // ----- Row actions menu state -----
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
    const [menuRowId, setMenuRowId] = useState<string | null>(null)

    // ----- Schema fingerprint (M4) -----
    const formColumnsRef = useRef<string | null>(null)
    const formRequestIdRef = useRef(0)
    const deleteRequestIdRef = useRef(0)

    // ----- Derived values -----
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize
    const runtimeSort = useMemo(() => mapGridSortModel(sortModel), [sortModel])
    const runtimeFilters = useMemo(() => mapGridFilterModel(filterModel), [filterModel])
    const normalizedSearchValue = searchValue.trim()

    const setSortModel = useCallback((model: GridSortModel) => {
        setSortModelState(model)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const setFilterModel = useCallback((model: GridFilterModel) => {
        setFilterModelState(model)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const setSearchValue = useCallback((value: string) => {
        setSearchValueState(value)
        setPaginationModel((current) => ({ ...current, page: 0 }))
    }, [])

    const resetSectionScopedListState = useCallback(() => {
        setPaginationModel((current) => ({ ...current, page: 0 }))
        setSortModelState([])
        setFilterModelState({ items: [] })
    }, [])

    // Query key helpers
    const queryKeyPrefix = adapter?.queryKeyPrefix ?? EMPTY_KEY_PREFIX
    const pendingInteractionMessage = t('app.pendingCreateBlocked', {
        defaultValue: 'This item is still being created. Please wait a moment and try again.'
    })
    const listKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'list',
                selectedObjectCollectionId,
                { limit, offset, locale, search: normalizedSearchValue, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [queryKeyPrefix, selectedObjectCollectionId, limit, offset, locale, normalizedSearchValue, runtimeFilters, runtimeSort]
    )

    useEffect(() => {
        if (!initialSectionId) return
        setSelectedObjectCollectionId((current) => {
            if (current === initialSectionId) return current
            resetSectionScopedListState()
            return initialSectionId
        })
    }, [initialSectionId, resetSectionScopedListState])
    const sourceRowId = copyRowId ?? editRowId
    const rowKey = useMemo(() => [...queryKeyPrefix, 'row', sourceRowId] as const, [queryKeyPrefix, sourceRowId])

    // ----- List query -----
    const listQuery = useQuery({
        queryKey: listKey,
        queryFn: () =>
            adapter!.fetchList({
                limit,
                offset,
                locale,
                objectCollectionId: selectedObjectCollectionId,
                sectionId: selectedObjectCollectionId,
                search: normalizedSearchValue || undefined,
                sort: runtimeSort,
                filters: runtimeFilters
            }),
        enabled: Boolean(adapter),
        staleTime,
        placeholderData: (prev) => prev
    })

    const appData = listQuery.data
    const applyWorkspaceLimitDelta = useCallback(
        (delta: number) => {
            queryClient.setQueriesData<AppDataResponse>({ queryKey: queryKeyPrefix }, (old) => {
                if (!old?.workspaceLimit) {
                    return old
                }

                const nextCurrentRows = Math.max(0, old.workspaceLimit.currentRows + delta)
                const maxRows = old.workspaceLimit.maxRows
                return {
                    ...old,
                    workspaceLimit: {
                        ...old.workspaceLimit,
                        currentRows: nextCurrentRows,
                        canCreate: maxRows === null ? true : nextCurrentRows < maxRows
                    }
                }
            })
        },
        [queryClient, queryKeyPrefix]
    )
    const guardPendingRowInteraction = useCallback(
        (rowId: string) => {
            const queryEntries = queryClient.getQueriesData<AppDataResponse>({ queryKey: queryKeyPrefix })
            const pendingRow = queryEntries.flatMap(([, data]) => data?.rows ?? []).find((row) => row.id === rowId)

            if (!pendingRow || !isPendingInteractionBlocked(pendingRow)) return false

            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix,
                entityId: rowId,
                extraQueryKeys: [[...queryKeyPrefix, 'row', rowId]]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
            return true
        },
        [enqueueSnackbar, pendingInteractionMessage, queryClient, queryKeyPrefix]
    )
    const backendActiveSectionId =
        appData?.activeSectionId ?? appData?.section?.id ?? appData?.activeObjectCollectionId ?? appData?.objectCollection.id
    const backendActiveObjectCollectionId = appData?.activeObjectCollectionId ?? appData?.objectCollection.id ?? backendActiveSectionId

    const initialMenuSectionId = useMemo(() => {
        if (!appData?.menus?.length) return undefined
        const menu = appData.menus.find((item) => item.id === appData.activeMenuId) ?? appData.menus[0]
        if (menu?.startSectionId) return menu.startSectionId
        const firstSectionItem = menu?.items?.find(
            (item) => item.isActive !== false && item.kind === 'section' && Boolean(item.sectionId ?? item.objectCollectionId)
        )
        return firstSectionItem?.sectionId ?? firstSectionItem?.objectCollectionId ?? undefined
    }, [appData])

    const isResolvingInitialMenuSection = Boolean(
        appData &&
            !selectedObjectCollectionId &&
            initialMenuSectionId &&
            backendActiveSectionId &&
            initialMenuSectionId !== backendActiveSectionId
    )
    const isResolvingSelectedSection = Boolean(
        appData &&
            selectedObjectCollectionId &&
            backendActiveSectionId &&
            selectedObjectCollectionId !== backendActiveSectionId &&
            listQuery.isFetching
    )
    const isSuppressingStaleSectionData = isResolvingInitialMenuSection || isResolvingSelectedSection
    const displayAppData = isSuppressingStaleSectionData ? undefined : appData
    const activeSectionId = selectedObjectCollectionId ?? (isSuppressingStaleSectionData ? initialMenuSectionId : backendActiveSectionId)
    const activeObjectCollectionId =
        selectedObjectCollectionId ?? (isSuppressingStaleSectionData ? initialMenuSectionId : backendActiveObjectCollectionId)
    const tableColumnRefs = useMemo(
        () =>
            (displayAppData?.columns ?? [])
                .filter((column) => column.dataType === 'TABLE')
                .map((column) => ({
                    fieldId: column.field,
                    componentId: column.id
                })),
        [displayAppData?.columns]
    )
    const copyTablesKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'copy-table-data',
                sourceRowId,
                selectedObjectCollectionId,
                tableColumnRefs.map((column) => column.fieldId).join(',')
            ] as const,
        [queryKeyPrefix, sourceRowId, selectedObjectCollectionId, tableColumnRefs]
    )

    // Schema fingerprint (M4)
    const currentSchemaFingerprint = useMemo(() => {
        if (!displayAppData?.columns) return null
        return displayAppData.columns
            .map((c) => c.field)
            .sort()
            .join(',')
    }, [displayAppData?.columns])
    const fieldConfigs = useMemo(() => (displayAppData ? toFieldConfigs(displayAppData) : []), [displayAppData])
    const rows = useMemo(() => (displayAppData ? displayAppData.rows : []), [displayAppData])
    const canPersistRowReorder = Boolean(adapter?.reorderRows)
    const createDefaultContext = useMemo(() => {
        if (typeof createDefaultContextOption === 'function') {
            return createDefaultContextOption(displayAppData)
        }
        return createDefaultContextOption
    }, [createDefaultContextOption, displayAppData])

    // Initialize section from the menu (fallback: backend active section)
    useEffect(() => {
        if (!appData || selectedObjectCollectionId) return
        const initialSectionId = initialMenuSectionId ?? backendActiveSectionId
        if (initialSectionId) setSelectedObjectCollectionId(initialSectionId)
    }, [appData, selectedObjectCollectionId, initialMenuSectionId, backendActiveSectionId])

    // ----- Row query (for edit) -----
    const rowQuery = useQuery({
        queryKey: rowKey,
        queryFn: () => adapter!.fetchRow(sourceRowId!, selectedObjectCollectionId ?? activeSectionId),
        enabled: Boolean(adapter && sourceRowId),
        staleTime: 0,
        gcTime: 0
    })

    const copyTablesQuery = useQuery({
        queryKey: copyTablesKey,
        queryFn: async () => {
            const fetchTabularRows = adapter?.fetchTabularRows
            if (!fetchTabularRows || !sourceRowId || tableColumnRefs.length === 0) {
                return {} as Record<string, Array<Record<string, unknown>>>
            }

            const entries = await Promise.all(
                tableColumnRefs.map(async (column) => {
                    const rows = await fetchTabularRows({
                        parentRowId: sourceRowId,
                        componentId: column.componentId,
                        objectCollectionId: selectedObjectCollectionId ?? activeObjectCollectionId,
                        sectionId: selectedObjectCollectionId ?? activeSectionId
                    })
                    return [column.fieldId, rows] as const
                })
            )

            return Object.fromEntries(entries)
        },
        enabled: Boolean(copyRowId && adapter?.fetchTabularRows && sourceRowId && tableColumnRefs.length > 0),
        staleTime: 0,
        gcTime: 0
    })

    // ----- Mutations -----
    const createMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'create'],
        mutationFn: (data: Record<string, unknown>) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.createRow(data, selectedObjectCollectionId)
        },
        onMutate: async (data) => {
            const optimisticId = generateOptimisticId()
            const pendingAction: PendingAction = copyRowId ? 'copy' : 'create'
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    ...data,
                    ...makePendingMarkers(pendingAction)
                } as AppDataResponse['rows'][number] & { id: string }
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, queryKeyPrefix, context.optimisticId, String(data.id), {
                    serverEntity: data
                })
            }
            applyWorkspaceLimitDelta(1)
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
        }
    })

    const copyMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'copy'],
        mutationFn: (params: { rowId: string; data: Record<string, unknown>; expectedVersion?: number }) => {
            if (!adapter?.copyRow) throw new Error('Copy is not available for this runtime adapter')
            return adapter.copyRow(params.rowId, {
                objectCollectionId: selectedObjectCollectionId ?? activeObjectCollectionId,
                sectionId: selectedObjectCollectionId ?? activeSectionId,
                copyChildTables: true,
                data: params.data,
                expectedVersion: params.expectedVersion
            })
        },
        onMutate: async ({ data }) => {
            const optimisticId = generateOptimisticId()
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    ...data,
                    ...makePendingMarkers('copy')
                } as AppDataResponse['rows'][number] & { id: string }
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, queryKeyPrefix, context.optimisticId, String(data.id), {
                    serverEntity: {
                        id: data.id,
                        ...variables.data
                    }
                })
            }
            applyWorkspaceLimitDelta(1)
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
        }
    })

    const updateMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'update'],
        mutationFn: (params: { rowId: string; data: Record<string, unknown>; expectedVersion?: number }) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.updateRow(params.rowId, params.data, selectedObjectCollectionId, params.expectedVersion)
        },
        onMutate: async ({ rowId, data }) => {
            const rowDetailKey = [...queryKeyPrefix, 'row', rowId]
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix,
                entityId: rowId,
                updater: data as Partial<AppDataResponse['rows'][number]>,
                detailQueryKey: rowDetailKey
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: queryKeyPrefix })
            confirmOptimisticUpdate(queryClient, queryKeyPrefix, variables.rowId, {
                serverEntity: data ?? null
            })
            if (data) {
                queryClient.setQueryData([...queryKeyPrefix, 'row', variables.rowId], data)
            }
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(queryClient, queryKeyPrefix, queryKeyPrefix, [...queryKeyPrefix, 'row', variables.rowId])
            // Also invalidate tabular rows for this row
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey
                    return Array.isArray(key) && key[0] === 'tabularRows' && String(key[2] ?? '') === variables.rowId
                }
            })
        }
    })

    const deleteMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'delete'],
        mutationFn: (params: { rowId: string; expectedVersion?: number }) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.deleteRow(params.rowId, selectedObjectCollectionId, params.expectedVersion)
        },
        onMutate: async (params) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: params.rowId,
                strategy: 'remove'
            })
        },
        onError: (_error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
        },
        onSuccess: () => {
            applyWorkspaceLimitDelta(-1)
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
        }
    })

    const reorderMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'reorder'],
        mutationFn: async (params: { orderedRowIds: string[]; expectedVersionsByRowId?: Record<string, number> }) => {
            if (!adapter?.reorderRows) {
                throw new Error('Row reordering is not available for this runtime adapter')
            }

            await adapter.reorderRows({
                objectCollectionId: selectedObjectCollectionId ?? activeObjectCollectionId,
                sectionId: selectedObjectCollectionId ?? activeSectionId,
                orderedRowIds: params.orderedRowIds,
                expectedVersionsByRowId: params.expectedVersionsByRowId
            })
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
        }
    })

    const recordCommandMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'record-command'],
        mutationFn: async (params: { rowId: string; command: RuntimeRecordCommand; expectedVersion?: number }) => {
            if (!adapter?.recordCommand) {
                throw new Error('Record lifecycle commands are not available for this runtime adapter')
            }

            return adapter.recordCommand(params.rowId, params.command, {
                objectCollectionId: selectedObjectCollectionId ?? activeObjectCollectionId,
                sectionId: selectedObjectCollectionId ?? activeSectionId,
                expectedVersion: params.expectedVersion
            })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            queryClient.invalidateQueries({ queryKey: [...queryKeyPrefix, 'row', variables.rowId] })
        }
    })

    const workflowActionMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'workflow-action'],
        mutationFn: async (params: { rowId: string; actionCodename: string; expectedVersion: number }) => {
            if (!adapter?.workflowAction) {
                throw new Error('Workflow actions are not available for this runtime adapter')
            }

            return adapter.workflowAction(params.rowId, params.actionCodename, {
                objectCollectionId: selectedObjectCollectionId ?? activeObjectCollectionId,
                sectionId: selectedObjectCollectionId ?? activeSectionId,
                expectedVersion: params.expectedVersion
            })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            queryClient.invalidateQueries({ queryKey: [...queryKeyPrefix, 'row', variables.rowId] })
        }
    })

    const getRuntimeMutationErrorMessage = useCallback(
        (err: unknown) => extractRuntimeErrorMessage(err, t('app.errorGenericMessage', 'Please try again or reload the page.'), locale),
        [locale, t]
    )

    // ----- CRUD handlers -----
    const handleOpenCreate = useCallback(
        (createDefaults?: readonly CreateTargetDefault[]) => {
            if (displayAppData?.workspaceLimit?.canCreate === false) {
                enqueueSnackbar(
                    t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this section has been reached ({{current}} / {{max}}).',
                        current: displayAppData.workspaceLimit.currentRows,
                        max: displayAppData.workspaceLimit.maxRows ?? '∞'
                    }),
                    { variant: 'info' }
                )
                return
            }
            formRequestIdRef.current += 1
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(null)
            setFormError(null)
            setCreateInitialData(buildSafeCreateInitialData(createDefaults, fieldConfigs, createDefaultContext))
            formColumnsRef.current = currentSchemaFingerprint
            setFormOpen(true)
        },
        [displayAppData?.workspaceLimit, currentSchemaFingerprint, createDefaultContext, enqueueSnackbar, fieldConfigs, t]
    )

    const handleOpenEdit = useCallback(
        (rowId: string) => {
            if (guardPendingRowInteraction(rowId)) return
            formRequestIdRef.current += 1
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(rowId)
            setFormError(null)
            setCreateInitialData(undefined)
            formColumnsRef.current = currentSchemaFingerprint
            setFormOpen(true)
        },
        [currentSchemaFingerprint, guardPendingRowInteraction]
    )

    const handleCloseForm = useCallback(() => {
        formRequestIdRef.current += 1
        setFormOpen(false)
        setEditRowId(null)
        setCopyRowId(null)
        setCreateInitialData(undefined)
        setFormError(null)
        setCopyError(null)
        formColumnsRef.current = null
    }, [])

    const handleFormSubmit = useCallback(
        (data: Record<string, unknown>) => {
            if (formColumnsRef.current && currentSchemaFingerprint && formColumnsRef.current !== currentSchemaFingerprint) {
                setFormError(
                    t('app.errorSchemaChanged', {
                        defaultValue: 'Schema has changed since this form was opened. Please close and try again.'
                    })
                )
                return Promise.resolve()
            }

            const sanitizedData = stripReadOnlyEnumerationLabelFields({
                payload: data,
                fieldConfigs
            })
            const currentEditRowId = editRowId
            const currentCopyRowId = copyRowId
            const isCopyMode = Boolean(currentCopyRowId)
            const requestId = formRequestIdRef.current
            const submittedSchemaFingerprint = formColumnsRef.current

            const reopenFormWithError = (err: unknown) => {
                if (formRequestIdRef.current !== requestId) return

                const msg = getRuntimeMutationErrorMessage(err)
                const resolvedError = isCopyMode
                    ? t('app.errorCopy', {
                          defaultValue: 'Copy failed: {{message}}',
                          message: msg
                      })
                    : currentEditRowId
                    ? t('app.errorUpdate', {
                          defaultValue: 'Update failed: {{message}}',
                          message: msg
                      })
                    : t('app.errorCreate', {
                          defaultValue: 'Create failed: {{message}}',
                          message: msg
                      })

                setEditRowId(currentEditRowId)
                setCopyRowId(currentCopyRowId)
                setFormError(resolvedError)
                if (isCopyMode) {
                    setCopyError(resolvedError)
                } else {
                    setCopyError(null)
                }
                formColumnsRef.current = submittedSchemaFingerprint
                setFormOpen(true)
            }

            setFormError(null)
            setCopyError(null)
            setFormOpen(false)

            const sourceCopyRow = currentCopyRowId ? rows.find((row) => String(row.id) === currentCopyRowId) : null
            const copyExpectedVersion = readRuntimeRowVersion(sourceCopyRow)
            const sourceEditRow = currentEditRowId ? rows.find((row) => String(row.id) === currentEditRowId) : null
            const editExpectedVersion = readRuntimeRowVersion(sourceEditRow)
            const mutationPromise = isCopyMode
                ? copyMutation.mutateAsync({
                      rowId: currentCopyRowId!,
                      data: sanitizedData,
                      expectedVersion: copyExpectedVersion ?? undefined
                  })
                : currentEditRowId
                ? updateMutation.mutateAsync({
                      rowId: currentEditRowId,
                      data: sanitizedData,
                      expectedVersion: editExpectedVersion ?? undefined
                  })
                : createMutation.mutateAsync(sanitizedData)

            void mutationPromise
                .then(() => {
                    if (formRequestIdRef.current !== requestId) return

                    setEditRowId(null)
                    setCopyRowId(null)
                    setCreateInitialData(undefined)
                    setFormError(null)
                    setCopyError(null)
                    formColumnsRef.current = null
                })
                .catch((err: unknown) => {
                    reopenFormWithError(err)
                })

            return Promise.resolve()
        },
        [
            copyRowId,
            editRowId,
            fieldConfigs,
            rows,
            copyMutation,
            updateMutation,
            createMutation,
            t,
            currentSchemaFingerprint,
            getRuntimeMutationErrorMessage
        ]
    )

    const handleOpenDelete = useCallback(
        (rowId: string) => {
            if (guardPendingRowInteraction(rowId)) return
            deleteRequestIdRef.current += 1
            setDeleteRowId(rowId)
            setDeleteError(null)
        },
        [guardPendingRowInteraction]
    )

    const handleCloseDelete = useCallback(() => {
        deleteRequestIdRef.current += 1
        setDeleteRowId(null)
        setDeleteError(null)
    }, [])

    const handleConfirmDelete = useCallback(() => {
        if (!deleteRowId) return Promise.resolve()

        const currentDeleteRowId = deleteRowId
        const requestId = deleteRequestIdRef.current
        const currentRow = rows.find((row) => String(row.id) === currentDeleteRowId)
        const expectedVersion = readRuntimeRowVersion(currentRow)

        setDeleteError(null)
        setDeleteRowId(null)

        void deleteMutation
            .mutateAsync({ rowId: currentDeleteRowId, expectedVersion: expectedVersion ?? undefined })
            .catch((err: unknown) => {
                if (deleteRequestIdRef.current !== requestId) return

                const msg = getRuntimeMutationErrorMessage(err)
                setDeleteError(
                    t('app.errorDelete', {
                        defaultValue: 'Delete failed: {{message}}',
                        message: msg
                    })
                )
                setDeleteRowId(currentDeleteRowId)
            })

        return Promise.resolve()
    }, [deleteRowId, deleteMutation, rows, t, getRuntimeMutationErrorMessage])

    const handleOpenCopy = useCallback(
        (rowId: string) => {
            if (guardPendingRowInteraction(rowId)) return
            if (displayAppData?.workspaceLimit?.canCreate === false) {
                enqueueSnackbar(
                    t('app.workspaceLimitReached', {
                        defaultValue: 'The workspace limit for this section has been reached ({{current}} / {{max}}).',
                        current: displayAppData.workspaceLimit.currentRows,
                        max: displayAppData.workspaceLimit.maxRows ?? '∞'
                    }),
                    { variant: 'info' }
                )
                return
            }
            formRequestIdRef.current += 1
            setFormOpen(true)
            setCopyError(null)
            setFormError(null)
            setCreateInitialData(undefined)
            setCopyRowId(rowId)
            setEditRowId(null)
            formColumnsRef.current = currentSchemaFingerprint
        },
        [displayAppData?.workspaceLimit, currentSchemaFingerprint, enqueueSnackbar, guardPendingRowInteraction, t]
    )

    const handleCloseCopy = useCallback(() => {
        handleCloseForm()
    }, [handleCloseForm])

    const handlePersistRowReorder = useCallback(
        async (orderedRowIds: string[]) => {
            if (!adapter?.reorderRows || orderedRowIds.length === 0) return

            try {
                const expectedVersionsByRowId = orderedRowIds.reduce<Record<string, number>>((acc, rowId) => {
                    const version = readRuntimeRowVersion(rows.find((row) => String(row.id) === rowId))
                    if (version !== null) acc[rowId] = version
                    return acc
                }, {})
                await reorderMutation.mutateAsync({ orderedRowIds, expectedVersionsByRowId })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorReorder', {
                        defaultValue: 'Reorder failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
                throw err
            }
        },
        [adapter?.reorderRows, enqueueSnackbar, reorderMutation, rows, t, getRuntimeMutationErrorMessage]
    )

    const handleRecordCommand = useCallback(
        async (rowId: string, command: RuntimeRecordCommand) => {
            if (guardPendingRowInteraction(rowId)) return
            const row = rows.find((candidate) => candidate.id === rowId) ?? null
            const expectedVersion = readRuntimeRowVersion(row)

            try {
                await recordCommandMutation.mutateAsync({ rowId, command, expectedVersion: expectedVersion ?? undefined })
                const messageKey =
                    command === 'post' ? 'app.recordPosted' : command === 'unpost' ? 'app.recordUnposted' : 'app.recordVoided'
                const defaultValue = command === 'post' ? 'Record posted.' : command === 'unpost' ? 'Record unposted.' : 'Record voided.'
                enqueueSnackbar(t(messageKey, defaultValue), { variant: 'success' })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorRecordCommand', {
                        defaultValue: 'Record command failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
            }
        },
        [enqueueSnackbar, guardPendingRowInteraction, recordCommandMutation, rows, t, getRuntimeMutationErrorMessage]
    )

    const handleWorkflowAction = useCallback(
        async (rowId: string, actionCodename: string) => {
            if (guardPendingRowInteraction(rowId)) return

            const row = rows.find((candidate) => candidate.id === rowId) ?? null
            const expectedVersion = readRuntimeRowVersion(row)
            if (!expectedVersion) {
                enqueueSnackbar(
                    t('app.errorWorkflowVersionRequired', {
                        defaultValue: 'Workflow action requires a current row version. Please reload and try again.'
                    }),
                    { variant: 'error' }
                )
                return
            }

            try {
                await workflowActionMutation.mutateAsync({ rowId, actionCodename, expectedVersion })
                enqueueSnackbar(t('app.workflowActionCompleted', 'Workflow action completed.'), { variant: 'success' })
            } catch (err) {
                const msg = getRuntimeMutationErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorWorkflowAction', {
                        defaultValue: 'Workflow action failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
            }
        },
        [enqueueSnackbar, guardPendingRowInteraction, rows, t, workflowActionMutation, getRuntimeMutationErrorMessage]
    )

    // ----- Row actions menu -----
    const handleOpenMenu = useCallback(
        (event: React.MouseEvent<HTMLElement>, rowId: string) => {
            event.stopPropagation()
            if (guardPendingRowInteraction(rowId)) return
            setMenuAnchorEl(event.currentTarget)
            setMenuRowId(rowId)
        },
        [guardPendingRowInteraction]
    )

    const handleCloseMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    // ----- Section select handler -----
    const onSelectObjectCollection = useCallback(
        (objectCollectionId: string) => {
            if (!objectCollectionId || objectCollectionId === activeObjectCollectionId) return
            resetSectionScopedListState()
            setSelectedObjectCollectionId(objectCollectionId)
        },
        [activeObjectCollectionId, resetSectionScopedListState]
    )
    const onSelectSection = onSelectObjectCollection

    // ----- Derived: columns, fieldConfigs, rows -----
    const columns = useMemo(() => {
        if (!displayAppData) return []

        const permissions = displayAppData.permissions
        const canOpenRowActions =
            permissions?.editContent === true || permissions?.createContent === true || permissions?.deleteContent === true

        return toGridColumns(displayAppData, {
            onMenuOpen: canOpenRowActions ? handleOpenMenu : undefined,
            actionsAriaLabel: t('app.actions', 'Actions'),
            cellRenderers,
            locale
        })
    }, [displayAppData, t, handleOpenMenu, cellRenderers, locale])

    const rowCount = displayAppData?.pagination.total
    const layoutConfig = useMemo(() => normalizeDashboardLayoutConfig(displayAppData?.layoutConfig), [displayAppData?.layoutConfig])
    const localeText = useMemo(() => getDataGridLocaleText(locale), [locale])

    // ----- Derived: menus -----
    const activeMenu = useMemo(() => {
        if (!displayAppData?.menus?.length) return null
        return displayAppData.menus.find((m) => m.id === displayAppData.activeMenuId) ?? displayAppData.menus[0]
    }, [displayAppData])

    const dashboardMenuItems = useMemo<DashboardMenuItem[]>(() => {
        if (!activeMenu) return []
        return mapMenuItems(activeMenu.items, displayAppData?.sections ?? displayAppData?.objectCollections ?? [], activeSectionId)
    }, [activeMenu, displayAppData?.objectCollections, displayAppData?.sections, activeSectionId])

    // Build menus map keyed by widgetId
    const menusMap = useMemo<{ [widgetId: string]: DashboardMenuSlot }>(() => {
        if (!displayAppData?.menus?.length) return {}
        const sections = displayAppData.sections ?? displayAppData.objectCollections ?? []
        const map: { [widgetId: string]: DashboardMenuSlot } = {}

        for (const menu of displayAppData.menus) {
            if (!menu.widgetId) continue
            map[menu.widgetId] = {
                title: menu.showTitle ? menu.title ?? null : null,
                showTitle: Boolean(menu.showTitle),
                items: mapMenuItems(menu.items, sections, activeSectionId),
                overflowItems: mapMenuItems(menu.overflowItems ?? [], sections, activeSectionId),
                overflowLabel:
                    menu.overflowLabelKey === 'runtime.menu.more'
                        ? t('runtime.menu.more')
                        : menu.overflowLabelKey
                        ? t(menu.overflowLabelKey)
                        : null,
                activeSectionId: activeSectionId ?? null,
                onSelectSection,
                activeObjectCollectionId: activeObjectCollectionId ?? null,
                onSelectObjectCollection
            }
        }
        return map
    }, [displayAppData, activeObjectCollectionId, activeSectionId, onSelectObjectCollection, onSelectSection, t])

    // Menu slot for simple (non-widget) usage
    const menuSlot = useMemo<DashboardMenuSlot | undefined>(() => {
        if (dashboardMenuItems.length === 0) return undefined
        return {
            title: activeMenu?.showTitle ? activeMenu.title ?? null : null,
            showTitle: Boolean(activeMenu?.showTitle),
            items: dashboardMenuItems,
            overflowItems: activeMenu
                ? mapMenuItems(
                      activeMenu.overflowItems ?? [],
                      displayAppData?.sections ?? displayAppData?.objectCollections ?? [],
                      activeSectionId
                  )
                : [],
            overflowLabel:
                activeMenu?.overflowLabelKey === 'runtime.menu.more'
                    ? t('runtime.menu.more')
                    : activeMenu?.overflowLabelKey
                    ? t(activeMenu.overflowLabelKey)
                    : null,
            activeSectionId: activeSectionId ?? null,
            onSelectSection,
            activeObjectCollectionId: activeObjectCollectionId ?? null,
            onSelectObjectCollection
        }
    }, [
        dashboardMenuItems,
        activeMenu,
        activeObjectCollectionId,
        activeSectionId,
        displayAppData?.objectCollections,
        displayAppData?.sections,
        onSelectObjectCollection,
        onSelectSection,
        t
    ])

    // Form initial data
    const formInitialData = useMemo(() => {
        if (!sourceRowId) return createInitialData
        if (rowQuery.data) {
            const raw = rowQuery.data as Record<string, unknown>
            const sourceData = ((raw.data as Record<string, unknown>) ?? raw) as Record<string, unknown>
            if (copyRowId) {
                const withCopySuffix = appendCopySuffixToFirstStringField({
                    sourceData,
                    fieldConfigs,
                    locale
                })
                const tableData = copyTablesQuery.data ?? {}
                return {
                    ...withCopySuffix,
                    ...tableData
                }
            }
            return sourceData
        }
        return undefined
    }, [sourceRowId, createInitialData, copyRowId, fieldConfigs, rowQuery.data, copyTablesQuery.data, locale])

    const isCopyTablesReady = !copyRowId || tableColumnRefs.length === 0 || !adapter?.fetchTabularRows || Boolean(copyTablesQuery.data)
    const isFormReady = !sourceRowId || (Boolean(rowQuery.data) && isCopyTablesReady)

    return {
        // Data
        appData: displayAppData,
        isLoading: listQuery.isLoading || isSuppressingStaleSectionData,
        isFetching: listQuery.isFetching,
        isError: listQuery.isError,

        // Layout
        layoutConfig,

        // Table
        columns,
        fieldConfigs,
        rows,
        rowCount,
        paginationModel,
        setPaginationModel,
        sortModel,
        setSortModel,
        filterModel,
        setFilterModel,
        searchValue,
        setSearchValue,
        pageSizeOptions,
        localeText,
        handlePendingInteractionAttempt: guardPendingRowInteraction,

        // Section aliases
        activeSectionId,
        selectedSectionId: selectedObjectCollectionId,
        onSelectSection,

        // Object compatibility
        activeObjectCollectionId,
        selectedObjectCollectionId,
        onSelectObjectCollection,

        // Menus
        activeMenu,
        dashboardMenuItems,
        menuSlot,
        menusMap,

        // CRUD form
        formOpen,
        editRowId,
        formError,
        formInitialData,
        isFormReady,
        isSubmitting: createMutation.isPending || updateMutation.isPending,
        isReordering: reorderMutation.isPending,
        canPersistRowReorder,
        handleOpenCreate,
        handleOpenEdit,
        handleCloseForm,
        handleFormSubmit,
        handlePersistRowReorder,

        // Delete dialog
        deleteRowId,
        deleteError,
        isDeleting: deleteMutation.isPending,
        handleOpenDelete,
        handleCloseDelete,
        handleConfirmDelete,
        copyRowId,
        copyError,
        isCopying: Boolean(copyRowId) && copyMutation.isPending,
        handleOpenCopy,
        handleCloseCopy,

        // Row menu
        menuAnchorEl,
        menuRowId,
        handleOpenMenu,
        handleCloseMenu,
        handleRecordCommand: adapter?.recordCommand ? handleRecordCommand : undefined,
        isRecordCommandPending: recordCommandMutation.isPending,
        handleWorkflowAction: adapter?.workflowAction ? handleWorkflowAction : undefined,
        isWorkflowActionPending: workflowActionMutation.isPending
    }
}
