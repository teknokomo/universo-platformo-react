import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import InstanceUsers from './InstanceUsers'
import { adminQueryKeys } from '../api/queryKeys'

const { mockCreateUser, mockSetUserRoles, mockEnqueueSnackbar, mockNavigate, mockSetView, mockSetSearch, mockGoToPage, mockConfirm } =
    vi.hoisted(() => ({
        mockCreateUser: vi.fn(),
        mockSetUserRoles: vi.fn(),
        mockEnqueueSnackbar: vi.fn(),
        mockNavigate: vi.fn(),
        mockSetView: vi.fn(),
        mockSetSearch: vi.fn(),
        mockGoToPage: vi.fn(),
        mockConfirm: vi.fn()
    }))

vi.mock('react-router-dom', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-router-dom')>()

    return {
        ...actual,
        useParams: () => ({ instanceId: 'instance-1' }),
        useNavigate: () => mockNavigate
    }
})

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()

    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback?: string | { defaultValue?: string }) => {
                if (typeof fallback === 'string') {
                    return fallback
                }

                if (typeof fallback?.defaultValue === 'string') {
                    return fallback.defaultValue
                }

                return key
            },
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}))

vi.mock('@universo/auth-frontend', () => ({
    createAuthClient: () => ({}),
    useAuth: () => ({ user: { id: 'admin-1' } })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar })
}))

vi.mock('../hooks/useViewPreference', () => ({
    useViewPreference: () => ['card', mockSetView]
}))

vi.mock('../hooks', () => ({
    useAdminPermission: () => true,
    useRoles: () => ({
        roles: [
            {
                id: 'role-1',
                codename: 'editor',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: {
                            content: 'Editor',
                            version: 1,
                            isActive: true,
                            createdAt: '2026-03-18T00:00:00.000Z',
                            updatedAt: '2026-03-18T00:00:00.000Z'
                        }
                    }
                },
                color: '#3366FF',
                isSuperuser: false,
                canAccessAdmin: true,
                isSystem: false,
                createdAt: '2026-03-18T00:00:00.000Z',
                updatedAt: '2026-03-18T00:00:00.000Z',
                permissions: []
            }
        ],
        roleLabelsById: { 'role-1': 'Editor' },
        isLoading: false
    })
}))

vi.mock('../hooks/useInstanceDetails', () => ({
    useInstanceDetails: () => ({
        data: {
            id: 'instance-1',
            codename: 'platform',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: {
                        content: 'Platform',
                        version: 1,
                        isActive: true,
                        createdAt: '2026-03-18T00:00:00.000Z',
                        updatedAt: '2026-03-18T00:00:00.000Z'
                    }
                }
            },
            status: 'active',
            is_local: true,
            _upl_created_at: '2026-03-18T00:00:00.000Z',
            _upl_updated_at: '2026-03-18T00:00:00.000Z'
        },
        isLoading: false,
        error: null,
        isError: false
    })
}))

vi.mock('../api/adminApi', () => ({
    createAdminApi: () => ({
        createUser: mockCreateUser,
        setUserRoles: mockSetUserRoles,
        listGlobalUsers: vi.fn()
    })
}))

vi.mock('../api/apiClient', () => ({
    default: {}
}))

vi.mock('@universo/template-mui', () => ({
    TemplateMainCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    ItemCard: () => null,
    ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) => (
        <div>{primaryAction ? <button onClick={primaryAction.onClick}>{primaryAction.label}</button> : null}</div>
    ),
    EmptyListState: ({ title, description }: { title: string; description?: string }) => (
        <div>
            <span>{title}</span>
            {description ? <span>{description}</span> : null}
        </div>
    ),
    SkeletonGrid: () => <div>loading-grid</div>,
    APIEmptySVG: 'api-empty',
    usePaginated: () => ({
        data: [],
        isLoading: false,
        error: null,
        pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false },
        actions: {
            setSearch: mockSetSearch,
            goToPage: mockGoToPage
        }
    }),
    useDebouncedSearch: () => ({ handleSearchChange: vi.fn() }),
    PaginationControls: () => null,
    FlowListTable: () => null,
    gridSpacing: 2,
    ConfirmDialog: () => null,
    useConfirm: () => ({ confirm: mockConfirm }),
    RoleChip: ({ role }: { role: string }) => <span>{role}</span>,
    FilterToolbar: () => null,
    BaseEntityMenu: () => null,
    ViewHeaderMUI: ({ title, children }: { title: string; children?: React.ReactNode }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    )
}))

vi.mock('../components/UserFormDialog', () => ({
    default: ({
        open,
        mode,
        onSubmit
    }: {
        open: boolean
        mode: 'create' | 'edit'
        onSubmit: (data: { email: string; password?: string; roleIds: string[]; comment?: string }) => Promise<void> | void
    }) =>
        open ? (
            <div>
                <span>{mode === 'create' ? 'create-user-dialog' : 'edit-user-dialog'}</span>
                <button
                    onClick={() =>
                        onSubmit({
                            email: 'neo@example.com',
                            password: 'password123',
                            roleIds: ['role-1'],
                            comment: 'Provisioned from test'
                        })
                    }
                >
                    submit-user-dialog
                </button>
            </div>
        ) : null
}))

describe('InstanceUsers', () => {
    beforeEach(() => {
        mockCreateUser.mockReset()
        mockSetUserRoles.mockReset()
        mockEnqueueSnackbar.mockReset()
        mockNavigate.mockReset()
        mockSetView.mockReset()
        mockSetSearch.mockReset()
        mockGoToPage.mockReset()
        mockConfirm.mockReset()
    })

    it('submits create-user dialog payload through the admin API and invalidates related lists', async () => {
        mockCreateUser.mockResolvedValue({
            userId: 'user-1',
            email: 'neo@example.com',
            roles: []
        })

        const queryClient = new QueryClient()
        const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries')

        render(
            <QueryClientProvider client={queryClient}>
                <InstanceUsers />
            </QueryClientProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Create' }))

        expect(screen.getByText('create-user-dialog')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'submit-user-dialog' }))

        await waitFor(() => {
            expect(mockCreateUser).toHaveBeenCalledWith({
                email: 'neo@example.com',
                password: 'password123',
                roleIds: ['role-1'],
                comment: 'Provisioned from test'
            })
        })

        await waitFor(() => {
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.globalUsers() })
            expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: adminQueryKeys.dashboardStats() })
        })

        expect(mockEnqueueSnackbar).toHaveBeenCalledWith('User created successfully', { variant: 'success' })
    })
})
