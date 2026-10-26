import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { PUBLIC_APPLICATION_RUNTIME_ERROR_CODE } from '@universo-react/types'
import type { ReactNode } from 'react'
import { applicationsQueryKeys } from '../../api/queryKeys'

const entryMocks = vi.hoisted(() => ({
    getPublicApplicationRuntime: vi.fn(),
    resolveApplicationRuntimeReference: vi.fn(),
    isAuthenticated: false,
    authLoading: false,
    user: null as { id: string } | null
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
        loading: entryMocks.authLoading,
        user: entryMocks.user
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
const readyPublicPayload = (canonicalAlias: string | null = null) => ({
    route: {
        applicationId: APP_ID,
        matchedBy: 'uuid' as const,
        matchedAlias: null,
        routingMode: 'direct' as const,
        primaryAlias: null,
        canonicalAlias
    }
})

const AuthPageProbe = () => {
    const location = useLocation()
    const from = (location.state as { from?: string } | null)?.from ?? ''
    return <div data-testid='auth-page' data-from={from} />
}

const RuntimeLocationProbe = () => {
    const location = useLocation()
    return <output data-testid='runtime-location'>{`${location.pathname}${location.search}${location.hash}`}</output>
}

const renderEntry = (route: string, queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })) => {
    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <RuntimeLocationProbe />
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
        entryMocks.user = null
    })

    it('renders the anonymous public runtime for a ready public reference and never calls the authenticated resolver', async () => {
        entryMocks.getPublicApplicationRuntime.mockResolvedValue(readyPublicPayload())

        renderEntry('/a/public-app?locale=en')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })

    it('routes an authenticated member of a public application through the protected resolver and editor guards', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.user = { id: 'member-1' }
        entryMocks.getPublicApplicationRuntime.mockResolvedValue(readyPublicPayload())
        entryMocks.resolveApplicationRuntimeReference.mockResolvedValue({ applicationId: APP_ID })

        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
        queryClient.setQueryData([...applicationsQueryKeys.runtimeReference(APP_ID), 'previous-member'], { applicationId: APP_ID })

        renderEntry(`/a/${APP_ID}`, queryClient)

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith(APP_ID)
        expect(
            queryClient
                .getQueryCache()
                .findAll({ queryKey: applicationsQueryKeys.runtimeReference(APP_ID) })
                .map((query) => query.queryKey)
        ).toContainEqual([...applicationsQueryKeys.runtimeReference(APP_ID), 'member-1'])
        expect(screen.getByTestId('application-guard')).toHaveAttribute('data-application-id', APP_ID)
        expect(screen.getByTestId('application-migration-guard')).toHaveAttribute('data-application-id', APP_ID)
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
    })

    it('does not block protected member resolution on a stalled public bootstrap probe', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.user = { id: 'member-1' }
        entryMocks.getPublicApplicationRuntime.mockImplementation(() => new Promise(() => undefined))
        entryMocks.resolveApplicationRuntimeReference.mockResolvedValue({ applicationId: APP_ID })

        renderEntry(`/a/${APP_ID}`)

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith(APP_ID)
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
    })

    it('keeps a public read-only view when an authenticated visitor has no application access', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockResolvedValue(readyPublicPayload())
        entryMocks.resolveApplicationRuntimeReference.mockRejectedValue(new Error('not found'))

        renderEntry(`/a/${APP_ID}`)

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith(APP_ID)
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })

    it('resolves a canonical alias before rendering and preserves its suffix, query and hash', async () => {
        entryMocks.getPublicApplicationRuntime.mockResolvedValue({
            ...readyPublicPayload('network-primary'),
            route: {
                ...readyPublicPayload('network-primary').route,
                matchedBy: 'alias' as const,
                matchedAlias: 'network-secondary',
                routingMode: 'canonical' as const,
                primaryAlias: 'network-primary'
            },
            templateKey: 'dashboard',
            dashboard: {}
        })

        renderEntry(`/a/network-secondary/workspaces/${OTHER_APP_ID}/settings?locale=ru#cell-settings`)

        await waitFor(() =>
            expect(screen.getByTestId('runtime-location')).toHaveTextContent(
                `/a/network-primary/workspaces/${OTHER_APP_ID}/settings?locale=ru#cell-settings`
            )
        )
        expect(entryMocks.resolveApplicationRuntimeReference).not.toHaveBeenCalled()
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
        entryMocks.getPublicApplicationRuntime.mockResolvedValue(readyPublicPayload())
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

    it('checks access to an authenticated UUID reference before entering its runtime', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())
        entryMocks.resolveApplicationRuntimeReference.mockResolvedValue({ applicationId: APP_ID })

        renderEntry(`/a/${APP_ID}`)

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith(APP_ID)
    })

    it('opens the authenticated runtime when public bootstrap is retryable but protected access succeeds', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.user = { id: 'member-1' }
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(
            new PublicApplicationRuntimeError(503, 'PUBLIC_APPLICATION_RUNTIME_FAILED')
        )
        entryMocks.resolveApplicationRuntimeReference.mockResolvedValue({ applicationId: APP_ID })

        renderEntry(`/a/${APP_ID}`)

        expect(await screen.findByTestId('authenticated-runtime')).toHaveTextContent(APP_ID)
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith(APP_ID)
        expect(screen.queryByTestId('public-runtime')).not.toBeInTheDocument()
    })

    it('falls back to the public unavailable page when the authenticated resolver cannot resolve the alias', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(unavailableError())
        entryMocks.resolveApplicationRuntimeReference.mockRejectedValue(new Error('not found'))

        renderEntry('/a/unknown-alias')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })

    it('keeps an authenticated non-member on the public retry state when public bootstrap is retryable', async () => {
        entryMocks.isAuthenticated = true
        entryMocks.resolveApplicationRuntimeReference.mockRejectedValue(new Error('not found'))
        entryMocks.getPublicApplicationRuntime.mockRejectedValue(
            new PublicApplicationRuntimeError(503, 'PUBLIC_APPLICATION_RUNTIME_FAILED')
        )

        renderEntry('/a/private-alias')

        expect(await screen.findByTestId('public-runtime')).toBeInTheDocument()
        expect(entryMocks.resolveApplicationRuntimeReference).toHaveBeenCalledWith('private-alias')
        expect(screen.queryByTestId('authenticated-runtime')).not.toBeInTheDocument()
    })
})
