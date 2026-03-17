import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const navigateMock = vi.fn()
const invalidateQueriesMock = vi.fn()

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
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() })
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query')
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: invalidateQueriesMock,
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
                    data: { items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } },
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
        ToolbarControls: () => null,
        EmptyListState: () => null,
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
    DynamicEntityFormDialog: () => null,
    ConflictResolutionDialog: () => null,
    EntityFormDialog: ({ open, title }: { open: boolean; title: string }) => (open ? <div role='dialog'>{title}</div> : null)
}))

vi.mock('../hooks/mutations', () => ({
    useCreateElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMoveElement: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReorderElement: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../attributes', () => ({
    getCatalogById: vi.fn(async () => currentCatalog)
}))

vi.mock('../../attributes/api', () => ({
    listAttributes: vi.fn(async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } })),
    listAttributesDirect: vi.fn(async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }))
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

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateMock
    }
})

import ElementList from '../ElementList'

describe('ElementList settings continuity', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps Settings visible and routes the System tab to the dedicated system view', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/elements']}>
                <Routes>
                    <Route path='/metahub/:metahubId/catalog/:catalogId/elements' element={<ElementList />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(await screen.findByRole('tab', { name: /^(Settings|settings\.title)$/ }))
        expect(screen.getByRole('dialog')).toHaveTextContent('Edit Catalog')

        await user.click(screen.getByRole('tab', { name: 'System' }))
        expect(navigateMock).toHaveBeenCalledWith('/metahub/metahub-1/catalog/catalog-1/system')
    })
})
