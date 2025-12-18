import type { AxiosInstance } from 'axios'

/**
 * Execution state enum
 */
export enum ExecutionState {
    INPROGRESS = 'INPROGRESS',
    FINISHED = 'FINISHED',
    ERROR = 'ERROR',
    TERMINATED = 'TERMINATED',
    TIMEOUT = 'TIMEOUT',
    STOPPED = 'STOPPED'
}

/**
 * Execution entity interface
 */
export interface Execution {
    id: string
    canvasId: string
    executionData: string
    state: ExecutionState
    sessionId: string
    action?: string
    isPublic?: boolean
    createdDate: string
    updatedDate: string
    stoppedDate?: string
    canvas?: {
        id: string
        name: string
    }
}

/**
 * Query parameters for getting executions
 */
export interface GetExecutionsParams {
    id?: string
    canvasName?: string
    sessionId?: string
    state?: ExecutionState
    startDate?: string
    endDate?: string
    page?: number
    limit?: number
}

/**
 * Response type for getExecutions
 */
export interface GetExecutionsResponse {
    data: Execution[]
    total: number
}

/**
 * Payload for updating execution
 */
export interface UpdateExecutionPayload {
    isPublic?: boolean
    action?: string
    state?: ExecutionState
    stoppedDate?: string
}

/**
 * Payload for deleting multiple executions
 */
export interface DeleteExecutionsPayload {
    executionIds: string[]
}

/**
 * Response for delete operations
 */
export interface DeleteExecutionsResponse {
    success: boolean
    deletedCount: number
}

/**
 * ExecutionsApi class
 * Provides methods for managing agent flow executions
 *
 * @example
 * ```typescript
 * const executionsApi = new ExecutionsApi(client)
 *
 * // Get all executions for a canvas
 * const executions = await executionsApi.getExecutions(unikId, spaceId, canvasId, { limit: 20 })
 *
 * // Get specific execution
 * const execution = await executionsApi.getExecutionById(unikId, spaceId, canvasId, executionId)
 *
 * // Update execution
 * await executionsApi.updateExecution(unikId, spaceId, canvasId, executionId, { isPublic: true })
 *
 * // Delete execution(s)
 * await executionsApi.deleteExecution(unikId, spaceId, canvasId, executionId)
 * await executionsApi.deleteExecutions(unikId, spaceId, canvasId, { executionIds: ['id1', 'id2'] })
 * ```
 */
export class ExecutionsApi {
    constructor(private readonly client: AxiosInstance) {}

    /**
     * Get all executions within a Unik (across canvases) with optional filters
     */
    async getUnikExecutions(unikId: string, params?: GetExecutionsParams): Promise<GetExecutionsResponse> {
        const response = await this.client.get<GetExecutionsResponse>(`/unik/${unikId}/executions`, { params })
        return response.data
    }

    /**
     * Get execution by ID within a Unik (across canvases)
     */
    async getUnikExecutionById(unikId: string, executionId: string): Promise<Execution> {
        const response = await this.client.get<Execution>(`/unik/${unikId}/executions/${executionId}`)
        return response.data
    }

    /**
     * Update execution within a Unik (across canvases)
     */
    async updateUnikExecution(unikId: string, executionId: string, payload: UpdateExecutionPayload): Promise<Execution> {
        const response = await this.client.put<Execution>(`/unik/${unikId}/executions/${executionId}`, payload)
        return response.data
    }

    /**
     * Delete single execution within a Unik (soft delete)
     */
    async deleteUnikExecution(unikId: string, executionId: string): Promise<DeleteExecutionsResponse> {
        const response = await this.client.delete<DeleteExecutionsResponse>(`/unik/${unikId}/executions/${executionId}`)
        return response.data
    }

    /**
     * Delete multiple executions within a Unik (soft delete)
     */
    async deleteUnikExecutions(unikId: string, payload: DeleteExecutionsPayload): Promise<DeleteExecutionsResponse> {
        const response = await this.client.delete<DeleteExecutionsResponse>(`/unik/${unikId}/executions`, { data: payload })
        return response.data
    }

    /**
     * Get all executions for a canvas with optional filters
     */
    async getExecutions(unikId: string, spaceId: string, canvasId: string, params?: GetExecutionsParams): Promise<GetExecutionsResponse> {
        const response = await this.client.get<GetExecutionsResponse>(`/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/executions`, {
            params
        })
        return response.data
    }

    /**
     * Get execution by ID
     */
    async getExecutionById(unikId: string, spaceId: string, canvasId: string, executionId: string): Promise<Execution> {
        const response = await this.client.get<Execution>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/executions/${executionId}`
        )
        return response.data
    }

    /**
     * Get public execution by ID (no authentication required)
     */
    async getPublicExecutionById(executionId: string): Promise<Execution> {
        const response = await this.client.get<Execution>(`/public-executions/${executionId}`)
        return response.data
    }

    /**
     * Update execution
     */
    async updateExecution(
        unikId: string,
        spaceId: string,
        canvasId: string,
        executionId: string,
        payload: UpdateExecutionPayload
    ): Promise<Execution> {
        const response = await this.client.put<Execution>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/executions/${executionId}`,
            payload
        )
        return response.data
    }

    /**
     * Delete single execution (soft delete)
     */
    async deleteExecution(unikId: string, spaceId: string, canvasId: string, executionId: string): Promise<DeleteExecutionsResponse> {
        const response = await this.client.delete<DeleteExecutionsResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/executions/${executionId}`
        )
        return response.data
    }

    /**
     * Delete multiple executions (soft delete)
     */
    async deleteExecutions(
        unikId: string,
        spaceId: string,
        canvasId: string,
        payload: DeleteExecutionsPayload
    ): Promise<DeleteExecutionsResponse> {
        const response = await this.client.delete<DeleteExecutionsResponse>(
            `/unik/${unikId}/spaces/${spaceId}/canvases/${canvasId}/executions`,
            { data: payload }
        )
        return response.data
    }
}

/**
 * Query keys for TanStack Query
 */
export const executionQueryKeys = {
    all: ['executions'] as const,
    lists: () => [...executionQueryKeys.all, 'list'] as const,
    unikList: (unikId: string, params?: GetExecutionsParams) => [...executionQueryKeys.lists(), unikId, params] as const,
    list: (unikId: string, spaceId: string, canvasId: string, params?: GetExecutionsParams) =>
        [...executionQueryKeys.lists(), unikId, spaceId, canvasId, params] as const,
    details: () => [...executionQueryKeys.all, 'detail'] as const,
    unikDetail: (unikId: string, executionId: string) => [...executionQueryKeys.details(), unikId, executionId] as const,
    detail: (unikId: string, spaceId: string, canvasId: string, executionId: string) =>
        [...executionQueryKeys.details(), unikId, spaceId, canvasId, executionId] as const,
    public: (executionId: string) => [...executionQueryKeys.all, 'public', executionId] as const
}
