import apiClient, { extractPaginationMeta } from './apiClient'
import { Activity, PaginationParams, PaginatedResponse } from '../types'

// Updated listActivities with pagination support
export const listActivities = async (params?: PaginationParams): Promise<PaginatedResponse<Activity>> => {
    const response = await apiClient.get<Activity[]>('/activities', {
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

export const getActivity = (activityId: string) => apiClient.get<Activity>(`/activities/${activityId}`)

export const createActivity = (data: { name: string; description?: string; campaignId?: string; eventId: string }) =>
    apiClient.post<Activity>('/activities', data)

export const updateActivity = (activityId: string, data: { name: string; description?: string }) =>
    apiClient.put<Activity>(`/activities/${activityId}`, data)

export const deleteActivity = (activityId: string) => apiClient.delete<void>(`/activities/${activityId}`)
