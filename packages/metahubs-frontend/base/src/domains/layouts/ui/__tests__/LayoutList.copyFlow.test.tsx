import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

const createLayoutMutate = vi.fn()
const updateLayoutMutate = vi.fn()
const updateLayoutMutateAsync = vi.fn()
const mockUseMetahubDetails = vi.fn()
const mockToolbarControls = vi.fn()
const mockViewHeader = vi.fn()

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, defaultValue?: string) => defaultValue ?? key
    })
}))

vi.mock('../../../../hooks/useViewPreference', () => ({
    useViewPreference: () => ['card', vi.fn()]
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateLayout: () => ({ mutate: createLayoutMutate, mutateAsync: vi.fn(), isPending: false }),
    useUpdateLayout: () => ({ mutate: updateLayoutMutate, mutateAsync: updateLayoutMutateAsync, isPending: false }),
    useDeleteLayout: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyLayout: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

const mockUsePaginated = vi.fn()

const createVisibleDomRect = (): DOMRect =>
    ({
        x: 0,
        y: 0,
        width: 160,
        height: 40,
        top: 0,
        right: 160,
        bottom: 40,
        left: 0,
        toJSON: () => ({})
    } as DOMRect)

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    return {
        TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
        ItemCard: ({ data, headerAction }: { data: { name?: string }; headerAction?: ReactNode }) => (
            <div>
                <div>{data?.name}</div>
                {headerAction}
            </div>
        ),
        ToolbarControls: (props: { primaryAction?: { label: string; onClick: () => void } }) => {
            mockToolbarControls(props)
            return props.primaryAction ? <button onClick={props.primaryAction.onClick}>{props.primaryAction.label}</button> : null
        },
        ViewHeaderMUI: (props: { children: ReactNode; title?: string; controlsWrap?: boolean }) => {
            mockViewHeader(props)
            return (
                <div>
                    <h1>{props.title}</h1>
                    {props.children}
                </div>
            )
        },
        EmptyListState: () => <div>empty</div>,
        SkeletonGrid: () => <div>loading</div>,
        APIEmptySVG: 'svg',
        usePaginated: (...args: unknown[]) => mockUsePaginated(...args),
        useDebouncedSearch: () => ({ handleSearchChange: vi.fn() }),
        PaginationControls: () => null,
        FlowListTable: () => null,
        gridSpacing: 2,
        ConfirmDialog: () => null,
        useConfirm: () => ({ confirm: vi.fn(async () => true) }),
        LocalizedInlineField: () => null,
        notifyError: vi.fn(),
        useListDialogs: actual.useListDialogs
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    TemplateMainCard: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    ItemCard: ({ data, headerAction }: { data: { name?: string }; headerAction?: ReactNode }) => (
        <div>
            <div>{data?.name}</div>
            {headerAction}
        </div>
    ),
    ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) => (
        <button onClick={primaryAction?.onClick}>{primaryAction?.label ?? 'create'}</button>
    ),
    ViewHeaderMUI: ({ children, title }: { children: ReactNode; title?: string }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    ),
    EmptyListState: () => <div>empty</div>,
    SkeletonGrid: () => <div>loading</div>,
    APIEmptySVG: 'svg',
    usePaginated: (...args: unknown[]) => mockUsePaginated(...args),
    useDebouncedSearch: () => ({ handleSearchChange: vi.fn() }),
    PaginationControls: () => null,
    FlowListTable: () => null,
    gridSpacing: 2,
    notifyError: vi.fn(),
    EntityFormDialog: ({
        open,
        title,
        onSave,
        initialExtraValues
    }: {
        open: boolean
        title: string
        onSave?: (data: Record<string, unknown>) => Promise<void>
        initialExtraValues?: Record<string, unknown>
    }) => {
        if (!open) return null

        const values = {
            ...(initialExtraValues ?? {})
        }

        return (
            <div>
                <div>{title}</div>
                {title === 'Create layout' ? (
                    <button onClick={() => void onSave?.(values)} type='button'>
                        submit-layout-create
                    </button>
                ) : null}
                {title === 'Edit layout' ? (
                    <button onClick={() => void onSave?.(values)} type='button'>
                        submit-layout-edit
                    </button>
                ) : null}
            </div>
        )
    },
    ConfirmDeleteDialog: () => null,
    useConfirm: () => ({ confirm: vi.fn(async () => true) }),
    ConfirmDialog: () => null
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@mui/icons-material/MoreVertRounded', () => ({
    default: () => <span data-testid='layout-more-icon' />
}))

import LayoutList from '../LayoutList'

