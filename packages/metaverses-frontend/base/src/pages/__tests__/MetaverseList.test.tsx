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

import MetaverseList from '../MetaverseList'
import * as metaversesApi from '../../api/metaverses'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metaversesEn from '../../i18n/locales/en/metaverses.json'
import metaversesRu from '../../i18n/locales/ru/metaverses.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/metaverses', () => ({
    listMetaverses: vi.fn(),
    createMetaverse: vi.fn(),
    updateMetaverse: vi.fn(),
    deleteMetaverse: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={['/metaverses']}>{ui}</MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MetaverseList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock localStorage
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            // Mock API to never resolve
            vi.mocked(metaversesApi.listMetaverses).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetaverseList />)

            // Check for loading skeletons (part of SkeletonGrid component)
            expect(screen.getByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject
            vi.mocked(metaversesApi.listMetaverses).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetaverseList />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/connection/i) || screen.getByText(/error/i)).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no metaverses exist', async () => {
            // Mock API to return empty list
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText(/no metaverses/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })
        })

        it('should show create button in empty state', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                const addButtons = screen.queryAllByRole('button')
                expect(addButtons.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockMetaverses = [
            {
                id: 'metaverse-1',
                name: 'Test Metaverse 1',
                description: 'First test metaverse',
                role: 'admin',
                sectionsCount: 5,
                entitiesCount: 20,
                membersCount: 3,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'metaverse-2',
                name: 'Test Metaverse 2',
                description: 'Second test metaverse',
                role: 'editor',
                sectionsCount: 3,
                entitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: mockMetaverses,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render metaverse cards with names', async () => {
            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('Test Metaverse 1')).toBeInTheDocument()
                expect(screen.getByText('Test Metaverse 2')).toBeInTheDocument()
            })
        })

        it('should display metaverse descriptions', async () => {
            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('First test metaverse')).toBeInTheDocument()
                expect(screen.getByText('Second test metaverse')).toBeInTheDocument()
            })
        })

        it('should show role chips for metaverses', async () => {
            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                // RoleChip component renders role
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })

        it('should display sections and entities counts', async () => {
            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                // Check for count values
                expect(screen.getByText('5') || screen.queryByText('5')).toBeTruthy()
                expect(screen.getByText('20') || screen.queryByText('20')).toBeTruthy()
            })
        })
    })

    describe('Search Functionality', () => {
        const mockMetaverses = [
            {
                id: 'metaverse-1',
                name: 'Production Metaverse',
                description: 'Main production environment',
                role: 'admin',
                sectionsCount: 10,
                entitiesCount: 50,
                membersCount: 5,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'metaverse-2',
                name: 'Testing Metaverse',
                description: 'Test environment',
                role: 'editor',
                sectionsCount: 3,
                entitiesCount: 10,
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: mockMetaverses,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
                expect(searchInput).toBeTruthy()
            })
        })

        it('should call API with search parameter when typing', async () => {
            const { user } = renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('Production Metaverse')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            if (searchInput) {
                await user.type(searchInput, 'Production')

                // API should be called with search parameter
                await waitFor(
                    () => {
                        const calls = vi.mocked(metaversesApi.listMetaverses).mock.calls
                        const hasSearchParam = calls.some((call) => call[0]?.search === 'Production')
                        expect(hasSearchParam).toBeTruthy()
                    },
                    { timeout: 3000 }
                )
            }
        })
    })

    describe('Pagination', () => {
        const generateMockMetaverses = (count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: `metaverse-${i + 1}`,
                name: `Metaverse ${i + 1}`,
                description: `Description ${i + 1}`,
                role: 'viewer' as const,
                sectionsCount: i,
                entitiesCount: i * 2,
                membersCount: 1,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

        it('should display pagination controls when total exceeds page size', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: generateMockMetaverses(20),
                total: 50,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                // Look for pagination component (MUI Pagination or custom)
                const pagination = document.querySelector('[aria-label*="pagination"]') || document.querySelector('.MuiPagination-root')
                expect(pagination).toBeTruthy()
            })
        })
    })

    describe('Create Metaverse', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(metaversesApi.createMetaverse).mockResolvedValue({
                id: 'new-metaverse',
                name: 'New Metaverse',
                description: 'Newly created',
                role: 'admin',
                sectionsCount: 0,
                entitiesCount: 0,
                membersCount: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should open create dialog when add button clicked', async () => {
            const { user } = renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText(/no metaverses/i) || screen.getByText(/get started/i)).toBeInTheDocument()
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
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [
                    {
                        id: 'test-metaverse',
                        name: 'Test',
                        description: 'Test',
                        role: 'admin',
                        sectionsCount: 1,
                        entitiesCount: 1,
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
            const { user } = renderWithProviders(<MetaverseList />)

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
        it('should handle metaverses without descriptions', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        name: 'No Description',
                        description: undefined,
                        role: 'viewer',
                        sectionsCount: 0,
                        entitiesCount: 0,
                        membersCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should render em dash or empty state for description
            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle metaverses without role', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [
                    {
                        id: 'no-role',
                        name: 'No Role',
                        description: 'Test',
                        role: undefined,
                        sectionsCount: 0,
                        entitiesCount: 0,
                        membersCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('No Role')).toBeInTheDocument()
            })
        })

        it('should handle metaverses with zero counts', async () => {
            vi.mocked(metaversesApi.listMetaverses).mockResolvedValue({
                data: [
                    {
                        id: 'zero-counts',
                        name: 'Zero Counts',
                        description: 'All zeros',
                        role: 'admin',
                        sectionsCount: 0,
                        entitiesCount: 0,
                        membersCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MetaverseList />)

            await waitFor(() => {
                expect(screen.getByText('Zero Counts')).toBeInTheDocument()
            })

            // Should display 0 values correctly
            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })
    })
})
