import type { FixedValueCopyOptions } from '@universo/types'
import type { FixedValue, FixedValueLocalizedPayload, PaginatedResponse, PaginationParams } from '../../../../../types'
import { apiClient } from '../../../../shared'

type FixedValueListParams = PaginationParams & { locale?: string; includeShared?: boolean; kindKey?: string }
type FixedValueListMeta = { totalAll?: number; limit?: number; limitReached?: boolean; includeShared?: boolean }
type FixedValueListResponse = PaginatedResponse<FixedValue> & { meta?: FixedValueListMeta }

const resolveSetKindKey = (kindKey?: string) => kindKey?.trim() || 'set'

const buildValueGroupInstancePath = (metahubId: string, valueGroupId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveSetKindKey(kindKey))}/instance/${valueGroupId}`

const buildContainerScopedValueGroupPath = (metahubId: string, treeEntityId: string, kindKey?: string) =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(resolveSetKindKey(kindKey))}/instance/${treeEntityId}/instance`

const mapListResponse = (response: {
    data: {
        items: FixedValue[]
        pagination: { total: number; limit: number; offset: number }
        meta?: FixedValueListMeta
    }
}): FixedValueListResponse => {
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

const buildListParams = (params?: FixedValueListParams) => ({
    limit: params?.limit,
    offset: params?.offset,
    sortBy: params?.sortBy,
    sortOrder: params?.sortOrder,
    search: params?.search,
    locale: params?.locale,
    includeShared: params?.includeShared,
    kindKey: params?.kindKey
})

export const listFixedValues = async (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    params?: FixedValueListParams
): Promise<FixedValueListResponse> => {
    const response = await apiClient.get<{
        items: FixedValue[]
        pagination: { total: number; limit: number; offset: number }
        meta?: FixedValueListMeta
    }>(`${buildContainerScopedValueGroupPath(metahubId, treeEntityId, params?.kindKey)}/${valueGroupId}/fixed-values`, {
        params: buildListParams(params)
    })
    return mapListResponse(response)
}

export const listFixedValuesDirect = async (
    metahubId: string,
    valueGroupId: string,
    params?: FixedValueListParams
): Promise<FixedValueListResponse> => {
    const response = await apiClient.get<{
        items: FixedValue[]
        pagination: { total: number; limit: number; offset: number }
        meta?: FixedValueListMeta
    }>(`${buildValueGroupInstancePath(metahubId, valueGroupId, params?.kindKey)}/fixed-values`, { params: buildListParams(params) })
    return mapListResponse(response)
}

export const getFixedValue = (metahubId: string, treeEntityId: string, valueGroupId: string, fixedValueId: string, kindKey?: string) =>
    apiClient.get<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/${valueGroupId}/fixed-value/${fixedValueId}`
    )

export const getFixedValueDirect = (metahubId: string, valueGroupId: string, fixedValueId: string, kindKey?: string) =>
    apiClient.get<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value/${fixedValueId}`)

export const createFixedValue = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    data: FixedValueLocalizedPayload & { kindKey?: string }
) =>
    apiClient.post<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, data.kindKey)}/${valueGroupId}/fixed-values`,
        data
    )

export const createFixedValueDirect = (metahubId: string, valueGroupId: string, data: FixedValueLocalizedPayload, kindKey?: string) =>
    apiClient.post<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-values`, data)

export const updateFixedValue = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    fixedValueId: string,
    data: FixedValueLocalizedPayload & { kindKey?: string }
) =>
    apiClient.patch<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, data.kindKey)}/${valueGroupId}/fixed-value/${fixedValueId}`,
        data
    )

export const updateFixedValueDirect = (
    metahubId: string,
    valueGroupId: string,
    fixedValueId: string,
    data: FixedValueLocalizedPayload,
    kindKey?: string
) => apiClient.patch<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value/${fixedValueId}`, data)

export const deleteFixedValue = (metahubId: string, treeEntityId: string, valueGroupId: string, fixedValueId: string, kindKey?: string) =>
    apiClient.delete<void>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/${valueGroupId}/fixed-value/${fixedValueId}`
    )

export const deleteFixedValueDirect = (metahubId: string, valueGroupId: string, fixedValueId: string, kindKey?: string) =>
    apiClient.delete<void>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value/${fixedValueId}`)

export const moveFixedValue = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    fixedValueId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/${valueGroupId}/fixed-value/${fixedValueId}/move`,
        { direction }
    )

export const moveFixedValueDirect = (
    metahubId: string,
    valueGroupId: string,
    fixedValueId: string,
    direction: 'up' | 'down',
    kindKey?: string
) =>
    apiClient.patch<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value/${fixedValueId}/move`, {
        direction
    })

export const reorderFixedValue = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    fixedValueId: string,
    newSortOrder: number,
    mergedOrderIds?: string[],
    kindKey?: string
) =>
    apiClient.patch<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/${valueGroupId}/fixed-values/reorder`,
        {
            fixedValueId,
            newSortOrder,
            ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds })
        }
    )

export const reorderFixedValueDirect = (
    metahubId: string,
    valueGroupId: string,
    fixedValueId: string,
    newSortOrder: number,
    mergedOrderIds?: string[],
    kindKey?: string
) =>
    apiClient.patch<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-values/reorder`, {
        fixedValueId,
        newSortOrder,
        ...(Array.isArray(mergedOrderIds) && mergedOrderIds.length > 0 && { mergedOrderIds })
    })

export type FixedValueCopyInput = Partial<FixedValueLocalizedPayload> & Partial<FixedValueCopyOptions>

export const copyFixedValue = (
    metahubId: string,
    treeEntityId: string,
    valueGroupId: string,
    fixedValueId: string,
    data: FixedValueCopyInput,
    kindKey?: string
) =>
    apiClient.post<FixedValue>(
        `${buildContainerScopedValueGroupPath(metahubId, treeEntityId, kindKey)}/${valueGroupId}/fixed-value/${fixedValueId}/copy`,
        data
    )

export const copyFixedValueDirect = (
    metahubId: string,
    valueGroupId: string,
    fixedValueId: string,
    data: FixedValueCopyInput,
    kindKey?: string
) => apiClient.post<FixedValue>(`${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value/${fixedValueId}/copy`, data)

export interface FixedValueCodenameEntry {
    id: string
    codename: Record<string, unknown> | string | null
}

export const listAllFixedValueCodenames = async (
    metahubId: string,
    valueGroupId: string,
    kindKey?: string
): Promise<{ items: FixedValueCodenameEntry[] }> => {
    const response = await apiClient.get<{ items: FixedValueCodenameEntry[] }>(
        `${buildValueGroupInstancePath(metahubId, valueGroupId, kindKey)}/fixed-value-codenames`
    )
    return response.data
}
