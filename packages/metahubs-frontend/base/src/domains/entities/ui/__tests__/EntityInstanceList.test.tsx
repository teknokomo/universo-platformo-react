import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalizedContent } from '@universo/utils'

import EntityInstanceList from '../EntityInstanceList'

const makeVlc = (content: string) => createLocalizedContent('en', content)

type MockDialogState = {
    create: { open: boolean }
    edit: { open: boolean; item: unknown | null }
    copy: { open: boolean; item: unknown | null }
    delete: { open: boolean; item: unknown | null }
    conflict: { open: boolean; data: unknown | null }
}

const mockPaginatedResult: {
    data: Array<Record<string, unknown>>
    pagination: {
        currentPage: number
        pageSize: number
        totalItems: number
        totalPages: number
        hasNextPage: boolean
        hasPreviousPage: boolean
        search: string
    }
    actions: {
        goToPage: ReturnType<typeof vi.fn>
        nextPage: ReturnType<typeof vi.fn>
        previousPage: ReturnType<typeof vi.fn>
        setSearch: ReturnType<typeof vi.fn>
        setSort: ReturnType<typeof vi.fn>
        setPageSize: ReturnType<typeof vi.fn>
    }
    isLoading: boolean
    isError: boolean
    error: null
} = {
    data: [],
    pagination: {
        currentPage: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        search: ''
    },
    actions: {
        goToPage: vi.fn(),
        nextPage: vi.fn(),
        previousPage: vi.fn(),
        setSearch: vi.fn(),
        setSort: vi.fn(),
        setPageSize: vi.fn()
    },
    isLoading: false,
    isError: false,
    error: null
}

const mockEntityTypesQuery = vi.fn()
const mockEntityInstancesQuery = vi.fn()
const mockEntityInstanceDetailQuery = vi.fn()
const mockUseMetahubHubs = vi.fn()
const mockUseMetahubDetails = vi.fn()
const mockUseEntityPermissions = vi.fn()
const templateMainCardMock = vi.fn()
const catalogEntityInstanceViewMock = vi.fn()
const hubEntityInstanceViewMock = vi.fn()
const setEntityInstanceViewMock = vi.fn()
const enumerationEntityInstanceViewMock = vi.fn()

type MockListRow = {
    id: string
    name: string
    isDeleted?: boolean
    raw?: unknown
}

type FlowListTableProps = {
    data: MockListRow[]
    renderActions?: (row: MockListRow) => React.ReactNode
}

type ItemCardProps = {
    data: {
        name: string
    }
    headerAction?: React.ReactNode
    onClick?: () => void
}

type ToolbarControlsProps = {
    primaryAction?: {
        onClick: () => void
        label: string
        disabled?: boolean
    }
    children?: React.ReactNode
}

type ViewHeaderProps = {
    title: string
    description: string
    children?: React.ReactNode
}

type MockDialogTab = {
    id: string
    label: string
}

type EntityFormDialogRenderProps = {
    values: Record<string, unknown>
    setValue: ReturnType<typeof vi.fn>
    isLoading: boolean
    errors: Record<string, string>
}

