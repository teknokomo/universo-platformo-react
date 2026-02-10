import { useQuery } from '@tanstack/react-query'
import { metahubsQueryKeys } from '../../shared'
import { listTemplates } from '../api'
import type { TemplateSummary } from '../api'

/**
 * Hook to fetch the list of available metahub templates.
 * Templates are cached aggressively since they rarely change.
 */
export function useTemplates() {
    return useQuery<TemplateSummary[]>({
        queryKey: metahubsQueryKeys.templatesList(),
        queryFn: listTemplates,
        staleTime: 5 * 60 * 1000, // 5 minutes — templates change infrequently
        gcTime: 30 * 60 * 1000 // 30 minutes
    })
}
