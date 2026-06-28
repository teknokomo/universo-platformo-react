import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

vi.mock('@universo-react/block-editor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@universo-react/block-editor')>()
    return {
        ...actual,
        EditorJsBlockEditor: ({
            contentLocale,
            onChange,
            onValidationError
        }: {
            contentLocale?: string
            onChange: (nextValue: unknown) => void
            onValidationError?: (message: string | null) => void
        }) => (
            <button
                data-testid='editorjs-block-editor'
                type='button'
                onClick={() => {
                    onValidationError?.(null)
                    onChange({
                        format: 'editorjs',
                        data: {
                            blocks: [
                                {
                                    id: `body-${contentLocale ?? 'en'}`,
                                    type: 'paragraph',
                                    data: {
                                        text: {
                                            _schema: '1',
                                            _primary: contentLocale ?? 'en',
                                            locales: {
                                                [contentLocale ?? 'en']: { content: `Body ${contentLocale ?? 'en'}` }
                                            }
                                        }
                                    }
                                }
                            ]
                        }
                    })
                }}
            >
                block editor {contentLocale ?? 'en'}
            </button>
        )
    }
})

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

const createAppDataResponse = () => ({
    section: {
        id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
        codename: 'courses',
        tableName: 'courses',
        name: 'Courses'
    },
    objectCollection: {
        id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
        codename: 'courses',
        tableName: 'courses',
        name: 'Courses'
    },
    sections: [],
    objectCollections: [],
    activeSectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
    activeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
    columns: [],
    rows: [],
    pagination: {
        total: 0,
        limit: 20,
        offset: 0
    },
    layoutConfig: {},
    zoneWidgets: { left: [], right: [], center: [] },
    menus: [],
    activeMenuId: null
})

const sectionIds: Record<string, string> = {
    Concept: '017f22e2-79b0-7cc3-98c4-dc0c0c074001',
    Interpretation: '017f22e2-79b0-7cc3-98c4-dc0c0c074002',
    Relation: '017f22e2-79b0-7cc3-98c4-dc0c0c074003',
    Material: '017f22e2-79b0-7cc3-98c4-dc0c0c074004',
    TableTemplate: '017f22e2-79b0-7cc3-98c4-dc0c0c074005'
}

const normalizeColumn = (column: Record<string, unknown>): Record<string, unknown> => ({
    dataType: 'STRING',
    headerName: String(column.codename ?? column.field ?? column.id),
    isRequired: false,
    validationRules: {},
    uiConfig: {},
    ...column,
    childColumns: Array.isArray(column.childColumns)
        ? column.childColumns.map((child) => normalizeColumn(child as Record<string, unknown>))
        : undefined
})

const appData = (
    codename: string,
    rows: Array<Record<string, unknown>>,
    columns: Array<Record<string, unknown>> = [],
    pagination?: { total?: number; limit?: number; offset?: number }
) => ({
    ...createAppDataResponse(),
    section: {
        id: sectionIds[codename],
        codename,
        tableName: codename.toLowerCase(),
        name: codename
    },
    objectCollection: {
        id: sectionIds[codename],
        codename,
        tableName: codename.toLowerCase(),
        name: codename
    },
    activeSectionId: sectionIds[codename],
    activeObjectCollectionId: sectionIds[codename],
    columns: columns.map(normalizeColumn),
    rows,
    pagination: { total: pagination?.total ?? rows.length, limit: pagination?.limit ?? 100, offset: pagination?.offset ?? 0 }
})

const interpretationMatrixColumns = () => [
    { id: 'title-component', codename: 'Title', field: 'Title' },
    { id: 'parent-component', codename: 'ParentConcept', field: 'ParentConcept', dataType: 'REF' },
    {
        id: 'matrix-component',
        codename: 'InterpretationMatrix',
        field: 'InterpretationMatrix',
        dataType: 'TABLE',
        childColumns: [
            { id: 'child-cell-id', codename: 'CellId', field: 'CellId' },
            {
                id: 'child-fill',
                codename: 'CellFillColor',
                field: 'CellFillColor',
                dataType: 'REF',
                headerName: 'Fill Color',
                uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'fill', cellStyleValue: 'color' },
                refOptions: [
                    { id: 'none', codename: 'none', label: 'None' },
                    { id: 'blue', codename: 'blue', label: 'Blue' }
                ]
            },
            { id: 'child-row-key', codename: 'RowKey', field: 'RowKey' },
            { id: 'child-row', codename: 'RowLabel', field: 'RowLabel' },
            { id: 'child-col-key', codename: 'ColKey', field: 'ColKey' },
            { id: 'child-col', codename: 'ColLabel', field: 'ColLabel' },
            { id: 'child-value', codename: 'CellValue', field: 'CellValue' },
            {
                id: 'child-description',
                codename: 'CellDescription',
                field: 'CellDescription',
                headerName: 'Cell Description',
                uiConfig: { widget: 'textarea' }
            },
            {
                id: 'child-border-top-color',
                codename: 'BorderTopColor',
                field: 'BorderTopColor',
                dataType: 'REF',
                headerName: 'Top Border Color',
                uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'color' },
                refOptions: [
                    { id: 'none', codename: 'none', label: 'None' },
                    { id: 'blue', codename: 'blue', label: 'Blue' }
                ]
            },
            { id: 'child-material', codename: 'MaterialRef', field: 'MaterialRef' }
        ]
    }
]

