import apiClient from './apiClient'
import type { OnboardingItems, SyncSelectionsRequest, SyncSelectionsResponse, CompleteOnboardingResponse } from '../types'

export const getOnboardingItems = async (): Promise<OnboardingItems> => {
    const response = await apiClient.get<OnboardingItems>('/onboarding/items')
    return response.data
}

export const syncSelections = async (data: SyncSelectionsRequest): Promise<SyncSelectionsResponse> => {
    const response = await apiClient.post<SyncSelectionsResponse>('/onboarding/selections', data)
    return response.data
}

export const completeOnboarding = async (): Promise<CompleteOnboardingResponse> => {
    const response = await apiClient.post<CompleteOnboardingResponse>('/onboarding/complete')
    return response.data
}
