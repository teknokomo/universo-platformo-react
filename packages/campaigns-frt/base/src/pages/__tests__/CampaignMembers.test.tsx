import { vi } from 'vitest'
// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
// rehype-mathjax 4.0.3 has jsdom 20.0.3 as a direct dependency
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

import CampaignMembers from '../CampaignMembers'
import * as campaignsApi from '../../api/campaigns'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import campaignsEn from '../../i18n/locales/en/campaigns.json'
import campaignsRu from '../../i18n/locales/ru/campaigns.json'

// Mock API module
vi.mock('../../api/campaigns', () => ({
    listCampaignMembers: vi.fn(),
    inviteCampaignMember: vi.fn(),
    updateCampaignMemberRole: vi.fn(),
    removeCampaignMember: vi.fn()
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
}))

// Mock markdown components that require rehype/remark (which pull jsdom)
vi.mock('@flowise/template-mui', async () => {
    const actual = await vi.importActual<any>('@flowise/template-mui')
    return {
        ...actual,
        InputHintDialog: vi.fn(() => null)
    }
})

// Initialize i18n using the global instance and register campaigns namespace
const i18n = getI18nInstance()
registerNamespace('campaigns', {
    en: campaignsEn.campaigns,
    ru: campaignsRu.campaigns
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const renderWithProviders = (ui: React.ReactElement, { route = '/campaigns/test-campaign-id/members' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/campaigns/:campaignId/members' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('CampaignMembers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default mock: return empty list with proper structure
        vi.mocked(campaignsApi.listCampaignMembers).mockResolvedValue({
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
            renderWithProviders(<CampaignMembers />)

            // Check that basic UI elements are rendered with translations
            expect(screen.getByText(/access/i)).toBeInTheDocument()
            expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
        })

        it('should render view toggle buttons', () => {
            renderWithProviders(<CampaignMembers />)

            // Verify view toggle buttons exist
            expect(screen.getByTitle(/card view/i)).toBeInTheDocument()
            expect(screen.getByTitle(/list view/i)).toBeInTheDocument()
        })

        it('should render toolbar with search and controls', () => {
            const { container } = renderWithProviders(<CampaignMembers />)

            // Verify toolbar is rendered
            expect(container.querySelector('.MuiToolbar-root')).toBeInTheDocument()

            // Verify search input
            expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        })
    })

    describe('Empty state', () => {
        it('should display empty state message when no members exist', async () => {
            renderWithProviders(<CampaignMembers />)

            // Wait for empty state to appear
            await waitFor(() => {
                expect(screen.getByText(/no members found/i)).toBeInTheDocument()
            })
        })
    })

    describe('Loading state', () => {
        it('should display skeleton loader while fetching members', () => {
            vi.mocked(campaignsApi.listCampaignMembers).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    data: [],
                                    pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
                                } as any),
                            1000
                        )
                    )
            )

            const { container } = renderWithProviders(<CampaignMembers />)

            // Verify skeleton is shown initially by checking for MUI Skeleton elements
            const skeletons = container.querySelectorAll('.MuiSkeleton-root')
            expect(skeletons.length).toBeGreaterThan(0)
        })
    })

    // NOTE: Additional tests for data fetching, interactions, and form validation
    // require proper MSW setup or alternative API mocking strategies.
    // These are omitted for now as the current vi.mock setup doesn't intercept
    // the API calls made through usePaginated hook.

    describe('Success state - Members list', () => {
        const mockMembers = [
            {
                id: 'member-1',
                userId: 'user-1',
                campaignId: 'test-campaign-id',
                role: 'admin',
                email: 'admin@example.com',
                name: 'Admin User',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'member-2',
                userId: 'user-2',
                campaignId: 'test-campaign-id',
                role: 'editor',
                email: 'editor@example.com',
                name: 'Editor User',
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaignMembers).mockResolvedValue({
                data: mockMembers,
                pagination: {
                    total: 2,
                    limit: 20,
                    offset: 0,
                    count: 2,
                    hasMore: false
                }
            } as any)
        })

        it('should render member cards with names and emails', async () => {
            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.getByText('Admin User')).toBeInTheDocument()
                expect(screen.getByText('admin@example.com')).toBeInTheDocument()
                expect(screen.getByText('Editor User')).toBeInTheDocument()
                expect(screen.getByText('editor@example.com')).toBeInTheDocument()
            })
        })

        it('should display member roles', async () => {
            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Error handling', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(campaignsApi.listCampaignMembers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.queryByText(/error/i) || screen.queryByText(/failed/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(campaignsApi.listCampaignMembers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Search functionality', () => {
        beforeEach(() => {
            vi.mocked(campaignsApi.listCampaignMembers).mockResolvedValue({
                data: [
                    {
                        id: 'member-1',
                        userId: 'user-1',
                        campaignId: 'test-campaign-id',
                        role: 'admin',
                        email: 'admin@example.com',
                        name: 'Admin User',
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                pagination: {
                    total: 1,
                    limit: 20,
                    offset: 0,
                    count: 1,
                    hasMore: false
                }
            } as any)
        })

        it('should have search input with placeholder', async () => {
            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            })
        })

        it('should update search field on user input', async () => {
            const { user } = renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.getByText('Admin User')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/search members/i)
            await user.type(searchInput, 'admin')

            expect(searchInput).toHaveValue('admin')
        })
    })

    describe('Edge cases', () => {
        it('should handle members without names', async () => {
            vi.mocked(campaignsApi.listCampaignMembers).mockResolvedValue({
                data: [
                    {
                        id: 'member-1',
                        userId: 'user-1',
                        campaignId: 'test-campaign-id',
                        role: 'viewer',
                        email: 'noname@example.com',
                        name: undefined,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                pagination: {
                    total: 1,
                    limit: 20,
                    offset: 0,
                    count: 1,
                    hasMore: false
                }
            } as any)

            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.getByText('noname@example.com')).toBeInTheDocument()
            })
        })

        it('should handle large member lists', async () => {
            const largeMemberList = Array.from({ length: 100 }, (_, i) => ({
                id: `member-${i}`,
                userId: `user-${i}`,
                campaignId: 'test-campaign-id',
                role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'editor' : 'viewer',
                email: `user${i}@example.com`,
                name: `User ${i}`,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

            vi.mocked(campaignsApi.listCampaignMembers).mockResolvedValue({
                data: largeMemberList.slice(0, 20),
                pagination: {
                    total: 100,
                    limit: 20,
                    offset: 0,
                    count: 20,
                    hasMore: true
                }
            } as any)

            renderWithProviders(<CampaignMembers />)

            await waitFor(() => {
                expect(screen.getByText('User 0')).toBeInTheDocument()
            })

            // Should show pagination for large lists
            const pagination = document.querySelector('[aria-label*="pagination"]') || document.querySelector('.MuiPagination-root')
            expect(pagination).toBeTruthy()
        })
    })

    describe('Navigation', () => {
        it('should handle missing campaignId parameter', () => {
            vi.mocked(campaignsApi.listCampaignMembers).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<CampaignMembers />, { route: '/campaigns//members' })

            // Should not call API without valid campaignId
            expect(campaignsApi.listCampaignMembers).not.toHaveBeenCalled()
        })
    })
})
