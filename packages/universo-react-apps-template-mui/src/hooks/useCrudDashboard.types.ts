import type { GridColDef, GridFilterModel, GridLocaleText, GridPaginationModel, GridSortModel } from '@mui/x-data-grid'
import type { CreateTargetDefault, RelationBuilderWidgetConfig } from '@universo-react/types'
import type { AppDataResponse } from '../api/api'
import type { CellRendererOverrides, CrudDataAdapter, RuntimeRecordCommand, RuntimeRelationScope } from '../api/types'
import type { FieldConfig } from '../components/dialogs/FormDialog'

export type RelationBuilderCreateWizard = RelationBuilderWidgetConfig['panels'][number]['createWizard']

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
    /** Refreshes active host-projected widget data after row updates. */
    onRuntimeDataChanged?: () => void | Promise<unknown>
    /** Explicit workspace selected by the runtime route. Omitted means server default workspace. */
    workspaceId?: string | null
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
    rawAppData: AppDataResponse | undefined
    appData: AppDataResponse | undefined
    isLoading: boolean
    isFetching: boolean
    isError: boolean

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

    // CRUD form
    formOpen: boolean
    editRowId: string | null
    formError: string | null
    formInitialData: Record<string, unknown> | undefined
    createWizard: RelationBuilderCreateWizard
    isFormReady: boolean
    isSubmitting: boolean
    isReordering: boolean
    canPersistRowReorder: boolean
    canPersistRelationRowReorder: boolean
    handleOpenCreate: (
        createDefaults?: readonly CreateTargetDefault[],
        createDefaultContextOverride?: Record<string, unknown>,
        relationScope?: RuntimeRelationScope,
        createWizard?: RelationBuilderCreateWizard
    ) => void
    handleOpenEdit: (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => void
    handleCloseForm: () => void
    handleFormSubmit: (data: Record<string, unknown>) => Promise<void>
    handlePersistRowReorder: (params: {
        objectCollectionCodename: string
        orderedRowIds: string[]
        expectedVersionsByRowId: Record<string, number>
    }) => Promise<void>
    handlePersistRelationRowReorder: (params: {
        objectCollectionCodename: string
        parentFieldCodename: string
        parentRecordId: string
        orderedRowIds: string[]
        expectedVersionsByRowId: Record<string, number>
    }) => Promise<void>

    // Delete dialog
    deleteRowId: string | null
    deleteError: string | null
    isDeleting: boolean
    handleOpenDelete: (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => void
    handleCloseDelete: () => void
    handleConfirmDelete: () => Promise<void>

    // Copy dialog
    copyRowId: string | null
    copyError: string | null
    isCopying: boolean
    handleOpenCopy: (rowId: string, relationScope?: RuntimeRelationScope, expectedVersion?: number) => void
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
