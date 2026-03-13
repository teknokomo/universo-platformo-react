import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationRuntime from '../ApplicationRuntime'

const runtimeMocks = vi.hoisted(() => ({
    capturedCellRenderers: null as any,
    mutate: vi.fn(),
    handlePendingInteractionAttempt: vi.fn(() => false),
    handleOpenCreate: vi.fn(),
    setPaginationModel: vi.fn(),
    dashboardStateOverrides: {} as Record<string, unknown>
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
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
        AppsDashboard: ({ details }: { details?: { title?: string; actions?: ReactNode } }) => (
            <div data-testid='apps-dashboard'>
                <div data-testid='apps-dashboard-title'>{details?.title}</div>
                <div data-testid='apps-dashboard-actions'>{details?.actions}</div>
            </div>
        ),
        CrudDialogs: () => null,
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
                handleCloseForm: vi.fn(),
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
    return render(
        <MemoryRouter initialEntries={['/applications/app-1/runtime']}>
            <Routes>
                <Route path='/applications/:applicationId/runtime' element={<ApplicationRuntime />} />
            </Routes>
        </MemoryRouter>
    )
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
        runtimeMocks.dashboardStateOverrides = {}
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
