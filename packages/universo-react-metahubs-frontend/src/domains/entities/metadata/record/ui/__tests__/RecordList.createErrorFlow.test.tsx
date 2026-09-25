import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const createElementMutateAsyncMock = vi.fn()
const enqueueSnackbarMock = vi.fn()
const recordsFixture: Array<{
    id: string
    objectCollectionId: string
    data: Record<string, unknown>
    ownerId: string | null
    sortOrder: number
    createdAt: string
    updatedAt: string
}> = []

const currentObject = {
    id: 'object-1',
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
    treeEntities: []
}

const objectComponents = [
    {
        id: 'cmp-1',
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
    },
    {
        id: 'cmp-action',
        codename: 'PrimaryAction',
        name: 'Primary action',
        dataType: 'JSON',
        sortOrder: 2,
        isRequired: true,
        validationRules: { format: 'marketingAction' },
        targetEntityId: null,
        targetEntityKind: null,
        targetConstantId: null,
        uiConfig: {}
    }
]

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        i18n: { language: 'en' }
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
    initReactI18next: { type: '3rdParty', init: () => {} }
}))

vi.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({
        t: (key: string, options?: string | { defaultValue?: string; kind?: string; target?: string }) => {
            const translatedLabels: Record<string, string> = {
                'layouts.marketing.heroAuthoring.actionKinds.internal': 'Application page',
                'layouts.marketing.heroAuthoring.actionKinds.external': 'Website',
                'layouts.marketing.heroAuthoring.actionKinds.anchor': 'Page section',
                'layouts.marketing.heroAuthoring.actionKinds.email': 'Email',
                'layouts.marketing.heroAuthoring.actionKinds.tel': 'Phone'
            }
            const template = translatedLabels[key] ?? (typeof options === 'string' ? options : options?.defaultValue ?? key)
            return template
                .replace('{{kind}}', options && typeof options === 'object' ? options.kind ?? '' : '')
                .replace('{{target}}', options && typeof options === 'object' ? options.target ?? '' : '')
        }
    })
}))

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock })
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
        isMutating: () => 0
    }),
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
        if (Array.isArray(queryKey) && queryKey.includes('allObjectCollections') && queryKey.includes('detail')) {
            return { data: currentObject, isLoading: false, error: null }
        }
        if (Array.isArray(queryKey) && queryKey.includes('treeEntities') && queryKey.includes('list')) {
            return {
                data: { items: [], pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false } },
                isLoading: false,
                error: null
            }
        }
        if (Array.isArray(queryKey) && queryKey.includes('components') && queryKey.includes('list')) {
            return {
                data: { items: objectComponents, pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false } },
                isLoading: false,
                error: null
            }
        }
        if (Array.isArray(queryKey) && queryKey.includes('childComponentsForElements')) {
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
    }),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
    QueryClient: vi.fn()
}))

