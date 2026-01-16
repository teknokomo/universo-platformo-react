import { vi } from 'vitest'
// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import MetahubBoard from '../MetahubBoard'
import * as metahubsApi from '../../api'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metahubsEn from '../../../../i18n/locales/en/metahubs.json'
import metahubsRu from '../../../../i18n/locales/ru/metahubs.json'

// Mock API module
vi.mock('../../api', () => ({
    getMetahub: vi.fn()
}))

// Mock useAuth hook
vi.mock('@universo/auth-frontend', async () => {
    const actual = await vi.importActual<typeof import('@universo/auth-frontend')>('@universo/auth-frontend')
    return {
        ...actual,
        useAuth: () => ({
            user: { id: 'test-user-id', email: 'test@example.com' },
            isAuthenticated: true
        })
    }
})

// Mock backend utilities
vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
        isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
        isApiError: vi.fn((error: any) => !!error?.response),
        getApiBaseURL: vi.fn(() => 'http://localhost:3000')
    }
})

// Mock window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Initialize i18n using the global instance and register metahubs namespace
const i18n = getI18nInstance()
const consolidateMetahubsNamespace = (bundle: any) => ({
    ...(bundle?.metahubs ?? {}),
    meta_sections: bundle?.meta_sections ?? {},
    meta_entities: bundle?.meta_entities ?? {},
    members: bundle?.members ?? {}
})
registerNamespace('metahubs', {
    en: consolidateMetahubsNamespace(metahubsEn),
    ru: consolidateMetahubsNamespace(metahubsRu)
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            // `useMetahubDetails` sets `retry: 3` explicitly; keep tests fast by forcing minimal retry delay.
            queries: { retry: false, retryDelay: 1 },
            mutations: { retry: false }
        }
    })

interface RenderOptions {
    route?: string
}

const renderWithProviders = (ui: React.ReactElement, { route = '/metahub/test-metahub-id' }: RenderOptions = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/metahub/:metahubId' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MetahubBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Loading State', () => {
        it('should display loading indicator while fetching data', () => {
            // Mock API to never resolve (stays in loading state)
            vi.mocked(metahubsApi.getMetahub).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderWithProviders(<MetahubBoard />)

            // Check for loading indicator
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject with error
            vi.mocked(metahubsApi.getMetahub).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetahubBoard />)

            // Wait for error state
            await waitFor(
                () => {
                    expect(screen.getByAltText('Error loading metahub')).toBeInTheDocument()
                    expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
                },
                { timeout: 2000 }
            )

            // Check for error alert
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText(/network error/i)).toBeInTheDocument()
        })

        it('should display generic error when no metahub data returned', async () => {
            // Mock API to return null/undefined data
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({ data: null } as any)

            renderWithProviders(<MetahubBoard />)

            // Wait for error state
            await waitFor(
                () => {
                    expect(screen.getByAltText('Error loading metahub')).toBeInTheDocument()
                    // When there's no Error object, the translated fallback is shown both as the EmptyListState title and inside the Alert.
                    expect(screen.getAllByText(/failed to load dashboard data/i).length).toBeGreaterThan(0)
                    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load dashboard data/i)
                },
                { timeout: 2000 }
            )
        })
    })

    describe('Success State - Dashboard Rendering', () => {
        const mockMetahubData = {
            id: 'test-metahub-id',
            name: 'Test Metahub',
            description: 'A test metahub for unit tests',
            membersCount: 4,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({
                data: mockMetahubData
            })
        })

        it('should render metahub name and description in header', async () => {
            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByText('Test Metahub')).toBeInTheDocument()
                expect(screen.getByText('A test metahub for unit tests')).toBeInTheDocument()
            })
        })

        it('should display members stat card with correct value', async () => {
            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                // Check members count
                expect(screen.getByText('4')).toBeInTheDocument()
            })
        })

        it('should render documentation card', async () => {
            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /open documentation/i })).toBeInTheDocument()
            })
        })

        it('should render activity and resources charts', async () => {
            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                // Charts should be present (check for Overview section)
                expect(screen.getByText('Overview')).toBeInTheDocument()
            })
        })

        it('should render back button', async () => {
            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /back to metahubs/i })).toBeInTheDocument()
            })
        })
    })

    describe('User Interactions', () => {
        const mockMetahubData = {
            id: 'test-metahub-id',
            name: 'Interactive Test',
            description: 'Testing user interactions',
            membersCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({
                data: mockMetahubData
            })
        })

        it('should open documentation in new tab when button clicked', async () => {
            const { user } = renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByText('Interactive Test')).toBeInTheDocument()
            })

            // Find and click documentation button
            const docButtons = screen.getAllByRole('button')
            const docButton = docButtons.find(
                (btn) => btn.textContent?.includes('documentation') || btn.textContent?.includes('Documentation')
            )

            if (docButton) {
                await user.click(docButton)

                // Verify window.open was called with correct URL
                expect(mockWindowOpen).toHaveBeenCalledWith('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')
            }
        })
    })

    describe('Edge Cases', () => {
        it('should handle metahub with zero counts', async () => {
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({
                data: {
                    id: 'empty-metahub',
                    name: 'Empty Metahub',
                    description: 'No content yet',
                    membersCount: 0,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByText('Empty Metahub')).toBeInTheDocument()
            })

            // Should display zero correctly for members
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle metahub without description', async () => {
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({
                data: {
                    id: 'no-desc-metahub',
                    name: 'No Description',
                    description: '', // Empty description
                    membersCount: 1,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should display default description from i18n
            expect(screen.getByText(/metahub analytics and statistics/i)).toBeInTheDocument()
        })

        it('should handle missing optional count fields', async () => {
            vi.mocked(metahubsApi.getMetahub).mockResolvedValue({
                data: {
                    id: 'partial-data',
                    name: 'Partial Data',
                    description: 'Testing missing fields',
                    // Counts are undefined
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                } as any
            })

            renderWithProviders(<MetahubBoard />)

            await waitFor(() => {
                expect(screen.getByText('Partial Data')).toBeInTheDocument()
            })

            // Should display 0 for missing counts (fallback behavior)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('Navigation', () => {
        it('should handle invalid metahubId parameter', () => {
            // Render without metahubId in route
            vi.mocked(metahubsApi.getMetahub).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetahubBoard />, { route: '/metahub//board' })

            // Should not call API without valid ID
            expect(metahubsApi.getMetahub).not.toHaveBeenCalled()
        })
    })
})
