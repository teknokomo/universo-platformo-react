import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth, type AuthClient } from '@universo/auth-frontend'
import i18n from '@universo/i18n'
import { getVLCString } from '@universo/utils'

type QueryErrorWithStatus = Error & {
    status?: number
    response?: { status?: number }
}

const NON_RETRYABLE_HTTP_STATUSES = [400, 403, 404, 409, 422, 429] as const

function extractHttpStatus(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined
    const value = error as QueryErrorWithStatus
    return typeof value.status === 'number' ? value.status : value.response?.status
}

function shouldRetryBreadcrumbQuery(failureCount: number, error: unknown): boolean {
    const status = extractHttpStatus(error)
    if (typeof status === 'number') {
        return !NON_RETRYABLE_HTTP_STATUSES.includes(status as (typeof NON_RETRYABLE_HTTP_STATUSES)[number]) && failureCount < 2
    }
    return failureCount < 2
}

function extractLocalizedString(value: unknown, language: string): string {
    return getVLCString(value as Parameters<typeof getVLCString>[0], language)
}

function getCurrentLanguageKey(): string {
    return (i18n?.resolvedLanguage || i18n?.language || 'en').split(/[-_]/)[0].toLowerCase()
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
 * Default fetch function using the authenticated axios client.
 * Used when no custom fetcher is provided.
 */
async function loadBreadcrumbEntity(client: AuthClient, path: string): Promise<Record<string, unknown>> {
    try {
        const response = await client.get<Record<string, unknown>>(path)
        return response.data
    } catch (error) {
        const status = extractHttpStatus(error)
        console.warn('[breadcrumbs] Request failed', { path, status, error })
        throw error
    }
}

function createDefaultFetcher(client: AuthClient, apiPath: string, nameField: string): EntityNameFetcher {
    return async (entityId: string): Promise<string> => {
        const language = getCurrentLanguageKey()
        const data = await loadBreadcrumbEntity(client, `/${apiPath}/${entityId}`)
        return extractLocalizedString(data?.[nameField], language)
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

    return function useEntityName(entityId: string | null): string | null {
        const { client, loading: authLoading } = useAuth()
        const language = getCurrentLanguageKey()
        const fetchEntityName = fetcher ?? createDefaultFetcher(client, apiPath ?? entityType + 's', nameField)
        const query = useQuery({
            queryKey: ['breadcrumb', entityType, entityId, language],
            queryFn: () => fetchEntityName(entityId!),
            enabled: Boolean(entityId) && !authLoading,
            staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
            retry: shouldRetryBreadcrumbQuery,
            retryOnMount: true,
            refetchOnMount: 'always',
            refetchOnWindowFocus: false // Don't refetch on tab focus
        })
        const resolvedName = query.isLoading ? null : query.data || null
        useBreadcrumbSuccessDebug({
            entityType,
            entityId,
            authLoading,
            language,
            queryStatus: query.status,
            fetchStatus: query.fetchStatus,
            resolvedName
        })

        return resolvedName
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
 * Resolve a display name from an entity response.
 * Tries name first, then codename as fallback (both may be VLC JSONB objects).
 * Uses || instead of ?? because extractLocalizedString returns '' on failure (not null).
 */
function resolveEntityDisplayName(entity: Record<string, unknown>): string | null {
    const language = getCurrentLanguageKey()
    return extractLocalizedString(entity?.name, language) || extractLocalizedString(entity?.codename, language) || null
}

function useBreadcrumbSuccessDebug(params: {
    entityType: string
    entityId: string | null
    authLoading: boolean
    language: string
    queryStatus: string
    fetchStatus: string
    resolvedName: string | null
}) {
    const { entityType, entityId, authLoading, language, queryStatus, fetchStatus, resolvedName } = params

    useEffect(() => {
        if (!entityId || authLoading) return
        if (queryStatus === 'success' && !resolvedName) {
            console.warn('[breadcrumbs] Empty label after successful query', {
                entityType,
                entityId,
                language,
                queryStatus,
                fetchStatus
            })
        }
    }, [authLoading, entityId, entityType, fetchStatus, language, queryStatus, resolvedName])
}

/**
 * Hook to fetch and cache metahub name by ID for breadcrumb display.
 */
export const useMetahubName = createEntityNameHook({
    entityType: 'metahub',
    apiPath: 'metahub'
})

// Backward-compatible hook (legacy naming and endpoint contract)
export const useMetaverseName = createEntityNameHook({
    entityType: 'metaverse',
    apiPath: 'metaverses'
})

/**
 * Hook to fetch and cache application name by ID for breadcrumb display.
 * Used for standalone Applications module (not metahub applications).
 */
export const useApplicationName = createEntityNameHook({
    entityType: 'application',
    apiPath: 'applications'
})

/**
 * Hook to fetch TreeEntity name for breadcrumb display.
 * Requires both metahubId and treeEntityId since TreeEntity API is nested under Metahub.
 */
export function useTreeEntityName(metahubId: string | null, treeEntityId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'hub', metahubId, treeEntityId, language],
        queryFn: async () => {
            if (!metahubId || !treeEntityId) return null
            const entity = await loadBreadcrumbEntity(client, `/metahub/${metahubId}/entities/hub/instance/${treeEntityId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && treeEntityId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch ObjectCollection name for breadcrumb display.
 * Requires metahubId, treeEntityId, and objectCollectionId since ObjectCollection API is nested under TreeEntity.
 */
export function useObjectCollectionName(
    metahubId: string | null,
    treeEntityId: string | null,
    objectCollectionId: string | null
): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'object', metahubId, treeEntityId, objectCollectionId, language],
        queryFn: async () => {
            if (!metahubId || !treeEntityId || !objectCollectionId) return null
            const entity = await loadBreadcrumbEntity(
                client,
                `/metahub/${metahubId}/entities/object/instance/${treeEntityId}/object/${objectCollectionId}`
            )
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && treeEntityId && objectCollectionId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch ObjectCollection name for breadcrumb display in object-centric navigation.
 * Uses the standalone object endpoint (without hub context).
 */
export function useObjectCollectionNameStandalone(metahubId: string | null, objectCollectionId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'object-standalone', metahubId, objectCollectionId, language],
        queryFn: async () => {
            if (!metahubId || !objectCollectionId) return null
            const entity = await loadBreadcrumbEntity(client, `/metahub/${metahubId}/entities/object/instance/${objectCollectionId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && objectCollectionId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch ValueGroup name for breadcrumb display in set-centric navigation.
 * Uses the standalone set endpoint (without hub context).
 */
export function useValueGroupNameStandalone(metahubId: string | null, valueGroupId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'set-standalone', metahubId, valueGroupId, language],
        queryFn: async () => {
            if (!metahubId || !valueGroupId) return null
            const entity = await loadBreadcrumbEntity(client, `/metahub/${metahubId}/entities/set/instance/${valueGroupId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && valueGroupId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch Enumeration name for breadcrumb display.
 * Requires metahubId and optionListId since Enumeration API is nested under Metahub.
 */
export function useOptionListName(metahubId: string | null, optionListId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'enumeration', metahubId, optionListId, language],
        queryFn: async () => {
            if (!metahubId || !optionListId) return null
            const entity = await loadBreadcrumbEntity(client, `/metahub/${metahubId}/entities/enumeration/instance/${optionListId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && optionListId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch Publication name within Metahub context for breadcrumb display.
 * Requires metahubId and publicationId since Publication API is nested under Metahub.
 */
export function useMetahubPublicationName(metahubId: string | null, publicationId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey:
            metahubId && publicationId
                ? ['breadcrumb', 'metahub-publication', metahubId, publicationId, language]
                : ['breadcrumb', 'metahub-publication', 'missing-id', 'missing-id', language],
        queryFn: async () => {
            if (!metahubId || !publicationId) return null
            const entity = await loadBreadcrumbEntity(client, `/metahub/${metahubId}/publication/${publicationId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(metahubId && publicationId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })
    const resolvedName = query.isLoading ? null : query.data ?? null
    useBreadcrumbSuccessDebug({
        entityType: 'metahub-publication',
        entityId: publicationId,
        authLoading,
        language,
        queryStatus: query.status,
        fetchStatus: query.fetchStatus,
        resolvedName
    })

    return resolvedName
}

// Backward-compatible alias
export const useMetahubApplicationName = useMetahubPublicationName

/**
 * Hook to fetch Layout name within Metahub context for breadcrumb display.
 * Requires metahubId and layoutId since Layout API is nested under Metahub.
 */
export function useLayoutName(metahubId: string | null, layoutId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'layout', metahubId, layoutId, language],
        queryFn: async () => {
            if (!metahubId || !layoutId) return null
            const entity = (await loadBreadcrumbEntity(client, `/metahub/${metahubId}/layout/${layoutId}`)) as Record<string, unknown> & {
                templateKey?: string | null
            }
            return extractLocalizedString(entity?.name, language) || entity?.templateKey || null
        },
        enabled: Boolean(metahubId && layoutId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

/**
 * Hook to fetch Connector name for breadcrumb display.
 * Requires applicationId and connectorId since Connector API is nested under Application.
 */
export function useConnectorName(applicationId: string | null, connectorId: string | null): string | null {
    const { client, loading: authLoading } = useAuth()
    const language = getCurrentLanguageKey()
    const query = useQuery({
        queryKey: ['breadcrumb', 'connector', applicationId, connectorId, language],
        queryFn: async () => {
            if (!applicationId || !connectorId) return null
            const entity = await loadBreadcrumbEntity(client, `/applications/${applicationId}/connectors/${connectorId}`)
            return resolveEntityDisplayName(entity)
        },
        enabled: Boolean(applicationId && connectorId) && !authLoading,
        staleTime: 5 * 60 * 1000,
        retry: shouldRetryBreadcrumbQuery,
        retryOnMount: true,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false
    })

    return query.isLoading ? null : query.data ?? null
}

// ============================================================
// Pre-configured truncate functions
// ============================================================

/** Truncate metahub name with ellipsis (default: 30 chars) */
export const truncateMetahubName = createTruncateFunction(30)

/** Backward-compatible alias (legacy naming) */
export const truncateMetaverseName = truncateMetahubName

/** Truncate application name with ellipsis (default: 30 chars) */
export const truncateApplicationName = createTruncateFunction(30)

/** Truncate publication name with ellipsis (default: 30 chars) */
export const truncatePublicationName = truncateApplicationName

/** Truncate object-collection name with ellipsis (default: 30 chars) */
export const truncateObjectCollectionName = createTruncateFunction(30)

/** Truncate value-group name with ellipsis (default: 30 chars) */
export const truncateValueGroupName = createTruncateFunction(30)

/** Truncate option-list name with ellipsis (default: 30 chars) */
export const truncateOptionListName = createTruncateFunction(30)

/** Truncate connector name with ellipsis (default: 30 chars) */
export const truncateConnectorName = createTruncateFunction(30)

/** Truncate layout name with ellipsis (default: 30 chars) */
export const truncateLayoutName = createTruncateFunction(30)
