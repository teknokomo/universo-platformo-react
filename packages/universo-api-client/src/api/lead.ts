/**
 * LeadApi - Contact information captured during chat interactions
 *
 * Manages leads (contact information) collected during chat sessions.
 * Leads allow tracking user contacts for follow-up and analytics purposes.
 *
 * @example
 * ```typescript
 * import { createUniversoApiClient, leadQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 *
 * // Get all leads for a canvas
 * const { data: leads } = useQuery({
 *   queryKey: leadQueryKeys.byCanvas(canvasId),
 *   queryFn: () => api.leads.getCanvasLeads(canvasId)
 * })
 * ```
 */

import type { AxiosInstance, AxiosResponse } from 'axios'
import type { ILead, CreateLeadBody } from '@universo/flowise-leads-srv'

// Re-export types from @universo/flowise-leads-srv (single source of truth)
export type { ILead, CreateLeadBody } from '@universo/flowise-leads-srv'

export class LeadApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all leads for a specific canvas
     * @param canvasId - The ID of the canvas
     */
    async getCanvasLeads(canvasId: string): Promise<AxiosResponse<ILead[]>> {
        return this.client.get<ILead[]>(`/leads/${canvasId}`)
    }

    /**
     * Create a new lead
     * @param body - Lead creation data
     */
    async addLead(body: CreateLeadBody): Promise<AxiosResponse<ILead>> {
        return this.client.post<ILead>('/leads', body)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const leadQueryKeys = {
    all: ['leads'] as const,
    byCanvas: (canvasId: string) => [...leadQueryKeys.all, canvasId] as const
} as const

