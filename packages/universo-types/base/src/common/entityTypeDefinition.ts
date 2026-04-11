import type { ComponentManifest } from './entityComponents'
import type { EntityKind } from './metahubs'

export type EntitySidebarSection = 'objects' | 'admin'

const LEGACY_COMPATIBLE_OBJECT_KINDS = ['catalog', 'set', 'enumeration', 'hub', 'document'] as const

export type LegacyCompatibleObjectKind = (typeof LEGACY_COMPATIBLE_OBJECT_KINDS)[number]

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const getLegacyCompatibleObjectKind = (config: unknown): LegacyCompatibleObjectKind | null => {
    if (!isRecord(config)) {
        return null
    }

    const compatibility = isRecord(config.compatibility) ? config.compatibility : config
    const legacyObjectKind = compatibility.legacyObjectKind

    return LEGACY_COMPATIBLE_OBJECT_KINDS.includes(legacyObjectKind as LegacyCompatibleObjectKind)
        ? (legacyObjectKind as LegacyCompatibleObjectKind)
        : null
}

export const isLegacyCompatibleObjectKind = (config: unknown, kind: string): boolean => getLegacyCompatibleObjectKind(config) === kind

export interface EntityTypeUIConfig {
    iconName: string
    tabs: readonly string[]
    sidebarSection: EntitySidebarSection
    nameKey: string
    descriptionKey?: string
}

export interface EntityTypeDefinition {
    kindKey: EntityKind
    isBuiltin: boolean
    components: ComponentManifest
    ui: EntityTypeUIConfig
}

export type EntityTypeSource = 'builtin' | 'custom'

export interface ResolvedEntityType extends EntityTypeDefinition {
    source: EntityTypeSource
}
