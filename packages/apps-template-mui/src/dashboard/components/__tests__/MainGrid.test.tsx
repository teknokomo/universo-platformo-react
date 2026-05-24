import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChangeEventHandler, ReactNode } from 'react'
import MainGrid from '../MainGrid'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

type MockRow = Record<string, unknown> & { id: string }

interface MockViewHeaderProps {
    title?: ReactNode
    search?: boolean
    searchValue?: string
    onSearchChange?: ChangeEventHandler<HTMLInputElement>
    children?: ReactNode
}

interface MockItemCardProps {
    data: { name?: ReactNode; description?: ReactNode }
    allowStretch?: boolean
}

interface MockTableColumn {
    render?: (row?: MockRow) => ReactNode
}

interface MockFlowListTableProps {
    data?: MockRow[]
    sortableRows?: boolean
    customColumns?: MockTableColumn[]
}

interface MockPaginationControlsProps {
    pagination: {
        currentPage: number
        totalItems: number
    }
}

interface MockStatCardProps {
    title: string
    value: string
    trendLabel?: string
    data?: number[]
}

interface MockChartProps {
    title?: string
    value?: string
    trendLabel?: string
    xAxisData?: string[]
    series?: Array<{ label: string; data: number[] }>
    noDataText?: string
}

interface MockRenderCellParams {
    id: string
    api: {
        getRow: (id: string) => MockRow
        getCellValue: (id: string, field: string) => unknown
    }
}

vi.mock('../CustomizedDataGrid', () => ({
    default: (props: { rows: Array<unknown>; columns?: Array<{ field: string }>; rowCount?: number; hideFooter?: boolean }) => (
        <div
            data-testid='customized-grid'
            data-rows={String(props.rows.length)}
            data-column-fields={(props.columns ?? []).map((column) => column.field).join(',')}
            data-row-count={props.rowCount === undefined ? 'undefined' : String(props.rowCount)}
            data-hide-footer={String(Boolean(props.hideFooter))}
        />
    )
}))

vi.mock('../../internals/components/Copyright', () => ({
    default: () => <div data-testid='copyright' />
}))

vi.mock('../HighlightedCard', () => ({ default: () => <div data-testid='highlighted-card' /> }))
vi.mock('../PageViewsBarChart', () => ({
    default: (props: MockChartProps) => (
        <div
            data-testid='page-views-chart'
            data-series-length={String(props.series?.length ?? -1)}
            data-x-axis-length={String(props.xAxisData?.length ?? -1)}
            data-first-label={props.series?.[0]?.label ?? ''}
            data-trend-label={props.trendLabel ?? ''}
            data-no-data-text={props.noDataText ?? ''}
        >
            {props.title ?? 'Page views'}:{props.value ?? ''}:{props.xAxisData?.join('|') ?? ''}:{props.series?.[0]?.data.join('|') ?? ''}
        </div>
    )
}))
vi.mock('../SessionsChart', () => ({
    default: (props: MockChartProps) => (
        <div
            data-testid='sessions-chart'
            data-series-length={String(props.series?.length ?? -1)}
            data-x-axis-length={String(props.xAxisData?.length ?? -1)}
            data-first-label={props.series?.[0]?.label ?? ''}
            data-trend-label={props.trendLabel ?? ''}
            data-no-data-text={props.noDataText ?? ''}
        >
            {props.title ?? 'Sessions'}:{props.value ?? ''}:{props.xAxisData?.join('|') ?? ''}:{props.series?.[0]?.data.join('|') ?? ''}
        </div>
    )
}))
vi.mock('../StatCard', () => ({
    default: (props: MockStatCardProps) => (
        <div
            data-testid='stat-card'
            data-trend-label={props.trendLabel ?? ''}
            data-series-sum={String(props.data?.reduce((sum, value) => sum + value, 0) ?? 0)}
        >
            {`${props.title}:${props.value}`}
        </div>
    )
}))
vi.mock('../widgetRenderer', () => ({
    renderWidget: (widget: { widgetKey: string }) => <div data-testid={`rendered-widget-${widget.widgetKey}`}>{widget.widgetKey}</div>
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string | { defaultValue?: string; progress?: number }) => {
            if (typeof fallback === 'string') return fallback
            if (fallback?.defaultValue) return fallback.defaultValue.replace('{{progress}}', String(fallback.progress ?? ''))
            return key
        },
        i18n: { language: 'en' }
    })
}))

