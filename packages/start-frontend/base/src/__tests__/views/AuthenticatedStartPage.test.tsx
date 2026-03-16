import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AuthenticatedStartPage from '../../views/AuthenticatedStartPage'
import type { OnboardingItems } from '../../types'

vi.mock('../../api/onboarding', () => ({
    getOnboardingItems: vi.fn()
}))

vi.mock('../../components/OnboardingWizard', () => ({
    OnboardingWizard: ({ initialItems, onComplete }: { initialItems: OnboardingItems | null; onComplete?: () => void }) => (
        <div>
            <div data-testid='wizard-props'>{initialItems?.goals[0]?.codename ?? 'no-items'}</div>
            <button onClick={onComplete}>complete-onboarding</button>
        </div>
    )
}))

vi.mock('../../components/CompletionStep', () => ({
    CompletionStep: ({ onStartOver }: { onStartOver?: () => void }) => (
        <div>
            <div>completion-screen</div>
            <button onClick={onStartOver}>start-over</button>
        </div>
    )
}))

vi.mock('../../components/StartFooter', () => ({
    StartFooter: () => <div>start-footer</div>
}))

import { getOnboardingItems } from '../../api/onboarding'

const mockItems: OnboardingItems = {
    onboardingCompleted: false,
    goals: [
        {
            id: 'g-1',
            codename: 'goal_one',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Goal One',
                        version: 1,
                        isActive: true,
                        createdAt: '2024-12-06T00:00:00.000Z',
                        updatedAt: '2024-12-06T00:00:00.000Z'
                    }
                }
            },
            description: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Desc',
                        version: 1,
                        isActive: true,
                        createdAt: '2024-12-06T00:00:00.000Z',
                        updatedAt: '2024-12-06T00:00:00.000Z'
                    }
                }
            },
            sortOrder: 1,
            isSelected: false
        }
    ],
    topics: [],
    features: []
}

describe('AuthenticatedStartPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes prefetched onboarding items into the wizard', async () => {
        vi.mocked(getOnboardingItems).mockResolvedValue(mockItems)

        render(<AuthenticatedStartPage />)

        await waitFor(() => {
            expect(screen.getByTestId('wizard-props').textContent).toBe('goal_one')
        })
        expect(getOnboardingItems).toHaveBeenCalledTimes(1)
    })

    it('shows the completion screen for already onboarded users and can reopen the wizard', async () => {
        vi.mocked(getOnboardingItems).mockResolvedValue({ ...mockItems, onboardingCompleted: true })

        render(<AuthenticatedStartPage />)

        await screen.findByText('completion-screen')
        fireEvent.click(screen.getByText('start-over'))

        await waitFor(() => {
            expect(screen.getByTestId('wizard-props').textContent).toBe('goal_one')
        })
    })

    it('falls back to the wizard if the status prefetch fails', async () => {
        vi.mocked(getOnboardingItems).mockRejectedValueOnce(new Error('prefetch failed'))

        render(<AuthenticatedStartPage />)

        await waitFor(() => {
            expect(screen.getByTestId('wizard-props').textContent).toBe('no-items')
        })
    })
})
