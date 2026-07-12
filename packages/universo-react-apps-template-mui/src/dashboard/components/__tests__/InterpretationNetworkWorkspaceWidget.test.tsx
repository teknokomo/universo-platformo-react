import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'
import { CellEditDialog } from '../interpretation-network/CellEditDialog'

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
    Structure: '017f22e2-79b0-7cc3-98c4-dc0c0c074001',
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
    { id: 'parent-component', codename: 'ParentStructure', field: 'ParentStructure', dataType: 'REF' },
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
            { id: 'child-parent-cell-id', codename: 'ParentCellId', field: 'ParentCellId', uiConfig: { hidden: true } },
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
            _upl_version: 7,
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
            _upl_version: 9,
            CellId: 'cell-other',
            RowKey: 'example',
            RowLabel: 'Example',
            ColKey: 'meaning',
            ColLabel: 'Meaning',
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

const matrixTableRowsFixture = () => {
    const fixture = matrixRowsFixture()
    return {
        ...fixture,
        items: [
            fixture.items[0],
            {
                ...fixture.items[1],
                ColKey: 'source',
                ColLabel: 'Source'
            }
        ]
    }
}

const matrixTableHierarchyRowsFixture = () => ({
    items: [
        {
            id: 'row-root',
            CellId: 'root',
            RowKey: 'root-row',
            RowLabel: 'Root row',
            ColKey: 'root-column',
            ColLabel: 'Root column',
            CellValue: 'Universe',
            _tp_sort_order: 0
        },
        {
            id: 'row-parent-a',
            CellId: 'parent-a',
            ParentCellId: 'root',
            RowKey: 'parent-a-row',
            RowLabel: 'Parent A row',
            ColKey: 'parent-a-column',
            ColLabel: 'Parent A column',
            CellValue: 'Parent A',
            _tp_sort_order: 0
        },
        {
            id: 'row-parent-b',
            CellId: 'parent-b',
            ParentCellId: 'root',
            RowKey: 'parent-b-row',
            RowLabel: 'Parent B row',
            ColKey: 'parent-b-column',
            ColLabel: 'Parent B column',
            CellValue: 'Parent B',
            _tp_sort_order: 1
        },
        {
            id: 'row-child-a1',
            CellId: 'child-a1',
            ParentCellId: 'parent-a',
            RowKey: 'child-a1-row',
            RowLabel: 'Child A1 row',
            ColKey: 'child-a1-column',
            ColLabel: 'Child A1 column',
            CellValue: 'Child A1',
            _tp_sort_order: 0
        },
        {
            id: 'row-child-b1',
            CellId: 'child-b1',
            ParentCellId: 'parent-b',
            RowKey: 'child-b1-row',
            RowLabel: 'Child B1 row',
            ColKey: 'child-b1-column',
            ColLabel: 'Child B1 column',
            CellValue: 'Child B1',
            _tp_sort_order: 0
        }
    ],
    total: 5
})

