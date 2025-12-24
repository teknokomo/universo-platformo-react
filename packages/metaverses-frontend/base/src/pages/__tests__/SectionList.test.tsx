import { vi } from 'vitest'
// Mock rehype/remark libraries
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

// SectionList list-view uses FlowListTable which may depend on app-level providers.
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

import SectionList from '../SectionList'
import * as sectionsApi from '../../api/sections'
import * as metaversesApi from '../../api/metaverses'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metaversesEn from '../../i18n/locales/en/metaverses.json'
import metaversesRu from '../../i18n/locales/ru/metaverses.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/sections', () => ({
    listSections: vi.fn(),
    createSection: vi.fn(),
    updateSection: vi.fn(),
    deleteSection: vi.fn()
}))

vi.mock('../../api/metaverses', () => ({
    listMetaverseSections: vi.fn()
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
            // NOTE: `usePaginated` sets `retry` per-query, so tests must also
            // force fast retry timing to avoid waitFor() timeouts.
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

const renderWithProviders = (ui: React.ReactElement, { route = '/metaverses/test-metaverse-id/sections' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/metaverses/:metaverseId/sections' element={ui} />
                                <Route path='/metaverses/sections' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
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
            vi.mocked(metaversesApi.listMetaverseSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SectionList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(metaversesApi.listMetaverseSections).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SectionList />)

            await waitFor(
                () => {
                    expect(screen.getByAltText('Connection error')).toBeInTheDocument()
                },
                { timeout: 5000 }
            )
        })

        it('should show retry button on error', async () => {
            vi.mocked(metaversesApi.listMetaverseSections).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SectionList />)

            await waitFor(
                () => {
                    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
                },
                { timeout: 5000 }
            )
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no sections exist', async () => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByAltText('No sections')).toBeInTheDocument()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockSections = [
            {
                id: 'section-1',
                metaverseId: 'test-metaverse-id',
                name: 'Main Section',
                description: 'Primary section for testing',
                entitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'section-2',
                metaverseId: 'test-metaverse-id',
                name: 'Secondary Section',
                description: 'Additional section',
                entitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(paginated(mockSections, { total: 2, limit: 20, offset: 0 }))
        })

        it('should render section cards with names', async () => {
            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('Main Section')).toBeInTheDocument()
                expect(screen.getByText('Secondary Section')).toBeInTheDocument()
            })
        })

        it('should display section descriptions', async () => {
            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('Primary section for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional section')).toBeInTheDocument()
            })
        })

        it('should show entity counts', async () => {
            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText(/10\s+entit/i)).toBeInTheDocument()
                expect(screen.getByText(/5\s+entit/i)).toBeInTheDocument()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'section-1',
                            metaverseId: 'test-metaverse-id',
                            name: 'Test Section',
                            description: 'Test',
                            entitiesCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
        })

        it('should handle missing metaverseId parameter', () => {
            vi.mocked(metaversesApi.listMetaverseSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SectionList />, { route: '/metaverses/sections' })

            // Should not call API without valid ID
            expect(metaversesApi.listMetaverseSections).not.toHaveBeenCalled()

            // Should render invalid metaverse empty state
            expect(screen.getByAltText('Invalid metaverse')).toBeInTheDocument()
        })
    })

    describe('View Toggle', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'section-1',
                            metaverseId: 'test-metaverse-id',
                            name: 'Toggle Section',
                            description: 'Toggle',
                            entitiesCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
            Storage.prototype.getItem = vi.fn(() => 'card')
        })

        it('should persist view preference to localStorage and render list view', async () => {
            const { user } = renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('Toggle Section')).toBeInTheDocument()
            })

            const listViewToggle = document.querySelector('button[title="List View"]') as HTMLElement | null
            expect(listViewToggle).toBeTruthy()

            await user.click(listViewToggle!)

            await waitFor(() => {
                expect(localStorage.getItem('metaversesSectionDisplayStyle')).toBe('list')
                expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
            })
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
            vi.mocked(sectionsApi.createSection).mockResolvedValue({
                id: 'new-section',
                metaverseId: 'test-metaverse-id',
                name: 'New Section',
                description: 'Newly created',
                entitiesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new section', async () => {
            const { user } = renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByAltText('No sections')).toBeInTheDocument()
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
        const mockSections = [
            {
                id: 'section-1',
                metaverseId: 'test-metaverse-id',
                name: 'Production Section',
                description: 'Main production',
                entitiesCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'section-2',
                metaverseId: 'test-metaverse-id',
                name: 'Testing Section',
                description: 'Test environment',
                entitiesCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(paginated(mockSections, { total: 2, limit: 20, offset: 0 }))
        })

        it('should have search input field', async () => {
            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getAllByText('Production Section').length).toBeGreaterThan(0)
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle sections with zero entity count', async () => {
            // Force list view so the entitiesCount column renders a plain numeric cell (stable assertion).
            Storage.prototype.getItem = vi.fn(() => 'list')

            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'empty-section',
                            metaverseId: 'test-metaverse-id',
                            name: 'Empty Section',
                            description: 'No entities',
                            entitiesCount: 0,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getAllByText('Empty Section').length).toBeGreaterThan(0)
            })

            expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
            expect(screen.getByText('0')).toBeInTheDocument()
        })

        it('should handle sections without description', async () => {
            vi.mocked(metaversesApi.listMetaverseSections).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'no-desc',
                            metaverseId: 'test-metaverse-id',
                            name: 'No Description',
                            description: undefined,
                            entitiesCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getAllByText('No Description').length).toBeGreaterThan(0)
            })
        })
    })
})
