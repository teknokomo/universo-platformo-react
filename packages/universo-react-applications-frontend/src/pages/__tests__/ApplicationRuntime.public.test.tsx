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
        headerPosition: 'fixed' as const,
        headerWidgets: [],
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
        expect(publicRuntimeMocks.getPublicApplicationRuntime).toHaveBeenCalledWith('secondary', 'ru', undefined)
        expect(publicRuntimeMocks.getApplicationEffectiveLayout).not.toHaveBeenCalled()
        expect(publicRuntimeMocks.marketingProps?.effectiveLayoutWidgets).toEqual([])
        expect(publicRuntimeMocks.marketingProps).toMatchObject({
            applicationId: 'secondary',
            locale: 'ru',
            apiBaseUrl: '/api/v1',
            effectiveLayoutConfig: {
                templateKey: 'marketing-page',
                zoneSettings: { 'marketing-header': { position: 'fixed' } }
            }
        })
        expect(publicRuntimeMocks.marketingProps?.runtimePayload).toEqual({
            templateKey: 'marketing-page',
            marketingPage: publicPayload('secondary').marketingPage
        })
        expect(publicRuntimeMocks.marketingProps).not.toHaveProperty('workspaceId')
    })

    it('passes the allowlisted public header position to the isolated marketing renderer', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockResolvedValue({
            ...publicPayload('secondary'),
            marketingPage: { ...publicPayload('secondary').marketingPage, headerPosition: 'flow' }
        })

        renderPublicRuntime('/a/secondary?locale=en')

        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
        expect(publicRuntimeMocks.marketingProps).toMatchObject({
            effectiveLayoutConfig: {
                templateKey: 'marketing-page',
                zoneSettings: { 'marketing-header': { position: 'flow' } }
            }
        })
    })

    it('requests an anonymous entity-scoped runtime using the target from the visitor URL', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockResolvedValue(publicPayload('secondary'))
        const entityTypeId = '0190a9b5-3cde-7abc-8def-0123456789ac'

        renderPublicRuntime(`/a/secondary?targetKind=object&entityTypeId=${entityTypeId}&locale=en`)

        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
        expect(publicRuntimeMocks.getPublicApplicationRuntime).toHaveBeenCalledWith('secondary', 'en', {
            targetKind: 'object',
            entityTypeId
        })
    })

    it('sends a fail-closed target when a visitor URL repeats an entity selector', async () => {
        publicRuntimeMocks.getPublicApplicationRuntime.mockResolvedValue(publicPayload('secondary'))

        renderPublicRuntime(
            '/a/secondary?targetKind=object&entityTypeId=0190a9b5-3cde-7abc-8def-0123456789ac&entityTypeId=0190a9b5-3cde-7abc-8def-0123456789ad'
        )

        expect(await screen.findByTestId('public-marketing-runtime')).toBeInTheDocument()
        expect(publicRuntimeMocks.getPublicApplicationRuntime).toHaveBeenCalledWith('secondary', 'en', {
            targetKind: 'object',
            entityTypeId: ''
        })
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
