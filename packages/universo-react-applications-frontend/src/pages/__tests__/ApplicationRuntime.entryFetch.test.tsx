import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const fetchMocks = vi.hoisted(() => ({
    getPublicApplicationRuntime: vi.fn()
}))

vi.mock('../../api/publicApplicationRuntime', async () => {
    const actual = await vi.importActual<typeof import('../../api/publicApplicationRuntime')>('../../api/publicApplicationRuntime')
    return {
        ...actual,
        getPublicApplicationRuntime: fetchMocks.getPublicApplicationRuntime
    }
})

vi.mock('../../api/applications', () => ({
    resolveApplicationRuntimeReference: vi.fn(),
    getApplicationEffectiveLayout: vi.fn()
}))

vi.mock('@universo-react/auth-frontend', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/auth-frontend')>('@universo-react/auth-frontend')
    return {
        ...actual,
        useAuth: () => ({ isAuthenticated: false, loading: false })
    }
})

vi.mock('@universo-react/apps-template-mui', () => ({
    AppMainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    getRuntimeLayoutErrorCode: () => null,
    MarketingRuntimeContent: () => <div data-testid='public-marketing-runtime'>marketing</div>,
    RuntimeWorkspacesPage: () => <div data-testid='runtime-workspaces-page' />
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, options?: string | { defaultValue?: string }) =>
            typeof options === 'string' ? options : options?.defaultValue ?? key,
        i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: vi.fn() }
    })
}))

import { ApplicationRuntimeEntry } from '../ApplicationRuntimeEntry'

const APP_ID = '018f8a78-7b8f-7c1d-a111-222233334444'
const heroData = {
    records: [
        {
            kind: 'heroContent',
            semanticKey: 'content',
            order: 0,
            isVisible: true,
            content: {
                title: { en: 'Welcome' },
                description: { en: 'A typed marketing page.' },
                emailLabel: { en: 'Email' },
                emailPlaceholder: { en: 'you@example.test' },
                primaryActionLabel: { en: 'Join' },
                primaryAction: { kind: 'internal', path: '/join' }
            }
        }
    ]
}

const publicPayload = () => ({
    route: {
        applicationId: APP_ID,
        matchedBy: 'uuid' as const,
        matchedAlias: null,
        routingMode: 'direct' as const,
        primaryAlias: null,
        canonicalAlias: null
    },
    templateKey: 'marketing-page' as const,
    marketingPage: {
        widgets: [
            {
                instanceKey: 'hero',
                zone: 'marketing-main',
                sortOrder: 1,
                isActive: true,
                widgetKey: 'marketing.hero',
                config: {},
                data: heroData
            }
        ]
    }
})

describe('ApplicationRuntimeEntry anonymous bootstrap fetching', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches the shared public bootstrap exactly once across the entry and the rendered page', async () => {
        fetchMocks.getPublicApplicationRuntime.mockResolvedValue(publicPayload())
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[`/a/${APP_ID}?locale=en`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <Routes>
                        <Route path='/a/:applicationId/*' element={<ApplicationRuntimeEntry />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(fetchMocks.getPublicApplicationRuntime).toHaveBeenCalledTimes(1)
    })
})
