import apiClient from './apiClient'
import type { OnboardingItems, JoinItemsRequest, JoinItemsResponse } from '../types'

/**
 * Fetch all available onboarding items
 * Returns Projects (Global Goals), Campaigns (Personal Interests), Clusters (Platform Features)
 */
export const getOnboardingItems = async (): Promise<OnboardingItems> => {
    const response = await apiClient.get<OnboardingItems>('/onboarding/items')
    return response.data
}

/**
 * Join selected items as member
 */
export const joinItems = async (data: JoinItemsRequest): Promise<JoinItemsResponse> => {
    const response = await apiClient.post<JoinItemsResponse>('/onboarding/join', data)
    return response.data
}
