import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalizedContent } from '@universo/utils'

import EntityInstanceList from '../EntityInstanceList'
import EntityInstanceListContent from '../EntityInstanceListContent'

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
const mockUsePaginated = vi.fn()
const mockUseQuery = vi.fn()
const mockUseQueries = vi.fn()
const mockCreateEntityInstance = vi.fn()
const mockUpdateEntityInstance = vi.fn()
const mockCopyEntityInstance = vi.fn()
const mockDeleteEntityInstance = vi.fn()
const mockRestoreEntityInstance = vi.fn()
const mockPermanentDeleteEntityInstance = vi.fn()
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
    onRowClick?: (row: MockListRow) => void
    customColumns?: Array<{ id: string; label: string }>
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

type MockActionDescriptor<TEntity> = {
    id: string
    labelKey: string
    visible?: (ctx: { entity: TEntity; entityKind: string; t: (key: string) => string }) => boolean
    enabled?: (ctx: { entity: TEntity; entityKind: string; t: (key: string) => string }) => boolean
    onSelect?: (ctx: { entity: TEntity; entityKind: string; t: (key: string) => string }) => void | Promise<void>
}

type BaseEntityMenuProps<TEntity> = {
    entity: TEntity
    entityKind: string
    descriptors: MockActionDescriptor<TEntity>[]
    createContext: (base: { entity: TEntity; entityKind: string; t: (key: string) => string }) => {
        entity: TEntity
        entityKind: string
        t: (key: string) => string
    }
}

type ViewHeaderProps = {
    title: string
    description?: string
    search?: boolean
    searchPlaceholder?: string
    searchValue?: string
    onSearchChange?: React.ChangeEventHandler<HTMLInputElement>
    children?: React.ReactNode
}