const matrixRowsFixture = () => ({
    items: [
        {
            id: 'matrix-row-selected',
            CellId: 'cell-selected',
            RowKey: 'definition',
            RowLabel: 'Definition',
            ColKey: 'meaning',
            ColLabel: 'Meaning',
            CellValue: 'Selected cell value',
            CellDescription: 'Selected cell description',
            CellFillColor: 'blue',
            BorderTopWidth: '3px',
            BorderTopStyle: 'solid',
            BorderTopColor: 'blue',
            BorderRightWidth: '1px',
            BorderRightStyle: 'solid',
            BorderRightColor: 'none',
            BorderBottomWidth: '1px',
            BorderBottomStyle: 'solid',
            BorderBottomColor: 'none',
            BorderLeftWidth: '1px',
            BorderLeftStyle: 'solid',
            BorderLeftColor: 'none',
            MaterialRef: 'material-selected'
        },
        {
            id: 'matrix-row-other',
            CellId: 'cell-other',
            RowKey: 'definition',
            RowLabel: 'Definition',
            ColKey: 'note',
            ColLabel: 'Note',
            CellValue: 'Other cell value',
            CellDescription: 'Other cell description',
            CellFillColor: 'none',
            BorderTopWidth: '1px',
            BorderTopStyle: 'solid',
            BorderTopColor: 'none',
            BorderRightWidth: '1px',
            BorderRightStyle: 'solid',
            BorderRightColor: 'none',
            BorderBottomWidth: '1px',
            BorderBottomStyle: 'solid',
            BorderBottomColor: 'none',
            BorderLeftWidth: '1px',
            BorderLeftStyle: 'solid',
            BorderLeftColor: 'none',
            MaterialRef: null
        }
    ],
    total: 2
})

const defaultRuntimeResponse = (url: URL) => {
    const codename = url.searchParams.get('objectCollectionCodename')
    if (codename === 'Concept') {
        return appData(
            'Concept',
            [{ id: 'concept-1', Term: 'Existing structure' }],
            [
                { id: 'term-component', codename: 'Term', field: 'Term', headerName: 'Term' },
                {
                    id: 'description-component',
                    codename: 'Description',
                    field: 'Description',
                    headerName: 'Description',
                    uiConfig: { widget: 'textarea' }
                }
            ]
        )
    }
    if (codename === 'Interpretation') {
        return appData(
            'Interpretation',
            [{ id: 'interpretation-1', Title: 'Existing structure matrix', ParentConcept: 'concept-1' }],
            interpretationMatrixColumns()
        )
    }
    if (codename === 'Material') {
        return appData(
            'Material',
            [
                {
                    id: 'material-selected',
                    Title: 'Selected material',
                    Description: 'Selected material description',
                    Body: { data: { blocks: [{ type: 'paragraph', data: { text: { en: 'Selected material body' } } }] } }
                }
            ],
            [
                {
                    id: 'material-title-component',
                    codename: 'Title',
                    field: 'Title',
                    headerName: 'Title',
                    validationRules: { localized: true, maxLength: 255, versioned: true }
                },
                {
                    id: 'material-description-component',
                    codename: 'Description',
                    field: 'Description',
                    headerName: 'Description',
                    validationRules: { localized: true, versioned: true },
                    uiConfig: { widget: 'textarea' }
                },
                {
                    id: 'material-body-component',
                    codename: 'Body',
                    field: 'Body',
                    dataType: 'JSON',
                    headerName: 'Body',
                    uiConfig: { widget: 'editorjsBlockContent' }
                }
            ]
        )
    }
    if (codename === 'TableTemplate') {
        return appData(
            'TableTemplate',
            [{ id: 'template-1', Name: 'Base template', Description: 'Reusable matrix' }],
            [
                {
                    id: 'template-matrix-component',
                    codename: 'TemplateMatrix',
                    field: 'TemplateMatrix',
                    dataType: 'TABLE',
                    childColumns: [
                        {
                            id: 'template-child-fill',
                            codename: 'CellFillColor',
                            field: 'CellFillColor',
                            dataType: 'REF',
                            refOptions: [{ id: 'none-id', codename: 'none', label: 'None' }]
                        }
                    ]
                }
            ]
        )
    }
    return appData(codename ?? 'Relation', [])
}

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    })

