import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
vi.mock('../PageViewsBarChart', () => ({ default: () => <div data-testid='page-views-chart' /> }))
vi.mock('../SessionsChart', () => ({ default: () => <div data-testid='sessions-chart' /> }))
vi.mock('../StatCard', () => ({ default: () => <div data-testid='stat-card' /> }))
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
