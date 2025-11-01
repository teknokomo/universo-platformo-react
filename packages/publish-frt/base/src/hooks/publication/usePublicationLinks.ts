import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PublishLinksApi, type PublishLinkQueryParams } from '../../api'
import { publishQueryKeys, invalidatePublishQueries } from '../../api'

/**
 * Hook for fetching publication links with automatic caching and deduplication
 *
 * @param params - Query parameters for filtering links
 * @param options - Additional query options
 * @returns Query result with publication links data
 *
 * @example
 * ```tsx
 * const { data: links, isLoading } = usePublicationLinks({
 *   technology: 'arjs',
 *   versionGroupId: 'v1'
 * })
 * ```
 */
export function usePublicationLinks(params: PublishLinkQueryParams = {}, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: params.technology
            ? publishQueryKeys.linksByVersion(params.technology, null, params.versionGroupId || null)
            : publishQueryKeys.links(),
        queryFn: async ({ signal }) => {
            return await PublishLinksApi.listLinks(params, { signal })
        },
        enabled: options?.enabled ?? true,
        staleTime: 2 * 60 * 1000 // 2 minutes - links don't change often
    })
}

/**
 * Hook for creating a new group publication link
 *
 * @returns Mutation object with createGroupLink function
 *
 * @example
 * ```tsx
 * const { mutateAsync: createLink, isPending } = useCreateGroupLink()
 *
 * await createLink({
 *   canvasId: 'canvas-123',
 *   technology: 'arjs',
 *   versionGroupId: 'v1'
 * })
 * ```
 */
export function useCreateGroupLink() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            canvasId,
            technology,
            versionGroupId
        }: {
            canvasId: string
            technology: 'arjs' | 'playcanvas'
            versionGroupId?: string
        }) => {
            return await PublishLinksApi.createGroupLink(canvasId, technology, versionGroupId)
        },
        onSuccess: (data) => {
            // Invalidate all links queries to refetch updated data
            invalidatePublishQueries.links(queryClient)
            // Also invalidate technology-specific queries
            invalidatePublishQueries.linksByTechnology(queryClient, data.technology)
        }
    })
}

/**
 * Hook for creating a new version publication link
 *
 * @returns Mutation object with createVersionLink function
 *
 * @example
 * ```tsx
 * const { mutateAsync: createLink, isPending } = useCreateVersionLink()
 *
 * await createLink({
 *   canvasId: 'canvas-123',
 *   versionUuid: 'uuid-456',
 *   technology: 'playcanvas'
 * })
 * ```
 */
export function useCreateVersionLink() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            canvasId,
            versionUuid,
            technology
        }: {
            canvasId: string
            versionUuid: string
            technology: 'arjs' | 'playcanvas'
        }) => {
            return await PublishLinksApi.createVersionLink(canvasId, versionUuid, technology)
        },
        onSuccess: (data) => {
            // Invalidate all links queries to refetch updated data
            invalidatePublishQueries.links(queryClient)
            // Also invalidate technology-specific queries
            invalidatePublishQueries.linksByTechnology(queryClient, data.technology)
        }
    })
}

/**
 * Hook for deleting a publication link
 *
 * @returns Mutation object with deleteLink function
 *
 * @example
 * ```tsx
 * const { mutateAsync: deleteLink, isPending } = useDeleteLink()
 *
 * await deleteLink('link-id-123')
 * ```
 */
export function useDeleteLink() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (linkId: string) => {
            await PublishLinksApi.deleteLink(linkId)
        },
        onSuccess: () => {
            // Invalidate all links queries to refetch updated data
            invalidatePublishQueries.links(queryClient)
        }
    })
}

/**
 * Hook for updating custom slug of a publication link
 *
 * @returns Mutation object with updateCustomSlug function
 *
 * @example
 * ```tsx
 * const { mutateAsync: updateSlug, isPending } = useUpdateCustomSlug()
 *
 * await updateSlug({
 *   linkId: 'link-id-123',
 *   customSlug: 'my-custom-slug'
 * })
 * ```
 */
export function useUpdateCustomSlug() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ linkId, customSlug }: { linkId: string; customSlug: string }) => {
            return await PublishLinksApi.updateCustomSlug(linkId, customSlug)
        },
        onSuccess: (data) => {
            // Invalidate all links queries to refetch updated data
            invalidatePublishQueries.links(queryClient)
            // Also invalidate technology-specific queries
            invalidatePublishQueries.linksByTechnology(queryClient, data.technology)
        }
    })
}
