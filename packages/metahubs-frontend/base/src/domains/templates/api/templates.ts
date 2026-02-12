import { apiClient } from '../../shared'
import type { TemplateSummaryDTO, TemplateDetailDTO, TemplatesListResponseDTO } from '@universo/types'

// Re-export shared DTO types for convenience
export type { TemplateSummaryDTO as TemplateSummary } from '@universo/types'
export type { TemplateDetailDTO as TemplateDetail } from '@universo/types'
export type { TemplateVersionSummaryDTO as TemplateVersionSummary } from '@universo/types'
export type { TemplatesListResponseDTO as TemplatesListResponse } from '@universo/types'

// ============ API FUNCTIONS ============

export const listTemplates = async (): Promise<TemplateSummaryDTO[]> => {
    const response = await apiClient.get<TemplatesListResponseDTO>('/templates')
    return response.data.data
}

export const getTemplate = async (templateId: string): Promise<TemplateDetailDTO> => {
    const response = await apiClient.get<TemplateDetailDTO>(`/templates/${templateId}`)
    return response.data
}
