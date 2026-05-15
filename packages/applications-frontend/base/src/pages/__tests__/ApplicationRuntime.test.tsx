import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import ApplicationRuntime from '../ApplicationRuntime'
import { createRuntimeAdapter } from '../../api/runtimeAdapter'

const runtimeMocks = vi.hoisted(() => ({
    capturedCellRenderers: null as any,
    capturedCrudOptions: null as any,
    mutate: vi.fn(),
    handlePendingInteractionAttempt: vi.fn(() => false),
    handleOpenCreate: vi.fn(),
    handleCloseForm: vi.fn(),
    setPaginationModel: vi.fn(),
    dashboardStateOverrides: {} as Record<string, unknown>,
    triggerRerender: undefined as undefined | (() => void)
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, options?: string | { defaultValue?: string; [key: string]: unknown }) => {
            if (typeof options === 'string') {
                return options
            }

            const template = options?.defaultValue ?? _key
            return template.replace('{{current}}', String(options?.current ?? '')).replace('{{max}}', String(options?.max ?? ''))
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('../../api/runtimeAdapter', () => ({
    createRuntimeAdapter: vi.fn(() => ({ queryKeyPrefix: ['runtime', 'app-1'] }))
}))

vi.mock('../../api/mutations', () => ({
    useUpdateRuntimeCell: vi.fn(() => ({ mutate: runtimeMocks.mutate })),
    usePendingRuntimeCellMutations: vi.fn(() => []),
    buildPendingRuntimeCellMap: vi.fn(() => new Map()),
    getRuntimeCellPendingKey: vi.fn((rowId: string, field: string) => `${rowId}:${field}`)
}))

vi.mock('@universo/apps-template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/apps-template-mui')>('@universo/apps-template-mui')

    return {
        ...actual,
        AppsDashboard: ({
            details,
            layoutConfig,
            menu
        }: {
            details?: {
                title?: string
                actions?: ReactNode
                banner?: ReactNode
                content?: ReactNode
                locale?: string
                sections?: Array<{ id: string; codename: string }>
                objectCollections?: Array<{ id: string; codename: string }>
            }
            layoutConfig?: Record<string, unknown>
            menu?: { items?: Array<{ label: string; selected?: boolean; href?: string | null }> }
        }) => (
            <div data-testid='apps-dashboard'>
                <div data-testid='apps-dashboard-layout'>{JSON.stringify(layoutConfig ?? {})}</div>
                <div data-testid='apps-dashboard-menu'>
                    {menu?.items?.map((item) => `${item.label}:${Boolean(item.selected)}:${item.href ?? ''}`).join('|')}
                </div>
                <div data-testid='apps-dashboard-banner'>{details?.banner}</div>
                <div data-testid='apps-dashboard-title'>{details?.title}</div>
                <div data-testid='apps-dashboard-details'>
                    {JSON.stringify({
                        locale: details?.locale,
                        sections: details?.sections,
                        objectCollections: details?.objectCollections
                    })}
                </div>
                <div data-testid='apps-dashboard-actions'>{details?.actions}</div>
                <div data-testid='apps-dashboard-content'>{details?.content}</div>
            </div>
        ),
        CrudDialogs: ({
            state,
            surface,
            renderForm = true,
            renderDelete = true
        }: {
            state?: { handleFormSubmit?: (data: Record<string, unknown>) => Promise<void> | void }
            surface?: 'dialog' | 'page'
            renderForm?: boolean
            renderDelete?: boolean
        }) => (
            <>
                {renderForm ? (
                    <div data-testid='crud-dialogs-surface'>
                        {surface ?? 'dialog'}
                        <button data-testid='crud-dialogs-submit' onClick={() => void state?.handleFormSubmit?.({})} type='button'>
                            submit
                        </button>
                    </div>
                ) : null}
                {renderDelete ? <div data-testid='crud-dialogs-delete'>delete</div> : null}
            </>
        ),
        RowActionsMenu: () => null,
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
        ),
        useCrudDashboard: (options: any) => {
            runtimeMocks.capturedCrudOptions = options
            runtimeMocks.capturedCellRenderers = options.cellRenderers
            return {
                appData: {
                    zoneWidgets: { left: [], right: [], center: [] },
                    menus: [],
                    activeMenuId: null,
                    settings: { sectionLinksEnabled: true },
                    workspacesEnabled: true,
                    section: { name: 'Details', codename: 'details' },
                    sections: [{ id: 'object-1', codename: 'details' }],
                    objectCollection: { name: 'Details' },
                    objectCollections: [{ id: 'object-1', codename: 'details' }]
                },
                isLoading: false,
                isFetching: false,
                isError: false,
                layoutConfig: {},
                columns: [],
                fieldConfigs: [],
                rows: [],
                rowCount: 0,
                paginationModel: { page: 0, pageSize: 50 },
                setPaginationModel: runtimeMocks.setPaginationModel,
                pageSizeOptions: [10, 25, 50, 100],
                localeText: undefined,
                handlePendingInteractionAttempt: runtimeMocks.handlePendingInteractionAttempt,
                activeSectionId: 'object-1',
                selectedSectionId: 'object-1',
                onSelectSection: vi.fn(),
                activeObjectCollectionId: 'object-1',
                selectedObjectCollectionId: 'object-1',
                onSelectObjectCollection: vi.fn(),
                activeMenu: null,
                dashboardMenuItems: [],
                menuSlot: {
                    title: null,
                    showTitle: false,
                    items: [{ id: 'modules', label: 'Modules', kind: 'section', objectCollectionId: 'object-1', selected: true }]
                },
                menusMap: {},
                formOpen: false,
                editRowId: null,
                formError: null,
                formInitialData: undefined,
                isFormReady: true,
                isSubmitting: false,
                handleOpenCreate: runtimeMocks.handleOpenCreate,
                handleOpenEdit: vi.fn(),
                handleCloseForm: runtimeMocks.handleCloseForm,
                handleFormSubmit: vi.fn().mockResolvedValue(undefined),
                deleteRowId: null,
                deleteError: null,
                isDeleting: false,
                handleOpenDelete: vi.fn(),
                handleCloseDelete: vi.fn(),
                handleConfirmDelete: vi.fn().mockResolvedValue(undefined),
                copyRowId: null,
                copyError: null,
                isCopying: false,
                handleOpenCopy: vi.fn(),
                handleCloseCopy: vi.fn(),
                menuAnchorEl: null,
                menuRowId: null,
                handleOpenMenu: vi.fn(),
                handleCloseMenu: vi.fn(),
                ...runtimeMocks.dashboardStateOverrides
            }
        }
    }
})

