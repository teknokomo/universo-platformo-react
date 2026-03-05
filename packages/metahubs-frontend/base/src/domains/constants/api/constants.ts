import type { ConstantCopyOptions } from '@universo/types'
import type { Constant, ConstantLocalizedPayload, PaginatedResponse, PaginationParams } from '../../../types'
import { apiClient } from '../../shared'

type ConstantsListParams = PaginationParams & { locale?: string }
type ConstantsListMeta = { totalAll?: number; limit?: number; limitReached?: boolean }
type ConstantsListResponse = PaginatedResponse<Constant> & { meta?: ConstantsListMeta }

const mapListResponse = (response: {
    data: {
        items: Constant[]
        pagination: { total: number; limit: number; offset: number }
        meta?: ConstantsListMeta
    }
}): ConstantsListResponse => {
    const backendPagination = response.data.pagination
    const items = response.data.items || []
    return {
        items,
        pagination: {
            limit: backendPagination?.limit ?? 100,
            offset: backendPagination?.offset ?? 0,
            count: items.length,
            total: backendPagination?.total ?? 0,
            hasMore: (backendPagination?.offset ?? 0) + items.length < (backendPagination?.total ?? 0)
        },
        meta: response.data.meta
    }
}

const buildListParams = (params?: ConstantsListParams) => ({
    limit: params?.limit,
    offset: params?.offset,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
    search: params?.search,
    locale: params?.locale
})

export const listConstants = async (
    metahubId: string,
    hubId: string,
    setId: string,
    params?: ConstantsListParams
): Promise<ConstantsListResponse> => {
    const response = await apiClient.get<{
        items: Constant[]
        pagination: { total: number; limit: number; offset: number }
        meta?: ConstantsListMeta
    }>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constants`, { params: buildListParams(params) })
    return mapListResponse(response)
}

export const listConstantsDirect = async (
    metahubId: string,
    setId: string,
    params?: ConstantsListParams
): Promise<ConstantsListResponse> => {
    const response = await apiClient.get<{
        items: Constant[]
        pagination: { total: number; limit: number; offset: number }
        meta?: ConstantsListMeta
    }>(`/metahub/${metahubId}/set/${setId}/constants`, { params: buildListParams(params) })
    return mapListResponse(response)
}

export const getConstant = (metahubId: string, hubId: string, setId: string, constantId: string) =>
    apiClient.get<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constant/${constantId}`)

export const getConstantDirect = (metahubId: string, setId: string, constantId: string) =>
    apiClient.get<Constant>(`/metahub/${metahubId}/set/${setId}/constant/${constantId}`)

export const createConstant = (metahubId: string, hubId: string, setId: string, data: ConstantLocalizedPayload) =>
    apiClient.post<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constants`, data)

export const createConstantDirect = (metahubId: string, setId: string, data: ConstantLocalizedPayload) =>
    apiClient.post<Constant>(`/metahub/${metahubId}/set/${setId}/constants`, data)

export const updateConstant = (metahubId: string, hubId: string, setId: string, constantId: string, data: ConstantLocalizedPayload) =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constant/${constantId}`, data)

export const updateConstantDirect = (metahubId: string, setId: string, constantId: string, data: ConstantLocalizedPayload) =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/set/${setId}/constant/${constantId}`, data)

export const deleteConstant = (metahubId: string, hubId: string, setId: string, constantId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constant/${constantId}`)

export const deleteConstantDirect = (metahubId: string, setId: string, constantId: string) =>
    apiClient.delete<void>(`/metahub/${metahubId}/set/${setId}/constant/${constantId}`)

export const moveConstant = (metahubId: string, hubId: string, setId: string, constantId: string, direction: 'up' | 'down') =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constant/${constantId}/move`, { direction })

export const moveConstantDirect = (metahubId: string, setId: string, constantId: string, direction: 'up' | 'down') =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/set/${setId}/constant/${constantId}/move`, { direction })

export const reorderConstant = (metahubId: string, hubId: string, setId: string, constantId: string, newSortOrder: number) =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constants/reorder`, {
        constantId,
        newSortOrder
    })

export const reorderConstantDirect = (metahubId: string, setId: string, constantId: string, newSortOrder: number) =>
    apiClient.patch<Constant>(`/metahub/${metahubId}/set/${setId}/constants/reorder`, {
        constantId,
        newSortOrder
    })

export type ConstantCopyInput = Partial<ConstantLocalizedPayload> &
    Partial<ConstantCopyOptions> & {
        codename?: string
    }

export const copyConstant = (metahubId: string, hubId: string, setId: string, constantId: string, data: ConstantCopyInput) =>
    apiClient.post<Constant>(`/metahub/${metahubId}/hub/${hubId}/set/${setId}/constant/${constantId}/copy`, data)

export const copyConstantDirect = (metahubId: string, setId: string, constantId: string, data: ConstantCopyInput) =>
    apiClient.post<Constant>(`/metahub/${metahubId}/set/${setId}/constant/${constantId}/copy`, data)

export interface ConstantCodenameEntry {
    id: string
    codename: string
    codenameLocalized?: Record<string, unknown> | null
}

export const listAllConstantCodenames = async (metahubId: string, setId: string): Promise<{ items: ConstantCodenameEntry[] }> => {
    const response = await apiClient.get<{ items: ConstantCodenameEntry[] }>(`/metahub/${metahubId}/set/${setId}/constant-codenames`)
    return response.data
}
