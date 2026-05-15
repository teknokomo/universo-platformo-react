import { z } from 'zod'

import { DASHBOARD_VIEW_MODES, type DashboardViewMode } from './dashboardLayout'

export const DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY = 'objectBehavior'

export const OBJECT_COLLECTION_RUNTIME_SEARCH_MODES = ['server', 'page-local'] as const
export type ObjectCollectionRuntimeSearchMode = (typeof OBJECT_COLLECTION_RUNTIME_SEARCH_MODES)[number]

export const OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES = ['dialog', 'page'] as const
export type ObjectCollectionRuntimeEditSurface = (typeof OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES)[number]

export const OBJECT_COLLECTION_RUNTIME_ROW_HEIGHTS = ['compact', 'normal', 'auto'] as const
export type ObjectCollectionRuntimeRowHeight = (typeof OBJECT_COLLECTION_RUNTIME_ROW_HEIGHTS)[number]

const objectCollectionRuntimeViewConfigObjectSchema = z.object({
    useLayoutOverrides: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    searchMode: z.enum(OBJECT_COLLECTION_RUNTIME_SEARCH_MODES).optional(),
    showCreateButton: z.boolean().optional(),
    showViewToggle: z.boolean().optional(),
    defaultViewMode: z.enum(DASHBOARD_VIEW_MODES).optional(),
    cardColumns: z.number().int().min(2).max(4).optional(),
    rowHeight: z.enum(OBJECT_COLLECTION_RUNTIME_ROW_HEIGHTS).optional(),
    enableRowReordering: z.boolean().optional(),
    reorderPersistenceField: z.string().trim().min(1).nullable().optional(),
    createSurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
    editSurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
    copySurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional()
})

export const objectCollectionLayoutBehaviorConfigSchema = objectCollectionRuntimeViewConfigObjectSchema.optional()

export const objectCollectionRuntimeViewConfigSchema = objectCollectionRuntimeViewConfigObjectSchema.optional()

export type ObjectCollectionRuntimeViewConfig = z.infer<typeof objectCollectionRuntimeViewConfigObjectSchema>
export type ObjectCollectionLayoutBehaviorConfig = ObjectCollectionRuntimeViewConfig

export interface ResolvedObjectCollectionRuntimeViewConfig {
    useLayoutOverrides: boolean
    showSearch: boolean
    searchMode: ObjectCollectionRuntimeSearchMode
    showCreateButton: boolean
    showViewToggle: boolean
    defaultViewMode: DashboardViewMode
    cardColumns: number
    rowHeight: ObjectCollectionRuntimeRowHeight
    enableRowReordering: boolean
    reorderPersistenceField: string | null
    createSurface: ObjectCollectionRuntimeEditSurface
    editSurface: ObjectCollectionRuntimeEditSurface
    copySurface: ObjectCollectionRuntimeEditSurface
}

export type ResolvedObjectCollectionLayoutBehaviorConfig = ResolvedObjectCollectionRuntimeViewConfig

export const defaultObjectCollectionRuntimeViewConfig: ResolvedObjectCollectionRuntimeViewConfig = {
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

export const defaultObjectCollectionLayoutBehaviorConfig: ResolvedObjectCollectionLayoutBehaviorConfig =
    defaultObjectCollectionRuntimeViewConfig
