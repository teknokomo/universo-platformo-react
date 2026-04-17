import { z } from 'zod'

import { DASHBOARD_VIEW_MODES, type DashboardViewMode } from './dashboardLayout'

export const DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY = 'catalogBehavior'

export const LINKED_COLLECTION_RUNTIME_SEARCH_MODES = ['server', 'page-local'] as const
export type LinkedCollectionRuntimeSearchMode = (typeof LINKED_COLLECTION_RUNTIME_SEARCH_MODES)[number]

export const LINKED_COLLECTION_RUNTIME_EDIT_SURFACES = ['dialog', 'page'] as const
export type LinkedCollectionRuntimeEditSurface = (typeof LINKED_COLLECTION_RUNTIME_EDIT_SURFACES)[number]

export const LINKED_COLLECTION_RUNTIME_ROW_HEIGHTS = ['compact', 'normal', 'auto'] as const
export type LinkedCollectionRuntimeRowHeight = (typeof LINKED_COLLECTION_RUNTIME_ROW_HEIGHTS)[number]

const linkedCollectionRuntimeViewConfigObjectSchema = z.object({
    useLayoutOverrides: z.boolean().optional(),
    showSearch: z.boolean().optional(),
    searchMode: z.enum(LINKED_COLLECTION_RUNTIME_SEARCH_MODES).optional(),
    showCreateButton: z.boolean().optional(),
    showViewToggle: z.boolean().optional(),
    defaultViewMode: z.enum(DASHBOARD_VIEW_MODES).optional(),
    cardColumns: z.number().int().min(2).max(4).optional(),
    rowHeight: z.enum(LINKED_COLLECTION_RUNTIME_ROW_HEIGHTS).optional(),
    enableRowReordering: z.boolean().optional(),
    reorderPersistenceField: z.string().trim().min(1).nullable().optional(),
    createSurface: z.enum(LINKED_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
    editSurface: z.enum(LINKED_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
    copySurface: z.enum(LINKED_COLLECTION_RUNTIME_EDIT_SURFACES).optional()
})

export const linkedCollectionLayoutBehaviorConfigSchema = linkedCollectionRuntimeViewConfigObjectSchema.optional()

export const linkedCollectionRuntimeViewConfigSchema = linkedCollectionRuntimeViewConfigObjectSchema.optional()

export type LinkedCollectionRuntimeViewConfig = z.infer<typeof linkedCollectionRuntimeViewConfigObjectSchema>
export type LinkedCollectionLayoutBehaviorConfig = LinkedCollectionRuntimeViewConfig

export interface ResolvedLinkedCollectionRuntimeViewConfig {
    useLayoutOverrides: boolean
    showSearch: boolean
    searchMode: LinkedCollectionRuntimeSearchMode
    showCreateButton: boolean
    showViewToggle: boolean
    defaultViewMode: DashboardViewMode
    cardColumns: number
    rowHeight: LinkedCollectionRuntimeRowHeight
    enableRowReordering: boolean
    reorderPersistenceField: string | null
    createSurface: LinkedCollectionRuntimeEditSurface
    editSurface: LinkedCollectionRuntimeEditSurface
    copySurface: LinkedCollectionRuntimeEditSurface
}

export type ResolvedLinkedCollectionLayoutBehaviorConfig = ResolvedLinkedCollectionRuntimeViewConfig

export const defaultLinkedCollectionRuntimeViewConfig: ResolvedLinkedCollectionRuntimeViewConfig = {
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

export const defaultLinkedCollectionLayoutBehaviorConfig: ResolvedLinkedCollectionLayoutBehaviorConfig =
    defaultLinkedCollectionRuntimeViewConfig
