import type { AppDataResponse } from './api'

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
    fetchList(params: { limit: number; offset: number; locale: string; catalogId?: string }): Promise<AppDataResponse>

    /** Fetch a single row (raw data, for edit forms). */
    fetchRow(rowId: string, catalogId?: string): Promise<Record<string, unknown>>

    /** Create a new row. Returns the created row. */
    createRow(data: Record<string, unknown>, catalogId?: string): Promise<Record<string, unknown>>

    /** Update an existing row. Returns the updated row. */
    updateRow(rowId: string, data: Record<string, unknown>, catalogId?: string): Promise<Record<string, unknown>>

    /** Soft-delete a row. */
    deleteRow(rowId: string, catalogId?: string): Promise<void>
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
