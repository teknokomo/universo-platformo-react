import type { ReactNode } from 'react'
import type { MouseEvent } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DashboardApp from '../DashboardApp'
import { createStandaloneAdapter } from '../../api/adapters'

const dashboardMocks = vi.hoisted(() => ({
    dashboardStateOverrides: {} as Record<string, unknown>,
    handleOpenCreate: vi.fn(),
    handleOpenEdit: vi.fn(),
    handleOpenCopy: vi.fn(),
    handleOpenDelete: vi.fn(),
    onSelectObjectCollection: vi.fn(),
    onOpenCreateTarget: null as
        | null
        | ((target: {
              id: string
              label: string
              objectCollectionId?: string
              relationScope?: { fieldCodename: string; parentRecordId: string }
          }) => void),
    onOpenRowTarget: null as
        | null
        | ((
              target: { rowId: string; objectCollectionId?: string; relationScope?: { fieldCodename: string; parentRecordId: string } },
              action: 'edit' | 'copy' | 'delete'
          ) => void),
    templateKey: 'dashboard',
    effectiveLayoutConfig: {} as Record<string, unknown>,
    effectiveLayoutWidgets: [] as Array<Record<string, unknown>>,
    resolvedEntityTypeId: null as string | null,
    capturedDashboardDetails: null as Record<string, unknown> | null,
    onOpenRowMenu: null as
        | null
        | ((
              event: MouseEvent<HTMLElement>,
              rowId: string,
              target?: { entityCodename: string; recordHandle: string; relationScope?: { fieldCodename: string; parentRecordId: string } }
          ) => void),
    boundRowActionData: null as null | { appData: Record<string, unknown>; row: Record<string, unknown> },
    fetchList: vi.fn(),
    fetchRow: vi.fn(),
    invalidateQueries: vi.fn(),
    enqueueSnackbar: vi.fn(),
    capturedCrudOptions: null as null | { createDefaultContext?: (appData: unknown) => unknown },
    marketingProps: null as null | Record<string, unknown>
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
    createStandaloneAdapter: vi.fn(() => ({
        queryKeyPrefix: ['standalone', 'app-1'],
        fetchList: dashboardMocks.fetchList,
        fetchRow: dashboardMocks.fetchRow,
        recordCommand: vi.fn(),
        workflowAction: vi.fn()
    }))
}))

vi.mock('@tanstack/react-query', async () => {
    const React = await import('react')
    return {
        useQuery: (options: { queryKey?: unknown[]; enabled?: boolean; queryFn?: () => Promise<unknown> }) => {
            const isBoundActionQuery = options.queryKey?.[0] === 'runtime-bound-row-actions'
            const [result, setResult] = React.useState<{ isLoading: boolean; isError: boolean; isFetching: boolean; data: unknown }>({
                isLoading: false,
                isError: false,
                isFetching: false,
                data: null
            })
            const queryFnRef = React.useRef(options.queryFn)
            queryFnRef.current = options.queryFn
            const serializedKey = JSON.stringify(options.queryKey)
            React.useEffect(() => {
                if (!isBoundActionQuery || !options.enabled || !queryFnRef.current) {
                    setResult({ isLoading: false, isError: false, isFetching: false, data: null })
                    return undefined
                }
                let cancelled = false
                setResult({ isLoading: true, isError: false, isFetching: true, data: null })
                void queryFnRef.current().then(
                    (data) => {
                        if (!cancelled) setResult({ isLoading: false, isError: false, isFetching: false, data })
                    },
                    () => {
                        if (!cancelled) setResult({ isLoading: false, isError: true, isFetching: false, data: null })
                    }
                )
                return () => {
                    cancelled = true
                }
            }, [isBoundActionQuery, options.enabled, serializedKey])
            if (!isBoundActionQuery) {
                return {
                    isLoading: false,
                    isError: false,
                    data: {
                        status: 'ok',
                        resolvedEntityTypeId: dashboardMocks.resolvedEntityTypeId,
                        layout: { templateKey: dashboardMocks.templateKey, config: dashboardMocks.effectiveLayoutConfig },
                        widgets: dashboardMocks.effectiveLayoutWidgets
                    }
                }
            }
            return result
        },
        useMutation: () => ({ mutate: vi.fn(), isPending: false, variables: undefined }),
        useQueryClient: () => ({ invalidateQueries: dashboardMocks.invalidateQueries })
    }
})

