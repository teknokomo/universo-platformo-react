/**
 * VariablesApi
 *
 * API client for managing variables
 */

import type { AxiosInstance, AxiosResponse } from 'axios'
import type { Variable, CreateVariableDto, UpdateVariableDto } from '../types'

export class VariablesApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all variables for a unik
     */
    async getAllVariables(unikId: string): Promise<AxiosResponse<Variable[]>> {
        return this.client.get<Variable[]>(`/unik/${unikId}/variables`)
    }

    /**
     * Create a new variable
     */
    async createVariable(unikId: string, body: CreateVariableDto): Promise<AxiosResponse<Variable>> {
        return this.client.post<Variable>(`/unik/${unikId}/variables`, body)
    }

    /**
     * Update an existing variable
     */
    async updateVariable(unikId: string, id: string, body: UpdateVariableDto): Promise<AxiosResponse<Variable>> {
        return this.client.put<Variable>(`/unik/${unikId}/variables/${id}`, body)
    }

    /**
     * Delete a variable
     */
    async deleteVariable(unikId: string, id: string): Promise<AxiosResponse<void>> {
        return this.client.delete<void>(`/unik/${unikId}/variables/${id}`)
    }
}

/**
 * Query keys factory for TanStack Query integration
 */
export const variablesQueryKeys = {
    all: ['variables'] as const,
    lists: () => [...variablesQueryKeys.all, 'list'] as const,
    list: (unikId: string) => [...variablesQueryKeys.lists(), unikId] as const,
    details: () => [...variablesQueryKeys.all, 'detail'] as const,
    detail: (unikId: string, id: string) => [...variablesQueryKeys.details(), unikId, id] as const
} as const
