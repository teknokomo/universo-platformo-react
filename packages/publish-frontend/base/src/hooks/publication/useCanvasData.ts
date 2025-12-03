import { useQuery } from '@tanstack/react-query'
import { PublicationApi } from '../../api'
import { publishQueryKeys } from '../../api'

/**
 * Hook for fetching canvas/space data with automatic caching
 *
 * @param unikId - Unik (user/organization) ID
 * @param canvasId - Canvas/Space ID
 * @param options - Additional query options
 * @returns Query result with canvas data
 *
 * @example
 * ```tsx
 * const { data: canvas, isLoading } = useCanvasData('unik-123', 'canvas-456')
 * ```
 */
export function useCanvasData(unikId: string | undefined, canvasId: string | undefined, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: publishQueryKeys.canvasByUnik(unikId || '', canvasId || ''),
        queryFn: async () => {
            if (!unikId || !canvasId) {
                throw new Error('Both unikId and canvasId are required')
            }
            const response = await PublicationApi.getCanvasById(unikId, canvasId)
            return response.data
        },
        enabled: (options?.enabled ?? true) && !!unikId && !!canvasId,
        staleTime: 5 * 60 * 1000 // 5 minutes - canvas data doesn't change often
    })
}

/**
 * Hook for extracting version group ID from canvas data
 *
 * This hook helps resolve the version group ID from canvas/flow data,
 * which is needed for creating publication links.
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
    if (!canvas) {
        return null
    }

    // Try to get version group ID from canvas data
    // This might be in different places depending on the data structure
    return canvas.versionGroupId || canvas.version_group_id || null
}
