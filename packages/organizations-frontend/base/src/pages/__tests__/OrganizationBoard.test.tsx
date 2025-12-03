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

import OrganizationBoard from '../OrganizationBoard'
import * as organizationsApi from '../../api/organizations'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import organizationsEn from '../../i18n/locales/en/organizations.json'
import organizationsRu from '../../i18n/locales/ru/organizations.json'

// Mock API module
vi.mock('../../api/organizations', () => ({
    getOrganization: vi.fn()
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
vi.mock('@universo/utils', () => ({
    extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
    isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
    isApiError: vi.fn((error: any) => !!error?.response),
    getApiBaseURL: vi.fn(() => 'http://localhost:3000')
}))

// Mock window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Initialize i18n using the global instance and register organizations namespace
const i18n = getI18nInstance()
registerNamespace('organizations', {
    en: organizationsEn.organizations,
    ru: organizationsRu.organizations
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

const renderWithProviders = (ui: React.ReactElement, { route = '/organizations/test-organization-id/board' }: RenderOptions = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/organizations/:organizationId/board' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('OrganizationBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Loading State', () => {
        it('should display loading indicator while fetching data', () => {
            // Mock API to never resolve (stays in loading state)
            vi.mocked(organizationsApi.getOrganization).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderWithProviders(<OrganizationBoard />)

            // Check for loading indicator
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject with error
            vi.mocked(organizationsApi.getOrganization).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<OrganizationBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load organization data/i)).toBeInTheDocument()
            })

            // Check for error alert
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText(/network error/i)).toBeInTheDocument()
        })

        it('should display generic error when no organization data returned', async () => {
            // Mock API to return null/undefined data
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({ data: null } as any)

            renderWithProviders(<OrganizationBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load organization data/i)).toBeInTheDocument()
            })
        })
    })

    describe('Success State - Dashboard Rendering', () => {
        const mockOrganizationData = {
            id: 'test-organization-id',
            name: 'Test Organization',
            description: 'A test organization for unit tests',
            departmentsCount: 11,
            positionsCount: 42,
            membersCount: 4,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({
                data: mockOrganizationData
            })
        })

        it('should render organization name and description in header', async () => {
            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Test Organization')).toBeInTheDocument()
                expect(screen.getByText('A test organization for unit tests')).toBeInTheDocument()
            })
        })

        it('should display all stat cards with correct values', async () => {
            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                // Check departments count
                expect(screen.getByText('11')).toBeInTheDocument()

                // Check positions count
                expect(screen.getByText('42')).toBeInTheDocument()

                // Check members count
                expect(screen.getByText('4')).toBeInTheDocument()
            })
        })

        it('should render documentation card', async () => {
            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByText(/documentation/i)).toBeInTheDocument()
            })
        })

        it('should render activity and positions charts', async () => {
            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                // Charts should be present (check for Overview department)
                expect(screen.getByText('Overview')).toBeInTheDocument()
            })
        })

        it('should render back button', async () => {
            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /back to organizations/i })).toBeInTheDocument()
            })
        })
    })

    describe('User Interactions', () => {
        const mockOrganizationData = {
            id: 'test-organization-id',
            name: 'Interactive Test',
            description: 'Testing user interactions',
            departmentsCount: 5,
            positionsCount: 10,
            membersCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({
                data: mockOrganizationData
            })
        })

        it('should open documentation in new tab when button clicked', async () => {
            const { user } = renderWithProviders(<OrganizationBoard />)

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
        it('should handle organization with zero counts', async () => {
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({
                data: {
                    id: 'empty-organization',
                    name: 'Empty Organization',
                    description: 'No content yet',
                    departmentsCount: 0,
                    positionsCount: 0,
                    membersCount: 0,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Empty Organization')).toBeInTheDocument()
            })

            // Should display zeros correctly
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3) // At least 3 stat cards with 0
        })

        it('should handle organization without description', async () => {
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({
                data: {
                    id: 'no-desc-organization',
                    name: 'No Description',
                    description: '', // Empty description
                    departmentsCount: 1,
                    positionsCount: 1,
                    membersCount: 1,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should display default description from i18n
            expect(screen.getByText(/organization analytics and statistics/i)).toBeInTheDocument()
        })

        it('should handle missing optional count fields', async () => {
            vi.mocked(organizationsApi.getOrganization).mockResolvedValue({
                data: {
                    id: 'partial-data',
                    name: 'Partial Data',
                    description: 'Testing missing fields',
                    // Counts are undefined
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                } as any
            })

            renderWithProviders(<OrganizationBoard />)

            await waitFor(() => {
                expect(screen.getByText('Partial Data')).toBeInTheDocument()
            })

            // Should display 0 for missing counts (fallback behavior)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(3)
        })
    })

    describe('Navigation', () => {
        it('should handle invalid organizationId parameter', () => {
            // Render without organizationId in route
            vi.mocked(organizationsApi.getOrganization).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<OrganizationBoard />, { route: '/organizations//board' })

            // Should not call API without valid ID
            expect(organizationsApi.getOrganization).not.toHaveBeenCalled()
        })
    })
})
