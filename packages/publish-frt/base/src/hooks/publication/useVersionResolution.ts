import { useQuery } from '@tanstack/react-query'
import { canvasVersionsApi } from '../../api'
import { publishQueryKeys } from '../../api'
import { useMemo } from 'react'

/**
 * Hook for resolving version group ID from canvas data
 *
 * This hook helps extract the version group ID from canvas/flow data,
 * which is needed for creating publication links and managing versions.
 *
 * @param canvas - Canvas/flow data object
 * @returns Version group ID or null
 *
 * @example
 * ```tsx
 * const { data: canvas } = useCanvasData(unikId, canvasId)
 * const versionGroupId = useVersionGroupId(canvas)
 * ```
 */
export function useVersionGroupId(canvas: any): string | null {
    return useMemo(() => {
        if (!canvas) {
            return null
        }

        // Try to get version group ID from canvas data
        // This might be in different places depending on the data structure
        return canvas.versionGroupId || canvas.version_group_id || null
    }, [canvas])
}

/**
 * Hook for fetching all versions of a canvas with automatic caching
 *
 * @param unikId - Unik (user/organization) ID
 * @param spaceId - Space ID
 * @param canvasId - Canvas ID
 * @param options - Additional query options
 * @returns Query result with versions array
 *
 * @example
 * ```tsx
 * const { data: versions, isLoading } = useCanvasVersions(
 *   'unik-123',
 *   'space-456',
 *   'canvas-789'
 * )
 * ```
 */
export function useCanvasVersions(
    unikId: string | undefined,
    spaceId: string | undefined,
    canvasId: string | undefined,
    options?: { enabled?: boolean }
) {
    return useQuery({
        queryKey: [...publishQueryKeys.canvasById(canvasId || ''), 'versions'],
        queryFn: async () => {
            if (!unikId || !spaceId || !canvasId) {
                throw new Error('unikId, spaceId, and canvasId are required')
            }
            return await canvasVersionsApi.listVersions(unikId, spaceId, canvasId)
        },
        enabled: (options?.enabled ?? true) && !!unikId && !!spaceId && !!canvasId,
        staleTime: 5 * 60 * 1000 // 5 minutes - versions don't change often
    })
}

/**
 * Hook for resolving version information from canvas data
 *
 * This hook combines canvas data and version list to provide
 * comprehensive version resolution functionality.
 *
 * @param unikId - Unik (user/organization) ID
 * @param spaceId - Space ID
 * @param canvasId - Canvas ID
 * @param canvas - Canvas data (optional, for optimization)
 * @returns Object with version resolution data and helpers
 *
 * @example
 * ```tsx
 * const {
 *   versionGroupId,
 *   versions,
 *   activeVersion,
 *   isLoading
 * } = useVersionResolution('unik-123', 'space-456', 'canvas-789')
 *
 * // Use versionGroupId for creating publication links
 * const { mutateAsync: createLink } = useCreateGroupLink()
 * await createLink({
 *   canvasId,
 *   technology: 'arjs',
 *   versionGroupId
 * })
 * ```
 */
export function useVersionResolution(unikId: string | undefined, spaceId: string | undefined, canvasId: string | undefined, canvas?: any) {
    // Get version group ID from canvas data
    const versionGroupId = useVersionGroupId(canvas)

    // Fetch all versions for this canvas
    const { data: versions = [], isLoading: isLoadingVersions } = useCanvasVersions(unikId, spaceId, canvasId, {
        enabled: !!versionGroupId
    })

    // Find active version
    const activeVersion = useMemo(() => {
        return versions.find((v) => v.isActive) || null
    }, [versions])

    // Find version by version group ID
    const versionByGroupId = useMemo(() => {
        if (!versionGroupId) return null
        return versions.find((v) => v.versionGroupId === versionGroupId) || null
    }, [versions, versionGroupId])

    // Get latest version (highest versionIndex)
    const latestVersion = useMemo(() => {
        if (versions.length === 0) return null
        return versions.reduce((latest, current) => (current.versionIndex > latest.versionIndex ? current : latest), versions[0])
    }, [versions])

    return {
        // Version group ID from canvas
        versionGroupId,

        // All versions for this canvas
        versions,

        // Active version (currently deployed)
        activeVersion,

        // Version matching the version group ID
        versionByGroupId,

        // Latest version (highest index)
        latestVersion,

        // Loading state
        isLoading: isLoadingVersions,

        // Helper to check if a specific version is active
        isVersionActive: (versionUuid: string) => activeVersion?.versionUuid === versionUuid,

        // Helper to get version by UUID
        getVersionByUuid: (versionUuid: string) => versions.find((v) => v.versionUuid === versionUuid) || null
    }
}