describe('LayoutList copy flow entry', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(createVisibleDomRect)
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true } }
        })
        mockUsePaginated.mockReturnValue({
            data: [
                {
                    id: 'layout-1',
                    templateKey: 'dashboard',
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Dashboard' } }
                    },
                    description: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Main layout' } }
                    },
                    config: {},
                    isActive: true,
                    isDefault: false,
                    sortOrder: 0,
                    version: 1,
                    createdAt: '2026-02-26T00:00:00.000Z',
                    updatedAt: '2026-02-26T00:00:00.000Z'
                }
            ],
            isLoading: false,
            error: null,
            pagination: { total: 1, limit: 20, offset: 0, count: 1, hasMore: false },
            actions: {
                setSearch: vi.fn(),
                goToPage: vi.fn()
            }
        })
    })

    it('enables adaptive embedded header controls for catalog layout lists', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/layout']}> 
                    <Routes>
                        <Route path='/metahub/:metahubId/catalog/:catalogId/layout' element={<LayoutList embedded />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(mockViewHeader).toHaveBeenCalled()
        })

        expect(mockViewHeader).toHaveBeenCalledWith(expect.objectContaining({ adaptiveSearch: true, title: undefined }))
        expect(mockToolbarControls).toHaveBeenCalledWith(
            expect.objectContaining({
                sx: expect.objectContaining({
                    height: 40,
                    minHeight: 40,
                    flexWrap: 'nowrap',
                    width: 'auto'
                })
            })
        )
    })

    it('keeps the standard header layout for embedded Common page lists', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/common']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/common' element={<LayoutList embedded />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(mockViewHeader).toHaveBeenCalled()
        })

        const headerProps = mockViewHeader.mock.calls.at(-1)?.[0]
        const toolbarProps = mockToolbarControls.mock.calls.at(-1)?.[0]

        expect(headerProps).toEqual(expect.objectContaining({ adaptiveSearch: false, title: undefined }))
        expect(toolbarProps?.sx).toBeUndefined()
    })

    it('opens copy dialog from layout row menu', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layouts']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layouts' element={<LayoutList />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        const menuButton = screen.getByTestId('layout-more-icon').closest('button')
        expect(menuButton).not.toBeNull()
        await user.click(menuButton as HTMLButtonElement)

        await user.click(await screen.findByText('Copy'))

        await waitFor(() => {
            expect(screen.getByText('Copying layout')).toBeInTheDocument()
        })
    })

    it('uses fire-and-forget mutate for edit instead of mutateAsync', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layouts']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layouts' element={<LayoutList />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        const menuButton = screen.getByTestId('layout-more-icon').closest('button')
        expect(menuButton).not.toBeNull()
        await user.click(menuButton as HTMLButtonElement)
        await user.click(await screen.findByText('Edit'))

        expect(screen.getByText('Edit layout')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'submit-layout-edit' }))

        await waitFor(() => {
            expect(updateLayoutMutate).toHaveBeenCalledTimes(1)
        })

        expect(updateLayoutMutateAsync).not.toHaveBeenCalled()
    })

    it('hides create and mutation menu actions when the user cannot manage the metahub', async () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } }
        })

        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layouts']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layouts' element={<LayoutList />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        expect(screen.queryByRole('button', { name: 'create' })).not.toBeInTheDocument()

        const menuButton = screen.getByTestId('layout-more-icon').closest('button')
        expect(menuButton).not.toBeNull()
        await user.click(menuButton as HTMLButtonElement)

        expect(await screen.findByText('Configure')).toBeInTheDocument()
        expect(screen.queryByText('Edit')).not.toBeInTheDocument()
        expect(screen.queryByText('Copy')).not.toBeInTheDocument()
        expect(screen.queryByText('Set as default')).not.toBeInTheDocument()
        expect(screen.queryByText('Activate')).not.toBeInTheDocument()
        expect(screen.queryByText('Deactivate')).not.toBeInTheDocument()
        expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('creates the first catalog layout without seeding legacy runtime behavior config from the catalog form', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/layout']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/catalog/:catalogId/layout' element={<LayoutList />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await user.click(screen.getByRole('button', { name: 'create' }))
        expect(screen.getByText('Create layout')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'submit-layout-create' }))

        await waitFor(() => {
            expect(createLayoutMutate).toHaveBeenCalledTimes(1)
        })

        const payload = createLayoutMutate.mock.calls[0]?.[0]
        expect(payload).toMatchObject({
            metahubId: 'metahub-1',
            data: {
                catalogId: 'catalog-1'
            }
        })
        expect(payload.data.config).toBeUndefined()
    })

    it('creates manual global layouts without pre-seeding dashboard config', async () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false }
            }
        })
        const user = userEvent.setup()

        render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={['/metahub/metahub-1/layouts']}>
                    <Routes>
                        <Route path='/metahub/:metahubId/layouts' element={<LayoutList />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>
        )

        await user.click(screen.getByRole('button', { name: 'create' }))
        expect(screen.getByText('Create layout')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'submit-layout-create' }))

        await waitFor(() => {
            expect(createLayoutMutate).toHaveBeenCalledTimes(1)
        })

        const payload = createLayoutMutate.mock.calls[0]?.[0]
        expect(payload).toMatchObject({
            metahubId: 'metahub-1'
        })
        expect(payload.data.catalogId).toBeUndefined()
        expect(payload.data.config).toBeUndefined()
    })
})
