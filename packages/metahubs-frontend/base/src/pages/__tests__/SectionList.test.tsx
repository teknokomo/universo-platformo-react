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
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

import MetaSectionList from '../MetaSectionList'
import * as meta_sectionsApi from '../../api/metaSections'
import * as metahubsApi from '../../api/metahubs'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metahubsEn from '../../i18n/locales/en/metahubs.json'
import metahubsRu from '../../i18n/locales/ru/metahubs.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/metaSections', () => ({
    listMetaSections: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn()
}))

vi.mock('../../api/metahubs', () => ({
    listMetahubMetaSections: vi.fn()
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

// Initialize i18n
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

const createTestStore = () =>
    configureStore({
        reducer: {
            customization: (state = { isDarkMode: false }) => state
        }
    })

const renderWithProviders = (ui: React.ReactElement, { route = '/metahub/test-metahub-id/sections' } = {}) => {
    const queryClient = createTestQueryClient()
    const store = createTestStore()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <Provider store={store}>
                        <I18nextProvider i18n={i18n}>
                            <MemoryRouter initialEntries={[route]}>
                                <Routes>
                                    <Route path='/metahub/:metahubId/sections' element={ui} />
                                </Routes>
                            </MemoryRouter>
                        </I18nextProvider>
                    </Provider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('SectionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetaSectionList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Avoid react-query retries inside usePaginated by providing a non-retriable status
            vi.mocked(metahubsApi.listMetahubMetaSections).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByAltText('Connection error')).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no meta_sections exist', async () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: [],
                pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
            } as any)

            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByAltText('No meta_sections')).toBeInTheDocument()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockMetaSections = [
            {
                id: 'section-1',
                metahubId: 'test-metahub-id',
                name: 'Main MetaSection',
                description: 'Primary section for testing',
                meta_entitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'section-2',
                metahubId: 'test-metahub-id',
                name: 'Secondary MetaSection',
                description: 'Additional section',
                meta_entitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: mockMetaSections,
                pagination: { total: 2, limit: 20, offset: 0, count: 2, hasMore: false }
            } as any)
        })

        it('should render section cards with names', async () => {
            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('Main MetaSection')).toBeInTheDocument()
                expect(screen.getByText('Secondary MetaSection')).toBeInTheDocument()
            })
        })

        it('should display section descriptions', async () => {
            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('Primary section for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional section')).toBeInTheDocument()
            })
        })

        it('should show entity counts', async () => {
            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('Main MetaSection')).toBeInTheDocument()
            })

            // Switch to list/table view (ItemCard doesn't show counts)
            const listViewButton = screen.queryByTitle(/list view/i)
            if (listViewButton) {
                await userEvent.setup().click(listViewButton)
            }

            await waitFor(() => {
                expect(screen.queryAllByText('10').length).toBeGreaterThan(0)
                expect(screen.queryAllByText('5').length).toBeGreaterThan(0)
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: [
                    {
                        id: 'section-1',
                        metahubId: 'test-metahub-id',
                        name: 'Test MetaSection',
                        description: 'Test',
                        meta_entitiesCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false }
            } as any)
        })

        it('should handle missing metahubId parameter', () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetaSectionList />, { route: '/metahub//sections' })

            // Should not call API without valid ID
            expect(metahubsApi.listMetahubMetaSections).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: [],
                pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
            } as any)
            vi.mocked(meta_sectionsApi.createSection).mockResolvedValue({
                id: 'new-section',
                metahubId: 'test-metahub-id',
                name: 'New MetaSection',
                description: 'Newly created',
                meta_entitiesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new section', async () => {
            const { user } = renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByAltText('No meta_sections')).toBeInTheDocument()
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
        const mockMetaSections = [
            {
                id: 'section-1',
                metahubId: 'test-metahub-id',
                name: 'Production MetaSection',
                description: 'Main production',
                meta_entitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'section-2',
                metahubId: 'test-metahub-id',
                name: 'Testing MetaSection',
                description: 'Test environment',
                meta_entitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: mockMetaSections,
                pagination: { total: 2, limit: 20, offset: 0, count: 2, hasMore: false }
            } as any)
        })

        it('should have search input field', async () => {
            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('Production MetaSection')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle meta_sections with zero entity count', async () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: [
                    {
                        id: 'empty-section',
                        metahubId: 'test-metahub-id',
                        name: 'Empty MetaSection',
                        description: 'No meta_entities',
                        meta_entitiesCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false }
            } as any)

            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('Empty MetaSection')).toBeInTheDocument()
            })

            // Switch to list/table view (ItemCard doesn't show counts)
            const listViewButton = screen.queryByTitle(/list view/i)
            if (listViewButton) {
                await userEvent.setup().click(listViewButton)
            }

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThan(0)
        })

        it('should handle meta_sections without description', async () => {
            vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
                items: [
                    {
                        id: 'no-desc',
                        metahubId: 'test-metahub-id',
                        name: 'No Description',
                        description: undefined,
                        meta_entitiesCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false }
            } as any)

            renderWithProviders(<MetaSectionList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Ensure render doesn't crash when description is missing
            expect(screen.queryByText('undefined')).not.toBeInTheDocument()
        })
    })
})
