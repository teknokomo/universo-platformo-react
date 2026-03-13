import type { ReactElement, ReactNode } from 'react'
import { vi } from 'vitest'
// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
// rehype-mathjax 4.0.3 has jsdom 20.0.3 as a direct dependency
const createNoopTransformer = () => undefined
const createNoopPlugin = () => createNoopTransformer
vi.mock('rehype-mathjax', () => ({ default: createNoopPlugin }))
vi.mock('rehype-raw', () => ({ default: createNoopPlugin }))
vi.mock('remark-gfm', () => ({ default: createNoopPlugin }))
vi.mock('remark-math', () => ({ default: createNoopPlugin }))

const enqueueSnackbar = vi.fn()
type TemplateMuiModule = typeof import('@universo/template-mui')
type NotistackModule = typeof import('notistack')
type UtilsModule = typeof import('@universo/utils')
type MockHttpError = {
    message?: string
    response?: {
        status?: number
        data?: {
            code?: string
        }
    }
}
type ApplicationsNamespaceBundle = {
    applications?: Record<string, unknown>
    meta_sections?: Record<string, unknown>
    meta_entities?: Record<string, unknown>
    members?: Record<string, unknown>
}
type MockFlowListTableColumn = {
    render?: (row: ApplicationMember, index: number) => ReactNode
}
type MockFlowListTableProps = {
    data?: ApplicationMember[]
    customColumns?: MockFlowListTableColumn[]
    renderActions?: (row: ApplicationMember) => ReactNode
}

const getMockHttpError = (error: unknown): MockHttpError => (typeof error === 'object' && error !== null ? (error as MockHttpError) : {})

const extractErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message
    }
    return getMockHttpError(error).message || 'Unknown error'
}

const createMember = (overrides: Partial<ApplicationMember> = {}): ApplicationMember => ({
    id: 'member-default',
    userId: 'user-default',
    email: 'member@example.com',
    nickname: 'Member User',
    role: 'member',
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides
})

const createNeverPromise = (): Promise<never> => new Promise<never>((resolve) => void resolve)

// ApplicationMembers list-view uses FlowListTable which may depend on app-level providers.
// For page-level tests we stub FlowListTable and still execute column/action callbacks
// to increase coverage of page wiring.
vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<TemplateMuiModule>('@universo/template-mui')
    return {
        ...actual,
        FlowListTable: (props: MockFlowListTableProps) => {
            const rows = Array.isArray(props?.data) ? props.data : []
            const firstRow = rows[0]
            const cols = Array.isArray(props?.customColumns) ? props.customColumns : []
            const renderedCells = firstRow
                ? cols.map((column, index) => (typeof column?.render === 'function' ? column.render(firstRow, index) : null))
                : []
            const actions = firstRow && typeof props?.renderActions === 'function' ? props.renderActions(firstRow) : null

            return (
                <div data-testid='flow-list-table'>
                    <div data-testid='flow-list-table-cells'>
                        {renderedCells.map((cell, idx) => (
                            <div key={idx}>{cell}</div>
                        ))}
                    </div>
                    <div data-testid='flow-list-table-actions'>{actions}</div>
                    {rows.map((row, index) => (
                        <div key={row.id || row.email || `row-${index}`}>{row.email}</div>
                    ))}
                </div>
            )
        },
        InputHintDialog: vi.fn(() => null)
    }
})

vi.mock('notistack', async () => {
    const actual = await vi.importActual<NotistackModule>('notistack')
    return {
        ...actual,
        SnackbarProvider: ({ children }: { children: ReactNode }) => children,
        useSnackbar: () => ({ enqueueSnackbar })
    }
})

import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'

import ApplicationMembers from '../ApplicationMembers'
import * as applicationsApi from '../../api/applications'
import { STORAGE_KEYS } from '../../constants/storage'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import applicationsEn from '../../i18n/locales/en/applications.json'
import applicationsRu from '../../i18n/locales/ru/applications.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

vi.mock('../../api/applications', () => ({
    getApplication: vi.fn(),
    listApplicationMembers: vi.fn(),
    inviteApplicationMember: vi.fn(),
    updateApplicationMemberRole: vi.fn(),
    removeApplicationMember: vi.fn()
}))

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

vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<UtilsModule>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: vi.fn((error: unknown) => {
            const apiError = getMockHttpError(error)
            return {
                message: extractErrorMessage(error),
                code: apiError.response?.data?.code,
                status: apiError.response?.status
            }
        }),
        isHttpStatus: vi.fn((error: unknown, status: number) => getMockHttpError(error).response?.status === status),
        isApiError: vi.fn((error: unknown, code?: string) => {
            const errorCode = getMockHttpError(error).response?.data?.code
            return code ? errorCode === code : Boolean(getMockHttpError(error).response)
        }),
        getApiBaseURL: vi.fn(() => 'http://localhost:3000')
    }
})

