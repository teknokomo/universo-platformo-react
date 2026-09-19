import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    fetchMarketingPageRuntime: vi.fn(),
    normalizeMarketingPageRuntime: vi.fn()
}))

vi.mock('../../api/api', () => ({
    fetchMarketingPageRuntime: mocks.fetchMarketingPageRuntime
}))

vi.mock('../normalize', () => ({
    normalizeMarketingPageRuntime: mocks.normalizeMarketingPageRuntime
}))

vi.mock('../MarketingPage', () => ({
    default: () => <div data-testid='marketing-page'>Marketing page</div>
}))

vi.mock('../../layouts/AppMainLayout', async () => {
    const React = await import('react')
    return {
        AppMainLayoutContext: React.createContext(null),
        default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    }
})

import MarketingRuntimeContent from '../MarketingRuntimeContent'

describe('MarketingRuntimeContent injected runtime transport', () => {
    beforeEach(() => {
        mocks.fetchMarketingPageRuntime.mockReset()
        mocks.normalizeMarketingPageRuntime.mockReset()
        mocks.normalizeMarketingPageRuntime.mockReturnValue({
            templateKey: 'marketing-page',
            locale: 'en',
            config: {},
            widgets: []
        })
    })

    it('renders a server-authorized payload without calling the authenticated runtime endpoint', async () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const runtimePayload = { templateKey: 'marketing-page', marketingPage: {} } as never

        render(
            <QueryClientProvider client={queryClient}>
                <MarketingRuntimeContent
                    applicationId='0190a9b5-3cde-7abc-8def-0123456789ab'
                    locale='en'
                    apiBaseUrl='/api/v1'
                    effectiveLayoutWidgets={[]}
                    loadingLabel='Loading'
                    errorLabel='Error'
                    retryLabel='Retry'
                    runtimePayload={runtimePayload}
                />
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('marketing-page')).toBeInTheDocument()
        expect(mocks.normalizeMarketingPageRuntime).toHaveBeenCalledWith(runtimePayload, 'en')
        expect(mocks.fetchMarketingPageRuntime).not.toHaveBeenCalled()
    })
})
