import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const createBranchMutate = vi.fn()
const invalidateBranchesAll = vi.fn(async () => undefined)

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useParams: () => ({ metahubId: 'metahub-1' })
    }
})

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({
        enqueueSnackbar: vi.fn()
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn()
    }),
    useQuery: () => ({
        data: {
            items: [
                {
                    id: 'source-branch-1',
                    codename: 'main',
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main' } } },
                    isDefault: true
                }
            ]
        }
    })
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateBranch: () => ({ mutate: createBranchMutate, mutateAsync: vi.fn(), isPending: false }),
    useCopyBranch: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateBranch: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteBranch: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useActivateBranch: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSetDefaultBranch: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../../../hooks/useViewPreference', () => ({
    useViewPreference: () => ['card', vi.fn()]
}))

vi.mock('../../shared', () => ({
    metahubsQueryKeys: {
        branchesList: () => ['branches']
    },
    invalidateBranchesQueries: {
        all: invalidateBranchesAll
    }
}))

const templateMuiMock = {
    TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ItemCard: () => null,
    ToolbarControls: ({ primaryAction }: { primaryAction: { onClick: () => void } }) => (
        <button onClick={primaryAction.onClick} type='button'>
            open-create-dialog
        </button>
    ),
    EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
    SkeletonGrid: () => null,
    APIEmptySVG: 'empty.svg',
    usePaginated: () => ({
        data: [],
        isLoading: false,
        error: null,
        pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false },
        actions: { setSearch: vi.fn(), goToPage: vi.fn() }
    }),
    useDebouncedSearch: () => ({
        handleSearchChange: vi.fn()
    }),
    PaginationControls: () => null,
    FlowListTable: () => null,
    gridSpacing: 2,
    LocalizedInlineField: () => null,
    useCodenameAutoFill: () => undefined,
    ViewHeaderMUI: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    BaseEntityMenu: () => null
}

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/template-mui')>('@universo/template-mui')
    return {
        ...templateMuiMock,
        useListDialogs: actual.useListDialogs
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    ...templateMuiMock,
    EntityFormDialog: ({
        open,
        tabs,
        onSave,
        error
    }: {
        open: boolean
        tabs: (args: {
            values: Record<string, unknown>
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors: Record<string, string>
        }) => Array<{ id: string }>
        onSave: (data: Record<string, unknown>) => Promise<void>
        error?: string
    }) => {
        if (!open) return null

        const values = {
            nameVlc: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Branch Copy' } } },
            descriptionVlc: null,
            codename: 'branch-copy',
            sourceBranchId: 'source-branch-1',
            fullCopy: false,
            copyLayouts: true,
            copyTreeEntities: true,
            copyLinkedCollections: false,
            copyValueGroups: true,
            copyOptionLists: true
        }
        const tabDefs = tabs({
            values,
            setValue: () => undefined,
            isLoading: false,
            errors: {}
        })
        const hasOptionsTab = tabDefs.some((tab) => tab.id === 'options')

        return (
            <div>
                <div data-testid='create-options-tab'>{String(hasOptionsTab)}</div>
                <div data-testid='dialog-error'>{error ?? ''}</div>
                <button onClick={() => void onSave(values)} type='button'>
                    submit-create-branch
                </button>
            </div>
        )
    },
    ConflictResolutionDialog: () => null
}))

vi.mock('../../../../components', () => ({
    CodenameField: () => null,
    BranchDeleteDialog: () => null,
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

describe('BranchList create flow copy options', () => {
    beforeEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('forwards branch copy options from create dialog payload', { timeout: 60_000 }, async () => {
        const mod = await import('../BranchList')
        const BranchList = mod.default

        render(<BranchList />)

        fireEvent.click(screen.getByRole('button', { name: 'open-create-dialog' }))
        expect(screen.getByTestId('create-options-tab')).toHaveTextContent('true')

        fireEvent.click(screen.getByRole('button', { name: 'submit-create-branch' }))

        await waitFor(() => {
            expect(createBranchMutate).toHaveBeenCalledWith(
                expect.objectContaining({
                    metahubId: 'metahub-1',
                    data: expect.objectContaining({
                        sourceBranchId: 'source-branch-1',
                        fullCopy: false,
                        copyLayouts: true,
                        copyTreeEntities: true,
                        copyLinkedCollections: false,
                        copyValueGroups: true,
                        copyOptionLists: true
                    })
                })
            )
        })
    })

    it('uses the fire-and-forget mutate handler instead of mutateAsync', { timeout: 60_000 }, async () => {
        const mod = await import('../BranchList')
        const BranchList = mod.default

        render(<BranchList />)

        fireEvent.click(screen.getByRole('button', { name: 'open-create-dialog' }))
        fireEvent.click(screen.getByRole('button', { name: 'submit-create-branch' }))

        await waitFor(() => {
            expect(createBranchMutate).toHaveBeenCalledTimes(1)
        })
    })
})
