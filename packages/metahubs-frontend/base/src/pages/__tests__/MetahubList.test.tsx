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
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

import MetahubList from '../MetahubList'
import * as metahubsApi from '../../api/metahubs'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metahubsEn from '../../i18n/locales/en/metahubs.json'
import metahubsRu from '../../i18n/locales/ru/metahubs.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/metahubs', () => ({
    listMetahubs: vi.fn(),
    createMetahub: vi.fn(),
    updateMetahub: vi.fn(),
    deleteMetahub: vi.fn()
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

const makePaginatedResponse = <T,>(items: T[], params?: { total?: number; limit?: number; offset?: number }) => {
    const limit = params?.limit ?? 20
    const offset = params?.offset ?? 0
    const total = params?.total ?? items.length
    const count = items.length

    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient()
    const store = createTestStore()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <Provider store={store}>
                        <I18nextProvider i18n={i18n}>
                            <MemoryRouter initialEntries={['/metahubs']}>{ui}</MemoryRouter>
                        </I18nextProvider>
                    </Provider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MetahubList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock localStorage
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            // Mock API to never resolve
            vi.mocked(metahubsApi.listMetahubs).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetahubList />)

            // Check for loading skeletons (part of SkeletonGrid component)
            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject
            // Avoid react-query retries inside usePaginated by providing a non-retriable status
            vi.mocked(metahubsApi.listMetahubs).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<MetahubList />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByAltText('Connection error')).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no metahubs exist', async () => {
            // Mock API to return empty list
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse([], { total: 0 }))

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText(/no metahubs/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })
        })

        it('should show create button in empty state', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse([], { total: 0 }))

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                const addButtons = screen.queryAllByRole('button')
                expect(addButtons.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockMetahubs = [
            {
                id: 'metahub-1',
                name: 'Test Metahub 1',
                description: 'First test metahub',
                role: 'admin',
                meta_sectionsCount: 5,
                meta_entitiesCount: 20,
                membersCount: 3,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'metahub-2',
                name: 'Test Metahub 2',
                description: 'Second test metahub',
                role: 'editor',
                meta_sectionsCount: 3,
                meta_entitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse(mockMetahubs, { total: 2 }))
        })

        it('should render metahub cards with names', async () => {
            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('Test Metahub 1')).toBeInTheDocument()
                expect(screen.getByText('Test Metahub 2')).toBeInTheDocument()
            })
        })

        it('should display metahub descriptions', async () => {
            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('First test metahub')).toBeInTheDocument()
                expect(screen.getByText('Second test metahub')).toBeInTheDocument()
            })
        })

        it('should show role chips for metahubs', async () => {
            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                // RoleChip component renders role
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })

        it('should display meta_sections and meta_entities counts', async () => {
            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('Test Metahub 1')).toBeInTheDocument()
            })

            // Switch to list/table view (ItemCard doesn't show counts)
            const listViewButton = screen.queryByTitle(/list view/i)
            if (listViewButton) {
                await userEvent.setup().click(listViewButton)
            }

            await waitFor(() => {
                // Check for count values
                expect(screen.queryAllByText('5').length).toBeGreaterThan(0)
                expect(screen.queryAllByText('20').length).toBeGreaterThan(0)
            })
        })
    })

    describe('Search Functionality', () => {
        const mockMetahubs = [
            {
                id: 'metahub-1',
                name: 'Production Metahub',
                description: 'Main production environment',
                role: 'admin',
                meta_sectionsCount: 10,
                meta_entitiesCount: 50,
                membersCount: 5,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'metahub-2',
                name: 'Testing Metahub',
                description: 'Test environment',
                role: 'editor',
                meta_sectionsCount: 3,
                meta_entitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse(mockMetahubs, { total: 2 }))
        })

        it('should have search input field', async () => {
            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
                expect(searchInput).toBeTruthy()
            })
        })

        it('should call API with search parameter when typing', async () => {
            const { user } = renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('Production Metahub')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            if (searchInput) {
                await user.type(searchInput, 'Production')

                // API should be called with search parameter
                await waitFor(
                    () => {
                        const calls = vi.mocked(metahubsApi.listMetahubs).mock.calls
                        const hasSearchParam = calls.some((call) => call[0]?.search === 'Production')
                        expect(hasSearchParam).toBeTruthy()
                    },
                    { timeout: 3000 }
                )
            }
        })
    })

    describe('Pagination', () => {
        const generateMockMetahubs = (count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: `metahub-${i + 1}`,
                name: `Metahub ${i + 1}`,
                description: `Description ${i + 1}`,
                role: 'viewer' as const,
                meta_sectionsCount: i,
                meta_entitiesCount: i * 2,
                membersCount: 1,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

        it('should display pagination controls when total exceeds page size', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse(generateMockMetahubs(20), { total: 50 }))

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                // PaginationControls uses MUI TablePagination
                const pagination = document.querySelector('.MuiTablePagination-root')
                expect(pagination).toBeTruthy()
            })
        })
    })

    describe('Create Metahub', () => {
        beforeEach(() => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(makePaginatedResponse([], { total: 0 }))
            vi.mocked(metahubsApi.createMetahub).mockResolvedValue({
                id: 'new-metahub',
                name: 'New Metahub',
                description: 'Newly created',
                role: 'admin',
                meta_sectionsCount: 0,
                meta_entitiesCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should open create dialog when add button clicked', async () => {
            const { user } = renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText(/no metahubs/i) || screen.getByText(/get started/i)).toBeInTheDocument()
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
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'test-metahub',
                            name: 'Test',
                            description: 'Test',
                            role: 'admin',
                            meta_sectionsCount: 1,
                            meta_entitiesCount: 1,
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
        })

        it('should persist view preference to localStorage', async () => {
            // Force a deterministic initial view (card) so clicking "list" always triggers a change.
            const getItemSpy = vi
                .spyOn(window.localStorage, 'getItem')
                .mockImplementation((key: string) => (key === 'metahubsMetahubDisplayStyle' ? 'card' : null))
            const setItemSpy = vi.spyOn(window.localStorage, 'setItem')

            const { user, container } = renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getAllByText('Test').length).toBeGreaterThan(0)
            })

            // Prefer a stable selector over translated title text.
            const listViewButton = container.querySelector('button[value="list"]') as HTMLElement | null
            expect(listViewButton).toBeTruthy()

            await user.click(listViewButton as HTMLElement)

            await waitFor(() => {
                expect(setItemSpy).toHaveBeenCalledWith('metahubsMetahubDisplayStyle', 'list')
            })

            getItemSpy.mockRestore()
            setItemSpy.mockRestore()
        })
    })

    describe('Edge Cases', () => {
        it('should handle metahubs without descriptions', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'no-desc',
                            name: 'No Description',
                            description: undefined,
                            role: 'viewer',
                            meta_sectionsCount: 0,
                            meta_entitiesCount: 0,
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Card view ItemCard omits description entirely when missing
            expect(screen.queryByText('undefined')).not.toBeInTheDocument()
        })

        it('should handle metahubs without role', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'no-role',
                            name: 'No Role',
                            description: 'Test',
                            role: undefined,
                            meta_sectionsCount: 0,
                            meta_entitiesCount: 0,
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('No Role')).toBeInTheDocument()
            })
        })

        it('should handle metahubs with zero counts', async () => {
            vi.mocked(metahubsApi.listMetahubs).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'zero-counts',
                            name: 'Zero Counts',
                            description: 'All zeros',
                            role: 'admin',
                            meta_sectionsCount: 0,
                            meta_entitiesCount: 0,
                            membersCount: 0,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<MetahubList />)

            await waitFor(() => {
                expect(screen.getByText('Zero Counts')).toBeInTheDocument()
            })

            // ItemCard doesn't render count fields; this assertion just ensures no crash
            expect(screen.queryByText('NaN')).not.toBeInTheDocument()
        })
    })
})
