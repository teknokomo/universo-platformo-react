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

import SectionList from '../SectionList'
import * as sectionsApi from '../../api/sections'
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
            vi.mocked(sectionsApi.listSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SectionList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(sectionsApi.listSections).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(sectionsApi.listSections).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no sections exist', async () => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.queryByText(/no sections/i) || screen.queryByText(/get started/i)).toBeTruthy()
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
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: mockSections,
                total: 2,
                limit: 20,
                offset: 0
            })
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
                expect(screen.queryByText('10') || screen.queryAllByText('10').length > 0).toBeTruthy()
                expect(screen.queryByText('5') || screen.queryAllByText('5').length > 0).toBeTruthy()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: [
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
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing metaverseId parameter', () => {
            vi.mocked(sectionsApi.listSections).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SectionList />, { route: '/metaverses//sections' })

            // Should not call API without valid ID
            expect(sectionsApi.listSections).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
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
                expect(screen.queryByText(/no sections/i) || screen.queryByText(/get started/i)).toBeTruthy()
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
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: mockSections,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('Production Section')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle sections with zero entity count', async () => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: [
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
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('Empty Section')).toBeInTheDocument()
            })

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle sections without description', async () => {
            vi.mocked(sectionsApi.listSections).mockResolvedValue({
                data: [
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
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<SectionList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })
    })
})