function renderRuntimePage() {
    return renderRuntimePageAt('/applications/app-1/runtime')
}

function RuntimeLocationProbe() {
    const location = useLocation()

    return <div data-testid='runtime-location-search'>{location.search}</div>
}

function RuntimeRouteElement() {
    return (
        <>
            <ApplicationRuntime />
            <RuntimeLocationProbe />
        </>
    )
}

function renderRuntimePageAt(route: string) {
    return render(
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/applications/:applicationId/runtime/*' element={<RuntimeRouteElement />} />
            </Routes>
        </MemoryRouter>
    )
}

function RuntimeHarness({ route }: { route: string }) {
    const [, setTick] = useState(0)

    runtimeMocks.triggerRerender = () => {
        setTick((value) => value + 1)
    }

    return (
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/applications/:applicationId/runtime/*' element={<RuntimeRouteElement />} />
            </Routes>
        </MemoryRouter>
    )
}

function renderRuntimeHarness(route: string) {
    return render(<RuntimeHarness route={route} />)
}

function renderBooleanCell(rowId: string) {
    const renderer = runtimeMocks.capturedCellRenderers?.BOOLEAN
    if (!renderer) {
        throw new Error('BOOLEAN cell renderer was not captured')
    }

    return render(
        renderer({
            value: false,
            rowId,
            field: 'isEnabled',
            column: {
                id: 'col-enabled',
                field: 'isEnabled',
                headerName: 'Enabled',
                dataType: 'BOOLEAN',
                isRequired: false,
                validationRules: {},
                uiConfig: {}
            }
        })
    )
}

describe('ApplicationRuntime pending interaction safety', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        runtimeMocks.capturedCellRenderers = null
        runtimeMocks.capturedCrudOptions = null
        runtimeMocks.handlePendingInteractionAttempt.mockReturnValue(false)
        runtimeMocks.handleCloseForm.mockReset()
        runtimeMocks.dashboardStateOverrides = {}
        runtimeMocks.triggerRerender = undefined
    })

    it('shows loading state before runtime data is available', () => {
        runtimeMocks.dashboardStateOverrides = {
            isLoading: true,
            appData: null
        }

        renderRuntimePage()

        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(screen.queryByTestId('apps-dashboard')).not.toBeInTheDocument()
    })

    it('shows error state when runtime data fails to load', () => {
        runtimeMocks.dashboardStateOverrides = {
            isError: true,
            appData: null
        }

        renderRuntimePage()

        expect(screen.getByRole('alert')).toHaveTextContent('Failed to load runtime data')
    })

    it('renders runtime details title and wires the create action button to the dashboard state', async () => {
        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Details')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"locale":"en"')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent('"sections":[{"id":"object-1","codename":"details"}]')
        expect(screen.getByTestId('apps-dashboard-details')).toHaveTextContent(
            '"objectCollections":[{"id":"object-1","codename":"details"}]'
        )

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('renders the workspaces route with runtime navigation and no demo dashboard layout', () => {
        renderRuntimePageAt('/applications/app-1/runtime/workspaces')

        expect(createRuntimeAdapter).toHaveBeenCalledWith('app-1')
        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Workspaces')
        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent('workspaces:app-1')
        expect(screen.getByTestId('apps-dashboard-menu')).toHaveTextContent(
            'Modules:false:/a/app-1/object-1|Workspaces:true:/a/app-1/workspaces'
        )
        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"showOverviewTitle":false')
        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"showOverviewCards":false')
        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"showSessionsChart":false')
        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"showPageViewsChart":false')
        expect(screen.getByTestId('apps-dashboard-layout')).toHaveTextContent('"showDetailsTable":false')
        expect(screen.queryByTestId('crud-dialogs-surface')).not.toBeInTheDocument()
    })

    it('passes workspace detail route parameters and renders workspace nested navigation', () => {
        const workspaceId = '00000000-0000-7000-8000-000000000111'

        renderRuntimePageAt(`/applications/app-1/runtime/workspaces/${workspaceId}/access`)

        expect(screen.getByTestId('runtime-workspaces-page')).toHaveTextContent(`workspaces:app-1:${workspaceId}:access`)
        expect(screen.getByTestId('apps-dashboard-menu')).toHaveTextContent(
            `Modules:false:/a/app-1/object-1|Workspaces:true:/a/app-1/workspaces|Dashboard:false:/a/app-1/workspaces/${workspaceId}|Access:true:/a/app-1/workspaces/${workspaceId}/access`
        )
    })

    it('does not duplicate Workspaces when the runtime menu already provides the root workspace link', () => {
        runtimeMocks.dashboardStateOverrides = {
            menuSlot: {
                title: null,
                showTitle: false,
                items: [
                    { id: 'modules', label: 'Modules', kind: 'section', objectCollectionId: 'object-1', selected: true },
                    {
                        id: 'runtime-workspaces',
                        label: 'Workspaces',
                        icon: 'apps',
                        kind: 'link',
                        href: '/a/app-1/workspaces',
                        selected: false
                    }
                ]
            }
        }

        renderRuntimePageAt('/applications/app-1/runtime/workspaces')

        expect(screen.getByTestId('apps-dashboard-menu')).toHaveTextContent(
            'Modules:false:/a/app-1/object-1|Workspaces:true:/a/app-1/workspaces'
        )
    })

    it('uses the base runtime URL for section links when section-specific links are disabled', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                settings: { sectionLinksEnabled: false },
                workspacesEnabled: true,
                section: { name: 'Details', codename: 'details' },
                objectCollection: { name: 'Details' }
            }
        }

        renderRuntimePageAt('/applications/app-1/runtime/workspaces')

        expect(screen.getByTestId('apps-dashboard-menu')).toHaveTextContent('Modules:false:/a/app-1|Workspaces:true:/a/app-1/workspaces')
    })

    it('uses a route UUID as the initially selected runtime section', () => {
        const sectionId = '00000000-0000-7000-8000-00000000abcd'

        renderRuntimePageAt(`/applications/app-1/runtime/${sectionId}`)

        expect(runtimeMocks.capturedCrudOptions.initialSectionId).toBe(sectionId)
    })

    it('renders the workspace limit banner inside dashboard details area', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: { name: 'Details' },
                workspaceLimit: {
                    canCreate: false,
                    currentRows: 2,
                    maxRows: 2
                }
            }
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-banner')).toHaveTextContent(
            'The workspace limit for this section has been reached (2 / 2).'
        )
    })

    it('prefers section aliases for dashboard title and inline mutation targeting', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                section: { name: 'Orders', codename: 'orders' },
                objectCollection: { name: 'Legacy Object' }
            },
            activeSectionId: 'section-9',
            selectedSectionId: 'section-9',
            activeObjectCollectionId: 'object-legacy',
            selectedObjectCollectionId: 'object-legacy'
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-title')).toHaveTextContent('Orders')

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('row-2')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.mutate).toHaveBeenCalledWith({
            rowId: 'row-2',
            field: 'isEnabled',
            value: true,
            sectionId: 'section-9'
        })
    })

    it('hides the create action when the object runtime config disables it', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { showCreateButton: false }
                }
            }
        }

        renderRuntimePage()

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })

    it('hides the create action and clears direct page create mode when runtime permissions are read-only', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
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

        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
        expect(screen.getByTestId('runtime-location-search')).toBeEmptyDOMElement()
    })

    it('renders page-surface forms inside dashboard content when createSurface is configured as page', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: false
        }

        renderRuntimeHarness('/applications/app-1/runtime')

        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getAllByTestId('crud-dialogs-surface')).toHaveLength(1)
        expect(screen.getByTestId('apps-dashboard-content')).toContainElement(screen.getByTestId('crud-dialogs-surface'))
    })

    it('derives page surface from URL search params on direct navigation', async () => {
        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            formOpen: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('apps-dashboard-content')).toContainElement(screen.getByTestId('crud-dialogs-surface'))
    })

    it('does not reopen an already-consumed create page surface after the form closes', async () => {
        const pageSurfaceAppData = {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            objectCollection: {
                name: 'Details',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false
        }

        const view = renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: true
        }

        view.rerender(
            <MemoryRouter
                initialEntries={['/applications/app-1/runtime?surface=page&mode=create']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <Routes>
                    <Route path='/applications/:applicationId/runtime/*' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        runtimeMocks.handleOpenCreate.mockClear()
        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false
        }

        view.rerender(
            <MemoryRouter
                initialEntries={['/applications/app-1/runtime?surface=page&mode=create']}
                future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
            >
                <Routes>
                    <Route path='/applications/:applicationId/runtime/*' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('blocks direct create page navigation when the object hides the create action', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                objectCollection: {
                    name: 'Details',
                    runtimeConfig: { showCreateButton: false, createSurface: 'page' }
                }
            },
            handleCloseForm: vi.fn()
        }

        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('clears page surface state when the active object changes', async () => {
        const objectOneData = {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            section: {
                name: 'Object One',
                codename: 'object-one',
                runtimeConfig: { createSurface: 'page' }
            },
            objectCollection: {
                name: 'Object One',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: objectOneData,
            formOpen: false,
            activeSectionId: 'object-1',
            selectedSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            selectedObjectCollectionId: 'object-1'
        }

        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: objectOneData,
            formOpen: true,
            activeSectionId: 'object-1',
            selectedSectionId: 'object-1',
            activeObjectCollectionId: 'object-1',
            selectedObjectCollectionId: 'object-1'
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })

        runtimeMocks.handleOpenCreate.mockClear()

        runtimeMocks.dashboardStateOverrides = {
            appData: {
                ...objectOneData,
                section: {
                    name: 'Object Two',
                    codename: 'object-two',
                    runtimeConfig: { createSurface: 'page' }
                },
                objectCollection: {
                    name: 'Object Two',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true,
            activeSectionId: 'object-2',
            selectedSectionId: 'object-2',
            activeObjectCollectionId: 'object-2',
            selectedObjectCollectionId: 'object-2'
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(runtimeMocks.handleCloseForm).toHaveBeenCalledTimes(1)
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
        })
        expect(screen.getByTestId('apps-dashboard-content')).toBeEmptyDOMElement()
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('keeps page-surface content mounted until submit settles and then clears URL params', async () => {
        const pageSurfaceAppData = {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            objectCollection: {
                name: 'Details',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: false
        }

        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
        })

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: true,
            isSubmitting: false
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('runtime-location-search')).toHaveTextContent('?surface=page&mode=create')

        const user = userEvent.setup()
        await user.click(screen.getByTestId('crud-dialogs-submit'))

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: true
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('apps-dashboard-content')).toHaveTextContent('page')
        })
        expect(screen.getByTestId('runtime-location-search')).toHaveTextContent('?surface=page&mode=create')

        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false,
            isSubmitting: false
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(screen.getByTestId('runtime-location-search')).toBeEmptyDOMElement()
        })
        expect(screen.getByTestId('apps-dashboard-content')).toBeEmptyDOMElement()
    })

    it('blocks inline BOOLEAN mutation attempts for pending rows', async () => {
        runtimeMocks.handlePendingInteractionAttempt.mockReturnValue(true)
        renderRuntimePage()

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('optimistic-row-1')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.handlePendingInteractionAttempt).toHaveBeenCalledWith('optimistic-row-1')
        expect(runtimeMocks.mutate).not.toHaveBeenCalled()
    })

    it('keeps inline BOOLEAN mutation working for confirmed rows', async () => {
        renderRuntimePage()

        await waitFor(() => {
            expect(runtimeMocks.capturedCellRenderers?.BOOLEAN).toBeTypeOf('function')
        })

        const user = userEvent.setup()
        renderBooleanCell('row-1')

        await user.click(screen.getByRole('checkbox'))

        expect(runtimeMocks.handlePendingInteractionAttempt).toHaveBeenCalledWith('row-1')
        expect(runtimeMocks.mutate).toHaveBeenCalledWith({
            rowId: 'row-1',
            field: 'isEnabled',
            value: true,
            sectionId: 'object-1'
        })
    })
})
