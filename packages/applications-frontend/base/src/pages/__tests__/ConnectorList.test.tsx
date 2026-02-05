import { vi } from 'vitest'

// Mock rehype/remark libraries to prevent jsdom 20.0.3 from loading
// rehype-mathjax 4.0.3 has jsdom 20.0.3 as a direct dependency
vi.mock('rehype-mathjax', () => ({ default: () => () => {} }))
vi.mock('rehype-raw', () => ({ default: () => () => {} }))
vi.mock('remark-gfm', () => ({ default: () => () => {} }))
vi.mock('remark-math', () => ({ default: () => () => {} }))

let mockUsePaginatedResult: any = null

const createConnectorMutateAsync = vi.fn(async () => ({}))
const updateConnectorMutateAsync = vi.fn(async () => ({}))
const deleteConnectorMutateAsync = vi.fn(async () => ({}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, arg2?: unknown) => {
                if (typeof arg2 === 'string') return arg2
                if (arg2 && typeof arg2 === 'object' && typeof (arg2 as any).defaultValue === 'string') return (arg2 as any).defaultValue
                return key
            },
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/i18n', async (importOriginal) => {
    const actual = await importOriginal<any>()
    return {
        ...actual,
        useCommonTranslations: () => ({
            t: (key: string, fallback?: string) => fallback ?? key
        })
    }
})

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<any>('@universo/template-mui')

    const t = (key: string, fallback?: string) => fallback ?? key

    return {
        ...actual,
        gridSpacing: 2,
        APIEmptySVG: 'svg',

        // NOTE: @universo/template-mui package.json exports maps "./components/dialogs" to dist/index,
        // so consumers importing "@universo/template-mui/components/dialogs" will still receive this mocked module.
        EntityFormDialog: (props: any) => {
            if (!props?.open) return null

            const baseValues = props.initialExtraValues ?? {}
            const errors = (typeof props.validate === 'function' ? props.validate(baseValues) : null) ?? {}

            return (
                <div data-testid='entity-form-dialog'>
                    <div data-testid='entity-form-title'>{props.title}</div>
                    <div data-testid='entity-form-errors'>{JSON.stringify(errors)}</div>
                    {typeof props.extraFields === 'function'
                        ? props.extraFields({
                              values: baseValues,
                              setValue: () => {},
                              isLoading: Boolean(props.loading),
                              errors: errors || {}
                          })
                        : null}
                    <button
                        type='button'
                        onClick={() =>
                            props.onSave?.({
                                ...baseValues,
                                codename: 'test-connector',
                                nameVlc: {
                                    _schema: 'v1',
                                    _primary: 'en',
                                    locales: { en: { content: 'Test Connector' } }
                                },
                                descriptionVlc: {
                                    _schema: 'v1',
                                    _primary: 'en',
                                    locales: { en: { content: 'Test Description' } }
                                },
                                publicationIds: ['publication-1']
                            })
                        }
                    >
                        {props.saveButtonText ?? 'Save'}
                    </button>
                    <button type='button' onClick={() => props.onClose?.()}>
                        {props.cancelButtonText ?? 'Cancel'}
                    </button>
                </div>
            )
        },

        TemplateMainCard: ({ children }: any) => <div data-testid='main-card'>{children}</div>,
        ItemCard: ({ data, headerAction }: any) => (
            <div data-testid={`item-${data?.id ?? 'unknown'}`}>
                <div>{data?.name}</div>
                {headerAction}
            </div>
        ),
        ViewHeaderMUI: ({ title, children }: any) => (
            <div>
                <div data-testid='view-header-title'>{title}</div>
                {children}
            </div>
        ),
        ToolbarControls: ({ primaryAction, onViewModeChange }: any) => (
            <div>
                <button type='button' onClick={() => primaryAction?.onClick?.()}>
                    {primaryAction?.label ?? 'add'}
                </button>
                <button type='button' onClick={() => onViewModeChange?.('table')}>
                    table
                </button>
            </div>
        ),
        EmptyListState: ({ title, description, action }: any) => (
            <div>
                <div data-testid='empty-title'>{title}</div>
                <div data-testid='empty-desc'>{description}</div>
                {action?.label ? (
                    <button type='button' onClick={() => action.onClick?.()}>
                        {action.label}
                    </button>
                ) : null}
            </div>
        ),
        SkeletonGrid: () => <div data-testid='skeleton-grid' />,
        PaginationControls: () => <div data-testid='pagination-controls' />,
        ConfirmDialog: () => null,

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
                </div>
            )
        },

        usePaginated: () => mockUsePaginatedResult,
        useDebouncedSearch: ({ onSearchChange }: any) => ({
            handleSearchChange: (value: any) => onSearchChange?.(value)
        }),
        useConfirm: () => ({ confirm: vi.fn(async () => true) }),

        LocalizedInlineField: ({ label }: any) => <div data-testid='localized-field'>{label}</div>,
        useCodenameAutoFill: () => undefined,
        CodenameField: ({ label }: any) => <div data-testid='codename-field'>{label}</div>,
        notifyError: vi.fn(() => undefined),

        BaseEntityMenu: (props: any) => {
            const ctx = props?.createContext?.({ entity: props.entity, t })
            const descriptors = Array.isArray(props?.descriptors) ? props.descriptors : []
            const edit = descriptors.find((d: any) => d?.id === 'edit')
            const del = descriptors.find((d: any) => d?.id === 'delete')

            return (
                <div data-testid='entity-menu'>
                    <button
                        type='button'
                        onClick={() => {
                            const dialogProps = edit?.dialog?.buildProps?.(ctx)
                            dialogProps?.validate?.(dialogProps?.initialExtraValues ?? {})
                            dialogProps?.extraFields?.({
                                values: dialogProps?.initialExtraValues ?? {},
                                setValue: () => {},
                                isLoading: false,
                                errors: dialogProps?.validate?.(dialogProps?.initialExtraValues ?? {}) ?? {}
                            })
                        }}
                    >
                        edit
                    </button>
                    <button type='button' onClick={async () => del?.onSelect?.(ctx)}>
                        delete
                    </button>
                </div>
            )
        }
    }
})

