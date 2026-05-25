import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOnboardingItems, syncSelections, completeOnboarding } from '../../api/onboarding'

vi.mock('../../api/apiClient', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn()
    }
}))

import apiClient from '../../api/apiClient'

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)

beforeEach(() => {
    vi.clearAllMocks()
})

describe('onboarding API', () => {
    describe('getOnboardingItems', () => {
        it('calls GET /onboarding/items and returns data', async () => {
            const mockData = {
                onboardingCompleted: false,
                goals: [],
                topics: [],
                features: []
            }
            mockGet.mockResolvedValue({ data: mockData })

            const result = await getOnboardingItems()
            expect(mockGet).toHaveBeenCalledWith('/onboarding/items')
            expect(result).toEqual(mockData)
        })
    })

    describe('syncSelections', () => {
        it('sends POST /onboarding/selections with correct payload', async () => {
            const payload = { goals: ['g-1'], topics: [], features: ['f-1'] }
            const mockResponse = {
                success: true,
                added: { goals: 1, topics: 0, features: 1 },
                removed: { goals: 0, topics: 0, features: 0 }
            }
            mockPost.mockResolvedValue({ data: mockResponse })

            const result = await syncSelections(payload)
            expect(mockPost).toHaveBeenCalledWith('/onboarding/selections', payload)
            expect(result).toEqual(mockResponse)
        })
    })

    describe('completeOnboarding', () => {
        it('sends POST /onboarding/complete', async () => {
            const mockResponse = { success: true, onboardingCompleted: true }
            mockPost.mockResolvedValue({ data: mockResponse })

            const result = await completeOnboarding()
            expect(mockPost).toHaveBeenCalledWith('/onboarding/complete')
            expect(result).toEqual(mockResponse)
        })
    })
})
