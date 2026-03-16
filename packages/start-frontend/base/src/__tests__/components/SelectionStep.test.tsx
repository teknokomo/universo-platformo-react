import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SelectionStep } from '../../components/SelectionStep'
import type { OnboardingCatalogItem } from '../../types'
import type { VersionedLocalizedContent } from '@universo/types'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: { language: 'en' }
    })
}))

const vlc = (en: string): VersionedLocalizedContent<string> => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true, createdAt: '2024-12-06T00:00:00.000Z', updatedAt: '2024-12-06T00:00:00.000Z' }
    }
})

const mockItems: OnboardingCatalogItem[] = [
    { id: '1', codename: 'goal_one', name: vlc('Goal One'), description: vlc('Description One'), sortOrder: 1, isSelected: false },
    { id: '2', codename: 'goal_two', name: vlc('Goal Two'), description: vlc('Description Two'), sortOrder: 2, isSelected: true }
]

describe('SelectionStep', () => {
    it('renders title and subtitle', () => {
        render(<SelectionStep title='Test Title' subtitle='Test Subtitle' items={[]} selectedIds={[]} onSelectionChange={vi.fn()} />)
        expect(screen.getByText('Test Title')).toBeDefined()
        expect(screen.getByText('Test Subtitle')).toBeDefined()
    })

    it('renders items via SelectableListCard', () => {
        render(<SelectionStep title='Goals' subtitle='Pick goals' items={mockItems} selectedIds={['2']} onSelectionChange={vi.fn()} />)
        expect(screen.getByText('Goal One')).toBeDefined()
        expect(screen.getByText('Goal Two')).toBeDefined()
    })

    it('splits multi-paragraph subtitles', () => {
        render(
            <SelectionStep
                title='Title'
                subtitle={'First paragraph\n\nSecond paragraph'}
                items={[]}
                selectedIds={[]}
                onSelectionChange={vi.fn()}
            />
        )
        expect(screen.getByText('First paragraph')).toBeDefined()
        expect(screen.getByText('Second paragraph')).toBeDefined()
    })
})