type MockDialogTab = {
    id: string
    label: string
    content?: React.ReactNode
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
    onSave?: (values: Record<string, unknown>) => Promise<void> | void
    canSave?: (values: Record<string, unknown>) => boolean
    validate?: (values: Record<string, unknown>) => Record<string, string> | null
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValueOrOptions?: string | { defaultValue?: string }) => {
            const mapped: Record<string, string> = {
                'metahubs:pages.title': 'Pages',
                'metahubs:pages.createDialog.title': 'Create Page',
                'metahubs:pages.editDialog.title': 'Edit Page',
                'metahubs:pages.copyTitle': 'Copy Page',
                'metahubs:pages.deleteDialog.title': 'Delete Page',
                'metahubs:ledgers.title': 'Ledgers',
                'ledgers.empty': 'No ledgers yet',
                'ledgers.searchPlaceholder': 'Search ledgers...',
                'ledgers.fieldDefinitions.emptyTitle': 'This ledger has no attributes yet',
                'ledgers.fieldDefinitions.emptyDescription':
                    'Create ledger dimensions, resources, or properties through the shared attribute list.',
                'hubs.title': 'Hubs',
                'catalogs.tabs.layout': 'Layouts',
                'pages.empty': 'No pages yet',
                'pages.emptyDescription': 'Create the first page to configure structured application content',
                'pages.searchPlaceholder': 'Search pages...',
                'entities.instances.tabs.fieldDefinitions': 'Attributes',
                'entities.instances.fieldDefinitions.emptyTitle': 'No attributes yet',
                'entities.instances.fieldDefinitions.emptyDescription':
                    'Create the first attribute to define the data shape for this entity.',
                'fieldDefinitions.searchPlaceholder': 'Search attributes...',
                'entities.instances.tabs.content': 'Content',
                'common:actions.more': 'More actions',
                'common:actions.copy': 'Copy',
                'common:actions.edit': 'Edit',
                'common:actions.delete': 'Delete',
                'common:actions.restore': 'Restore',
                'common:actions.deletePermanently': 'Delete permanently',
                'flowList:menu.button': 'More actions',
                'actions.more': 'More actions',
                'actions.copy': 'Copy',
                'actions.edit': 'Edit',
                'actions.delete': 'Delete',
                'actions.restore': 'Restore',
                'actions.deletePermanently': 'Delete permanently'
            }
            if (mapped[key]) return mapped[key]
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
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
    useQueries: (...args: unknown[]) => mockUseQueries(...args),
    useMutation: () => ({
        mutate: vi.fn(),
        mutateAsync: vi.fn(),
        isPending: false
    }),
    useQueryClient: () => ({ getQueryData: vi.fn() })
}))

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()
    const ReactModule = await import('react')

    return {
        ...actual,
        APIEmptySVG: 'api-empty',
        createCopyActionIcon: () => <span data-testid='copy-action-icon' />,
        createDeleteActionIcon: () => <span data-testid='delete-action-icon' />,
        createDeleteForeverActionIcon: () => <span data-testid='delete-forever-action-icon' />,
        createEditActionIcon: () => <span data-testid='edit-action-icon' />,
        createRestoreActionIcon: () => <span data-testid='restore-action-icon' />,
        EmptyListState: ({ title, description }: { title: string; description: string }) => (
            <div>
                <div>{title}</div>
                <div>{description}</div>
            </div>
        ),
        FlowListTable: ({ data, renderActions, onRowClick, customColumns }: FlowListTableProps) => (
            <div>
                {customColumns ? (
                    <div role='row'>
                        {customColumns.map((column) => (
                            <span role='columnheader' key={column.id}>
                                {column.label}
                            </span>
                        ))}
                    </div>
                ) : null}
                {data.map((row) => (
                    <div key={row.id}>
                        <button type='button' onClick={() => onRowClick?.({ ...row, raw: undefined })}>
                            {row.name}
                        </button>
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
        BaseEntityMenu: <TEntity,>({ entity, entityKind, descriptors, createContext }: BaseEntityMenuProps<TEntity>) => {
            const [open, setOpen] = ReactModule.useState(false)
            const t = (key: string) => {
                const mapped: Record<string, string> = {
                    'common:actions.copy': 'Copy',
                    'common:actions.edit': 'Edit',
                    'common:actions.delete': 'Delete',
                    'common:actions.restore': 'Restore',
                    'common:actions.deletePermanently': 'Delete permanently'
                }
                return mapped[key] ?? key
            }
            const ctx = createContext({ entity, entityKind, t })
            const visible = descriptors.filter((descriptor) => !descriptor.visible || descriptor.visible(ctx))

            return (
                <div>
                    <button type='button' aria-label='More actions' onClick={() => setOpen((current) => !current)}>
                        More actions
                    </button>
                    {open ? (
                        <div role='menu'>
                            {visible.map((descriptor) => (
                                <button
                                    key={descriptor.id}
                                    type='button'
                                    role='menuitem'
                                    disabled={descriptor.enabled ? !descriptor.enabled(ctx) : false}
                                    onClick={() => void descriptor.onSelect?.(ctx)}
                                >
                                    {t(descriptor.labelKey)}
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            )
        },
        PaginationControls: () => <div data-testid='pagination-controls' />,
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
        ViewHeaderMUI: ({ title, description, search, searchPlaceholder, searchValue, onSearchChange, children }: ViewHeaderProps) => (
            <div>
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
                {search ? (
                    <input aria-label='search' placeholder={searchPlaceholder} value={searchValue ?? ''} onChange={onSearchChange} />
                ) : null}
                {children}
            </div>
        ),
        gridSpacing: 2,
        useDebouncedSearch: () => ({ searchValue: '', handleSearchChange: vi.fn() }),
        usePaginated: (...args: unknown[]) => mockUsePaginated(...args),
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
    EntityFormDialog: ({ open, tabs, initialExtraValues, title, onSave, canSave, validate }: EntityFormDialogProps) => {
        if (!open) return null
        const values = initialExtraValues ?? {}
        const errors = validate?.(values) ?? {}
        const saveAllowed = canSave ? canSave(values) : true

        return (
            <div data-testid='entity-form-dialog'>
                <div>{title}</div>
                <pre data-testid='dialog-extra-values'>{JSON.stringify(values)}</pre>
                <pre data-testid='dialog-validation-errors'>{JSON.stringify(errors)}</pre>
                <div data-testid='dialog-description'>
                    {((initialExtraValues?.descriptionVlc as { locales?: { en?: { content?: string } } } | undefined)?.locales?.en
                        ?.content as string | undefined) ?? ''}
                </div>
                {tabs
                    ? tabs({ values, setValue: vi.fn(), isLoading: false, errors }).map((tab) => (
                          <div key={tab.id}>
                              <span>{tab.label}</span>
                              {tab.content}
                          </div>
                      ))
                    : null}
                <button type='button' disabled={!saveAllowed} onClick={() => onSave?.(values)}>
                    Save dialog
                </button>
            </div>
        )
    },
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
    FieldDefinitionListContent: ({ emptyTitle, emptyDescription }: { emptyTitle?: string; emptyDescription?: string }) => (
        <div>
            <div>FieldDefinitionListContent</div>
            {emptyTitle ? <div>{emptyTitle}</div> : null}
            {emptyDescription ? <div>{emptyDescription}</div> : null}
        </div>
    )
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
    useCreateEntityInstance: () => ({ mutateAsync: mockCreateEntityInstance, isPending: false }),
    useUpdateEntityInstance: () => ({ mutateAsync: mockUpdateEntityInstance, isPending: false }),
    useCopyEntityInstance: () => ({ mutateAsync: mockCopyEntityInstance, isPending: false }),
    useDeleteEntityInstance: () => ({ mutateAsync: mockDeleteEntityInstance, isPending: false }),
    useRestoreEntityInstance: () => ({ mutateAsync: mockRestoreEntityInstance, isPending: false }),
    usePermanentDeleteEntityInstance: () => ({ mutateAsync: mockPermanentDeleteEntityInstance, isPending: false })
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
        mockUsePaginated.mockReturnValue(mockPaginatedResult)
        mockUseQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isSuccess: false,
            isError: false,
            error: null
        })
        mockUseQueries.mockImplementation((options: { queries?: unknown[] }) =>
            (options.queries ?? []).map(() => ({
                data: undefined,
                isLoading: false,
                isSuccess: false,
                isError: false,
                error: null
            }))
        )

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
        expect(screen.getAllByText('Containers').length).toBeGreaterThan(0)
        expect(screen.queryByText('Attributes')).not.toBeInTheDocument()
        expect(screen.queryByText('Layouts')).not.toBeInTheDocument()
        expect(screen.queryByText('Scripts')).not.toBeInTheDocument()
        expect(screen.queryByText('Actions')).not.toBeInTheDocument()
        expect(screen.queryByText('Events')).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(screen.getByText('Attributes')).toBeInTheDocument()
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('Scripts')).toBeInTheDocument()
        expect(screen.getByText('Actions')).toBeInTheDocument()
        expect(screen.getByText('Events')).toBeInTheDocument()
    })

    it('exposes record behavior as a generic entity tab and persists normalized config on save', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-document',
                        kindKey: 'custom.document',
                        codename: makeVlc('CustomDocument'),
                        ui: {
                            iconName: 'IconFileInvoice',
                            tabs: ['general', 'behavior', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'Documents'
                        },
                        components: {
                            records: { enabled: true },
                            identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
                            recordLifecycle: { enabled: true, allowCustomStates: true },
                            posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
                            scripting: { enabled: true },
                            dataSchema: { enabled: true },
                            physicalTable: { enabled: true }
                        }
                    }
                ]
            },
            error: null,
            isLoading: false
        })
        const documentEntity = {
            id: 'document-1',
            kind: 'custom.document',
            codename: makeVlc('enrollment-document'),
            name: makeVlc('Enrollment Document'),
            description: makeVlc('Transactional document'),
            config: {
                recordBehavior: {
                    mode: 'transactional',
                    numbering: {
                        enabled: true,
                        prefix: 'ENR-',
                        minLength: 6,
                        scope: 'workspace',
                        periodicity: 'year'
                    },
                    effectiveDate: {
                        enabled: true,
                        fieldCodename: 'StartedAt',
                        defaultToNow: true
                    },
                    lifecycle: {
                        enabled: true,
                        stateFieldCodename: 'Status',
                        states: [{ codename: 'Draft', title: 'Draft', isInitial: true }]
                    },
                    posting: {
                        mode: 'manual',
                        targetLedgers: ['ProgressLedger'],
                        scriptCodename: 'EnrollmentPostingScript'
                    },
                    immutability: 'posted'
                },
                sortOrder: 1
            },
            sortOrder: 1,
            version: 2,
            updatedAt: '2026-04-09T12:00:00.000Z',
            _mhb_deleted: false
        }
        mockPaginatedResult.data = [documentEntity]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: documentEntity,
            isLoading: false
        })
        mockUpdateEntityInstance.mockResolvedValue(documentEntity)
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.document/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(screen.getByText('Behavior')).toBeInTheDocument()
        expect(screen.getAllByText('Record mode').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Posting').length).toBeGreaterThan(0)
        expect(screen.getAllByDisplayValue('ENR-').length).toBeGreaterThan(0)

        await user.click(screen.getByRole('button', { name: 'Save dialog' }))

        expect(mockUpdateEntityInstance).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                entityId: 'document-1',
                data: expect.objectContaining({
                    config: expect.objectContaining({
                        sortOrder: 1,
                        recordBehavior: expect.objectContaining({
                            mode: 'transactional',
                            numbering: expect.objectContaining({ enabled: true, prefix: 'ENR-', minLength: 6 }),
                            lifecycle: expect.objectContaining({
                                enabled: true,
                                states: [expect.objectContaining({ codename: 'Draft', isInitial: true })]
                            }),
                            posting: expect.objectContaining({
                                mode: 'manual',
                                targetLedgers: ['ProgressLedger'],
                                scriptCodename: 'EnrollmentPostingScript'
                            }),
                            immutability: 'posted'
                        })
                    })
                })
            })
        )
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

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(await screen.findByTestId('entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-description')).toHaveTextContent('Fresh shared description')
        expect(screen.getByText('Attributes')).toBeInTheDocument()
    })

    it('opens the dedicated content route for block-content entity kinds', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-page',
                        kindKey: 'custom.page',
                        codename: makeVlc('CustomPage'),
                        ui: {
                            iconName: 'IconFile',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Pages'
                        },
                        components: {
                            blockContent: { enabled: true }
                        }
                    }
                ]
            },
            error: null,
            isLoading: false
        })
        mockPaginatedResult.data = [
            {
                id: 'page-1',
                kind: 'custom.page',
                codename: makeVlc('learner-home'),
                name: makeVlc('Learner Home'),
                description: makeVlc('Page row'),
                config: {
                    blockContent: {
                        format: 'editorjs',
                        blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Intro text' } }]
                    }
                },
                version: 3,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: mockPaginatedResult.data[0],
            isLoading: false
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                    <Route
                        path='/metahub/:metahubId/entities/:kindKey/instance/:entityId/content'
                        element={<div>Content route opened</div>}
                    />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Learner Home' }))

        expect(screen.getByText('Content route opened')).toBeInTheDocument()
    })

    it('uses Ledger collection labels and opens the shared field-definition surface from list rows', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-ledger',
                        kindKey: 'ledger',
                        codename: makeVlc('Ledger'),
                        ui: {
                            iconName: 'IconDatabase',
                            tabs: ['general', 'hubs', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:ledgers.title',
                            resourceSurfaces: [
                                {
                                    key: 'fieldDefinitions',
                                    capability: 'dataSchema',
                                    routeSegment: 'field-definitions',
                                    fallbackTitle: 'Attributes'
                                }
                            ]
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
                id: 'ledger-1',
                kind: 'ledger',
                codename: makeVlc('ProgressLedger'),
                name: makeVlc('Progress Ledger'),
                description: makeVlc('Ledger row'),
                config: {},
                version: 1,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/ledger/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                    <Route
                        path='/metahub/:metahubId/entities/:kindKey/instance/:entityId/field-definitions'
                        element={<div>Ledger fields route opened</div>}
                    />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { name: 'Ledgers' })).toBeInTheDocument()
        expect(screen.getByLabelText('search')).toHaveAttribute('placeholder', 'Search ledgers...')

        await user.click(screen.getByRole('button', { name: 'Progress Ledger' }))

        expect(screen.getByText('Ledger fields route opened')).toBeInTheDocument()
    })

    it('renders Ledger field definitions through the shared localized attributes tab', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-ledger',
                        kindKey: 'ledger',
                        codename: makeVlc('Ledger'),
                        ui: {
                            iconName: 'IconDatabase',
                            tabs: ['general', 'hubs', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:ledgers.title',
                            resourceSurfaces: [
                                {
                                    key: 'fieldDefinitions',
                                    capability: 'dataSchema',
                                    routeSegment: 'field-definitions',
                                    fallbackTitle: 'Attributes'
                                }
                            ]
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
                id: 'ledger-1',
                kind: 'ledger',
                codename: makeVlc('ProgressLedger'),
                name: makeVlc('Progress Ledger'),
                description: makeVlc('Ledger row'),
                config: {},
                version: 1,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: mockPaginatedResult.data[0],
            isLoading: false
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/ledger/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(screen.getByText('Attributes')).toBeInTheDocument()
        expect(screen.queryByText('No fieldDefinitions')).not.toBeInTheDocument()
        expect(screen.queryByText('Create the first attribute to define the schema for this custom entity kind.')).not.toBeInTheDocument()
    })

    it('blocks Ledger schema saves when field roles reference invalid field definitions', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-ledger',
                        kindKey: 'ledger',
                        codename: makeVlc('Ledger'),
                        ui: {
                            iconName: 'IconDatabase',
                            tabs: ['general', 'ledgerSchema'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:ledgers.title'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            physicalTable: { enabled: true },
                            ledgerSchema: { enabled: true }
                        },
                        config: {}
                    }
                ]
            },
            error: null,
            isLoading: false
        })
        const ledgerEntity = {
            id: 'ledger-1',
            kind: 'ledger',
            codename: makeVlc('ProgressLedger'),
            name: makeVlc('Progress Ledger'),
            description: makeVlc('Ledger row'),
            config: {
                ledger: {
                    mode: 'balance',
                    mutationPolicy: 'appendOnly',
                    sourcePolicy: 'both',
                    fieldRoles: [{ fieldCodename: 'ProgressDelta', role: 'resource', aggregate: 'sum' }],
                    projections: [],
                    idempotency: { keyFields: [] }
                }
            },
            version: 1,
            updatedAt: '2026-04-09T12:00:00.000Z',
            _mhb_deleted: false
        }
        mockPaginatedResult.data = [ledgerEntity]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: ledgerEntity,
            isLoading: false
        })
        mockUseQuery.mockImplementation((options: { queryKey?: unknown[] }) => {
            const queryKey = options?.queryKey ?? []
            if (queryKey.includes('fieldDefinitions')) {
                return {
                    data: {
                        items: [
                            {
                                id: 'field-progress-delta',
                                codename: 'ProgressDelta',
                                dataType: 'STRING',
                                name: makeVlc('Progress Delta')
                            }
                        ]
                    },
                    isLoading: false,
                    isSuccess: true,
                    isError: false,
                    error: null
                }
            }

            return {
                data: undefined,
                isLoading: false,
                isSuccess: false,
                isError: false,
                error: null
            }
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/ledger/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(screen.getByText('Ledger schema')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-validation-errors')).toHaveTextContent('ledgerFieldRoles')
        expect(screen.getByRole('button', { name: 'Save dialog' })).toBeDisabled()
    })

    it('renders the standard Page collection without generic entity-owned copy or deleted filters', async () => {
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-page',
                        kindKey: 'page',
                        codename: makeVlc('Page'),
                        ui: {
                            iconName: 'IconFileText',
                            tabs: ['general', 'hubs', 'content', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:pages.title'
                        },
                        presentation: {
                            dialogTitles: {
                                create: makeVlc('Create Page'),
                                edit: makeVlc('Edit Page'),
                                copy: makeVlc('Copy Page'),
                                delete: makeVlc('Delete Page')
                            }
                        },
                        components: {
                            blockContent: { enabled: true },
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
        mockPaginatedResult.data = []
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument()
        expect(screen.getByText('No pages yet')).toBeInTheDocument()
        expect(screen.queryByText('No entity instances yet')).not.toBeInTheDocument()
        expect(screen.queryByText(/unified entity-owned route/i)).not.toBeInTheDocument()
        expect(screen.queryByText('Show deleted')).not.toBeInTheDocument()
        expect(mockUsePaginated).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))

        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(screen.getByTestId('entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByText('Create Page')).toBeInTheDocument()
        expect(screen.queryByText('Create Entity')).not.toBeInTheDocument()
        expect(screen.getByText('Hubs')).toBeInTheDocument()
        expect(screen.getByText('Layouts')).toBeInTheDocument()
        expect(screen.getByText('ContainerSelectionPanel')).toBeInTheDocument()
        expect(screen.queryByText('Content')).not.toBeInTheDocument()
        expect(screen.queryByText('Page content')).not.toBeInTheDocument()
    })

    it('uses stable localized standard Page labels and skeletons before async data settles', () => {
        mockEntityTypesQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: true
        })
        mockUsePaginated.mockReturnValue({
            ...mockPaginatedResult,
            data: [],
            isLoading: false
        })

        const { container, rerender } = render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'page' })).not.toBeInTheDocument()
        expect(container.querySelector('.MuiSkeleton-root') ?? screen.queryByTestId('skeleton-grid')).toBeTruthy()
        expect(screen.queryByText('No pages yet')).not.toBeInTheDocument()

        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-page',
                        kindKey: 'page',
                        codename: makeVlc('Page'),
                        ui: {
                            iconName: 'IconFileText',
                            tabs: ['general', 'hubs', 'content', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:pages.title'
                        },
                        components: {
                            blockContent: { enabled: true }
                        },
                        config: {}
                    }
                ]
            },
            error: null,
            isLoading: false
        })
        mockUsePaginated.mockReturnValue({
            ...mockPaginatedResult,
            data: [],
            isLoading: true
        })

        rerender(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByRole('heading', { name: 'Pages' })).toBeInTheDocument()
        expect(container.querySelector('.MuiSkeleton-root') ?? screen.queryByTestId('skeleton-grid')).toBeTruthy()
        expect(screen.queryByText('No pages yet')).not.toBeInTheDocument()
    })

    it('renders Page actions through the shared CRUD menu and labels tree assignments as Hubs', async () => {
        mockUseEntityPermissions.mockReturnValue({
            allowCopy: true,
            allowDelete: true,
            allowAttachExistingEntities: true,
            allowHubNesting: true,
            isLoading: false
        })
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-page',
                        kindKey: 'page',
                        codename: makeVlc('Page'),
                        ui: {
                            iconName: 'IconFileText',
                            tabs: ['general', 'hubs', 'content', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:pages.title'
                        },
                        components: {
                            blockContent: { enabled: true },
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
                id: 'page-1',
                kind: 'page',
                codename: makeVlc('learner-home'),
                name: makeVlc('Learner Home'),
                description: makeVlc('Page row'),
                config: {
                    blockContent: {
                        format: 'editorjs',
                        blocks: []
                    }
                },
                version: 1,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]
        mockPaginatedResult.pagination = {
            currentPage: 1,
            pageSize: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
            search: ''
        }
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: mockPaginatedResult.data[0],
            isLoading: false
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('Learner Home')).toBeInTheDocument()
        expect(mockUsePaginated).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Hubs' })).toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Containers' })).not.toBeInTheDocument()
        expect(screen.getByTestId('entity-instances-pagination')).toHaveStyle({ width: '100%' })

        await user.click(screen.getByRole('button', { name: 'More actions' }))

        const menuItems = screen.getAllByRole('menuitem').map((item) => item.textContent)
        expect(menuItems).toEqual(['Edit', 'Copy', 'Delete'])
        expect(screen.queryByRole('menuitem', { name: 'Open content' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Edit properties' })).not.toBeInTheDocument()
    })

    it('keeps Page block content out of the metadata properties form while preserving it in the update payload', async () => {
        const originalBlockContent = {
            format: 'editorjs',
            data: {
                time: 1,
                version: '2.31.0',
                blocks: [{ id: 'intro', type: 'paragraph', data: { text: 'Intro' } }]
            }
        }
        mockEntityTypesQuery.mockReturnValue({
            data: {
                items: [
                    {
                        id: 'type-page',
                        kindKey: 'page',
                        codename: makeVlc('Page'),
                        ui: {
                            iconName: 'IconFileText',
                            tabs: ['general', 'content', 'layout', 'scripts'],
                            sidebarSection: 'objects',
                            nameKey: 'metahubs:pages.title'
                        },
                        components: {
                            blockContent: { enabled: true },
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
                id: 'page-1',
                kind: 'page',
                codename: makeVlc('learner-home'),
                name: makeVlc('Learner Home'),
                description: makeVlc('Page row'),
                config: {
                    blockContent: originalBlockContent
                },
                version: 7,
                updatedAt: '2026-04-09T12:00:00.000Z',
                _mhb_deleted: false
            }
        ]
        mockEntityInstancesQuery.mockReturnValue({
            data: { items: mockPaginatedResult.data }
        })
        mockEntityInstanceDetailQuery.mockReturnValue({
            data: mockPaginatedResult.data[0],
            isLoading: false
        })
        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/page/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceListContent />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'More actions' }))
        await user.click(screen.getByRole('menuitem', { name: 'Edit' }))

        expect(screen.getByTestId('entity-form-dialog')).toBeInTheDocument()
        expect(screen.getByTestId('dialog-extra-values')).not.toHaveTextContent('blockContentText')

        await user.click(screen.getByRole('button', { name: 'Save dialog' }))

        expect(mockUpdateEntityInstance).toHaveBeenCalledWith({
            metahubId: 'metahub-1',
            entityId: 'page-1',
            data: expect.objectContaining({
                expectedVersion: 7,
                config: expect.objectContaining({
                    blockContent: originalBlockContent
                })
            })
        })
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
                            nameKey: 'metahubs:catalogs.title'
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
                            nameKey: 'metahubs:catalogs.title'
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

    it('shows restore and permanent delete actions for soft-deleted custom entities', async () => {
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

        const user = userEvent.setup()

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/custom.product/instances']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instances' element={<EntityInstanceList />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'More actions' }))

        expect(screen.getByRole('menuitem', { name: 'Restore' })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: 'Delete permanently' })).toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Copy' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
    })
})
