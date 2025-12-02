/**
 * Templates API Client
 *
 * Manages community templates (from template registry) and custom templates
 * (user-created templates saved from Canvas/Tools).
 *
 * @example
 * ```typescript
 * import { api, templatesQueryKeys } from '@universo/api-client'
 * import { useQuery } from '@tanstack/react-query'
 *
 * // Get all community templates
 * const { data } = useQuery({
 *   queryKey: templatesQueryKeys.list(unikId),
 *   queryFn: () => api.templates.getAll(unikId)
 * })
 *
 * // Get user's custom templates
 * const { data: custom } = useQuery({
 *   queryKey: templatesQueryKeys.custom(unikId),
 *   queryFn: () => api.templates.getAllCustom(unikId)
 * })
 * ```
 */

import type { AxiosInstance, AxiosResponse } from 'axios'

// ============ Types ============

/** Base template type for both community and custom templates */
export interface Template {
    id: string
    templateName: string
    name?: string
    description?: string
    flowData: string
    badge?: 'POPULAR' | 'NEW'
    type: 'Chatflow' | 'Agentflow' | 'Tool'
    categories?: string[]
    usecases?: string[]
    framework?: string[]
}

/** Community template from registry */
export interface CommunityTemplate extends Template {
    /** Static template ID from JSON files */
    id: string
}

/** Tool template from registry */
export interface ToolTemplate {
    id: string
    templateName: string
    name: string
    description?: string
    iconSrc?: string
    schema?: string
    func?: string
}

/** Custom template saved by user */
export interface CustomTemplate extends Template {
    id: string
    unikId: string
    createdDate: string
    updatedDate: string
}

/** Request body for saving a custom template */
export interface SaveCustomTemplateBody {
    /** Name for the template */
    name: string
    /** Source chatflow/agentflow ID */
    chatflowId: string
    /** Template type */
    type: 'Chatflow' | 'Agentflow' | 'Tool'
    /** Optional description */
    description?: string
    /** Optional badge */
    badge?: string
    /** Framework used */
    framework?: string
    /** Use cases for this template */
    usecases?: string[]
    /** Categories/tags */
    categories?: string[]
}

// ============ API Class ============

export class TemplatesApi {
    constructor(private readonly client: AxiosInstance) {}

    // -------- Community Templates (Registry) --------

    /**
     * Get all community templates from registry
     * Returns static templates from JSON files bundled with the server
     */
    async getAll(unikId: string): Promise<AxiosResponse<CommunityTemplate[]>> {
        return this.client.get(`/unik/${unikId}/templates`)
    }

    /**
     * Get all tool templates from registry
     * Returns static tool templates from JSON files
     */
    async getAllTools(unikId: string): Promise<AxiosResponse<ToolTemplate[]>> {
        return this.client.get(`/unik/${unikId}/marketplaces/tools`)
    }

    // -------- Custom Templates (User-created) --------

    /**
     * Get all custom templates for a Unik
     * Returns templates saved by the user from their chatflows/agentflows
     */
    async getAllCustom(unikId: string): Promise<AxiosResponse<CustomTemplate[]>> {
        return this.client.get(`/unik/${unikId}/templates/custom`)
    }

    /**
     * Save a chatflow/agentflow as a custom template
     * Creates a reusable template from an existing canvas
     */
    async saveCustom(unikId: string, body: SaveCustomTemplateBody): Promise<AxiosResponse<CustomTemplate>> {
        return this.client.post(`/unik/${unikId}/templates/custom`, body)
    }

    /**
     * Delete a custom template
     * Removes a user-created template (does not affect the source chatflow)
     */
    async deleteCustom(unikId: string, id: string): Promise<AxiosResponse<void>> {
        return this.client.delete(`/unik/${unikId}/templates/custom/${id}`)
    }
}

// ============ TanStack Query Keys ============

/**
 * Query keys factory for TanStack Query integration
 *
 * @example
 * ```typescript
 * // Invalidate all template data for a unik
 * queryClient.invalidateQueries({
 *   queryKey: templatesQueryKeys.unik(unikId)
 * })
 *
 * // Invalidate only custom templates
 * queryClient.invalidateQueries({
 *   queryKey: templatesQueryKeys.custom(unikId)
 * })
 * ```
 */
export const templatesQueryKeys = {
    /** Root key for all template data */
    all: ['templates'] as const,

    /** All template data for a specific unik */
    unik: (unikId: string) => [...templatesQueryKeys.all, 'unik', unikId] as const,

    /** Community templates list */
    list: (unikId: string) => [...templatesQueryKeys.unik(unikId), 'list'] as const,

    /** Tool templates list */
    tools: (unikId: string) => [...templatesQueryKeys.unik(unikId), 'tools'] as const,

    /** Custom templates list */
    custom: (unikId: string) => [...templatesQueryKeys.unik(unikId), 'custom'] as const,

    /** Single custom template */
    customById: (unikId: string, id: string) => [...templatesQueryKeys.custom(unikId), id] as const
} as const

// ============ Legacy Aliases (for backward compatibility) ============

/** @deprecated Use TemplatesApi instead */
export const MarketplacesApi = TemplatesApi

/** @deprecated Use templatesQueryKeys instead */
export const marketplacesQueryKeys = templatesQueryKeys

/** @deprecated Use CommunityTemplate instead */
export type MarketplaceTemplate = CommunityTemplate
