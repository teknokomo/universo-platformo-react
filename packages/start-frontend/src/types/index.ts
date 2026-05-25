/**
 * Universo Platformo | Start Frontend Types
 */

import type { VersionedLocalizedContent } from '@universo/types'

export interface OnboardingCatalogItem {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string>
    sortOrder: number
    isSelected: boolean
}

export interface OnboardingItems {
    onboardingCompleted: boolean
    goals: OnboardingCatalogItem[]
    topics: OnboardingCatalogItem[]
    features: OnboardingCatalogItem[]
}

export interface SyncSelectionsRequest {
    goals: string[]
    topics: string[]
    features: string[]
}

export interface SyncSelectionsResponse {
    success: boolean
    added: { goals: number; topics: number; features: number }
    removed: { goals: number; topics: number; features: number }
}

export interface CompleteOnboardingResponse {
    success: boolean
    onboardingCompleted: boolean
}

export type OnboardingStep = 'welcome' | 'goals' | 'topics' | 'features' | 'completion'
