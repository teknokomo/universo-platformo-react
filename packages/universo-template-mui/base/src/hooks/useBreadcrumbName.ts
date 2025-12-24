import { useQuery } from '@tanstack/react-query'
import i18n from '@universo/i18n'

type VlcLike = {
    _primary?: string
    locales?: Record<string, { content?: unknown }>
}

type SimpleLocalizedInputLike = {
    en?: unknown
    ru?: unknown
    [key: string]: unknown
}

function extractLocalizedString(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object') return ''

    const language = (i18n?.language || 'en').toLowerCase()
    const obj = value as Record<string, unknown>

    // VLC-like: { _primary, locales: { en: { content }, ... } }
    const vlc = obj as VlcLike
    if (vlc.locales && typeof vlc.locales === 'object') {
        const primary = typeof vlc._primary === 'string' ? vlc._primary : undefined
        const entry = (vlc.locales[language] ?? (primary ? vlc.locales[primary] : undefined)) as any
        const content = entry?.content
        return typeof content === 'string' ? content : ''
    }

    // SimpleLocalizedInput-like: { en?: string, ru?: string, ... }
    const simple = obj as SimpleLocalizedInputLike
    const localized = simple[language]
    if (typeof localized === 'string') return localized
    if (typeof simple.en === 'string') return simple.en
    if (typeof simple.ru === 'string') return simple.ru

    return ''
}

/**
 * Fetch function type for entity name retrieval
 */
export type EntityNameFetcher = (entityId: string) => Promise<string>

/**
 * Configuration for entity name hook
 */
export interface EntityNameHookConfig {
    /** Entity type for queryKey (e.g., 'metaverse', 'cluster') */
    entityType: string
    /** API endpoint path (e.g., 'metaverses', 'clusters') - used with default fetcher */
    apiPath?: string
    /** Field to extract from response (default: 'name') - used with default fetcher */
    nameField?: string
    /** Custom fetcher function - allows integration with any API client */
    fetcher?: EntityNameFetcher
}

/**
 * Default fetch function using native fetch API.
 * Used when no custom fetcher is provided.
 */
