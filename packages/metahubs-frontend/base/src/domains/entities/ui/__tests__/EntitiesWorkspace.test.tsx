import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigateSpy = vi.fn()
const mockEntityTypesQuery = vi.fn()
const mockUseMetahubDetails = vi.fn()
const templateMainCardMock = vi.fn()

type MockListRow = {
    id: string
    name: string
    kindKey?: string
    raw?: {
        id?: string | null
    }
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
}

type ToolbarControlsProps = {
    primaryAction?: {
        onClick: () => void
        label: string
    }
}

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValueOrOptions?: string | { defaultValue?: string; ns?: string }) => {
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

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
    return {
        ...actual,
        useNavigate: () => navigateSpy
    }
})

vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>()

    return {
        ...actual,
        useQueryClient: () => ({ getQueryData: vi.fn() }),
        useQuery: () => ({
            data: {
                settings: [{ key: 'general.language', value: { _value: 'en' } }]
            },
            isLoading: false,
            error: null
        }),
        useMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
    }
})

vi.mock('@universo/template-mui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo/template-mui')>()

    const resolveMenuLabel = (labelKey: string) => {
        if (labelKey === 'entities.actions.instances') return 'Instances'
        if (labelKey === 'common:actions.edit') return 'Edit'
        if (labelKey === 'common:actions.copy') return 'Copy'
        if (labelKey === 'common:actions.delete') return 'Delete'
        return labelKey
    }

    return {
        ...actual,
        APIEmptySVG: 'api-empty',
        BaseEntityMenu: ({ entity, entityKind, descriptors }: Record<string, any>) => {
            const [open, setOpen] = React.useState(false)
            const resolvedEntityId = entity?.raw?.id ?? entity?.id ?? 'missing-id'
            const ctx = {
                entity,
                entityKind,
                t: (key: string) => resolveMenuLabel(key)
            }

            return (
                <div>
                    <button
                        type='button'
                        aria-label='Menu'
                        data-testid={`entity-menu-trigger-${entityKind}-${resolvedEntityId}`}
                        onClick={() => setOpen((value) => !value)}
                    >
                        Menu
                    </button>
                    {open
                        ? descriptors.map((descriptor: Record<string, any>) => (
                              <button
                                  key={descriptor.id}
                                  type='button'
                                  data-testid={`entity-menu-item-${entityKind}-${descriptor.id}-${resolvedEntityId}`}
                                  onClick={() => descriptor.onSelect?.(ctx)}
                              >
                                  {resolveMenuLabel(descriptor.labelKey)}
                              </button>
                          ))
                        : null}
                </div>
            )
        },
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
                        {renderActions ? renderActions({ id: row.id, name: row.name, kindKey: row.kindKey }) : null}
                    </div>
                ))}
            </div>
        ),
        ItemCard: ({ data, headerAction }: ItemCardProps) => (
            <div>
                <span>{data.name}</span>
                {headerAction}
            </div>
        ),
        SkeletonGrid: () => <div data-testid='skeleton-grid' />,
        TemplateMainCard: ({ children, ...props }: { children: React.ReactNode } & Record<string, unknown>) => {
            templateMainCardMock(props)
            return <div>{children}</div>
        },
        ToolbarControls: ({ primaryAction }: ToolbarControlsProps) =>
            primaryAction ? (
                <button type='button' onClick={primaryAction.onClick}>
                    {primaryAction.label}
                </button>
            ) : null,
        ViewHeaderMUI: ({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) => (
            <div>
                <h1>{title}</h1>
                <p>{description}</p>
                {children}
            </div>
        ),
        gridSpacing: 2
    }
})

