/**
 * Credentials API Client
 * 
 * Manages user credentials for external services (OpenAI, Google, Anthropic, etc.)
 * Handles encryption/decryption on the backend.
 * 
 * @example
 * ```typescript
 * import { createUniversoApiClient, credentialQueryKeys } from '@universo/api-client'
 * import { useQuery, useMutation } from '@tanstack/react-query'
 * 
 * const api = createUniversoApiClient({ baseURL: '/api/v1' })
 * 
 * // Get all credentials
 * const { data: credentials } = useQuery({
 *   queryKey: credentialQueryKeys.list(unikId),
 *   queryFn: () => api.credentials.getAll(unikId)
 * })
 * 
 * // Create new credential
 * const createMutation = useMutation({
 *   mutationFn: (payload) => api.credentials.create(unikId, payload),
 *   onSuccess: () => {
 *     queryClient.invalidateQueries({ queryKey: credentialQueryKeys.list(unikId) })
 *   }
 * })
 * ```
 */

import type { AxiosInstance } from 'axios'
import type {
    Credential,
    CredentialComponent,
    CreateCredentialPayload,
    UpdateCredentialPayload,
} from '../types/credential'

export class CredentialsApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all credentials for a user
     */
    async getAll(unikId: string): Promise<Credential[]> {
        const response = await this.client.get<Credential[]>(
            `/unik/${unikId}/credentials`
        )
        return response.data
    }

    /**
     * Get credentials filtered by component name
     * 
     * @param unikId - User/organization ID
     * @param componentCredentialName - Credential component name (e.g., 'openAIApi')
     */
    async getByName(
        unikId: string,
        componentCredentialName: string
    ): Promise<Credential[]> {
        const response = await this.client.get<Credential[]>(
            `/unik/${unikId}/credentials`,
            { params: { credentialName: componentCredentialName } }
        )
        return response.data
    }

    /**
     * Get all available credential components (schemas)
     * Returns metadata about what credential types are available
     */
    async getAllComponents(): Promise<CredentialComponent[]> {
        const response = await this.client.get<CredentialComponent[]>(
            '/components-credentials'
        )
        return response.data
    }

    /**
     * Get specific credential by ID
     */
    async getById(unikId: string, id: string): Promise<Credential> {
        const response = await this.client.get<Credential>(
            `/unik/${unikId}/credentials/${id}`
        )
        return response.data
    }

    /**
     * Get credential component schema by name
     * 
     * @param name - Component name (e.g., 'openAIApi', 'googleDriveApi')
     * @returns Schema with input fields, descriptions, etc.
     */
    async getComponentSchema(name: string): Promise<CredentialComponent> {
        const response = await this.client.get<CredentialComponent>(
            `/components-credentials/${name}`
        )
        return response.data
    }

    /**
     * Create new credential
     * Backend will encrypt the plainDataObj before storing
     */
    async create(
        unikId: string,
        payload: CreateCredentialPayload
    ): Promise<Credential> {
        const response = await this.client.post<Credential>(
            `/unik/${unikId}/credentials`,
            payload
        )
        return response.data
    }

    /**
     * Update existing credential
     * Can update name and/or credential data
     */
    async update(
        unikId: string,
        id: string,
        payload: UpdateCredentialPayload
    ): Promise<Credential> {
        const response = await this.client.put<Credential>(
            `/unik/${unikId}/credentials/${id}`,
            payload
        )
        return response.data
    }

    /**
     * Delete credential
     * Will fail if credential is in use by any chatflow
     */
    async delete(unikId: string, id: string): Promise<void> {
        await this.client.delete(`/unik/${unikId}/credentials/${id}`)
    }
}

/**
 * Query keys factory for TanStack Query integration
 * 
 * Provides type-safe, normalized cache keys for credential queries.
 * Use these with useQuery/useMutation for automatic caching and invalidation.
 * 
 * @example
 * ```typescript
 * // List all credentials
 * useQuery({
 *   queryKey: credentialQueryKeys.list(unikId),
 *   queryFn: () => api.credentials.getAll(unikId)
 * })
 * 
 * // Get specific credential
 * useQuery({
 *   queryKey: credentialQueryKeys.detail(unikId, credentialId),
 *   queryFn: () => api.credentials.getById(unikId, credentialId)
 * })
 * 
 * // Invalidate after mutation
 * queryClient.invalidateQueries({
 *   queryKey: credentialQueryKeys.lists()
 * })
 * ```
 */
export const credentialQueryKeys = {
    /** Base key for all credential queries */
    all: ['credentials'] as const,
    
    /** All list queries */
    lists: () => [...credentialQueryKeys.all, 'list'] as const,
    
    /** Credential list for specific user */
    list: (unikId: string) =>
        [...credentialQueryKeys.lists(), { unikId }] as const,
    
    /** Credential list filtered by component name */
    listByName: (unikId: string, name: string) =>
        [...credentialQueryKeys.lists(), { unikId, name }] as const,
    
    /** All detail queries */
    details: () => [...credentialQueryKeys.all, 'detail'] as const,
    
    /** Specific credential detail */
    detail: (unikId: string, id: string) =>
        [...credentialQueryKeys.details(), { unikId, id }] as const,
    
    /** All component schema queries */
    components: () => [...credentialQueryKeys.all, 'components'] as const,
    
    /** Specific component schema */
    component: (name: string) =>
        [...credentialQueryKeys.components(), { name }] as const,
} as const
