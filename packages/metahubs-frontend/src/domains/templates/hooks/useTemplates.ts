import { useQuery } from '@tanstack/react-query'
import type { TemplateDefinitionType } from '@universo/types'
import { metahubsQueryKeys } from '../../shared'
import { getTemplate, listTemplates } from '../api'
import type { TemplateSummary } from '../api'
import type { TemplateDetail } from '../api'

/**
 * Hook to fetch the list of available metahub templates.
 * Templates are cached aggressively since they rarely change.
 */
export function useTemplates(definitionType: TemplateDefinitionType = 'metahub_template') {
    return useQuery<TemplateSummary[]>({
        queryKey: metahubsQueryKeys.templatesList({ definitionType }),
        queryFn: () => listTemplates({ definitionType }),
        staleTime: 5 * 60 * 1000, // 5 minutes — templates change infrequently
        gcTime: 30 * 60 * 1000 // 30 minutes
    })
}

export function useTemplateDetail(templateId?: string) {
    return useQuery<TemplateDetail>({
        queryKey: templateId ? metahubsQueryKeys.templateDetail(templateId) : ['metahubs', 'templates', 'detail', 'empty'],
        queryFn: () => getTemplate(templateId!),
        enabled: Boolean(templateId),
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000
    })
}
