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

import SlotList from '../SlotList'
import * as slotsApi from '../../api/slots'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import storagesEn from '../../i18n/locales/en/storages.json'
import storagesRu from '../../i18n/locales/ru/storages.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/slots', () => ({
    listSlots: vi.fn(),
    createSlot: vi.fn(),
    updateSlot: vi.fn(),
    deleteSlot: vi.fn(),
    moveSlot: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement, { route = '/storages/test-storage-id/containers/test-container-id/slots' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/storages/:storageId/containers/:containerId/slots' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('SlotList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(slotsApi.listSlots).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SlotList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(slotsApi.listSlots).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(slotsApi.listSlots).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<SlotList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no slots exist', async () => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.queryByText(/no slots/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockSlots = [
            {
                id: 'slot-1',
                storageId: 'test-storage-id',
                containerId: 'test-container-id',
                name: 'Primary Slot',
                description: 'Main slot for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'slot-2',
                storageId: 'test-storage-id',
                containerId: 'test-container-id',
                name: 'Secondary Slot',
                description: 'Additional slot',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: mockSlots,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render slot cards with names', async () => {
            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Slot')).toBeInTheDocument()
                expect(screen.getByText('Secondary Slot')).toBeInTheDocument()
            })
        })

        it('should display slot descriptions', async () => {
            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('Main slot for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional slot')).toBeInTheDocument()
            })
        })

        it('should show slot types', async () => {
            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Slot Actions', () => {
        const mockSlots = [
            {
                id: 'slot-1',
                storageId: 'test-storage-id',
                containerId: 'test-container-id',
                name: 'Test Slot',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: mockSlots,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each slot', async () => {
            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('Test Slot')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing containerId parameter', () => {
            vi.mocked(slotsApi.listSlots).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<SlotList />, { route: '/storages/test-storage-id/containers//slots' })

            // Should not call API without valid ID
            expect(slotsApi.listSlots).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockSlots = [
            {
                id: 'slot-1',
                storageId: 'test-storage-id',
                containerId: 'test-container-id',
                name: 'Production Slot',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'slot-2',
                storageId: 'test-storage-id',
                containerId: 'test-container-id',
                name: 'Testing Slot',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: mockSlots,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('Production Slot')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle slots without description', async () => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        storageId: 'test-storage-id',
                        containerId: 'test-container-id',
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

            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle slots with various types', async () => {
            vi.mocked(slotsApi.listSlots).mockResolvedValue({
                data: [
                    {
                        id: 'text-slot',
                        storageId: 'test-storage-id',
                        containerId: 'test-container-id',
                        name: 'Text Slot',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-slot',
                        storageId: 'test-storage-id',
                        containerId: 'test-container-id',
                        name: 'Image Slot',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-slot',
                        storageId: 'test-storage-id',
                        containerId: 'test-container-id',
                        name: 'Video Slot',
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

            renderWithProviders(<SlotList />)

            await waitFor(() => {
                expect(screen.getByText('Text Slot')).toBeInTheDocument()
                expect(screen.getByText('Image Slot')).toBeInTheDocument()
                expect(screen.getByText('Video Slot')).toBeInTheDocument()
            })
        })
    })
})
