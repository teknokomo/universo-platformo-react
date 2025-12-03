import { useMutation, useQueryClient } from '@tanstack/react-query'
import { StreamingPublicationApi, PublishLinksApi } from '../../api'
import { invalidatePublishQueries } from '../../api'
import type { IARJSPublishRequest } from '@universo/publish-backend'
import { useState, useCallback } from 'react'

/**
 * Publication creation progress state
 */
export interface PublicationProgress {
    stage: 'idle' | 'preparing' | 'uploading' | 'generating' | 'finalizing' | 'complete' | 'error'
    message: string
    progress: number // 0-100
}

/**
 * Hook for creating AR.js publications with progress tracking
 *
 * @returns Mutation object with createPublication function and progress state
 *
 * @example
 * ```tsx
 * const {
 *   mutateAsync: createPublication,
 *   isPending,
 *   progress
 * } = useCreateARJSPublication()
 *
 * await createPublication({
 *   canvasId: 'canvas-123',
 *   versionGroupId: 'v1',
 *   settings: { ... }
 * })
 * ```
 */
export function useCreateARJSPublication() {
    const queryClient = useQueryClient()
    const [progress, setProgress] = useState<PublicationProgress>({
        stage: 'idle',
        message: '',
        progress: 0
    })

    const mutation = useMutation({
        mutationFn: async (request: IARJSPublishRequest) => {
            // Reset progress
            setProgress({
                stage: 'preparing',
                message: 'Preparing publication...',
                progress: 10
            })

            try {
                // Update progress
                setProgress({
                    stage: 'uploading',
                    message: 'Uploading data...',
                    progress: 30
                })

                // Create publication
                const response = await StreamingPublicationApi.publishARJS(request)

                // Update progress
                setProgress({
                    stage: 'generating',
                    message: 'Generating content...',
                    progress: 60
                })

                // Simulate generation progress (in real implementation, this would be from SSE)
                await new Promise((resolve) => setTimeout(resolve, 1000))

                setProgress({
                    stage: 'finalizing',
                    message: 'Finalizing publication...',
                    progress: 90
                })

                await new Promise((resolve) => setTimeout(resolve, 500))

                setProgress({
                    stage: 'complete',
                    message: 'Publication created successfully!',
                    progress: 100
                })

                return response
            } catch (error) {
                setProgress({
                    stage: 'error',
                    message: error instanceof Error ? error.message : 'Publication failed',
                    progress: 0
                })
                throw error
            }
        },
        onSuccess: () => {
            // Invalidate all publication-related queries
            invalidatePublishQueries.all(queryClient)
        },
        onSettled: () => {
            // Reset progress after a delay
            setTimeout(() => {
                setProgress({
                    stage: 'idle',
                    message: '',
                    progress: 0
                })
            }, 3000)
        }
    })

    return {
        ...mutation,
        progress
    }
}

/**
 * Hook for deleting publications with optimistic updates
 *
 * @returns Mutation object with deletePublication function
 *
 * @example
 * ```tsx
 * const { mutateAsync: deletePublication, isPending } = useDeletePublication()
 *
 * await deletePublication('publication-id-123')
 * ```
 */
export function useDeletePublication() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (publicationId: string) => {
            await PublishLinksApi.deleteLink(publicationId)
        },
        onMutate: async (publicationId) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['publish', 'links'] })

            // Snapshot the previous value
            const previousLinks = queryClient.getQueryData(['publish', 'links'])

            // Optimistically update to remove the publication
            queryClient.setQueriesData({ queryKey: ['publish', 'links'] }, (old: any) => {
                if (!old) return old
                if (Array.isArray(old)) {
                    return old.filter((link: any) => link.id !== publicationId)
                }
                if (old.data && Array.isArray(old.data)) {
                    return {
                        ...old,
                        data: old.data.filter((link: any) => link.id !== publicationId)
                    }
                }
                return old
            })

            // Return context with snapshot
            return { previousLinks }
        },
        onError: (_err, _publicationId, context) => {
            // Rollback on error
            if (context?.previousLinks) {
                queryClient.setQueryData(['publish', 'links'], context.previousLinks)
            }
        },
        onSuccess: () => {
            // Invalidate all publication-related queries
            invalidatePublishQueries.all(queryClient)
        }
    })
}

/**
 * Hook for managing publication state operations
 *
 * This hook combines creation and deletion operations with
 * progress tracking and error handling.
 *
 * @returns Object with publication state management functions
 *
 * @example
 * ```tsx
 * const {
 *   createARJSPublication,
 *   deletePublication,
 *   isCreating,
 *   isDeleting,
 *   creationProgress,
 *   error
 * } = usePublicationState()
 *
 * // Create publication
 * await createARJSPublication({
 *   canvasId: 'canvas-123',
 *   versionGroupId: 'v1',
 *   settings: { ... }
 * })
 *
 * // Delete publication
 * await deletePublication('publication-id-123')
 * ```
 */
export function usePublicationState() {
    const createMutation = useCreateARJSPublication()
    const deleteMutation = useDeletePublication()

    const createARJSPublication = useCallback(
        async (request: IARJSPublishRequest) => {
            return await createMutation.mutateAsync(request)
        },
        [createMutation]
    )

    const deletePublication = useCallback(
        async (publicationId: string) => {
            return await deleteMutation.mutateAsync(publicationId)
        },
        [deleteMutation]
    )

    return {
        // Creation
        createARJSPublication,
        isCreating: createMutation.isPending,
        creationProgress: createMutation.progress,
        creationError: createMutation.error,

        // Deletion
        deletePublication,
        isDeleting: deleteMutation.isPending,
        deletionError: deleteMutation.error,

        // Combined state
        isPending: createMutation.isPending || deleteMutation.isPending,
        error: createMutation.error || deleteMutation.error,

        // Reset functions
        resetCreation: createMutation.reset,
        resetDeletion: deleteMutation.reset
    }
}
