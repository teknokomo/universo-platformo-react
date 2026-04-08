import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

type MockBaseEntity = {
    id?: string
}

type MockBaseContext = {
    entity: MockBaseEntity
    entityKind: string
    t: (key: string, fallback?: string) => string
}

type MockMenuDescriptor = {
    id: string
    entityKinds?: string[]
    visible?: (context: MockBaseContext) => boolean
}

const invalidateQueriesMock = vi.fn()
const usePaginatedMock = vi.fn()
const goToPageMock = vi.fn()

const currentCatalog = {
    id: 'catalog-1',
    metahubId: 'metahub-1',
    codename: 'products',
    name: null,
    description: null,
    hubs: []
}

const systemAttribute = {
    id: 'attr-system-1',
    catalogId: 'catalog-1',
    codename: '_upl_deleted',
    name: { version: 1, locales: { en: { content: 'Deleted flag' } } },
    description: null,
    dataType: 'BOOLEAN',
    validationRules: {},
    uiConfig: {},
    isRequired: false,
    isDisplayAttribute: false,
    sortOrder: 1,
    createdAt: '2026-03-16T00:00:00.000Z',
    updatedAt: '2026-03-16T00:00:00.000Z',
    system: {
        isSystem: true,
        systemKey: 'upl.deleted',
        isManaged: true,
        isEnabled: false
    }
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
    useSnackbar: () => ({
        enqueueSnackbar: vi.fn()
    })
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
                    data: {
                        items: [],
                        pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false }
                    },
                    isLoading: false,
                    error: null
                }
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
        ToolbarControls: ({ primaryAction }: { primaryAction?: { label: string; onClick: () => void } }) =>
            primaryAction ? <button onClick={primaryAction.onClick}>{primaryAction.label}</button> : null,
        EmptyListState: ({ title, description }: { title: string; description: string }) => (
            <div>
                <div>{title}</div>
                <div>{description}</div>
            </div>
        ),
        APIEmptySVG: () => null,
        usePaginated: (...args: unknown[]) => usePaginatedMock(...args),
        useDebouncedSearch: () => ({
            searchValue: '',
            handleSearchChange: vi.fn()
        }),
        PaginationControls: () => null,
        FlowListTable: ({
            data,
            customColumns,
            renderActions,
            getRowSx,
            isRowDragDisabled
        }: {
            data: Array<{ id: string; name?: string; codename?: string }>
            customColumns?: Array<{
                id: string
                render?: (row: { id: string; name?: string; codename?: string }, index: number) => React.ReactNode
            }>
            renderActions?: (row: { id: string; name?: string; codename?: string }) => React.ReactNode
            getRowSx?: (row: { id: string; name?: string; codename?: string }, index: number) => unknown
            isRowDragDisabled?: (row: { id: string; name?: string; codename?: string }, index: number) => boolean
        }) => (
            <div data-testid='flow-list-table'>
                {data.map((row, index) => (
                    <div key={row.id} data-testid={`row-${row.id}`}>
                        {customColumns && customColumns.length > 0 ? (
                            customColumns.map((column) => <div key={column.id}>{column.render?.(row, index)}</div>)
                        ) : (
                            <div>{row.name ?? row.codename}</div>
                        )}
                        {getRowSx?.(row, index) ? <div>row-styled</div> : null}
                        {isRowDragDisabled?.(row, index) ? <div>drag-disabled</div> : null}
                        {renderActions?.(row)}
                    </div>
                ))}
            </div>
        ),
        useConfirm: () => ({ confirm: vi.fn() }),
        revealPendingEntityFeedback: vi.fn(),
        ViewHeaderMUI: ({ title, children }: { title: string; children?: React.ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ),
        BaseEntityMenu: ({
            entity,
            entityKind,
            descriptors,
            createContext
        }: {
            entity: MockBaseEntity
            entityKind: string
            descriptors: MockMenuDescriptor[]
            createContext: (context: MockBaseContext) => MockBaseContext
        }) => {
            const context = createContext({ entity, entityKind, t: (key: string, fallback?: string) => fallback ?? key })
            const visible = descriptors.filter(
                (descriptor) =>
                    (!descriptor.entityKinds || descriptor.entityKinds.includes(entityKind)) &&
                    (!descriptor.visible || descriptor.visible(context))
            )

            if (visible.length === 0) return null

            return (
                <div data-testid='base-entity-menu' data-entity-id={entity.id}>
                    {visible.map((descriptor) => (
                        <span key={descriptor.id}>{descriptor.id}</span>
                    ))}
                </div>
            )
        }
    }
})

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: () => null,
    ConfirmDeleteDialog: () => null,
    ConflictResolutionDialog: () => null
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMoveAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReorderAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useToggleAttributeRequired: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSetDisplayAttribute: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useClearDisplayAttribute: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../api', () => ({
    listAttributes: vi.fn(),
    listAttributesDirect: vi.fn(),
    listAllAttributeCodenames: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../catalogs', () => ({
    getCatalogById: vi.fn(async () => currentCatalog)
}))

vi.mock('../../shared', async () => {
    const actual = await vi.importActual<typeof import('../../shared')>('../../shared')
    return {
        ...actual,
        fetchAllPaginatedItems: vi.fn(async () => ({
            items: [],
            pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false }
        })),
        useUpsertSharedEntityOverride: () => ({ mutateAsync: vi.fn(), isPending: false }),
        invalidateAttributesQueries: {
            all: vi.fn(),
            allCodenames: vi.fn()
        }
    }
})

vi.mock('../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('./AttributeActions', () => ({
    __esModule: true,
    default: [{ id: 'edit' }, { id: 'move-up' }, { id: 'move-down' }]
}))

vi.mock('./AttributeFormFields', () => ({
    __esModule: true,
    default: () => null,
    PresentationTabFields: () => null
}))

