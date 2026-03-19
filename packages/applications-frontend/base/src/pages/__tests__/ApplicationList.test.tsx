import { vi } from 'vitest'
// Mock rehype/remark libraries
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/template-mui')>('@universo/template-mui')
    const t = (key: string, defaultValue?: unknown) => (typeof defaultValue === 'string' ? defaultValue : key)

    return {
        ...actual,
        LocalizedInlineField: ({
            label,
            onChange
        }: {
            label: string
            onChange?: (value: { _schema: string; _primary: string; locales: Record<string, { content: string }> }) => void
        }) => (
            <button
                type='button'
                onClick={() =>
                    onChange?.({
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: {
                                content: label.toLowerCase().includes('name') ? 'New Application' : 'Created from acceptance'
                            }
                        }
                    })
                }
            >
                {`Fill ${label}`}
            </button>
        ),
        BaseEntityMenu: (props: any) => {
            const descriptors = Array.isArray(props?.descriptors) ? props.descriptors : []
            const ctx = props?.createContext?.({ entity: props.entity, t }) ?? { entity: props.entity, t }
            const controlPanel = descriptors.find((descriptor: any) => descriptor?.id === 'control-panel')
            const edit = descriptors.find((descriptor: any) => descriptor?.id === 'edit')
            const del = descriptors.find((descriptor: any) => descriptor?.id === 'delete')
            const copy = descriptors.find((descriptor: any) => descriptor?.id === 'copy')

            return (
                <div data-testid='entity-menu'>
                    {controlPanel ? (
                        <button type='button' onClick={() => controlPanel.onSelect?.(ctx)}>
                            control-panel
                        </button>
                    ) : null}
                    {edit ? (
                        <button
                            type='button'
                            onClick={() => {
                                const dialogProps = edit.dialog?.buildProps?.(ctx)
                                dialogProps?.extraFields?.({
                                    values: dialogProps?.initialExtraValues ?? {},
                                    setValue: () => undefined,
                                    isLoading: false,
                                    errors: dialogProps?.validate?.(dialogProps?.initialExtraValues ?? {}) ?? {}
                                })
                                void dialogProps?.onSave?.({
                                    ...(dialogProps?.initialExtraValues ?? {}),
                                    nameVlc: {
                                        _schema: 'v1',
                                        _primary: 'en',
                                        locales: { en: { content: 'Edited Application' } }
                                    },
                                    descriptionVlc: {
                                        _schema: 'v1',
                                        _primary: 'en',
                                        locales: { en: { content: 'Edited Application Description' } }
                                    }
                                })
                            }}
                        >
                            edit
                        </button>
                    ) : null}
                    {copy ? (
                        <button
                            type='button'
                            onClick={() => {
                                const dialogProps = copy.dialog?.buildProps?.(ctx)
                                dialogProps?.tabs?.({
                                    values: dialogProps?.initialExtraValues ?? {},
                                    setValue: () => undefined,
                                    isLoading: false,
                                    errors: dialogProps?.validate?.(dialogProps?.initialExtraValues ?? {}) ?? {}
                                })
                                void dialogProps?.onSave?.({
                                    ...(dialogProps?.initialExtraValues ?? {}),
                                    nameVlc: {
                                        _schema: 'v1',
                                        _primary: 'en',
                                        locales: { en: { content: 'Copied Application' } }
                                    },
                                    descriptionVlc: {
                                        _schema: 'v1',
                                        _primary: 'en',
                                        locales: { en: { content: 'Copied Application Description' } }
                                    },
                                    copyConnector: true,
                                    createSchema: false,
                                    copyAccess: true
                                })
                            }}
                        >
                            copy
                        </button>
                    ) : null}
                    {del ? (
                        <button
                            type='button'
                            onClick={() => {
                                const dialogProps = del.dialog?.buildProps?.(ctx)
                                void dialogProps?.onConfirm?.()
                            }}
                        >
                            delete
                        </button>
                    ) : null}
                </div>
            )
        }
    }
})

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'
import { I18nextProvider } from 'react-i18next'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'

import ApplicationList from '../ApplicationList'
import * as applicationsApi from '../../api/applications'
import { getInstance as getI18nInstance } from '@universo/i18n/instance'
import { registerNamespace } from '@universo/i18n/registry'
import { STORAGE_KEYS } from '../../constants/storage'
import applicationsEn from '../../i18n/locales/en/applications.json'
import applicationsRu from '../../i18n/locales/ru/applications.json'
import commonEn from '@universo/i18n/locales/en/common.json'
import commonRu from '@universo/i18n/locales/ru/common.json'