vi.mock('@universo-react/template-mui', () => {
    const React = require('react') as typeof import('react')

    function useListDialogs() {
        const [dialogs, dispatch] = React.useReducer(
            (state: Record<string, unknown>, action: { type: string; dialog?: string; item?: unknown; data?: unknown }) => {
                switch (action.type) {
                    case 'OPEN_CREATE':
                        return { ...state, create: { open: true } }
                    case 'OPEN':
                        return { ...state, [action.dialog!]: { open: true, item: action.item } }
                    case 'OPEN_CONFLICT':
                        return { ...state, conflict: { open: true, data: action.data } }
                    case 'CLOSE':
                        return { ...state, [action.dialog!]: { open: false, item: null, data: null } }
                    default:
                        return state
                }
            },
            {
                create: { open: false },
                edit: { open: false, item: null },
                copy: { open: false, item: null },
                delete: { open: false, item: null },
                conflict: { open: false, data: null }
            }
        )
        return {
            dialogs,
            openCreate: React.useCallback(() => dispatch({ type: 'OPEN_CREATE' }), []),
            openEdit: React.useCallback((item: unknown) => dispatch({ type: 'OPEN', dialog: 'edit', item }), []),
            openCopy: React.useCallback((item: unknown) => dispatch({ type: 'OPEN', dialog: 'copy', item }), []),
            openDelete: React.useCallback((item: unknown) => dispatch({ type: 'OPEN', dialog: 'delete', item }), []),
            openConflict: React.useCallback((data: unknown) => dispatch({ type: 'OPEN_CONFLICT', data }), []),
            close: React.useCallback((dialog: string) => dispatch({ type: 'CLOSE', dialog }), [])
        }
    }

    return {
        useListDialogs,
        createMemberActions: vi.fn(() => []),
        createEntityActions: vi.fn(() => []),
        createEditActionIcon: () => null,
        createCopyActionIcon: () => null,
        createDeleteActionIcon: () => null,
        TemplateMainCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        ToolbarControls: ({ primaryAction }: { primaryAction?: { label?: string; onClick?: () => void; disabled?: boolean } }) => (
            <button type='button' onClick={primaryAction?.onClick}>
                {primaryAction?.label ?? 'Create'}
            </button>
        ),
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
        FlowListTable: ({
            data = [],
            customColumns = [],
            renderActions
        }: {
            data?: Array<{ id: string; data: Record<string, unknown> }>
            customColumns?: Array<{ id: string; render: (row: { id: string; data: Record<string, unknown> }) => React.ReactNode }>
            renderActions?: (row: { id: string; data: Record<string, unknown> }) => React.ReactNode
        }) => (
            <div data-testid='records-table'>
                {data.map((row) => (
                    <div key={row.id}>
                        {customColumns.map((column) => (
                            <div key={column.id} data-testid={`record-cell-${column.id}`}>
                                {column.render(row)}
                            </div>
                        ))}
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
            descriptors,
            createContext,
            contextExtras
        }: {
            entity: { id: string; data: Record<string, unknown> }
            descriptors: Array<{
                id: string
                onSelect: (context: { entity: { id: string; data: Record<string, unknown> }; helpers?: Record<string, unknown> }) => unknown
            }>
            createContext: (context: Record<string, unknown>) => {
                entity: { id: string; data: Record<string, unknown> }
                helpers?: Record<string, unknown>
            }
            contextExtras?: Record<string, unknown>
        }) => {
            const editAction = descriptors.find((descriptor) => descriptor.id === 'edit')
            const context = createContext({ entity, ...contextExtras })
            return (
                <button type='button' onClick={() => void editAction?.onSelect(context)}>
                    Edit record
                </button>
            )
        },
        gridSpacing: 2
    }
})

vi.mock('@universo-react/template-mui/components/dialogs', () => ({
    ConfirmDeleteDialog: () => null,
    ConflictResolutionDialog: () => null,
    EntityFormDialog: () => null,
    DynamicEntityFormDialog: ({
        open,
        title,
        error,
        onSubmit,
        fields = [],
        initialData,
        renderField
    }: {
        open: boolean
        title: string
        error?: string | null
        onSubmit: (data: Record<string, unknown>) => Promise<void>
        fields?: Array<{ id: string; label: string; type: string; required?: boolean; validationRules?: Record<string, unknown> }>
        initialData?: Record<string, unknown>
        renderField?: (params: {
            field: { id: string; label: string; type: string; required?: boolean; validationRules?: Record<string, unknown> }
            value: unknown
            onChange: (value: unknown) => void
            disabled: boolean
            error: string | null
            locale: string
        }) => React.ReactNode
    }) =>
        open ? (
            <div role='dialog' aria-label={title}>
                <div>{title}</div>
                {error ? <div>{error}</div> : null}
                {fields.map((field) => (
                    <React.Fragment key={field.id}>
                        {renderField?.({
                            field,
                            value: initialData?.[field.id],
                            onChange: () => undefined,
                            disabled: false,
                            error: null,
                            locale: 'en'
                        })}
                    </React.Fragment>
                ))}
                <button type='button' onClick={() => void onSubmit({ Name: 'Lemonade' })}>
                    Submit dialog
                </button>
            </div>
        ) : null
}))

vi.mock('../../hooks/mutations', () => ({
    useCreateRecord: () => ({ mutateAsync: createElementMutateAsyncMock, isPending: false }),
    useUpdateRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useDeleteRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useMoveRecord: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useReorderRecord: () => ({ mutateAsync: vi.fn(), isPending: false })
}))

vi.mock('../../entities/metadata/component/api', () => ({
    listComponents: vi.fn(async () => ({
        items: objectComponents,
        pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
    })),
    listComponentsDirect: vi.fn(async () => ({
        items: objectComponents,
        pagination: { limit: 100, offset: 0, count: 1, total: 1, hasMore: false }
    }))
}))

vi.mock('../../../presets/api/objectCollections', () => ({
    getObjectCollectionById: vi.fn(async () => currentObject)
}))

vi.mock('../../entities/metadata/fixedValue/api', () => ({
    listAllConstants: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../../presets/api/optionLists', () => ({
    listOptionValues: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../../../shared', () => ({
    metahubsQueryKeys: {
        allObjectCollections: (...args: unknown[]) => ['allObjectCollections', ...args],
        objectCollectionDetail: (...args: unknown[]) => ['allObjectCollections', 'detail', ...args],
        treeEntities: (...args: unknown[]) => ['treeEntities', ...args],
        treeEntitiesList: (...args: unknown[]) => ['treeEntities', 'list', ...args],
        recordsList: (...args: unknown[]) => ['records', 'list', ...args],
        components: (...args: unknown[]) => ['components', ...args],
        componentsList: (...args: unknown[]) => ['components', 'list', ...args],
        fixedValues: (...args: unknown[]) => ['fixedValues', ...args],
        optionLists: (...args: unknown[]) => ['optionLists', ...args],
        childComponentsForElements: (...args: unknown[]) => ['childComponentsForElements', ...args]
    },
    fetchAllPaginatedItems: vi.fn(async () => ({
        items: [],
        pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: false }
    })),
    invalidateRecordsQueries: {
        all: vi.fn(),
        detail: vi.fn()
    },
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    createDomainErrorHandler: vi.fn(() => vi.fn()),
    optimisticReorder: vi.fn()
}))

vi.mock('../../../../settings/hooks/useSettings', () => ({
    useSettingValue: () => true
}))

vi.mock('../../../../settings/hooks/useMetahubPrimaryLocale', () => ({
    useMetahubPrimaryLocale: () => 'en'
}))

vi.mock('../../hooks/useRecordListData', () => ({
    useRecordListData: () => ({
        metahubId: 'metahub-1',
        hubIdParam: undefined,
        objectCollectionId: 'object-1',
        effectiveTreeEntityId: undefined,
        treeEntities: [],
        objectForHubResolution: currentObject,
        isObjectResolutionLoading: false,
        objectResolutionError: null,
        components: objectComponents,
        orderedComponents: objectComponents,
        childComponentsMap: {},
        childEnumValuesMap: {},
        setConstantsMap: {},
        allowElementCopy: true,
        allowElementDelete: true,
        paginationResult: {
            data: recordsFixture,
            isLoading: false,
            error: null,
            pagination: { total: 0, limit: 20, offset: 0, count: 0, hasMore: false },
            actions: { setSearch: vi.fn(), goToPage: vi.fn() }
        },
        isLoading: false,
        error: null,
        handleSearchChange: vi.fn(),
        sortedElements: recordsFixture,
        images: new Map(),
        elementMap: new Map(recordsFixture.map((record) => [record.id, record])),
        elementOrderMap: new Map(),
        visibleComponentsForColumns: objectComponents,
        refTargetByComponent: new Map(),
        refDisplayMap: new Map(),
        isFetchingRefDisplayMap: false
    })
}))

vi.mock('../RecordActions', () => ({
    __esModule: true,
    default: [
        {
            id: 'edit',
            onSelect: async (context: {
                entity: { id: string; data: Record<string, unknown> }
                helpers?: { openEditDialog?: (record: unknown) => Promise<void> }
                rawElement?: unknown
            }) => context.helpers?.openEditDialog?.(context.rawElement ?? context.entity)
        }
    ]
}))

vi.mock('../InlineTableEditor', () => ({
    __esModule: true,
    default: () => null
}))

vi.mock('../../../presets/ui/ObjectCollectionActions', () => ({
    buildInitialValues: () => ({}),
    buildFormTabs: () => [],
    validateObjectCollectionForm: () => null,
    canSaveObjectCollectionForm: () => true,
    toPayload: (value: unknown) => value
}))

vi.mock('../../../presets/hooks/objectCollectionMutations', () => ({
    useUpdateObjectCollectionAtMetahub: () => ({ mutate: vi.fn(), isPending: false })
}))

vi.mock('../../../presets/api/trees', () => ({
    listTreeEntities: vi.fn(async () => ({ items: [] }))
}))

vi.mock('../../../presets/hooks/useTreeEntities', () => ({
    useTreeEntities: () => ({ data: [], isLoading: false, error: null })
}))

vi.mock('@universo-react/utils', () => ({
    isOptimisticLockConflict: () => false,
    extractConflictInfo: () => null,
    hasAxiosResponse: (error: unknown) => {
        return error !== null && typeof error === 'object' && 'response' in error
    },
    createLocalizedContent: (locale = 'en', content: unknown = '') => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    }),
    filterLocalizedContent: (value: unknown) => value ?? null,
    updateLocalizedContentLocale: (content: unknown) => content,
    normalizeObjectCollectionCopyOptions: (opts: unknown) => opts ?? {},
    getVLCString: (value: unknown) => (typeof value === 'string' ? value : ''),
    getVLCPrimaryString: () => '',
    buildVLC: (locale: string, content: unknown) => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    })
}))

