import { vi } from 'vitest'
// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
// rehype-mathjax 4.0.3 has jsdom 20.0.3 as a direct dependency
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

// MetaverseMembers list-view uses FlowListTable which may depend on app-level providers.
// For page-level tests we stub FlowListTable and still execute column/action callbacks
// to increase coverage of page wiring.
vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<any>('@universo/template-mui')
    return {
        ...actual,
        FlowListTable: (props: any) => {
            const rows = Array.isArray(props?.data) ? props.data : []
            const firstRow = rows[0]
            const cols = Array.isArray(props?.customColumns) ? props.customColumns : []
            const renderedCells = firstRow ? cols.map((c: any) => (typeof c?.render === 'function' ? c.render(firstRow) : null)) : []
            const actions = firstRow && typeof props?.renderActions === 'function' ? props.renderActions(firstRow) : null

            return (
                <div data-testid='flow-list-table'>
                    <div data-testid='flow-list-table-cells'>
                        {renderedCells.map((cell: any, idx: number) => (
                            <div key={idx}>{cell}</div>
                        ))}
                    </div>
                    <div data-testid='flow-list-table-actions'>{actions}</div>
                    {rows.map((r: any) => (
                        <div key={r.id || r.email}>{r.email}</div>
                    ))}
                </div>
            )
        }
    }
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import MetaverseMembers from '../MetaverseMembers'
import * as metaversesApi from '../../api/metaverses'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import metaversesEn from '../../i18n/locales/en/metaverses.json'
import metaversesRu from '../../i18n/locales/ru/metaverses.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

// Mock API module
vi.mock('../../api/metaverses', () => ({
    listMetaverseMembers: vi.fn(),
    inviteMetaverseMember: vi.fn(),
    updateMetaverseMemberRole: vi.fn(),
    removeMetaverseMember: vi.fn()
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

// Mock backend utilities to avoid unnecessary dependencies in frontend tests
vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
        isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
        isApiError: vi.fn((error: any) => !!error?.response),
        getApiBaseURL: vi.fn(() => 'http://localhost:3000')
    }
})

// Mock markdown components that require rehype/remark (which pull jsdom)
vi.mock('@flowise/template-mui', async () => {
    const actual = await vi.importActual<any>('@flowise/template-mui')
    return {
        ...actual,
        InputHintDialog: vi.fn(() => null)
    }
})

// Initialize i18n using the global instance and register metaverses namespace
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
            // NOTE: `usePaginated` sets `retry` per-query; keep retries fast for tests.
            queries: { retry: false, retryDelay: 0 },
            mutations: { retry: false }
        }
    })

type PaginationMeta = { total: number; limit: number; offset: number }
const paginated = <T,>(items: T[], meta: PaginationMeta) => ({
    items,
    pagination: {
        ...meta,
        count: items.length,
        hasMore: meta.offset + items.length < meta.total
    }
})

