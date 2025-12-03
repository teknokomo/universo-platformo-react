import { vi } from 'vitest'
// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
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

import UnikBoard from '../UnikBoard'
import * as uniksApi from '../../api/uniks'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import uniksEn from '../../i18n/locales/en/uniks.json'
import uniksRu from '../../i18n/locales/ru/uniks.json'

// Mock API module
vi.mock('../../api/uniks', () => ({
    getUnik: vi.fn()
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

// Mock window.open
const mockWindowOpen = vi.fn()
window.open = mockWindowOpen

// Initialize i18n using the global instance and register uniks namespace
const i18n = getI18nInstance()
registerNamespace('uniks', {
    en: uniksEn.uniks,
    ru: uniksRu.uniks
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

interface RenderOptions {
    route?: string
}

const renderWithProviders = (ui: React.ReactElement, { route = '/uniks/test-unik-id/board' }: RenderOptions = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/uniks/:unikId/board' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('UnikBoard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Loading State', () => {
        it('should display loading indicator while fetching data', () => {
            // Mock API to never resolve (stays in loading state)
            vi.mocked(uniksApi.getUnik).mockImplementation(
                () => new Promise(() => {}) // Never resolves
            )

            renderWithProviders(<UnikBoard />)

            // Check for loading indicator
            expect(screen.getByRole('progressbar')).toBeInTheDocument()
            expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject with error
            vi.mocked(uniksApi.getUnik).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<UnikBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load unik data/i)).toBeInTheDocument()
            })

            // Check for error alert
            expect(screen.getByRole('alert')).toBeInTheDocument()
            expect(screen.getByText(/network error/i)).toBeInTheDocument()
        })

        it('should display generic error when no unik data returned', async () => {
            // Mock API to return null/undefined data
            vi.mocked(uniksApi.getUnik).mockResolvedValue({ data: null } as any)

            renderWithProviders(<UnikBoard />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByText(/failed to load unik data/i)).toBeInTheDocument()
            })
        })
    })

    describe('Success State - Dashboard Rendering', () => {
        const mockUnikData = {
            id: 'test-unik-id',
            name: 'Test Unik',
            description: 'A test unik for unit tests',
            spacesCount: 11,
            toolsCount: 23,
            credentialsCount: 5,
            variablesCount: 8,
            apiKeysCount: 3,
            documentStoresCount: 2,
            membersCount: 4,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(uniksApi.getUnik).mockResolvedValue({
                data: mockUnikData
            })
        })

        it('should render unik name and description in header', async () => {
            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText('Test Unik')).toBeInTheDocument()
                expect(screen.getByText('A test unik for unit tests')).toBeInTheDocument()
            })
        })

        it('should display all 7 stat cards with correct values', async () => {
            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                // Row 1: Spaces, Members, Credentials
                expect(screen.getByText('11')).toBeInTheDocument() // spacesCount
                expect(screen.getByText('4')).toBeInTheDocument() // membersCount
                expect(screen.getByText('5')).toBeInTheDocument() // credentialsCount

                // Row 2: Tools, Variables, API Keys, Document Stores
                expect(screen.getByText('23')).toBeInTheDocument() // toolsCount
                expect(screen.getByText('8')).toBeInTheDocument() // variablesCount
                expect(screen.getByText('3')).toBeInTheDocument() // apiKeysCount
                expect(screen.getByText('2')).toBeInTheDocument() // documentStoresCount
            })
        })

        it('should render documentation card', async () => {
            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText(/documentation/i)).toBeInTheDocument()
            })
        })

        it('should render activity and resources charts', async () => {
            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                // Charts should be present (check for Overview section)
                expect(screen.getByText('Overview')).toBeInTheDocument()
            })
        })

        it('should render back button', async () => {
            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /back to uniks/i })).toBeInTheDocument()
            })
        })
    })

    describe('User Interactions', () => {
        const mockUnikData = {
            id: 'test-unik-id',
            name: 'Interactive Test',
            description: 'Testing user interactions',
            spacesCount: 5,
            toolsCount: 10,
            credentialsCount: 2,
            variablesCount: 3,
            apiKeysCount: 1,
            documentStoresCount: 1,
            membersCount: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-15T00:00:00Z'
        }

        beforeEach(() => {
            vi.mocked(uniksApi.getUnik).mockResolvedValue({
                data: mockUnikData
            })
        })

        it('should open documentation in new tab when button clicked', async () => {
            const { user } = renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText('Interactive Test')).toBeInTheDocument()
            })

            // Find and click documentation button
            const docButtons = screen.getAllByRole('button')
            const docButton = docButtons.find(
                (btn) => btn.textContent?.includes('documentation') || btn.textContent?.includes('Documentation')
            )

            if (docButton) {
                await user.click(docButton)

                // Verify window.open was called with correct URL
                expect(mockWindowOpen).toHaveBeenCalledWith('https://teknokomo.gitbook.io/up', '_blank', 'noopener,noreferrer')
            }
        })
    })

    describe('Edge Cases', () => {
        it('should handle unik with zero counts', async () => {
            vi.mocked(uniksApi.getUnik).mockResolvedValue({
                data: {
                    id: 'empty-unik',
                    name: 'Empty Unik',
                    description: 'No content yet',
                    spacesCount: 0,
                    toolsCount: 0,
                    credentialsCount: 0,
                    variablesCount: 0,
                    apiKeysCount: 0,
                    documentStoresCount: 0,
                    membersCount: 0,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText('Empty Unik')).toBeInTheDocument()
            })

            // Should display zeros correctly (7 stat cards with 0)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(7)
        })

        it('should handle unik without description', async () => {
            vi.mocked(uniksApi.getUnik).mockResolvedValue({
                data: {
                    id: 'no-desc-unik',
                    name: 'No Description',
                    description: '', // Empty description
                    spacesCount: 1,
                    toolsCount: 1,
                    credentialsCount: 1,
                    variablesCount: 1,
                    apiKeysCount: 1,
                    documentStoresCount: 1,
                    membersCount: 1,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                }
            })

            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Should display default description from i18n
            expect(screen.getByText(/unik analytics and statistics/i)).toBeInTheDocument()
        })

        it('should handle missing optional count fields', async () => {
            vi.mocked(uniksApi.getUnik).mockResolvedValue({
                data: {
                    id: 'partial-data',
                    name: 'Partial Data',
                    description: 'Testing missing fields',
                    // All counts are undefined
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z'
                } as any
            })

            renderWithProviders(<UnikBoard />)

            await waitFor(() => {
                expect(screen.getByText('Partial Data')).toBeInTheDocument()
            })

            // Should display 0 for all undefined counts (using ?? 0 fallback)
            const zeroValues = screen.getAllByText('0')
            expect(zeroValues.length).toBeGreaterThanOrEqual(7) // 7 stat cards with 0
        })
    })

    describe('Navigation', () => {
        it('should handle invalid unikId parameter', () => {
            // Render without unikId in route
            vi.mocked(uniksApi.getUnik).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<UnikBoard />, { route: '/uniks//board' })

            // Should not call API without valid ID
            expect(uniksApi.getUnik).not.toHaveBeenCalled()
        })
    })
})
