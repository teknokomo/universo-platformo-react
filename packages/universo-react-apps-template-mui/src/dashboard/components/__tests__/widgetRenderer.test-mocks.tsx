import type { ReactNode } from 'react'

export const MockCustomizedDataGrid = ({
    rows,
    columns
}: {
    rows: Array<Record<string, unknown>>
    columns: Array<{
        field: string
        headerName?: string
        renderCell?: (params: { id: string | number }) => ReactNode
    }>
}) => (
    <div data-testid='runtime-table' data-rows={rows.length} data-columns={columns.map(({ field }) => field).join(',')}>
        {rows.map((row) =>
            columns.map(({ field, renderCell }) => (
                <span key={`${String(row.id)}-${field}`}>
                    {renderCell ? renderCell({ id: row.id as string | number }) : String(row[field] ?? '')}
                </span>
            ))
        )}
    </div>
)

export const MockStatCard = ({ title, value }: { title: string; value: string }) => (
    <div data-testid='metric-card'>
        {title}:{value}
    </div>
)

export const MockSessionsChart = ({
    title,
    interval,
    xAxisData,
    series
}: {
    title: string
    interval?: string
    xAxisData?: string[]
    series: Array<{ data: number[] }>
}) => (
    <div
        data-testid='sessions-chart'
        data-series={series.map(({ data }) => data.join(',')).join(';')}
        data-interval={interval}
        data-axis={xAxisData?.join('|')}
    >
        {title}
    </div>
)

export const MockPageViewsBarChart = ({
    title,
    interval,
    xAxisData,
    series
}: {
    title: string
    interval?: string
    xAxisData?: string[]
    series: Array<{ data: number[] }>
}) => (
    <div
        data-testid='page-views-chart'
        data-series={series.map(({ data }) => data.join(',')).join(';')}
        data-interval={interval}
        data-axis={xAxisData?.join('|')}
    >
        {title}
    </div>
)

export const MockPageBlocksView = ({
    blocks,
    completeButtonMode = 'manual',
    onProgressChange
}: {
    blocks: unknown[]
    completeButtonMode?: 'manual' | 'autoAfterOpen' | 'hidden'
    onProgressChange?: (payload: { action: 'view' | 'complete' }) => void
}) => (
    <div data-testid='learner-page-blocks' data-count={blocks.length}>
        {completeButtonMode === 'manual' ? (
            <button type='button' data-testid='learner-page-complete' onClick={() => onProgressChange?.({ action: 'complete' })}>
                Complete
            </button>
        ) : null}
    </div>
)

export function MockFlowListTable<T extends { id: string }>({
    data,
    customColumns,
    renderActions,
    sortableRows,
    onSortableDragEnd,
    tableAriaLabel,
    sortableColumnLabel
}: {
    data: T[]
    customColumns?: Array<{ id: string; label: ReactNode; render?: (row: T) => ReactNode }>
    renderActions?: (row: T) => ReactNode
    sortableRows?: boolean
    onSortableDragEnd?: (event: { active: { id: string }; over?: { id: string } | null }) => void
    tableAriaLabel?: string
    sortableColumnLabel?: string
}) {
    return (
        <>
            <table aria-label={tableAriaLabel} data-testid='relation-table' data-sortable={sortableRows ? 'true' : 'false'}>
                <thead>
                    <tr>
                        {sortableRows ? <th aria-label={sortableColumnLabel} /> : null}
                        {customColumns?.map((column) => (
                            <th key={column.id}>{column.label}</th>
                        ))}
                        {renderActions ? <th /> : null}
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.id}>
                            {customColumns?.map((column) => (
                                <td key={column.id}>{column.render?.(row) ?? ''}</td>
                            ))}
                            {renderActions ? <td>{renderActions(row)}</td> : null}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div>
                {sortableRows && data.length > 1 ? (
                    <button type='button' onClick={() => onSortableDragEnd?.({ active: { id: data[1]!.id }, over: { id: data[0]!.id } })}>
                        Move second row up
                    </button>
                ) : null}
            </div>
        </>
    )
}

export const MockColorModeIconDropdown = ({
    'aria-label': label,
    labels
}: {
    'aria-label'?: string
    labels?: { system: string; light: string; dark: string }
}) => (
    <button
        aria-label={label}
        data-system-label={labels?.system}
        data-light-label={labels?.light}
        data-dark-label={labels?.dark}
        type='button'
    />
)

export const MockResourcePreview = ({ title, source }: { title: string; source: { url?: string } }) => (
    <div data-testid='resource-preview' data-source={source.url}>
        {title}
    </div>
)
