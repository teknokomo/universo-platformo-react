import { z } from 'zod'

import { DASHBOARD_VIEW_MODES, type DashboardViewMode } from './dashboardLayout'

export const CATALOG_RUNTIME_SEARCH_MODES = ['server', 'page-local'] as const
export type CatalogRuntimeSearchMode = (typeof CATALOG_RUNTIME_SEARCH_MODES)[number]

export const CATALOG_RUNTIME_EDIT_SURFACES = ['dialog', 'page'] as const
export type CatalogRuntimeEditSurface = (typeof CATALOG_RUNTIME_EDIT_SURFACES)[number]

export const CATALOG_RUNTIME_ROW_HEIGHTS = ['compact', 'normal', 'auto'] as const
export type CatalogRuntimeRowHeight = (typeof CATALOG_RUNTIME_ROW_HEIGHTS)[number]

const catalogRuntimeViewConfigObjectSchema = z.object({
    useLayoutOverrides: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    searchMode: z.enum(CATALOG_RUNTIME_SEARCH_MODES).optional(),
    showCreateButton: z.boolean().optional(),
    showViewToggle: z.boolean().optional(),
    defaultViewMode: z.enum(DASHBOARD_VIEW_MODES).optional(),
    cardColumns: z.number().int().min(2).max(4).optional(),
    rowHeight: z.enum(CATALOG_RUNTIME_ROW_HEIGHTS).optional(),
    enableRowReordering: z.boolean().optional(),
    reorderPersistenceField: z.string().trim().min(1).nullable().optional(),
    createSurface: z.enum(CATALOG_RUNTIME_EDIT_SURFACES).optional(),
    editSurface: z.enum(CATALOG_RUNTIME_EDIT_SURFACES).optional(),
    copySurface: z.enum(CATALOG_RUNTIME_EDIT_SURFACES).optional()
})

export const catalogRuntimeViewConfigSchema = catalogRuntimeViewConfigObjectSchema.optional()

export type CatalogRuntimeViewConfig = z.infer<typeof catalogRuntimeViewConfigObjectSchema>

export interface ResolvedCatalogRuntimeViewConfig {
    useLayoutOverrides: boolean
    showSearch: boolean
    searchMode: CatalogRuntimeSearchMode
    showCreateButton: boolean
    showViewToggle: boolean
    defaultViewMode: DashboardViewMode
    cardColumns: number
    rowHeight: CatalogRuntimeRowHeight
    enableRowReordering: boolean
    reorderPersistenceField: string | null
    createSurface: CatalogRuntimeEditSurface
    editSurface: CatalogRuntimeEditSurface
    copySurface: CatalogRuntimeEditSurface
}

export const defaultCatalogRuntimeViewConfig: ResolvedCatalogRuntimeViewConfig = {
    useLayoutOverrides: false,
    showSearch: false,
    searchMode: 'page-local',
    showCreateButton: true,
    showViewToggle: false,
    defaultViewMode: 'table',
    cardColumns: 3,
    rowHeight: 'compact',
    enableRowReordering: false,
    reorderPersistenceField: null,
    createSurface: 'dialog',
    editSurface: 'dialog',
    copySurface: 'dialog'
}