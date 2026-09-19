import type { PaginationParams, PaginatedResponse } from '../types'
import apiClient from './apiClient'

export type ApplicationAliasRoutingMode = 'direct' | 'canonical'

export interface ApplicationAliasItem {
    id: string
    applicationId: string
    alias: string
    isPrimary: boolean
    releasedAt?: string | null
    applicationName?: string
    applicationContext?: string | null
    routingMode: ApplicationAliasRoutingMode
    status?: 'active' | 'inactive' | 'released'
}

export interface ApplicationAliasApplicationOption {
    id: string
    name: unknown
    /** Localized admin-safe context (application description) used as the selector disambiguator. */
    context?: string | null
}

export interface ApplicationAliasPolicy {
    applicationId: string
    routingMode: ApplicationAliasRoutingMode
}

export interface ApplicationAliasListParams extends PaginationParams {
    applicationId?: string
    includeReleased?: boolean
    /** Preferred display locale for human application labels resolved server-side. */
    locale?: 'en' | 'ru'
}

export interface CreateApplicationAliasInput {
    applicationId: string
    alias: string
    makePrimary?: boolean
}

export interface RenameApplicationAliasInput {
    alias: string
}

function toPaginatedResponse<T>(data: { items: T[]; total: number; limit: number; offset: number }): PaginatedResponse<T> {
    return {
        items: data.items,
        pagination: {
            total: data.total,
            limit: data.limit,
            offset: data.offset,
            count: data.items.length,
            hasMore: data.offset + data.items.length < data.total
        }
    }
}

export const listApplicationAliases = async (params?: ApplicationAliasListParams): Promise<PaginatedResponse<ApplicationAliasItem>> => {
    const response = await apiClient.get<{ items: ApplicationAliasItem[]; total: number; limit: number; offset: number }>(
        '/application-aliases',
        {
            params: {
                limit: params?.limit,
                offset: params?.offset,
                sortBy: params?.sortBy,
                sortOrder: params?.sortOrder,
                search: params?.search,
                applicationId: params?.applicationId,
                includeReleased: params?.includeReleased,
                locale: params?.locale
            }
        }
    )

    return toPaginatedResponse(response.data)
}

export const listAliasesByApplication = async (applicationId: string): Promise<ApplicationAliasItem[]> => {
    const response = await apiClient.get<{ items: ApplicationAliasItem[] }>(`/applications/${applicationId}/aliases`)
    return response.data.items
}

export const getApplicationAliasPolicy = async (applicationId: string): Promise<ApplicationAliasPolicy> => {
    const response = await apiClient.get<ApplicationAliasPolicy>(`/applications/${applicationId}/aliases/policy`)
    return response.data
}

export const createApplicationAlias = async (input: CreateApplicationAliasInput): Promise<ApplicationAliasItem> => {
    const response = await apiClient.post<ApplicationAliasItem>('/application-aliases', input)
    return response.data
}

export const renameApplicationAlias = async (aliasId: string, input: RenameApplicationAliasInput): Promise<ApplicationAliasItem> => {
    const response = await apiClient.patch<ApplicationAliasItem>(`/application-aliases/${aliasId}`, input)
    return response.data
}

export const setPrimaryApplicationAlias = async (aliasId: string): Promise<ApplicationAliasItem> => {
    const response = await apiClient.post<ApplicationAliasItem>(`/application-aliases/${aliasId}/primary`)
    return response.data
}

export const releaseApplicationAlias = async (aliasId: string): Promise<void> => {
    await apiClient.post(`/application-aliases/${aliasId}/release`)
}

export const setApplicationAliasPolicy = async (
    applicationId: string,
    routingMode: ApplicationAliasRoutingMode
): Promise<ApplicationAliasPolicy> => {
    const response = await apiClient.patch<ApplicationAliasPolicy>(`/applications/${applicationId}/aliases/policy`, { routingMode })
    return response.data
}

export const listAliasApplicationOptions = async (params?: {
    limit?: number
    offset?: number
    search?: string
    locale?: 'en' | 'ru'
}): Promise<PaginatedResponse<ApplicationAliasApplicationOption>> => {
    const response = await apiClient.get<{
        items: ApplicationAliasApplicationOption[]
        total: number
        limit: number
        offset: number
    }>('/application-aliases/application-options', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            search: params?.search,
            locale: params?.locale
        }
    })

    return toPaginatedResponse(response.data)
}

export const getApplicationAliasErrorCode = (error: unknown): string | null => {
    if (!error || typeof error !== 'object') return null
    const response = (error as { response?: { data?: unknown } }).response
    const data = response?.data
    if (!data || typeof data !== 'object') return null

    const record = data as Record<string, unknown>
    const errorValue = record.error
    if (typeof errorValue === 'string') return errorValue
    if (errorValue && typeof errorValue === 'object' && typeof (errorValue as Record<string, unknown>).code === 'string') {
        return (errorValue as Record<string, string>).code
    }
    if (typeof record.code === 'string') return record.code
    return null
}
