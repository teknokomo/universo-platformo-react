import type { QueryClient } from '@tanstack/react-query'

/**
 * Query Key Factory for Publish API
 * 
 * Centralized query key management following TanStack Query best practices.
 * 
 * Benefits:
 * - Type normalization (string/number → string) prevents cache mismatches
 * - Easy cache invalidation with helper functions
 * - Hierarchical structure for granular invalidation
 * - TypeScript autocomplete support
 * - Prevents accidental key collisions
 * 
 * @example
 * ```typescript
 * // Using in queries
 * const { data } = useQuery({
 *   queryKey: publishQueryKeys.linksByVersion('arjs', flowId, versionGroupId),
 *   queryFn: fetchLinks
 * })
 * 
 * // Invalidating cache
 * invalidatePublishQueries.linksByTechnology(queryClient, 'arjs')
 * ```
 */

export const publishQueryKeys = {
    /**
     * Base key for all publish-related queries
     * @returns {string[]} ['publish']
     */
    all: ['publish'] as const,

    /**
     * Base key for publication links queries
     * @returns {string[]} ['publish', 'links']
     */
    links: () => [...publishQueryKeys.all, 'links'] as const,

    /**
     * Query key for links filtered by technology
     * @param technology - Technology type ('arjs' | 'playcanvas')
     * @returns {string[]} ['publish', 'links', technology]
     */
    linksByTechnology: (technology: string) => [...publishQueryKeys.links(), technology] as const,

    /**
     * Query key for links filtered by technology and flow ID
     * @param technology - Technology type ('arjs' | 'playcanvas')
     * @param flowId - Canvas/flow ID (auto-normalized to string or null)
     * @returns {readonly unknown[]} ['publish', 'links', technology, flowId]
     */
    linksByFlow: (technology: string, flowId: string | number | null | undefined) => {
        const normalizedId = flowId ? String(flowId) : null
        return [...publishQueryKeys.linksByTechnology(technology), normalizedId] as const
    },

    /**
     * Query key for links filtered by technology, flow ID, and version group
     * @param technology - Technology type ('arjs' | 'playcanvas')
     * @param flowId - Canvas/flow ID (auto-normalized to string or null)
     * @param versionGroupId - Version group ID (optional)
     * @returns {readonly unknown[]} ['publish', 'links', technology, flowId, versionGroupId]
     */
    linksByVersion: (technology: string, flowId: string | number | null | undefined, versionGroupId: string | null | undefined) => {
        const normalizedFlow = flowId ? String(flowId) : null
        const normalizedVersion = versionGroupId || null
        return [...publishQueryKeys.linksByFlow(technology, normalizedFlow), normalizedVersion] as const
    },

    /**
     * Base key for canvas data queries
     * @returns {string[]} ['publish', 'canvas']
     */
    canvas: () => [...publishQueryKeys.all, 'canvas'] as const,

    /**
     * Query key for canvas data by canvas ID only
     * @param canvasId - Canvas ID (auto-normalized to string)
     * @returns {readonly string[]} ['publish', 'canvas', canvasId]
     */
    canvasById: (canvasId: string | number) => [...publishQueryKeys.canvas(), String(canvasId)] as const,

    /**
     * Query key for canvas data by unik ID and canvas ID
     * @param unikId - Unik (user/organization) ID
     * @param canvasId - Canvas ID (auto-normalized to string)
     * @returns {readonly string[]} ['publish', 'canvas', unikId, canvasId]
     */
    canvasByUnik: (unikId: string, canvasId: string | number) => [...publishQueryKeys.canvas(), unikId, String(canvasId)] as const,

    /**
     * Base key for template queries
     * @returns {string[]} ['publish', 'templates']
     */
    templates: () => [...publishQueryKeys.all, 'templates'] as const,

    /**
     * Query key for templates filtered by technology
     * @param technology - Technology type ('arjs' | 'playcanvas')
     * @returns {readonly string[]} ['publish', 'templates', technology]
     */
    templatesByTechnology: (technology: string) => [...publishQueryKeys.templates(), technology] as const,

    /**
     * Base key for version queries
     * @returns {string[]} ['publish', 'versions']
     */
    versions: () => [...publishQueryKeys.all, 'versions'] as const,

    /**
     * Query key for versions filtered by version group ID
     * @param versionGroupId - Version group ID
     * @returns {readonly string[]} ['publish', 'versions', versionGroupId]
     */
    versionsByGroup: (versionGroupId: string) => [...publishQueryKeys.versions(), versionGroupId] as const
}

/**
 * Helper functions for cache invalidation
 * 
 * These functions make it easy to invalidate related queries after mutations.
 * Use queryClient.invalidateQueries() to trigger refetch for matching queries.
 */
export const invalidatePublishQueries = {
    /**
     * Invalidate all publish-related queries
     */
    all: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: publishQueryKeys.all }),

    /**
     * Invalidate all publication links
     */
    links: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: publishQueryKeys.links() }),

    /**
     * Invalidate links for specific technology (e.g., 'arjs', 'playcanvas')
     */
    linksByTechnology: (queryClient: QueryClient, technology: string) =>
        queryClient.invalidateQueries({
            queryKey: publishQueryKeys.linksByTechnology(technology)
        }),

    /**
     * Invalidate specific canvas data
     */
    canvas: (queryClient: QueryClient, canvasId: string | number) =>
        queryClient.invalidateQueries({
            queryKey: publishQueryKeys.canvasById(canvasId)
        }),

    /**
     * Invalidate all templates
     */
    templates: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: publishQueryKeys.templates() }),

    /**
     * Invalidate all versions
     */
    versions: (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: publishQueryKeys.versions() })
}
