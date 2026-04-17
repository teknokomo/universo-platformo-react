import type { ComponentManifest } from './entityComponents'
import type { EntityKind } from './metahubs'

export type EntitySidebarSection = 'objects' | 'admin'

export interface EntityTypeUIConfig {
    iconName: string
    tabs: readonly string[]
    sidebarSection: EntitySidebarSection
    sidebarOrder?: number
    nameKey: string
    descriptionKey?: string
}

export interface EntityTypeDefinition {
    kindKey: EntityKind
    components: ComponentManifest
    ui: EntityTypeUIConfig
    presentation?: Record<string, unknown>
    config?: Record<string, unknown>
}

export interface ResolvedEntityType extends EntityTypeDefinition {}
