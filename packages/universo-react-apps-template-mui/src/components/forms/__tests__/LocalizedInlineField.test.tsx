import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@universo-react/i18n'
import { createLocalizedContent } from '@universo-react/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import { LocalizedInlineField } from '../LocalizedInlineField'

const renderWithQueryClient = (ui: ReactElement) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('LocalizedInlineField', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        void i18n.changeLanguage('en')
    })

    it('renders simple length constraints as localized helper text', () => {
        render(<LocalizedInlineField mode='simple' label='Title' value='' minLength={2} maxLength={10} onChange={vi.fn()} />)

        expect(screen.getByText('Length: 2-10 characters')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('min:')
        expect(document.body).not.toHaveTextContent('max:')
    })

    it('renders versioned length constraints as localized helper text', () => {
        render(
            <LocalizedInlineField
                mode='versioned'
                label='Description'
                value={createLocalizedContent('en', '')}
                maxLength={120}
                onChange={vi.fn()}
            />
        )

        expect(screen.getByText('Maximum length: 120 characters')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('max:')
    })

    it('renders localized min-length errors as user-facing helper text', () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({
                    defaultLocale: 'en',
                    locales: [
                        { code: 'en', label: 'English', isDefault: true },
                        { code: 'ru', label: 'Russian', isDefault: false }
                    ]
                })
            })
        )

        renderWithQueryClient(
            <LocalizedInlineField
                mode='localized'
                label='Summary'
                value={createLocalizedContent('en', 'abc')}
                minLength={5}
                onChange={vi.fn()}
            />
        )

        expect(screen.getByText('Minimum length: 5 characters')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('min:')
    })
})
