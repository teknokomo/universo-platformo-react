import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const createElementMutateAsyncMock = vi.fn()
const enqueueSnackbarMock = vi.fn()

const currentCatalog = {
    id: 'catalog-1',
    metahubId: 'metahub-1',
    codename: 'products',
    name: null,
    description: null,
    isSingleHub: false,
    isRequiredHub: false,
    sortOrder: 0,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
    version: 1,
    hubs: []
}

const catalogAttributes = [
    {
        id: 'attr-1',
        codename: 'Name',
        name: null,
        dataType: 'STRING',
        sortOrder: 1,
        isRequired: true,
        validationRules: {
            maxLength: 100
        },
        targetEntityId: null,
        targetEntityKind: null,
        targetConstantId: null,
        uiConfig: {}
    }
]

vi.mock('react-i18next', async () => {
    const actual = await vi.importActual<typeof import('react-i18next')>('react-i18next')
    return {
        ...actual,
        useTranslation: () => ({
            t: (key: string, fallback?: string) => fallback ?? key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock })
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: vi.fn(),
            isMutating: () => 0
        }),
        useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
            if (Array.isArray(queryKey) && queryKey.includes('allCatalogs') && queryKey.includes('detail')) {
                return { data: currentCatalog, isLoading: false, error: null }
            }
            if (Array.isArray(queryKey) && queryKey.includes('hubs') && queryKey.includes('list')) {
                return {
                    data: { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } },
                    isLoading: false,
                    error: null
                }
            }
            if (Array.isArray(queryKey) && queryKey.includes('attributes') && queryKey.includes('list')) {
                return {
                    data: { items: catalogAttributes, pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false } },
                    isLoading: false,
                    error: null
                }
            }
            if (Array.isArray(queryKey) && queryKey.includes('childAttributesForElements')) {
                return { data: {}, isLoading: false, error: null }
            }
            return { data: undefined, isLoading: false, error: null }
        },
        useMutation: () => ({
            mutate: vi.fn(),
            mutateAsync: vi.fn(),
            isPending: false,
            isLoading: false,
            error: null
        })
    }
})

vi.mock('@universo/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo/template-mui')>('@universo/template-mui')
    return {
        ...actual,
        TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        ToolbarControls: ({ primaryAction }: { primaryAction?: { label?: string; onClick?: () => void; disabled?: boolean } }) => {
            React.useEffect(() => {
                primaryAction?.onClick?.()
            }, [primaryAction])

            return (
                <button type='button' onClick={primaryAction?.onClick}>
                    {primaryAction?.label ?? 'Create'}
                </button>
            )
        },
        EmptyListState: ({ title, description }: { title?: string; description?: string }) => (
            <div>
                <div>{title}</div>
                <div>{description}</div>
            </div>
        ),
        APIEmptySVG: () => null,
        usePaginated: () => ({
            data: [],
            isLoading: false,
            error: null,
            pagination: { totalItems: 0, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            actions: { setSearch: vi.fn(), goToPage: vi.fn() }
        }),
        useDebouncedSearch: () => ({ searchValue: '', handleSearchChange: vi.fn() }),
        PaginationControls: () => null,
        FlowListTable: () => <div data-testid='elements-table' />,
        useConfirm: () => ({ confirm: vi.fn() }),
        revealPendingEntityFeedback: vi.fn(),
        ViewHeaderMUI: ({ title, children }: { title: string; children?: React.ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        BaseEntityMenu: () => null
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    ConfirmDeleteDialog: () => null,
    ConflictResolutionDialog: () => null,
    EntityFormDialog: () => null,
    DynamicEntityFormDialog: ({
        open,
        title,
        error,
        onSubmit
    }: {
        open: boolean
        title: string
        error?: string | null
        onSubmit: (data: Record<string, unknown>) => Promise<void>
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                <div>{title}</div>
                {error ? <div>{error}</div> : null}
                <button type='button' onClick={() => void onSubmit({ Name: 'Lemonade' })}>
                    Submit dialog
                </button>
            </div>
        ) : null
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateElement: () => ({ mutateAsync: createElementMutateAsyncMock, isPending: false }),
    useUpdateElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMoveElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReorderElement: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../attributes', () => ({
    listAttributes: vi.fn(async () => ({
        items: catalogAttributes,
        pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
    })),
    listAttributesDirect: vi.fn(async () => ({
        items: catalogAttributes,
        pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
    }))
}))

vi.mock('../../catalogs', () => ({
    getCatalogById: vi.fn(async () => currentCatalog)
}))

vi.mock('../../constants/api', () => ({
    listAllConstants: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../enumerations/api', () => ({
    listEnumerationValues: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../shared', async () => {
    const actual = await vi.importActual<typeof import('../../shared')>('../../shared')
    return {
        ...actual,
        fetchAllPaginatedItems: vi.fn(async () => ({
            items: [],
            pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false }
        })),
        invalidateElementsQueries: {
            all: vi.fn(),
            detail: vi.fn()
        }
    }
})

vi.mock('../../../settings/hooks/useSettings', () => ({
    useSettingValue: () => true
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../ElementActions', () => ({
    __esModule: true,
    default: []
}))

vi.mock('../InlineTableEditor', () => ({
    __esModule: true,
    default: () => null
}))

vi.mock('../../catalogs/ui/CatalogActions', () => ({
    buildInitialValues: () => ({}),
    buildFormTabs: () => [],
    validateCatalogForm: () => null,
    canSaveCatalogForm: () => true,
    toPayload: (value: unknown) => value
}))

vi.mock('../../catalogs/hooks/mutations', () => ({
    useUpdateCatalogAtMetahub: () => ({ mutate: vi.fn(), isPending: false })
}))

vi.mock('../../hubs', () => ({
    listHubs: vi.fn(async () => ({ items: [] }))
}))

vi.mock('@universo/utils', async () => {
    const actual = await vi.importActual<typeof import('@universo/utils')>('@universo/utils')
    return {
        ...actual,
        isOptimisticLockConflict: () => false,
        extractConflictInfo: () => null
    }
})

import ElementList from '../ElementList'

describe('ElementList create error flow', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps the create dialog open and surfaces the API message when creation fails', async () => {
        const user = userEvent.setup()
        createElementMutateAsyncMock.mockRejectedValueOnce(new Error('Validation failed: child localized content is invalid'))

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/elements']}>
                <Routes>
                    <Route path='/metahub/:metahubId/catalog/:catalogId/elements' element={<ElementList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(await screen.findByRole('dialog', { name: 'Add Element' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Submit dialog' }))

        await waitFor(() => {
            expect(createElementMutateAsyncMock).toHaveBeenCalledTimes(1)
            expect(screen.getByRole('dialog', { name: 'Add Element' })).toBeInTheDocument()
            expect(screen.getByText('Validation failed: child localized content is invalid')).toBeInTheDocument()
        })
    })
})