vi.mock('../../../components/runtime-ui', async () => {
    const React = await import('react')

    return {
        ViewHeaderMUI: (props: MockViewHeaderProps) => (
            <div>
                <div>{props.title}</div>
                {props.search ? <input aria-label='search' value={props.searchValue} onChange={props.onSearchChange} /> : null}
                {props.children}
            </div>
        ),
        ToolbarControls: () => <div data-testid='toolbar-controls' />,
        ItemCard: (props: MockItemCardProps) => (
            <div data-testid='item-card' data-allow-stretch={String(Boolean(props.allowStretch))}>
                {props.data.name}
                {props.data.description ? <span data-testid='item-card-description'>{props.data.description}</span> : null}
            </div>
        ),
        FlowListTable: (props: MockFlowListTableProps) => (
            <div
                data-testid='flow-list-table'
                data-rows={String(props.data?.length ?? 0)}
                data-sortable={String(Boolean(props.sortableRows))}
            >
                <div data-testid='flow-list-table-first-cell'>
                    {props.customColumns?.[0]?.render ? props.customColumns[0].render(props.data?.[0]) : null}
                </div>
            </div>
        ),
        PaginationControls: (props: MockPaginationControlsProps) => (
            <div data-testid='pagination-controls'>
                {props.pagination.currentPage}:{props.pagination.totalItems}
            </div>
        ),
        useViewPreference: (_key: string, defaultMode: 'table' | 'card') => React.useState(defaultMode)
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

const localizedText = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en, version: 1, isActive: true },
        ru: { content: ru, version: 1, isActive: true }
    }
})

afterEach(() => {
    window.localStorage.clear()
    vi.unstubAllGlobals()
})