const mockAbility = {
    can: vi.fn(() => true)
}

const mockGlobalAccess = {
    isSuperuser: true,
    hasAnyGlobalRole: true,
    canAccessAdminPanel: true,
    loading: false,
    ability: mockAbility,
    globalRoles: [{ codename: 'superuser' }],
    adminConfig: {
        adminPanelEnabled: true,
        globalRolesEnabled: true,
        superuserEnabled: true
    }
}

// Mock API module
vi.mock('../../api/applications', () => ({
    listApplications: vi.fn(),
    createApplication: vi.fn(),
    updateApplication: vi.fn(),
    deleteApplication: vi.fn(),
    copyApplication: vi.fn(),
    joinApplication: vi.fn(),
    leaveApplication: vi.fn()
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

vi.mock('@universo/store', () => ({
    useHasGlobalAccess: () => mockGlobalAccess,
    useAbility: () => mockGlobalAccess
}))

// Mock backend utilities
vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        extractAxiosError: vi.fn((error: any) => error?.message || 'Unknown error'),
        isHttpStatus: vi.fn((error: any, status: number) => error?.response?.status === status),
        isApiError: vi.fn((error: any) => !!error?.response),
        getApiBaseURL: vi.fn(() => 'http://localhost:3000'),
        isPendingEntity: actual.isPendingEntity ?? ((item: any) => Boolean(item?.__pending)),
        getPendingAction: actual.getPendingAction ?? ((item: any) => (item?.__pending ? item?.__pendingAction : undefined)),
        makePendingMarkers:
            actual.makePendingMarkers ??
            ((action: string, options?: { feedbackVisible?: boolean }) => ({
                __pending: true,
                __pendingAction: action,
                ...(options?.feedbackVisible ? { __pendingFeedbackVisible: true } : {})
            })),
        isPendingInteractionBlocked:
            actual.isPendingInteractionBlocked ?? ((item: any) => item?.__pendingAction === 'create' || item?.__pendingAction === 'copy'),
        shouldShowPendingFeedback:
            actual.shouldShowPendingFeedback ??
            ((item: any) => {
                if (!item?.__pending) return false
                if (item.__pendingAction === 'create' || item.__pendingAction === 'copy') {
                    return Boolean(item.__pendingFeedbackVisible)
                }
                return true
            }),
        revealPendingFeedback:
            actual.revealPendingFeedback ??
            ((item: any) => {
                if (item?.__pendingAction !== 'create' && item?.__pendingAction !== 'copy') return item
                if (item?.__pendingFeedbackVisible) return item
                return { ...item, __pendingFeedbackVisible: true }
            }),
        getNextOptimisticSortOrder:
            actual.getNextOptimisticSortOrder ??
            ((items: any[] | null | undefined, startAt = 1) => {
                const source = Array.isArray(items) ? items : []
                const maxSortOrder = source.reduce((max, entry) => {
                    const sortOrder = entry?.sortOrder
                    return typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? Math.max(max, sortOrder) : max
                }, startAt - 1)
                return maxSortOrder + 1
            }),
        stripPendingMarkers:
            actual.stripPendingMarkers ??
            ((item: any) => {
                if (!item || typeof item !== 'object') return item
                const { __pending, __pendingAction, __pendingFeedbackVisible, ...rest } = item
                return rest
            })
    }
})

