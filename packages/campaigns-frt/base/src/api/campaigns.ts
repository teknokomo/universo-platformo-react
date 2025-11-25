import apiClient, { extractPaginationMeta } from './apiClient'
import { Campaign, Event, Activity, CampaignMember, CampaignAssignableRole, PaginationParams, PaginatedResponse } from '../types'

// Updated listCampaigns with pagination support
export const listCampaigns = async (params?: PaginationParams): Promise<PaginatedResponse<Campaign>> => {
    const response = await apiClient.get<Campaign[]>('/campaigns', {
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

export const getCampaign = (id: string) => apiClient.get<Campaign>(`/campaigns/${id}`)

export const createCampaign = (data: { name: string; description?: string }) => apiClient.post<Campaign>('/campaigns', data)

export const updateCampaign = (id: string, data: { name: string; description?: string }) =>
    apiClient.put<Campaign>(`/campaigns/${id}`, data)

export const deleteCampaign = (id: string) => apiClient.delete<void>(`/campaigns/${id}`)

// Campaign-Activity relationships
export const getCampaignActivities = (campaignId: string) => apiClient.get<Activity[]>(`/campaigns/${campaignId}/activities`)

export const addActivityToCampaign = (campaignId: string, activityId: string) =>
    apiClient.post<void>(`/campaigns/${campaignId}/activities/${activityId}`)

export const removeActivityFromCampaign = (campaignId: string, activityId: string) =>
    apiClient.delete<void>(`/campaigns/${campaignId}/activities/${activityId}`)

export const reorderCampaignActivities = (campaignId: string, items: Array<{ activityId: string; sortOrder: number }>) =>
    apiClient.post<void>(`/campaigns/${campaignId}/activities/reorder`, { items })

// Campaign-Event relationships
export const getCampaignEvents = (campaignId: string) => apiClient.get<Event[]>(`/campaigns/${campaignId}/events`)

export const addEventToCampaign = (campaignId: string, eventId: string) =>
    apiClient.post<void>(`/campaigns/${campaignId}/events/${eventId}`)

// Updated listCampaignMembers with pagination support (matches backend changes)
export const listCampaignMembers = async (campaignId: string, params?: PaginationParams): Promise<PaginatedResponse<CampaignMember>> => {
    const response = await apiClient.get<CampaignMember[]>(`/campaigns/${campaignId}/members`, {
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

export const inviteCampaignMember = (campaignId: string, data: { email: string; role: CampaignAssignableRole; comment?: string }) =>
    apiClient.post<CampaignMember>(`/campaigns/${campaignId}/members`, data)

export const updateCampaignMemberRole = (campaignId: string, memberId: string, data: { role: CampaignAssignableRole; comment?: string }) =>
    apiClient.patch<CampaignMember>(`/campaigns/${campaignId}/members/${memberId}`, data)

export const removeCampaignMember = (campaignId: string, memberId: string) =>
    apiClient.delete<void>(`/campaigns/${campaignId}/members/${memberId}`)
