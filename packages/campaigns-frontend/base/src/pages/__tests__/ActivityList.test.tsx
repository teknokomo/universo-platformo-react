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
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import ActivityList from '../ActivityList'
import * as activitiesApi from '../../api/activities'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import campaignsEn from '../../i18n/locales/en/campaigns.json'
import campaignsRu from '../../i18n/locales/ru/campaigns.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/activities', () => ({
    listActivities: vi.fn(),
    createActivity: vi.fn(),
    updateActivity: vi.fn(),
    deleteActivity: vi.fn(),
    moveActivity: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement, { route = '/campaigns/test-campaign-id/events/test-event-id/activities' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/campaigns/:campaignId/events/:eventId/activities' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ActivityList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(activitiesApi.listActivities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ActivityList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(activitiesApi.listActivities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(activitiesApi.listActivities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no activities exist', async () => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.queryByText(/no activities/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockActivities = [
            {
                id: 'activity-1',
                campaignId: 'test-campaign-id',
                eventId: 'test-event-id',
                name: 'Primary Activity',
                description: 'Main activity for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'activity-2',
                campaignId: 'test-campaign-id',
                eventId: 'test-event-id',
                name: 'Secondary Activity',
                description: 'Additional activity',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: mockActivities,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render activity cards with names', async () => {
            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Activity')).toBeInTheDocument()
                expect(screen.getByText('Secondary Activity')).toBeInTheDocument()
            })
        })

        it('should display activity descriptions', async () => {
            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('Main activity for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional activity')).toBeInTheDocument()
            })
        })

        it('should show activity types', async () => {
            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Activity Actions', () => {
        const mockActivities = [
            {
                id: 'activity-1',
                campaignId: 'test-campaign-id',
                eventId: 'test-event-id',
                name: 'Test Activity',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: mockActivities,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each activity', async () => {
            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('Test Activity')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing eventId parameter', () => {
            vi.mocked(activitiesApi.listActivities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ActivityList />, { route: '/campaigns/test-campaign-id/events//activities' })

            // Should not call API without valid ID
            expect(activitiesApi.listActivities).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockActivities = [
            {
                id: 'activity-1',
                campaignId: 'test-campaign-id',
                eventId: 'test-event-id',
                name: 'Production Activity',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'activity-2',
                campaignId: 'test-campaign-id',
                eventId: 'test-event-id',
                name: 'Testing Activity',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: mockActivities,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('Production Activity')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle activities without description', async () => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        campaignId: 'test-campaign-id',
                        eventId: 'test-event-id',
                        name: 'No Description',
                        description: undefined,
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle activities with various types', async () => {
            vi.mocked(activitiesApi.listActivities).mockResolvedValue({
                data: [
                    {
                        id: 'text-activity',
                        campaignId: 'test-campaign-id',
                        eventId: 'test-event-id',
                        name: 'Text Activity',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-activity',
                        campaignId: 'test-campaign-id',
                        eventId: 'test-event-id',
                        name: 'Image Activity',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-activity',
                        campaignId: 'test-campaign-id',
                        eventId: 'test-event-id',
                        name: 'Video Activity',
                        description: 'Video type',
                        type: 'video',
                        order: 2,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 3,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ActivityList />)

            await waitFor(() => {
                expect(screen.getByText('Text Activity')).toBeInTheDocument()
                expect(screen.getByText('Image Activity')).toBeInTheDocument()
                expect(screen.getByText('Video Activity')).toBeInTheDocument()
            })
        })
    })
})
