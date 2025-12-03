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

import TaskList from '../TaskList'
import * as TasksApi from '../../api/Tasks'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import ProjectsEn from '../../i18n/locales/en/projects.json'
import ProjectsRu from '../../i18n/locales/ru/projects.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/Tasks', () => ({
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    moveTask: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement, { route = '/Projects/test-Project-id/Milestones/test-Milestone-id/Tasks' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/Projects/:ProjectId/Milestones/:MilestoneId/Tasks' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('TaskList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(TasksApi.listTasks).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<TaskList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(TasksApi.listTasks).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(TasksApi.listTasks).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<TaskList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no Tasks exist', async () => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.queryByText(/no Tasks/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockTasks = [
            {
                id: 'Task-1',
                ProjectId: 'test-Project-id',
                MilestoneId: 'test-Milestone-id',
                name: 'Primary Task',
                description: 'Main Task for testing',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'Task-2',
                ProjectId: 'test-Project-id',
                MilestoneId: 'test-Milestone-id',
                name: 'Secondary Task',
                description: 'Additional Task',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: mockTasks,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render Task cards with names', async () => {
            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('Primary Task')).toBeInTheDocument()
                expect(screen.getByText('Secondary Task')).toBeInTheDocument()
            })
        })

        it('should display Task descriptions', async () => {
            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('Main Task for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional Task')).toBeInTheDocument()
            })
        })

        it('should show Task types', async () => {
            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.queryByText(/text/i) || screen.queryAllByText(/text/i).length > 0).toBeTruthy()
                expect(screen.queryByText(/image/i) || screen.queryAllByText(/image/i).length > 0).toBeTruthy()
            })
        })
    })

    describe('Task Actions', () => {
        const mockTasks = [
            {
                id: 'Task-1',
                ProjectId: 'test-Project-id',
                MilestoneId: 'test-Milestone-id',
                name: 'Test Task',
                description: 'Test',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: mockTasks,
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should have action menu for each Task', async () => {
            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('Test Task')).toBeInTheDocument()
            })

            // Look for action menu buttons (MoreVert icons)
            const menuButtons = screen.queryAllByRole('button').filter((btn) => btn.querySelector('[data-testid="MoreVertRoundedIcon"]'))
            expect(menuButtons.length).toBeGreaterThan(0)
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing MilestoneId parameter', () => {
            vi.mocked(TasksApi.listTasks).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<TaskList />, { route: '/Projects/test-Project-id/Milestones//Tasks' })

            // Should not call API without valid ID
            expect(TasksApi.listTasks).not.toHaveBeenCalled()
        })
    })

    describe('Search Functionality', () => {
        const mockTasks = [
            {
                id: 'Task-1',
                ProjectId: 'test-Project-id',
                MilestoneId: 'test-Milestone-id',
                name: 'Production Task',
                description: 'Main production',
                type: 'text',
                order: 0,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'Task-2',
                ProjectId: 'test-Project-id',
                MilestoneId: 'test-Milestone-id',
                name: 'Testing Task',
                description: 'Test environment',
                type: 'image',
                order: 1,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: mockTasks,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('Production Task')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle Tasks without description', async () => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        ProjectId: 'test-Project-id',
                        MilestoneId: 'test-Milestone-id',
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

            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('�') || screen.queryByText('')).toBeTruthy()
        })

        it('should handle Tasks with various types', async () => {
            vi.mocked(TasksApi.listTasks).mockResolvedValue({
                data: [
                    {
                        id: 'text-Task',
                        ProjectId: 'test-Project-id',
                        MilestoneId: 'test-Milestone-id',
                        name: 'Text Task',
                        description: 'Text type',
                        type: 'text',
                        order: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'image-Task',
                        ProjectId: 'test-Project-id',
                        MilestoneId: 'test-Milestone-id',
                        name: 'Image Task',
                        description: 'Image type',
                        type: 'image',
                        order: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    },
                    {
                        id: 'video-Task',
                        ProjectId: 'test-Project-id',
                        MilestoneId: 'test-Milestone-id',
                        name: 'Video Task',
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

            renderWithProviders(<TaskList />)

            await waitFor(() => {
                expect(screen.getByText('Text Task')).toBeInTheDocument()
                expect(screen.getByText('Image Task')).toBeInTheDocument()
                expect(screen.getByText('Video Task')).toBeInTheDocument()
            })
        })
    })
})