const renderWithProviders = (ui: React.ReactElement, { route = '/metaverses/test-metaverse-id/members' } = {}) => {
    const queryClient = createTestQueryClient()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/metaverses/:metaverseId/members' element={ui} />
                                <Route path='/members' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('MetaverseMembers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        localStorage.clear()
        localStorage.setItem('metaverseMembersDisplayStyle', 'card')
        // Default mock: return empty list with proper structure
        vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
    })

    describe('Component rendering with happy-dom', () => {
        it('should render component with translated UI elements', () => {
            renderWithProviders(<MetaverseMembers />)

            // Check that basic UI elements are rendered with translations
            expect(screen.getByText(/access/i)).toBeInTheDocument()
            expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
        })

        it('should render view toggle buttons', () => {
            renderWithProviders(<MetaverseMembers />)

            // Verify view toggle buttons exist
            expect(screen.getByTitle(/card view/i)).toBeInTheDocument()
            expect(screen.getByTitle(/list view/i)).toBeInTheDocument()
        })

        it('should render toolbar with search and controls', () => {
            const { container } = renderWithProviders(<MetaverseMembers />)

            // Verify toolbar is rendered
            expect(container.querySelector('.MuiToolbar-root')).toBeInTheDocument()

            // Verify search input
            expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
        })
    })

    describe('Empty state', () => {
        it('should display empty state message when no members exist', async () => {
            renderWithProviders(<MetaverseMembers />)

            // Wait for empty state to appear
            await waitFor(() => {
                expect(screen.getByAltText('No members')).toBeInTheDocument()
            })
        })
    })

    describe('Loading state', () => {
        it('should display skeleton loader while fetching members', () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    items: [],
                                    pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
                                } as any),
                            1000
                        )
                    )
            )

            const { container } = renderWithProviders(<MetaverseMembers />)

            // Verify skeleton is shown initially by checking for MUI Skeleton elements
            const skeletons = container.querySelectorAll('.MuiSkeleton-root')
            expect(skeletons.length).toBeGreaterThan(0)
        })
    })

    // NOTE: Additional tests for data fetching, interactions, and form validation
    // require proper MSW setup or alternative API mocking strategies.
    // These are omitted for now as the current vi.mock setup doesn't intercept
    // the API calls made through usePaginated hook.

    describe('Success state - Members list', () => {
        const mockMembers = [
            {
                id: 'member-1',
                userId: 'user-1',
                metaverseId: 'test-metaverse-id',
                role: 'admin',
                email: 'admin@example.com',
                nickname: 'Admin User',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'member-2',
                userId: 'user-2',
                metaverseId: 'test-metaverse-id',
                role: 'editor',
                email: 'editor@example.com',
                nickname: 'Editor User',
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(paginated(mockMembers, { total: 2, limit: 20, offset: 0 }))
        })

        it('should render member cards with names and emails', async () => {
            renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByText('admin@example.com')).toBeInTheDocument()
                expect(screen.getByText('editor@example.com')).toBeInTheDocument()
                // In card view, email is the title; nickname renders in description.
                expect(screen.getByText('Admin User')).toBeInTheDocument()
                expect(screen.getByText('Editor User')).toBeInTheDocument()
            })
        })

        it('should display member roles', async () => {
            renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Error handling', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetaverseMembers />)

            await waitFor(
                () => {
                    expect(screen.getByAltText('Connection error')).toBeInTheDocument()
                },
                { timeout: 5000 }
            )
        })

        it('should show retry button on error', async () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<MetaverseMembers />)

            await waitFor(
                () => {
                    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
                },
                { timeout: 5000 }
            )
        })
    })

    describe('Search functionality', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'member-1',
                            userId: 'user-1',
                            metaverseId: 'test-metaverse-id',
                            role: 'admin',
                            email: 'admin@example.com',
                            nickname: 'Admin User',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
        })

        it('should have search input with placeholder', async () => {
            renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            })
        })

        it('should update search field on user input', async () => {
            const { user } = renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByText('Admin User')).toBeInTheDocument()
            })

            const searchInput = screen.getByPlaceholderText(/search members/i)
            await user.type(searchInput, 'admin')

            expect(searchInput).toHaveValue('admin')
        })
    })

    describe('Edge cases', () => {
        it('should handle members without names', async () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'member-1',
                            userId: 'user-1',
                            metaverseId: 'test-metaverse-id',
                            role: 'member',
                            email: 'noname@example.com',
                            nickname: undefined,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )

            renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByText('noname@example.com')).toBeInTheDocument()
            })
        })

        it('should handle large member lists', async () => {
            const largeMemberList = Array.from({ length: 100 }, (_, i) => ({
                id: `member-${i}`,
                userId: `user-${i}`,
                metaverseId: 'test-metaverse-id',
                role: i % 3 === 0 ? 'admin' : i % 3 === 1 ? 'editor' : 'member',
                email: `user${i}@example.com`,
                nickname: `User ${i}`,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(
                paginated(largeMemberList.slice(0, 20), { total: 100, limit: 20, offset: 0 })
            )

            renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByText('User 0')).toBeInTheDocument()
            })

            // Should show pagination for large lists
            const tablePagination = document.querySelector('.MuiTablePagination-root')
            expect(tablePagination).toBeTruthy()
        })
    })

    describe('Navigation', () => {
        it('should handle missing metaverseId parameter', () => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<MetaverseMembers />, { route: '/members' })

            // Should not call API without valid metaverseId
            expect(metaversesApi.listMetaverseMembers).not.toHaveBeenCalled()

            // Should render invalid metaverse empty state
            expect(screen.getByAltText('Invalid metaverse')).toBeInTheDocument()
        })
    })

    describe('View Toggle', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(
                paginated(
                    [
                        {
                            id: 'member-1',
                            userId: 'test-user-id',
                            metaverseId: 'test-metaverse-id',
                            role: 'admin',
                            email: 'admin@example.com',
                            nickname: 'Admin',
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
        })

        it('should persist view preference to localStorage and render list view', async () => {
            const { user } = renderWithProviders(<MetaverseMembers />)

            await waitFor(() => {
                expect(screen.getByText('admin@example.com')).toBeInTheDocument()
            })

            const listViewToggle = document.querySelector('button[title="List View"]') as HTMLElement | null
            expect(listViewToggle).toBeTruthy()

            await user.click(listViewToggle!)

            await waitFor(() => {
                expect(localStorage.getItem('metaverseMembersDisplayStyle')).toBe('list')
                expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
            })
        })
    })

    describe('Invite error branches', () => {
        beforeEach(() => {
            vi.mocked(metaversesApi.listMetaverseMembers).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
        })

        it('should show userNotFound message on 404', async () => {
            vi.mocked(metaversesApi.inviteMetaverseMember).mockRejectedValue({ response: { status: 404 } })

            const { user } = renderWithProviders(<MetaverseMembers />)

            const addButton = await screen.findByRole('button', { name: /add/i })
            await user.click(addButton)

            const dialog = await screen.findByRole('dialog')
            const emailInput = await within(dialog).findByLabelText(/email/i)
            await user.type(emailInput, 'missing@example.com')

            const saveButton = screen.getByRole('button', { name: /save/i })
            await user.click(saveButton)

            await waitFor(() => {
                expect(vi.mocked(metaversesApi.inviteMetaverseMember)).toHaveBeenCalled()
                expect(within(dialog).getByRole('alert')).toHaveTextContent(/missing@example.com/i)
            })
        })

        it('should show userAlreadyMember message on 409 + api code', async () => {
            vi.mocked(metaversesApi.inviteMetaverseMember).mockRejectedValue({ response: { status: 409, data: { code: 'METAVERSE_MEMBER_EXISTS' } } })

            const { user } = renderWithProviders(<MetaverseMembers />)

            const addButton = await screen.findByRole('button', { name: /add/i })
            await user.click(addButton)

            const dialog = await screen.findByRole('dialog')
            const emailInput = await within(dialog).findByLabelText(/email/i)
            await user.type(emailInput, 'exists@example.com')

            const saveButton = screen.getByRole('button', { name: /save/i })
            await user.click(saveButton)

            await waitFor(() => {
                expect(vi.mocked(metaversesApi.inviteMetaverseMember)).toHaveBeenCalled()
                expect(within(dialog).getByRole('alert')).toHaveTextContent(/exists@example.com/i)
            })
        })
    })
})