vi.mock('../../hooks/mutations', () => ({
    useCreateConnector: () => ({ mutateAsync: createConnectorMutateAsync, isPending: false }),
    useUpdateConnector: () => ({ mutateAsync: updateConnectorMutateAsync, isPending: false }),
    useDeleteConnector: () => ({ mutateAsync: deleteConnectorMutateAsync, isPending: false })
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SnackbarProvider } from 'notistack'

import ConnectorList from '../ConnectorList'

const createTestQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false, retryDelay: 0 },
            mutations: { retry: false }
        }
    })

const renderWithProviders = (route: string) => {
    const queryClient = createTestQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <SnackbarProvider>
                <MemoryRouter initialEntries={[route]}>
                    <Routes>
                        <Route path='/a/:applicationId/admin/connectors' element={<ConnectorList />} />
                        <Route path='/connectors' element={<ConnectorList />} />
                    </Routes>
                </MemoryRouter>
            </SnackbarProvider>
        </QueryClientProvider>
    )
}

beforeEach(() => {
    mockUsePaginatedResult = {
        data: [
            {
                id: 'conn-1',
                applicationId: 'app-1',
                codename: 'connector-one',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Connector One' } } },
                description: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Desc' } } },
                sortOrder: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ],
        isLoading: false,
        error: null,
        pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false },
        actions: {
            setSearch: vi.fn(),
            goToPage: vi.fn(),
            setLimit: vi.fn(),
            nextPage: vi.fn(),
            prevPage: vi.fn()
        }
    }
})

describe('ConnectorList page', () => {
    it('renders connectors and can open create + delete flows (smoke)', async () => {
        const user = userEvent.setup()
        renderWithProviders('/a/app-1/admin/connectors')

        expect(await screen.findByTestId('view-header-title')).toHaveTextContent('connectors.title')

        // Card view renders ItemCard
        expect(screen.getByTestId('item-conn-1')).toBeInTheDocument()

        // Trigger create dialog
        await user.click(screen.getByRole('button', { name: 'addNew' }))
        expect(await screen.findByTestId('entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('entity-form-title')).toHaveTextContent('Create Connector')

        // Execute create flow (covers ConnectorList.handleCreateConnector)
        await user.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => {
            expect(createConnectorMutateAsync).toHaveBeenCalled()
        })
        await waitFor(() => {
            expect(screen.queryByTestId('entity-form-dialog')).not.toBeInTheDocument()
        })

        // Switch to table view to exercise FlowListTable branch
        await user.click(screen.getByRole('button', { name: 'table' }))
        expect(await screen.findByTestId('flow-list-table')).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.queryByRole('dialog', { name: 'Create Connector' })).not.toBeInTheDocument()
        })

        // Trigger actions menu buttons (exercises ConnectorActions wiring + opens delete dialog)
        await user.click(screen.getByRole('button', { name: 'edit' }))
        await user.click(screen.getByRole('button', { name: 'delete' }))

        // Delete dialog should render once openDeleteDialog is called
        await waitFor(() => {
            expect(screen.getByText('connectors.deleteDialog.title')).toBeInTheDocument()
        })

        // Confirm delete (covers ConnectorDeleteDialog.handleConfirm + onConfirm)
        await user.click(screen.getByRole('button', { name: 'connectors.deleteDialog.confirm' }))
        await waitFor(() => {
            expect(deleteConnectorMutateAsync).toHaveBeenCalledWith({ applicationId: 'app-1', connectorId: 'conn-1' })
        })
    })

    it('shows invalid-application empty state when applicationId is missing', async () => {
        renderWithProviders('/connectors')

        expect(await screen.findByTestId('empty-title')).toHaveTextContent('applications:errors.invalidApplication')
    })

    it('shows connection error empty state when pagination hook returns error', async () => {
        mockUsePaginatedResult = {
            ...mockUsePaginatedResult,
            error: new Error('boom')
        }

        renderWithProviders('/a/app-1/admin/connectors')
        expect(await screen.findByTestId('empty-title')).toHaveTextContent('errors.connectionFailed')
    })
})
