// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
// rehype-mathjax 4.0.3 has jsdom 20.0.3 as a direct dependency
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }));
vi.mock('rehype-raw', () => ({ default: () => () => {} }));
vi.mock('remark-gfm', () => ({ default: () => () => {} }));
vi.mock('remark-math', () => ({ default: () => () => {} }));

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import MetaverseMembers from './MetaverseMembers'
import { AuthProvider } from '@universo/auth-frt'
import * as metaversesApi from '../api/metaverses'
import type { MetaverseMember } from '../types'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metaversesEn from '../i18n/locales/en/metaverses.json'
import metaversesRu from '../i18n/locales/ru/metaverses.json'

// Mock API module
vi.mock('../api/metaverses', () => ({
    listMetaverseMembers: vi.fn(),
    inviteMetaverseMember: vi.fn(),
    updateMetaverseMemberRole: vi.fn(),
    removeMetaverseMember: vi.fn()
}))

// Mock useAuth hook
vi.mock('@universo/auth-frt', async () => {
    const actual = await vi.importActual<typeof import('@universo/auth-frt')>('@universo/auth-frt')
    return {
        ...actual,
        useAuth: () => ({
            user: { id: 'test-user-id', email: 'test@example.com' },
            isAuthenticated: true
        })
    }
})

// Mock backend utilities to avoid unnecessary dependencies in frontend tests
vi.mock('@universo/utils', () => ({
    extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
    isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
    isApiError: vi.fn((error: any) => !!error?.response),
    getApiBaseURL: vi.fn(() => 'http://localhost:3000')
}));

// Mock markdown components that require rehype/remark (which pull jsdom)
vi.mock('@flowise/template-mui', async () => {
    const actual = await vi.importActual<any>('@flowise/template-mui');
    return {
        ...actual,
        InputHintDialog: vi.fn(() => null)
    };
});

// Initialize i18n using the global instance and register metaverses namespace
const i18n = getI18nInstance()
registerNamespace('metaverses', {
    en: metaversesEn.metaverses,
    ru: metaversesRu.metaverses
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderWithProviders = (ui: React.ReactElement, { route = '/metaverses/test-metaverse-id/members' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path="/metaverses/:metaverseId/members" element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MetaverseMembers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default mock: return empty list with proper structure
        vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue({
            data: [],
            pagination: {
                total: 0,
                limit: 20,
                offset: 0,
                count: 0,
                hasMore: false
            }
        } as any)
    })

    describe('Component rendering with happy-dom', () => {
        it('should render component with translated UI elements', () => {
            renderWithProviders(<MetaverseMembers />)

            // Check that basic UI elements are rendered with translations
            expect(screen.getByText(/access/i)).toBeInTheDocument()
            expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
        })

        it('should render view toggle buttons', () => {
            renderWithProviders(<MetaverseMembers />)

            // Verify view toggle buttons exist
            expect(screen.getByTitle(/card view/i)).toBeInTheDocument()
            expect(screen.getByTitle(/list view/i)).toBeInTheDocument()
        })

        it('should render toolbar with search and controls', () => {
            const { container } = renderWithProviders(<MetaverseMembers />)

            // Verify toolbar is rendered
            expect(container.querySelector('.MuiToolbar-root')).toBeInTheDocument()
            
            // Verify search input
            expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        })
    })

    describe('Empty state', () => {
        it('should display empty state message when no members exist', async () => {
            renderWithProviders(<MetaverseMembers />)

            // Wait for empty state to appear
            await waitFor(() => {
                expect(screen.getByText(/no members found/i)).toBeInTheDocument()
            })
        })
    })

    describe('Loading state', () => {
        it('should display skeleton loader while fetching members', () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve({
                    data: [],
                    pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
                } as any), 1000))
            )

            const { container } = renderWithProviders(<MetaverseMembers />)

            // Verify skeleton is shown initially by checking for MUI Skeleton elements
            const skeletons = container.querySelectorAll('.MuiSkeleton-root')
            expect(skeletons.length).toBeGreaterThan(0)
        })
    })

    // NOTE: Additional tests for data fetching, interactions, and form validation
    // require proper MSW setup or alternative API mocking strategies.
    // These are omitted for now as the current vi.mock setup doesn't intercept
    // the API calls made through usePaginated hook.
})
