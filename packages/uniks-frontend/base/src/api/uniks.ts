import apiClient, { extractPaginationMeta } from './apiClient'
import { Unik, UnikMember, UnikAssignableRole, PaginationParams, PaginatedResponse } from '../types'

// Updated listUniks with pagination support
export const listUniks = async (params?: PaginationParams): Promise<PaginatedResponse<Unik>> => {
    const response = await apiClient.get<Unik[]>('/uniks', {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    return {
        items: response.data,
        pagination: extractPaginationMeta(response)
    }
}

// Singular base for individual Unik endpoints is "/unik" (server mounts createUnikIndividualRouter at /unik)
export const getUnik = (id: string) => apiClient.get<Unik>(`/unik/${id}`)

export const createUnik = (data: { name: string; description?: string }) => apiClient.post<Unik>('/uniks', data)

export const updateUnik = (id: string, data: { name: string; description?: string }) => apiClient.put<Unik>(`/unik/${id}`, data)

export const deleteUnik = (id: string) => apiClient.delete<void>(`/unik/${id}`)

// Updated listUnikMembers with pagination support (matches backend changes)
export const listUnikMembers = async (unikId: string, params?: PaginationParams): Promise<PaginatedResponse<UnikMember>> => {
    const response = await apiClient.get<UnikMember[]>(`/unik/${unikId}/members`, {
        params: {
            limit: params?.limit,
            offset: params?.offset,
            sortBy: params?.sortBy,
            sortOrder: params?.sortOrder,
            search: params?.search
        }
    })

    // Safe parsing fallback: if response.data is a string, try to parse it as JSON
    let parsedData: UnikMember[] = []
    let isArray = Array.isArray(response.data)

    if (!isArray && typeof response.data === 'string') {
        try {
            const parsed = JSON.parse(response.data)
            if (Array.isArray(parsed)) {
                parsedData = parsed
                isArray = true
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('[uniks][listUnikMembers] JSON parse error', e)
        }
    } else if (isArray) {
        parsedData = response.data
    }

    // Diagnostic log (temporary)
    // eslint-disable-next-line no-console
    console.log('[uniks][listUnikMembers] axios response', {
        unikId,
        status: response.status,
        contentType: response.headers['content-type'],
        headerSample: {
            xPaginationLimit: response.headers['x-pagination-limit'],
            xPaginationOffset: response.headers['x-pagination-offset'],
            xPaginationCount: response.headers['x-pagination-count'],
            xTotalCount: response.headers['x-total-count'],
            xPaginationHasMore: response.headers['x-pagination-has-more']
        },
        isArrayOriginal: Array.isArray(response.data),
        isArrayAfterParse: isArray,
        typeofOriginal: typeof response.data,
        length: parsedData.length,
        sample: parsedData.slice(0, 2)
    })

    return {
        items: parsedData,
        pagination: extractPaginationMeta(response)
    }
}

export const inviteUnikMember = (unikId: string, data: { email: string; role: UnikAssignableRole; comment?: string }) =>
    apiClient.post<UnikMember>(`/unik/${unikId}/members`, data)

export const updateUnikMemberRole = (unikId: string, memberId: string, data: { role: UnikAssignableRole; comment?: string }) =>
    apiClient.patch<UnikMember>(`/unik/${unikId}/members/${memberId}`, data)

export const removeUnikMember = (unikId: string, memberId: string) => apiClient.delete<void>(`/unik/${unikId}/members/${memberId}`)