vi.mock('@universo-react/utils/vlc', () => ({
    normalizeLocale: (locale?: string) => (locale || 'en').toLowerCase().slice(0, 2),
    getSimpleLocalizedValue: () => '',
    getVLCString: (value: unknown) => (typeof value === 'string' ? value : ''),
    getVLCPrimaryString: () => '',
    isLocalizedContent: () => false,
    createLocalizedContent: (locale = 'en', content: unknown = '') => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    }),
    filterLocalizedContent: (value: unknown) => value ?? null,
    updateLocalizedContentLocale: (content: unknown) => content,
    buildVLC: (locale: string, content: unknown) => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    }),
    ensureVLC: (value: unknown) => value ?? { _schema: '1', _primary: 'en', locales: {} },
    resolveLocalizedContent: () => '',
    getLocalizedContentLocales: () => [],
    mapBaseVlcFields: (value: unknown) => value,
    sanitizeLocalizedInput: (value: unknown) => value,
    buildLocalizedContent: (locale: string, content: unknown) => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    }),
    getCodenamePrimary: () => '',
    enforceSingleLocaleCodename: (value: unknown) => value,
    createCodenameVLC: (locale: string, content: string) => ({
        _schema: '1',
        _primary: locale,
        locales: { [locale]: { content, version: 1, isActive: true, createdAt: '', updatedAt: '' } }
    }),
    ensureCodenameVLC: (value: unknown) => value ?? { _schema: '1', _primary: 'en', locales: {} },
    getVLCStringWithFallback: () => ''
}))

