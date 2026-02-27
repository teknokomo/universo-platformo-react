import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'

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
    useCreateLayout: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateLayout: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteLayout: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyLayout: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

const mockUsePaginated = vi.fn()

vi.mock('@universo/template-mui', () => ({
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
    ConfirmDialog: () => null,
    useConfirm: () => ({ confirm: vi.fn(async () => true) }),
    LocalizedInlineField: () => null,
    notifyError: vi.fn()
}))

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
    EntityFormDialog: ({ open, title }: { open: boolean; title: string }) => (open ? <div>{title}</div> : null),
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
})
