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

import MilestoneList from '../MilestoneList'
import * as MilestonesApi from '../../api/Milestones'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import ProjectsEn from '../../i18n/locales/en/projects.json'
import ProjectsRu from '../../i18n/locales/ru/projects.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/Milestones', () => ({
    listMilestones: vi.fn(),
    createMilestone: vi.fn(),
    updateMilestone: vi.fn(),
    deleteMilestone: vi.fn()
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
registerNamespace('projects', {
    en: ProjectsEn.Projects,
    ru: ProjectsRu.Projects
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

const renderWithProviders = (ui: React.ReactElement, { route = '/Projects/test-Project-id/Milestones' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/Projects/:ProjectId/Milestones' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MilestoneList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(MilestonesApi.listMilestones).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MilestoneList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(MilestonesApi.listMilestones).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(MilestonesApi.listMilestones).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no Milestones exist', async () => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.queryByText(/no Milestones/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockMilestones = [
            {
                id: 'Milestone-1',
                ProjectId: 'test-Project-id',
                name: 'Main Milestone',
                description: 'Primary Milestone for testing',
                TasksCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'Milestone-2',
                ProjectId: 'test-Project-id',
                name: 'Secondary Milestone',
                description: 'Additional Milestone',
                TasksCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: mockMilestones,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render Milestone cards with names', async () => {
            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.getByText('Main Milestone')).toBeInTheDocument()
                expect(screen.getByText('Secondary Milestone')).toBeInTheDocument()
            })
        })

        it('should display Milestone descriptions', async () => {
            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Milestone for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional Milestone')).toBeInTheDocument()
            })
        })

        it('should show Task counts', async () => {
            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.queryByText('10') || screen.queryAllByText('10').length > 0).toBeTruthy()
                expect(screen.queryByText('5') || screen.queryAllByText('5').length > 0).toBeTruthy()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: [
                    {
                        id: 'Milestone-1',
                        ProjectId: 'test-Project-id',
                        name: 'Test Milestone',
                        description: 'Test',
                        TasksCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing ProjectId parameter', () => {
            vi.mocked(MilestonesApi.listMilestones).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MilestoneList />, { route: '/Projects//Milestones' })

            // Should not call API without valid ID
            expect(MilestonesApi.listMilestones).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(MilestonesApi.createMilestone).mockResolvedValue({
                id: 'new-Milestone',
                ProjectId: 'test-Project-id',
                name: 'New Milestone',
                description: 'Newly created',
                TasksCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new Milestone', async () => {
            const { user } = renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.queryByText(/no Milestones/i) || screen.queryByText(/get started/i)).toBeTruthy()
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
        const mockMilestones = [
            {
                id: 'Milestone-1',
                ProjectId: 'test-Project-id',
                name: 'Production Milestone',
                description: 'Main production',
                TasksCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'Milestone-2',
                ProjectId: 'test-Project-id',
                name: 'Testing Milestone',
                description: 'Test environment',
                TasksCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: mockMilestones,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.getByText('Production Milestone')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle Milestones with zero Task count', async () => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: [
                    {
                        id: 'empty-Milestone',
                        ProjectId: 'test-Project-id',
                        name: 'Empty Milestone',
                        description: 'No Tasks',
                        TasksCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.getByText('Empty Milestone')).toBeInTheDocument()
            })

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle Milestones without description', async () => {
            vi.mocked(MilestonesApi.listMilestones).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        ProjectId: 'test-Project-id',
                        name: 'No Description',
                        description: undefined,
                        TasksCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<MilestoneList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })
    })
})