const renderInterpretationNetworkWidget = (
    fetchMock: ReturnType<typeof vi.fn>,
    onOpenCreateTarget = vi.fn(),
    permissions = { createContent: true, editContent: true, deleteContent: true },
    navigate = vi.fn((href: string) => window.history.pushState(null, '', href))
) => {
    vi.stubGlobal('fetch', fetchMock)
    render(
        <QueryClientProvider client={createQueryClient()}>
            <DashboardDetailsProvider
                value={{
                    title: 'Interpretation Network',
                    applicationId: 'app-1',
                    apiBaseUrl: '/api/v1',
                    locale: 'en',
                    currentWorkspaceId: 'workspace-1',
                    permissions,
                    navigate,
                    rows: [],
                    columns: [],
                    onOpenCreateTarget
                }}
            >
                {renderWidget({
                    id: 'interpretation-widget',
                    widgetKey: 'interpretationNetworkWorkspace',
                    sortOrder: 0,
                    config: {}
                })}
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
    return { onOpenCreateTarget, navigate }
}

describe('InterpretationNetworkWorkspaceWidget', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.history.pushState({}, '', '/a/app-1')
    })

    it('keeps the Structures section empty until the user creates a structure', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse({ id: 'matrix-created' }, 201)
            if (url.pathname.endsWith('/runtime/rows')) {
                const body = JSON.parse(String(init?.body ?? '{}'))
                if (body.objectCollectionId === sectionIds.Concept) return jsonResponse({ id: 'concept-created' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) return jsonResponse({ id: 'interpretation-created' }, 201)
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Concept') {
                return jsonResponse(
                    appData(
                        'Concept',
                        [],
                        [
                            { id: 'term-component', codename: 'Term', field: 'cmp-term-component', headerName: 'Term' },
                            {
                                id: 'description-component',
                                codename: 'Description',
                                field: 'cmp-description-component',
                                headerName: 'Description',
                                uiConfig: { widget: 'textarea' }
                            }
                        ]
                    )
                )
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Interpretation') {
                return jsonResponse(appData('Interpretation', [], interpretationMatrixColumns()))
            }
            return jsonResponse(appData(url.searchParams.get('objectCollectionCodename') ?? 'Relation', []))
        })
        renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        expect(within(structurePane).getByRole('heading', { name: 'Structures' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Create' })).toBeInTheDocument()
        expect(within(structurePane).queryByText('Create a structure to start working with the matrix.')).not.toBeInTheDocument()
        expect(screen.getByText('Create or select a structure on the left.', { exact: false })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument()
        await user.click(within(structurePane).getByRole('button', { name: 'Create' }))

        const dialog = await screen.findByRole('dialog', { name: 'Create structure' })
        await user.type(within(dialog).getByLabelText('Term'), 'Working structure')
        await user.type(within(dialog).getByLabelText('Description'), 'Working structure description')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const rowCreateCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).endsWith('/runtime/rows?workspaceId=workspace-1')
            )
            expect(rowCreateCalls).toHaveLength(2)
            expect(JSON.parse(String(rowCreateCalls[0][1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Concept,
                    data: expect.objectContaining({
                        'cmp-term-component': 'Working structure',
                        'cmp-description-component': 'Working structure description'
                    })
                })
            )
            expect(JSON.parse(String(rowCreateCalls[1][1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Interpretation,
                    data: expect.objectContaining({
                        ParentConcept: 'concept-created',
                        Title: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'Working structure matrix' })
                            })
                        })
                    })
                })
            )
            expect(
                fetchMock.mock.calls.some(([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component'))
            ).toBe(true)
        })
    }, 15_000)

    it('loads all structure and material pages instead of truncating the workspace at the first 100 rows', async () => {
        const concepts = Array.from({ length: 101 }, (_, index) => ({
            id: `concept-${index + 1}`,
            Term: index === 100 ? 'Second page structure' : `Structure ${index + 1}`
        }))
        const interpretations = concepts.map((concept, index) => ({
            id: `interpretation-${index + 1}`,
            Title: `${concept.Term} matrix`,
            ParentConcept: concept.id
        }))
        const materials = Array.from({ length: 101 }, (_, index) => ({
            id: `material-${index + 1}`,
            Title: index === 100 ? 'Second page material' : `Material ${index + 1}`,
            Description: `Material ${index + 1} description`,
            CellId: 'cell-selected',
            Body: { data: { blocks: [] } }
        }))
        const paginate = (rows: Array<Record<string, unknown>>, url: URL) => {
            const limit = Number(url.searchParams.get('limit') ?? 100)
            const offset = Number(url.searchParams.get('offset') ?? 0)
            return rows.slice(offset, offset + limit)
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            const codename = url.searchParams.get('objectCollectionCodename')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            if (codename === 'Concept') {
                return jsonResponse(
                    appData(
                        'Concept',
                        paginate(concepts, url),
                        [
                            { id: 'term-component', codename: 'Term', field: 'Term', headerName: 'Term' },
                            { id: 'description-component', codename: 'Description', field: 'Description', headerName: 'Description' }
                        ],
                        {
                            total: concepts.length,
                            limit: Number(url.searchParams.get('limit') ?? 100),
                            offset: Number(url.searchParams.get('offset') ?? 0)
                        }
                    )
                )
            }
            if (codename === 'Interpretation') {
                return jsonResponse(
                    appData('Interpretation', paginate(interpretations, url), interpretationMatrixColumns(), {
                        total: interpretations.length,
                        limit: Number(url.searchParams.get('limit') ?? 100),
                        offset: Number(url.searchParams.get('offset') ?? 0)
                    })
                )
            }
            if (codename === 'Material') {
                return jsonResponse(
                    appData(
                        'Material',
                        paginate(materials, url),
                        [
                            { id: 'material-title-component', codename: 'Title', field: 'Title', headerName: 'Title' },
                            {
                                id: 'material-description-component',
                                codename: 'Description',
                                field: 'Description',
                                headerName: 'Description'
                            },
                            { id: 'material-cell-component', codename: 'CellId', field: 'CellId', headerName: 'Cell ID' },
                            { id: 'material-body-component', codename: 'Body', field: 'Body', dataType: 'JSON', headerName: 'Body' }
                        ],
                        {
                            total: materials.length,
                            limit: Number(url.searchParams.get('limit') ?? 100),
                            offset: Number(url.searchParams.get('offset') ?? 0)
                        }
                    )
                )
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })

        const user = userEvent.setup()
        renderInterpretationNetworkWidget(fetchMock)

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(([input]) => {
                    const url = new URL(String(input), 'http://localhost:3000')
                    return url.searchParams.get('objectCollectionCodename') === 'Concept' && url.searchParams.get('offset') === '100'
                })
            ).toBe(true)
            expect(
                fetchMock.mock.calls.some(([input]) => {
                    const url = new URL(String(input), 'http://localhost:3000')
                    return url.searchParams.get('objectCollectionCodename') === 'Material' && url.searchParams.get('offset') === '100'
                })
            ).toBe(true)
        })
        await user.click(await screen.findByRole('button', { name: 'Card view' }))
        await user.type(screen.getByLabelText('Filter by title'), 'Second page structure')
        expect(await screen.findByRole('button', { name: /Second page structure/i })).toBeInTheDocument()
    }, 20_000)

    it('replaces the left structure list with the opened structure matrix and keeps materials on the right', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const detailsPane = await screen.findByTestId('interpretation-network-details-pane')

        expect(within(structurePane).getByRole('heading', { name: 'Structures' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Create' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('textbox', { name: 'Filter by title' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Table view' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Card view' })).toBeInTheDocument()
        expect(within(structurePane).getByTestId('interpretation-network-structure-table')).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Existing structure' })).toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Add cell' })).not.toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(within(structurePane).queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(within(detailsPane).getByText('Create or select a structure on the left.', { exact: false })).toBeInTheDocument()
        expect(within(detailsPane).queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(within(detailsPane).queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()

        await userEvent.click(within(structurePane).getByRole('button', { name: 'Existing structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Add cell' })).toBeInTheDocument()
        expect(within(structurePane).getByRole('button', { name: 'Add row' })).toBeInTheDocument()
        expect(within(structurePane).queryByText('Meaning')).not.toBeInTheDocument()
        expect(within(structurePane).queryByText('Definition')).not.toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Existing structure' })).not.toBeInTheDocument()
        expect(within(detailsPane).getByText('Create or select a structure on the left.', { exact: false })).toBeInTheDocument()
        expect(within(detailsPane).queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(within(detailsPane).queryByTestId('interpretation-network-matrix-workspace')).not.toBeInTheDocument()
    })

    it('filters structures and opens them from the full card view', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        await user.type(within(structurePane).getByRole('textbox', { name: 'Filter by title' }), 'missing')
        expect(within(structurePane).getByText('No structures match the current filter.')).toBeInTheDocument()
        await user.clear(within(structurePane).getByRole('textbox', { name: 'Filter by title' }))
        await user.click(within(structurePane).getByRole('button', { name: 'Card view' }))

        const cards = await within(structurePane).findByTestId('interpretation-network-structure-cards')
        expect(cards).not.toHaveTextContent('concept-1')
        await user.click(within(cards).getByText('Existing structure'))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
    }, 20_000)

    it('persists the opened structure in the URL and restores it after refresh', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Concept}`)
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        await user.click(within(structurePane).getByRole('button', { name: 'Existing structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Concept}/concept-1`)
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Concept}/concept-1`)
    })

    it('uses the concept section segment instead of the workspace id when opening a structure from the app root URL', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', '/a/app-1')
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        await user.click(within(structurePane).getByRole('button', { name: 'Existing structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Concept}/concept-1`)
        expect(window.location.pathname).not.toContain('/workspace-1/')
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Concept}/concept-1`)
    })

    it('opens the structure matrix from an initial structure URL segment', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Concept}/concept-1`)
        renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Existing structure' })).not.toBeInTheDocument()
    })

    it('reads the latest structure segment from nested URLs and replaces stale structure segments on navigation', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            const codename = url.searchParams.get('objectCollectionCodename')
            if (codename === 'Concept') {
                return jsonResponse(
                    appData(
                        'Concept',
                        [
                            { id: 'concept-1', Term: 'Existing structure' },
                            { id: 'concept-2', Term: 'Second structure' }
                        ],
                        [
                            { id: 'term-component', codename: 'Term', field: 'Term', headerName: 'Term' },
                            { id: 'description-component', codename: 'Description', field: 'Description', headerName: 'Description' }
                        ]
                    )
                )
            }
            if (codename === 'Interpretation') {
                return jsonResponse(
                    appData(
                        'Interpretation',
                        [
                            { id: 'interpretation-1', Title: 'Existing structure matrix', ParentConcept: 'concept-1' },
                            { id: 'interpretation-2', Title: 'Second structure matrix', ParentConcept: 'concept-2' }
                        ],
                        interpretationMatrixColumns()
                    )
                )
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Concept}/concept-old/concept-1`)
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()

        await user.click(within(structurePane).getByRole('button', { name: 'Structures' }))
        await user.click(await within(structurePane).findByRole('button', { name: 'Second structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Concept}/concept-2`)
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Concept}/concept-2`)
    })

    it('shows material creation guidance until a matrix cell is selected', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        expect(screen.getByText('Create or select a structure on the left.', { exact: false })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(
            within(screen.getByTestId('interpretation-network-details-pane')).queryByRole('button', { name: 'Create' })
        ).not.toBeInTheDocument()

        await user.click((await screen.findAllByTestId('interpretation-network-cell'))[0])

        expect(screen.queryByText('Create or select a structure on the left.', { exact: false })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument()
        const detailsPane = screen.getByTestId('interpretation-network-details-pane')
        expect(within(detailsPane).getByRole('button', { name: 'Create' })).toBeEnabled()
        expect(within(detailsPane).getByRole('textbox', { name: 'Filter by title' })).toBeInTheDocument()
        expect(within(detailsPane).getByRole('button', { name: 'Table view' })).toBeInTheDocument()
        expect(within(detailsPane).getByRole('button', { name: 'Card view' })).toBeInTheDocument()
    })

    it('shows a sanitized matrix load error and disables matrix mutations', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ message: 'database relation internal_table_123 failed' }, 500)
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        expect(await screen.findByText('Failed to load matrix cells')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add cell' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Add row' })).toBeDisabled()
        expect(screen.queryByText(/internal_table_123/i)).not.toBeInTheDocument()
    })

    it('disables authoring controls when the current role cannot mutate content', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), { createContent: false, editContent: false, deleteContent: false })

        expect(
            await screen.findByText('You can view this workspace, but content editing is not available for your role.')
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('button', { name: 'Existing structure' }))
        expect(await screen.findByRole('button', { name: 'Add cell' })).toBeDisabled()

        await userEvent.click((await screen.findAllByTestId('interpretation-network-cell'))[0])
        expect(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Edit material' })).not.toBeInTheDocument()
    })

    it('rolls back a created structure and matrix page when the initial matrix cell creation fails', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                const body = JSON.parse(String(init.body ?? '{}'))
                if (body.objectCollectionId === sectionIds.Concept) return jsonResponse({ id: 'concept-created' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) return jsonResponse({ id: 'interpretation-created' }, 201)
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ message: 'failed child insert' }, 500)
            }
            if (
                init?.method === 'DELETE' &&
                (url.pathname.endsWith('/runtime/rows/interpretation-created') || url.pathname.endsWith('/runtime/rows/concept-created'))
            ) {
                return new Response(null, { status: 204 })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Create' }))
        const dialog = await screen.findByRole('dialog', { name: 'Create structure' })
        await user.type(within(dialog).getByLabelText('Term'), 'Rollback structure')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'DELETE' && String(input).includes('/runtime/rows/interpretation-created')
                )
            ).toBe(true)
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'DELETE' && String(input).includes('/runtime/rows/concept-created')
                )
            ).toBe(true)
        })
        expect(await screen.findAllByText('Failed to create structure')).toHaveLength(2)
    }, 20_000)

    it('creates the initial matrix page for the newly created structure', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                const body = JSON.parse(String(init.body ?? '{}'))
                if (body.objectCollectionId === sectionIds.Concept) return jsonResponse({ id: 'concept-created-2' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) return jsonResponse({ id: 'interpretation-created-2' }, 201)
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component'))
                return jsonResponse({ id: 'matrix-created' }, 201)
            if (url.searchParams.get('objectCollectionCodename') === 'Concept') {
                return jsonResponse(defaultRuntimeResponse(url))
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Interpretation') {
                return jsonResponse(defaultRuntimeResponse(url))
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Create' }))
        const dialog = await screen.findByRole('dialog', { name: 'Create structure' })
        await user.type(within(dialog).getByLabelText('Term'), 'Source structure')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const interpretationCall = fetchMock.mock.calls.find(([input, init]) => {
                if (init?.method !== 'POST' || !String(input).endsWith('/runtime/rows?workspaceId=workspace-1')) return false
                return JSON.parse(String(init.body ?? '{}')).objectCollectionId === sectionIds.Interpretation
            })
            expect(interpretationCall).toBeDefined()
            expect(JSON.parse(String(interpretationCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({ data: expect.objectContaining({ ParentConcept: 'concept-created-2' }) })
            )
            const tabularCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/runtime/rows/interpretation-created-2/tabular/')
            )
            expect(tabularCall).toBeDefined()
            const tabularBody = JSON.parse(String(tabularCall?.[1]?.body ?? '{}'))
            expect(tabularBody.data?.CellId).toMatch(UUID_V7_REGEX)
            expect(tabularBody.data?.ColKey).toMatch(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i)
            expect(tabularBody.data?.RowKey).toMatch(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i)
        })
    }, 20_000)

    it('reports matrix swap failure from the atomic batch endpoint without issuing partial row patches', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                return jsonResponse({ message: 'batch update failed' }, 500)
            }
            if (init?.method === 'PATCH' && url.pathname.includes('/tabular/matrix-component/')) {
                return jsonResponse({ id: url.pathname.split('/').pop(), status: 'updated' })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await userEvent.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        const cells = screen.getAllByTestId('interpretation-network-cell')
        const dragData = new Map<string, string>()
        const dataTransfer = {
            effectAllowed: 'none',
            dropEffect: 'none',
            setData: (type: string, value: string) => dragData.set(type, value),
            getData: (type: string) => dragData.get(type) ?? ''
        } as DataTransfer
        fireEvent.dragStart(cells[0], { dataTransfer })
        fireEvent.dragOver(cells[1], { dataTransfer })
        fireEvent.drop(cells[1], { dataTransfer })

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'PATCH' && String(input).includes('/tabular/matrix-component/')
                )
            ).toBe(false)
        })
        expect(await screen.findByText('Failed to update matrix cells')).toBeInTheDocument()
    })

    it('moves selected cells through the card action menu', async () => {
        const user = userEvent.setup()
        let matrixMoved = false
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                matrixMoved = true
                return jsonResponse({ status: 'ok', updated: ['matrix-row-selected', 'matrix-row-other'] })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                const fixture = matrixRowsFixture()
                if (!matrixMoved) return jsonResponse(fixture)
                return jsonResponse({
                    ...fixture,
                    items: [
                        {
                            ...fixture.items[0],
                            CellId: 'cell-other',
                            CellValue: 'Other cell value',
                            CellDescription: 'Other cell description',
                            CellFillColor: 'none',
                            MaterialRef: null
                        },
                        {
                            ...fixture.items[1],
                            CellId: 'cell-selected',
                            CellValue: 'Selected cell value',
                            CellDescription: 'Selected cell description',
                            CellFillColor: 'blue',
                            MaterialRef: 'material-selected'
                        }
                    ]
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        expect(screen.queryByRole('menuitem', { name: 'Left' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Up' })).not.toBeInTheDocument()
        await user.click(await screen.findByRole('menuitem', { name: 'Right' }))

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            const body = JSON.parse(String(batchCalls[0][1]?.body ?? '{}'))
            expect(body).toEqual(
                expect.objectContaining({
                    updates: [
                        expect.objectContaining({
                            childRowId: 'matrix-row-selected',
                            data: expect.objectContaining({
                                CellId: 'cell-other',
                                RowKey: 'definition',
                                ColKey: 'meaning',
                                CellValue: 'Other cell value',
                                CellDescription: 'Other cell description',
                                CellFillColor: 'none',
                                MaterialRef: null
                            })
                        }),
                        expect.objectContaining({
                            childRowId: 'matrix-row-other',
                            data: expect.objectContaining({
                                CellId: 'cell-selected',
                                RowKey: 'definition',
                                ColKey: 'note',
                                CellValue: 'Selected cell value',
                                CellDescription: 'Selected cell description',
                                CellFillColor: 'blue',
                                MaterialRef: 'material-selected'
                            })
                        })
                    ]
                })
            )
        })
        await waitFor(() => expect(screen.getByTestId('interpretation-network-details-pane')).toHaveTextContent('Selected material'))
    }, 20_000)

    it('deletes a cell from the card action menu after confirmation', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'DELETE' && url.pathname.endsWith('/tabular/matrix-component/matrix-row-selected')) {
                return new Response(null, { status: 204 })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete cell?' })
        expect(within(dialog).queryByText('matrix-row-selected')).not.toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'DELETE' && String(input).includes('/tabular/matrix-component/matrix-row-selected')
                )
            ).toBe(true)
        })
    }, 20_000)

    it('creates an Editor.js material from the right pane and attaches it to the selected cell', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                return jsonResponse({ id: 'material-created' }, 201)
            }
            if (init?.method === 'PATCH' && url.pathname.endsWith('/tabular/matrix-component/matrix-row-selected')) {
                return jsonResponse({ id: 'matrix-row-selected' })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getAllByTestId('interpretation-network-cell')[0])
        await user.click(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' }))
        await user.type(await screen.findByLabelText('Title'), 'New source note')
        await user.type(await screen.findByLabelText('Description'), 'New source description')
        expect(screen.queryByLabelText('Body')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).endsWith('/runtime/rows?workspaceId=workspace-1')
            )
            expect(createCall).toBeDefined()
            expect(JSON.parse(String(createCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Material,
                    data: expect.objectContaining({
                        Title: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'New source note' })
                            })
                        }),
                        Description: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'New source description' })
                            })
                        })
                    })
                })
            )
            const attachCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'PATCH' && String(input).includes('/tabular/matrix-component/matrix-row-selected')
            )
            expect(attachCall).toBeDefined()
            expect(JSON.parse(String(attachCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({ data: { MaterialRef: 'material-created' } })
            )
        })
        expect(screen.queryByTestId('interpretation-network-material-editor')).not.toBeInTheDocument()
    }, 20_000)

    it('blocks material creation when the localized title exceeds the metadata max length', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getAllByTestId('interpretation-network-cell')[0])
        await user.click(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add material' })
        fireEvent.change(within(dialog).getByRole('textbox', { name: 'Title' }), { target: { value: 'A'.repeat(260) } })

        expect(await within(dialog).findByText('Language "EN": maximum length 255')).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Create' })).toBeDisabled()
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    }, 20_000)

    it('filters materials, switches to card view, edits metadata from row actions, and opens a body-only material editor', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'PATCH' && url.pathname.endsWith('/runtime/rows/material-selected')) {
                return jsonResponse({ id: 'material-selected' })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getAllByTestId('interpretation-network-cell')[0])

        expect(await screen.findByTestId('interpretation-network-material-table')).toBeInTheDocument()
        const materialTable = screen.getByTestId('interpretation-network-material-table')
        expect(materialTable.querySelector('.MuiDataGrid-root')).toBeTruthy()
        await user.type(
            within(screen.getByTestId('interpretation-network-details-pane')).getByRole('textbox', { name: 'Filter by title' }),
            'selected'
        )
        expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument()
        expect(screen.getByRole('columnheader', { name: 'Description' })).toBeInTheDocument()
        expect(screen.queryByRole('columnheader', { name: 'Body' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Selected material' })).toBeInTheDocument()
        expect(screen.queryByText('For cell:', { exact: false })).not.toBeInTheDocument()
        expect(materialTable).not.toHaveTextContent('Selected material body')
        expect(materialTable).not.toHaveTextContent('[object Object]')
        expect(materialTable).not.toHaveTextContent(/"blocks"/)

        await user.click(screen.getByRole('button', { name: 'Material actions: Selected material' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit material' }))
        const editDialog = await screen.findByRole('dialog', { name: 'Edit material' })
        const editTitleField = within(editDialog).getByLabelText('Title')
        const editDescriptionField = within(editDialog).getByLabelText('Description')
        expect(editTitleField).toBeInTheDocument()
        expect(editDescriptionField).toBeInTheDocument()
        expect(within(editDialog).queryByText('Body')).not.toBeInTheDocument()
        await user.clear(editTitleField)
        await user.type(editTitleField, 'Selected material edited')
        await user.clear(editDescriptionField)
        await user.type(editDescriptionField, 'Selected material description edited')
        await user.click(within(editDialog).getByRole('button', { name: 'Save' }))

        await user.click(screen.getByRole('button', { name: 'Card view' }))
        const materialCards = screen.getByTestId('interpretation-network-material-cards')
        expect(materialCards).toBeInTheDocument()
        expect(materialCards).not.toHaveTextContent('Body')
        expect(materialCards).not.toHaveTextContent('Selected material body')
        expect(materialCards).not.toHaveTextContent('[object Object]')
        expect(materialCards).not.toHaveTextContent(/"blocks"/)
        await user.click(within(materialCards).getByText('Selected material'))

        expect(await screen.findByText('Material content')).toBeInTheDocument()
        expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Description')).not.toBeInTheDocument()
        expect(within(screen.getByRole('tab', { name: /Default language English/i })).getByTitle('Default language')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Language actions: English' }))
        expect(await screen.findByRole('menuitem', { name: 'Primary variant' })).toHaveAttribute('aria-disabled', 'true')
        await user.keyboard('{Escape}')
        await user.click(screen.getByRole('button', { name: 'Add language' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Russian' }))
        expect(screen.getByRole('tab', { name: 'Russian' })).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Language actions: Russian' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Make primary' }))
        expect(within(screen.getByRole('tab', { name: /Default language Russian/i })).getByTitle('Default language')).toBeInTheDocument()
        await user.click(screen.getByTestId('editorjs-block-editor'))

        await user.click(screen.getByRole('button', { name: 'Save' }))
        await waitFor(() => {
            const updateCalls = fetchMock.mock.calls.filter(
                ([input, init]) =>
                    init?.method === 'PATCH' && String(input).endsWith('/runtime/rows/material-selected?workspaceId=workspace-1')
            )
            expect(updateCalls.length).toBeGreaterThanOrEqual(2)
            const metadataUpdateCall = updateCalls.find(([, init]) => {
                const parsed = JSON.parse(String(init?.body ?? '{}'))
                return (
                    parsed.data?.Title?.locales?.en?.content === 'Selected material edited' &&
                    parsed.data?.Description?.locales?.en?.content === 'Selected material description edited'
                )
            })
            expect(metadataUpdateCall).toBeDefined()
            const bodyUpdateCall = updateCalls.find(([, init]) => {
                const parsed = JSON.parse(String(init?.body ?? '{}'))
                return parsed.data && Object.prototype.hasOwnProperty.call(parsed.data, 'Body')
            })
            expect(bodyUpdateCall).toBeDefined()
            expect(JSON.parse(String(bodyUpdateCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        Body: expect.objectContaining({
                            data: expect.objectContaining({
                                blocks: expect.arrayContaining([
                                    expect.objectContaining({
                                        type: 'paragraph'
                                    })
                                ])
                            })
                        })
                    })
                })
            )
        })
    }, 40_000)

    it('preserves the configured selected cell fill and border instead of replacing them with black', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await userEvent.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        const selectedCell = screen.getAllByTestId('interpretation-network-cell')[0]
        await userEvent.click(selectedCell)

        const selectedCellStyle = window.getComputedStyle(selectedCell)
        expect(selectedCellStyle.backgroundColor).toBe('#1e88e5')
        expect(selectedCellStyle.borderTopColor).toBe('#1e88e5')
        expect(selectedCellStyle.borderTopWidth).toBe('3px')
        expect(selectedCellStyle.outlineWidth).toBe('2px')
        expect(selectedCellStyle.backgroundColor).not.toBe('rgb(0, 0, 0)')
    })

    it('edits cell metadata and style from the card menu through the tabular update endpoint', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'PATCH' && url.pathname.endsWith('/tabular/matrix-component/matrix-row-selected')) {
                return jsonResponse({ id: 'matrix-row-selected' })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        const descriptionField = within(dialog).getByRole('textbox', { name: /Description/i })
        expect(descriptionField.tagName.toLowerCase()).toBe('textarea')
        await user.clear(titleField)
        await user.type(titleField, 'Updated cell title')
        await user.clear(descriptionField)
        await user.type(descriptionField, 'Updated cell description')
        await user.click(within(dialog).getByRole('tab', { name: 'Style' }))
        await user.click(within(dialog).getByRole('button', { name: 'Fill Blue' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            const styleCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'PATCH' && String(input).includes('/tabular/matrix-component/matrix-row-selected')
            )
            expect(styleCall).toBeDefined()
            expect(JSON.parse(String(styleCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        CellFillColor: 'blue',
                        CellValue: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated cell title' }) })
                        }),
                        CellDescription: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated cell description' }) })
                        })
                    })
                })
            )
        })
    }, 20_000)
})