const defaultRuntimeResponse = (url: URL) => {
    const codename = url.searchParams.get('objectCollectionCodename')
    if (codename === 'Structure') {
        return appData(
            'Structure',
            [{ id: 'concept-1', Name: 'Existing structure' }],
            [
                { id: 'term-component', codename: 'Name', field: 'Name', headerName: 'Name' },
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
            [{ id: 'interpretation-1', Title: 'Existing structure matrix', ParentStructure: 'concept-1' }],
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

const defaultPermissions = { createContent: true, editContent: true, deleteContent: true }
const independentRowsConfig = { matrixMode: 'independentRows' }
const independentAxesTableConfig = {
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
    defaultMatrixView: 'table',
    tableProjection: 'independentAxes'
}
const hierarchicalPathTableConfig = {
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
    defaultMatrixView: 'table',
    tableProjection: 'hierarchicalPath'
}
const horizontalRowsConfig = {
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['horizontalRows', 'verticalTree'],
    defaultMatrixView: 'horizontalRows'
}
const horizontalRowsIndependentAxesConfig = {
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['horizontalRows', 'verticalTree'],
    defaultMatrixView: 'horizontalRows',
    tableProjection: 'independentAxes'
}

const renderInterpretationNetworkWidget = (
    fetchMock: ReturnType<typeof vi.fn>,
    onOpenCreateTarget = vi.fn(),
    permissions = defaultPermissions,
    navigate = vi.fn((href: string) => window.history.pushState(null, '', href)),
    config: Record<string, unknown> = {},
    locale = 'en'
) => {
    vi.stubGlobal('fetch', fetchMock)
    render(
        <QueryClientProvider client={createQueryClient()}>
            <DashboardDetailsProvider
                value={{
                    title: 'Interpretation Network',
                    applicationId: 'app-1',
                    apiBaseUrl: '/api/v1',
                    locale,
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
                    config
                })}
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
    return { onOpenCreateTarget, navigate }
}

const clickSelectedMatrixCell = async (user: ReturnType<typeof userEvent.setup>) => {
    const tableCell = screen.queryByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' })
    if (tableCell) {
        await user.click(tableCell)
        return
    }

    await user.click((await screen.findAllByTestId('interpretation-network-cell'))[0])
}

const switchToHorizontalRows = async (user: ReturnType<typeof userEvent.setup>) => {
    const horizontalRowsButton = await screen.findByRole('button', { name: 'Horizontal rows' })
    if (horizontalRowsButton?.getAttribute('aria-pressed') !== 'true') {
        await user.click(horizontalRowsButton)
    }
}

describe('InterpretationNetworkWorkspaceWidget', () => {
    beforeEach(async () => {
        vi.restoreAllMocks()
        await i18n.changeLanguage('en')
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
                if (body.objectCollectionId === sectionIds.Structure) return jsonResponse({ id: 'concept-created' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) return jsonResponse({ id: 'interpretation-created' }, 201)
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Structure') {
                return jsonResponse(
                    appData(
                        'Structure',
                        [],
                        [
                            { id: 'term-component', codename: 'Name', field: 'cmp-term-component', headerName: 'Name' },
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
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

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
        await user.type(within(dialog).getByLabelText('Name'), 'Working structure')
        await user.type(within(dialog).getByLabelText('Description'), 'Working structure description')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const rowCreateCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).endsWith('/runtime/rows?workspaceId=workspace-1')
            )
            expect(rowCreateCalls).toHaveLength(2)
            expect(JSON.parse(String(rowCreateCalls[0][1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Structure,
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
                        ParentStructure: 'concept-created',
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
            Name: index === 100 ? 'Second page structure' : `Structure ${index + 1}`
        }))
        const interpretations = concepts.map((concept, index) => ({
            id: `interpretation-${index + 1}`,
            Title: `${concept.Name} matrix`,
            ParentStructure: concept.id
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
            if (codename === 'Structure') {
                return jsonResponse(
                    appData(
                        'Structure',
                        paginate(concepts, url),
                        [
                            { id: 'term-component', codename: 'Name', field: 'Name', headerName: 'Name' },
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
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...independentRowsConfig,
            allowedMatrixViews: ['horizontalRows'],
            defaultMatrixView: 'horizontalRows'
        })

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(([input]) => {
                    const url = new URL(String(input), 'http://localhost:3000')
                    return url.searchParams.get('objectCollectionCodename') === 'Structure' && url.searchParams.get('offset') === '100'
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
        const structureCards = await screen.findByTestId('interpretation-network-structure-cards')
        expect(await within(structureCards).findByText('Second page structure')).toBeInTheDocument()
    }, 20_000)

    it('replaces the left structure list with the opened structure matrix and keeps materials on the right', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

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
        expect(within(structurePane).getByRole('tab', { name: 'Matrix' })).toHaveAttribute('aria-selected', 'true')
        expect(within(structurePane).getByRole('tabpanel')).toContainElement(
            within(structurePane).getByTestId('interpretation-network-matrix-workspace')
        )
        const toolbar = within(structurePane).getByTestId('interpretation-network-matrix-toolbar')
        const toolbarQueries = within(toolbar)
        expect(toolbarQueries.getByRole('button', { name: 'Add' })).toBeDisabled()
        expect(toolbarQueries.queryByRole('button', { name: 'Add cell in row' })).not.toBeInTheDocument()
        expect(toolbarQueries.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        await userEvent.click(within(structurePane).getAllByTestId('interpretation-network-cell')[0])
        expect(toolbarQueries.getByRole('button', { name: 'Add' })).toBeEnabled()
        expect(within(structurePane).queryByText('Meaning')).not.toBeInTheDocument()
        expect(within(structurePane).queryByText('Definition')).not.toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Existing structure' })).not.toBeInTheDocument()
        expect(within(detailsPane).queryByText('Create or select a structure on the left.', { exact: false })).not.toBeInTheDocument()
        expect(within(detailsPane).getByRole('heading', { name: 'Materials' })).toBeInTheDocument()
        expect(within(detailsPane).queryByTestId('interpretation-network-matrix-workspace')).not.toBeInTheDocument()
    }, 20_000)

    it('filters structures and opens them from the full card view', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

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

    it('offers standard structure actions in table and card views', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'PATCH' && url.pathname.endsWith('/runtime/rows/concept-1')) {
                return jsonResponse({ id: 'concept-1' })
            }
            if (init?.method === 'DELETE' && url.pathname.endsWith('/runtime/rows/concept-1')) {
                return new Response(null, { status: 204 })
            }
            if (init?.method === 'DELETE' && url.pathname.endsWith('/runtime/rows/interpretation-1')) {
                return new Response(null, { status: 204 })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        await user.click(await within(structurePane).findByRole('button', { name: 'Structure actions: Existing structure' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        const editDialog = await screen.findByRole('dialog', { name: 'Edit structure' })
        const nameInput = within(editDialog).getByLabelText('Name')
        await user.clear(nameInput)
        await user.type(nameInput, 'Renamed structure')
        await user.click(within(editDialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            const updateCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'PATCH' && String(input).includes('/runtime/rows/concept-1')
            )
            expect(updateCall).toBeDefined()
            expect(JSON.parse(String(updateCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Structure,
                    data: expect.objectContaining({ Name: 'Renamed structure' })
                })
            )
        })

        await user.click(within(structurePane).getByRole('button', { name: 'Card view' }))
        const cards = await within(structurePane).findByTestId('interpretation-network-structure-cards')
        await user.click(within(cards).getByRole('button', { name: 'Structure actions: Existing structure' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

        const deleteDialog = await screen.findByRole('dialog', { name: 'Delete structure?' })
        expect(
            within(deleteDialog).getByText(
                'Delete the structure “Existing structure”? Its matrix cells and linked materials will also be removed.'
            )
        ).toBeInTheDocument()
        expect(within(deleteDialog).queryByText('concept-1')).not.toBeInTheDocument()
        await user.click(within(deleteDialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(([input, init]) => init?.method === 'DELETE' && String(input).includes('/runtime/rows/concept-1'))
            ).toBe(true)
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'DELETE' && String(input).includes('/runtime/rows/interpretation-1')
                )
            ).toBe(true)
        })
        const deleteCalls = fetchMock.mock.calls
            .map(([input, init], index) => ({ input: String(input), method: init?.method, index }))
            .filter(({ method }) => method === 'DELETE')
        const structureDeleteIndex = deleteCalls.find(({ input }) => input.includes('/runtime/rows/concept-1'))?.index ?? -1
        const interpretationDeleteIndex = deleteCalls.find(({ input }) => input.includes('/runtime/rows/interpretation-1'))?.index ?? -1
        expect(interpretationDeleteIndex).toBeGreaterThanOrEqual(0)
        expect(structureDeleteIndex).toBeGreaterThanOrEqual(0)
        expect(interpretationDeleteIndex).toBeGreaterThan(structureDeleteIndex)
    }, 20_000)

    it('persists the opened structure in the URL and restores it after refresh', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Structure}`)
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        await user.click(within(structurePane).getByRole('button', { name: 'Existing structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Structure}/concept-1`)
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Structure}/concept-1`)
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
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Structure}/concept-1`)
        expect(window.location.pathname).not.toContain('/workspace-1/')
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Structure}/concept-1`)
    })

    it('opens the structure matrix from an initial structure URL segment', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Structure}/concept-1`)
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(within(structurePane).queryByRole('button', { name: 'Existing structure' })).not.toBeInTheDocument()
    })

    it('keeps hierarchical table cell selection in sync with the focused-cell route query', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableHierarchyRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Structure}`)
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        expect(await screen.findByRole('table', { name: 'Matrix table for Universe' })).toBeInTheDocument()
        await waitFor(() => {
            expect(window.location.search).toContain('matrixCell=root')
        })

        await user.click(screen.getByRole('button', { name: '1/1, Parent A' }))

        await waitFor(() => {
            expect(window.location.search).toContain('matrixCell=parent-a')
        })
        expect(navigate).toHaveBeenLastCalledWith(`/a/app-1/${sectionIds.Structure}/concept-1?matrixCell=parent-a`)
        expect(await screen.findByRole('table', { name: 'Matrix table for Universe' })).toBeInTheDocument()
        expect(screen.getByRole('rowheader', { name: /Parent A/ })).toBeInTheDocument()
        expect(screen.queryByText('Parent A', { selector: '[aria-current="page"]' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Cell actions: Universe' }))

        expect(await screen.findByRole('menuitem', { name: 'Add' })).toBeInTheDocument()
        expect(window.location.search).toContain('matrixCell=parent-a')
        expect(navigate).toHaveBeenLastCalledWith(`/a/app-1/${sectionIds.Structure}/concept-1?matrixCell=parent-a`)
        await user.keyboard('{Escape}')
        expect(screen.getByRole('rowheader', { name: /Parent A/ })).toBeInTheDocument()
    })

    it('hides system-managed row and column placement in the hierarchical table Add cell dialog', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableHierarchyRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, hierarchicalPathTableConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        await user.click(screen.getByRole('button', { name: '1/1, Parent A' }))
        await user.click(within(toolbar).getByRole('button', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByText('Placement')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Row')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Column')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Created automatically for the new cell.')).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('combobox', { name: 'Select row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('combobox', { name: 'Select column' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
        expect(within(dialog).getByRole('textbox', { name: /Title/i })).toBeInTheDocument()
        expect(within(dialog).getByRole('textbox', { name: /Description/i })).toBeInTheDocument()
    }, 20_000)

    it('reads the latest structure segment from nested URLs and replaces stale structure segments on navigation', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            const codename = url.searchParams.get('objectCollectionCodename')
            if (codename === 'Structure') {
                return jsonResponse(
                    appData(
                        'Structure',
                        [
                            { id: 'concept-1', Name: 'Existing structure' },
                            { id: 'concept-2', Name: 'Second structure' }
                        ],
                        [
                            { id: 'term-component', codename: 'Name', field: 'Name', headerName: 'Name' },
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
                            { id: 'interpretation-1', Title: 'Existing structure matrix', ParentStructure: 'concept-1' },
                            { id: 'interpretation-2', Title: 'Second structure matrix', ParentStructure: 'concept-2' }
                        ],
                        interpretationMatrixColumns()
                    )
                )
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        window.history.pushState({}, '', `/a/app-1/${sectionIds.Structure}/concept-old/concept-1`)
        const { navigate } = renderInterpretationNetworkWidget(fetchMock)

        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()

        await user.click(within(structurePane).getByRole('button', { name: 'Structures' }))
        await user.click(await within(structurePane).findByRole('button', { name: 'Second structure' }))

        expect(await within(structurePane).findByTestId('interpretation-network-matrix-workspace')).toBeInTheDocument()
        expect(window.location.pathname).toBe(`/a/app-1/${sectionIds.Structure}/concept-2`)
        expect(navigate).toHaveBeenCalledWith(`/a/app-1/${sectionIds.Structure}/concept-2`)
    })

    it('shows material creation guidance until a matrix cell is selected', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        expect(screen.getByText('Create or select a structure on the left.', { exact: false })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Materials' })).not.toBeInTheDocument()
        expect(
            within(screen.getByTestId('interpretation-network-details-pane')).queryByRole('button', { name: 'Create' })
        ).not.toBeInTheDocument()

        await clickSelectedMatrixCell(user)

        expect(screen.queryByText('Create or select a structure on the left.', { exact: false })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument()
        const detailsPane = screen.getByTestId('interpretation-network-details-pane')
        expect(within(detailsPane).getByRole('button', { name: 'Create' })).toBeEnabled()
        expect(within(detailsPane).getByRole('textbox', { name: 'Filter by title' })).toBeInTheDocument()
        expect(within(detailsPane).getByRole('button', { name: 'Table view' })).toBeInTheDocument()
        expect(within(detailsPane).getByRole('button', { name: 'Card view' })).toBeInTheDocument()
    })

    it('keeps hierarchical root creation owned by structure creation when a matrix is empty', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ items: [], total: 0 })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))

        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        expect(within(toolbar).getByRole('button', { name: 'Add' })).toBeDisabled()
        expect(within(toolbar).queryByRole('button', { name: 'Add cell' })).not.toBeInTheDocument()
        expect(screen.getByText('Create a structure again to restore its root matrix cell.')).toBeInTheDocument()
    })

    it('renders hierarchical cells as horizontal rows with position numbers and runtime view toggles', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({
                    items: [
                        { id: 'row-root', CellId: 'root', CellValue: 'Universe', _tp_sort_order: 0 },
                        { id: 'row-child-a', CellId: 'child-a', ParentCellId: 'root', CellValue: 'Child A', _tp_sort_order: 0 },
                        { id: 'row-child-b', CellId: 'child-b', ParentCellId: 'root', CellValue: 'Child B', _tp_sort_order: 1 }
                    ],
                    total: 3
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        let rows = await within(structurePane).findAllByTestId('interpretation-network-matrix-row')

        expect(rows).toHaveLength(2)
        expect(within(rows[0]).getByText('Universe')).toBeInTheDocument()
        expect(within(rows[1]).getByText('Child A')).toBeInTheDocument()
        expect(within(rows[1]).getByText('Child B')).toBeInTheDocument()
        await user.click(within(rows[0]).getByText('Universe'))
        rows = await within(structurePane).findAllByTestId('interpretation-network-matrix-row')
        expect(rows).toHaveLength(2)
        expect(within(rows[1]).getByText('Child A')).toBeInTheDocument()
        expect(within(rows[1]).getByText('Child B')).toBeInTheDocument()
        expect(rows[1]).toHaveStyle({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' })
        expect(rows[1]).toHaveStyle({ minWidth: '0' })
        const toolbar = within(structurePane).getByTestId('interpretation-network-matrix-toolbar')
        const horizontalRowsButton = within(toolbar).getByRole('button', { name: 'Horizontal rows' })
        const matrixAddButton = within(toolbar).getByRole('button', { name: 'Add' })
        expect(horizontalRowsButton).toHaveAttribute('aria-pressed', 'true')
        expect(horizontalRowsButton).toHaveClass('Mui-selected')
        expect(horizontalRowsButton).toHaveStyle({ height: '40px' })
        expect(horizontalRowsButton).toHaveStyle({ width: '40px' })
        expect(matrixAddButton).not.toHaveClass('MuiButton-sizeSmall')
        expect(matrixAddButton).toHaveStyle({ minHeight: '40px' })
        expect(
            within(structurePane)
                .getAllByTestId('interpretation-network-cell-position')
                .map((item) => item.textContent)
        ).toEqual(['1', '1/1', '1/2'])
        expect(
            within(structurePane)
                .getAllByTestId('interpretation-network-cell-title')
                .every((item) => item.getAttribute('data-position-label-overlay') === 'true')
        ).toBe(true)
        const title = within(structurePane).getAllByTestId('interpretation-network-cell-title')[0]
        const titleText = within(title).getByText('Universe')
        const positionLabel = within(structurePane).getAllByTestId('interpretation-network-cell-position')[0]
        expect(title).toHaveStyle({ justifyContent: 'center', alignItems: 'center' })
        expect(titleText).toHaveStyle({
            width: 'fit-content',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left'
        })
        vi.spyOn(title, 'getBoundingClientRect').mockReturnValue({
            x: 60,
            y: 20,
            top: 20,
            left: 60,
            bottom: 84,
            right: 260,
            width: 200,
            height: 64,
            toJSON: () => ({})
        } as DOMRect)
        vi.spyOn(positionLabel, 'getBoundingClientRect').mockReturnValue({
            x: 32,
            y: 4,
            top: 4,
            left: 32,
            bottom: 24,
            right: 56,
            width: 24,
            height: 20,
            toJSON: () => ({})
        } as DOMRect)
        const titleRect = title.getBoundingClientRect()
        const labelRect = positionLabel.getBoundingClientRect()
        expect(Math.abs(titleRect.top + titleRect.height / 2 - 52)).toBeLessThanOrEqual(1)
        expect(labelRect.right).toBeLessThan(titleRect.left)
        expect(labelRect.right).toBeLessThan(titleRect.right - 28)

        await user.click(within(structurePane).getByRole('button', { name: 'Vertical tree' }))

        expect(within(structurePane).getByRole('button', { name: 'Vertical tree' })).toHaveAttribute('aria-pressed', 'true')
        expect(await within(structurePane).findAllByTestId('interpretation-network-matrix-row')).toHaveLength(3)
    }, 20_000)

    it('opens the configured Matrix Table display with semantic headers and accessible cell controls', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'independentAxes'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const toolbar = within(structurePane).getByTestId('interpretation-network-matrix-toolbar')

        expect(within(toolbar).getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(toolbar).getByRole('button', { name: 'Table view' })).toHaveClass('Mui-selected')
        expect(within(toolbar).getByRole('button', { name: 'Horizontal rows' })).toHaveStyle({ height: '40px' })
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })
        expect(table.closest('[data-testid="interpretation-network-matrix-table"]')).toHaveAttribute('tabindex', '0')
        expect(within(table).getByRole('columnheader', { name: 'Rows' })).toBeInTheDocument()
        expect(within(table).getByRole('columnheader', { name: 'Meaning' })).toBeInTheDocument()
        expect(within(table).getByRole('columnheader', { name: 'Source' })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: 'Definition' })).toBeInTheDocument()
        expect(within(table).getByRole('rowheader', { name: 'Example' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' })).toHaveAttribute(
            'aria-pressed',
            'false'
        )
        expect(within(table).getByRole('button', { name: 'Example, Source, 2, Other cell value' })).toBeInTheDocument()
        expect(within(table).getByText('1 material')).toBeInTheDocument()
        expect(within(table).getByRole('cell', { name: 'Empty intersection: Example, Meaning' })).toBeInTheDocument()
        expect(table).not.toHaveTextContent('cell-selected')
        expect(table).not.toHaveTextContent('matrix-row-selected')

        await user.click(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        expect(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' })).toHaveAttribute(
            'aria-pressed',
            'true'
        )
        expect(within(table).getByRole('cell', { name: 'Empty intersection: Example, Meaning' })).toHaveAttribute(
            'data-empty-drop-enabled',
            'true'
        )
        expect(within(table).queryByRole('button', { name: 'Add cell at Example, Meaning' })).not.toBeInTheDocument()
        expect(
            within(screen.getByTestId('interpretation-network-details-pane')).getByRole('heading', { name: 'Materials' })
        ).toBeInTheDocument()

        await user.click(within(toolbar).getByRole('button', { name: 'Horizontal rows' }))
        expect(await within(structurePane).findAllByTestId('interpretation-network-matrix-row')).toHaveLength(1)
        expect(within(toolbar).getByRole('button', { name: 'Horizontal rows' })).toHaveAttribute('aria-pressed', 'true')
        expect(within(toolbar).getByRole('button', { name: 'Vertical tree' })).toBeInTheDocument()
    }, 20_000)

    it('keeps empty Matrix Table intersections as drop targets without extra add buttons', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })

        const emptyIntersection = within(table).getByRole('cell', { name: 'Empty intersection: Example, Meaning' })
        expect(emptyIntersection).toHaveAttribute('data-empty-drop-enabled', 'true')
        expect(within(table).queryByRole('button', { name: 'Add cell at Example, Meaning' })).not.toBeInTheDocument()

        await user.click(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))

        expect(within(table).getByRole('button', { name: 'Add row' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add column' })).toBeEnabled()
    }, 20_000)

    it('keeps damaged duplicate table coordinate rows visible while disabling ambiguous empty drops', async () => {
        const user = userEvent.setup()
        const duplicatedCoordinateFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    fixture.items[0],
                    {
                        ...fixture.items[1],
                        id: 'matrix-row-duplicate',
                        CellId: 'cell-duplicate',
                        RowKey: 'definition',
                        RowLabel: 'Definition',
                        ColKey: 'meaning',
                        ColLabel: 'Meaning',
                        CellValue: 'Duplicate coordinate value'
                    },
                    {
                        ...fixture.items[1],
                        id: 'matrix-row-source-column',
                        CellId: 'cell-source-column',
                        RowKey: 'source-row',
                        RowLabel: 'Source row',
                        ColKey: 'source',
                        ColLabel: 'Source',
                        CellValue: 'Source column value'
                    }
                ],
                total: 3
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(duplicatedCoordinateFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const table = await within(await screen.findByTestId('interpretation-network-structure-pane')).findByRole('table', {
            name: 'Matrix table'
        })

        expect(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Definition, Meaning, 2, Duplicate coordinate value' })).toBeInTheDocument()
        const emptyDefinitionSourceCells = within(table).getAllByRole('cell', { name: 'Empty intersection: Definition, Source' })
        expect(emptyDefinitionSourceCells).toHaveLength(2)
        expect(emptyDefinitionSourceCells.map((cell) => cell.getAttribute('data-empty-drop-enabled'))).toEqual(['true', 'false'])
    }, 20_000)

    it('keeps Table cells selectable while disabling mutations for read-only users', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            { createContent: false, editContent: false, deleteContent: false },
            undefined,
            {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                tableProjection: 'independentAxes'
            }
        )

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })
        const cellButton = within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' })

        expect(cellButton).toBeEnabled()
        expect(within(table).getAllByRole('button', { name: 'Drag cell' })).toHaveLength(2)
        within(table)
            .getAllByRole('button', { name: 'Drag cell' })
            .forEach((dragButton) => expect(dragButton).toBeDisabled())
        expect(within(table).getByRole('button', { name: 'Cell actions: Selected cell value' })).toBeEnabled()

        await user.click(cellButton)

        expect(cellButton).toHaveAttribute('aria-pressed', 'true')
        expect(
            within(screen.getByTestId('interpretation-network-details-pane')).getByRole('heading', { name: 'Materials' })
        ).toBeInTheDocument()
    }, 20_000)

    it('shows complete explicit Table axes while focused-path navigation remains a tree-view concern', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableHierarchyRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'independentAxes',
            hierarchyRowMode: 'focusedPath'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })

        expect(within(table).getByRole('button', { name: 'Root row, Root column, 1, Universe' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Parent A row, Parent A column, 1/1, Parent A' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Parent B row, Parent B column, 1/2, Parent B' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Child A1 row, Child A1 column, 1/1/1, Child A1' })).toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Child B1 row, Child B1 column, 1/2/1, Child B1' })).toBeInTheDocument()
    }, 20_000)

    it('uses one Matrix toolbar Add action and in-table axis add buttons in table mode', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableHierarchyRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'independentAxes'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        const table = await screen.findByRole('table', { name: 'Matrix table' })

        expect(within(toolbar).getByRole('button', { name: 'Add' })).toBeEnabled()
        expect(within(toolbar).queryByRole('button', { name: 'Add root cell' })).not.toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: 'Add cell in row' })).not.toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: 'Add cell' })).not.toBeInTheDocument()
        expect(within(table).getByRole('button', { name: 'Add row' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add column' })).toBeEnabled()

        await user.click(within(table).getByRole('button', { name: 'Root row, Root column, 1, Universe' }))

        expect(within(toolbar).getByRole('button', { name: 'Add' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add row' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add column' })).toBeEnabled()
    }, 20_000)

    it('shows children only for the selected horizontal hierarchy path', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({
                    items: [
                        { id: 'row-root', CellId: 'root', CellValue: 'Universe', _tp_sort_order: 0 },
                        { id: 'row-parent-a', CellId: 'parent-a', ParentCellId: 'root', CellValue: 'Parent A', _tp_sort_order: 0 },
                        { id: 'row-parent-b', CellId: 'parent-b', ParentCellId: 'root', CellValue: 'Parent B', _tp_sort_order: 1 },
                        { id: 'row-child-a1', CellId: 'child-a1', ParentCellId: 'parent-a', CellValue: 'Child A1', _tp_sort_order: 0 },
                        { id: 'row-child-a2', CellId: 'child-a2', ParentCellId: 'parent-a', CellValue: 'Child A2', _tp_sort_order: 1 },
                        { id: 'row-child-b1', CellId: 'child-b1', ParentCellId: 'parent-b', CellValue: 'Child B1', _tp_sort_order: 0 },
                        { id: 'row-child-b2', CellId: 'child-b2', ParentCellId: 'parent-b', CellValue: 'Child B2', _tp_sort_order: 1 }
                    ],
                    total: 7
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')

        expect(within(structurePane).getByText('Universe')).toBeInTheDocument()
        expect(await within(structurePane).findByText('Parent A')).toBeInTheDocument()
        expect(within(structurePane).getByText('Parent B')).toBeInTheDocument()
        expect(within(structurePane).queryByText('Child A1')).not.toBeInTheDocument()
        expect(within(structurePane).queryByText('Child B1')).not.toBeInTheDocument()

        await user.click(within(structurePane).getByText('Parent A'))

        expect(await within(structurePane).findByText('Child A1')).toBeInTheDocument()
        expect(within(structurePane).getByText('Child A2')).toBeInTheDocument()
        expect(within(structurePane).queryByText('Child B1')).not.toBeInTheDocument()
        expect(within(structurePane).queryByText('Child B2')).not.toBeInTheDocument()

        await user.click(within(structurePane).getByText('Parent B'))

        expect(await within(structurePane).findByText('Child B1')).toBeInTheDocument()
        expect(within(structurePane).getByText('Child B2')).toBeInTheDocument()
        expect(within(structurePane).queryByText('Child A1')).not.toBeInTheDocument()
        expect(within(structurePane).queryByText('Child A2')).not.toBeInTheDocument()
    }, 20_000)

    it('shows a sanitized matrix load error and disables matrix mutations', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ message: 'database relation internal_table_123 failed' }, 500)
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        expect(await screen.findByText('Failed to load matrix cells')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Add cell in row' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(screen.queryByText(/internal_table_123/i)).not.toBeInTheDocument()
    })

    it('disables authoring controls when the current role cannot mutate content', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            { createContent: false, editContent: false, deleteContent: false },
            undefined,
            independentAxesTableConfig
        )

        expect(
            await screen.findByText('You can view this workspace, but content editing is not available for your role.')
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Add page' })).not.toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Existing structure' }))
        expect(await screen.findByRole('button', { name: 'Add' })).toBeDisabled()

        await clickSelectedMatrixCell(user)
        expect(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' })).toBeDisabled()
        expect(screen.queryByRole('button', { name: 'Edit material' })).not.toBeInTheDocument()
    })

    it('allows editor structure creation without delete permission', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            { createContent: true, editContent: true, deleteContent: false },
            undefined,
            independentAxesTableConfig
        )

        expect(
            screen.queryByText('You can view this workspace, but content editing is not available for your role.')
        ).not.toBeInTheDocument()
        expect(await screen.findByRole('button', { name: 'Create' })).toBeEnabled()
    })

    it('does not offer material creation when the role cannot link it to the selected cell', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            { createContent: true, editContent: false, deleteContent: false },
            undefined,
            independentAxesTableConfig
        )

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await clickSelectedMatrixCell(user)

        expect(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' })).toBeDisabled()
        expect(fetchMock.mock.calls.some(([input, init]) => init?.method === 'POST' && String(input).includes('/runtime/rows'))).toBe(false)
    })

    it('compensates a created structure when atomic interpretation creation fails', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                const body = JSON.parse(String(init.body ?? '{}'))
                if (body.objectCollectionId === sectionIds.Structure) return jsonResponse({ id: 'concept-created' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) {
                    return jsonResponse({ message: 'failed atomic interpretation create' }, 500)
                }
            }
            if (init?.method === 'DELETE' && url.pathname.endsWith('/runtime/rows/concept-created')) {
                return new Response(null, { status: 204 })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), { createContent: true, editContent: true, deleteContent: true }, undefined, {
            matrixMode: 'independentRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Create' }))
        const dialog = await screen.findByRole('dialog', { name: 'Create structure' })
        await user.type(within(dialog).getByLabelText('Name'), 'Rollback structure')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const compensationCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/runtime/rows/concept-created/compensate-create')
            )
            expect(compensationCall).toBeDefined()
            expect(JSON.parse(String(compensationCall?.[1]?.body ?? '{}'))).toEqual({
                expectedVersion: 1,
                objectCollectionId: sectionIds.Structure
            })
        })
        expect(await screen.findAllByText('Failed to create structure')).toHaveLength(2)
    }, 20_000)

    it('creates the initial matrix row atomically with the new interpretation', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                const body = JSON.parse(String(init.body ?? '{}'))
                if (body.objectCollectionId === sectionIds.Structure) return jsonResponse({ id: 'concept-created-2' }, 201)
                if (body.objectCollectionId === sectionIds.Interpretation) return jsonResponse({ id: 'interpretation-created-2' }, 201)
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse(
                    {
                        id: 'matrix-root-created',
                        status: 'created',
                        item: {
                            id: 'matrix-root-created',
                            CellId: '018f8a78-7b8f-7c1d-a111-222233334630',
                            CellValue: 'Universe'
                        }
                    },
                    201
                )
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Structure') {
                return jsonResponse(defaultRuntimeResponse(url))
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Interpretation') {
                return jsonResponse(defaultRuntimeResponse(url))
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), { createContent: true, editContent: true, deleteContent: true }, undefined, {
            matrixMode: 'independentRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Create' }))
        const dialog = await screen.findByRole('dialog', { name: 'Create structure' })
        await user.type(within(dialog).getByLabelText('Name'), 'Source structure')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const interpretationCall = fetchMock.mock.calls.find(([input, init]) => {
                if (init?.method !== 'POST' || !String(input).endsWith('/runtime/rows?workspaceId=workspace-1')) return false
                return JSON.parse(String(init.body ?? '{}')).objectCollectionId === sectionIds.Interpretation
            })
            expect(interpretationCall).toBeDefined()
            expect(JSON.parse(String(interpretationCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        ParentStructure: 'concept-created-2'
                    })
                })
            )
            const rootCreateCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(rootCreateCall).toBeDefined()
            const rootCreateBody = JSON.parse(String(rootCreateCall?.[1]?.body ?? '{}'))
            expect(rootCreateBody).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                        RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                        CellValue: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'Universe' }),
                                ru: expect.objectContaining({ content: 'Вселенная' })
                            })
                        })
                    })
                })
            )
            expect(rootCreateBody.data).not.toHaveProperty('CellId')
        })
    }, 20_000)

    it('reports matrix move failure from the atomic batch endpoint without issuing partial row patches', async () => {
        const user = userEvent.setup()
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
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Down' }))

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
    }, 20_000)

    it('moves selected cells through the card action menu', async () => {
        const user = userEvent.setup()
        let matrixMoved = false
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                matrixMoved = true
                return jsonResponse({ status: 'ok', updated: ['matrix-row-selected'] })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                const fixture = matrixRowsFixture()
                if (!matrixMoved) return jsonResponse(fixture)
                return jsonResponse({
                    ...fixture,
                    items: [
                        {
                            ...fixture.items[0],
                            RowKey: 'example',
                            RowLabel: 'Example'
                        },
                        fixture.items[1]
                    ]
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        expect(screen.queryByRole('menuitem', { name: 'Left' })).not.toBeInTheDocument()
        expect(screen.queryByRole('menuitem', { name: 'Up' })).not.toBeInTheDocument()
        await user.click(await screen.findByRole('menuitem', { name: 'Down' }))

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            const body = JSON.parse(String(batchCalls[0][1]?.body ?? '{}'))
            expect(body).toEqual(
                expect.objectContaining({
                    updates: expect.arrayContaining([
                        expect.objectContaining({
                            childRowId: 'matrix-row-selected',
                            expectedVersion: 7,
                            data: expect.objectContaining({
                                CellId: 'cell-selected',
                                RowKey: 'example',
                                _tp_sort_order: 1,
                                CellValue: 'Selected cell value',
                                CellDescription: 'Selected cell description',
                                CellFillColor: 'blue',
                                MaterialRef: 'material-selected'
                            })
                        }),
                        { childRowId: 'matrix-row-other', expectedVersion: 9, data: { _tp_sort_order: 0 } }
                    ])
                })
            )
            expect(body.updates[0].data.ColKey).toMatch(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i)
            expect(body.updates[0].data.ColLabel.locales.en.content).toBe('Meaning 2')
            expect(body.updates).toHaveLength(2)
        })
        await waitFor(() => expect(screen.getByTestId('interpretation-network-details-pane')).toHaveTextContent('Selected material'))
    }, 20_000)

    it('keeps table axis creation controls available before a table cell is selected', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        const table = await screen.findByRole('table', { name: 'Matrix table' })

        expect(within(toolbar).getByRole('button', { name: 'Add' })).toBeDisabled()
        expect(within(toolbar).queryByRole('button', { name: 'Add row' })).not.toBeInTheDocument()
        expect(within(toolbar).queryByRole('button', { name: 'Add cell in row' })).not.toBeInTheDocument()
        const addRowButton = within(table).getByRole('button', { name: 'Add row' })
        const addColumnButton = within(table).getByRole('button', { name: 'Add column' })
        expect(addRowButton).toBeEnabled()
        expect(addColumnButton).toBeEnabled()

        await user.click(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))

        expect(within(toolbar).getByRole('button', { name: 'Add' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add row' })).toBeEnabled()
        expect(within(table).getByRole('button', { name: 'Add column' })).toBeEnabled()
    })

    it('keeps the standalone cell dialog fail-closed for new row and column creation by default', async () => {
        render(
            <QueryClientProvider client={createQueryClient()}>
                <CellEditDialog
                    open
                    mode='create'
                    t={i18n.getFixedT('en', 'interpretationNetwork')}
                    locale='en'
                    fields={interpretationMatrixColumns()[2].childColumns}
                    styleFields={[]}
                    initialData={{}}
                    axisOptions={{
                        rows: [{ key: 'definition', label: 'Definition' }],
                        columns: [{ key: 'meaning', label: 'Meaning' }]
                    }}
                    isSubmitting={false}
                    onClose={vi.fn()}
                    onSubmit={vi.fn()}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByRole('radio', { name: 'New row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New column' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /New row name/i })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /New column name/i })).not.toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Select row' })).toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Select column' })).toBeInTheDocument()
    })

    it('requires an edited cell title even when the style tab is active', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(
            <QueryClientProvider client={createQueryClient()}>
                <CellEditDialog
                    open
                    mode='edit'
                    t={i18n.getFixedT('en', 'interpretationNetwork')}
                    locale='en'
                    fields={interpretationMatrixColumns()[2].childColumns}
                    styleFields={[interpretationMatrixColumns()[2].childColumns[1]]}
                    initialData={{
                        'child-row': 'Definition',
                        'child-col': 'Meaning',
                        'child-value': 'Editable title',
                        'child-fill': 'blue'
                    }}
                    isSubmitting={false}
                    onClose={vi.fn()}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        await user.clear(titleField)
        await user.click(within(dialog).getByRole('tab', { name: 'Style' }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        expect(onSubmit).not.toHaveBeenCalled()
        expect(await within(dialog).findByRole('textbox', { name: /Title/i })).toHaveAccessibleDescription('This field is required.')
        expect(within(dialog).getByRole('tab', { name: 'Basic' })).toHaveAttribute('aria-selected', 'true')
    })

    it('requires edited row and column labels before saving an existing cell', async () => {
        const user = userEvent.setup()
        const onSubmit = vi.fn()
        render(
            <QueryClientProvider client={createQueryClient()}>
                <CellEditDialog
                    open
                    mode='edit'
                    t={i18n.getFixedT('en', 'interpretationNetwork')}
                    locale='en'
                    fields={interpretationMatrixColumns()[2].childColumns}
                    styleFields={[]}
                    initialData={{
                        'child-row': 'Definition',
                        'child-col': 'Meaning',
                        'child-value': 'Editable title'
                    }}
                    isSubmitting={false}
                    onClose={vi.fn()}
                    onSubmit={onSubmit}
                />
            </QueryClientProvider>
        )

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        await user.clear(within(dialog).getByRole('textbox', { name: /Row label/i }))
        await user.clear(within(dialog).getByRole('textbox', { name: /Column label/i }))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        expect(onSubmit).not.toHaveBeenCalled()
        expect(await within(dialog).findByRole('textbox', { name: /Row label/i })).toHaveAccessibleDescription('This field is required.')
        expect(within(dialog).getByRole('textbox', { name: /Column label/i })).toHaveAccessibleDescription('This field is required.')
    })

    it('creates a new table column from the dedicated table plus dialog', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-column-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })
        await user.click(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(within(table).getByRole('button', { name: 'Add column' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add column' })
        expect(within(dialog).getByRole('textbox', { name: /Column name/i })).toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Existing row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New column' })).not.toBeInTheDocument()
        expect(within(dialog).queryByText('RowKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('ColKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('_tp_sort_order')).not.toBeInTheDocument()

        await user.type(within(dialog).getByRole('textbox', { name: /Column name/i }), 'New meaning')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    RowKey: 'definition',
                    RowLabel: 'Definition',
                    ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    ColLabel: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'New meaning' })
                        })
                    }),
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'New meaning' })
                        })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
            expect(body.data.ParentCellId).toBeNull()
        })
    }, 20_000)

    it('creates a new table row from the dedicated table plus dialog', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-row-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const structurePane = await screen.findByTestId('interpretation-network-structure-pane')
        const table = await within(structurePane).findByRole('table', { name: 'Matrix table' })
        await user.click(within(table).getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(within(table).getByRole('button', { name: 'Add row' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add row' })
        expect(within(dialog).getByRole('textbox', { name: /Row name/i })).toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Existing column' })).not.toBeInTheDocument()
        expect(within(dialog).queryByText('RowKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('ColKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('_tp_sort_order')).not.toBeInTheDocument()

        await user.type(within(dialog).getByRole('textbox', { name: /Row name/i }), 'New definition')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    RowLabel: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'New definition' })
                        })
                    }),
                    ColKey: 'meaning',
                    ColLabel: 'Meaning',
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'New definition' })
                        })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
            expect(body.data.ParentCellId).toBeNull()
        })
    }, 20_000)

    it('hides new row and column options in the regular Add cell dialog by default', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        await user.click(screen.getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(within(toolbar).getByRole('button', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByRole('radio', { name: 'New row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New column' })).not.toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Select row' })).toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Select column' })).toBeInTheDocument()
        expect(within(dialog).queryByText('RowKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('ColKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('_tp_sort_order')).not.toBeInTheDocument()
    }, 20_000)

    it('creates a hierarchical child cell when inline axis creation is hidden by default', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-child-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(screen.getByRole('button', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByRole('radio', { name: 'New row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New column' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /New row name/i })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: /New column name/i })).not.toBeInTheDocument()
        await user.type(within(dialog).getByRole('textbox', { name: /Title/i }), 'Child from default add')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    ParentCellId: 'cell-selected',
                    RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    RowLabel: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Child from default add' })
                        })
                    }),
                    ColLabel: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Child from default add' })
                        })
                    }),
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Child from default add' })
                        })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
        })
    }, 20_000)

    it('adds a new independent horizontal row after a cell is selected when inline axis creation is disabled', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-row-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['horizontalRows'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        const addButton = within(toolbar).getByRole('button', { name: 'Add' })
        expect(addButton).toBeDisabled()
        expect(within(toolbar).getByRole('button', { name: 'Add row' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        const addRowButton = within(toolbar).getByRole('button', { name: 'Add row' })
        expect(addRowButton).toBeEnabled()
        await user.click(addRowButton)

        const dialog = await screen.findByRole('dialog', { name: 'Add row' })
        await user.type(within(dialog).getByRole('textbox', { name: /Row name/i }), 'Evidence')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    RowLabel: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Evidence' })
                        })
                    }),
                    ColKey: 'meaning',
                    ColLabel: 'Meaning',
                    ParentCellId: null,
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Evidence' })
                        })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
        })
    }, 20_000)

    it('allows seeding an empty independent matrix when inline axis creation is disabled', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-seed-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse({ items: [], total: 0 })
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['horizontalRows'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        const addButton = within(toolbar).getByRole('button', { name: 'Add' })
        expect(addButton).toBeEnabled()
        await user.click(addButton)

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).queryByRole('radio', { name: 'New row' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'New column' })).not.toBeInTheDocument()
        await user.type(within(dialog).getByRole('textbox', { name: /Title/i }), 'First matrix cell')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    ParentCellId: null,
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'First matrix cell' })
                        })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
        })
    }, 20_000)

    it('creates a new standalone Matrix Table cell with new row and column labels when enabled', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-row-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'independentRows',
            allowedMatrixViews: ['table', 'horizontalRows'],
            defaultMatrixView: 'table',
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        await user.click(within(toolbar).getByRole('button', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        expect(within(dialog).getByRole('radio', { name: 'New row' })).toBeChecked()
        expect(within(dialog).getByRole('radio', { name: 'New column' })).toBeChecked()
        expect(within(dialog).queryByText('RowKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('ColKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('_tp_sort_order')).not.toBeInTheDocument()

        fireEvent.change(within(dialog).getByRole('textbox', { name: /New row name/i }), { target: { value: 'New row' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /New column name/i }), { target: { value: 'New column' } })
        fireEvent.change(within(dialog).getByRole('textbox', { name: /Title/i }), { target: { value: 'New table cell' } })
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body.data).toEqual(
                expect.objectContaining({
                    RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                    RowLabel: expect.objectContaining({
                        locales: expect.objectContaining({ en: expect.objectContaining({ content: 'New row' }) })
                    }),
                    ColLabel: expect.objectContaining({
                        locales: expect.objectContaining({ en: expect.objectContaining({ content: 'New column' }) })
                    }),
                    CellValue: expect.objectContaining({
                        locales: expect.objectContaining({ en: expect.objectContaining({ content: 'New table cell' }) })
                    })
                })
            )
            expect(body.data.CellId).toMatch(UUID_V7_REGEX)
            expect(body.data.ParentCellId).toBeNull()
        })
    }, 20_000)

    it('renders localized Matrix Table placement controls in Russian', async () => {
        const user = userEvent.setup()
        await i18n.changeLanguage('ru')
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            defaultPermissions,
            undefined,
            {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table'
            },
            'ru'
        )

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        await user.click(screen.getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(within(toolbar).getByRole('button', { name: 'Добавить' }))

        const dialog = await screen.findByRole('dialog', { name: 'Добавить ячейку' })
        expect(within(dialog).getByText('Размещение')).toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Существующая строка' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Новая строка' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Существующая колонка' })).not.toBeInTheDocument()
        expect(within(dialog).queryByRole('radio', { name: 'Новая колонка' })).not.toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Выберите строку' })).toBeInTheDocument()
        expect(within(dialog).getByRole('combobox', { name: 'Выберите колонку' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Создать' })).toBeInTheDocument()
        expect(within(dialog).queryByText('RowKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('ColKey')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('_tp_sort_order')).not.toBeInTheDocument()
    }, 20_000)

    it('shows localized Russian validation for required Matrix Table create fields', async () => {
        const user = userEvent.setup()
        await i18n.changeLanguage('ru')
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixTableRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(
            fetchMock,
            vi.fn(),
            defaultPermissions,
            undefined,
            {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['table', 'horizontalRows'],
                defaultMatrixView: 'table'
            },
            'ru'
        )

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const toolbar = await screen.findByTestId('interpretation-network-matrix-toolbar')
        await user.click(screen.getByRole('button', { name: 'Definition, Meaning, 1, Selected cell value' }))
        await user.click(within(toolbar).getByRole('button', { name: 'Добавить' }))
        const dialog = await screen.findByRole('dialog', { name: 'Добавить ячейку' })
        await user.click(within(dialog).getByRole('button', { name: 'Создать' }))

        expect(await within(dialog).findAllByText('Заполните это поле.')).toHaveLength(1)
        expect(within(dialog).queryByText('This field is required.')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Select an existing row.')).not.toBeInTheDocument()
        expect(within(dialog).queryByText('Select an existing column.')).not.toBeInTheDocument()
    }, 20_000)

    it('creates a hierarchical child cell from the card action menu', async () => {
        const user = userEvent.setup()
        const serverCellId = '018f8a78-7b8f-7c1d-a111-222233334620'
        let created = false
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                return jsonResponse({ id: 'material-created' }, 201)
            }
            if (init?.method === 'PATCH' && url.pathname.endsWith('/tabular/matrix-component/matrix-row-server-created')) {
                return jsonResponse({ id: 'matrix-row-server-created' })
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                created = true
                return jsonResponse(
                    {
                        id: 'matrix-row-server-created',
                        status: 'created',
                        item: { id: 'matrix-row-server-created', _upl_version: 1, CellId: serverCellId }
                    },
                    201
                )
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                const fixture = matrixRowsFixture()
                if (created) {
                    fixture.items.push({
                        id: 'matrix-row-server-created',
                        _upl_version: 1,
                        CellId: serverCellId,
                        ParentCellId: 'cell-selected',
                        RowKey: 'child-row',
                        RowLabel: 'Child row',
                        ColKey: 'child-column',
                        ColLabel: 'Child column',
                        CellValue: 'Child from menu',
                        CellDescription: 'Child created through the cell actions menu',
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
                    })
                    fixture.total += 1
                }
                return jsonResponse(fixture)
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        const rowLabelField = within(dialog).getByRole('textbox', { name: /New row name/i })
        const columnLabelField = within(dialog).getByRole('textbox', { name: /New column name/i })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        const descriptionField = within(dialog).getByRole('textbox', { name: /Description/i })
        await user.clear(rowLabelField)
        await user.type(rowLabelField, 'Child row')
        await user.clear(columnLabelField)
        await user.type(columnLabelField, 'Child column')
        await user.clear(titleField)
        await user.type(titleField, 'Child from menu')
        await user.clear(descriptionField)
        await user.type(descriptionField, 'Child created through the cell actions menu')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            const body = JSON.parse(String(createCall?.[1]?.body ?? '{}'))
            expect(body).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        CellId: expect.stringMatching(UUID_V7_REGEX),
                        ParentCellId: 'cell-selected',
                        RowKey: expect.stringMatching(/^row-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                        ColKey: expect.stringMatching(/^column-[0-9a-f]{8}-[0-9a-f]{4}-7/i),
                        _tp_sort_order: 0,
                        CellValue: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Child from menu' }) })
                        }),
                        CellDescription: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'Child created through the cell actions menu' })
                            })
                        })
                    })
                })
            )
        })
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add cell' })).not.toBeInTheDocument())
        await user.click(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' }))
        await user.type(await screen.findByLabelText('Title'), 'Material for server cell')
        await user.click(screen.getByRole('button', { name: 'Create' }))
        await waitFor(() => {
            const materialCreateCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).endsWith('/runtime/rows?workspaceId=workspace-1')
            )
            expect(materialCreateCall).toBeDefined()
            expect(JSON.parse(String(materialCreateCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    objectCollectionId: sectionIds.Material,
                    data: expect.objectContaining({ CellId: serverCellId })
                })
            )
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) =>
                        init?.method === 'PATCH' && String(input).includes('/tabular/matrix-component/matrix-row-server-created')
                )
            ).toBe(true)
        })
    }, 35_000)

    it('keeps a deep focused hierarchy expanded while a newly created child is refetched', async () => {
        const user = userEvent.setup()
        const createdCellId = '018f8a78-7b8f-7c1d-a111-222233334621'
        let created = false
        let matrixReadCount = 0
        let releaseCreatedRows: (() => void) | undefined
        const createdRowsReady = new Promise<void>((resolve) => {
            releaseCreatedRows = resolve
        })
        const deepFixture = () => {
            const fixture = matrixRowsFixture()
            const root = {
                ...fixture.items[0],
                id: 'matrix-row-root',
                CellId: 'cell-root',
                ParentCellId: null,
                CellValue: 'Universe',
                _tp_sort_order: 0
            }
            const levelOne = {
                ...fixture.items[1],
                id: 'matrix-row-level-one',
                CellId: 'cell-level-one',
                ParentCellId: 'cell-root',
                CellValue: 'Level one',
                _tp_sort_order: 0
            }
            const levelTwo = {
                ...fixture.items[1],
                id: 'matrix-row-level-two',
                CellId: 'cell-level-two',
                ParentCellId: 'cell-level-one',
                CellValue: 'Level two',
                _tp_sort_order: 0
            }
            return {
                ...fixture,
                items: [
                    root,
                    levelOne,
                    levelTwo,
                    ...(created
                        ? [
                              {
                                  ...fixture.items[1],
                                  id: 'matrix-row-created-child',
                                  CellId: createdCellId,
                                  ParentCellId: 'cell-level-two',
                                  CellValue: 'Level three',
                                  _tp_sort_order: 0
                              }
                          ]
                        : [])
                ],
                total: created ? 4 : 3
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                created = true
                return jsonResponse(
                    {
                        id: 'matrix-row-created-child',
                        item: { id: 'matrix-row-created-child', CellId: createdCellId }
                    },
                    201
                )
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                matrixReadCount += 1
                if (matrixReadCount > 1) await createdRowsReady
                return jsonResponse(deepFixture())
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await user.click(await screen.findByText('Universe'))
        await user.click(await screen.findByText('Level one'))
        await user.click(await screen.findByText('Level two'))
        await user.click(screen.getByRole('button', { name: 'Cell actions: Level two' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        const rowLabelField = within(dialog).getByRole('textbox', { name: /New row name/i })
        const columnLabelField = within(dialog).getByRole('textbox', { name: /New column name/i })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        await user.clear(rowLabelField)
        await user.type(rowLabelField, 'Level three row')
        await user.clear(columnLabelField)
        await user.type(columnLabelField, 'Level three column')
        await user.clear(titleField)
        await user.type(titleField, 'Level three')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add cell' })).not.toBeInTheDocument())
        expect(screen.getByText('Universe')).toBeInTheDocument()
        expect(screen.getByText('Level one')).toBeInTheDocument()
        expect(screen.getByText('Level two')).toBeInTheDocument()

        releaseCreatedRows?.()
        expect(await screen.findByText('Level three')).toBeInTheDocument()
        expect(screen.getByText('Level one')).toBeInTheDocument()
        expect(screen.getByText('Level two')).toBeInTheDocument()
        await waitFor(() => {
            const createdCell = screen
                .getAllByTestId('interpretation-network-cell')
                .find((cell) => cell.getAttribute('data-cell-id') === createdCellId)
            expect(createdCell).toBeDefined()
            expect(createdCell!).toHaveAttribute('data-selected', 'true')
        })
    }, 20_000)

    it('creates a hierarchical child under the menu cell even when another cell is selected', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component')) {
                return jsonResponse({ id: 'matrix-child-created' }, 201)
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        const cells = await screen.findAllByTestId('interpretation-network-cell')
        await user.click(cells[0])
        await user.click(screen.getByRole('button', { name: 'Cell actions: Other cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Add' }))

        const dialog = await screen.findByRole('dialog', { name: 'Add cell' })
        const rowLabelField = within(dialog).getByRole('textbox', { name: /New row name/i })
        const columnLabelField = within(dialog).getByRole('textbox', { name: /New column name/i })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        await user.clear(rowLabelField)
        await user.type(rowLabelField, 'Menu child row')
        await user.clear(columnLabelField)
        await user.type(columnLabelField, 'Menu child column')
        await user.clear(titleField)
        await user.type(titleField, 'Child under menu cell')
        await user.click(within(dialog).getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component')
            )
            expect(createCall).toBeDefined()
            expect(JSON.parse(String(createCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    data: expect.objectContaining({
                        ParentCellId: 'cell-other',
                        CellValue: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Child under menu cell' }) })
                        })
                    })
                })
            )
        })
    }, 20_000)

    it('renders independent row cells by stored sort order instead of API order', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) {
                const fixture = matrixRowsFixture()
                return jsonResponse({
                    ...fixture,
                    items: [
                        {
                            ...fixture.items[0],
                            id: 'matrix-row-later',
                            _tp_sort_order: 5,
                            CellId: 'cell-later',
                            RowKey: 'definition',
                            RowLabel: 'Definition',
                            ColKey: 'later',
                            ColLabel: 'Later',
                            CellValue: 'Later cell value'
                        },
                        {
                            ...fixture.items[0],
                            id: 'matrix-row-earlier',
                            _tp_sort_order: 1,
                            CellId: 'cell-earlier',
                            RowKey: 'definition',
                            RowLabel: 'Definition',
                            ColKey: 'earlier',
                            ColLabel: 'Earlier',
                            CellValue: 'Earlier cell value'
                        }
                    ],
                    total: 2
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...independentRowsConfig,
            allowedMatrixViews: ['horizontalRows'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))

        const cells = await screen.findAllByTestId('interpretation-network-cell')
        expect(cells.map((cell) => cell.textContent)).toEqual([
            expect.stringContaining('Earlier cell value'),
            expect.stringContaining('Later cell value')
        ])
    })

    it('moves selected cells horizontally through the card action menu', async () => {
        const user = userEvent.setup()
        const horizontalFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    ...fixture.items,
                    {
                        ...fixture.items[0],
                        id: 'matrix-row-neighbor',
                        CellId: 'cell-neighbor',
                        ColKey: 'source',
                        ColLabel: 'Source',
                        CellValue: 'Neighbor cell value',
                        CellDescription: 'Neighbor cell description',
                        MaterialRef: null
                    }
                ],
                total: 3
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                return jsonResponse({ status: 'ok', updated: ['matrix-row-selected'] })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(horizontalFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Right' }))

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            const body = JSON.parse(String(batchCalls[0][1]?.body ?? '{}'))
            expect(body.updates).toHaveLength(3)
            expect(body.updates[0]).toEqual(
                expect.objectContaining({
                    childRowId: 'matrix-row-selected',
                    expectedVersion: 7,
                    data: expect.objectContaining({
                        CellId: 'cell-selected',
                        RowKey: 'definition',
                        ColKey: 'meaning',
                        _tp_sort_order: 1,
                        CellValue: 'Selected cell value'
                    })
                })
            )
            expect(body.updates[0].data.ColLabel).toBe('Meaning')
            expect(body.updates).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        childRowId: 'matrix-row-neighbor',
                        expectedVersion: 7,
                        data: { _tp_sort_order: 0 }
                    }),
                    expect.objectContaining({
                        childRowId: 'matrix-row-other',
                        expectedVersion: 9,
                        data: { _tp_sort_order: 0 }
                    })
                ])
            )
        })
    }, 20_000)

    it('reorders hierarchical sibling cells without reparenting the moved cell', async () => {
        const user = userEvent.setup()
        const hierarchicalFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    {
                        id: 'matrix-row-root',
                        _upl_version: 3,
                        CellId: 'cell-root',
                        RowKey: 'root',
                        RowLabel: 'Root',
                        ColKey: 'root',
                        ColLabel: 'Root',
                        CellValue: 'Root cell value',
                        CellDescription: 'Root cell description',
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
                        MaterialRef: null,
                        _tp_sort_order: 0
                    },
                    {
                        ...fixture.items[0],
                        ParentCellId: 'cell-root',
                        _tp_sort_order: 0
                    },
                    {
                        ...fixture.items[1],
                        ParentCellId: 'cell-root',
                        _tp_sort_order: 1
                    }
                ],
                total: 3
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                return jsonResponse({ status: 'ok', updated: ['matrix-row-selected', 'matrix-row-other'] })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(hierarchicalFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await user.click(await screen.findByText('Root cell value'))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Down' }))

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            const body = JSON.parse(String(batchCalls[0][1]?.body ?? '{}'))
            expect(body.updates).toHaveLength(2)
            expect(body.updates[0]).toEqual(
                expect.objectContaining({
                    childRowId: 'matrix-row-selected',
                    expectedVersion: 7,
                    data: { _tp_sort_order: 1 }
                })
            )
            expect(body.updates).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        childRowId: 'matrix-row-other',
                        data: { _tp_sort_order: 0 }
                    })
                ])
            )
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => init?.method === 'PATCH' && String(input).includes('/tabular/matrix-component/')
                )
            ).toBe(false)
        })
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
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentRowsConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete cell?' })
        expect(within(dialog).queryByText('matrix-row-selected')).not.toBeInTheDocument()
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            const deleteCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'DELETE' && String(input).includes('/tabular/matrix-component/matrix-row-selected')
            )
            expect(deleteCall).toBeDefined()
            expect(new URL(String(deleteCall?.[0]), 'http://localhost:3000').searchParams.get('expectedVersion')).toBe('7')
        })
    }, 20_000)

    it('rejects deleting the root cell in hierarchical mode', async () => {
        const user = userEvent.setup()
        const rootFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    {
                        ...fixture.items[0],
                        ParentCellId: null,
                        _tp_sort_order: 0
                    }
                ],
                total: 1
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(rootFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            ...horizontalRowsConfig,
            allowNewAxesInCellDialog: true
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete cell?' })
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(await within(dialog).findByText('The root cell cannot be deleted.')).toBeInTheDocument()
        expect(
            fetchMock.mock.calls.some(([input, init]) => init?.method === 'DELETE' && String(input).includes('/tabular/matrix-component/'))
        ).toBe(false)
    }, 20_000)

    it('allows deleting an independent top-level cell that is not the root in hierarchical mode', async () => {
        const user = userEvent.setup()
        const topLevelFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    {
                        ...fixture.items[0],
                        CellId: 'cell-root',
                        CellValue: 'Universe',
                        ParentCellId: null,
                        _tp_sort_order: 0
                    },
                    {
                        ...fixture.items[1],
                        id: 'matrix-row-independent',
                        CellId: 'cell-independent',
                        CellValue: 'Independent',
                        ParentCellId: null,
                        _tp_sort_order: 1
                    }
                ],
                total: 2
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component/matrix-row-independent') && init?.method === 'DELETE') {
                return new Response(null, { status: 204 })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(topLevelFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, {
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['horizontalRows', 'verticalTree'],
            defaultMatrixView: 'horizontalRows'
        })

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Independent')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Independent' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete cell?' })
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        await waitFor(() => {
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) =>
                        init?.method === 'DELETE' && String(input).includes('/tabular/matrix-component/matrix-row-independent')
                )
            ).toBe(true)
        })
    }, 20_000)

    it('rejects deleting a hierarchical parent cell while it has children', async () => {
        const user = userEvent.setup()
        const parentWithChildFixture = () => {
            const fixture = matrixRowsFixture()
            return {
                ...fixture,
                items: [
                    {
                        ...fixture.items[0],
                        ParentCellId: null,
                        _tp_sort_order: 0
                    },
                    {
                        ...fixture.items[1],
                        ParentCellId: 'cell-selected',
                        _tp_sort_order: 0
                    }
                ]
            }
        }
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(parentWithChildFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, horizontalRowsIndependentAxesConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
        const dialog = await screen.findByRole('dialog', { name: 'Delete cell?' })
        await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

        expect(await within(dialog).findByText('Move or delete child cells before deleting this cell.')).toBeInTheDocument()
        expect(
            fetchMock.mock.calls.some(([input, init]) => init?.method === 'DELETE' && String(input).includes('/tabular/matrix-component/'))
        ).toBe(false)
    }, 20_000)

    it('creates an Editor.js material and stores its reference through physical fields', async () => {
        const user = userEvent.setup()
        const physicalInterpretationColumns = interpretationMatrixColumns()
        const physicalMatrixColumn = physicalInterpretationColumns.find((column) => column.codename === 'InterpretationMatrix')
        const physicalMaterialRef = physicalMatrixColumn?.childColumns?.find((column) => column.codename === 'MaterialRef')
        if (physicalMaterialRef) {
            physicalMaterialRef.field = 'phys_material_ref'
        }
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
            if (url.searchParams.get('objectCollectionCodename') === 'Interpretation') {
                return jsonResponse(
                    appData(
                        'Interpretation',
                        [{ id: 'interpretation-1', Title: 'Existing structure matrix', ParentStructure: 'concept-1' }],
                        physicalInterpretationColumns
                    )
                )
            }
            if (url.searchParams.get('objectCollectionCodename') === 'Material') {
                const response = defaultRuntimeResponse(url)
                return jsonResponse({
                    ...response,
                    columns: [
                        ...response.columns,
                        normalizeColumn({
                            id: 'material-cell-id-component',
                            codename: 'CellId',
                            field: 'phys_cell_id',
                            headerName: 'Cell ID'
                        })
                    ]
                })
            }
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, horizontalRowsIndependentAxesConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await clickSelectedMatrixCell(user)
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
                        }),
                        phys_cell_id: 'cell-selected'
                    })
                })
            )
            expect(JSON.parse(String(createCall?.[1]?.body ?? '{}')).data).not.toHaveProperty('CellId')
            const matrixPatchCall = fetchMock.mock.calls.find(([input, init]) => {
                const url = new URL(String(input), 'http://localhost:3000')
                return (
                    init?.method === 'PATCH' &&
                    url.pathname.endsWith('/runtime/rows/interpretation-1/tabular/matrix-component/matrix-row-selected') &&
                    url.searchParams.get('objectCollectionId') === sectionIds.Interpretation &&
                    url.searchParams.get('workspaceId') === 'workspace-1'
                )
            })
            expect(matrixPatchCall).toBeDefined()
            expect(JSON.parse(String(matrixPatchCall?.[1]?.body ?? '{}'))).toEqual({
                data: { phys_material_ref: 'material-created' },
                expectedVersion: 7
            })
        })
        expect(screen.queryByTestId('interpretation-network-material-editor')).not.toBeInTheDocument()
    }, 20_000)

    it('compensates a created material when linking it to the selected cell fails', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                return jsonResponse({ id: 'material-orphan-candidate' }, 201)
            }
            if (init?.method === 'PATCH' && url.pathname.endsWith('/tabular/matrix-component/matrix-row-selected')) {
                return jsonResponse({ message: 'Cell changed concurrently' }, 409)
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows/material-orphan-candidate/compensate-create')) {
                return new Response(null, { status: 204 })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentAxesTableConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await clickSelectedMatrixCell(user)
        await user.click(within(screen.getByTestId('interpretation-network-details-pane')).getByRole('button', { name: 'Create' }))
        await user.type(await screen.findByLabelText('Title'), 'Conflicting material')
        await user.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            const compensationCall = fetchMock.mock.calls.find(
                ([input, init]) =>
                    init?.method === 'POST' && String(input).includes('/runtime/rows/material-orphan-candidate/compensate-create')
            )
            expect(compensationCall).toBeDefined()
            expect(JSON.parse(String(compensationCall?.[1]?.body ?? '{}'))).toEqual({
                expectedVersion: 1,
                objectCollectionId: sectionIds.Material
            })
        })
        expect(await screen.findByText('Failed to save material')).toBeInTheDocument()
    }, 20_000)

    it('blocks material creation when the localized title exceeds the metadata max length', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentAxesTableConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await clickSelectedMatrixCell(user)
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
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, independentAxesTableConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await clickSelectedMatrixCell(user)

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
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, horizontalRowsIndependentAxesConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await switchToHorizontalRows(user)
        const selectedCell = screen.getAllByTestId('interpretation-network-cell')[0]
        await user.click(selectedCell)

        const selectedCellStyle = window.getComputedStyle(selectedCell)
        expect(selectedCellStyle.backgroundColor).toBe('#1e88e5')
        expect(selectedCellStyle.borderTopColor).toBe('#1e88e5')
        expect(selectedCellStyle.borderTopWidth).toBe('3px')
        expect(selectedCell).toHaveAttribute('data-selected-outline', 'inset')
        expect(selectedCellStyle.backgroundColor).not.toBe('rgb(0, 0, 0)')
    })

    it('edits cell metadata and style from the card menu through the tabular update endpoint', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                return jsonResponse({ ok: true })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, horizontalRowsIndependentAxesConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getAllByTestId('interpretation-network-cell')[0])
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        const rowLabelField = within(dialog).getByRole('textbox', { name: /Row label/i })
        const columnLabelField = within(dialog).getByRole('textbox', { name: /Column label/i })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        const descriptionField = within(dialog).getByRole('textbox', { name: /Description/i })
        expect(descriptionField.tagName.toLowerCase()).toBe('textarea')
        await user.clear(rowLabelField)
        await user.type(rowLabelField, 'Updated row label')
        await user.clear(columnLabelField)
        await user.type(columnLabelField, 'Updated column label')
        await user.clear(titleField)
        await user.type(titleField, 'Updated cell title')
        await user.clear(descriptionField)
        await user.type(descriptionField, 'Updated cell description')
        await waitFor(() => {
            expect(rowLabelField).toHaveValue('Updated row label')
            expect(columnLabelField).toHaveValue('Updated column label')
            expect(titleField).toHaveValue('Updated cell title')
            expect(descriptionField).toHaveValue('Updated cell description')
        })
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            const styleCall = fetchMock.mock.calls.find(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(styleCall).toBeDefined()
            expect(JSON.parse(String(styleCall?.[1]?.body ?? '{}'))).toEqual(
                expect.objectContaining({
                    updates: expect.arrayContaining([
                        expect.objectContaining({
                            childRowId: 'matrix-row-selected',
                            expectedVersion: 7,
                            data: expect.objectContaining({
                                RowLabel: expect.objectContaining({
                                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated row label' }) })
                                }),
                                ColLabel: expect.objectContaining({
                                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated column label' }) })
                                }),
                                CellValue: expect.objectContaining({
                                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated cell title' }) })
                                }),
                                CellDescription: expect.objectContaining({
                                    locales: expect.objectContaining({
                                        en: expect.objectContaining({ content: 'Updated cell description' })
                                    })
                                })
                            })
                        })
                    ]),
                    uniformUpdates: [
                        expect.objectContaining({
                            rows: [{ childRowId: 'matrix-row-other', expectedVersion: 9 }],
                            data: expect.objectContaining({
                                ColLabel: expect.objectContaining({
                                    locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated column label' }) })
                                })
                            })
                        })
                    ]
                })
            )
        })
    }, 20_000)

    it('edits cell metadata without syncing unchanged row and column labels to sibling cells', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost:3000')
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (init?.method === 'POST' && url.pathname.endsWith('/tabular/matrix-component/batch')) {
                return jsonResponse({ ok: true })
            }
            if (url.pathname.endsWith('/tabular/matrix-component')) return jsonResponse(matrixRowsFixture())
            return jsonResponse(defaultRuntimeResponse(url))
        })
        renderInterpretationNetworkWidget(fetchMock, vi.fn(), defaultPermissions, undefined, horizontalRowsIndependentAxesConfig)

        await user.click(await screen.findByRole('button', { name: 'Existing structure' }))
        await screen.findAllByText('Selected cell value')
        await user.click(screen.getAllByTestId('interpretation-network-cell')[0])
        await user.click(screen.getByRole('button', { name: 'Cell actions: Selected cell value' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        const dialog = await screen.findByRole('dialog', { name: 'Edit cell' })
        const rowLabelField = within(dialog).getByRole('textbox', { name: /Row label/i })
        const columnLabelField = within(dialog).getByRole('textbox', { name: /Column label/i })
        const titleField = within(dialog).getByRole('textbox', { name: /Title/i })
        const descriptionField = within(dialog).getByRole('textbox', { name: /Description/i })
        expect(rowLabelField).toHaveValue('Definition')
        expect(columnLabelField).toHaveValue('Meaning')
        await user.clear(titleField)
        await user.type(titleField, 'Updated cell title')
        await user.clear(descriptionField)
        await user.type(descriptionField, 'Updated cell description')
        await waitFor(() => {
            expect(titleField).toHaveValue('Updated cell title')
            expect(descriptionField).toHaveValue('Updated cell description')
        })
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => {
            const batchCalls = fetchMock.mock.calls.filter(
                ([input, init]) => init?.method === 'POST' && String(input).includes('/tabular/matrix-component/batch')
            )
            expect(batchCalls).toHaveLength(1)
            const body = JSON.parse(String(batchCalls[0][1]?.body ?? '{}'))
            expect(body.updates).toEqual([
                expect.objectContaining({
                    childRowId: 'matrix-row-selected',
                    expectedVersion: 7,
                    data: expect.objectContaining({
                        RowLabel: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Definition' }) })
                        }),
                        ColLabel: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Meaning' }) })
                        }),
                        CellValue: expect.objectContaining({
                            locales: expect.objectContaining({ en: expect.objectContaining({ content: 'Updated cell title' }) })
                        }),
                        CellDescription: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({ content: 'Updated cell description' })
                            })
                        })
                    })
                })
            ])
            expect(body.uniformUpdates).toBeUndefined()
        })
    }, 20_000)
})
