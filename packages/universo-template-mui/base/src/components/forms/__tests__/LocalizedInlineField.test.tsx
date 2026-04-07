import React from 'react'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createLocalizedContent } from '@universo/utils'
import { LocalizedInlineField } from '../LocalizedInlineField'

jest.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('LocalizedInlineField', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                locales: [
                    { code: 'en', label: 'English', isDefault: true },
                    { code: 'ru', label: 'Русский', isDefault: false }
                ],
                defaultLocale: 'en'
            })
        }) as jest.Mock
    })

    it('keeps the primary locale badge inside the field row bounds', () => {
        renderWithProviders(
            <LocalizedInlineField
                mode='localized'
                label='Name'
                value={createLocalizedContent('en', 'Name')}
                onChange={jest.fn()}
            />
        )

        const row = screen.getByTestId('localized-inline-row-en')
        const badge = screen.getByTestId('localized-inline-badge-en')

        expect(parseFloat(window.getComputedStyle(row).paddingTop)).toBeGreaterThan(0)
        expect(parseFloat(window.getComputedStyle(row).paddingRight)).toBeGreaterThan(0)
        expect(window.getComputedStyle(badge).top).toBe('0px')
        expect(window.getComputedStyle(badge).right).toBe('0px')
    })
})