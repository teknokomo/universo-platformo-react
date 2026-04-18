import type { ComponentManifest } from './entityComponents'
import type { EntityKind } from './metahubs'

export type EntitySidebarSection = 'objects' | 'admin'
export type BuiltinEntityResourceSurfaceKey = 'fieldDefinitions' | 'fixedValues' | 'optionValues'
export type EntityResourceSurfaceCapability = keyof Pick<ComponentManifest, 'dataSchema' | 'fixedValues' | 'optionValues'>

export const BUILTIN_ENTITY_RESOURCE_SURFACE_KEYS = ['fieldDefinitions', 'fixedValues', 'optionValues'] as const

export interface EntityResourceSurfaceDefinition {
    key: string
    capability: EntityResourceSurfaceCapability
    routeSegment: string
    titleKey?: string
    fallbackTitle: string
}

export interface EntityTypeUIConfig {
    iconName: string
    tabs: readonly string[]
    sidebarSection: EntitySidebarSection
    sidebarOrder?: number
    nameKey: string
    descriptionKey?: string
    resourceSurfaces?: readonly EntityResourceSurfaceDefinition[]
}

export interface EntityTypeDefinition {
    kindKey: EntityKind
    components: ComponentManifest
    ui: EntityTypeUIConfig
    presentation?: Record<string, unknown>
    config?: Record<string, unknown>
}

export interface ResolvedEntityType extends EntityTypeDefinition {}