const i18n = getI18nInstance()
const consolidateApplicationsNamespace = (bundle: ApplicationsNamespaceBundle) => ({
    ...(bundle?.applications ?? {}),
    meta_sections: bundle?.meta_sections ?? {},
    meta_entities: bundle?.meta_entities ?? {},
    members: bundle?.members ?? {}
})

registerNamespace('applications', {
    en: consolidateApplicationsNamespace(applicationsEn),
    ru: consolidateApplicationsNamespace(applicationsRu)
})
registerNamespace('common', {
    en: commonEn,
    ru: commonRu
})

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
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

const renderWithProviders = async (ui: ReactElement, { route = '/a/test-application-id/admin/access' } = {}) => {
    const queryClient = createTestQueryClient()

    let renderResult: ReturnType<typeof render>

    await act(async () => {
        renderResult = render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <I18nextProvider i18n={i18n}>
                        <MemoryRouter initialEntries={[route]}>
                            <Routes>
                                <Route path='/a/:applicationId/admin/access' element={ui} />
                                <Route path='/access' element={ui} />
                            </Routes>
                        </MemoryRouter>
                    </I18nextProvider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    })

    return {
        user: userEvent.setup(),
        ...renderResult!
    }
}

describe('ApplicationMembers', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        enqueueSnackbar.mockClear()
        localStorage.clear()
        localStorage.setItem('applicationMembersDisplayStyle', 'card')

        vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
    })

    describe('Component rendering with happy-dom', () => {
        it('should render component with translated UI elements', async () => {
            await renderWithProviders(<ApplicationMembers />)

            expect(screen.getByText(/access/i)).toBeInTheDocument()
            expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
        })

        it('should render view toggle buttons', async () => {
            await renderWithProviders(<ApplicationMembers />)

            expect(screen.getByTitle(/card view/i)).toBeInTheDocument()
            expect(screen.getByTitle(/list view/i)).toBeInTheDocument()
        })
    })

    describe('Empty state', () => {
        it('should display empty state message when no members exist', async () => {
            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByAltText('No members')).toBeInTheDocument()
            })
        })
    })

    describe('Loading state', () => {
        it('should display skeleton loader while fetching members', async () => {
            vi.mocked(applicationsApi.listApplicationMembers).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    items: [],
                                    pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false }
                                }),
                            1000
                        )
                    )
            )

            const { container } = await renderWithProviders(<ApplicationMembers />)

            const skeletons = container.querySelectorAll('.MuiSkeleton-root')
            expect(skeletons.length).toBeGreaterThan(0)
        })
    })

    describe('Success state - Members list', () => {
        const mockMembers = [
            createMember({
                id: 'member-1',
                userId: 'user-1',
                role: 'admin',
                email: 'admin@example.com',
                nickname: 'Admin User',
                createdAt: '2024-01-01T00:00:00Z'
            }),
            createMember({
                id: 'member-2',
                userId: 'user-2',
                role: 'editor',
                email: 'editor@example.com',
                nickname: 'Editor User',
                createdAt: '2024-01-02T00:00:00Z'
            })
        ]

        beforeEach(() => {
            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(paginated(mockMembers, { total: 2, limit: 20, offset: 0 }))
        })

        it('should render member cards with names and emails', async () => {
            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByText('admin@example.com')).toBeInTheDocument()
                expect(screen.getByText('editor@example.com')).toBeInTheDocument()
                // In card view, email is the title; nickname renders in description.
                expect(screen.getByText('Admin User')).toBeInTheDocument()
                expect(screen.getByText('Editor User')).toBeInTheDocument()
            })
        })

        it('should display member roles', async () => {
            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Error handling', () => {
        it('should display error message when API fails', async () => {
            vi.mocked(applicationsApi.listApplicationMembers).mockRejectedValue(new Error('Network error'))

            await renderWithProviders(<ApplicationMembers />)

            await waitFor(
                () => {
                    expect(screen.getByAltText('Connection error')).toBeInTheDocument()
                },
                { timeout: 5000 }
            )
        })

        it('should show retry button on error', async () => {
            vi.mocked(applicationsApi.listApplicationMembers).mockRejectedValue(new Error('Network error'))

            await renderWithProviders(<ApplicationMembers />)

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
            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(
                paginated(
                    [
                        createMember({
                            id: 'member-1',
                            userId: 'user-1',
                            role: 'admin',
                            email: 'admin@example.com',
                            nickname: 'Admin User',
                            createdAt: '2024-01-01T00:00:00Z'
                        })
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
        })

        it('should have search input with placeholder', async () => {
            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByPlaceholderText(/search members/i)).toBeInTheDocument()
            })
        })

        it('should update search field on user input', async () => {
            const { user } = await renderWithProviders(<ApplicationMembers />)

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
            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(
                paginated(
                    [
                        createMember({
                            id: 'member-1',
                            userId: 'user-1',
                            role: 'member',
                            email: 'noname@example.com',
                            nickname: null,
                            createdAt: '2024-01-01T00:00:00Z'
                        })
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )

            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByText('noname@example.com')).toBeInTheDocument()
            })
        })

        it('should handle large member lists', async () => {
            const largeMemberList = Array.from({ length: 100 }, (_, index) =>
                createMember({
                    id: `member-${index}`,
                    userId: `user-${index}`,
                    role: index % 3 === 0 ? 'admin' : index % 3 === 1 ? 'editor' : 'member',
                    email: `user${index}@example.com`,
                    nickname: `User ${index}`,
                    createdAt: '2024-01-01T00:00:00Z'
                })
            )

            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(
                paginated(largeMemberList.slice(0, 20), { total: 100, limit: 20, offset: 0 })
            )

            await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByText('User 0')).toBeInTheDocument()
            })

            const tablePagination = document.querySelector('.MuiTablePagination-root')
            expect(tablePagination).toBeTruthy()
        })
    })

    describe('Navigation', () => {
        it('should handle missing applicationId parameter', async () => {
            vi.mocked(applicationsApi.listApplicationMembers).mockImplementation(() => createNeverPromise())

            await renderWithProviders(<ApplicationMembers />, { route: '/access' })

            expect(applicationsApi.listApplicationMembers).not.toHaveBeenCalled()
            expect(screen.getByAltText('Invalid application')).toBeInTheDocument()
        })
    })

    describe('View Toggle', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(
                paginated(
                    [
                        createMember({
                            id: 'member-1',
                            userId: 'test-user-id',
                            role: 'admin',
                            email: 'admin@example.com',
                            nickname: 'Admin',
                            createdAt: '2024-01-01T00:00:00Z'
                        })
                    ],
                    { total: 1, limit: 20, offset: 0 }
                )
            )
        })

        it('should persist view preference to localStorage and render list view', async () => {
            const { user } = await renderWithProviders(<ApplicationMembers />)

            await waitFor(() => {
                expect(screen.getByText('admin@example.com')).toBeInTheDocument()
            })

            const listViewToggle = screen.getByTitle(/list view/i)
            await user.click(listViewToggle)

            await waitFor(() => {
                expect(localStorage.getItem(STORAGE_KEYS.MEMBERS_DISPLAY_STYLE)).toBe('list')
                expect(screen.getByTestId('flow-list-table')).toBeInTheDocument()
            })
        })
    })

    describe('Invite error branches', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplicationMembers).mockResolvedValue(paginated([], { total: 0, limit: 20, offset: 0 }))
        })

        it('should show userNotFound message on 404', async () => {
            vi.mocked(applicationsApi.inviteApplicationMember).mockRejectedValue({ response: { status: 404 } })

            const { user } = await renderWithProviders(<ApplicationMembers />)

            const addButton = await screen.findByRole('button', { name: /add/i })
            await user.click(addButton)

            const dialog = await screen.findByRole('dialog')
            const emailInput = await within(dialog).findByLabelText(/email/i)
            await user.type(emailInput, 'missing@example.com')

            const saveButton = screen.getByRole('button', { name: /save/i })
            await user.click(saveButton)

            await waitFor(() => {
                expect(vi.mocked(applicationsApi.inviteApplicationMember)).toHaveBeenCalled()
                expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('missing@example.com'), { variant: 'error' })
            })
        })

        it('should show userAlreadyMember message on 409 + api code', async () => {
            vi.mocked(applicationsApi.inviteApplicationMember).mockRejectedValue({
                response: { status: 409, data: { code: 'APPLICATION_MEMBER_EXISTS' } }
            })

            const { user } = await renderWithProviders(<ApplicationMembers />)

            const addButton = await screen.findByRole('button', { name: /add/i })
            await user.click(addButton)

            const dialog = await screen.findByRole('dialog')
            const emailInput = await within(dialog).findByLabelText(/email/i)
            await user.type(emailInput, 'exists@example.com')

            const saveButton = screen.getByRole('button', { name: /save/i })
            await user.click(saveButton)

            await waitFor(() => {
                expect(vi.mocked(applicationsApi.inviteApplicationMember)).toHaveBeenCalled()
                expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('exists@example.com'), { variant: 'error' })
            })
        }, 15000)
    })
})
