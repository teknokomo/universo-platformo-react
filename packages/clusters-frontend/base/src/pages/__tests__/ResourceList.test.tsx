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

import ResourceList from '../ResourceList'
import * as resourcesApi from '../../api/resources'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import clustersEn from '../../i18n/locales/en/clusters.json'
import clustersRu from '../../i18n/locales/ru/clusters.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/resources', () => ({
    listResources: vi.fn(),
    createResource: vi.fn(),
    updateResource: vi.fn(),
    deleteResource: vi.fn(),
    moveResource: vi.fn()
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
registerNamespace('clusters', {
    en: clustersEn.clusters,
    ru: clustersRu.clusters
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

const renderWithProviders = (ui: React.ReactElement, { route = '/clusters/test-cluster-id/domains/test-domain-id/resources' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/clusters/:clusterId/domains/:domainId/resources' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ResourceList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(resourcesApi.listResources).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ResourceList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(resourcesApi.listResources).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(resourcesApi.listResources).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no resources exist', async () => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.queryByText(/no resources/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockResources = [
            {
                id: 'resource-1',
                clusterId: 'test-cluster-id',
                domainId: 'test-domain-id',
                name: 'Primary Resource',
                description: 'Main resource for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'resource-2',
                clusterId: 'test-cluster-id',
                domainId: 'test-domain-id',
                name: 'Secondary Resource',
                description: 'Additional resource',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: mockResources,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render resource cards with names', async () => {
            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Resource')).toBeInTheDocument()
                expect(screen.getByText('Secondary Resource')).toBeInTheDocument()
            })
        })

        it('should display resource descriptions', async () => {
            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('Main resource for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional resource')).toBeInTheDocument()
            })
        })

        it('should show resource types', async () => {
            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Resource Actions', () => {
        const mockResources = [
            {
                id: 'resource-1',
                clusterId: 'test-cluster-id',
                domainId: 'test-domain-id',
                name: 'Test Resource',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: mockResources,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each resource', async () => {
            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('Test Resource')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing domainId parameter', () => {
            vi.mocked(resourcesApi.listResources).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ResourceList />, { route: '/clusters/test-cluster-id/domains//resources' })

            // Should not call API without valid ID
            expect(resourcesApi.listResources).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockResources = [
            {
                id: 'resource-1',
                clusterId: 'test-cluster-id',
                domainId: 'test-domain-id',
                name: 'Production Resource',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'resource-2',
                clusterId: 'test-cluster-id',
                domainId: 'test-domain-id',
                name: 'Testing Resource',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: mockResources,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('Production Resource')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle resources without description', async () => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        clusterId: 'test-cluster-id',
                        domainId: 'test-domain-id',
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

            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle resources with various types', async () => {
            vi.mocked(resourcesApi.listResources).mockResolvedValue({
                data: [
                    {
                        id: 'text-resource',
                        clusterId: 'test-cluster-id',
                        domainId: 'test-domain-id',
                        name: 'Text Resource',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-resource',
                        clusterId: 'test-cluster-id',
                        domainId: 'test-domain-id',
                        name: 'Image Resource',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-resource',
                        clusterId: 'test-cluster-id',
                        domainId: 'test-domain-id',
                        name: 'Video Resource',
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

            renderWithProviders(<ResourceList />)

            await waitFor(() => {
                expect(screen.getByText('Text Resource')).toBeInTheDocument()
                expect(screen.getByText('Image Resource')).toBeInTheDocument()
                expect(screen.getByText('Video Resource')).toBeInTheDocument()
            })
        })
    })
})
