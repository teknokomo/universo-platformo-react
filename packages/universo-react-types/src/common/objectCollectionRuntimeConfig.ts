import { z } from 'zod'

export const DASHBOARD_LAYOUT_BEHAVIOR_CONFIG_KEY = 'objectBehavior'

export const OBJECT_RUNTIME_MENU_ICON_KEYS = [
    'home',
    'analytics',
    'users',
    'tasks',
    'database',
    'folder',
    'apps',
    'dashboard',
    'page',
    'school',
    'recent',
    'star',
    'settings',
    'more'
] as const

export type ObjectRuntimeMenuIcon = (typeof OBJECT_RUNTIME_MENU_ICON_KEYS)[number]
export const DEFAULT_OBJECT_RUNTIME_MENU_ICON: ObjectRuntimeMenuIcon = 'apps'

export const isObjectRuntimeMenuIcon = (value: unknown): value is ObjectRuntimeMenuIcon =>
    typeof value === 'string' && (OBJECT_RUNTIME_MENU_ICON_KEYS as readonly string[]).includes(value)

export const OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES = ['dialog', 'page'] as const
export type ObjectCollectionRuntimeEditSurface = (typeof OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES)[number]

const objectCollectionRuntimeViewConfigObjectSchema = z
    .object({
        showCreateButton: z.boolean().optional(),
        createSurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
        editSurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional(),
        copySurface: z.enum(OBJECT_COLLECTION_RUNTIME_EDIT_SURFACES).optional()
    })
    .strict()

export const objectCollectionLayoutBehaviorConfigSchema = objectCollectionRuntimeViewConfigObjectSchema.optional()

export const objectCollectionRuntimeViewConfigSchema = objectCollectionRuntimeViewConfigObjectSchema.optional()

export type ObjectCollectionRuntimeViewConfig = z.infer<typeof objectCollectionRuntimeViewConfigObjectSchema>
export type ObjectCollectionLayoutBehaviorConfig = ObjectCollectionRuntimeViewConfig

export interface ResolvedObjectCollectionRuntimeViewConfig {
    showCreateButton: boolean
    createSurface: ObjectCollectionRuntimeEditSurface
    editSurface: ObjectCollectionRuntimeEditSurface
    copySurface: ObjectCollectionRuntimeEditSurface
}

export type ResolvedObjectCollectionLayoutBehaviorConfig = ResolvedObjectCollectionRuntimeViewConfig

export const defaultObjectCollectionRuntimeViewConfig: ResolvedObjectCollectionRuntimeViewConfig = {
    showCreateButton: true,
    createSurface: 'dialog',
    editSurface: 'dialog',
    copySurface: 'dialog'
}

export const defaultObjectCollectionLayoutBehaviorConfig: ResolvedObjectCollectionLayoutBehaviorConfig =
    defaultObjectCollectionRuntimeViewConfig
