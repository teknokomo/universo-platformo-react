import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OnboardingWizard } from '../../components/OnboardingWizard'
import type { OnboardingItems, OnboardingCatalogItem } from '../../types'
import type { VersionedLocalizedContent } from '@universo/types'

// Stable references to avoid re-triggering useEffect on each render
const stableT = (key: string) => key
const stableI18n = { language: 'en' }
const stableTranslation = { t: stableT, i18n: stableI18n }

vi.mock('react-i18next', () => ({
    useTranslation: () => stableTranslation
}))

vi.mock('../../api/onboarding', () => ({
    getOnboardingItems: vi.fn(),
    syncSelections: vi.fn()
}))

import { getOnboardingItems, syncSelections } from '../../api/onboarding'

const vlc = (en: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: '2024-12-06T00:00:00.000Z', updatedAt: '2024-12-06T00:00:00.000Z' }
    }
})

const makeMockItem = (id: string, codename: string, label: string): OnboardingCatalogItem => ({
    id,
    codename,
    name: vlc(label),
    description: vlc('Desc'),
    sortOrder: 1,
    isSelected: false
})

const mockItemsData: OnboardingItems = {
    onboardingCompleted: false,
    goals: [makeMockItem('g-1', 'goal_one', 'Goal One')],
    topics: [makeMockItem('t-1', 'topic_one', 'Topic One')],
    features: [makeMockItem('f-1', 'feature_one', 'Feature One')]
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getOnboardingItems).mockResolvedValue(mockItemsData)
    vi.mocked(syncSelections).mockResolvedValue({
        success: true,
        added: { goals: 0, topics: 0, features: 0 },
        removed: { goals: 0, topics: 0, features: 0 }
    })
})

describe('OnboardingWizard', () => {
    it('renders welcome step initially', async () => {
        render(<OnboardingWizard />)
        await waitFor(() => {
            expect(screen.getByText('welcome.title')).toBeDefined()
        })
    })

    it('loads onboarding items on mount', async () => {
        render(<OnboardingWizard />)
        await waitFor(() => {
            expect(getOnboardingItems).toHaveBeenCalledTimes(1)
        })
    })

    it('uses preloaded items without issuing another fetch', async () => {
        render(<OnboardingWizard initialItems={mockItemsData} />)

        await screen.findByText('welcome.title')
        expect(getOnboardingItems).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('Goal One')
    })

    it('navigates through steps with Next button', async () => {
        render(<OnboardingWizard />)

        // Wait for loading to complete
        await screen.findByText('welcome.title')

        // Welcome → Goals
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.goals.title')

        // Goals → Topics
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.topics.title')

        // Topics → Features
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.features.title')
    })

    it('syncs selections before entering the completion step', async () => {
        render(<OnboardingWizard />)

        await screen.findByText('welcome.title')

        // Navigate to features step
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.goals.title')
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.topics.title')
        fireEvent.click(screen.getByText('buttons.next'))
        await screen.findByText('steps.features.title')

        // Click next on features step to enter completion (sync only)
        fireEvent.click(screen.getByText('buttons.next'))

        await waitFor(() => {
            expect(syncSelections).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByText('completion.title')).toBeDefined()
    })

    it('shows error on API failure', async () => {
        vi.mocked(getOnboardingItems).mockRejectedValueOnce(new Error('Network error'))
        render(<OnboardingWizard />)

        await waitFor(() => {
            expect(screen.getByText('errors.loadFailed')).toBeDefined()
        })
    })

    it('calls onComplete callback only from the final CTA', async () => {
        const onComplete = vi.fn()
        render(<OnboardingWizard onComplete={onComplete} />)

        await screen.findByText('welcome.title')

        // Navigate through all steps to completion
        fireEvent.click(screen.getByText('buttons.next')) // welcome → goals
        await screen.findByText('steps.goals.title')
        fireEvent.click(screen.getByText('buttons.next')) // goals → topics
        await screen.findByText('steps.topics.title')
        fireEvent.click(screen.getByText('buttons.next')) // topics → features
        await screen.findByText('steps.features.title')
        fireEvent.click(screen.getByText('buttons.next')) // features → completion

        await screen.findByText('buttons.startActing')
        expect(onComplete).not.toHaveBeenCalled()

        fireEvent.click(screen.getByText('buttons.startActing'))

        await waitFor(() => {
            expect(onComplete).toHaveBeenCalledTimes(1)
        })
    })
})
