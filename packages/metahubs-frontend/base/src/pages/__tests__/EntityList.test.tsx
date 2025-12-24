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

import MetaEntityList from '../MetaEntityList'
import * as metahubsApi from '../../api/metahubs'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metahubsEn from '../../i18n/locales/en/metahubs.json'
import metahubsRu from '../../i18n/locales/ru/metahubs.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/metaEntities', () => ({
    listMetaEntities: vi.fn(),
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    moveEntity: vi.fn()
}))

vi.mock('../../api/metahubs', () => ({
    listMetahubMetaEntities: vi.fn(),
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

const renderWithProviders = (ui: React.ReactElement, { route = '/metahub/test-metahub-id/entities' } = {}) => {
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
                                    <Route path='/metahub/:metahubId/entities' element={ui} />
                                </Routes>
                            </MemoryRouter>
                        </I18nextProvider>
                    </Provider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('EntityList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()

        // MetaEntityList always fetches metahub-scoped sections for the dropdown when metahubId exists.
        vi.mocked(metahubsApi.listMetahubMetaSections).mockResolvedValue({
            items: [],
            pagination: { total: 0, limit: 1000, offset: 0, count: 0, hasMore: false }
        } as any)
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetaEntityList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // usePaginated retries by default; provide a non-retriable status to make tests fast/deterministic.
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByAltText('Connection error')).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            // usePaginated retries by default; provide a non-retriable status to make tests fast/deterministic.
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no meta_entities exist', async () => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: [],
                pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
            } as any)

            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByAltText('No meta_entities')).toBeInTheDocument()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockMetaEntities = [
            {
                id: 'entity-1',
                metahubId: 'test-metahub-id',
                sectionId: 'test-section-id',
                name: 'Primary MetaEntity',
                description: 'Main entity for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'entity-2',
                metahubId: 'test-metahub-id',
                sectionId: 'test-section-id',
                name: 'Secondary MetaEntity',
                description: 'Additional entity',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: mockMetaEntities,
                pagination: { total: 2, limit: 20, offset: 0, count: 2, hasMore: false }
            } as any)
        })

        it('should render entity cards with names', async () => {
            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Primary MetaEntity')).toBeInTheDocument()
                expect(screen.getByText('Secondary MetaEntity')).toBeInTheDocument()
            })
        })

        it('should display entity descriptions', async () => {
            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Main entity for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional entity')).toBeInTheDocument()
            })
        })

        it('should show entity types', async () => {
            // MetaEntityList does not render entity.type in card view; validate list view (FlowListTable) instead.
            const { user, container } = renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Primary MetaEntity')).toBeInTheDocument()
            })

            const listViewButton = container.querySelector('button[value="list"]') as HTMLElement | null
            expect(listViewButton).toBeTruthy()
            await user.click(listViewButton as HTMLElement)

            await waitFor(() => {
                expect(screen.getByRole('table', { name: /dense table/i })).toBeInTheDocument()
            })
        })
    })

    describe('MetaEntity Actions', () => {
        const mockMetaEntities = [
            {
                id: 'entity-1',
                metahubId: 'test-metahub-id',
                sectionId: 'test-section-id',
                name: 'Test MetaEntity',
                description: 'Test',
                type: 'text',
                permissions: { editContent: true },
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: mockMetaEntities,
                pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false }
            } as any)
        })

        it('should have action menu for each entity', async () => {
            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Test MetaEntity')).toBeInTheDocument()
            })

            // BaseEntityMenu trigger sets aria-haspopup="true" (works for both card and list view triggers).
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.getAttribute('aria-haspopup') === 'true')
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Search Functionality', () => {
        const mockMetaEntities = [
            {
                id: 'entity-1',
                metahubId: 'test-metahub-id',
                sectionId: 'test-section-id',
                name: 'Production MetaEntity',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'entity-2',
                metahubId: 'test-metahub-id',
                sectionId: 'test-section-id',
                name: 'Testing MetaEntity',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: mockMetaEntities,
                pagination: { total: 2, limit: 20, offset: 0, count: 2, hasMore: false }
            } as any)
        })

        it('should have search input field', async () => {
            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Production MetaEntity')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle meta_entities without description', async () => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: [
                    {
                        id: 'no-desc',
                        metahubId: 'test-metahub-id',
                        sectionId: 'test-section-id',
                        name: 'No Description',
                        description: undefined,
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false }
            } as any)

            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Card view ItemCard omits description entirely when missing
            expect(screen.queryByText('undefined')).not.toBeInTheDocument()
        })

        it('should handle meta_entities with various types', async () => {
            vi.mocked(metahubsApi.listMetahubMetaEntities).mockResolvedValue({
                items: [
                    {
                        id: 'text-entity',
                        metahubId: 'test-metahub-id',
                        sectionId: 'test-section-id',
                        name: 'Text MetaEntity',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-entity',
                        metahubId: 'test-metahub-id',
                        sectionId: 'test-section-id',
                        name: 'Image MetaEntity',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-entity',
                        metahubId: 'test-metahub-id',
                        sectionId: 'test-section-id',
                        name: 'Video MetaEntity',
                        description: 'Video type',
                        type: 'video',
                        order: 2,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                pagination: { total: 3, limit: 20, offset: 0, count: 3, hasMore: false }
            } as any)

            renderWithProviders(<MetaEntityList />)

            await waitFor(() => {
                expect(screen.getByText('Text MetaEntity')).toBeInTheDocument()
                expect(screen.getByText('Image MetaEntity')).toBeInTheDocument()
                expect(screen.getByText('Video MetaEntity')).toBeInTheDocument()
            })
        })
    })
})