vi.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: dashboardMocks.enqueueSnackbar }) }))

vi.mock('../../marketing-page/MarketingRuntimeContent', () => ({
    default: (props: Record<string, unknown>) => {
        dashboardMocks.marketingProps = props
        return <div data-testid='marketing-runtime-content'>marketing</div>
    }
}))

vi.mock('../../dashboard/Dashboard', () => ({
    default: ({
        details,
        layoutConfig,
        zoneWidgets
    }: {
        details?: {
            title?: string
            sectionId?: string
            sectionCodename?: string
            objectCollectionId?: string
            objectCollectionCodename?: string
            settings?: unknown
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
            onOpenCreateTarget?: (target: {
                id: string
                label: string
                objectCollectionId?: string
                relationScope?: { fieldCodename: string; parentRecordId: string }
                createDefaults?: Array<{
                    fieldCodename: string
                    enumCodename?: string
                    resourceSourceType?: string
                    contextPath?: string
                }>
            }) => void
            onOpenRowTarget?: (
                target: {
                    rowId: string
                    objectCollectionId?: string
                    relationScope?: { fieldCodename: string; parentRecordId: string }
                },
                action: 'edit' | 'copy' | 'delete'
            ) => void
            onOpenRowMenu?: (
                event: MouseEvent<HTMLElement>,
                rowId: string,
                target?: { entityCodename: string; recordHandle: string; relationScope?: { fieldCodename: string; parentRecordId: string } }
            ) => void
        }
        layoutConfig?: Record<string, unknown>
        zoneWidgets?: Record<string, unknown>
    }) => {
        dashboardMocks.capturedDashboardDetails = details ?? null
        dashboardMocks.onOpenCreateTarget = details?.onOpenCreateTarget ?? null
        dashboardMocks.onOpenRowTarget = details?.onOpenRowTarget ?? null
        dashboardMocks.onOpenRowMenu = details?.onOpenRowMenu ?? null
        return (
            <div data-testid='dashboard-app'>
                <div data-testid='dashboard-layout'>{JSON.stringify(layoutConfig ?? {})}</div>
                <div data-testid='dashboard-title'>{details?.title}</div>
                <div data-testid='dashboard-details-context'>
                    {details?.sectionId ?? ''}:{details?.sectionCodename ?? ''}:{details?.objectCollectionId ?? ''}:
                    {details?.objectCollectionCodename ?? ''}
                </div>
                <div data-testid='dashboard-actions'>{details?.actions}</div>
                <div data-testid='dashboard-content'>{details?.content}</div>
                <div data-testid='dashboard-page-blocks'>{String(details?.pageBlocks?.length ?? 0)}</div>
                <div data-testid='dashboard-page-progress-handler'>
                    {String(typeof details?.pagePlayer?.onProgressChange === 'function')}
                </div>
                <div data-testid='dashboard-page-player'>{JSON.stringify(details?.pagePlayer ?? {})}</div>
                <div data-testid='dashboard-details-settings'>{JSON.stringify(details?.settings ?? {})}</div>
                <div data-testid='dashboard-zone-widgets'>{JSON.stringify(zoneWidgets ?? {})}</div>
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
                <button
                    data-testid='dashboard-open-bound-row-actions'
                    onClick={(event) =>
                        details?.onOpenRowMenu?.(event, 'rh1.test-bound-row-target-0001', {
                            entityCodename: 'Courses',
                            recordHandle: 'rh1.test-bound-row-target-0001',
                            relationScope: { fieldCodename: 'CourseId', parentRecordId: 'parent-1' }
                        })
                    }
                    type='button'
                >
                    open row actions
                </button>
            </div>
        )
    }
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
    RowActionsMenu: ({
        runtimeContext
    }: {
        runtimeContext?: {
            row: Record<string, unknown> | null
            onCloseMenu: () => void
            onRowTargetAction?: (rowId: string, action: 'edit' | 'copy' | 'delete', expectedVersion: number | null) => void
        }
    }) =>
        runtimeContext ? (
            <div data-testid='bound-row-actions-menu'>
                <span>{String(runtimeContext.row?.title ?? '')}</span>
                <button
                    onClick={() => {
                        runtimeContext.onCloseMenu()
                        runtimeContext.onRowTargetAction?.(
                            'rh1.test-bound-row-target-0001',
                            'edit',
                            typeof runtimeContext.row?._upl_version === 'number' ? runtimeContext.row._upl_version : null
                        )
                    }}
                    type='button'
                >
                    Edit bound row
                </button>
            </div>
        ) : null
}))

