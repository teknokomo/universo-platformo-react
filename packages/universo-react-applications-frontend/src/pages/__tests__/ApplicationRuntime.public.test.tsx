import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PUBLIC_APPLICATION_RUNTIME_ERROR_CODE } from '@universo-react/types'

const publicRuntimeMocks = vi.hoisted(() => ({
    getPublicApplicationRuntime: vi.fn(),
    getApplicationEffectiveLayout: vi.fn(),
    marketingProps: null as Record<string, unknown> | null
}))

vi.mock('../../api/publicApplicationRuntime', async () => {
    const actual = await vi.importActual<typeof import('../../api/publicApplicationRuntime')>('../../api/publicApplicationRuntime')
    return {
        ...actual,
        getPublicApplicationRuntime: publicRuntimeMocks.getPublicApplicationRuntime
    }
})

vi.mock('../../api/applications', () => ({
    getApplicationEffectiveLayout: publicRuntimeMocks.getApplicationEffectiveLayout
}))

vi.mock('../application-runtime/DashboardApplicationRuntime', () => ({
    DashboardApplicationRuntime: () => <div data-testid='dashboard-runtime' />
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: string | { defaultValue?: string }) =>
            ({ 'app.errors.applicationUnavailable': 'Application is currently unavailable.' }[key] ??
            (typeof options === 'string' ? options : options?.defaultValue ?? key)),
        i18n: {
            language: 'en',
            resolvedLanguage: 'en',
            changeLanguage: vi.fn()
        }
    })
}))

vi.mock('@universo-react/apps-template-mui', () => ({
    AppMainLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
    getRuntimeLayoutErrorCode: () => null,
    MarketingRuntimeContent: (props: Record<string, unknown>) => {
        publicRuntimeMocks.marketingProps = props
        return <div data-testid='public-marketing-runtime'>marketing</div>
    },
    RuntimeWorkspacesPage: () => <div data-testid='runtime-workspaces-page' />
}))

import { PublicApplicationRuntimeError } from '../../api/publicApplicationRuntime'
import { PublicApplicationRuntime } from '../ApplicationRuntime'

const APP_ID = '018f8a78-7b8f-7c1d-a111-222233334444'

const publicPayload = (matchedAlias: string, canonicalAlias: string | null = null) => ({
    route: {
        applicationId: APP_ID,
        matchedBy: 'alias' as const,
        matchedAlias,
        routingMode: canonicalAlias ? ('canonical' as const) : ('direct' as const),
        primaryAlias: canonicalAlias ?? matchedAlias,
        canonicalAlias
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
                data: { records: [] }
            }
        ]
    }
})

const LocationProbe = () => {
    const location = useLocation()
    return <div data-testid='location-probe'>{`${location.pathname}${location.search}${location.hash}`}</div>
}

const renderPublicRuntime = (route: string) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false }
        }
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route
                        path='/a/:applicationId/*'
                        element={
                            <>
                                <PublicApplicationRuntime />
                                <LocationProbe />
                            </>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('PublicApplicationRuntime', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        publicRuntimeMocks.marketingProps = null
    })

    it('renders a direct alias through the injected public payload without authenticated layout transport', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockResolvedValue(publicPayload('secondary'))

        renderPublicRuntime('/a/secondary?locale=ru')

        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
        expect(publicRuntimeMocks.getPublicApplicationRuntime).toHaveBeenCalledWith('secondary', 'ru')
        expect(publicRuntimeMocks.getApplicationEffectiveLayout).not.toHaveBeenCalled()
        expect(publicRuntimeMocks.marketingProps).toMatchObject({
            applicationId: 'secondary',
            locale: 'ru',
            apiBaseUrl: '/api/v1'
        })
        expect(publicRuntimeMocks.marketingProps?.runtimePayload).toEqual({
            templateKey: 'marketing-page',
            marketingPage: publicPayload('secondary').marketingPage
        })
        expect(publicRuntimeMocks.marketingProps).not.toHaveProperty('workspaceId')
    })

    it('replaces a canonical secondary alias while preserving the remaining path and query', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime
            .mockResolvedValueOnce(publicPayload('secondary', 'primary'))
            .mockResolvedValueOnce(publicPayload('primary'))

        renderPublicRuntime('/a/secondary/section/details?locale=ru&section=details')

        await waitFor(() => {
            expect(screen.getByTestId('location-probe')).toHaveTextContent('/a/primary/section/details?locale=ru&section=details')
        })
        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
    })

    it('replaces a canonical secondary alias while preserving the visitor anchor', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime
            .mockResolvedValueOnce(publicPayload('secondary', 'primary'))
            .mockResolvedValueOnce(publicPayload('primary'))

        renderPublicRuntime('/a/secondary/section/details?locale=ru#pricing')

        await waitFor(() => {
            expect(screen.getByTestId('location-probe')).toHaveTextContent('/a/primary/section/details?locale=ru#pricing')
        })
        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
    })

    it('shows the neutral unavailable state for unresolved references without automatic navigation', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockRejectedValue(
            new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)
        )

        renderPublicRuntime('/a/private-app?locale=en')

        expect(await screen.findByRole('alert')).toHaveTextContent('Application is currently unavailable.')
        expect(screen.getByRole('button', { name: 'Go home' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
        expect(screen.getByTestId('location-probe')).toHaveTextContent('/a/private-app?locale=en')
        expect(screen.getByTestId('location-probe')).not.toHaveTextContent('/auth')
    })

    it('keeps an unavailable UUID on the anonymous public pipeline without authenticated transport', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockRejectedValue(
            new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)
        )

        renderPublicRuntime(`/a/${APP_ID}`)

        expect(await screen.findByRole('alert')).toHaveTextContent('Application is currently unavailable.')
        expect(publicRuntimeMocks.getApplicationEffectiveLayout).not.toHaveBeenCalled()
    })
})
