/**
 * Universo Platformo | Start Frontend Types
 */

/**
 * Single onboarding item (Project, Campaign, or Cluster)
 */
export interface OnboardingItem {
    id: string
    name: string
    description?: string
    isSelected: boolean
}

/**
 * All onboarding items returned from API
 */
export interface OnboardingItems {
    onboardingCompleted: boolean
    projects: OnboardingItem[]
    campaigns: OnboardingItem[]
    clusters: OnboardingItem[]
}

/**
 * Request to join selected items
 */
export interface JoinItemsRequest {
    projectIds: string[]
    campaignIds: string[]
    clusterIds: string[]
}

/**
 * Response from join endpoint
 */
export interface JoinItemsResponse {
    success: boolean
    added: {
        projects: number
        campaigns: number
        clusters: number
    }
    removed: {
        projects: number
        campaigns: number
        clusters: number
    }
    onboardingCompleted: boolean
}

/**
 * Onboarding wizard step
 */
export type OnboardingStep = 'welcome' | 'projects' | 'campaigns' | 'clusters' | 'completion'
