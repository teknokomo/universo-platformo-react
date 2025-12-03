import { useQuery } from '@tanstack/react-query'
import { ProjectsQueryKeys } from './queryKeys'
import { getProject } from './projects'

interface UseProjectDetailsOptions {
    /**
     * Whether to enable automatic refetching
     * @default true
     */
    enabled?: boolean

    /**
     * Time in milliseconds before data is considered stale
     * @default 300000 (5 minutes)
     */
    staleTime?: number

    /**
     * Number of retry attempts on failure
     * @default 3
     */
    retry?: number
}

/**
 * Hook for fetching Project details with statistics
 *
 * Fetches complete Project data including:
 * - MilestonesCount
 * - TasksCount
 * - membersCount (added in Phase 1)
 *
 * @param projectId - UUID of the Project
 * @param options - Query configuration options
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useProjectDetails(projectId)
 *
 * if (isLoading) return <Loader />
 * if (error) return <ErrorMessage error={error} />
 *
 * return <ProjectBoardGrid Project={data} />
 * ```
 */
export function useProjectDetails(projectId: string, options?: UseProjectDetailsOptions) {
    const { enabled = true, staleTime = 5 * 60 * 1000, retry = 3 } = options ?? {}

    return useQuery({
        queryKey: ProjectsQueryKeys.detail(projectId),
        queryFn: async () => {
            const response = await getProject(projectId)
            return response.data
        },
        enabled: enabled && Boolean(projectId),
        staleTime,
        retry,
        // Prevent refetching on window focus (stats don't change frequently)
        refetchOnWindowFocus: false,
        // Use cached data while revalidating in background
        refetchOnMount: 'always'
    })
}

export type { UseProjectDetailsOptions }
export type UseProjectDetailsResult = ReturnType<typeof useProjectDetails>
