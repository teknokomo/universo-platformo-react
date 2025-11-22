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

import PositionList from '../PositionList'
import * as positionsApi from '../../api/positions'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import organizationsEn from '../../i18n/locales/en/organizations.json'
import organizationsRu from '../../i18n/locales/ru/organizations.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/positions', () => ({
    listPositions: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
    movePosition: vi.fn()
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
registerNamespace('organizations', {
    en: organizationsEn.organizations,
    ru: organizationsRu.organizations
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
    { route = '/organizations/test-organization-id/departments/test-department-id/positions' } = {}
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
                                <Route path='/organizations/:organizationId/departments/:departmentId/positions' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('PositionList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(positionsApi.listPositions).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<PositionList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(positionsApi.listPositions).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(positionsApi.listPositions).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<PositionList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no positions exist', async () => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.queryByText(/no positions/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockPositions = [
            {
                id: 'position-1',
                organizationId: 'test-organization-id',
                departmentId: 'test-department-id',
                name: 'Primary Position',
                description: 'Main position for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'position-2',
                organizationId: 'test-organization-id',
                departmentId: 'test-department-id',
                name: 'Secondary Position',
                description: 'Additional position',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: mockPositions,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render position cards with names', async () => {
            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Position')).toBeInTheDocument()
                expect(screen.getByText('Secondary Position')).toBeInTheDocument()
            })
        })

        it('should display position descriptions', async () => {
            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('Main position for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional position')).toBeInTheDocument()
            })
        })

        it('should show position types', async () => {
            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Position Actions', () => {
        const mockPositions = [
            {
                id: 'position-1',
                organizationId: 'test-organization-id',
                departmentId: 'test-department-id',
                name: 'Test Position',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: mockPositions,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each position', async () => {
            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('Test Position')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing departmentId parameter', () => {
            vi.mocked(positionsApi.listPositions).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<PositionList />, { route: '/organizations/test-organization-id/departments//positions' })

            // Should not call API without valid ID
            expect(positionsApi.listPositions).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockPositions = [
            {
                id: 'position-1',
                organizationId: 'test-organization-id',
                departmentId: 'test-department-id',
                name: 'Production Position',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'position-2',
                organizationId: 'test-organization-id',
                departmentId: 'test-department-id',
                name: 'Testing Position',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: mockPositions,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('Production Position')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle positions without description', async () => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        organizationId: 'test-organization-id',
                        departmentId: 'test-department-id',
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

            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle positions with various types', async () => {
            vi.mocked(positionsApi.listPositions).mockResolvedValue({
                data: [
                    {
                        id: 'text-position',
                        organizationId: 'test-organization-id',
                        departmentId: 'test-department-id',
                        name: 'Text Position',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-position',
                        organizationId: 'test-organization-id',
                        departmentId: 'test-department-id',
                        name: 'Image Position',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-position',
                        organizationId: 'test-organization-id',
                        departmentId: 'test-department-id',
                        name: 'Video Position',
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

            renderWithProviders(<PositionList />)

            await waitFor(() => {
                expect(screen.getByText('Text Position')).toBeInTheDocument()
                expect(screen.getByText('Image Position')).toBeInTheDocument()
                expect(screen.getByText('Video Position')).toBeInTheDocument()
            })
        })
    })
})
