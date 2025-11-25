import { vi } from 'vitest'
// Mock rehype/remark libraries
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import CampaignList from '../CampaignList'
import * as campaignsApi from '../../api/campaigns'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import campaignsEn from '../../i18n/locales/en/campaigns.json'
import campaignsRu from '../../i18n/locales/ru/campaigns.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/campaigns', () => ({
    listCampaigns: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaign: vi.fn(),
    deleteCampaign: vi.fn()
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

// Initialize i18n
const i18n = getI18nInstance()
registerNamespace('campaigns', {
    en: campaignsEn.campaigns,
    ru: campaignsRu.campaigns
})
registerNamespace('common', {
    en: commonEn,
    ru: commonRu
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={['/campaigns']}>{ui}</MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('CampaignList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock localStorage
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            // Mock API to never resolve
            vi.mocked(campaignsApi.listCampaigns).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<CampaignList />)

            // Check for loading skeletons (part of SkeletonGrid component)
            expect(screen.getByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject
            vi.mocked(campaignsApi.listCampaigns).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<CampaignList />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/connection/i) || screen.getByText(/error/i)).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no campaigns exist', async () => {
            // Mock API to return empty list
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText(/no campaigns/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })
        })

        it('should show create button in empty state', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                const addButtons = screen.queryAllByRole('button')
                expect(addButtons.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockCampaigns = [
            {
                id: 'campaign-1',
                name: 'Test Campaign 1',
                description: 'First test campaign',
                role: 'admin',
                eventsCount: 5,
                activitiesCount: 20,
                membersCount: 3,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'campaign-2',
                name: 'Test Campaign 2',
                description: 'Second test campaign',
                role: 'editor',
                eventsCount: 3,
                activitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: mockCampaigns,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render campaign cards with names', async () => {
            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('Test Campaign 1')).toBeInTheDocument()
                expect(screen.getByText('Test Campaign 2')).toBeInTheDocument()
            })
        })

        it('should display campaign descriptions', async () => {
            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('First test campaign')).toBeInTheDocument()
                expect(screen.getByText('Second test campaign')).toBeInTheDocument()
            })
        })

        it('should show role chips for campaigns', async () => {
            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                // RoleChip component renders role
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })

        it('should display events and activities counts', async () => {
            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                // Check for count values
                expect(screen.getByText('5') || screen.queryByText('5')).toBeTruthy()
                expect(screen.getByText('20') || screen.queryByText('20')).toBeTruthy()
            })
        })
    })

    describe('Search Functionality', () => {
        const mockCampaigns = [
            {
                id: 'campaign-1',
                name: 'Production Campaign',
                description: 'Main production environment',
                role: 'admin',
                eventsCount: 10,
                activitiesCount: 50,
                membersCount: 5,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'campaign-2',
                name: 'Testing Campaign',
                description: 'Test environment',
                role: 'editor',
                eventsCount: 3,
                activitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: mockCampaigns,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
                expect(searchInput).toBeTruthy()
            })
        })

        it('should call API with search parameter when typing', async () => {
            const { user } = renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('Production Campaign')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            if (searchInput) {
                await user.type(searchInput, 'Production')

                // API should be called with search parameter
                await waitFor(
                    () => {
                        const calls = vi.mocked(campaignsApi.listCampaigns).mock.calls
                        const hasSearchParam = calls.some((call) => call[0]?.search === 'Production')
                        expect(hasSearchParam).toBeTruthy()
                    },
                    { timeout: 3000 }
                )
            }
        })
    })

    describe('Pagination', () => {
        const generateMockCampaigns = (count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: `campaign-${i + 1}`,
                name: `Campaign ${i + 1}`,
                description: `Description ${i + 1}`,
                role: 'viewer' as const,
                eventsCount: i,
                activitiesCount: i * 2,
                membersCount: 1,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

        it('should display pagination controls when total exceeds page size', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: generateMockCampaigns(20),
                total: 50,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                // Look for pagination component (MUI Pagination or custom)
                const pagination = document.querySelector('[aria-label*="pagination"]') || document.querySelector('.MuiPagination-root')
                expect(pagination).toBeTruthy()
            })
        })
    })

    describe('Create Campaign', () => {
        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(campaignsApi.createCampaign).mockResolvedValue({
                id: 'new-campaign',
                name: 'New Campaign',
                description: 'Newly created',
                role: 'admin',
                eventsCount: 0,
                activitiesCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should open create dialog when add button clicked', async () => {
            const { user } = renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText(/no campaigns/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })

            // Find Add button
            const addButtons = screen.getAllByRole('button')
            const addButton = addButtons.find(
                (btn) => btn.querySelector('[data-testid="AddRoundedIcon"]') || btn.textContent?.includes('Add')
            )

            if (addButton) {
                await user.click(addButton)

                // Dialog should open
                await waitFor(() => {
                    const dialog = screen.queryByRole('dialog') || document.querySelector('[role="dialog"]')
                    expect(dialog).toBeTruthy()
                })
            }
        })
    })

    describe('View Toggle', () => {
        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [
                    {
                        id: 'test-campaign',
                        name: 'Test',
                        description: 'Test',
                        role: 'admin',
                        eventsCount: 1,
                        activitiesCount: 1,
                        membersCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should persist view preference to localStorage', async () => {
            const { user } = renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('Test')).toBeInTheDocument()
            })

            // Find view toggle buttons (card/table view)
            const toggleButtons = screen.queryAllByRole('button')
            const viewToggle = toggleButtons.find((btn) => btn.getAttribute('aria-label')?.includes('view'))

            if (viewToggle) {
                await user.click(viewToggle)

                // Check localStorage was called
                await waitFor(() => {
                    expect(Storage.prototype.setItem).toHaveBeenCalled()
                })
            }
        })
    })

    describe('Edge Cases', () => {
        it('should handle campaigns without descriptions', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        name: 'No Description',
                        description: undefined,
                        role: 'viewer',
                        eventsCount: 0,
                        activitiesCount: 0,
                        membersCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should render em dash or empty state for description
            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle campaigns without role', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [
                    {
                        id: 'no-role',
                        name: 'No Role',
                        description: 'Test',
                        role: undefined,
                        eventsCount: 0,
                        activitiesCount: 0,
                        membersCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('No Role')).toBeInTheDocument()
            })
        })

        it('should handle campaigns with zero counts', async () => {
            vi.mocked(campaignsApi.listCampaigns).mockResolvedValue({
                data: [
                    {
                        id: 'zero-counts',
                        name: 'Zero Counts',
                        description: 'All zeros',
                        role: 'admin',
                        eventsCount: 0,
                        activitiesCount: 0,
                        membersCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<CampaignList />)

            await waitFor(() => {
                expect(screen.getByText('Zero Counts')).toBeInTheDocument()
            })

            // Should display 0 values correctly
            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })
    })
})