function createDefaultFetcher(apiPath: string, nameField: string): EntityNameFetcher {
    return async (entityId: string): Promise<string> => {
        const response = await fetch(`/api/v1/${apiPath}/${entityId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        return extractLocalizedString((data as any)?.[nameField])
    }
}

/**
 * Generic factory to create entity name hooks for breadcrumb display.
 * Uses React Query for automatic caching, deduplication, and TTL management.
 *
 * This eliminates code duplication across 7+ entity name hooks while maintaining
 * consistent behavior: 5-min cache, error handling, null safety.
 *
 * @param config - Hook configuration
 * @returns A hook function that fetches entity name by ID
 *
 * @example Basic usage with default fetcher
 * ```typescript
 * export const useMetaverseName = createEntityNameHook({
 *     entityType: 'metaverse',
 *     apiPath: 'metaverses'
 * })
 * ```
 *
 * @example Custom fetcher with API client (avoids cyclic dependencies)
 * ```typescript
 * import { getMetaverse } from '@universo/metaverses-frontend/api'
 *
 * export const useMetaverseName = createEntityNameHook({
 *     entityType: 'metaverse',
 *     fetcher: async (id) => {
 *         const response = await getMetaverse(id)
 *         return response.data.name
 *     }
 * })
 * ```
 */
export function createEntityNameHook(config: EntityNameHookConfig) {
    const { entityType, apiPath, nameField = 'name', fetcher } = config

    // Use custom fetcher or create default one
    const fetchEntityName = fetcher ?? createDefaultFetcher(apiPath ?? entityType + 's', nameField)

    return function useEntityName(entityId: string | null): string | null {
        const query = useQuery({
            queryKey: ['breadcrumb', entityType, entityId],
            queryFn: () => fetchEntityName(entityId!),
            enabled: Boolean(entityId),
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
            retry: 2, // Retry failed requests twice
            refetchOnWindowFocus: false // Don't refetch on tab focus
        })

        return query.isLoading ? null : query.data ?? null
    }
}

/**
 * Generic factory to create truncate functions for entity names.
 * Ensures consistent truncation behavior across all entities.
 *
 * @param defaultMaxLength - Default max length before truncation (default: 30)
 * @returns A truncate function
 */
export function createTruncateFunction(defaultMaxLength = 30) {
    return function truncateName(name: string, maxLength: number = defaultMaxLength): string {
        const safeName = typeof name === 'string' ? name : String(name ?? '')
        if (safeName.length <= maxLength) return safeName
        return safeName.slice(0, maxLength - 1) + '…'
    }
}

// ============================================================
// Pre-configured hooks for all entity types
// ============================================================

/**
 * Hook to fetch and cache metaverse name by ID for breadcrumb display.
 */
export const useMetaverseName = createEntityNameHook({
    entityType: 'metaverse',
    apiPath: 'metaverses'
})

/**
 * Hook to fetch and cache metahub name by ID for breadcrumb display.
 */
export const useMetahubName = createEntityNameHook({
    entityType: 'metahub',
    apiPath: 'metahubs'
})

/**
 * Hook to fetch and cache organization name by ID for breadcrumb display.
 */
export const useOrganizationName = createEntityNameHook({
    entityType: 'organization',
    apiPath: 'organizations'
})

/**
 * Hook to fetch and cache cluster name by ID for breadcrumb display.
 */
export const useClusterName = createEntityNameHook({
    entityType: 'cluster',
    apiPath: 'clusters'
})

/**
 * Hook to fetch and cache project name by ID for breadcrumb display.
 */
export const useProjectName = createEntityNameHook({
    entityType: 'project',
    apiPath: 'projects'
})

/**
 * Hook to fetch and cache campaign name by ID for breadcrumb display.
 */
export const useCampaignName = createEntityNameHook({
    entityType: 'campaign',
    apiPath: 'campaigns'
})

/**
 * Hook to fetch and cache unik name by ID for breadcrumb display.
 */
export const useUnikName = createEntityNameHook({
    entityType: 'unik',
    apiPath: 'uniks'
})

/**
 * Hook to fetch and cache storage name by ID for breadcrumb display.
 */
export const useStorageName = createEntityNameHook({
    entityType: 'storage',
    apiPath: 'storages'
})

/**
 * Hook to fetch Hub name for breadcrumb display.
 * Requires both metahubId and hubId since Hub API is nested under Metahub.
 */
export function useHubName(metahubId: string | null, hubId: string | null): string | null {
    const query = useQuery({
        queryKey: ['breadcrumb', 'hub', metahubId, hubId],
        queryFn: async () => {
            if (!metahubId || !hubId) return null
            const response = await fetch(`/api/v1/metahubs/${metahubId}/hubs/${hubId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const entity = await response.json()
            return extractLocalizedString(entity?.name) ?? entity?.codename ?? null
        },
        enabled: Boolean(metahubId && hubId),
        staleTime: 5 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch Attribute name for breadcrumb display.
 * Requires metahubId, hubId, and attributeId since Attribute API is deeply nested.
 */
export function useAttributeName(metahubId: string | null, hubId: string | null, attributeId: string | null): string | null {
    const query = useQuery({
        queryKey: ['breadcrumb', 'attribute', metahubId, hubId, attributeId],
        queryFn: async () => {
            if (!metahubId || !hubId || !attributeId) return null
            const response = await fetch(`/api/v1/metahubs/${metahubId}/hubs/${hubId}/attributes/${attributeId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            })
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
            const entity = await response.json()
            return extractLocalizedString(entity?.name) ?? entity?.codename ?? null
        },
        enabled: Boolean(metahubId && hubId && attributeId),
        staleTime: 5 * 60 * 1000,
        retry: 2,
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

// ============================================================
// Pre-configured truncate functions
// ============================================================

/** Truncate metaverse name with ellipsis (default: 30 chars) */
export const truncateMetaverseName = createTruncateFunction(30)

/** Truncate metahub name with ellipsis (default: 30 chars) */
export const truncateMetahubName = createTruncateFunction(30)

/** Truncate organization name with ellipsis (default: 30 chars) */
export const truncateOrganizationName = createTruncateFunction(30)

/** Truncate cluster name with ellipsis (default: 30 chars) */
export const truncateClusterName = createTruncateFunction(30)

/** Truncate project name with ellipsis (default: 30 chars) */
export const truncateProjectName = createTruncateFunction(30)

/** Truncate campaign name with ellipsis (default: 30 chars) */
export const truncateCampaignName = createTruncateFunction(30)

/** Truncate unik name with ellipsis (default: 30 chars) */
export const truncateUnikName = createTruncateFunction(30)

/** Truncate storage name with ellipsis (default: 30 chars) */
export const truncateStorageName = createTruncateFunction(30)

/** Truncate hub name with ellipsis (default: 30 chars) */
export const truncateHubName = createTruncateFunction(30)

/** Truncate attribute name with ellipsis (default: 30 chars) */
export const truncateAttributeName = createTruncateFunction(30)