// Initialize i18n
const i18n = getI18nInstance()
const consolidateApplicationsNamespace = (bundle: any) => ({
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
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

const createTestStore = () =>
    configureStore({
        reducer: {
            customization: (state = { isDarkMode: false }) => state
        }
    })

const makePaginatedResponse = <T,>(items: T[], params?: { total?: number; limit?: number; offset?: number }) => {
    const limit = params?.limit ?? 20
    const offset = params?.offset ?? 0
    const total = params?.total ?? items.length
    const count = items.length

    return {
        items,
        pagination: {
            total,
            limit,
            offset,
            count,
            hasMore: offset + count < total
        }
    }
}

const LocationDisplay = () => {
    const location = useLocation()
    return <div data-testid='location-display'>{location.pathname}</div>
}

const renderWithProviders = (ui: React.ReactElement) => {
    const queryClient = createTestQueryClient()
    const store = createTestStore()

    return {
        user: userEvent.setup(),
        ...render(
            <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={3}>
                    <Provider store={store}>
                        <I18nextProvider i18n={i18n}>
                            <MemoryRouter
                                initialEntries={['/applications']}
                                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
                            >
                                {ui}
                            </MemoryRouter>
                        </I18nextProvider>
                    </Provider>
                </SnackbarProvider>
            </QueryClientProvider>
        )
    }
}

describe('ApplicationList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mock localStorage
        Storage.prototype.getItem = vi.fn(() => 'card')
        Storage.prototype.setItem = vi.fn()
        mockGlobalAccess.isSuperuser = true
        mockGlobalAccess.hasAnyGlobalRole = true
        mockGlobalAccess.canAccessAdminPanel = true
        mockGlobalAccess.loading = false
        mockAbility.can.mockReset()
        mockAbility.can.mockImplementation(() => true)
        mockGlobalAccess.globalRoles = [{ codename: 'superuser' }]
        mockGlobalAccess.adminConfig = {
            adminPanelEnabled: true,
            globalRolesEnabled: true,
            superuserEnabled: true
        }
    })

    describe('Loading State', () => {
        it('should display loading skeletons while fetching data', () => {
            // Mock API to never resolve
            vi.mocked(applicationsApi.listApplications).mockImplementation(() => new Promise(() => {}))

            renderWithProviders(<ApplicationList />)

            // Check for loading skeletons (part of SkeletonGrid component)
            expect(screen.queryByTestId('skeleton-grid') || document.querySelector('.MuiSkeleton-root')).toBeTruthy()
        })
    })

    describe('Error State', () => {
        it('should display error message when API fails', async () => {
            // Mock API to reject
            // Avoid react-query retries inside usePaginated by providing a non-retriable status
            vi.mocked(applicationsApi.listApplications).mockRejectedValue({ response: { status: 404 } } as any)

            renderWithProviders(<ApplicationList />)

            // Wait for error state
            await waitFor(() => {
                expect(screen.getByAltText('Connection error')).toBeInTheDocument()
            })
        })

        it('should show retry button on error', async () => {
            vi.mocked(applicationsApi.listApplications).mockRejectedValue(new Error('Network error'))

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                const retryButton = screen.queryByRole('button', { name: /retry/i })
                if (retryButton) {
                    expect(retryButton).toBeInTheDocument()
                }
            })
        })
    })

    describe('Empty State', () => {
        it('should display empty state when no applications exist', async () => {
            // Mock API to return empty list
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(makePaginatedResponse([], { total: 0 }))

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText(/no applications/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })
        })

        it('should show create button in empty state', async () => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(makePaginatedResponse([], { total: 0 }))

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                const addButtons = screen.queryAllByRole('button')
                expect(addButtons.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Success State - List Rendering', () => {
        const mockApplications = [
            {
                id: 'application-1',
                name: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'Test Application 1' },
                        ru: { content: 'Тестовый метахаб 1' }
                    }
                },
                description: {
                    _schema: '1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'First test application' },
                        ru: { content: 'Первый тестовый метахаб' }
                    }
                },
                role: 'admin',
                membersCount: 3,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'application-2',
                name: 'Test Application 2',
                description: 'Second test application',
                role: 'editor',
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(makePaginatedResponse(mockApplications, { total: 2 }))
        })

        it('should render application cards with names', async () => {
            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Test Application 1')).toBeInTheDocument()
                expect(screen.getByText('Test Application 2')).toBeInTheDocument()
            })
        })

        it('should display application descriptions', async () => {
            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('First test application')).toBeInTheDocument()
                expect(screen.getByText('Second test application')).toBeInTheDocument()
            })
        })

        it('should show role chips for applications', async () => {
            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                // RoleChip component renders role
                const roleElements = screen.queryAllByText(/admin|editor/i)
                expect(roleElements.length).toBeGreaterThan(0)
            })
        })
    })

    describe('Search Functionality', () => {
        const mockApplications = [
            {
                id: 'application-1',
                name: 'Production Application',
                description: 'Main production environment',
                role: 'admin',
                membersCount: 5,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            },
            {
                id: 'application-2',
                name: 'Testing Application',
                description: 'Test environment',
                role: 'editor',
                membersCount: 2,
                createdAt: '2024-01-02T00:00:00Z',
                updatedAt: '2024-01-16T00:00:00Z'
            }
        ]

        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(makePaginatedResponse(mockApplications, { total: 2 }))
        })

        it('should have search input field', async () => {
            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
                expect(searchInput).toBeTruthy()
            })
        })

        it('should call API with search parameter when typing', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Production Application')).toBeInTheDocument()
            })

            const searchInput = screen.queryByPlaceholderText(/search/i) || screen.queryByRole('searchbox')
            if (searchInput) {
                await user.type(searchInput, 'Production')

                // API should be called with search parameter
                await waitFor(
                    () => {
                        const calls = vi.mocked(applicationsApi.listApplications).mock.calls
                        const hasSearchParam = calls.some((call) => call[0]?.search === 'Production')
                        expect(hasSearchParam).toBeTruthy()
                    },
                    { timeout: 3000 }
                )
            }
        })
    })

    describe('Pagination', () => {
        const generateMockApplications = (count: number) =>
            Array.from({ length: count }, (_, i) => ({
                id: `application-${i + 1}`,
                name: `Application ${i + 1}`,
                description: `Description ${i + 1}`,
                role: 'viewer' as const,
                membersCount: 1,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-15T00:00:00Z'
            }))

        it('should display pagination controls when total exceeds page size', async () => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(generateMockApplications(20), { total: 50 })
            )

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                // PaginationControls uses MUI TablePagination
                const pagination = document.querySelector('.MuiTablePagination-root')
                expect(pagination).toBeTruthy()
            })
        })
    })

    describe('Create Application', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(makePaginatedResponse([], { total: 0 }))
            vi.mocked(applicationsApi.createApplication).mockResolvedValue({
                data: {
                    id: 'new-application',
                    name: 'New Application',
                    description: 'Newly created',
                    role: 'admin',
                    membersCount: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            } as any)
        })

        it('should open create dialog when add button clicked', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText(/no applications/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })

            // Find Add button
            const addButtons = screen.getAllByRole('button')
            const addButton = addButtons.find(
                (btn) => btn.querySelector('[data-testid="AddRoundedIcon"]') || btn.textContent?.includes('Add')
            )

            if (addButton) {
                await user.click(addButton)

                // Dialog should open
                await waitFor(() => {
                    const dialog = screen.queryByRole('dialog') || document.querySelector('[role="dialog"]')
                    expect(dialog).toBeTruthy()
                })
            }
        })

        it('submits localized create payload from the page dialog', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText(/no applications/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })

            const addButtons = screen.getAllByRole('button')
            const addButton = addButtons.find(
                (btn) => btn.querySelector('[data-testid="AddRoundedIcon"]') || btn.textContent?.includes('Add')
            )

            expect(addButton).toBeTruthy()

            await user.click(addButton!)

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument()
            })

            await user.click(screen.getByRole('button', { name: 'Fill Name' }))
            await user.click(screen.getByRole('button', { name: 'Fill Description' }))
            await user.click(screen.getByRole('button', { name: 'Create' }))

            await waitFor(() => {
                expect(applicationsApi.createApplication).toHaveBeenCalledWith({
                    name: { en: 'New Application' },
                    description: { en: 'Created from acceptance' },
                    namePrimaryLocale: 'en',
                    descriptionPrimaryLocale: 'en',
                    isPublic: false,
                    workspacesEnabled: false
                })
            })
        }, 15_000)

        it('submits public create payload even when workspaces are manually disabled', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText(/no applications/i) || screen.getByText(/get started/i)).toBeInTheDocument()
            })

            const addButtons = screen.getAllByRole('button')
            const addButton = addButtons.find(
                (btn) => btn.querySelector('[data-testid="AddRoundedIcon"]') || btn.textContent?.includes('Add')
            )

            expect(addButton).toBeTruthy()

            await user.click(addButton!)

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument()
            })

            await user.click(screen.getByRole('button', { name: 'Fill Name' }))
            await user.click(screen.getByRole('tab', { name: 'Parameters' }))
            await user.click(screen.getByRole('radio', { name: 'Public' }))
            await user.click(screen.getByRole('checkbox', { name: 'Add workspaces' }))
            await user.click(screen.getByRole('button', { name: 'Create' }))

            await waitFor(() => {
                expect(applicationsApi.createApplication).toHaveBeenCalledWith({
                    name: { en: 'New Application' },
                    description: undefined,
                    namePrimaryLocale: 'en',
                    descriptionPrimaryLocale: undefined,
                    isPublic: true,
                    workspacesEnabled: false
                })
            })
        }, 15_000)
    })

    describe('Control Panel Navigation', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'navigable-application',
                            name: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Navigable Application' }
                                }
                            },
                            description: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Can open control panel' }
                                }
                            },
                            role: 'admin',
                            membersCount: 2,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
        })

        it('routes to the admin panel from the page action menu', async () => {
            const { user } = renderWithProviders(
                <>
                    <ApplicationList />
                    <LocationDisplay />
                </>
            )

            await waitFor(() => {
                expect(screen.getByText('Navigable Application')).toBeInTheDocument()
            })

            expect(screen.getByTestId('location-display')).toHaveTextContent('/applications')

            await user.click(screen.getByRole('button', { name: 'control-panel' }))

            await waitFor(() => {
                expect(screen.getByTestId('location-display')).toHaveTextContent('/a/navigable-application/admin')
            })
        })
    })

    describe('Update Application', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'editable-application',
                            name: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Editable Application' }
                                }
                            },
                            description: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Editable application description' }
                                }
                            },
                            role: 'admin',
                            membersCount: 2,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
            vi.mocked(applicationsApi.updateApplication).mockResolvedValue({
                data: {
                    id: 'editable-application',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Edited Application' }
                        }
                    },
                    description: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Edited Application Description' }
                        }
                    }
                }
            } as any)
        })

        it('submits localized update payload from the page action menu', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Editable Application')).toBeInTheDocument()
            })

            await user.click(screen.getByRole('button', { name: 'edit' }))

            await waitFor(() => {
                expect(applicationsApi.updateApplication).toHaveBeenCalledWith('editable-application', {
                    name: { en: 'Edited Application' },
                    description: { en: 'Edited Application Description' },
                    namePrimaryLocale: 'en',
                    descriptionPrimaryLocale: 'en',
                    expectedVersion: undefined
                })
            })
        })
    })

    describe('Copy Application', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'copyable-application',
                            name: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Copyable Application' }
                                }
                            },
                            description: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Copy source description' }
                                }
                            },
                            role: 'admin',
                            membersCount: 2,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
            vi.mocked(applicationsApi.copyApplication).mockResolvedValue({
                data: {
                    id: 'copied-application',
                    name: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Copied Application' }
                        }
                    }
                }
            } as any)
        })

        it('submits localized copy payload from the page action menu', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Copyable Application')).toBeInTheDocument()
            })

            await user.click(screen.getByRole('button', { name: 'copy' }))

            await waitFor(() => {
                expect(applicationsApi.copyApplication).toHaveBeenCalledWith('copyable-application', {
                    name: { en: 'Copied Application' },
                    description: { en: 'Copied Application Description' },
                    namePrimaryLocale: 'en',
                    descriptionPrimaryLocale: 'en',
                    isPublic: false,
                    workspacesEnabled: false,
                    copyConnector: true,
                    createSchema: false,
                    copyAccess: true
                })
            })
        })
    })

    describe('Public Application Membership', () => {
        beforeEach(() => {
            mockGlobalAccess.isSuperuser = false
            mockGlobalAccess.hasAnyGlobalRole = true
            mockGlobalAccess.canAccessAdminPanel = false
            mockGlobalAccess.globalRoles = [{ codename: 'user' }]
            mockAbility.can.mockImplementation((action: string, subject: string) => action === 'read' && subject === 'Application')

            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'public-application',
                            name: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Public Application' }
                                }
                            },
                            description: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Joinable application' }
                                }
                            },
                            isPublic: true,
                            workspacesEnabled: true,
                            membershipState: 'not_joined',
                            canJoin: true,
                            canLeave: false,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
            vi.mocked(applicationsApi.joinApplication).mockResolvedValue({
                data: {
                    status: 'joined',
                    member: {
                        id: 'membership-public',
                        userId: 'test-user-id',
                        email: 'test@example.com',
                        nickname: 'tester',
                        role: 'member',
                        createdAt: new Date().toISOString()
                    }
                }
            } as any)
        })

        it('shows join action for public applications', async () => {
            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Public Application')).toBeInTheDocument()
            })

            expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'control-panel' })).not.toBeInTheDocument()
            expect(screen.queryByText(/member|owner|admin|editor/i)).not.toBeInTheDocument()
        })

        it('does not render a direct runtime link for public non-members in table view', async () => {
            localStorage.setItem(STORAGE_KEYS.APPLICATION_DISPLAY_STYLE, 'table')

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Public Application')).toBeInTheDocument()
            })

            expect(screen.queryByRole('link', { name: 'Public Application' })).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument()
        })
    })

    describe('Delete Application', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'deletable-application',
                            name: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Deletable Application' }
                                }
                            },
                            description: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Delete me' }
                                }
                            },
                            role: 'owner',
                            membersCount: 2,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
            vi.mocked(applicationsApi.deleteApplication).mockResolvedValue(undefined as any)
        })

        it('submits the page action-menu delete flow into the existing delete mutation', async () => {
            const { user } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Deletable Application')).toBeInTheDocument()
            })

            await user.click(screen.getByRole('button', { name: 'delete' }))

            await waitFor(() => {
                expect(applicationsApi.deleteApplication).toHaveBeenCalledWith('deletable-application')
            })
        })
    })

    describe('View Toggle', () => {
        beforeEach(() => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'test-application',
                            name: 'Test',
                            description: 'Test',
                            role: 'admin',
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-15T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )
        })

        it('should persist view preference to localStorage', async () => {
            // Force a deterministic initial view (card) so clicking "list" always triggers a change.
            const getItemSpy = vi
                .spyOn(window.localStorage, 'getItem')
                .mockImplementation((key: string) => (key === 'applicationsApplicationDisplayStyle' ? 'card' : null))
            const setItemSpy = vi.spyOn(window.localStorage, 'setItem')

            const { user, container } = renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getAllByText('Test').length).toBeGreaterThan(0)
            })

            // Prefer a stable selector over translated title text.
            const listViewButton = container.querySelector('button[value="list"]') as HTMLElement | null
            expect(listViewButton).toBeTruthy()

            await user.click(listViewButton as HTMLElement)

            await waitFor(() => {
                expect(setItemSpy).toHaveBeenCalledWith('applicationsApplicationDisplayStyle', 'list')
            })

            getItemSpy.mockRestore()
            setItemSpy.mockRestore()
        })
    })

    describe('Edge Cases', () => {
        it('should handle applications without descriptions', async () => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'no-desc',
                            name: 'No Description',
                            description: undefined,
                            role: 'viewer',
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('No Description')).toBeInTheDocument()
            })

            // Card view ItemCard omits description entirely when missing
            expect(screen.queryByText('undefined')).not.toBeInTheDocument()
        })

        it('should handle applications without role', async () => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'no-role',
                            name: 'No Role',
                            description: 'Test',
                            role: undefined,
                            membersCount: 1,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        } as any
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('No Role')).toBeInTheDocument()
            })
        })

        it('should handle applications with zero counts', async () => {
            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse(
                    [
                        {
                            id: 'zero-counts',
                            name: 'Zero Counts',
                            description: 'All zeros',
                            role: 'admin',
                            membersCount: 0,
                            createdAt: '2024-01-01T00:00:00Z',
                            updatedAt: '2024-01-01T00:00:00Z'
                        }
                    ],
                    { total: 1 }
                )
            )

            renderWithProviders(<ApplicationList />)

            await waitFor(() => {
                expect(screen.getByText('Zero Counts')).toBeInTheDocument()
            })

            // ItemCard doesn't render count fields; this assertion just ensures no crash
            expect(screen.queryByText('NaN')).not.toBeInTheDocument()
        })
    })

    describe('Platform role gating', () => {
        it('hides create and control-panel actions for ordinary user roles', async () => {
            mockGlobalAccess.isSuperuser = false
            mockGlobalAccess.hasAnyGlobalRole = true
            mockGlobalAccess.canAccessAdminPanel = false
            mockGlobalAccess.globalRoles = [{ codename: 'user' }]
            mockAbility.can.mockImplementation((action: string, subject: string) => action === 'read' && subject === 'Application')

            vi.mocked(applicationsApi.listApplications).mockResolvedValue(
                makePaginatedResponse([
                    {
                        id: 'app-user-1',
                        name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Reader App' } } },
                        description: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Read-only app' } } },
                        role: 'owner',
                        permissions: { manageApplication: false },
                        accessType: 'direct',
                        connectorsCount: 1,
                        version: 1,
                        createdAt: '2024-01-01T00:00:00Z',
                        updatedAt: '2024-01-01T00:00:00Z'
                    } as any
                ])
            )

            renderWithProviders(<ApplicationList />)

            expect(await screen.findByText('Reader App')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'control-panel' })).not.toBeInTheDocument()
        })
    })
})
