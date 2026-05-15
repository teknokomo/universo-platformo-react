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
    data: { name?: ReactNode }
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
    default: (props: { rows: Array<unknown>; rowCount?: number; hideFooter?: boolean }) => (
        <div
            data-testid='customized-grid'
            data-rows={String(props.rows.length)}
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
        t: (_key: string, fallback?: string) => fallback ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@universo/template-mui', async () => {
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
        ItemCard: (props: MockItemCardProps) => <div data-testid='item-card'>{props.data.name}</div>,
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
        expect(requestedUrl.searchParams.get('search')).toBe('cohort')
        expect(JSON.parse(requestedUrl.searchParams.get('sort') ?? '[]')).toEqual([{ field: 'period', direction: 'asc' }])
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
        expect(screen.getByText('Learner Home')).toBeInTheDocument()
        expect(screen.getByText('Continue lessons from one place.')).toBeInTheDocument()
        expect(screen.getByText('First step')).toBeInTheDocument()
        expect(screen.getByText('Completion')).toBeInTheDocument()
        expect(screen.getByRole('img', { name: 'Lesson illustration' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'External resource' })).toHaveAttribute('href', 'https://example.com/resource')
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })
})
