import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { GridColDef, GridFilterModel, GridLocaleText, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { isPendingInteractionBlocked, makePendingMarkers } from '@universo/utils'
import { normalizeDashboardLayoutConfig } from '@universo/utils'
import type { DashboardLayoutConfig } from '@universo/types'
import type { PendingAction } from '@universo/utils'
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
import { toGridColumns, toFieldConfigs } from '../utils/columns'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'
import { mapGridFilterModel, mapGridSortModel } from '../utils/runtimeListQuery'

// ---------------------------------------------------------------------------
//  Stable empty key prefix (avoids new [] allocation on each render)
// ---------------------------------------------------------------------------

const EMPTY_KEY_PREFIX: readonly unknown[] = []

const readInitialLinkedCollectionId = (): string | undefined => {
    if (typeof window === 'undefined') return undefined
    try {
        return new URLSearchParams(window.location.search).get('linkedCollectionId') ?? undefined
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

// ---------------------------------------------------------------------------
//  Helper: extract human-readable error message from API failures
// ---------------------------------------------------------------------------

/**
 * Extract the most useful error message from an API failure.
 *
 * For Axios errors the server response body is available under
 * `err.response.data`.  We prefer the server-provided `error` or
 * `message` field over the generic Axios status line.
 */
const extractApiErrorMessage = (err: unknown): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const responseData = (err as any)?.response?.data
    if (responseData) {
        if (typeof responseData.error === 'string' && responseData.error.trim()) return responseData.error
        if (typeof responseData.message === 'string' && responseData.message.trim()) return responseData.message
    }
    if (err instanceof Error) return err.message
    return String(err)
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

        if (item.kind === 'catalog' || item.kind === 'section' || item.kind === 'page') {
            const targetSectionId = item.sectionId ?? item.linkedCollectionId ?? null
            return [
                {
                    id: item.id,
                    label: item.title,
                    icon: item.icon ?? null,
                    kind: item.kind === 'page' ? ('page' as const) : targetSectionId ? ('section' as const) : ('catalog' as const),
                    sectionId: targetSectionId,
                    linkedCollectionId: item.linkedCollectionId ?? targetSectionId,
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
                    linkedCollectionId: null,
                    treeEntityId: item.treeEntityId ?? null,
                    href: null,
                    selected: false
                }
            ]
        }

        if (item.kind === 'catalogs_all') {
            return sections.map((section) => ({
                id: `${item.id}:${section.id}`,
                label: section.name,
                icon: item.icon ?? null,
                kind: 'section' as const,
                sectionId: section.id,
                linkedCollectionId: section.id,
                href: null,
                selected: section.id === activeSectionId
            }))
        }

        return [
            {
                id: item.id,
                label: item.title,
                icon: item.icon ?? null,
                kind: 'link' as const,
                sectionId: null,
                linkedCollectionId: null,
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

    // Section selection aliases (catalog fields remain for compatibility)
    activeSectionId: string | undefined
    selectedSectionId: string | undefined
    onSelectSection: (sectionId: string) => void
    activeLinkedCollectionId: string | undefined
    selectedLinkedCollectionId: string | undefined
    onSelectLinkedCollection: (linkedCollectionId: string) => void

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
    handleOpenCreate: () => void
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
        cellRenderers
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
    const [selectedLinkedCollectionId, setSelectedLinkedCollectionId] = useState<string | undefined>(
        () => initialSectionId ?? readInitialLinkedCollectionId()
    )

    // ----- CRUD dialog state -----
    const [formOpen, setFormOpen] = useState(false)
    const [editRowId, setEditRowId] = useState<string | null>(null)
    const [deleteRowId, setDeleteRowId] = useState<string | null>(null)
    const [copyRowId, setCopyRowId] = useState<string | null>(null)
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
                selectedLinkedCollectionId,
                { limit, offset, locale, search: normalizedSearchValue, sort: runtimeSort, filters: runtimeFilters }
            ] as const,
        [queryKeyPrefix, selectedLinkedCollectionId, limit, offset, locale, normalizedSearchValue, runtimeFilters, runtimeSort]
    )

    useEffect(() => {
        if (!initialSectionId) return
        setSelectedLinkedCollectionId((current) => {
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
                linkedCollectionId: selectedLinkedCollectionId,
                sectionId: selectedLinkedCollectionId,
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
        appData?.activeSectionId ?? appData?.section?.id ?? appData?.activeLinkedCollectionId ?? appData?.linkedCollection.id
    const backendActiveLinkedCollectionId = appData?.activeLinkedCollectionId ?? appData?.linkedCollection.id ?? backendActiveSectionId

    const initialMenuSectionId = useMemo(() => {
        if (!appData?.menus?.length) return undefined
        const menu = appData.menus.find((item) => item.id === appData.activeMenuId) ?? appData.menus[0]
        if (menu?.startSectionId) return menu.startSectionId
        const firstSectionItem = menu?.items?.find(
            (item) =>
                item.isActive !== false &&
                (item.kind === 'catalog' || item.kind === 'section' || item.kind === 'page') &&
                Boolean(item.sectionId ?? item.linkedCollectionId)
        )
        return firstSectionItem?.sectionId ?? firstSectionItem?.linkedCollectionId ?? undefined
    }, [appData])

    const isResolvingInitialMenuSection = Boolean(
        appData &&
            !selectedLinkedCollectionId &&
            initialMenuSectionId &&
            backendActiveSectionId &&
            initialMenuSectionId !== backendActiveSectionId
    )
    const isResolvingSelectedSection = Boolean(
        appData &&
            selectedLinkedCollectionId &&
            backendActiveSectionId &&
            selectedLinkedCollectionId !== backendActiveSectionId &&
            listQuery.isFetching
    )
    const isSuppressingStaleSectionData = isResolvingInitialMenuSection || isResolvingSelectedSection
    const displayAppData = isSuppressingStaleSectionData ? undefined : appData
    const activeSectionId = selectedLinkedCollectionId ?? (isSuppressingStaleSectionData ? initialMenuSectionId : backendActiveSectionId)
    const activeLinkedCollectionId =
        selectedLinkedCollectionId ?? (isSuppressingStaleSectionData ? initialMenuSectionId : backendActiveLinkedCollectionId)
    const tableColumnRefs = useMemo(
        () =>
            (displayAppData?.columns ?? [])
                .filter((column) => column.dataType === 'TABLE')
                .map((column) => ({
                    fieldId: column.field,
                    attributeId: column.id
                })),
        [displayAppData?.columns]
    )
    const copyTablesKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'copy-table-data',
                sourceRowId,
                selectedLinkedCollectionId,
                tableColumnRefs.map((column) => column.fieldId).join(',')
            ] as const,
        [queryKeyPrefix, sourceRowId, selectedLinkedCollectionId, tableColumnRefs]
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
    const canPersistRowReorder = Boolean(adapter?.reorderRows)

    // Initialize section from the menu (fallback: backend active section)
    useEffect(() => {
        if (!appData || selectedLinkedCollectionId) return
        const initialSectionId = initialMenuSectionId ?? backendActiveSectionId
        if (initialSectionId) setSelectedLinkedCollectionId(initialSectionId)
    }, [appData, selectedLinkedCollectionId, initialMenuSectionId, backendActiveSectionId])

    // ----- Row query (for edit) -----
    const rowQuery = useQuery({
        queryKey: rowKey,
        queryFn: () => adapter!.fetchRow(sourceRowId!, selectedLinkedCollectionId ?? activeSectionId),
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
                        attributeId: column.attributeId,
                        linkedCollectionId: selectedLinkedCollectionId ?? activeLinkedCollectionId,
                        sectionId: selectedLinkedCollectionId ?? activeSectionId
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
            return adapter.createRow(data, selectedLinkedCollectionId)
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

    const updateMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'update'],
        mutationFn: (params: { rowId: string; data: Record<string, unknown> }) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.updateRow(params.rowId, params.data, selectedLinkedCollectionId)
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
        mutationFn: (rowId: string) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.deleteRow(rowId, selectedLinkedCollectionId)
        },
        onMutate: async (rowId) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: rowId,
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
        mutationFn: async (orderedRowIds: string[]) => {
            if (!adapter?.reorderRows) {
                throw new Error('Row reordering is not available for this runtime adapter')
            }

            await adapter.reorderRows({
                linkedCollectionId: selectedLinkedCollectionId ?? activeLinkedCollectionId,
                sectionId: selectedLinkedCollectionId ?? activeSectionId,
                orderedRowIds
            })
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
        }
    })

    const recordCommandMutation = useMutation({
        mutationKey: [...queryKeyPrefix, 'record-command'],
        mutationFn: async (params: { rowId: string; command: RuntimeRecordCommand }) => {
            if (!adapter?.recordCommand) {
                throw new Error('Record lifecycle commands are not available for this runtime adapter')
            }

            return adapter.recordCommand(params.rowId, params.command, {
                linkedCollectionId: selectedLinkedCollectionId ?? activeLinkedCollectionId,
                sectionId: selectedLinkedCollectionId ?? activeSectionId
            })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(queryClient, queryKeyPrefix, queryKeyPrefix)
            queryClient.invalidateQueries({ queryKey: [...queryKeyPrefix, 'row', variables.rowId] })
        }
    })

    // ----- CRUD handlers -----
    const handleOpenCreate = useCallback(() => {
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
        formColumnsRef.current = currentSchemaFingerprint
        setFormOpen(true)
    }, [displayAppData?.workspaceLimit, currentSchemaFingerprint, enqueueSnackbar, t])

    const handleOpenEdit = useCallback(
        (rowId: string) => {
            if (guardPendingRowInteraction(rowId)) return
            formRequestIdRef.current += 1
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(rowId)
            setFormError(null)
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

                const msg = extractApiErrorMessage(err)
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

            const mutationPromise = isCopyMode
                ? createMutation.mutateAsync(sanitizedData)
                : currentEditRowId
                ? updateMutation.mutateAsync({ rowId: currentEditRowId, data: sanitizedData })
                : createMutation.mutateAsync(sanitizedData)

            void mutationPromise
                .then(() => {
                    if (formRequestIdRef.current !== requestId) return

                    setEditRowId(null)
                    setCopyRowId(null)
                    setFormError(null)
                    setCopyError(null)
                    formColumnsRef.current = null
                })
                .catch((err: unknown) => {
                    reopenFormWithError(err)
                })

            return Promise.resolve()
        },
        [copyRowId, editRowId, fieldConfigs, updateMutation, createMutation, t, currentSchemaFingerprint]
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

        setDeleteError(null)
        setDeleteRowId(null)

        void deleteMutation.mutateAsync(currentDeleteRowId).catch((err: unknown) => {
            if (deleteRequestIdRef.current !== requestId) return

            const msg = extractApiErrorMessage(err)
            setDeleteError(
                t('app.errorDelete', {
                    defaultValue: 'Delete failed: {{message}}',
                    message: msg
                })
            )
            setDeleteRowId(currentDeleteRowId)
        })

        return Promise.resolve()
    }, [deleteRowId, deleteMutation, t])

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
                await reorderMutation.mutateAsync(orderedRowIds)
            } catch (err) {
                const msg = extractApiErrorMessage(err)
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
        [adapter?.reorderRows, enqueueSnackbar, reorderMutation, t]
    )

    const handleRecordCommand = useCallback(
        async (rowId: string, command: RuntimeRecordCommand) => {
            if (guardPendingRowInteraction(rowId)) return

            try {
                await recordCommandMutation.mutateAsync({ rowId, command })
                const messageKey =
                    command === 'post' ? 'app.recordPosted' : command === 'unpost' ? 'app.recordUnposted' : 'app.recordVoided'
                const defaultValue = command === 'post' ? 'Record posted.' : command === 'unpost' ? 'Record unposted.' : 'Record voided.'
                enqueueSnackbar(t(messageKey, defaultValue), { variant: 'success' })
            } catch (err) {
                const msg = extractApiErrorMessage(err)
                enqueueSnackbar(
                    t('app.errorRecordCommand', {
                        defaultValue: 'Record command failed: {{message}}',
                        message: msg
                    }),
                    { variant: 'error' }
                )
            }
        },
        [enqueueSnackbar, guardPendingRowInteraction, recordCommandMutation, t]
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
    const onSelectLinkedCollection = useCallback(
        (linkedCollectionId: string) => {
            if (!linkedCollectionId || linkedCollectionId === activeLinkedCollectionId) return
            resetSectionScopedListState()
            setSelectedLinkedCollectionId(linkedCollectionId)
        },
        [activeLinkedCollectionId, resetSectionScopedListState]
    )
    const onSelectSection = onSelectLinkedCollection

    // ----- Derived: columns, fieldConfigs, rows -----
    const columns = useMemo(() => {
        if (!displayAppData) return []

        const permissions = displayAppData.permissions
        const canOpenRowActions =
            permissions === undefined ||
            permissions.editContent === true ||
            permissions.createContent === true ||
            permissions.deleteContent === true

        return toGridColumns(displayAppData, {
            onMenuOpen: canOpenRowActions ? handleOpenMenu : undefined,
            actionsAriaLabel: t('app.actions', 'Actions'),
            cellRenderers,
            locale
        })
    }, [displayAppData, t, handleOpenMenu, cellRenderers, locale])

    const rows = useMemo(() => (displayAppData ? displayAppData.rows : []), [displayAppData])

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
        return mapMenuItems(activeMenu.items, displayAppData?.sections ?? displayAppData?.linkedCollections ?? [], activeSectionId)
    }, [activeMenu, displayAppData?.linkedCollections, displayAppData?.sections, activeSectionId])

    // Build menus map keyed by widgetId
    const menusMap = useMemo<{ [widgetId: string]: DashboardMenuSlot }>(() => {
        if (!displayAppData?.menus?.length) return {}
        const sections = displayAppData.sections ?? displayAppData.linkedCollections ?? []
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
                        ? t('runtime.menu.more', 'More')
                        : menu.overflowLabelKey
                        ? t(menu.overflowLabelKey, 'More')
                        : null,
                activeSectionId: activeSectionId ?? null,
                onSelectSection,
                activeLinkedCollectionId: activeLinkedCollectionId ?? null,
                onSelectLinkedCollection
            }
        }
        return map
    }, [displayAppData, activeLinkedCollectionId, activeSectionId, onSelectLinkedCollection, onSelectSection, t])

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
                      displayAppData?.sections ?? displayAppData?.linkedCollections ?? [],
                      activeSectionId
                  )
                : [],
            overflowLabel:
                activeMenu?.overflowLabelKey === 'runtime.menu.more'
                    ? t('runtime.menu.more', 'More')
                    : activeMenu?.overflowLabelKey
                    ? t(activeMenu.overflowLabelKey, 'More')
                    : null,
            activeSectionId: activeSectionId ?? null,
            onSelectSection,
            activeLinkedCollectionId: activeLinkedCollectionId ?? null,
            onSelectLinkedCollection
        }
    }, [
        dashboardMenuItems,
        activeMenu,
        activeLinkedCollectionId,
        activeSectionId,
        displayAppData?.linkedCollections,
        displayAppData?.sections,
        onSelectLinkedCollection,
        onSelectSection,
        t
    ])

    // Form initial data
    const formInitialData = useMemo(() => {
        if (!sourceRowId) return undefined
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
    }, [sourceRowId, copyRowId, fieldConfigs, rowQuery.data, copyTablesQuery.data, locale])

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
        selectedSectionId: selectedLinkedCollectionId,
        onSelectSection,

        // Catalog compatibility
        activeLinkedCollectionId,
        selectedLinkedCollectionId,
        onSelectLinkedCollection,

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
        isCopying: Boolean(copyRowId) && createMutation.isPending,
        handleOpenCopy,
        handleCloseCopy,

        // Row menu
        menuAnchorEl,
        menuRowId,
        handleOpenMenu,
        handleCloseMenu,
        handleRecordCommand: adapter?.recordCommand ? handleRecordCommand : undefined,
        isRecordCommandPending: recordCommandMutation.isPending
    }
}
