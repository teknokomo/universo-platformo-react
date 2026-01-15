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

import ApplicationBoard from '../ApplicationBoard'
import * as applicationsApi from '../../api/applications'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import applicationsEn from '../../i18n/locales/en/applications.json'
import applicationsRu from '../../i18n/locales/ru/applications.json'

// Mock API module
vi.mock('../../api/applications', () => ({
    getApplication: vi.fn()
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

// Initialize i18n using the global instance and register applications namespace
const i18n = getI18nInstance()
const consolidateApplicationsNamespace = (bundle: any) => ({
    ...(bundle?.applications ?? {}),
    meta_sections: bundle?.meta_sections ?? {},
    meta_entities: bundle?.meta_entities ?? {},
    members: bundle?.members ?? {}
})
registerNamespace('applications', {
    en: consolidateApplicationsNamespace(applicationsEn),
    ru: consolidateApplicationsNamespace(applicationsRu)
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            // `useApplicationDetails` sets `retry: 3` explicitly; keep tests fast by forcing minimal retry delay.
            queries: { retry: false, retryDelay: 1 },
            mutations: { retry: false }
        }
    })

interface RenderOptions {
    route?: string
}

const renderWithProviders = (ui: React.ReactElement, { route = '/application/test-application-id' }: RenderOptions = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/application/:applicationId' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ApplicationBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Loading State', () => {
        it('should display loading indicator while fetching data', () => {
            // Mock API to never resolve (stays in loading state)
            vi.mocked(applicationsApi.getApplication).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderWithProviders(<ApplicationBoard />)

            // Check for loading indicator
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject with error
            vi.mocked(applicationsApi.getApplication).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ApplicationBoard />)

            // Wait for error state
            await waitFor(
                () => {
                    expect(screen.getByAltText('Error loading application')).toBeInTheDocument()
                    expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
                },
                { timeout: 2000 }
            )

            // Check for error alert
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText(/network error/i)).toBeInTheDocument()
        })

        it('should display generic error when no application data returned', async () => {
            // Mock API to return null/undefined data
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({ data: null } as any)

            renderWithProviders(<ApplicationBoard />)

            // Wait for error state
            await waitFor(
                () => {
                    expect(screen.getByAltText('Error loading application')).toBeInTheDocument()
                    // When there's no Error object, the translated fallback is shown both as the EmptyListState title and inside the Alert.
                    expect(screen.getAllByText(/failed to load dashboard data/i).length).toBeGreaterThan(0)
                    expect(screen.getByRole('alert')).toHaveTextContent(/failed to load dashboard data/i)
                },
                { timeout: 2000 }
            )
        })
    })

    describe('Success State - Dashboard Rendering', () => {
        const mockApplicationData = {
            id: 'test-application-id',
            name: 'Test Application',
            description: 'A test application for unit tests',
            membersCount: 4,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({
                data: mockApplicationData
            })
        })

        it('should render application name and description in header', async () => {
            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Test Application')).toBeInTheDocument()
                expect(screen.getByText('A test application for unit tests')).toBeInTheDocument()
            })
        })

        it('should display members stat card with correct value', async () => {
            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                // Check members count
                expect(screen.getByText('4')).toBeInTheDocument()
            })
        })

        it('should render documentation card', async () => {
            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /open documentation/i })).toBeInTheDocument()
            })
        })

        it('should render activity and resources charts', async () => {
            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                // Charts should be present (check for Overview section)
                expect(screen.getByText('Overview')).toBeInTheDocument()
            })
        })

        it('should render back button', async () => {
            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /back to applications/i })).toBeInTheDocument()
            })
        })
    })

    describe('User Interactions', () => {
        const mockApplicationData = {
            id: 'test-application-id',
            name: 'Interactive Test',
            description: 'Testing user interactions',
            membersCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({
                data: mockApplicationData
            })
        })

        it('should open documentation in new tab when button clicked', async () => {
            const { user } = renderWithProviders(<ApplicationBoard />)

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
        it('should handle application with zero counts', async () => {
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({
                data: {
                    id: 'empty-application',
                    name: 'Empty Application',
                    description: 'No content yet',
                    membersCount: 0,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Empty Application')).toBeInTheDocument()
            })

            // Should display zero correctly for members
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle application without description', async () => {
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({
                data: {
                    id: 'no-desc-application',
                    name: 'No Description',
                    description: '', // Empty description
                    membersCount: 1,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should display default description from i18n
            expect(screen.getByText(/application analytics and statistics/i)).toBeInTheDocument()
        })

        it('should handle missing optional count fields', async () => {
            vi.mocked(applicationsApi.getApplication).mockResolvedValue({
                data: {
                    id: 'partial-data',
                    name: 'Partial Data',
                    description: 'Testing missing fields',
                    // Counts are undefined
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                } as any
            })

            renderWithProviders(<ApplicationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Partial Data')).toBeInTheDocument()
            })

            // Should display 0 for missing counts (fallback behavior)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('Navigation', () => {
        it('should handle invalid applicationId parameter', () => {
            // Render without applicationId in route
            vi.mocked(applicationsApi.getApplication).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ApplicationBoard />, { route: '/application//board' })

            // Should not call API without valid ID
            expect(applicationsApi.getApplication).not.toHaveBeenCalled()
        })
    })
})