describe('MainGrid enhanced runtime details', () => {
    const baseLayoutConfig = {
        showOverviewTitle: false,
        showOverviewCards: false,
        showSessionsChart: false,
        showPageViewsChart: false,
        showDetailsTitle: false,
        showDetailsTable: true,
        showFooter: false
    }

    const details = {
        title: 'Details',
        rows: [
            { id: 'row-1', name: 'Alpha', status: 'Open' },
            { id: 'row-2', name: 'Beta', status: 'Closed' }
        ],
        columns: [
            { field: 'name', headerName: 'Name' },
            { field: 'status', headerName: 'Status' }
        ],
        rowCount: 5,
        paginationModel: { page: 0, pageSize: 20 },
        onPaginationModelChange: vi.fn(),
        pageSizeOptions: [10, 20, 50]
    }

    it('uses shared dashboard defaults when layoutConfig is omitted', () => {
        render(
            <DashboardDetailsProvider value={details}>
                <MainGrid />
            </DashboardDetailsProvider>
        )

        expect(screen.getByText('Overview')).toBeInTheDocument()
        expect(screen.queryByTestId('stat-card')).not.toBeInTheDocument()
        expect(screen.queryByTestId('sessions-chart')).not.toBeInTheDocument()
        expect(screen.queryByTestId('page-views-chart')).not.toBeInTheDocument()
        expect(screen.getByTestId('customized-grid')).toBeInTheDocument()
    })

    it('renders metadata-defined detailsTable widgets with runtime actions instead of the fallback current-object grid', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    actions: <button data-testid='create-action'>Create</button>
                }}
            >
                <MainGrid
                    layoutConfig={{ ...baseLayoutConfig, showDetailsTitle: true }}
                    centerWidgets={[
                        {
                            id: 'details-table-widget',
                            widgetKey: 'detailsTable',
                            sortOrder: 1,
                            config: {
                                datasource: {
                                    kind: 'records.union',
                                    targets: [{ sectionCodename: 'LearningResources' }]
                                }
                            }
                        }
                    ]}
                />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-metadata-details-tables')).toBeInTheDocument()
        expect(screen.getByTestId('rendered-widget-detailsTable')).toBeInTheDocument()
        expect(screen.getByTestId('create-action')).toBeInTheDocument()
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('hides top-level runtime create actions when a detailsTable widget owns create targets', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    actions: <button data-testid='create-action'>Create</button>
                }}
            >
                <MainGrid
                    layoutConfig={{ ...baseLayoutConfig, showDetailsTitle: true }}
                    centerWidgets={[
                        {
                            id: 'details-table-widget',
                            widgetKey: 'detailsTable',
                            sortOrder: 1,
                            config: {
                                datasource: {
                                    kind: 'records.union',
                                    targets: [{ sectionCodename: 'LearningResources' }]
                                },
                                createTargets: [
                                    {
                                        id: 'create-page',
                                        label: { en: 'Page', ru: 'Страница' },
                                        sectionCodename: 'LearningResources'
                                    }
                                ]
                            }
                        }
                    ]}
                />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-metadata-details-tables')).toBeInTheDocument()
        expect(screen.getByTestId('rendered-widget-detailsTable')).toBeInTheDocument()
        expect(screen.queryByTestId('create-action')).not.toBeInTheDocument()
    })

    it('uses local filtered totals and client rows when search narrows the current dataset', () => {
        render(
            <DashboardDetailsProvider value={details}>
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showFilterBar: true }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '2')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '5')

        fireEvent.change(screen.getByLabelText('search'), { target: { value: 'alpha' } })

        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', 'undefined')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-hide-footer', 'false')
    })

    it('stretches runtime record cards inside the dashboard card grid', () => {
        render(
            <DashboardDetailsProvider value={details}>
                <MainGrid layoutConfig={{ ...baseLayoutConfig, defaultViewMode: 'card', showViewToggle: true, cardColumns: 3 }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-details-card-view')).toBeInTheDocument()
        const cards = screen.getAllByTestId('item-card')
        expect(cards).toHaveLength(2)
        expect(cards.every((card) => card.getAttribute('data-allow-stretch') === 'true')).toBe(true)
    })

    it('uses generic table defaults from the runtime details contract', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    tableDefaults: {
                        defaultViewMode: 'card',
                        columnPreset: {
                            columns: [
                                { field: 'status', visible: true, width: 180 },
                                { field: 'name', visible: false }
                            ]
                        }
                    }
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showViewToggle: true }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-details-card-view')).toBeInTheDocument()
        expect(screen.getAllByTestId('item-card')).toHaveLength(2)
        expect(screen.getAllByTestId('item-card')[0]).toHaveTextContent('Open')
    })

    it('applies generic table defaults to the current-object grid without exposing hidden technical columns', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    columns: [
                        { field: 'title', headerName: 'Title' },
                        { field: 'status', headerName: 'Status' },
                        { field: 'ProjectId', headerName: 'Project' },
                        { field: 'actions', headerName: 'Actions' }
                    ],
                    tableDefaults: {
                        defaultViewMode: 'table',
                        columnPreset: {
                            columns: [
                                { field: 'ProjectId', visible: true },
                                { field: 'status', visible: true },
                                { field: 'title', visible: true }
                            ]
                        }
                    }
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showViewToggle: true }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'status,title,actions')
        expect(screen.queryByTestId('dashboard-details-card-view')).not.toBeInTheDocument()
    })

    it('formats object values in generic current-object cards without leaking object placeholders', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    locale: 'ru',
                    rows: [
                        {
                            id: 'row-1',
                            title: localizedText('Welcome page', 'Страница приветствия'),
                            summary: { status: ['draft'], score: { gte: 80 } },
                            ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990'
                        }
                    ],
                    columns: [
                        { field: 'title', headerName: 'Title' },
                        { field: 'summary', headerName: 'Summary' },
                        { field: 'ProjectId', headerName: 'Project' }
                    ],
                    tableDefaults: {
                        defaultViewMode: 'card',
                        columnPreset: {
                            columns: [
                                { field: 'title', visible: true },
                                { field: 'summary', visible: true },
                                { field: 'ProjectId', visible: false }
                            ]
                        }
                    }
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showViewToggle: true }} />
            </DashboardDetailsProvider>
        )

        const card = screen.getByTestId('item-card')
        expect(card).toHaveTextContent('Страница приветствия')
        expect(card).not.toHaveTextContent('[object Object]')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
    })

    it('uses a localized untitled fallback instead of raw row ids in generic current-object cards', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                            TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073992'
                        }
                    ],
                    columns: [
                        { field: 'id', headerName: 'ID' },
                        { field: 'ProjectId', headerName: 'Project' },
                        { field: 'TargetRecordId', headerName: 'Target' }
                    ],
                    tableDefaults: {
                        defaultViewMode: 'card'
                    }
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showViewToggle: true }} />
            </DashboardDetailsProvider>
        )

        const card = screen.getByTestId('item-card')
        expect(card).toHaveTextContent('Untitled item')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073991')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073992')
    })

    it('suppresses UUID substrings in generic current-object card descriptions', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    rows: [
                        {
                            id: 'row-1',
                            title: 'Safety briefing',
                            summary: 'Linked project 017f22e2-79b0-7cc3-98c4-dc0c0c073990'
                        }
                    ],
                    columns: [
                        { field: 'title', headerName: 'Title' },
                        { field: 'summary', headerName: 'Summary' }
                    ],
                    tableDefaults: {
                        defaultViewMode: 'card'
                    }
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, showViewToggle: true }} />
            </DashboardDetailsProvider>
        )

        const card = screen.getByTestId('item-card')
        expect(card).toHaveTextContent('Safety briefing')
        expect(card).not.toHaveTextContent('Linked project')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
    })

    it('resolves localized overview card labels and records.count metrics through the runtime list API', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
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
                    total: 42,
                    limit: 1,
                    offset: 0
                },
                layoutConfig: {},
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'ru',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'courses' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'courses' }]
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showOverviewCards: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'overview-cards',
                                widgetKey: 'overviewCards',
                                sortOrder: 1,
                                config: {
                                    cards: [
                                        {
                                            title: localizedText('Courses', 'Курсы'),
                                            value: '0',
                                            interval: localizedText('All records', 'Все записи'),
                                            trend: 'neutral',
                                            datasource: {
                                                kind: 'metric',
                                                metricKey: 'records.count',
                                                params: {
                                                    sectionCodename: 'courses',
                                                    search: 'safety'
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('stat-card')).toHaveTextContent('Курсы:42'))
        expect(screen.getByTestId('stat-card')).toHaveAttribute('data-trend-label', '0%')
        expect(screen.getByTestId('stat-card')).toHaveAttribute('data-series-sum', '0')
        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.searchParams.get('limit')).toBe('1')
        expect(requestedUrl.searchParams.get('objectCollectionId')).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(requestedUrl.searchParams.get('search')).toBe('safety')
        expect(requestedUrl.searchParams.get('locale')).toBe('ru')
    })

    it('uses fallback stat-card values instead of unsafe configured metric values', () => {
        const rawMetricValue = '{"recordId":"017f22e2-79b0-7cc3-98c4-dc0c0c073987"}'

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider value={details}>
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showOverviewCards: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'overview-cards',
                                widgetKey: 'overviewCards',
                                sortOrder: 1,
                                config: {
                                    cards: [
                                        {
                                            title: 'Unsafe metric',
                                            value: rawMetricValue,
                                            interval: 'Current workspace',
                                            trend: 'neutral'
                                        }
                                    ]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        const card = screen.getByTestId('stat-card')
        expect(card).toHaveTextContent('Unsafe metric:14k')
        expect(card).not.toHaveTextContent(rawMetricValue)
        expect(card).not.toHaveTextContent('recordId')
        expect(card).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073987')
    })

    it('resolves overview card report aggregation metrics through the runtime reports API', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/reports/run?workspaceId=workspace-1')
            return new Response(
                JSON.stringify({
                    rows: [],
                    total: 0,
                    aggregations: { AverageProgress: 87.5 },
                    definition: {
                        codename: 'LearnerProgress',
                        title: 'Learner progress',
                        datasource: { kind: 'records.list', sectionCodename: 'ContentProgress' },
                        columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }],
                        filters: [],
                        aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
                    }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        currentWorkspaceId: 'workspace-1'
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showOverviewCards: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'overview-cards',
                                widgetKey: 'overviewCards',
                                sortOrder: 1,
                                config: {
                                    cards: [
                                        {
                                            title: 'Average progress',
                                            value: '0',
                                            interval: 'Current workspace',
                                            datasource: {
                                                kind: 'metric',
                                                metricKey: 'report.aggregation',
                                                params: {
                                                    reportCodename: 'LearnerProgress',
                                                    aggregationAlias: 'AverageProgress'
                                                }
                                            }
                                        }
                                    ]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('stat-card')).toHaveTextContent('Average progress:87.5'))
        expect(screen.getByTestId('stat-card')).toHaveAttribute('data-trend-label', '0%')
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const reportRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(reportRequest.method).toBe('POST')
        expect(reportRequest.body).toBe(JSON.stringify({ reportCodename: 'LearnerProgress', limit: 1, offset: 0, locale: 'en' }))
        expect(new Headers(reportRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('resolves records.list datasource rows into localized chart series props', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                section: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'activity',
                    name: 'Activity'
                },
                objectCollection: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'Activity',
                    name: 'Activity'
                },
                sections: [],
                objectCollections: [],
                activeSectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                activeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                columns: [],
                rows: [
                    { id: 'row-1', period: 'Jan', completed: 12 },
                    { id: 'row-2', period: 'Feb', completed: '18' }
                ],
                pagination: {
                    total: 2,
                    limit: 3,
                    offset: 0
                },
                layoutConfig: {},
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'ru',
                        currentWorkspaceId: 'workspace-1',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }]
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showPageViewsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'page-views-chart',
                                widgetKey: 'pageViewsChart',
                                sortOrder: 1,
                                config: {
                                    title: localizedText('Completed learning', 'Завершённое обучение'),
                                    value: '30',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'activity',
                                        query: {
                                            search: 'cohort',
                                            sort: [{ field: 'period', direction: 'asc' }]
                                        }
                                    },
                                    xField: 'period',
                                    maxRows: 3,
                                    series: [{ field: 'completed', label: localizedText('Completed', 'Завершено') }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('page-views-chart')).toHaveTextContent('Завершённое обучение:30:Jan|Feb:12|18'))
        expect(screen.getByTestId('page-views-chart')).toHaveAttribute('data-first-label', 'Завершено')
        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.searchParams.get('limit')).toBe('3')
        expect(requestedUrl.searchParams.get('objectCollectionId')).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(requestedUrl.searchParams.get('workspaceId')).toBe('workspace-1')
        expect(requestedUrl.searchParams.get('search')).toBe('cohort')
        expect(JSON.parse(requestedUrl.searchParams.get('sort') ?? '[]')).toEqual([{ field: 'period', direction: 'asc' }])
    })

    it('does not expose raw IDs, JSON, or object placeholders in chart axis labels', async () => {
        const rawAxisId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                section: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'activity',
                    name: 'Activity'
                },
                objectCollection: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'Activity',
                    name: 'Activity'
                },
                sections: [],
                objectCollections: [],
                activeSectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                activeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                columns: [],
                rows: [
                    { id: 'row-1', period: rawAxisId, completed: 12 },
                    { id: 'row-2', period: '{"blocks":[{"type":"paragraph"}]}', completed: 18 },
                    { id: 'row-3', period: { blocks: [{ type: 'paragraph' }] }, completed: 4 },
                    { id: 'row-4', period: 'Readable period', completed: 9 }
                ],
                pagination: {
                    total: 4,
                    limit: 4,
                    offset: 0
                },
                layoutConfig: {},
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        currentWorkspaceId: 'workspace-1',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }]
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showPageViewsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'page-views-chart',
                                widgetKey: 'pageViewsChart',
                                sortOrder: 1,
                                config: {
                                    title: 'Completed learning',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'activity'
                                    },
                                    xField: 'period',
                                    maxRows: 4,
                                    series: [{ field: 'completed', label: 'Completed' }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('page-views-chart')).toHaveTextContent('Readable period:12|18|4|9'))
        const chart = screen.getByTestId('page-views-chart')
        expect(chart).toHaveAttribute('data-x-axis-length', '4')
        expect(chart).not.toHaveTextContent(rawAxisId)
        expect(chart).not.toHaveTextContent('blocks')
        expect(chart).not.toHaveTextContent('[object Object]')
    })

    it('uses computed chart totals instead of unsafe configured metric values', async () => {
        const rawMetricValue = '{"recordId":"017f22e2-79b0-7cc3-98c4-dc0c0c073987"}'
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                section: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'activity',
                    name: 'Activity'
                },
                objectCollection: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'Activity',
                    name: 'Activity'
                },
                sections: [],
                objectCollections: [],
                activeSectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                activeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                columns: [],
                rows: [
                    { id: 'row-1', period: 'Jan', completed: 12 },
                    { id: 'row-2', period: 'Feb', completed: 18 }
                ],
                pagination: {
                    total: 2,
                    limit: 2,
                    offset: 0
                },
                layoutConfig: {},
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }]
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showPageViewsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'page-views-chart',
                                widgetKey: 'pageViewsChart',
                                sortOrder: 1,
                                config: {
                                    title: 'Completed learning',
                                    value: rawMetricValue,
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'activity'
                                    },
                                    xField: 'period',
                                    maxRows: 2,
                                    series: [{ field: 'completed', label: 'Completed' }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('page-views-chart')).toHaveTextContent('Completed learning:30:Jan|Feb:12|18'))
        const chart = screen.getByTestId('page-views-chart')
        expect(chart).not.toHaveTextContent(rawMetricValue)
        expect(chart).not.toHaveTextContent('recordId')
        expect(chart).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073987')
    })

    it('resolves ledger.projection datasource rows into localized chart series props', async () => {
        window.sessionStorage.setItem('up.auth.csrf', 'csrf-token')
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                projection: { codename: 'ProgressByLearner' },
                rows: [
                    { Learner: 'Ana', ProgressDelta: 10 },
                    { Learner: 'Ben', ProgressDelta: '15' }
                ],
                limit: 2,
                offset: 0
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'ru'
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showPageViewsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'page-views-chart',
                                widgetKey: 'pageViewsChart',
                                sortOrder: 1,
                                config: {
                                    title: localizedText('Progress by learner', 'Прогресс по учащимся'),
                                    datasource: {
                                        kind: 'ledger.projection',
                                        ledgerId: '017f22e2-79b0-7cc3-98c4-dc0c0c073995',
                                        projectionCodename: 'ProgressByLearner'
                                    },
                                    xField: 'Learner',
                                    maxRows: 2,
                                    series: [{ field: 'ProgressDelta', label: localizedText('Progress', 'Прогресс') }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('page-views-chart')).toHaveTextContent('Прогресс по учащимся:25:Ana|Ben:10|15'))
        expect(screen.getByTestId('page-views-chart')).toHaveAttribute('data-first-label', 'Прогресс')

        const [requestedUrl, requestInit] = fetchMock.mock.calls[0]
        expect(new URL(requestedUrl as string).pathname).toBe(
            '/api/v1/applications/app-1/runtime/ledgers/017f22e2-79b0-7cc3-98c4-dc0c0c073995/query'
        )
        expect(requestInit).toMatchObject({
            method: 'POST',
            credentials: 'include'
        })
        const headers = new Headers((requestInit as RequestInit).headers)
        expect(headers.get('Content-Type')).toBe('application/json')
        expect(headers.get('X-CSRF-Token')).toBe('csrf-token')
        expect(JSON.parse((requestInit as RequestInit).body as string)).toEqual({
            projectionCodename: 'ProgressByLearner',
            limit: 2,
            offset: 0
        })
    })

    it('does not expose raw ledger projection values in chart axis labels', async () => {
        window.sessionStorage.setItem('up.auth.csrf', 'csrf-token')
        const rawLearnerId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                projection: { codename: 'ProgressByLearner' },
                rows: [
                    { Learner: rawLearnerId, ProgressDelta: 10 },
                    { Learner: '{"recordId":"017f22e2-79b0-7cc3-98c4-dc0c0c073997"}', ProgressDelta: 15 },
                    { Learner: { recordId: rawLearnerId }, ProgressDelta: 5 },
                    { Learner: localizedText('Readable learner', 'Читаемый учащийся'), ProgressDelta: 20 }
                ],
                limit: 4,
                offset: 0
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'ru'
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showPageViewsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'page-views-chart',
                                widgetKey: 'pageViewsChart',
                                sortOrder: 1,
                                config: {
                                    title: localizedText('Progress by learner', 'Прогресс по учащимся'),
                                    datasource: {
                                        kind: 'ledger.projection',
                                        ledgerId: '017f22e2-79b0-7cc3-98c4-dc0c0c073995',
                                        projectionCodename: 'ProgressByLearner'
                                    },
                                    xField: 'Learner',
                                    maxRows: 4,
                                    series: [{ field: 'ProgressDelta', label: localizedText('Progress', 'Прогресс') }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('page-views-chart')).toHaveTextContent('Читаемый учащийся:10|15|5|20'))
        const chart = screen.getByTestId('page-views-chart')
        expect(chart).toHaveAttribute('data-x-axis-length', '4')
        expect(chart).not.toHaveTextContent(rawLearnerId)
        expect(chart).not.toHaveTextContent('recordId')
        expect(chart).not.toHaveTextContent('[object Object]')
    })

    it('keeps configured chart widgets empty instead of falling back to demo data when datasource rows are empty', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                section: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'activity',
                    name: 'Activity'
                },
                objectCollection: {
                    id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    codename: 'activity',
                    tableName: 'activity',
                    name: 'Activity'
                },
                sections: [],
                objectCollections: [],
                activeSectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                activeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                columns: [],
                rows: [],
                pagination: {
                    total: 0,
                    limit: 12,
                    offset: 0
                },
                layoutConfig: {},
                zoneWidgets: { left: [], right: [], center: [] },
                menus: [],
                activeMenuId: null
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        ...details,
                        applicationId: 'app-1',
                        apiBaseUrl: '/api/v1',
                        locale: 'ru',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'activity' }]
                    }}
                >
                    <MainGrid
                        layoutConfig={{ ...baseLayoutConfig, showSessionsChart: true, showDetailsTable: false }}
                        centerWidgets={[
                            {
                                id: 'sessions-chart',
                                widgetKey: 'sessionsChart',
                                sortOrder: 1,
                                config: {
                                    title: localizedText('Progress', 'Прогресс'),
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'activity'
                                    },
                                    xField: 'period',
                                    maxRows: 12,
                                    series: [{ field: 'completed', label: localizedText('Completed', 'Завершено'), area: true }]
                                }
                            }
                        ]}
                    />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('sessions-chart')).toHaveTextContent('Прогресс:0::'))
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-series-length', '1')
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-x-axis-length', '0')
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-first-label', 'Завершено')
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-trend-label', '0%')
        expect(screen.getByTestId('sessions-chart')).toHaveAttribute('data-no-data-text', 'Нет данных для отображения')
    })

    it('switches table mode to FlowListTable when row reordering is enabled', () => {
        render(
            <DashboardDetailsProvider value={{ ...details, rowCount: 2, rowReorder: { onReorder: vi.fn() } }}>
                <MainGrid layoutConfig={{ ...baseLayoutConfig, enableRowReordering: true }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('flow-list-table')).toHaveAttribute('data-rows', '2')
        expect(screen.getByTestId('flow-list-table')).toHaveAttribute('data-sortable', 'true')
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('fails closed to the DataGrid when reorder is configured but only a partial dataset is loaded', () => {
        render(
            <DashboardDetailsProvider value={{ ...details, rowCount: 5, rowReorder: { onReorder: vi.fn() } }}>
                <MainGrid layoutConfig={{ ...baseLayoutConfig, enableRowReordering: true }} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '2')
        expect(screen.queryByTestId('flow-list-table')).not.toBeInTheDocument()
    })

    it('passes a minimal Grid API shim into FlowListTable renderCell callbacks', () => {
        const renderCell = vi.fn((params: MockRenderCellParams) => {
            const currentRow = params.api.getRow(params.id)
            return `${String(currentRow.name)}:${String(params.api.getCellValue(params.id, 'status'))}`
        })

        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    rowCount: 2,
                    rowReorder: { onReorder: vi.fn() },
                    columns: [
                        { field: 'name', headerName: 'Name', renderCell },
                        { field: 'status', headerName: 'Status' }
                    ]
                }}
            >
                <MainGrid layoutConfig={{ ...baseLayoutConfig, enableRowReordering: true }} />
            </DashboardDetailsProvider>
        )

        expect(renderCell).toHaveBeenCalled()
        expect(screen.getByTestId('flow-list-table-first-cell')).toHaveTextContent('Alpha:Open')
    })

    it('renders standalone center-zone quiz widgets without requiring the details table', () => {
        render(
            <DashboardDetailsProvider value={details}>
                <MainGrid
                    layoutConfig={{ ...baseLayoutConfig, showDetailsTable: false, showDetailsTitle: false }}
                    centerWidgets={[
                        {
                            id: 'quiz-widget-1',
                            zone: 'center',
                            widgetKey: 'quizWidget',
                            sortOrder: 1,
                            config: { scriptCodename: 'quiz-widget' }
                        }
                    ]}
                />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('center-zone-widget-quizWidget')).toBeInTheDocument()
        expect(screen.getByTestId('rendered-widget-quizWidget')).toBeInTheDocument()
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('renders custom details content instead of the details table when provided', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    content: <div data-testid='custom-page-surface'>Page surface</div>
                }}
            >
                <MainGrid
                    layoutConfig={baseLayoutConfig}
                    centerWidgets={[
                        {
                            id: 'quiz-widget-1',
                            zone: 'center',
                            widgetKey: 'quizWidget',
                            sortOrder: 1,
                            config: { scriptCodename: 'quiz-widget' }
                        }
                    ]}
                />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('dashboard-custom-details-content')).toBeInTheDocument()
        expect(screen.getByTestId('custom-page-surface')).toHaveTextContent('Page surface')
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
        expect(screen.queryByTestId('rendered-widget-quizWidget')).not.toBeInTheDocument()
    })

    it('renders page blocks instead of the details table for nonphysical Page sections', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    pageBlocks: [
                        {
                            id: 'title',
                            type: 'header',
                            data: {
                                level: 2,
                                text: {
                                    _primary: 'en',
                                    locales: {
                                        en: { content: 'Learner Home' }
                                    }
                                }
                            }
                        },
                        {
                            id: 'body',
                            type: 'paragraph',
                            data: {
                                text: {
                                    _primary: 'en',
                                    locales: {
                                        en: { content: 'Continue lessons from one place.' }
                                    }
                                }
                            }
                        },
                        {
                            id: 'practice',
                            type: 'header',
                            data: {
                                level: 3,
                                text: 'Practice'
                            }
                        },
                        {
                            id: 'ordered',
                            type: 'list',
                            data: {
                                style: 'ordered',
                                items: ['First step', 'Second step']
                            }
                        },
                        {
                            id: 'table',
                            type: 'table',
                            data: {
                                withHeadings: true,
                                content: [
                                    ['Metric', 'Value'],
                                    ['Completion', '80%']
                                ]
                            }
                        },
                        {
                            id: 'image',
                            type: 'image',
                            data: {
                                url: 'https://example.com/lesson.png',
                                alt: 'Lesson illustration',
                                caption: 'Lesson image'
                            }
                        },
                        {
                            id: 'embed',
                            type: 'embed',
                            data: {
                                url: 'https://example.com/resource',
                                caption: 'External resource'
                            }
                        }
                    ]
                }}
            >
                <MainGrid layoutConfig={baseLayoutConfig} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('runtime-page-blocks')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-page-outline')).toHaveTextContent('Learner Home')
        expect(screen.getByTestId('runtime-page-outline')).toHaveTextContent('Practice')
        expect(screen.getByRole('heading', { name: 'Learner Home', level: 2 })).toBeInTheDocument()
        expect(screen.getByText('Continue lessons from one place.')).toBeInTheDocument()
        expect(screen.getByText('First step')).toBeInTheDocument()
        expect(screen.getByText('Completion')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Lesson illustration' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'External resource' })).toHaveAttribute('href', 'https://example.com/resource')
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('keeps page blocks visible when a dashboard layout disables the standard details area', () => {
        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    pageBlocks: [{ id: 'body', type: 'paragraph', data: { text: 'Read this page.' } }]
                }}
            >
                <MainGrid
                    layoutConfig={{
                        ...baseLayoutConfig,
                        showDetailsTitle: false,
                        showDetailsTable: false,
                        showColumnsContainer: false
                    }}
                />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('runtime-page-blocks')).toBeInTheDocument()
        expect(screen.getByText('Read this page.')).toBeInTheDocument()
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('renders learner page progress from player metadata', async () => {
        const onProgressChange = vi.fn().mockResolvedValue(undefined)

        render(
            <DashboardDetailsProvider
                value={{
                    ...details,
                    pageBlocks: [{ id: 'body', type: 'paragraph', data: { text: 'Read this page.' } }],
                    pagePlayer: {
                        showProgressHeader: true,
                        showOutline: false,
                        completeButtonMode: 'manual',
                        progressStorageKey: 'test-page-progress',
                        onProgressChange
                    }
                }}
            >
                <MainGrid layoutConfig={baseLayoutConfig} />
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('runtime-page-progress')).toHaveTextContent('Reading progress 0%')
        expect(screen.queryByTestId('runtime-page-outline')).not.toBeInTheDocument()
        await waitFor(() => expect(onProgressChange).toHaveBeenCalledWith({ action: 'view' }))

        fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))

        await waitFor(() => expect(screen.getByTestId('runtime-page-progress')).toHaveTextContent('Reading progress 100%'))
        expect(window.localStorage.getItem('test-page-progress')).toBe('100')
        expect(onProgressChange).toHaveBeenCalledWith({ action: 'complete' })
    })
})