vi.mock('./ChildAttributeList', () => ({
    __esModule: true,
    default: () => null
}))

vi.mock('./dnd', () => ({
    AttributeDndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AttributeDndContainerRegistryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAttributeDndState: () => ({ activeContainerId: null, overContainerId: null, pendingTransfer: null, activeAttribute: undefined })
}))

vi.mock('../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({ style: 'kebab-case', alphabet: 'en-ru', allowMixed: false })
}))

vi.mock('../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../settings/hooks/useSettings', () => ({
    useSettingValue: (key: string) => {
        if (key === 'catalogs.attributeCodenameScope') return 'per-level'
        return null
    }
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

vi.mock('../../../utils/codename', () => ({
    normalizeCodenameForStyle: (value: string) => value,
    isValidCodenameForStyle: () => true
}))

vi.mock('../../../utils/localizedInput', () => ({
    extractLocalizedInput: () => null,
    hasPrimaryContent: () => true
}))

import AttributeList from '../AttributeList'

describe('AttributeList system tab', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        usePaginatedMock.mockReturnValue({
            data: [systemAttribute],
            isLoading: false,
            error: null,
            meta: {
                totalAll: 1,
                limit: 100,
                limitReached: false,
                childSearchMatchParentIds: [],
                platformSystemAttributesPolicy: {
                    allowConfiguration: true,
                    forceCreate: true,
                    ignoreMetahubSettings: true
                }
            },
            pagination: { totalItems: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            actions: { setSearch: vi.fn(), goToPage: goToPageMock }
        })
    })

    it('renders the dedicated system view without the create action', async () => {
        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/system']}>
                <Routes>
                    <Route path='/metahub/:metahubId/catalog/:catalogId/system' element={<AttributeList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(await screen.findByRole('heading', { name: 'System Attributes' })).toBeInTheDocument()
        expect(
            screen.getByText('System attributes are managed by the platform. You can only enable or disable supported attributes.')
        ).toBeInTheDocument()
        expect(screen.getByText('Deleted flag')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'System' })).toBeInTheDocument()
        expect(screen.getByText('enable-system-field')).toBeInTheDocument()
    })

    it('disables previous-query placeholder data for scoped attribute views', async () => {
        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/system']}>
                <Routes>
                    <Route path='/metahub/:metahubId/catalog/:catalogId/system' element={<AttributeList />} />
                </Routes>
            </MemoryRouter>
        )

        await screen.findByRole('heading', { name: 'System Attributes' })

        expect(usePaginatedMock).toHaveBeenCalled()
        expect(usePaginatedMock.mock.calls[0]?.[0]).toMatchObject({
            keepPreviousDataOnQueryKeyChange: false
        })
        expect(goToPageMock).toHaveBeenCalledWith(1)
    })

    it('renders shared rows as read-only and keeps local rows editable in merged views', async () => {
        usePaginatedMock.mockReturnValue({
            data: [
                {
                    id: 'attr-shared-1',
                    catalogId: 'catalog-1',
                    codename: 'shared_name',
                    name: { version: 1, locales: { en: { content: 'Shared Name' } } },
                    description: null,
                    dataType: 'STRING',
                    validationRules: {},
                    uiConfig: {},
                    isRequired: false,
                    isDisplayAttribute: false,
                    sortOrder: 1,
                    effectiveSortOrder: 1,
                    isShared: true,
                    isActive: false,
                    sharedBehavior: {
                        canDeactivate: true,
                        canExclude: true,
                        positionLocked: true
                    },
                    createdAt: '2026-03-16T00:00:00.000Z',
                    updatedAt: '2026-03-16T00:00:00.000Z'
                },
                {
                    id: 'attr-local-1',
                    catalogId: 'catalog-1',
                    codename: 'local_name',
                    name: { version: 1, locales: { en: { content: 'Local Name' } } },
                    description: null,
                    dataType: 'STRING',
                    validationRules: {},
                    uiConfig: {},
                    isRequired: false,
                    isDisplayAttribute: false,
                    sortOrder: 2,
                    createdAt: '2026-03-16T00:00:00.000Z',
                    updatedAt: '2026-03-16T00:00:00.000Z'
                }
            ],
            isLoading: false,
            error: null,
            meta: {
                totalAll: 2,
                limit: 100,
                limitReached: false,
                childSearchMatchParentIds: [],
                platformSystemAttributesPolicy: {
                    allowConfiguration: true,
                    forceCreate: true,
                    ignoreMetahubSettings: true
                }
            },
            pagination: { totalItems: 2, page: 1, limit: 20, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            actions: { setSearch: vi.fn(), goToPage: goToPageMock }
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/catalog/catalog-1/attributes']}>
                <Routes>
                    <Route path='/metahub/:metahubId/catalog/:catalogId/attributes' element={<AttributeList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(await screen.findByText('Shared Name')).toBeInTheDocument()
        expect(screen.getByText('Shared')).toBeInTheDocument()
        expect(screen.getByText('Inactive')).toBeInTheDocument()
        expect(screen.queryByText('Local')).not.toBeInTheDocument()

        const sharedRow = screen.getByTestId('row-attr-shared-1')
        const localRow = screen.getByTestId('row-attr-local-1')

        expect(sharedRow).toHaveTextContent('drag-disabled')
        expect(sharedRow).not.toHaveTextContent('edit')
        expect(sharedRow).toHaveTextContent('activate')
        expect(sharedRow).toHaveTextContent('exclude')

        expect(localRow).toHaveTextContent('row-styled')
        expect(localRow).toHaveTextContent('edit')
        expect(localRow).not.toHaveTextContent('move-up')
        expect(localRow).not.toHaveTextContent('move-down')
    })
})
