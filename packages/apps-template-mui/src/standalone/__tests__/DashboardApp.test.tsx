import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardApp from '../DashboardApp'
import { createStandaloneAdapter } from '../../api/adapters'

const dashboardMocks = vi.hoisted(() => ({
    dashboardStateOverrides: {} as Record<string, unknown>,
    handleOpenCreate: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleOpenCopy: vi.fn(),
    onSelectObjectCollection: vi.fn(),
    capturedCrudOptions: null as null | { createDefaultContext?: (appData: unknown) => unknown }
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
    default: ({
        details,
        layoutConfig,
        menu
    }: {
        details?: {
            title?: string
            actions?: ReactNode
            content?: ReactNode
            pageBlocks?: Array<Record<string, unknown>>
            pagePlayer?: {
                showOutline?: boolean
                showProgressHeader?: boolean
                completeButtonMode?: string
                progressStorageKey?: string
                onProgressChange?: (payload: { action: 'view' | 'complete' }) => void
            }
            tableDefaults?: unknown
            onOpenCreateTarget?: (target: {
                id: string
                label: string
                objectCollectionId?: string
                createDefaults?: Array<{
                    fieldCodename: string
                    enumCodename?: string
                    resourceSourceType?: string
                    contextPath?: string
                }>
            }) => void
        }
        layoutConfig?: Record<string, unknown>
        menu?: { items?: Array<{ label: string; selected?: boolean; href?: string | null }> }
    }) => (
        <div data-testid='dashboard-app'>
            <div data-testid='dashboard-layout'>{JSON.stringify(layoutConfig ?? {})}</div>
            <div data-testid='dashboard-menu'>
                {menu?.items?.map((item) => `${item.label}:${Boolean(item.selected)}:${item.href ?? ''}`).join('|')}
            </div>
            <div data-testid='dashboard-title'>{details?.title}</div>
            <div data-testid='dashboard-actions'>{details?.actions}</div>
            <div data-testid='dashboard-content'>{details?.content}</div>
            <div data-testid='dashboard-page-blocks'>{String(details?.pageBlocks?.length ?? 0)}</div>
            <div data-testid='dashboard-page-progress-handler'>{String(typeof details?.pagePlayer?.onProgressChange === 'function')}</div>
            <div data-testid='dashboard-page-player'>{JSON.stringify(details?.pagePlayer ?? {})}</div>
            <div data-testid='dashboard-table-defaults'>{JSON.stringify(details?.tableDefaults ?? {})}</div>
            <button
                data-testid='dashboard-open-link-target'
                onClick={() =>
                    details?.onOpenCreateTarget?.({
                        id: 'create-link',
                        label: 'Link',
                        objectCollectionId: 'object-1',
                        createDefaults: [
                            { fieldCodename: 'ResourceType', enumCodename: 'Url' },
                            { fieldCodename: 'Source', resourceSourceType: 'url' }
                        ]
                    })
                }
                type='button'
            >
                open link target
            </button>
        </div>
    )
}))

vi.mock('../../workspaces/RuntimeWorkspacesPage', () => ({
    RuntimeWorkspacesPage: ({
        applicationId,
        routeWorkspaceId,
        routeSection
    }: {
        applicationId: string
        routeWorkspaceId?: string | null
        routeSection?: string
    }) => (
        <div data-testid='runtime-workspaces-page'>
            workspaces:{applicationId}:{routeWorkspaceId ?? 'list'}:{routeSection ?? 'dashboard'}
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
    useCrudDashboard: (options: { createDefaultContext?: (appData: unknown) => unknown }) => {
        dashboardMocks.capturedCrudOptions = options
        return {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                settings: { sectionLinksEnabled: true },
                workspacesEnabled: true,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: false
                },
                objectCollection: {
                    name: 'Standalone details'
                },
                activeObjectCollectionId: 'object-1',
                objectCollections: [{ id: 'object-1', codename: 'LearningResources' }],
                sections: [{ id: 'object-1', codename: 'LearningResources' }]
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
            menuSlot: {
                title: null,
                showTitle: false,
                items: [
                    {
                        id: 'learning-resources',
                        label: 'LearningResources',
                        kind: 'section',
                        objectCollectionId: 'object-1',
                        selected: true
                    }
                ]
            },
            menusMap: {},
            activeObjectCollectionId: 'object-1',
            selectedObjectCollectionId: 'object-1',
            onSelectObjectCollection: dashboardMocks.onSelectObjectCollection,
            handleOpenCreate: dashboardMocks.handleOpenCreate,
            handleOpenEdit: dashboardMocks.handleOpenEdit,
            handleOpenCopy: dashboardMocks.handleOpenCopy,
            ...dashboardMocks.dashboardStateOverrides
        }
    }
}))