type EntityFormDialogProps = {
    open: boolean
    tabs?: (props: EntityFormDialogRenderProps) => MockDialogTab[]
    initialExtraValues?: Record<string, unknown>
    title?: string
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValueOrOptions?: string | { defaultValue?: string }) => {
            if (typeof defaultValueOrOptions === 'string') return defaultValueOrOptions
            if (typeof defaultValueOrOptions?.defaultValue === 'string') return defaultValueOrOptions.defaultValue
            return key
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/i18n', () => ({
    useCommonTranslations: () => ({
        t: (_key: string, defaultValue?: string) => defaultValue ?? _key
    })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ getQueryData: vi.fn() })
}))

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    const ReactModule = await import('react')

    return {
        ...actual,
        APIEmptySVG: 'api-empty',
        EmptyListState: ({ title, description }: { title: string; description: string }) => (
            <div>
                <div>{title}</div>
                <div>{description}</div>
            </div>
        ),
        FlowListTable: ({ data, renderActions }: FlowListTableProps) => (
            <div>
                {data.map((row) => (
                    <div key={row.id}>
                        <span>{row.name}</span>
                        {renderActions ? renderActions({ ...row, raw: undefined }) : null}
                    </div>
                ))}
            </div>
        ),
        ItemCard: ({ data, headerAction, onClick }: ItemCardProps) => (
            <div>
                <button type='button' onClick={onClick}>
                    {data.name}
                </button>
                {headerAction}
            </div>
        ),
        PaginationControls: () => null,
        SkeletonGrid: () => <div data-testid='skeleton-grid' />,
        TemplateMainCard: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
            templateMainCardMock(props)
            return <div>{children}</div>
        },
        ToolbarControls: ({ primaryAction, children }: ToolbarControlsProps) => (
            <div>
                {children}
                {primaryAction ? (
                    <button type='button' onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
                        {primaryAction.label}
                    </button>
                ) : null}
            </div>
        ),
        ViewHeaderMUI: ({ title, description, children }: ViewHeaderProps) => (
            <div>
                <h1>{title}</h1>
                <p>{description}</p>
                {children}
            </div>
        ),
        gridSpacing: 2,
        useDebouncedSearch: () => ({ searchValue: '', handleSearchChange: vi.fn() }),
        usePaginated: () => mockPaginatedResult,
        useListDialogs: () => {
            const [dialogs, setDialogs] = ReactModule.useState<MockDialogState>({
                create: { open: false },
                edit: { open: false, item: null },
                copy: { open: false, item: null },
                delete: { open: false, item: null },
                conflict: { open: false, data: null }
            })

            return {
                dialogs,
                openCreate: () => setDialogs((prev) => ({ ...prev, create: { open: true } })),
                openEdit: (item: unknown) => setDialogs((prev) => ({ ...prev, edit: { open: true, item } })),
                openCopy: (item: unknown) => setDialogs((prev) => ({ ...prev, copy: { open: true, item } })),
                openDelete: (item: unknown) => setDialogs((prev) => ({ ...prev, delete: { open: true, item } })),
                openConflict: (data: unknown) => setDialogs((prev) => ({ ...prev, conflict: { open: true, data } })),
                close: (dialog: 'create' | 'edit' | 'copy' | 'delete' | 'conflict') =>
                    setDialogs((prev) => ({
                        ...prev,
                        [dialog]: dialog === 'create' ? { open: false } : { open: false, item: null, data: null }
                    }))
            }
        }
    }
})

vi.mock('../api', () => ({
    listEntityInstances: vi.fn()
}))

vi.mock('@universo/template-mui/components/dialogs', () => ({
    EntityFormDialog: ({ open, tabs, initialExtraValues, title }: EntityFormDialogProps) =>
        open ? (
            <div data-testid='entity-form-dialog'>
                <div>{title}</div>
                <div data-testid='dialog-description'>
                    {((initialExtraValues?.descriptionVlc as { locales?: { en?: { content?: string } } } | undefined)?.locales?.en
                        ?.content as string | undefined) ?? ''}
                </div>
                {tabs
                    ? tabs({ values: initialExtraValues ?? {}, setValue: vi.fn(), isLoading: false, errors: {} }).map((tab) => (
                          <span key={tab.id}>{tab.label}</span>
                      ))
                    : null}
            </div>
        ) : null,
    ConfirmDeleteDialog: () => null,
    ConflictResolutionDialog: () => null
}))

vi.mock('../../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    ContainerSelectionPanel: () => <div>ContainerSelectionPanel</div>,
    LinkedCollectionDeleteDialog: ({ open }: { open: boolean }) =>
        open ? <div data-testid='catalog-delete-dialog'>LinkedCollectionDeleteDialog</div> : null
}))

vi.mock('../../../shared/ui/GeneralTabFields', () => ({
    default: () => <div>GeneralTabFields</div>
}))

vi.mock('../metadata/fieldDefinition/ui/FieldDefinitionList', () => ({
    FieldDefinitionListContent: () => <div>FieldDefinitionListContent</div>
}))

vi.mock('../../../layouts/ui/LayoutList', () => ({
    default: () => <div>LayoutList</div>
}))

vi.mock('../../../scripts/ui/EntityScriptsTab', () => ({
    createScriptsTab: () => ({
        id: 'scripts',
        label: 'Scripts',
        content: <div>EntityScriptsTab</div>
    })
}))

vi.mock('../BuiltinEntityCollectionPage', () => ({
    BuiltinEntityCollectionPage: ({ kindKey }: { kindKey?: string | null }) => {
        if (kindKey === 'catalog') {
            catalogEntityInstanceViewMock()
            return <div>BuiltinEntityCollectionPage:catalog</div>
        }

        if (kindKey === 'hub') {
            hubEntityInstanceViewMock()
            return <div>BuiltinEntityCollectionPage:hub</div>
        }

        if (kindKey === 'set') {
            setEntityInstanceViewMock()
            return <div>BuiltinEntityCollectionPage:set</div>
        }

        if (kindKey === 'enumeration') {
            enumerationEntityInstanceViewMock()
            return <div>BuiltinEntityCollectionPage:enumeration</div>
        }

        return <div>BuiltinEntityCollectionPage:unknown</div>
    }
}))