import RecordList from '../RecordList'

describe('RecordList record editor', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        recordsFixture.splice(0, recordsFixture.length)
    })

    it('keeps the create dialog open and surfaces the API message when creation fails', async () => {
        const user = userEvent.setup()
        createElementMutateAsyncMock.mockRejectedValueOnce(new Error('Validation failed: child localized content is invalid'))

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/records']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instance/:objectCollectionId/records' element={<RecordList />} />
                </Routes>
            </MemoryRouter>
        )

        // Click the Create button to open the dialog (no auto-open via useEffect to avoid infinite re-render loop)
        const createButton = await screen.findByRole('button', { name: /create/i })
        await user.click(createButton)

        expect(await screen.findByRole('dialog', { name: 'Add Record' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Submit dialog' }))

        await waitFor(() => {
            expect(createElementMutateAsyncMock).toHaveBeenCalledTimes(1)
            expect(screen.getByRole('dialog', { name: 'Add Record' })).toBeInTheDocument()
            expect(screen.getByText('Validation failed: child localized content is invalid')).toBeInTheDocument()
        })
    })

    it('opens the shared action editor for an Object record and formats its table cell as friendly text', async () => {
        const user = userEvent.setup()
        recordsFixture.push({
            id: 'record-1',
            objectCollectionId: 'object-1',
            data: { PrimaryAction: { kind: 'internal', path: '/auth', target: 'same-tab' } },
            ownerId: null,
            sortOrder: 1,
            createdAt: '2026-09-24T00:00:00.000Z',
            updatedAt: '2026-09-24T00:00:00.000Z'
        })

        render(
            <MemoryRouter initialEntries={['/metahub/metahub-1/entities/object/instance/object-1/records']}>
                <Routes>
                    <Route path='/metahub/:metahubId/entities/:kindKey/instance/:objectCollectionId/records' element={<RecordList />} />
                </Routes>
            </MemoryRouter>
        )

        const actionCell = await screen.findByTestId('record-cell-PrimaryAction')
        expect(actionCell).toHaveTextContent('Application page — Sign in or create an account')
        expect(actionCell).not.toHaveTextContent(/\{"kind"/)

        await user.click(screen.getByRole('button', { name: 'Edit record' }))

        expect(await screen.findByRole('dialog', { name: 'Edit Element' })).toBeInTheDocument()
        expect(screen.getByRole('group', { name: 'Primary action' })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Application page' })).toBeInTheDocument()
    })
})
