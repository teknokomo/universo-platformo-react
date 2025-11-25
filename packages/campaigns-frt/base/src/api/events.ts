import apiClient, { extractPaginationMeta } from './apiClient'
import { Event, Activity, PaginationParams, PaginatedResponse } from '../types'

// Updated listEvents with pagination support
export const listEvents = async (params?: PaginationParams): Promise<PaginatedResponse<Event>> => {
    const response = await apiClient.get<Event[]>('/events', {
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

export const getEvent = (id: string) => apiClient.get<Event>(`/events/${id}`)

export const createEvent = (data: { name: string; description?: string; campaignId: string }) => apiClient.post<Event>('/events', data)

export const updateEvent = (id: string, data: { name: string; description?: string }) => apiClient.put<Event>(`/events/${id}`, data)

export const deleteEvent = (id: string) => apiClient.delete<void>(`/events/${id}`)

// Event-Activity relationships
export const getEventActivities = (eventId: string) => apiClient.get<Activity[]>(`/events/${eventId}/activities`)

export const addActivityToEvent = (eventId: string, activityId: string) =>
    apiClient.post<void>(`/events/${eventId}/activities/${activityId}`)

export const assignActivityToEvent = (activityId: string, eventId: string) =>
    apiClient.put<void>(`/activities/${activityId}/event`, { eventId })

export const removeActivityFromEvent = (activityId: string) => apiClient.delete<void>(`/activities/${activityId}/event`)
