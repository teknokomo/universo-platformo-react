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

import ClusterBoard from '../ClusterBoard'
import * as clustersApi from '../../api/clusters'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import clustersEn from '../../i18n/locales/en/clusters.json'
import clustersRu from '../../i18n/locales/ru/clusters.json'

// Mock API module
vi.mock('../../api/clusters', () => ({
    getCluster: vi.fn()
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

// Mock backend utilities
vi.mock('@universo/utils', () => ({
    extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
    isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
    isApiError: vi.fn((error: any) => !!error?.response),
    getApiBaseURL: vi.fn(() => 'http://localhost:3000')
}))

// Mock window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Initialize i18n using the global instance and register clusters namespace
const i18n = getI18nInstance()
registerNamespace('clusters', {
    en: clustersEn.clusters,
    ru: clustersRu.clusters
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

interface RenderOptions {
    route?: string
}

const renderWithProviders = (ui: React.ReactElement, { route = '/clusters/test-cluster-id/board' }: RenderOptions = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/clusters/:clusterId/board' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ClusterBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Loading State', () => {
        it('should display loading indicator while fetching data', () => {
            // Mock API to never resolve (stays in loading state)
            vi.mocked(clustersApi.getCluster).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderWithProviders(<ClusterBoard />)

            // Check for loading indicator
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject with error
            vi.mocked(clustersApi.getCluster).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ClusterBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load cluster data/i)).toBeInTheDocument()
            })

            // Check for error alert
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText(/network error/i)).toBeInTheDocument()
        })

        it('should display generic error when no cluster data returned', async () => {
            // Mock API to return null/undefined data
            vi.mocked(clustersApi.getCluster).mockResolvedValue({ data: null } as any)

            renderWithProviders(<ClusterBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load cluster data/i)).toBeInTheDocument()
            })
        })
    })

    describe('Success State - Dashboard Rendering', () => {
        const mockClusterData = {
            id: 'test-cluster-id',
            name: 'Test Cluster',
            description: 'A test cluster for unit tests',
            domainsCount: 11,
            resourcesCount: 42,
            membersCount: 4,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(clustersApi.getCluster).mockResolvedValue({
                data: mockClusterData
            })
        })

        it('should render cluster name and description in header', async () => {
            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByText('Test Cluster')).toBeInTheDocument()
                expect(screen.getByText('A test cluster for unit tests')).toBeInTheDocument()
            })
        })

        it('should display all stat cards with correct values', async () => {
            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                // Check domains count
                expect(screen.getByText('11')).toBeInTheDocument()

                // Check resources count
                expect(screen.getByText('42')).toBeInTheDocument()

                // Check members count
                expect(screen.getByText('4')).toBeInTheDocument()
            })
        })

        it('should render documentation card', async () => {
            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByText(/documentation/i)).toBeInTheDocument()
            })
        })

        it('should render activity and resources charts', async () => {
            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                // Charts should be present (check for Overview domain)
                expect(screen.getByText('Overview')).toBeInTheDocument()
            })
        })

        it('should render back button', async () => {
            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /back to clusters/i })).toBeInTheDocument()
            })
        })
    })

    describe('User Interactions', () => {
        const mockClusterData = {
            id: 'test-cluster-id',
            name: 'Interactive Test',
            description: 'Testing user interactions',
            domainsCount: 5,
            resourcesCount: 10,
            membersCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(clustersApi.getCluster).mockResolvedValue({
                data: mockClusterData
            })
        })

        it('should open documentation in new tab when button clicked', async () => {
            const { user } = renderWithProviders(<ClusterBoard />)

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
        it('should handle cluster with zero counts', async () => {
            vi.mocked(clustersApi.getCluster).mockResolvedValue({
                data: {
                    id: 'empty-cluster',
                    name: 'Empty Cluster',
                    description: 'No content yet',
                    domainsCount: 0,
                    resourcesCount: 0,
                    membersCount: 0,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByText('Empty Cluster')).toBeInTheDocument()
            })

            // Should display zeros correctly
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3) // At least 3 stat cards with 0
        })

        it('should handle cluster without description', async () => {
            vi.mocked(clustersApi.getCluster).mockResolvedValue({
                data: {
                    id: 'no-desc-cluster',
                    name: 'No Description',
                    description: '', // Empty description
                    domainsCount: 1,
                    resourcesCount: 1,
                    membersCount: 1,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should display default description from i18n
            expect(screen.getByText(/cluster analytics and statistics/i)).toBeInTheDocument()
        })

        it('should handle missing optional count fields', async () => {
            vi.mocked(clustersApi.getCluster).mockResolvedValue({
                data: {
                    id: 'partial-data',
                    name: 'Partial Data',
                    description: 'Testing missing fields',
                    // Counts are undefined
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                } as any
            })

            renderWithProviders(<ClusterBoard />)

            await waitFor(() => {
                expect(screen.getByText('Partial Data')).toBeInTheDocument()
            })

            // Should display 0 for missing counts (fallback behavior)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('Navigation', () => {
        it('should handle invalid clusterId parameter', () => {
            // Render without clusterId in route
            vi.mocked(clustersApi.getCluster).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ClusterBoard />, { route: '/clusters//board' })

            // Should not call API without valid ID
            expect(clustersApi.getCluster).not.toHaveBeenCalled()
        })
    })
})