vi.mock('../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../../settings/hooks/useCodenameConfig', () => ({
    useCodenameConfig: () => ({
        style: 'pascal-case',
        alphabet: 'en-ru',
        allowMixed: false,
        autoConvertMixedAlphabets: true,
        autoReformat: true,
        requireReformat: true,
        localizedEnabled: true
    })
}))

vi.mock('../../../entities/presets/hooks/useTreeEntities', () => ({
    useTreeEntities: () => mockUseMetahubHubs()
}))

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../../../settings/hooks/useEntityPermissions', () => ({
    useEntityPermissions: (...args: unknown[]) => mockUseEntityPermissions(...args)
}))

vi.mock('../../hooks', () => ({
    useEntityTypesQuery: (...args: unknown[]) => mockEntityTypesQuery(...args),
    useEntityInstancesQuery: (...args: unknown[]) => mockEntityInstancesQuery(...args),
    useEntityInstanceQuery: (...args: unknown[]) => mockEntityInstanceDetailQuery(...args),
    useCreateEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useRestoreEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false }),
    usePermanentDeleteEntityInstance: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

describe('EntityInstanceList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        templateMainCardMock.mockClear()
        catalogEntityInstanceViewMock.mockClear()
        hubEntityInstanceViewMock.mockClear()
        setEntityInstanceViewMock.mockClear()
        enumerationEntityInstanceViewMock.mockClear()

        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true, editContent: true, deleteContent: true } },
            isLoading: false
        })

        mockUseEntityPermissions.mockReturnValue({
            allowCopy: true,
            allowDelete: true,
            allowAttachExistingEntities: true,
            allowHubNesting: true,
            isLoading: false
        })

        mockUseMetahubHubs.mockReturnValue([
            {
                id: 'hub-1',
                codename: 'hub-1',
                name: makeVlc('TreeEntity 1')
            }
        ])

        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-1',
                        kindKey: 'custom.product',
                        codename: makeVlc('CustomProduct'),
                        ui: {
                            iconName: 'IconBox',
                            tabs: ['general', 'treeEntities', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'Products'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            treeAssignment: { enabled: true },
                            layoutConfig: { enabled: true },
                            scripting: { enabled: true },
                            actions: { enabled: true },
                            events: { enabled: true }
                        }
                    }
                ]
            },
            error: null,
            isLoading: false
        })

        mockPaginatedResult.data = [
            {
                id: 'entity-1',
                kind: 'custom.product',
                codename: makeVlc('product-one'),
                name: makeVlc('Product One'),
                description: makeVlc('First entity'),
                config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                sortOrder: 1,
                version: 3,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]

        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })

        mockEntityInstanceDetailQuery.mockReturnValue({
            data: {
                id: 'entity-1',
                kind: 'custom.product',
                codename: makeVlc('product-one'),
                name: makeVlc('Product One'),
                description: makeVlc('Fresh shared description'),
                config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                sortOrder: 1,
                version: 4,
                updatedAt: '2026-04-09T12:05:00.000Z',
                _mhb_deleted: false
            },
            isLoading: false
        })
    })

    it('renders with the shared entity-metadata page shell contract', () => {
        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(templateMainCardMock).toHaveBeenCalledWith(
            expect.objectContaining({
                sx: { maxWidth: '100%', width: '100%' },
                contentSX: { px: 0, py: 0 },
                disableContentPadding: true,
                disableHeader: true,
                border: false,
                shadow: false
            })
        )
    })

    it('keeps create tabs minimal and exposes automation tabs only in edit mode for custom kinds', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.queryByText(/Scripts remain unavailable/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Create entity' }))

        expect(screen.getByText('General')).toBeInTheDocument()
        expect(screen.getByText('Containers')).toBeInTheDocument()
        expect(screen.queryByText('Attributes')).not.toBeInTheDocument()
        expect(screen.queryByText('Layouts')).not.toBeInTheDocument()
        expect(screen.queryByText('Scripts')).not.toBeInTheDocument()
        expect(screen.queryByText('Actions')).not.toBeInTheDocument()
        expect(screen.queryByText('Events')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Edit' }))

        expect(screen.getByText('Attributes')).toBeInTheDocument()
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('Scripts')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
        expect(screen.getByText('Events')).toBeInTheDocument()
    })

    it('hydrates the list-view edit dialog from the entity detail query when table rows omit raw payloads', async () => {
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Edit' }))

        expect(await screen.findByTestId('entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-description')).toHaveTextContent('Fresh shared description')
        expect(screen.getByText('Attributes')).toBeInTheDocument()
    })

    it('renders the linked-collection authoring surface on the entity route', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-1',
                        kindKey: 'catalog',
                        codename: makeVlc('LinkedCollectionEntity'),
                        ui: {
                            iconName: 'IconBox',
                            tabs: ['general', 'treeEntities', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:linkedCollections.title'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            scripting: { enabled: true }
                        },
                        config: {}
                    }
                ]
            },
            error: null,
            isLoading: false
        })

        mockPaginatedResult.data = [
            {
                id: 'catalog-1',
                kind: 'catalog',
                codename: makeVlc('catalog-one'),
                name: makeVlc('LinkedCollectionEntity One'),
                description: makeVlc('LinkedCollectionEntity row'),
                config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                sortOrder: 1,
                version: 3,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]

        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/catalog/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:catalog')).toBeInTheDocument()
        expect(catalogEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('renders the linked-collection surface immediately for the standard catalog route', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/catalog/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:catalog')).toBeInTheDocument()
        expect(catalogEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('renders the tree-entity surface immediately for the standard hub route', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/hub/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:hub')).toBeInTheDocument()
        expect(hubEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('renders the value-group surface immediately for the standard set route', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/set/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:set')).toBeInTheDocument()
        expect(setEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('renders the option-list surface immediately for the standard enumeration route', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/enumeration/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:enumeration')).toBeInTheDocument()
        expect(enumerationEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('keeps the linked-collection surface when existing settings limit copy and delete', () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false, editContent: true, deleteContent: false } },
            isLoading: false
        })
        mockUseEntityPermissions.mockReturnValue({
            allowCopy: true,
            allowDelete: false,
            allowAttachExistingEntities: true,
            allowHubNesting: true,
            isLoading: false
        })
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-1',
                        kindKey: 'catalog',
                        codename: makeVlc('LinkedCollectionEntity'),
                        ui: {
                            iconName: 'IconBox',
                            tabs: ['general', 'treeEntities', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:linkedCollections.title'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            treeAssignment: { enabled: true },
                            layoutConfig: { enabled: true },
                            scripting: { enabled: true }
                        },
                        config: {}
                    }
                ]
            },
            error: null,
            isLoading: false
        })

        mockPaginatedResult.data = [
            {
                id: 'catalog-1',
                kind: 'catalog',
                codename: makeVlc('catalog-one'),
                name: makeVlc('LinkedCollectionEntity One'),
                description: null,
                config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                sortOrder: 1,
                version: 3,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]

        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })

        mockEntityInstanceDetailQuery.mockImplementation((_metahubId?: string, entityId?: string) => ({
            data:
                entityId === 'catalog-1'
                    ? {
                          id: 'catalog-1',
                          kind: 'catalog',
                          codename: makeVlc('catalog-one'),
                          name: makeVlc('LinkedCollectionEntity One'),
                          description: makeVlc('Fresh shared description'),
                          config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 1 },
                          sortOrder: 1,
                          version: 4,
                          updatedAt: '2026-04-09T12:05:00.000Z',
                          _mhb_deleted: false
                      }
                    : undefined,
            isLoading: false
        }))

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/catalog/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('BuiltinEntityCollectionPage:catalog')).toBeInTheDocument()
        expect(catalogEntityInstanceViewMock).toHaveBeenCalledTimes(1)
    })

    it('keeps read-only visibility but hides entity instance authoring affordances without manageMetahub', () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false, editContent: false, deleteContent: false } },
            isLoading: false
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('Product One')).toBeInTheDocument()
        expect(screen.getByText('You do not have permission to manage entity instances for this metahub.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create entity' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
        expect(mockEntityTypesQuery).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ limit: 1000, offset: 0, sortBy: 'codename', sortOrder: 'asc' })
        )
    })

    it('shows restore and permanent delete actions for soft-deleted custom entities', () => {
        mockPaginatedResult.data = [
            {
                id: 'entity-deleted-1',
                kind: 'custom.product',
                codename: makeVlc('product-deleted'),
                name: makeVlc('Deleted Product'),
                description: makeVlc('Deleted entity'),
                config: { treeEntities: ['hub-1'], isSingleHub: false, isRequiredHub: false, sortOrder: 2 },
                sortOrder: 2,
                version: 4,
                updatedAt: '2026-04-09T13:00:00.000Z',
                _mhb_deleted: true
            }
        ]

        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })
})
