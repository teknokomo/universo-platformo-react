import { vi } from 'vitest'
// Mock rehype/remark libraries
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

// EntityList list-view uses FlowListTable which may depend on app-level providers.
// For page-level tests we stub FlowListTable and still execute column/action callbacks
// to increase coverage of page wiring.
vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<any>('@universo/template-mui')
    return {
        ...actual,
        FlowListTable: (props: any) => {
            const rows = Array.isArray(props?.data) ? props.data : []
            const firstRow = rows[0]
            const cols = Array.isArray(props?.customColumns) ? props.customColumns : []
            const renderedCells = firstRow ? cols.map((c: any) => (typeof c?.render === 'function' ? c.render(firstRow) : null)) : []
            const actions = firstRow && typeof props?.renderActions === 'function' ? props.renderActions(firstRow) : null

            return (
                <div data-testid='flow-list-table'>
                    <div data-testid='flow-list-table-cells'>
                        {renderedCells.map((cell: any, idx: number) => (
                            <div key={idx}>{cell}</div>
                        ))}
                    </div>
                    <div data-testid='flow-list-table-actions'>{actions}</div>
                    {rows.map((r: any) => (
                        <div key={r.id || r.name}>{r.name}</div>
                    ))}
                </div>
            )
        }
    }
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import EntityList from '../EntityList'
import * as metaversesApi from '../../api/metaverses'
import * as entitiesApi from '../../api/entities'
import * as sectionsApi from '../../api/sections'
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

vi.mock('../../api/metaverses', () => ({
    listMetaverseEntities: vi.fn(),
    listMetaverseSections: vi.fn()
}))

vi.mock('../../api/sections', () => ({
    listSections: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn()
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
            queries: { retry: false, retryDelay: 0 },
            mutations: { retry: false }
        }
    })

type PaginationMeta = { total: number; limit: number; offset: number }
const paginated = <T,>(items: T[], meta: PaginationMeta) => ({
    items,
    pagination: {
        ...meta,
        count: items.length,
        hasMore: meta.offset + items.length < meta.total
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
                                <Route path='/entities' element={ui} />
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
        localStorage.clear()
        localStorage.setItem('metaversesEntityDisplayStyle', 'card')

        vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(
            paginated(
                [
                    {
                        id: 'test-section-id',
                        metaverseId: 'test-metaverse-id',
                        name: 'Test Section',
                        description: 'Test',
                        entitiesCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    } as any
                ],
                { total: 1, limit: 1000, offset: 0 }
            )
        )
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<EntityList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByAltText('Connection error')).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<EntityList />)

            expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no entities exist', async () => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByAltText('No entities')).toBeInTheDocument()
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
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated(mockEntities, { total: 2, limit: 20, offset: 0 }))
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

        it('should render pagination controls when data exists', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(document.querySelector('.MuiTablePagination-root')).toBeTruthy()
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
                permissions: { editContent: true },
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated(mockEntities, { total: 1, limit: 20, offset: 0 }))
        })

        it('should have action menu for each entity', async () => {
            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Test Entity')).toBeInTheDocument()
            })

            // Menu trigger button is created by BaseEntityMenu and has aria-haspopup
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.getAttribute('aria-haspopup') === 'true')
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
        })

        it('should use global list APIs when metaverseId is missing', async () => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'global-section-id',
                            metaverseId: 'some-metaverse',
                            name: 'Global Section',
                            description: 'Global',
                            entitiesCount: 0,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1, limit: 1000, offset: 0 }
                )
            )
            vi.mocked(entitiesApi.listEntities).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }) as any)

            renderWithProviders(<EntityList />, { route: '/entities' })

            await waitFor(() => {
                expect(entitiesApi.listEntities).toHaveBeenCalled()
            })
        })
    })

    describe('View Toggle', () => {
        const mockEntities = [
            {
                id: 'entity-1',
                metaverseId: 'test-metaverse-id',
                sectionId: 'test-section-id',
                name: 'Toggle Entity',
                description: 'Toggle',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated(mockEntities, { total: 1, limit: 20, offset: 0 }))
        })

        it('should persist view preference to localStorage and render list view', async () => {
            const { user } = renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Toggle Entity')).toBeInTheDocument()
            })

            const listViewToggle = document.querySelector('button[title="List View"]') as HTMLElement | null
            expect(listViewToggle).toBeTruthy()

            await user.click(listViewToggle!)

            await waitFor(() => {
                expect(localStorage.getItem('metaversesEntityDisplayStyle')).toBe('list')
                expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
            })
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
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(paginated(mockEntities, { total: 2, limit: 20, offset: 0 }))
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
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(
                paginated(
                    [
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
                    { total: 1, limit: 20, offset: 0 }
                )
            )

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })
        })

        it('should handle entities with various types', async () => {
            vi.mocked(metaversesApi.listMetaverseEntities).mockResolvedValue(
                paginated(
                    [
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
                    { total: 3, limit: 20, offset: 0 }
                )
            )

            renderWithProviders(<EntityList />)

            await waitFor(() => {
                expect(screen.getByText('Text Entity')).toBeInTheDocument()
                expect(screen.getByText('Image Entity')).toBeInTheDocument()
                expect(screen.getByText('Video Entity')).toBeInTheDocument()
            })
        })
    })
})
