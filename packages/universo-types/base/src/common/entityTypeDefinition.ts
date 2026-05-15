import type { EntityTypeCapabilities } from './entityCapabilities'
import { isEnabledCapabilityConfig } from './entityCapabilities'
import type { VersionedLocalizedContent } from './admin'
import type { EntityKind } from './metahubs'

export type EntitySidebarSection = 'objects' | 'admin'
export type BuiltinEntityResourceSurfaceKey = 'components' | 'fixedValues' | 'optionValues'
export type EntityResourceSurfaceCapability = keyof Pick<EntityTypeCapabilities, 'dataSchema' | 'fixedValues' | 'optionValues'>

export const BUILTIN_ENTITY_RESOURCE_SURFACE_KEYS = ['components', 'fixedValues', 'optionValues'] as const
export const ENTITY_RESOURCE_SURFACE_CAPABILITIES = ['dataSchema', 'fixedValues', 'optionValues'] as const
export const ENTITY_RESOURCE_SURFACE_KEY_PATTERN = /^[a-z][a-zA-Z0-9._-]{0,63}$/
export const ENTITY_RESOURCE_SURFACE_ROUTE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/
export const DEFAULT_ENTITY_RESOURCE_SURFACE_BY_CAPABILITY: Record<
    EntityResourceSurfaceCapability,
    Pick<EntityResourceSurfaceDefinition, 'key' | 'capability' | 'routeSegment' | 'fallbackTitle'>
> = {
    dataSchema: {
        key: 'components',
        capability: 'dataSchema',
        routeSegment: 'components',
        fallbackTitle: 'components'
    },
    fixedValues: {
        key: 'fixedValues',
        capability: 'fixedValues',
        routeSegment: 'fixed-values',
        fallbackTitle: 'fixedValues'
    },
    optionValues: {
        key: 'optionValues',
        capability: 'optionValues',
        routeSegment: 'values',
        fallbackTitle: 'optionValues'
    }
}

export interface EntityResourceSurfaceDefinition {
    key: string
    capability: EntityResourceSurfaceCapability
    routeSegment: string
    titleKey?: string
    title?: VersionedLocalizedContent<string>
    fallbackTitle?: string
}

export const ENTITY_TYPE_TREE_ASSIGNMENT_LABEL_KEYS = [
    'title',
    'addButton',
    'dialogTitle',
    'emptyMessage',
    'requiredWarningMessage',
    'noAvailableMessage',
    'requiredLabel',
    'requiredEnabledHelp',
    'requiredDisabledHelp',
    'singleLabel',
    'singleEnabledHelp',
    'singleDisabledHelp',
    'singleWarning',
    'currentContainerShort'
] as const

export type EntityTypeTreeAssignmentLabelKey = (typeof ENTITY_TYPE_TREE_ASSIGNMENT_LABEL_KEYS)[number]

export type EntityTypeTreeAssignmentLabels = Partial<Record<EntityTypeTreeAssignmentLabelKey, VersionedLocalizedContent<string>>>

export const getDefaultEntityResourceSurfaceDefinition = (
    capability: EntityResourceSurfaceCapability
): EntityResourceSurfaceDefinition => ({
    ...DEFAULT_ENTITY_RESOURCE_SURFACE_BY_CAPABILITY[capability]
})

export interface EntityTypeUIConfig {
    iconName: string
    tabs: readonly string[]
    sidebarSection: EntitySidebarSection
    sidebarOrder?: number
    nameKey: string
    descriptionKey?: string
    resourceSurfaces?: readonly EntityResourceSurfaceDefinition[]
    treeAssignmentLabels?: EntityTypeTreeAssignmentLabels
}

export interface EntityTypeDefinition {
    kindKey: EntityKind
    capabilities: EntityTypeCapabilities
    ui: EntityTypeUIConfig
    presentation?: Record<string, unknown>
    config?: Record<string, unknown>
}

export interface ResolvedEntityType extends EntityTypeDefinition {}

