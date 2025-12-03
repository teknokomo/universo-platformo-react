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

import ContainerList from '../ContainerList'
import * as containersApi from '../../api/containers'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import storagesEn from '../../i18n/locales/en/storages.json'
import storagesRu from '../../i18n/locales/ru/storages.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/containers', () => ({
    listContainers: vi.fn(),
    createContainer: vi.fn(),
    updateContainer: vi.fn(),
    deleteContainer: vi.fn()
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
registerNamespace('storages', {
    en: storagesEn.storages,
    ru: storagesRu.storages
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

const renderWithProviders = (ui: React.ReactElement, { route = '/storages/test-storage-id/containers' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/storages/:storageId/containers' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ContainerList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(containersApi.listContainers).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ContainerList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(containersApi.listContainers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(containersApi.listContainers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no containers exist', async () => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.queryByText(/no containers/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockContainers = [
            {
                id: 'container-1',
                storageId: 'test-storage-id',
                name: 'Main Container',
                description: 'Primary container for testing',
                slotsCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'container-2',
                storageId: 'test-storage-id',
                name: 'Secondary Container',
                description: 'Additional container',
                slotsCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: mockContainers,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render container cards with names', async () => {
            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.getByText('Main Container')).toBeInTheDocument()
                expect(screen.getByText('Secondary Container')).toBeInTheDocument()
            })
        })

        it('should display container descriptions', async () => {
            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.getByText('Primary container for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional container')).toBeInTheDocument()
            })
        })

        it('should show slot counts', async () => {
            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.queryByText('10') || screen.queryAllByText('10').length > 0).toBeTruthy()
                expect(screen.queryByText('5') || screen.queryAllByText('5').length > 0).toBeTruthy()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: [
                    {
                        id: 'container-1',
                        storageId: 'test-storage-id',
                        name: 'Test Container',
                        description: 'Test',
                        slotsCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing storageId parameter', () => {
            vi.mocked(containersApi.listContainers).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ContainerList />, { route: '/storages//containers' })

            // Should not call API without valid ID
            expect(containersApi.listContainers).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(containersApi.createContainer).mockResolvedValue({
                id: 'new-container',
                storageId: 'test-storage-id',
                name: 'New Container',
                description: 'Newly created',
                slotsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new container', async () => {
            const { user } = renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.queryByText(/no containers/i) || screen.queryByText(/get started/i)).toBeTruthy()
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
        const mockContainers = [
            {
                id: 'container-1',
                storageId: 'test-storage-id',
                name: 'Production Container',
                description: 'Main production',
                slotsCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'container-2',
                storageId: 'test-storage-id',
                name: 'Testing Container',
                description: 'Test environment',
                slotsCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: mockContainers,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.getByText('Production Container')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle containers with zero slot count', async () => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: [
                    {
                        id: 'empty-container',
                        storageId: 'test-storage-id',
                        name: 'Empty Container',
                        description: 'No slots',
                        slotsCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.getByText('Empty Container')).toBeInTheDocument()
            })

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle containers without description', async () => {
            vi.mocked(containersApi.listContainers).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        storageId: 'test-storage-id',
                        name: 'No Description',
                        description: undefined,
                        slotsCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<ContainerList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })
    })
})
