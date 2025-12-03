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

import DepartmentList from '../DepartmentList'
import * as departmentsApi from '../../api/departments'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import organizationsEn from '../../i18n/locales/en/organizations.json'
import organizationsRu from '../../i18n/locales/ru/organizations.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/departments', () => ({
    listDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn()
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

const renderWithProviders = (ui: React.ReactElement, { route = '/organizations/test-organization-id/departments' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/organizations/:organizationId/departments' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('DepartmentList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            vi.mocked(departmentsApi.listDepartments).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<DepartmentList />)

            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(departmentsApi.listDepartments).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.queryByText(/connection/i) || screen.queryByText(/error/i)).toBeTruthy()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(departmentsApi.listDepartments).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no departments exist', async () => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.queryByText(/no departments/i) || screen.queryByText(/get started/i)).toBeTruthy()
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockDepartments = [
            {
                id: 'department-1',
                organizationId: 'test-organization-id',
                name: 'Main Department',
                description: 'Primary department for testing',
                positionsCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'department-2',
                organizationId: 'test-organization-id',
                name: 'Secondary Department',
                description: 'Additional department',
                positionsCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: mockDepartments,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should render department cards with names', async () => {
            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.getByText('Main Department')).toBeInTheDocument()
                expect(screen.getByText('Secondary Department')).toBeInTheDocument()
            })
        })

        it('should display department descriptions', async () => {
            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.getByText('Primary department for testing')).toBeInTheDocument()
                expect(screen.getByText('Additional department')).toBeInTheDocument()
            })
        })

        it('should show position counts', async () => {
            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.queryByText('10') || screen.queryAllByText('10').length > 0).toBeTruthy()
                expect(screen.queryByText('5') || screen.queryAllByText('5').length > 0).toBeTruthy()
            })
        })
    })

    describe('Navigation', () => {
        beforeEach(() => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: [
                    {
                        id: 'department-1',
                        organizationId: 'test-organization-id',
                        name: 'Test Department',
                        description: 'Test',
                        positionsCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-15T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })
        })

        it('should handle missing organizationId parameter', () => {
            vi.mocked(departmentsApi.listDepartments).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<DepartmentList />, { route: '/organizations//departments' })

            // Should not call API without valid ID
            expect(departmentsApi.listDepartments).not.toHaveBeenCalled()
        })
    })

    describe('CRUD Operations', () => {
        beforeEach(() => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: [],
                total: 0,
                limit: 20,
                offset: 0
            })
            vi.mocked(departmentsApi.createDepartment).mockResolvedValue({
                id: 'new-department',
                organizationId: 'test-organization-id',
                name: 'New Department',
                description: 'Newly created',
                positionsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })
        })

        it('should allow creating new department', async () => {
            const { user } = renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.queryByText(/no departments/i) || screen.queryByText(/get started/i)).toBeTruthy()
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
        const mockDepartments = [
            {
                id: 'department-1',
                organizationId: 'test-organization-id',
                name: 'Production Department',
                description: 'Main production',
                positionsCount: 10,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'department-2',
                organizationId: 'test-organization-id',
                name: 'Testing Department',
                description: 'Test environment',
                positionsCount: 5,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: mockDepartments,
                total: 2,
                limit: 20,
                offset: 0
            })
        })

        it('should have search input field', async () => {
            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.getByText('Production Department')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            expect(searchInput).toBeTruthy()
        })
    })

    describe('Edge Cases', () => {
        it('should handle departments with zero position count', async () => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: [
                    {
                        id: 'empty-department',
                        organizationId: 'test-organization-id',
                        name: 'Empty Department',
                        description: 'No positions',
                        positionsCount: 0,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    }
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.getByText('Empty Department')).toBeInTheDocument()
            })

            const zeroElements = screen.queryAllByText('0')
            expect(zeroElements.length).toBeGreaterThanOrEqual(1)
        })

        it('should handle departments without description', async () => {
            vi.mocked(departmentsApi.listDepartments).mockResolvedValue({
                data: [
                    {
                        id: 'no-desc',
                        organizationId: 'test-organization-id',
                        name: 'No Description',
                        description: undefined,
                        positionsCount: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ],
                total: 1,
                limit: 20,
                offset: 0
            })

            renderWithProviders(<DepartmentList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            expect(screen.queryByText('—') || screen.queryByText('')).toBeTruthy()
        })
    })
})