export const isEntityResourceSurfaceCapability = (value: unknown): value is EntityResourceSurfaceCapability =>
    typeof value === 'string' && (ENTITY_RESOURCE_SURFACE_CAPABILITIES as readonly string[]).includes(value)

export interface NormalizeEntityResourceSurfaceOptions {
    requireFallbackTitle?: boolean
}

const normalizeOptionalString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const normalizeLocalizedTitle = (value: unknown): VersionedLocalizedContent<string> | undefined => {
    if (!isRecord(value) || !isRecord(value.locales)) {
        return undefined
    }

    const primary = normalizeOptionalString(value._primary)
    if (!primary) {
        throw new Error('Entity resource surface localized title must contain a primary locale')
    }

    const locales = value.locales
    if (!isRecord(locales) || Object.keys(locales).length === 0) {
        throw new Error('Entity resource surface localized title must contain at least one locale')
    }

    if (!isRecord(locales[primary])) {
        throw new Error('Entity resource surface localized title must contain the primary locale entry')
    }

    for (const [locale, entry] of Object.entries(locales)) {
        if (!normalizeOptionalString(locale) || !isRecord(entry) || typeof entry.content !== 'string') {
            throw new Error('Entity resource surface localized title locales must contain string content')
        }
    }

    return value as unknown as VersionedLocalizedContent<string>
}

const normalizeLocalizedTreeAssignmentLabel = (value: unknown, key: string): VersionedLocalizedContent<string> | undefined => {
    if (!isRecord(value) || !isRecord(value.locales)) {
        return undefined
    }

    const primary = normalizeOptionalString(value._primary)
    if (!primary) {
        throw new Error(`Entity tree assignment label ${key} must contain a primary locale`)
    }

    const locales = value.locales
    if (!isRecord(locales) || Object.keys(locales).length === 0) {
        throw new Error(`Entity tree assignment label ${key} must contain at least one locale`)
    }

    if (!isRecord(locales[primary])) {
        throw new Error(`Entity tree assignment label ${key} must contain the primary locale entry`)
    }

    for (const [locale, entry] of Object.entries(locales)) {
        if (!normalizeOptionalString(locale) || !isRecord(entry) || typeof entry.content !== 'string') {
            throw new Error(`Entity tree assignment label ${key} locales must contain string content`)
        }
    }

    return value as unknown as VersionedLocalizedContent<string>
}

export const normalizeEntityTypeTreeAssignmentLabels = (value: unknown): EntityTypeTreeAssignmentLabels | undefined => {
    if (!isRecord(value)) {
        return undefined
    }

    const labels: EntityTypeTreeAssignmentLabels = {}
    for (const key of ENTITY_TYPE_TREE_ASSIGNMENT_LABEL_KEYS) {
        const label = normalizeLocalizedTreeAssignmentLabel(value[key], key)
        if (label) {
            labels[key] = label
        }
    }

    return Object.keys(labels).length > 0 ? labels : undefined
}

export const normalizeEntityResourceSurfaceDefinition = (
    value: unknown,
    options: NormalizeEntityResourceSurfaceOptions = {}
): EntityResourceSurfaceDefinition => {
    if (!isRecord(value)) {
        throw new Error('Entity resource surface must be an object')
    }

    const key = normalizeOptionalString(value.key) ?? ''
    const capability = normalizeOptionalString(value.capability) ?? ''
    const routeSegment = normalizeOptionalString(value.routeSegment) ?? ''
    const fallbackTitle = normalizeOptionalString(value.fallbackTitle)
    const titleKey = normalizeOptionalString(value.titleKey)
    const title = normalizeLocalizedTitle(value.title)

    if (!ENTITY_RESOURCE_SURFACE_KEY_PATTERN.test(key)) {
        throw new Error(
            `Entity resource surface key must start with a letter and use only letters, digits, dots, underscores, or hyphens: ${
                key || 'empty'
            }`
        )
    }

    if (!isEntityResourceSurfaceCapability(capability)) {
        throw new Error(`Unsupported entity resource surface capability: ${capability || 'empty'}`)
    }

    if (!ENTITY_RESOURCE_SURFACE_ROUTE_PATTERN.test(routeSegment)) {
        throw new Error(`Entity resource surface ${key} must use a lowercase kebab-case routeSegment`)
    }

    if (options.requireFallbackTitle === true && !fallbackTitle) {
        throw new Error(`Entity resource surface ${key} must contain a fallbackTitle`)
    }

    return {
        key,
        capability,
        routeSegment,
        ...(title ? { title } : {}),
        ...(titleKey ? { titleKey } : {}),
        ...(fallbackTitle ? { fallbackTitle } : {})
    }
}

