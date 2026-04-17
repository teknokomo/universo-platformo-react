import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardApp from '../DashboardApp'

const dashboardMocks = vi.hoisted(() => ({
    dashboardStateOverrides: {} as Record<string, unknown>,
    handleOpenCreate: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleOpenCopy: vi.fn()
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('../../layouts/AppMainLayout', () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}))

vi.mock('../../api/adapters', () => ({
    createStandaloneAdapter: vi.fn(() => ({ queryKeyPrefix: ['standalone', 'app-1'] }))
}))

vi.mock('../../dashboard/Dashboard', () => ({
    default: ({ details }: { details?: { title?: string; actions?: ReactNode } }) => (
        <div data-testid='dashboard-app'>
            <div data-testid='dashboard-title'>{details?.title}</div>
            <div data-testid='dashboard-actions'>{details?.actions}</div>
        </div>
    )
}))

vi.mock('../../components/CrudDialogs', () => ({
    CrudDialogs: ({ surface }: { surface?: 'dialog' | 'page' }) => <div data-testid='crud-dialogs-surface'>{surface ?? 'dialog'}</div>
}))

vi.mock('../../components/RowActionsMenu', () => ({
    RowActionsMenu: () => null
}))

vi.mock('../../hooks/useCrudDashboard', () => ({
    useCrudDashboard: () => ({
        appData: {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            linkedCollection: {
                name: 'Standalone details'
            }
        },
        layoutConfig: {},
        rows: [],
        columns: [],
        isLoading: false,
        rowCount: 0,
        paginationModel: { page: 0, pageSize: 50 },
        setPaginationModel: vi.fn(),
        pageSizeOptions: [10, 25, 50],
        localeText: undefined,
        canPersistRowReorder: false,
        handlePersistRowReorder: vi.fn(),
        isReordering: false,
        formOpen: false,
        isFormReady: true,
        fieldConfigs: [],
        formInitialData: undefined,
        isSubmitting: false,
        formError: null,
        copyError: null,
        editRowId: null,
        copyRowId: null,
        handleCloseForm: vi.fn(),
        handleFormSubmit: vi.fn().mockResolvedValue(undefined),
        deleteRowId: null,
        isDeleting: false,
        deleteError: null,
        handleCloseDelete: vi.fn(),
        handleConfirmDelete: vi.fn().mockResolvedValue(undefined),
        handleOpenMenu: vi.fn(),
        handleCloseMenu: vi.fn(),
        activeMenu: null,
        menuAnchorEl: null,
        menuRowId: null,
        menuSlot: undefined,
        activeLinkedCollectionId: 'catalog-1',
        selectedLinkedCollectionId: 'catalog-1',
        handleOpenCreate: dashboardMocks.handleOpenCreate,
        handleOpenEdit: dashboardMocks.handleOpenEdit,
        handleOpenCopy: dashboardMocks.handleOpenCopy,
        ...dashboardMocks.dashboardStateOverrides
    })
}))

describe('DashboardApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        dashboardMocks.dashboardStateOverrides = {}
    })

    it('keeps dialog surface by default when no page runtime surface is configured', () => {
        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Standalone details')
        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
    })

    it('uses the configured create page surface after the create form opens', async () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                linkedCollection: {
                    name: 'Standalone details',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })
    })

    it('uses the configured edit and copy page surfaces when those modes are active', async () => {
        const { rerender } = render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                linkedCollection: {
                    name: 'Standalone details',
                    runtimeConfig: { editSurface: 'page', copySurface: 'page' }
                }
            },
            formOpen: true,
            editRowId: 'row-1',
            copyRowId: null
        }

        rerender(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })

        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                linkedCollection: {
                    name: 'Standalone details',
                    runtimeConfig: { editSurface: 'dialog', copySurface: 'page' }
                }
            },
            formOpen: true,
            editRowId: null,
            copyRowId: 'row-2'
        }

        rerender(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })
    })

    it('wires the create action to the dashboard state', async () => {
        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(dashboardMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('hides the create action when the catalog runtime config disables it', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                linkedCollection: {
                    name: 'Standalone details',
                    runtimeConfig: { showCreateButton: false }
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })
})