vi.mock('@universo/template-mui/components/dialogs', async () => {
    const React = await vi.importActual<typeof import('react')>('react')

    return {
        EntityFormDialog: ({
            open,
            title,
            tabs,
            initialExtraValues
        }: {
            open: boolean
            title: string
            tabs?: (helpers: {
                values: Record<string, unknown>
                setValue: (name: string, value: unknown) => void
                isLoading: boolean
                errors: Record<string, string>
            }) => Array<{ id: string; label: string; content: React.ReactNode }>
            initialExtraValues?: Record<string, unknown>
        }) => {
            const [values, setValues] = React.useState<Record<string, unknown>>(initialExtraValues ?? {})

            React.useEffect(() => {
                if (open) {
                    setValues(initialExtraValues ?? {})
                }
            }, [initialExtraValues, open])

            if (!open) return null

            const renderedTabs = tabs
                ? tabs({
                      values,
                      setValue: (name, value) => setValues((prev) => ({ ...prev, [name]: value })),
                      isLoading: false,
                      errors: {}
                  })
                : []

            return (
                <div role='dialog' aria-label={title}>
                    <div data-testid='entity-dialog-kind-key'>{String(values.kindKey ?? '')}</div>
                    <div data-testid='entity-dialog-name'>{String((values.nameVlc as any)?.locales?.en?.content ?? '')}</div>
                    {renderedTabs.map((tab) => (
                        <section key={tab.id} aria-label={tab.label}>
                            {tab.content}
                        </section>
                    ))}
                </div>
            )
        },
        ConfirmDeleteDialog: () => null,
        ConflictResolutionDialog: () => null
    }
})

