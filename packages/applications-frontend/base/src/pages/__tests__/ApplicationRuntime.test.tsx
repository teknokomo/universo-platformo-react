import { useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationRuntime from '../ApplicationRuntime'

const runtimeMocks = vi.hoisted(() => ({
    capturedCellRenderers: null as any,
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
        AppsDashboard: ({ details }: { details?: { title?: string; actions?: ReactNode; banner?: ReactNode } }) => (
            <div data-testid='apps-dashboard'>
                <div data-testid='apps-dashboard-banner'>{details?.banner}</div>
                <div data-testid='apps-dashboard-title'>{details?.title}</div>
                <div data-testid='apps-dashboard-actions'>{details?.actions}</div>
            </div>
        ),
        CrudDialogs: ({ surface }: { surface?: 'dialog' | 'page' }) => <div data-testid='crud-dialogs-surface'>{surface ?? 'dialog'}</div>,
        RowActionsMenu: () => null,
        useCrudDashboard: (options: any) => {
            runtimeMocks.capturedCellRenderers = options.cellRenderers
            return {
                appData: {
                    zoneWidgets: { left: [], right: [], center: [] },
                    menus: [],
                    activeMenuId: null,
                    catalog: { name: 'Details' }
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
                activeCatalogId: 'catalog-1',
                selectedCatalogId: 'catalog-1',
                onSelectCatalog: vi.fn(),
                activeMenu: null,
                dashboardMenuItems: [],
                menuSlot: undefined,
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

function renderRuntimePageAt(route: string) {
    return render(
        <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
                <Route path='/applications/:applicationId/runtime' element={<ApplicationRuntime />} />
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
                <Route path='/applications/:applicationId/runtime' element={<ApplicationRuntime />} />
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

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('renders the workspace limit banner inside dashboard details area', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                catalog: { name: 'Details' },
                workspaceLimit: {
                    canCreate: false,
                    currentRows: 2,
                    maxRows: 2
                }
            }
        }

        renderRuntimePage()

        expect(screen.getByTestId('apps-dashboard-banner')).toHaveTextContent(
            'The workspace limit for this catalog has been reached (2 / 2).'
        )
    })

    it('hides the create action when the catalog runtime config disables it', () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                catalog: {
                    name: 'Details',
                    runtimeConfig: { showCreateButton: false }
                }
            }
        }

        renderRuntimePage()

        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    })

    it('switches CrudDialogs to page surface when createSurface is configured as page', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                catalog: {
                    name: 'Details',
                    runtimeConfig: { createSurface: 'page' }
                }
            }
        }

        renderRuntimePage()

        expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })
        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('derives page surface from URL search params on direct navigation', async () => {
        renderRuntimePageAt('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })
        expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
    })

    it('does not reopen an already-consumed create page surface after the form closes', async () => {
        const pageSurfaceAppData = {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            catalog: {
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
            <MemoryRouter initialEntries={['/applications/app-1/runtime?surface=page&mode=create']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path='/applications/:applicationId/runtime' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        runtimeMocks.handleOpenCreate.mockClear()
        runtimeMocks.dashboardStateOverrides = {
            appData: pageSurfaceAppData,
            formOpen: false
        }

        view.rerender(
            <MemoryRouter initialEntries={['/applications/app-1/runtime?surface=page&mode=create']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                    <Route path='/applications/:applicationId/runtime' element={<ApplicationRuntime />} />
                </Routes>
            </MemoryRouter>
        )

        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
    })

    it('blocks direct create page navigation when the catalog hides the create action', async () => {
        runtimeMocks.dashboardStateOverrides = {
            appData: {
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null,
                catalog: {
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

    it('clears page surface state when the active catalog changes', async () => {
        const catalogOneData = {
            zoneWidgets: { left: [], right: [], center: [] },
            menus: [],
            activeMenuId: null,
            catalog: {
                name: 'Catalog One',
                runtimeConfig: { createSurface: 'page' }
            }
        }

        runtimeMocks.dashboardStateOverrides = {
            appData: catalogOneData,
            formOpen: false,
            activeCatalogId: 'catalog-1',
            selectedCatalogId: 'catalog-1'
        }

        renderRuntimeHarness('/applications/app-1/runtime?surface=page&mode=create')

        await waitFor(() => {
            expect(runtimeMocks.handleOpenCreate).toHaveBeenCalledTimes(1)
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('page')
        })

        runtimeMocks.handleOpenCreate.mockClear()

        runtimeMocks.dashboardStateOverrides = {
            appData: {
                ...catalogOneData,
                catalog: {
                    name: 'Catalog Two',
                    runtimeConfig: { createSurface: 'page' }
                }
            },
            formOpen: true,
            activeCatalogId: 'catalog-2',
            selectedCatalogId: 'catalog-2'
        }

        act(() => {
            runtimeMocks.triggerRerender?.()
        })

        await waitFor(() => {
            expect(runtimeMocks.handleCloseForm).toHaveBeenCalledTimes(1)
            expect(screen.getByTestId('crud-dialogs-surface')).toHaveTextContent('dialog')
        })
        expect(runtimeMocks.handleOpenCreate).not.toHaveBeenCalled()
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
            catalogId: 'catalog-1'
        })
    })
})
