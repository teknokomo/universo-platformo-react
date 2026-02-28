import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { GridColDef, GridLocaleText, GridPaginationModel } from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import type { AppDataResponse, DashboardLayoutConfig } from '../api/api'
import type { CrudDataAdapter, CellRendererOverrides } from '../api/types'
import type { DashboardMenuItem, DashboardMenuSlot } from '../dashboard/Dashboard'
import type { FieldConfig } from '../components/dialogs/FormDialog'
import { toGridColumns, toFieldConfigs } from '../utils/columns'
import { getDataGridLocaleText } from '../utils/getDataGridLocale'

// ---------------------------------------------------------------------------
//  Helper: fill missing layout toggles with `true`
// ---------------------------------------------------------------------------

function withDashboardDefaults(
    config: DashboardLayoutConfig | Record<string, unknown> | undefined
): Required<NonNullable<DashboardLayoutConfig>> {
    const c = (config ?? {}) as Record<string, unknown>
    const bool = (v: unknown, fb = true) => (typeof v === 'boolean' ? v : fb)
    return {
        showSideMenu: bool(c.showSideMenu),
        showAppNavbar: bool(c.showAppNavbar),
        showHeader: bool(c.showHeader),
        showBreadcrumbs: bool(c.showBreadcrumbs),
        showSearch: bool(c.showSearch),
        showDatePicker: bool(c.showDatePicker),
        showOptionsMenu: bool(c.showOptionsMenu),
        showLanguageSwitcher: bool(c.showLanguageSwitcher),
        showOverviewTitle: bool(c.showOverviewTitle),
        showOverviewCards: bool(c.showOverviewCards),
        showSessionsChart: bool(c.showSessionsChart),
        showPageViewsChart: bool(c.showPageViewsChart),
        showDetailsTitle: bool(c.showDetailsTitle),
        showDetailsTable: bool(c.showDetailsTable),
        showColumnsContainer: bool(c.showColumnsContainer, false),
        showProductTree: bool(c.showProductTree),
        showUsersByCountryChart: bool(c.showUsersByCountryChart),
        showRightSideMenu: bool(c.showRightSideMenu),
        showFooter: bool(c.showFooter)
    }
}

// ---------------------------------------------------------------------------
//  Stable empty key prefix (avoids new [] allocation on each render)
// ---------------------------------------------------------------------------