export const normalizeEntityResourceSurfaceDefinitions = (
    value: unknown,
    options: NormalizeEntityResourceSurfaceOptions = {}
): EntityResourceSurfaceDefinition[] | undefined => {
    if (!Array.isArray(value)) {
        return undefined
    }

    const surfaces = value.map((surface) => normalizeEntityResourceSurfaceDefinition(surface, options))
    const uniqueKeys = new Set<string>()
    const uniqueCapabilities = new Set<string>()
    const uniqueRouteSegments = new Set<string>()

    for (const surface of surfaces) {
        if (uniqueKeys.has(surface.key)) {
            throw new Error(`Entity type UI config resourceSurfaces must not contain duplicate key ${surface.key}`)
        }
        uniqueKeys.add(surface.key)

        if (uniqueCapabilities.has(surface.capability)) {
            throw new Error(`Entity type UI config resourceSurfaces must not contain duplicate capability ${surface.capability}`)
        }
        uniqueCapabilities.add(surface.capability)

        if (uniqueRouteSegments.has(surface.routeSegment)) {
            throw new Error(`Entity type UI config resourceSurfaces must not contain duplicate routeSegment ${surface.routeSegment}`)
        }
        uniqueRouteSegments.add(surface.routeSegment)
    }

    return surfaces
}

export const validateEntityResourceSurfacesAgainstCapabilities = (
    surfaces: readonly EntityResourceSurfaceDefinition[] | undefined,
    capabilities: EntityTypeCapabilities
): void => {
    for (const surface of surfaces ?? []) {
        if (!isEnabledCapabilityConfig(capabilities[surface.capability])) {
            throw new Error(`Entity resource surface ${surface.key} requires enabled component ${surface.capability}`)
        }
    }
}

export interface ResolveEntityResourceSurfaceTitleOptions {
    locale?: string
    translate?: (key: string, fallback?: string) => string
}

const normalizeLocale = (locale?: string): string => (locale ? locale.split(/[-_]/)[0].toLowerCase() : 'en')

const resolveLocalizedTitle = (title: VersionedLocalizedContent<string> | undefined, locale: string): string => {
    if (!title?.locales) {
        return ''
    }

    const normalizedLocale = normalizeLocale(locale)
    const preferred = title.locales[normalizedLocale]?.content
    if (typeof preferred === 'string' && preferred.trim().length > 0) {
        return preferred.trim()
    }

    const primary = title.locales[title._primary]?.content
    if (typeof primary === 'string' && primary.trim().length > 0) {
        return primary.trim()
    }

    for (const entry of Object.values(title.locales)) {
        if (typeof entry?.content === 'string' && entry.content.trim().length > 0) {
            return entry.content.trim()
        }
    }

    return ''
}

export const resolveEntityResourceSurfaceTitle = (
    surface: EntityResourceSurfaceDefinition,
    options: ResolveEntityResourceSurfaceTitleOptions = {}
): string => {
    const localized = resolveLocalizedTitle(surface.title, options.locale ?? 'en')
    if (localized) {
        return localized
    }

    if (surface.titleKey && options.translate) {
        const translated = options.translate(surface.titleKey, surface.fallbackTitle)
        if (translated.trim().length > 0) {
            return translated
        }
    }

    return surface.fallbackTitle?.trim() || surface.key
}