vi.mock('../../hooks/useCrudDashboard', () => ({
    useCrudDashboard: (options: { createDefaultContext?: (appData: unknown) => unknown }) => {
        dashboardMocks.capturedCrudOptions = options
        return {
            appData: {
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
            handleOpenDelete: dashboardMocks.handleOpenDelete,
            handleCloseDelete: vi.fn(),
            handleConfirmDelete: vi.fn().mockResolvedValue(undefined),
            handleOpenMenu: vi.fn(),
            handleCloseMenu: vi.fn(),
            activeMenu: null,
            menuAnchorEl: null,
            menuRowId: null,
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
        dashboardMocks.templateKey = 'dashboard'
        dashboardMocks.effectiveLayoutConfig = {}
        dashboardMocks.effectiveLayoutWidgets = []
        dashboardMocks.resolvedEntityTypeId = null
        dashboardMocks.capturedDashboardDetails = null
        dashboardMocks.onOpenRowMenu = null
        dashboardMocks.boundRowActionData = null
        dashboardMocks.fetchList.mockReset()
        dashboardMocks.fetchRow.mockReset()
        dashboardMocks.invalidateQueries.mockReset()
        dashboardMocks.enqueueSnackbar.mockReset()
        dashboardMocks.onSelectObjectCollection.mockReset()
        dashboardMocks.onOpenCreateTarget = null
        dashboardMocks.onOpenRowTarget = null
        dashboardMocks.capturedCrudOptions = null
        dashboardMocks.marketingProps = null
        window.history.pushState({}, '', '/')
    })

    it('renders the marketing runtime from the effective template at the standalone application root', () => {
        dashboardMocks.templateKey = 'marketing-page'
        window.history.pushState({}, '', '/a/app-1')

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('marketing-runtime-content')).toHaveTextContent('marketing')
        expect(screen.queryByTestId('dashboard-app')).not.toBeInTheDocument()
        expect(dashboardMocks.marketingProps).toMatchObject({ effectiveLayoutWidgets: [], effectiveLayoutConfig: {} })
        expect(dashboardMocks.marketingProps).not.toHaveProperty('sharedLayoutWidgets')
    })

    it('renders a scoped marketing layout on a standalone entity route', () => {
        dashboardMocks.templateKey = 'marketing-page'
        window.history.pushState({}, '', '/a/app-1?targetKind=page&entityTypeCodename=Landing')

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('marketing-runtime-content')).toHaveTextContent('marketing')
        expect(screen.queryByTestId('dashboard-app')).not.toBeInTheDocument()
    })

    it('fails closed for an invalid standalone target instead of loading the global layout', () => {
        window.history.pushState({}, '', '/a/app-1?targetKind=unsupported')

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByRole('alert')).toHaveTextContent('The runtime target in this URL is invalid.')
        expect(screen.queryByTestId('dashboard-app')).not.toBeInTheDocument()
    })

    it('loads the selected entity row context before reusing the host CRUD action flow', async () => {
        const relationScope = { fieldCodename: 'CourseId', parentRecordId: 'parent-1' }
        const permissions = {
            manageMembers: false,
            manageApplication: false,
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: false
        }
        const currentEntity = { id: 'object-1', name: 'Resources', codename: 'LearningResources' }
        const targetEntity = { id: 'object-2', name: 'Courses', codename: 'Courses' }
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                settings: {},
                workspacesEnabled: true,
                currentWorkspaceId: 'workspace-1',
                permissions,
                objectCollection: currentEntity,
                activeObjectCollectionId: currentEntity.id,
                objectCollections: [currentEntity, targetEntity],
                sections: [currentEntity, targetEntity]
            },
            activeObjectCollectionId: currentEntity.id,
            selectedObjectCollectionId: currentEntity.id
        }
        dashboardMocks.fetchList.mockResolvedValue({
            objectCollection: targetEntity,
            columns: [],
            rows: [],
            pagination: { total: 1, limit: 1, offset: 0 },
            permissions
        })
        dashboardMocks.fetchRow.mockResolvedValue({
            id: '019f2000-0000-7000-8000-000000000099',
            version: 5,
            data: { title: 'Entity-backed course' }
        })

        const view = render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)
        fireEvent.click(screen.getByTestId('dashboard-open-bound-row-actions'))

        await waitFor(() => expect(screen.getByTestId('bound-row-actions-menu')).toBeInTheDocument())
        expect(screen.getByText('Entity-backed course')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('019f2000-0000-7000-8000-000000000099')
        expect(dashboardMocks.fetchList).toHaveBeenCalledWith(
            expect.objectContaining({ objectCollectionId: 'object-2', sectionId: 'object-2', workspaceId: 'workspace-1' })
        )
        expect(dashboardMocks.fetchRow).toHaveBeenCalledWith(
            'rh1.test-bound-row-target-0001',
            expect.objectContaining({ objectCollectionId: 'object-2', workspaceId: 'workspace-1' })
        )

        fireEvent.click(screen.getByRole('button', { name: 'Edit bound row' }))
        expect(dashboardMocks.onSelectObjectCollection).toHaveBeenCalledWith('object-2')

        const loadedTargetAppData = {
            settings: {},
            workspacesEnabled: true,
            currentWorkspaceId: 'workspace-1',
            permissions,
            objectCollection: targetEntity,
            section: targetEntity,
            activeObjectCollectionId: targetEntity.id,
            activeSectionId: targetEntity.id,
            objectCollections: [currentEntity, targetEntity],
            sections: [currentEntity, targetEntity]
        }
        dashboardMocks.dashboardStateOverrides = {
            appData: loadedTargetAppData,
            activeObjectCollectionId: targetEntity.id,
            activeSectionId: targetEntity.id,
            selectedObjectCollectionId: targetEntity.id,
            selectedSectionId: targetEntity.id
        }
        view.rerender(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        await waitFor(() => expect(dashboardMocks.handleOpenEdit).toHaveBeenCalledWith('rh1.test-bound-row-target-0001', relationScope, 5))
    })

    it('retains action-specific relationScope across deferred row targets while changing sections', async () => {
        const createRelationScope = {
            fieldCodename: 'CourseId',
            parentRecordId: 'rh1.test-relation-parent-0001'
        }
        const editRelationScope = {
            fieldCodename: 'CourseId',
            parentRecordId: 'rh1.test-relation-parent-0002'
        }
        const copyRelationScope = {
            fieldCodename: 'CourseId',
            parentRecordId: 'rh1.test-relation-parent-0003'
        }
        const deleteRelationScope = {
            fieldCodename: 'CourseId',
            parentRecordId: 'rh1.test-relation-parent-0004'
        }
        const createDefaults = [{ fieldCodename: 'CourseId', contextPath: 'relation.parentRecordId' }]
        const createDefaultContext = { relation: { parentRecordId: createRelationScope.parentRecordId } }
        const sections = [
            { id: 'object-1', name: 'Resources', codename: 'LearningResources' },
            { id: 'object-2', name: 'Courses', codename: 'Courses' }
        ]
        const permissions = {
            manageMembers: false,
            manageApplication: false,
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: false
        }
        const view = render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        act(() => {
            dashboardMocks.onOpenCreateTarget?.({
                id: 'relation-create:course-resources',
                label: 'Course resources',
                objectCollectionId: 'object-2',
                createDefaults,
                createDefaultContext,
                relationScope: createRelationScope
            })
        })
        expect(dashboardMocks.onSelectObjectCollection).toHaveBeenCalledWith('object-2')
        expect(dashboardMocks.handleOpenCreate).not.toHaveBeenCalled()

        const renderLoadedSection = (sectionId: string) => {
            const section = sections.find(({ id }) => id === sectionId)!
            dashboardMocks.dashboardStateOverrides = {
                appData: {
                    settings: { sectionLinksEnabled: true },
                    workspacesEnabled: true,
                    permissions,
                    objectCollection: section,
                    section,
                    activeObjectCollectionId: sectionId,
                    activeSectionId: sectionId,
                    objectCollections: sections,
                    sections
                },
                activeObjectCollectionId: sectionId,
                activeSectionId: sectionId,
                selectedObjectCollectionId: sectionId,
                selectedSectionId: sectionId,
                isLoading: false,
                isFetching: false
            }
            view.rerender(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)
        }

        renderLoadedSection('object-2')
        await waitFor(() => {
            expect(dashboardMocks.handleOpenCreate).toHaveBeenCalledWith(
                createDefaults,
                createDefaultContext,
                createRelationScope,
                undefined
            )
        })

        act(() => {
            dashboardMocks.onOpenRowTarget?.({ rowId: 'row-1', objectCollectionId: 'object-1', relationScope: copyRelationScope }, 'copy')
        })
        expect(dashboardMocks.onSelectObjectCollection).toHaveBeenCalledWith('object-1')
        renderLoadedSection('object-1')

        await waitFor(() => {
            expect(dashboardMocks.handleOpenCopy).toHaveBeenCalledWith('row-1', copyRelationScope)
        })

        act(() => {
            dashboardMocks.onOpenRowTarget?.({ rowId: 'row-2', objectCollectionId: 'object-2', relationScope: editRelationScope }, 'edit')
        })
        expect(dashboardMocks.onSelectObjectCollection).toHaveBeenCalledWith('object-2')
        renderLoadedSection('object-2')

        await waitFor(() => {
            expect(dashboardMocks.handleOpenEdit).toHaveBeenCalledWith('row-2', editRelationScope)
        })

        act(() => {
            dashboardMocks.onOpenRowTarget?.(
                { rowId: 'row-3', objectCollectionId: 'object-1', relationScope: deleteRelationScope },
                'delete'
            )
        })
        expect(dashboardMocks.onSelectObjectCollection).toHaveBeenCalledWith('object-1')
        renderLoadedSection('object-1')

        await waitFor(() => {
            expect(dashboardMocks.handleOpenDelete).toHaveBeenCalledWith('row-3', deleteRelationScope)
        })
    })

    it('passes generated Entity navigation runtimeData through the effective Dashboard placement', () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
        window.history.pushState({}, '', `/a/${applicationId}?locale=ru&workspaceId=workspace-1`)
        dashboardMocks.effectiveLayoutWidgets = [
            {
                id: '018f8a78-7b8f-7c1d-a111-222233334445',
                instanceKey: 'main-menu',
                layoutId: '018f8a78-7b8f-7c1d-a111-222233334446',
                widgetKey: 'menuWidget',
                zone: 'left',
                sortOrder: 1,
                isActive: true,
                parentInstanceKey: null,
                slotKey: null,
                config: { variant: 'generated' },
                runtimeData: {
                    status: 'ready',
                    data: {
                        kind: 'menu',
                        title: 'Navigation',
                        showTitle: false,
                        overflowLabel: 'More',
                        items: [
                            {
                                key: 'page:Landing',
                                label: 'Landing',
                                icon: null,
                                kind: 'section',
                                target: { kind: 'page', codename: 'Landing' }
                            },
                            {
                                key: 'object:Products',
                                label: 'Products',
                                icon: null,
                                kind: 'section',
                                target: { kind: 'object', codename: 'Products' }
                            }
                        ],
                        overflowItems: []
                    }
                }
            }
        ]
        dashboardMocks.dashboardStateOverrides = {
            appData: {
                settings: { sectionLinksEnabled: true },
                objectCollection: { id: 'page-1', name: 'Landing', kind: 'page', codename: 'Landing' },
                section: { id: 'page-1', name: 'Landing', kind: 'page', codename: 'Landing' },
                activeObjectCollectionId: 'page-1',
                activeSectionId: 'page-1',
                objectCollections: [{ id: 'object-1', name: 'Products', kind: 'object', codename: 'Products', tableName: 'obj_products' }],
                sections: [{ id: 'page-1', name: 'Landing', kind: 'page', codename: 'Landing' }]
            }
        }

        render(<DashboardApp applicationId={applicationId} locale='ru' apiBaseUrl='http://localhost:3000' />)

        const placements = JSON.parse(screen.getByTestId('dashboard-zone-widgets').textContent ?? '{}') as {
            left?: Array<Record<string, unknown>>
        }
        expect(placements.left).toHaveLength(1)
        expect(placements.left?.[0]).toMatchObject({
            widgetKey: 'menuWidget',
            zone: 'left',
            config: { variant: 'generated' },
            runtimeData: {
                status: 'ready',
                data: {
                    kind: 'menu',
                    items: [{ target: { kind: 'page', codename: 'Landing' } }, { target: { kind: 'object', codename: 'Products' } }]
                }
            }
        })
        expect(JSON.stringify(placements)).not.toContain('0190a9b5-3cde-7abc-8def-0123456789')
        expect(screen.getByTestId('dashboard-details-settings')).toHaveTextContent('{"sectionLinksEnabled":true}')
    })

    it('keeps dialog surface by default when no page runtime surface is configured', () => {
        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Standalone details')
        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
    })

    it('passes only explicit side-menu settings from the effective layout to the dashboard shell', () => {
        dashboardMocks.effectiveLayoutConfig = {
            showHeader: true,
            showAppNavbar: true,
            sideMenu: { availableModes: ['compact'], primaryMode: 'compact', rememberUserChoice: false }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent(
            JSON.stringify({
                sideMenu: { availableModes: ['compact'], primaryMode: 'compact', rememberUserChoice: false }
            })
        )
        expect(screen.getByTestId('dashboard-layout')).not.toHaveTextContent('showHeader')
        expect(screen.getByTestId('dashboard-layout')).not.toHaveTextContent('showAppNavbar')
    })

    it('passes runtime page blocks and Learning Content player settings to the dashboard', () => {
        dashboardMocks.dashboardStateOverrides = {
            selectedSectionId: 'page-1',
            selectedObjectCollectionId: 'page-1',
            activeSectionId: 'page-1',
            activeObjectCollectionId: 'page-1',
            appData: {
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
                },
                currentWorkspaceId: 'workspace-1',
                settings: {
                    learningContent: {
                        playerPreset: { showOutline: false, showProgressHeader: true, completeButtonMode: 'autoAfterOpen' },
                        courseCompletionPolicy: {
                            navigationMode: 'sequential',
                            completionCondition: 'selectedItems',
                            statusFormat: 'passedFailed'
                        },
                        trackOrderPolicy: { orderMode: 'byDays' }
                    }
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

    it('keeps Learning Content presentation settings out of the generic dashboard host context', () => {
        dashboardMocks.dashboardStateOverrides = {
            appData: {
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
                },
                settings: {
                    learningContent: {
                        defaultView: 'cards',
                        courseCompletionPolicy: {
                            navigationMode: 'sequential',
                            completionCondition: 'selectedItems',
                            statusFormat: 'passedFailed'
                        },
                        trackOrderPolicy: { orderMode: 'byDays' }
                    }
                }
            }
        }

        render(<DashboardApp applicationId='app-1' locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('tableDefaults')
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('rows')
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('columns')
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

    it('renders the Workspaces route with runtime navigation and no legacy dashboard flags', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(createStandaloneAdapter).toHaveBeenCalledWith({ apiBaseUrl: 'http://localhost:3000', applicationId })
        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Workspaces')
        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}`)
        expect(screen.getByTestId('dashboard-layout')).toHaveTextContent('{}')
    })

    it('reacts to internal runtime link navigation without a full page reload', async () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        window.history.pushState({}, '', `/a/${applicationId}`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Standalone details')

        act(() => {
            window.history.pushState({}, '', `/a/${applicationId}/workspaces`)
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        await waitFor(() => {
            expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Workspaces')
        })
        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}`)
    })

    it('projects the semantic Structure target through its effective workspace placement', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        window.history.pushState({}, '', `/a/${applicationId}?targetKind=object&entityTypeCodename=Structure`)
        dashboardMocks.resolvedEntityTypeId = 'structure-section'
        dashboardMocks.effectiveLayoutWidgets = [
            {
                id: '018f8a78-7b8f-7c1d-a111-222233334445',
                instanceKey: 'interpretation-workspace',
                layoutId: '018f8a78-7b8f-7c1d-a111-222233334446',
                widgetKey: 'interpretationNetworkWorkspace',
                zone: 'center',
                sortOrder: 1,
                isActive: true,
                parentInstanceKey: null,
                slotKey: null,
                config: { structureMode: 'multiple', conceptCodename: 'Structure' }
            }
        ]
        dashboardMocks.dashboardStateOverrides = {
            selectedSectionId: 'intro-page',
            activeSectionId: 'intro-page',
            appData: {
                objectCollection: { id: 'intro-page', name: 'Welcome', codename: 'WelcomePage', pageBlocks: [{ id: 'intro' }] },
                section: { id: 'intro-page', name: 'Welcome', codename: 'WelcomePage' },
                objectCollections: [{ id: 'structure-section', name: 'Structure', codename: 'Structure', tableName: 'obj_structure' }],
                sections: [
                    { id: 'intro-page', name: 'Welcome', codename: 'WelcomePage' },
                    { id: 'structure-section', name: 'Structure', codename: 'Structure', tableName: 'obj_structure' }
                ],
                activeObjectCollectionId: 'intro-page',
                activeSectionId: 'intro-page'
            }
        }

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Structure')
        expect(screen.getByTestId('dashboard-details-context')).toHaveTextContent('structure-section:Structure:structure-section:Structure')
        expect(screen.getByTestId('dashboard-page-blocks')).toHaveTextContent('0')
        const placements = JSON.parse(screen.getByTestId('dashboard-zone-widgets').textContent ?? '{}') as {
            center?: Array<Record<string, unknown>>
        }
        expect(placements.center).toMatchObject([
            {
                widgetKey: 'interpretationNetworkWorkspace',
                config: { structureMode: 'multiple', conceptCodename: 'Structure' }
            }
        ])
    })

    it('renders a resolved union datasource when its active target differs from the aggregate route section', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const aggregateSectionId = '00000000-0000-7000-8000-000000000010'
        const targetSectionId = '00000000-0000-7000-8000-000000000011'
        window.history.pushState({}, '', `/a/${applicationId}/${aggregateSectionId}`)
        dashboardMocks.dashboardStateOverrides = {
            selectedSectionId: aggregateSectionId,
            selectedObjectCollectionId: undefined,
            activeSectionId: aggregateSectionId,
            activeObjectCollectionId: targetSectionId,
            rows: [{ id: 'resource-1', title: 'Operations handbook' }],
            appData: {
                settings: { sectionLinksEnabled: true },
                workspacesEnabled: false,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: false
                },
                objectCollection: {
                    id: targetSectionId,
                    name: 'Pages',
                    codename: 'Page',
                    tableName: 'obj_page'
                },
                section: {
                    id: aggregateSectionId,
                    name: 'Learning Content',
                    codename: 'ContentProjects',
                    tableName: null
                },
                activeObjectCollectionId: targetSectionId,
                activeSectionId: targetSectionId,
                objectCollections: [{ id: targetSectionId, name: 'Pages', codename: 'Page', tableName: 'obj_page' }],
                sections: [
                    { id: aggregateSectionId, name: 'Learning Content', codename: 'ContentProjects', tableName: null },
                    { id: targetSectionId, name: 'Pages', codename: 'Page', tableName: 'obj_page' }
                ],
                rows: [{ id: 'resource-1', title: 'Operations handbook' }],
                columns: [{ id: 'title-column', field: 'title', codename: 'Title', dataType: 'STRING', headerName: 'Title' }],
                pagination: { total: 1, limit: 50, offset: 0 }
            }
        }

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Pages')
        expect(screen.getByTestId('dashboard-details-context')).toHaveTextContent(
            `${aggregateSectionId}:ContentProjects:${aggregateSectionId}:ContentProjects`
        )
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('rows')
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('runtimeColumns')
    })

    it('does not accept an unresolved runtime route merely because stale data contains a union datasource', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const missingSectionId = '00000000-0000-7000-8000-000000000099'
        window.history.pushState({}, '', `/a/${applicationId}/${missingSectionId}`)
        dashboardMocks.dashboardStateOverrides = {
            selectedSectionId: missingSectionId,
            activeSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            rows: [{ id: 'stale-row', title: 'Stale union content' }],
            rowCount: 42,
            appData: {
                settings: { sectionLinksEnabled: true },
                workspacesEnabled: false,
                permissions: {
                    manageMembers: false,
                    manageApplication: false,
                    createContent: true,
                    editContent: true,
                    deleteContent: true,
                    readReports: false
                },
                objectCollection: { id: 'object-1', name: 'Stale section', codename: 'StaleSection', tableName: 'obj_stale' },
                section: { id: 'object-1', name: 'Stale section', codename: 'StaleSection', tableName: 'obj_stale' },
                activeObjectCollectionId: 'object-1',
                activeSectionId: 'object-1',
                objectCollections: [{ id: 'object-1', name: 'Stale section', codename: 'StaleSection', tableName: 'obj_stale' }],
                sections: [{ id: 'object-1', name: 'Stale section', codename: 'StaleSection', tableName: 'obj_stale' }],
                rows: [{ id: 'stale-row', title: 'Stale union content' }],
                columns: [{ id: 'title-column', field: 'title', codename: 'Title', dataType: 'STRING', headerName: 'Title' }],
                pagination: { total: 1, limit: 50, offset: 0 }
            }
        }

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('rows')
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('columns')
        expect(screen.getByTestId('dashboard-zone-widgets')).not.toHaveTextContent('stale-union-table')
    })

    it('does not render stale section data for an unresolved runtime route', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const missingSectionId = '00000000-0000-7000-8000-000000000099'
        window.history.pushState({}, '', `/a/${applicationId}/${missingSectionId}`)
        dashboardMocks.dashboardStateOverrides = {
            selectedSectionId: missingSectionId,
            activeSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            rows: [{ id: 'stale-row', title: 'Stale content' }]
        }

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-title')).toHaveTextContent('Standalone details')
        expect(screen.getByTestId('dashboard-details-context')).toHaveTextContent(`${missingSectionId}::${missingSectionId}:`)
        expect(dashboardMocks.capturedDashboardDetails).not.toHaveProperty('rows')
    })

    it('renders workspace detail navigation in standalone published apps', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const workspaceId = '00000000-0000-7000-8000-000000000111'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces/${workspaceId}/access`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}:${workspaceId}:access`)
    })

    it('routes workspace settings in standalone published apps', () => {
        const applicationId = '00000000-0000-7000-8000-000000000001'
        const workspaceId = '00000000-0000-7000-8000-000000000111'
        window.history.pushState({}, '', `/a/${applicationId}/workspaces/${workspaceId}/settings`)

        render(<DashboardApp applicationId={applicationId} locale='en' apiBaseUrl='http://localhost:3000' />)

        expect(screen.getByTestId('dashboard-content')).toHaveTextContent(`workspaces:${applicationId}:${workspaceId}:settings`)
    })
})
