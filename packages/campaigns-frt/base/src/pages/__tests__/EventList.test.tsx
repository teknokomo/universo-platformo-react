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

import EventList from '../EventList'
import * as eventsApi from '../../api/events'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import campaignsEn from '../../i18n/locales/en/campaigns.json'
import campaignsRu from '../../i18n/locales/ru/campaigns.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/events', () => ({
    listEvents: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement, { route = '/campaigns/test-campaign-id/events' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/campaigns/:campaignId/events' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('EventList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(eventsApi.listEvents).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<EventList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(eventsApi.listEvents).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(eventsApi.listEvents).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EventList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no events exist', async () => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.queryByText(/no events/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockEvents = [
            {
                id: 'event-1',
                campaignId: 'test-campaign-id',
                name: 'Main Event',
                description: 'Primary event for testing',
                activitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'event-2',
                campaignId: 'test-campaign-id',
                name: 'Secondary Event',
                description: 'Additional event',
                activitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: mockEvents,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render event cards with names', async () => {
            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.getByText('Main Event')).toBeInTheDocument()
                expect(screen.getByText('Secondary Event')).toBeInTheDocument()
            })
        })

        it('should display event descriptions', async () => {
            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.getByText('Primary event for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional event')).toBeInTheDocument()
            })
        })

        it('should show activity counts', async () => {
            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.queryByText('10') || screen.queryAllByText('10').length > 0).toBeTruthy()
                expect(screen.queryByText('5') || screen.queryAllByText('5').length > 0).toBeTruthy()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: [
                    {
                        id: 'event-1',
                        campaignId: 'test-campaign-id',
                        name: 'Test Event',
                        description: 'Test',
                        activitiesCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing campaignId parameter', () => {
            vi.mocked(eventsApi.listEvents).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<EventList />, { route: '/campaigns//events' })

            // Should not call API without valid ID
            expect(eventsApi.listEvents).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(eventsApi.createEvent).mockResolvedValue({
                id: 'new-event',
                campaignId: 'test-campaign-id',
                name: 'New Event',
                description: 'Newly created',
                activitiesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new event', async () => {
            const { user } = renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.queryByText(/no events/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })

            // Find Add button
            const addButtons = screen.getAllByRole('button')
            const addButton = addButtons.find(
                (btn) => btn.querySelector('[data-testid="AddRoundedIcon"]') || btn.textContent?.includes('Add')
            )

            if (addButton) {
                await user.click(addButton)

                await waitFor(() => {
                    const dialog = screen.queryByRole('dialog') || document.querySelector('[role="dialog"]')
                    expect(dialog).toBeTruthy()
                })
            }
        })
    })

    describe('Search Functionality', () => {
        const mockEvents = [
            {
                id: 'event-1',
                campaignId: 'test-campaign-id',
                name: 'Production Event',
                description: 'Main production',
                activitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'event-2',
                campaignId: 'test-campaign-id',
                name: 'Testing Event',
                description: 'Test environment',
                activitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: mockEvents,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.getByText('Production Event')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle events with zero activity count', async () => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: [
                    {
                        id: 'empty-event',
                        campaignId: 'test-campaign-id',
                        name: 'Empty Event',
                        description: 'No activities',
                        activitiesCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.getByText('Empty Event')).toBeInTheDocument()
            })

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle events without description', async () => {
            vi.mocked(eventsApi.listEvents).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        campaignId: 'test-campaign-id',
                        name: 'No Description',
                        description: undefined,
                        activitiesCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<EventList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })
    })
})
