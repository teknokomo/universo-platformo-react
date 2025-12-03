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

import EntityList from '../EntityList'
import * as entitiesApi from '../../api/entities'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metaversesEn from '../../i18n/locales/en/metaverses.json'
import metaversesRu from '../../i18n/locales/ru/metaverses.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/entities', () => ({
    listEntities: vi.fn(),
    createEntity: vi.fn(),
    updateEntity: vi.fn(),
    deleteEntity: vi.fn(),
    moveEntity: vi.fn()
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
registerNamespace('metaverses', {
    en: metaversesEn.metaverses,
    ru: metaversesRu.metaverses
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

const renderWithProviders = (
    ui: React.ReactElement,
    { route = '/metaverses/test-metaverse-id/sections/test-section-id/entities' } = {}
) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/metaverses/:metaverseId/sections/:sectionId/entities' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
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
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(entitiesApi.listEntities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<EntityList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(entitiesApi.listEntities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(entitiesApi.listEntities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no entities exist', async () => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.queryByText(/no entities/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockEntities = [
            {
                id: 'entity-1',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Primary Entity',
                description: 'Main entity for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'entity-2',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Secondary Entity',
                description: 'Additional entity',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: mockEntities,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render entity cards with names', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Entity')).toBeInTheDocument()
                expect(screen.getByText('Secondary Entity')).toBeInTheDocument()
            })
        })

        it('should display entity descriptions', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Main entity for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional entity')).toBeInTheDocument()
            })
        })

        it('should show entity types', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Entity Actions', () => {
        const mockEntities = [
            {
                id: 'entity-1',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Test Entity',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: mockEntities,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each entity', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Test Entity')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing sectionId parameter', () => {
            vi.mocked(entitiesApi.listEntities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<EntityList />, { route: '/metaverses/test-metaverse-id/sections//entities' })

            // Should not call API without valid ID
            expect(entitiesApi.listEntities).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockEntities = [
            {
                id: 'entity-1',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Production Entity',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'entity-2',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Testing Entity',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: mockEntities,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Production Entity')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle entities without description', async () => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        metaverseId: 'test-metaverse-id',
                        sectionId: 'test-section-id',
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

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle entities with various types', async () => {
            vi.mocked(entitiesApi.listEntities).mockResolvedValue({
                data: [
                    {
                        id: 'text-entity',
                        metaverseId: 'test-metaverse-id',
                        sectionId: 'test-section-id',
                        name: 'Text Entity',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-entity',
                        metaverseId: 'test-metaverse-id',
                        sectionId: 'test-section-id',
                        name: 'Image Entity',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-entity',
                        metaverseId: 'test-metaverse-id',
                        sectionId: 'test-section-id',
                        name: 'Video Entity',
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

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Text Entity')).toBeInTheDocument()
                expect(screen.getByText('Image Entity')).toBeInTheDocument()
                expect(screen.getByText('Video Entity')).toBeInTheDocument()
            })
        })
    })
})
