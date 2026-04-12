import type { ComponentManifest } from './entityComponents'
import type { EntityKind } from './metahubs'

export type EntitySidebarSection = 'objects' | 'admin'

const LEGACY_COMPATIBLE_OBJECT_KINDS = ['catalog', 'set', 'enumeration', 'hub', 'document'] as const

export type LegacyCompatibleObjectKind = (typeof LEGACY_COMPATIBLE_OBJECT_KINDS)[number]

export const LEGACY_COMPATIBLE_KIND_KEYS: Readonly<Record<Exclude<LegacyCompatibleObjectKind, 'document'>, string>> = {
    catalog: 'custom.catalog-v2',
    hub: 'custom.hub-v2',
    set: 'custom.set-v2',
    enumeration: 'custom.enumeration-v2'
}

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

export const getLegacyCompatibleObjectKindForKindKey = (kindKey: unknown): LegacyCompatibleObjectKind | null => {
    if (typeof kindKey !== 'string') {
        return null
    }

    const normalizedKindKey = kindKey.trim()
    if (!normalizedKindKey) {
        return null
    }

    const matchedEntry = Object.entries(LEGACY_COMPATIBLE_KIND_KEYS).find(([, value]) => {
        if (value === normalizedKindKey) {
            return true
        }

        return normalizedKindKey.startsWith(`${value}-`)
    })
    return matchedEntry ? (matchedEntry[0] as Exclude<LegacyCompatibleObjectKind, 'document'>) : null
}

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
    isBuiltin: boolean
    components: ComponentManifest
    ui: EntityTypeUIConfig
}

export type EntityTypeSource = 'builtin' | 'custom'

export interface ResolvedEntityType extends EntityTypeDefinition {
    source: EntityTypeSource
}