vi.mock('../../../../components', () => ({
    ExistingCodenamesProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('../../../../hooks/useViewPreference', () => ({
    useViewPreference: () => ['list', vi.fn()]
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

vi.mock('../../../metahubs/hooks', () => ({
    useMetahubDetails: (...args: unknown[]) => mockUseMetahubDetails(...args)
}))

vi.mock('../../../shared/ui/GeneralTabFields', () => ({
    default: () => <div>GeneralTabFields</div>
}))

vi.mock('../EntityTypePresetSelector', () => ({
    EntityTypePresetSelector: () => <div>EntityTypePresetSelector</div>
}))

vi.mock('../../hooks', () => ({
    useEntityTypesQuery: (...args: unknown[]) => mockEntityTypesQuery(...args),
    useCreateEntityType: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useCopyEntityType: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdateEntityType: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteEntityType: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

describe('EntitiesWorkspace', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        templateMainCardMock.mockClear()

        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: true } },
            isLoading: false
        })

        mockEntityTypesQuery.mockImplementation(() => ({
            data: {
                items: [
                    {
                        id: 'type-0',
                        kindKey: 'hub',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'TreeEntity' } } },
                        ui: {
                            iconName: 'IconHierarchy',
                            tabs: ['general', 'treeEntities'],
                            sidebarSection: 'objects',
                            nameKey: 'Hubs',
                            descriptionKey: 'Manage treeEntities'
                        },
                        presentation: {
                            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Hubs' } } },
                            description: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Manage treeEntities' } } }
                        },
                        components: {
                            dataSchema: { enabled: true },
                            hierarchy: { enabled: true }
                        },
                        updatedAt: '2026-04-10T12:00:00.000Z'
                    },
                    {
                        id: 'type-2',
                        kindKey: 'custom.invoice',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'CustomInvoice' } } },
                        ui: {
                            iconName: 'IconFileText',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Invoices',
                            descriptionKey: 'Manage invoices'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            records: true,
                            treeAssignment: { enabled: true }
                        },
                        updatedAt: ''
                    },
                    {
                        id: 'type-1',
                        kindKey: 'custom.product',
                        codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'CustomProduct' } } },
                        ui: {
                            iconName: 'IconBox',
                            tabs: ['general'],
                            sidebarSection: 'objects',
                            nameKey: 'Products',
                            descriptionKey: 'Manage products'
                        },
                        components: {
                            dataSchema: { enabled: true },
                            treeAssignment: { enabled: true },
                            layoutConfig: { enabled: true },
                            scripting: { enabled: true }
                        },
                        updatedAt: '2026-04-09T12:00:00.000Z'
                    }
                ]
            },
            error: null,
            isLoading: false
        }))
    })

    it('opens the custom entity instances surface from the workspace action', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByTestId('entity-menu-trigger-entity-type-type-1'))
        await user.click(screen.getByTestId('entity-menu-item-entity-type-instances-type-1'))

        expect(navigateSpy).toHaveBeenCalledWith('/metahub/metahub-1/entities/custom.product/instances')
    })

    it('keeps direct standard entity types authorable from the shared workspace', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByTestId('entity-menu-trigger-entity-type-type-0'))
        await user.click(screen.getByTestId('entity-menu-item-entity-type-instances-type-0'))

        expect(navigateSpy).toHaveBeenCalledWith('/metahub/metahub-1/entities/hub/instances')
    })

    it('opens the populated edit dialog from the shared list-view menu', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByTestId('entity-menu-trigger-entity-type-type-1'))
        await user.click(screen.getByTestId('entity-menu-item-entity-type-edit-type-1'))

        expect(screen.getByRole('dialog', { name: 'Edit Entity Type' })).toBeInTheDocument()
        expect(screen.getByText('GeneralTabFields')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeChecked()
    })

    it('opens the copy dialog with duplicated defaults for a custom entity type', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByTestId('entity-menu-trigger-entity-type-type-1'))
        await user.click(screen.getByTestId('entity-menu-item-entity-type-copy-type-1'))

        expect(screen.getByRole('dialog', { name: 'Copy Entity Type' })).toBeInTheDocument()
        expect(screen.getByTestId('entity-dialog-kind-key')).toHaveTextContent('custom.product-copy')
        expect(screen.getByTestId('entity-dialog-name')).toHaveTextContent('Products (copy)')
        expect(screen.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeChecked()
    })

    it('keeps custom data-schema types authorable on the shared entities workspace', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByTestId('entity-menu-trigger-entity-type-type-2'))
        await user.click(screen.getByTestId('entity-menu-item-entity-type-instances-type-2'))

        expect(navigateSpy).toHaveBeenCalledWith('/metahub/metahub-1/entities/custom.invoice/instances')
    })

    it('hides entity authoring affordances for read-only metahub members', async () => {
        mockUseMetahubDetails.mockReturnValue({
            data: { permissions: { manageMetahub: false } },
            isLoading: false
        })

        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        expect(screen.getByText('Products')).toBeInTheDocument()
        expect(screen.getByText('Invoices')).toBeInTheDocument()
        expect(screen.getByText('You do not have permission to manage entity types for this metahub.')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
        expect(screen.queryByTestId('entity-menu-trigger-entity-type-type-1')).not.toBeInTheDocument()
        expect(mockEntityTypesQuery).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ limit: 1000, offset: 0, sortBy: 'codename', sortOrder: 'asc' })
        )
    })

    it('renders with the shared entity-metadata page shell contract', async () => {
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
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

    it('renders structured builder controls and prunes dependent components in create mode', async () => {
        const user = userEvent.setup()
        const { default: EntitiesWorkspace } = await import('../EntitiesWorkspace')

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities' element={<EntitiesWorkspace />} />
                </Routes>
            </MemoryRouter>
        )

        await user.click(screen.getByRole('button', { name: 'Create' }))

        expect(screen.getByRole('dialog', { name: 'Create Entity Type' })).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Hubs' })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Data schema' })).toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Physical table' })).toBeChecked()
        expect(screen.getByLabelText('Additional tabs')).toBeInTheDocument()

        await user.click(screen.getByRole('checkbox', { name: 'Actions' }))
        expect(screen.getByRole('checkbox', { name: 'Events' })).not.toBeChecked()

        await user.click(screen.getByRole('checkbox', { name: 'Data schema' }))
        expect(screen.getByRole('checkbox', { name: 'Predefined records' })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Hierarchy' })).not.toBeChecked()
        expect(screen.getByRole('checkbox', { name: 'Relations' })).not.toBeChecked()
    })
})
