import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PUBLIC_APPLICATION_RUNTIME_ERROR_CODE } from '@universo-react/types'
import type { ReactNode } from 'react'

const entryMocks = vi.hoisted(() => ({
    getPublicApplicationRuntime: vi.fn(),
    resolveApplicationRuntimeReference: vi.fn(),
    isAuthenticated: false,
    authLoading: false
}))

vi.mock('../../api/publicApplicationRuntime', async () => {
    const actual = await vi.importActual<typeof import('../../api/publicApplicationRuntime')>('../../api/publicApplicationRuntime')
    return {
        ...actual,
        getPublicApplicationRuntime: entryMocks.getPublicApplicationRuntime
    }
})

vi.mock('../../api/applications', () => ({
    resolveApplicationRuntimeReference: entryMocks.resolveApplicationRuntimeReference,
    getApplicationEffectiveLayout: vi.fn()
}))

vi.mock('@universo-react/auth-frontend', () => ({
    useAuth: () => ({
        isAuthenticated: entryMocks.isAuthenticated,
        loading: entryMocks.authLoading
    })
}))

vi.mock('../ApplicationRuntime', () => ({
    default: ({ applicationIdOverride }: { applicationIdOverride?: string }) => (
        <div data-testid='authenticated-runtime'>{applicationIdOverride}</div>
    ),
    PublicApplicationRuntime: () => <div data-testid='public-runtime' />
}))

vi.mock('../../components/ApplicationGuard', () => ({
    ApplicationGuard: ({ children, applicationIdOverride }: { children: ReactNode; applicationIdOverride?: string }) => (
        <div data-testid='application-guard' data-application-id={applicationIdOverride}>
            {children}
        </div>
    )
}))

vi.mock('../../components/ApplicationMigrationGuard', () => ({
    default: ({ children, applicationIdOverride }: { children: ReactNode; applicationIdOverride?: string }) => (
        <div data-testid='application-migration-guard' data-application-id={applicationIdOverride}>
            {children}
        </div>
    )
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: string | { defaultValue?: string }) =>
            typeof options === 'string' ? options : options?.defaultValue ?? key,
        i18n: { language: 'en', resolvedLanguage: 'en', changeLanguage: vi.fn() }
    })
}))

import { PublicApplicationRuntimeError } from '../../api/publicApplicationRuntime'
import { ApplicationRuntimeEntry } from '../ApplicationRuntimeEntry'

const APP_ID = '018f8a78-7b8f-7c1d-a111-222233334444'
const OTHER_APP_ID = '018f8a78-7b8f-7c1d-a111-222233335555'

const unavailableError = () => new PublicApplicationRuntimeError(404, PUBLIC_APPLICATION_RUNTIME_ERROR_CODE)

const AuthPageProbe = () => {
    const location = useLocation()
    const from = (location.state as { from?: string } | null)?.from ?? ''
    return <div data-testid='auth-page' data-from={from} />
}

const renderEntry = (route: string) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path='/a/:applicationId/*' element={<ApplicationRuntimeEntry />} />
                    <Route path='/auth' element={<AuthPageProbe />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )

    return { ...result, queryClient }
}

describe('ApplicationRuntimeEntry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        entryMocks.isAuthenticated = false
        entryMocks.authLoading = false
    })

    it('renders the anonymous public runtime for a ready public reference and never calls the authenticated resolver', async () => {
        entryMocks.getPublicApplicationRuntime.mockResolvedValue({})

        renderEntry('/a/public-app?locale=en')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })

    it('redirects anonymous visitors to the login page for every unavailable reference', async () => {
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())

        renderEntry(`/a/${APP_ID}`)

        // Closed, archived, unpublished and unknown references share one
        // redirect target, so the login page never discloses which private
        // resource exists.
        expect(await screen.findByTestId('auth-page')).toBeInTheDocument()
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
    })

    it('redirects anonymous visitors for an unknown alias reference as well', async () => {
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())

        renderEntry('/a/this-alias-does-not-exist')

        expect(await screen.findByTestId('auth-page')).toBeInTheDocument()
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
    })

    it('keeps the deep-link path, query and anchor in the login redirect state', async () => {
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())

        renderEntry('/a/private-app?locale=ru#pricing')

        const authPage = await screen.findByTestId('auth-page')
        // AuthPage navigates back to `state.from` after login; dropping the hash
        // would land the authenticated member at the wrong page position.
        expect(authPage).toHaveAttribute('data-from', '/a/private-app?locale=ru#pricing')
    })

    it('keeps the settled runtime branch during a background refetch', async () => {
        entryMocks.getPublicApplicationRuntime.mockResolvedValue({})
        const { queryClient } = renderEntry('/a/public-app?locale=en')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()

        // A background refetch that flips the query back to pending must not
        // unmount the live runtime tree; the settled branch stays until the
        // refetch actually resolves.
        entryMocks.getPublicApplicationRuntime.mockImplementation(() => new Promise(() => undefined))
        await act(async () => {
            void queryClient.refetchQueries()
        })

        expect(screen.getByTestId('public-runtime')).toBeInTheDocument()
        expect(screen.queryByTestId('auth-page')).not.toBeInTheDocument()
    })

    it('enters the authenticated guard/runtime path for an authenticated alias after the generic unavailable outcome', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())
        entryMocks.resolveApplicationRuntimeReference.mockResolvedValue({ applicationId: OTHER_APP_ID })

        renderEntry('/a/private-alias')

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(OTHER_APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith('private-alias')
        expect(screen.getByTestId('application-guard')).toHaveAttribute('data-application-id', OTHER_APP_ID)
        expect(screen.getByTestId('application-migration-guard')).toHaveAttribute('data-application-id', OTHER_APP_ID)
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
    })

    it('uses the UUID reference directly for the authenticated path without alias resolution', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())

        renderEntry(`/a/${APP_ID}`)

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
    })

    it('falls back to the public unavailable page when the authenticated resolver cannot resolve the alias', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())
        entryMocks.resolveApplicationRuntimeReference.mockRejectedValue(new Error('not found'))

        renderEntry('/a/unknown-alias')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })

    it('keeps retryable transient failures on the public retry state even for authenticated users', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(
            new PublicApplicationRuntimeError(503, 'PUBLIC_APPLICATION_RUNTIME_FAILED')
        )

        renderEntry('/a/private-alias')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
    })
})
