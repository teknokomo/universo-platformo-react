import type { AppDataResponse } from './api'
import type { RuntimeDatasourceFilter, RuntimeDatasourceSort } from '@universo-react/types'

export type RuntimeRecordCommand = 'post' | 'unpost' | 'void'

export type RuntimeRestoreTarget =
    | { mode: 'original' }
    | {
          mode: 'target'
          targetObjectCollectionId: string
          targetRecordId: string
          targetWorkspaceId?: string | null
          parentFieldCodename?: string
      }

export interface RuntimeListQueryParams {
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
    lifecycleState?: 'active' | 'deleted'
}

/**
 * Adapter interface that decouples CRUD business logic from specific
 * API implementations (standalone fetch vs auth'd apiClient).
 *
 * Consumers provide an adapter to `useCrudDashboard` hook, which uses
 * these methods for all data operations.
 */
export interface CrudDataAdapter {
    /** Unique prefix for React Query cache keys scoped to this adapter. */
    queryKeyPrefix: readonly unknown[]

    /** Fetch paginated list of rows including schema, menus, etc. */
    fetchList(
        params: {
            limit: number
            offset: number
            locale: string
            objectCollectionId?: string
            sectionId?: string
            workspaceId?: string | null
        } & RuntimeListQueryParams
    ): Promise<AppDataResponse>

    /** Fetch a single row (raw data, for edit forms). */
    fetchRow(rowId: string, objectCollectionId?: string): Promise<Record<string, unknown>>

    /** Fetch TABLE child rows for a source row (used to prefill copy form). */
    fetchTabularRows?(params: {
        parentRowId: string
        componentId: string
        objectCollectionId?: string
        sectionId?: string
    }): Promise<Array<Record<string, unknown>>>

    /** Create a new row. Returns the created row. */
    createRow(data: Record<string, unknown>, objectCollectionId?: string): Promise<Record<string, unknown>>

    /** Update an existing row. Returns the updated row. */
    updateRow(
        rowId: string,
        data: Record<string, unknown>,
        objectCollectionId?: string,
        expectedVersion?: number
    ): Promise<Record<string, unknown>>

    /** Soft-delete a row. */
    deleteRow(rowId: string, objectCollectionId?: string, expectedVersion?: number): Promise<void>

    /** Restore a soft-deleted row. */
    restoreRow?(rowId: string, objectCollectionId?: string, expectedVersion?: number, restoreTarget?: RuntimeRestoreTarget): Promise<void>

    /** Copy a row. */
    copyRow(
        rowId: string,
        data?: {
            copyChildTables?: boolean
            objectCollectionId?: string
            sectionId?: string
            data?: Record<string, unknown>
            expectedVersion?: number
        }
    ): Promise<Record<string, unknown>>

    /** Execute a generic runtime record lifecycle command. */
    recordCommand?(
        rowId: string,
        command: RuntimeRecordCommand,
        data?: { objectCollectionId?: string; sectionId?: string; expectedVersion?: number }
    ): Promise<Record<string, unknown>>

    /** Execute a metadata-defined workflow transition on a runtime row. */
    workflowAction?(
        rowId: string,
        actionCodename: string,
        data: { objectCollectionId?: string; sectionId?: string; expectedVersion: number }
    ): Promise<Record<string, unknown>>

    /** Persist a complete runtime row order for objects that explicitly support reordering. */
    reorderRows?(params: {
        objectCollectionId?: string
        sectionId?: string
        orderedRowIds: string[]
        expectedVersionsByRowId?: Record<string, number>
    }): Promise<void>
}

/**
 * Optional cell-level renderer override per data type.
 * Used by ApplicationRuntime to inject inline BOOLEAN editing.
 */
export type CellRendererOverrides = {
    [dataType: string]: (params: {
        value: unknown
        rowId: string
        field: string
        column: AppDataResponse['columns'][number]
    }) => React.ReactNode
}