const EMPTY_KEY_PREFIX: readonly unknown[] = []

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
    catalogs: AppDataResponse['catalogs'],
    activeCatalogId: string | undefined
): DashboardMenuItem[] {
    return items.flatMap((item): DashboardMenuItem[] => {
        if (!item.isActive) return []

        if (item.kind === 'catalog') {
            return [
                {
                    id: item.id,
                    label: item.title,
                    icon: item.icon ?? null,
                    kind: 'catalog' as const,
                    catalogId: item.catalogId ?? null,
                    href: null,
                    selected: item.catalogId != null && item.catalogId === activeCatalogId
                }
            ]
        }

        if (item.kind === 'catalogs_all') {
            return catalogs.map((catalog) => ({
                id: `${item.id}:${catalog.id}`,
                label: catalog.name,
                icon: item.icon ?? null,
                kind: 'catalog' as const,
                catalogId: catalog.id,
                href: null,
                selected: catalog.id === activeCatalogId
            }))
        }

        return [
            {
                id: item.id,
                label: item.title,
                icon: item.icon ?? null,
                kind: 'link' as const,
                catalogId: null,
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
    layoutConfig: Required<NonNullable<DashboardLayoutConfig>>

    // Table
    columns: GridColDef[]
    fieldConfigs: FieldConfig[]
    rows: Array<Record<string, unknown> & { id: string }>
    rowCount: number | undefined
    paginationModel: GridPaginationModel
    setPaginationModel: (model: GridPaginationModel) => void
    pageSizeOptions: number[]
    localeText: Partial<GridLocaleText> | undefined

    // Catalog selection
    activeCatalogId: string | undefined
    selectedCatalogId: string | undefined
    onSelectCatalog: (catalogId: string) => void

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
    handleOpenCreate: () => void
    handleOpenEdit: (rowId: string) => void
    handleCloseForm: () => void
    handleFormSubmit: (data: Record<string, unknown>) => Promise<void>

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
        cellRenderers
    } = options

    const { t } = useTranslation(i18nNamespace)
    const queryClient = useQueryClient()

    // ----- Pagination & catalog -----
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: defaultPageSize
    })
    const [selectedCatalogId, setSelectedCatalogId] = useState<string | undefined>(undefined)

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

    // ----- Derived values -----
    const limit = paginationModel.pageSize
    const offset = paginationModel.page * paginationModel.pageSize

    // Query key helpers
    const queryKeyPrefix = adapter?.queryKeyPrefix ?? EMPTY_KEY_PREFIX
    const listKey = useMemo(
        () => [...queryKeyPrefix, 'list', selectedCatalogId, { limit, offset, locale }] as const,
        [queryKeyPrefix, selectedCatalogId, limit, offset, locale]
    )
    const sourceRowId = copyRowId ?? editRowId
    const rowKey = useMemo(() => [...queryKeyPrefix, 'row', sourceRowId] as const, [queryKeyPrefix, sourceRowId])

    // ----- List query -----
    const listQuery = useQuery({
        queryKey: listKey,
        queryFn: () => adapter!.fetchList({ limit, offset, locale, catalogId: selectedCatalogId }),
        enabled: Boolean(adapter),
        staleTime,
        placeholderData: (prev) => prev
    })

    const appData = listQuery.data
    const activeCatalogId = appData?.activeCatalogId ?? appData?.catalog.id
    const tableColumnRefs = useMemo(
        () =>
            (appData?.columns ?? [])
                .filter((column) => column.dataType === 'TABLE')
                .map((column) => ({
                    fieldId: column.field,
                    attributeId: column.id
                })),
        [appData?.columns]
    )
    const copyTablesKey = useMemo(
        () =>
            [
                ...queryKeyPrefix,
                'copy-table-data',
                sourceRowId,
                selectedCatalogId,
                tableColumnRefs.map((column) => column.fieldId).join(',')
            ] as const,
        [queryKeyPrefix, sourceRowId, selectedCatalogId, tableColumnRefs]
    )

    // Schema fingerprint (M4)
    const currentSchemaFingerprint = useMemo(() => {
        if (!appData?.columns) return null
        return appData.columns
            .map((c) => c.field)
            .sort()
            .join(',')
    }, [appData?.columns])
    const fieldConfigs = useMemo(() => (appData ? toFieldConfigs(appData) : []), [appData])

    // Initialize catalog from backend response
    useEffect(() => {
        if (!appData || selectedCatalogId) return
        if (activeCatalogId) setSelectedCatalogId(activeCatalogId)
    }, [appData, selectedCatalogId, activeCatalogId])

    // ----- Row query (for edit) -----
    const rowQuery = useQuery({
        queryKey: rowKey,
        queryFn: () => adapter!.fetchRow(sourceRowId!, selectedCatalogId),
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
                        catalogId: selectedCatalogId ?? activeCatalogId
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
        mutationFn: (data: Record<string, unknown>) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.createRow(data, selectedCatalogId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
        }
    })

    const updateMutation = useMutation({
        mutationFn: (params: { rowId: string; data: Record<string, unknown> }) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.updateRow(params.rowId, params.data, selectedCatalogId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
            queryClient.invalidateQueries({
                queryKey: [...queryKeyPrefix, 'row', variables.rowId]
            })
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = query.queryKey
                    return Array.isArray(key) && key[0] === 'tabularRows' && String(key[2] ?? '') === variables.rowId
                }
            })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: (rowId: string) => {
            if (!adapter) throw new Error('Adapter is not available')
            return adapter.deleteRow(rowId, selectedCatalogId)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
        }
    })

    // ----- CRUD handlers -----
    const handleOpenCreate = useCallback(() => {
        setCopyRowId(null)
        setCopyError(null)
        setEditRowId(null)
        setFormError(null)
        formColumnsRef.current = currentSchemaFingerprint
        setFormOpen(true)
    }, [currentSchemaFingerprint])

    const handleOpenEdit = useCallback(
        (rowId: string) => {
            setCopyRowId(null)
            setCopyError(null)
            setEditRowId(rowId)
            setFormError(null)
            formColumnsRef.current = currentSchemaFingerprint
            setFormOpen(true)
        },
        [currentSchemaFingerprint]
    )

    const handleCloseForm = useCallback(() => {
        setFormOpen(false)
        setEditRowId(null)
        setCopyRowId(null)
        setFormError(null)
        setCopyError(null)
        formColumnsRef.current = null
    }, [])

    const handleFormSubmit = useCallback(
        async (data: Record<string, unknown>) => {
            // M4: check for schema drift
            if (formColumnsRef.current && currentSchemaFingerprint && formColumnsRef.current !== currentSchemaFingerprint) {
                setFormError(
                    t('app.errorSchemaChanged', {
                        defaultValue: 'Schema has changed since this form was opened. Please close and try again.'
                    })
                )
                return
            }
            try {
                const sanitizedData = stripReadOnlyEnumerationLabelFields({
                    payload: data,
                    fieldConfigs
                })
                if (copyRowId) {
                    setCopyError(null)
                    await createMutation.mutateAsync(sanitizedData)
                } else if (editRowId) {
                    await updateMutation.mutateAsync({ rowId: editRowId, data: sanitizedData })
                } else {
                    await createMutation.mutateAsync(sanitizedData)
                }
                handleCloseForm()
            } catch (err) {
                const msg = extractApiErrorMessage(err)
                const resolvedError = copyRowId
                    ? t('app.errorCopy', {
                          defaultValue: 'Copy failed: {{message}}',
                          message: msg
                      })
                    : editRowId
                    ? t('app.errorUpdate', {
                          defaultValue: 'Update failed: {{message}}',
                          message: msg
                      })
                    : t('app.errorCreate', {
                          defaultValue: 'Create failed: {{message}}',
                          message: msg
                      })
                setFormError(resolvedError)
                if (copyRowId) {
                    setCopyError(resolvedError)
                }
            }
        },
        [copyRowId, editRowId, fieldConfigs, updateMutation, createMutation, handleCloseForm, t, currentSchemaFingerprint]
    )

    const handleOpenDelete = useCallback((rowId: string) => {
        setDeleteRowId(rowId)
        setDeleteError(null)
    }, [])

    const handleCloseDelete = useCallback(() => {
        setDeleteRowId(null)
        setDeleteError(null)
    }, [])

    const handleConfirmDelete = useCallback(async () => {
        if (!deleteRowId) return
        try {
            await deleteMutation.mutateAsync(deleteRowId)
            handleCloseDelete()
        } catch (err) {
            const msg = extractApiErrorMessage(err)
            setDeleteError(
                t('app.errorDelete', {
                    defaultValue: 'Delete failed: {{message}}',
                    message: msg
                })
            )
        }
    }, [deleteRowId, deleteMutation, handleCloseDelete, t])

    const handleOpenCopy = useCallback(
        (rowId: string) => {
            setFormOpen(true)
            setCopyError(null)
            setFormError(null)
            setCopyRowId(rowId)
            setEditRowId(null)
            formColumnsRef.current = currentSchemaFingerprint
        },
        [currentSchemaFingerprint]
    )

    const handleCloseCopy = useCallback(() => {
        handleCloseForm()
    }, [handleCloseForm])

    // ----- Row actions menu -----
    const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>, rowId: string) => {
        event.stopPropagation()
        setMenuAnchorEl(event.currentTarget)
        setMenuRowId(rowId)
    }, [])

    const handleCloseMenu = useCallback(() => {
        setMenuAnchorEl(null)
        setMenuRowId(null)
    }, [])

    // ----- Catalog select handler -----
    const onSelectCatalog = useCallback(
        (catalogId: string) => {
            if (!catalogId || catalogId === activeCatalogId) return
            setPaginationModel((prev) => ({ ...prev, page: 0 }))
            setSelectedCatalogId(catalogId)
        },
        [activeCatalogId]
    )

    // ----- Derived: columns, fieldConfigs, rows -----
    const columns = useMemo(
        () =>
            appData
                ? toGridColumns(appData, {
                      onMenuOpen: handleOpenMenu,
                      actionsAriaLabel: t('app.actions', 'Actions'),
                      cellRenderers
                  })
                : [],
        [appData, t, handleOpenMenu, cellRenderers]
    )

    const rows = useMemo(() => (appData ? appData.rows : []), [appData])

    const rowCount = appData?.pagination.total
    const layoutConfig = useMemo(() => withDashboardDefaults(appData?.layoutConfig), [appData?.layoutConfig])
    const localeText = useMemo(() => getDataGridLocaleText(locale), [locale])

    // ----- Derived: menus -----
    const activeMenu = useMemo(() => {
        if (!appData?.menus?.length) return null
        return appData.menus.find((m) => m.id === appData.activeMenuId) ?? appData.menus[0]
    }, [appData])

    const dashboardMenuItems = useMemo<DashboardMenuItem[]>(() => {
        if (!activeMenu) return []
        return mapMenuItems(activeMenu.items, appData?.catalogs ?? [], activeCatalogId)
    }, [activeMenu, appData?.catalogs, activeCatalogId])

    // Build menus map keyed by widgetId
    const menusMap = useMemo<{ [widgetId: string]: DashboardMenuSlot }>(() => {
        if (!appData?.menus?.length) return {}
        const catalogs = appData.catalogs ?? []
        const map: { [widgetId: string]: DashboardMenuSlot } = {}

        for (const menu of appData.menus) {
            if (!menu.widgetId) continue
            map[menu.widgetId] = {
                title: menu.showTitle ? menu.title ?? null : null,
                showTitle: Boolean(menu.showTitle),
                items: mapMenuItems(menu.items, catalogs, activeCatalogId),
                activeCatalogId: activeCatalogId ?? null,
                onSelectCatalog
            }
        }
        return map
    }, [appData, activeCatalogId, onSelectCatalog])

    // Menu slot for simple (non-widget) usage
    const menuSlot = useMemo<DashboardMenuSlot | undefined>(() => {
        if (dashboardMenuItems.length === 0) return undefined
        return {
            title: activeMenu?.showTitle ? activeMenu.title ?? null : null,
            showTitle: Boolean(activeMenu?.showTitle),
            items: dashboardMenuItems,
            activeCatalogId: activeCatalogId ?? null,
            onSelectCatalog
        }
    }, [dashboardMenuItems, activeMenu, activeCatalogId, onSelectCatalog])

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
        appData,
        isLoading: listQuery.isLoading,
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
        pageSizeOptions,
        localeText,

        // Catalog
        activeCatalogId,
        selectedCatalogId,
        onSelectCatalog,

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
        handleOpenCreate,
        handleOpenEdit,
        handleCloseForm,
        handleFormSubmit,

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
        handleCloseMenu
    }
}