describe('DashboardApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        dashboardMocks.dashboardStateOverrides = {}
        dashboardMocks.onSelectObjectCollection.mockReset()
        dashboardMocks.capturedCrudOptions = null
        window.history.pushState({}, '', '/')
    })

    it('keeps dialog surface by default when no page runtime surface is configured', () => {
        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Standalone details')
        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
    })

    it('passes runtime page blocks and Learning Content player settings to the dashboard', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                activeObjectCollectionId: 'page-1',
                currentWorkspaceId: 'workspace-1',
                settings: {
                    learningContent: {
                        playerPreset: {
                            codename: 'player',
                            title: 'Player',
                            showOutline: false,
                            showProgressHeader: true,
                            allowResume: true,
                            allowResourcePreview: true,
                            completeButtonMode: 'autoAfterOpen'
                        }
                    }
                },
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: false
                },
                objectCollection: {
                    name: 'Page',
                    codename: 'Page',
                    pageBlocks: [{ id: 'body', type: 'paragraph', data: { text: 'Read' } }]
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-page-blocks')).toHaveTextContent('1')
        expect(screen.getByTestId('dashboard-page-player')).toHaveTextContent('"showOutline":false')
        expect(screen.getByTestId('dashboard-page-player')).toHaveTextContent('"showProgressHeader":true')
        expect(screen.getByTestId('dashboard-page-player')).toHaveTextContent('"completeButtonMode":"autoAfterOpen"')
        expect(screen.getByTestId('dashboard-page-player')).toHaveTextContent(
            '"progressStorageKey":"learning-content-progress:app-1:workspace-1:page-1"'
        )
        expect(screen.getByTestId('dashboard-page-progress-handler')).toHaveTextContent('true')
    })

    it('passes Learning Content table defaults to the generic dashboard details contract', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                settings: {
                    learningContent: {
                        defaultView: 'cards',
                        courseCompletionPolicy: {
                            navigationMode: 'sequential',
                            completionCondition: 'selectedItems',
                            statusFormat: 'passedFailed'
                        },
                        trackOrderPolicy: {
                            orderMode: 'byDays'
                        },
                        columnPreset: {
                            codename: 'learningContentDefault',
                            title: { en: 'Learning Content default' },
                            columns: [
                                { field: 'type', visible: true, width: 140 },
                                { field: 'title', visible: true, flex: 1 },
                                { field: 'ProjectId', visible: false }
                            ]
                        }
                    }
                },
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: false
                },
                objectCollection: {
                    name: 'Learning Content',
                    codename: 'LearningResources'
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-table-defaults')).toHaveTextContent('"defaultViewMode":"card"')
        expect(screen.getByTestId('dashboard-table-defaults')).toHaveTextContent('"field":"type"')
        expect(screen.getByTestId('dashboard-table-defaults')).toHaveTextContent('"visible":false')
        expect(dashboardMocks.capturedCrudOptions.createDefaultContext(dashboardMocks.dashboardStateOverrides.appData)).toMatchObject({
            learningContent: {
                courseCompletionPolicy: {
                    navigationMode: 'sequential',
                    completionCondition: 'selectedItems',
                    statusFormat: 'passedFailed'
                },
                trackOrderPolicy: {
                    orderMode: 'byDays'
                }
            }
        })
    })

    it('uses the configured create page surface after the create form opens', async () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
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
                objectCollection: {
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
                objectCollection: {
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

    it('forwards create-target defaults to the standalone create form', async () => {
        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        const user = userEvent.setup()
        await user.click(screen.getByTestId('dashboard-open-link-target'))

        await waitFor(() => {
            expect(dashboardMocks.handleOpenCreate).toHaveBeenCalledWith([
                { fieldCodename: 'ResourceType', enumCodename: 'Url' },
                { fieldCodename: 'Source', resourceSourceType: 'url' }
            ])
        })
    })

    it('hides the create action when the object runtime config disables it', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Standalone details',
                    runtimeConfig: { showCreateButton: false }
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })

    it('hides the create action when runtime permissions are read-only', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Standalone details'
                },
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: false,
                    editContent: false,
                    deleteContent: false
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })

    it('renders the Workspaces route with runtime navigation and no demo dashboard layout', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(createStandaloneAdapter).toHaveBeenCalledWith({ apiBaseUrl: 'http://localhost:3000', applicationId })
        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Workspaces')
        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}`)
        expect(screen.getByTestId('dashboard-menu')).toHaveTextContent(
            `LearningResources:false:/a/${applicationId}/object-1|Workspaces:true:/a/${applicationId}/workspaces`
        )
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('"showOverviewTitle":false')
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('"showOverviewCards":false')
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('"showSessionsChart":false')
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('"showPageViewsChart":false')
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('"showDetailsTable":false')
    })

    it('renders workspace detail navigation in standalone published apps', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const workspaceId = '00000000-0000-7000-8000-000000000111'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces/${workspaceId}/access`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}:${workspaceId}:access`)
        expect(screen.getByTestId('dashboard-menu')).toHaveTextContent(
            `LearningResources:false:/a/${applicationId}/object-1|Workspaces:true:/a/${applicationId}/workspaces|Dashboard:false:/a/${applicationId}/workspaces/${workspaceId}|Access:true:/a/${applicationId}/workspaces/${workspaceId}/access`
        )
    })

    it('does not duplicate Workspaces when the runtime menu already provides the root workspace link', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces`)
        dashboardMocks.dashboardStateOverrides = {
            menuSlot: {
                title: null,
                showTitle: false,
                items: [
                    {
                        id: 'learning-resources',
                        label: 'LearningResources',
                        kind: 'section',
                        objectCollectionId: 'object-1',
                        selected: true
                    },
                    {
                        id: 'runtime-workspaces',
                        label: 'Workspaces',
                        icon: 'apps',
                        kind: 'link',
                        href: `/a/${applicationId}/workspaces`,
                        selected: false
                    }
                ]
            }
        }

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-menu')).toHaveTextContent(
            `LearningResources:false:/a/${applicationId}/object-1|Workspaces:true:/a/${applicationId}/workspaces`
        )
    })
})
