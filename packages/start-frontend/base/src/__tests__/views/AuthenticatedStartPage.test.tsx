import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AuthenticatedStartPage from '../../views/AuthenticatedStartPage'
import type { OnboardingItems } from '../../types'

vi.mock('../../api/onboarding', () => ({
    getOnboardingItems: vi.fn(),
    completeOnboarding: vi.fn()
}))

const navigateMock = vi.fn()
const refreshMock = vi.fn()
const refreshAbilityMock = vi.fn()
const mockAbility = null
let mockGlobalRoles: Array<{ codename: string; metadata: Record<string, unknown> }> = []

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock
    }
})

vi.mock('@universo/auth-frontend', () => ({
    useAuth: () => ({
        refresh: refreshMock
    })
}))

vi.mock('@universo/store', () => ({
    useAbility: () => ({
        refreshAbility: refreshAbilityMock,
        globalRoles: mockGlobalRoles,
        ability: mockAbility,
        isSuperuser: false
    })
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
    CompletionStep: ({
        onStartOver,
        onPrimaryAction,
        error
    }: {
        onStartOver?: () => void
        onPrimaryAction?: () => void
        error?: string | null
    }) => (
        <div>
            <div>completion-screen</div>
            <button onClick={onPrimaryAction}>start-acting</button>
            <button onClick={onStartOver}>start-over</button>
            {error ? <div>{error}</div> : null}
        </div>
    )
}))

vi.mock('../../components/StartFooter', () => ({
    StartFooter: () => <div>start-footer</div>
}))

import { completeOnboarding, getOnboardingItems } from '../../api/onboarding'

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
        mockGlobalRoles = []
        refreshMock.mockResolvedValue(null)
        refreshAbilityMock.mockResolvedValue(undefined)
        vi.mocked(completeOnboarding).mockResolvedValue({ success: true, onboardingCompleted: true })
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

    it('completes onboarding, refreshes auth state, and navigates when workspace access appears', async () => {
        vi.mocked(getOnboardingItems).mockResolvedValue(mockItems)
        refreshAbilityMock.mockImplementation(async () => {
            mockGlobalRoles = [{ codename: 'User', metadata: {} }]
        })

        render(<AuthenticatedStartPage />)

        await screen.findByTestId('wizard-props')
        fireEvent.click(screen.getByText('complete-onboarding'))

        await waitFor(() => {
            expect(completeOnboarding).toHaveBeenCalledTimes(1)
            expect(refreshMock).toHaveBeenCalledTimes(1)
            expect(refreshAbilityMock).toHaveBeenCalledTimes(1)
            expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
        })
    })

    it('navigates to HomeRouteResolver after completion even when only registered role remains', async () => {
        vi.mocked(getOnboardingItems).mockResolvedValue(mockItems)
        refreshAbilityMock.mockImplementation(async () => {
            mockGlobalRoles = [{ codename: 'Registered', metadata: {} }]
        })

        render(<AuthenticatedStartPage />)

        await screen.findByTestId('wizard-props')
        fireEvent.click(screen.getByText('complete-onboarding'))

        await waitFor(() => {
            expect(completeOnboarding).toHaveBeenCalledTimes(1)
            expect(refreshMock).toHaveBeenCalledTimes(1)
            expect(refreshAbilityMock).toHaveBeenCalledTimes(1)
            expect(navigateMock).toHaveBeenCalledWith('/', { replace: true })
        })
    })
})
