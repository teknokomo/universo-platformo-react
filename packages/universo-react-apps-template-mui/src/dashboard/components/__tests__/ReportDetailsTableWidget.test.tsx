import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import { reportDefinitionSchema } from '@universo-react/types'
import '../../../i18n'
import { runRuntimeReport, exportRuntimeReportCsv } from '../../../api/api'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import type { DashboardDetailsSlot, ZoneWidgetItem } from '../../contracts'
import { renderWidget } from '../widgetRenderer'
import type { CustomizedDataGridProps } from '../CustomizedDataGrid'
import type { GridRenderCellParams } from '@mui/x-data-grid'

vi.mock('../../../api/api', () => ({ runRuntimeReport: vi.fn(), exportRuntimeReportCsv: vi.fn() }))
vi.mock('../CustomizedDataGrid', async () => {
    const { useEffect, useRef } = await import('react')
    const MockCustomizedDataGrid = (props: CustomizedDataGridProps) => {
        const { columns, onSortModelChange, sortModel } = props
        const previousColumns = useRef(columns)
        useEffect(() => {
            if (previousColumns.current === columns) return
            previousColumns.current = columns
            if (sortModelDuringColumnReconciliation.current) {
                const userSortModel = sortModelDuringColumnReconciliation.current
                sortModelDuringColumnReconciliation.current = null
                onSortModelChange?.(userSortModel)
                return
            }
            const currentSortModel = sortModel ?? []
            const availableFields = new Set(columns.map((column) => column.field))
            const sanitizedSortModel = currentSortModel.filter((item) => availableFields.has(item.field))
            if (sanitizedSortModel.length < currentSortModel.length) onSortModelChange?.(sanitizedSortModel)
        }, [columns, onSortModelChange, sortModel])

        return (
            <div data-testid='report-grid'>
                <span>
                    {props.paginationModel?.page}:{props.rowCount}
                </span>
                <span data-testid='report-sort-model'>{JSON.stringify(props.sortModel ?? [])}</span>
                <span data-testid='report-grid-fields'>{props.columns.map(({ field }) => field).join(',')}</span>
                <span data-testid='report-grid-column-types'>
                    {JSON.stringify(
                        props.columns.map(({ field, type, filterOperators }) => ({
                            field,
                            type,
                            operators: filterOperators?.map((operator) => ({
                                value: operator.value,
                                inputType: (operator as unknown as { InputComponentProps?: { type?: string } }).InputComponentProps?.type
                            }))
                        }))
                    )}
                </span>
                {props.rows.map((row) =>
                    props.columns.map((column) => (
                        <span key={`${row.id}:${column.field}`}>
                            {column.headerName}:
                            {column.renderCell
                                ? column.renderCell({
                                      value: column.valueGetter
                                          ? column.valueGetter(row[column.field], row, column, {} as never)
                                          : row[column.field],
                                      row
                                  } as GridRenderCellParams)
                                : String(
                                      column.valueGetter
                                          ? column.valueGetter(row[column.field], row, column, {} as never) ?? ''
                                          : row[column.field] ?? ''
                                  )}
                        </span>
                    ))
                )}
                <button onClick={() => props.onPaginationModelChange?.({ page: 1, pageSize: 20 })}>Next page</button>
                <button onClick={() => props.onSortModelChange?.([{ field: 'Title', sort: 'asc' }])}>Sort</button>
                <button onClick={() => props.onFilterModelChange?.({ items: [{ field: 'Title', operator: 'contains', value: 'Course' }] })}>
                    Filter
                </button>
                <button
                    onClick={() =>
                        props.onFilterModelChange?.({
                            items: [{ field: 'SubmittedOn', operator: 'is', value: new Date('2026-10-14') }]
                        })
                    }
                >
                    Date filter
                </button>
                <button
                    onClick={() =>
                        props.onFilterModelChange?.({
                            items: [{ field: 'SubmittedAt', operator: 'is', value: new Date('2026-10-14T08:30') }]
                        })
                    }
                >
                    Date-time filter
                </button>
                <button
                    onClick={() =>
                        props.onFilterModelChange?.({
                            items: [{ field: 'TimeOfDay', operator: 'equals', value: '08:30' }]
                        })
                    }
                >
                    Time filter
                </button>
            </div>
        )
    }
    return { default: MockCustomizedDataGrid }
})

const definition = reportDefinitionSchema.parse({
    codename: 'LearningContentSummary',
    title: { en: 'Content summary', ru: 'Сводка контента' },
    datasource: { kind: 'records.list', objectCollectionCodename: 'LearningContent' },
    columns: [{ field: 'Title', label: { en: 'Content title', ru: 'Название контента' }, type: 'text' }]
})
const definitionWithHiddenSort = reportDefinitionSchema.parse({
    ...definition,
    datasource: {
        ...definition.datasource,
        query: { sort: [{ field: 'IssuedAt', direction: 'desc' }] }
    }
})
const definitionWithDateOnlyColumn = reportDefinitionSchema.parse({
    ...definition,
    columns: [{ field: 'SubmittedOn', label: { en: 'Submitted on', ru: 'Дата отправки' }, type: 'date', dateComposition: 'date' }]
})
const definitionWithDateAndDateTimeColumns = reportDefinitionSchema.parse({
    ...definition,
    columns: [
        { field: 'SubmittedOn', label: { en: 'Submitted on', ru: 'Дата отправки' }, type: 'date', dateComposition: 'date' },
        { field: 'SubmittedAt', label: { en: 'Submitted at', ru: 'Время отправки' }, type: 'date', dateComposition: 'datetime' }
    ]
})
const definitionWithTimeOnlyColumn = reportDefinitionSchema.parse({
    ...definition,
    columns: [{ field: 'TimeOfDay', label: { en: 'Time of day', ru: 'Время суток' }, type: 'date', dateComposition: 'time' }]
})
const definitionWithVisibleMultiSort = reportDefinitionSchema.parse({
    ...definition,
    columns: [...definition.columns, { field: 'Description', label: { en: 'Description', ru: 'Описание' }, type: 'text' }],
    datasource: {
        ...definition.datasource,
        query: {
            sort: [
                { field: 'Title', direction: 'asc' },
                { field: 'Description', direction: 'desc' }
            ]
        }
    }
})
const widget: ZoneWidgetItem = {
    id: '019e44fc-a16a-760c-8190-280c4d9dc720',
    instanceKey: 'saved-report',
    widgetKey: 'detailsTable',
    zone: 'center',
    sortOrder: 1,
    isActive: true,
    parentInstanceKey: null,
    slotKey: null,
    config: { variant: 'report', reportCodename: 'LearningContentSummary' },
    runtimeData: { status: 'ready', data: { kind: 'report', codename: 'LearningContentSummary', title: 'Content summary' } }
}
const permissions = {
    createContent: false,
    editContent: false,
    deleteContent: false,
    manageApplication: false,
    manageMembers: false,
    readReports: true
}
const details: DashboardDetailsSlot = {
    title: 'Reports',
    locale: 'en',
    apiBaseUrl: '/api/v1',
    applicationId: 'application-a',
    currentWorkspaceId: 'workspace-a',
    runtimeAccessMode: 'member',
    permissions
}
const clients: QueryClient[] = []
const sortModelDuringColumnReconciliation = vi.hoisted(() => ({
    current: null as Array<{ field: string; sort: 'asc' | 'desc' }> | null
}))
const renderReport = (
    placement = widget,
    context: DashboardDetailsSlot = details,
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
) => {
    clients.push(client)
    return {
        client,
        ...render(
            <QueryClientProvider client={client}>
                <DashboardDetailsProvider value={context}>{renderWidget(placement)}</DashboardDetailsProvider>
            </QueryClientProvider>
        )
    }
}

beforeEach(async () => {
    await i18n.changeLanguage('en')
    vi.mocked(runRuntimeReport).mockResolvedValue({ definition, rows: [{ Title: 'Course overview' }], total: 42, aggregations: {} })
    vi.mocked(exportRuntimeReportCsv).mockResolvedValue(new Blob(['Title\nCourse overview']))
})
afterEach(() => {
    sortModelDuringColumnReconciliation.current = null
    clients.forEach((client) => client.clear())
    clients.length = 0
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

describe('saved report details table', () => {
    it('preserves configured server sorting for a non-displayed field during column reconciliation', async () => {
        vi.mocked(runRuntimeReport).mockResolvedValueOnce({
            definition: definitionWithHiddenSort,
            rows: [{ Title: 'Course overview' }],
            total: 1,
            aggregations: {}
        })
        const { client } = renderReport()

        await screen.findByText('Content title:Course overview')
        await waitFor(() => expect(screen.getByTestId('report-sort-model')).toHaveTextContent('IssuedAt'))

        expect(runRuntimeReport).toHaveBeenCalledTimes(1)
        expect(runRuntimeReport).toHaveBeenLastCalledWith(expect.objectContaining({ sort: undefined }))

        client.clear()
    })

    it('applies a user-selected subset of visible configured sorting during column reconciliation', async () => {
        sortModelDuringColumnReconciliation.current = [{ field: 'Title', sort: 'asc' }]
        vi.mocked(runRuntimeReport).mockResolvedValueOnce({
            definition: definitionWithVisibleMultiSort,
            rows: [{ Title: 'Course overview', Description: 'Introductory material' }],
            total: 1,
            aggregations: {}
        })

        renderReport()

        await waitFor(() =>
            expect(runRuntimeReport).toHaveBeenLastCalledWith(expect.objectContaining({ sort: [{ field: 'Title', direction: 'asc' }] }))
        )
        expect(await screen.findByTestId('report-sort-model')).toHaveTextContent(JSON.stringify([{ field: 'Title', sort: 'asc' }]))
    })

    it('executes existing API, paginates and resets pagination when filtering', async () => {
        renderReport()
        await screen.findByText('Content title:Course overview')
        expect(runRuntimeReport).toHaveBeenLastCalledWith(
            expect.objectContaining({
                applicationId: 'application-a',
                reportCodename: 'LearningContentSummary',
                workspaceId: 'workspace-a',
                locale: 'en',
                limit: 20,
                offset: 0
            })
        )
        fireEvent.click(screen.getByText('Next page'))
        await waitFor(() => expect(runRuntimeReport).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 20 })))
        fireEvent.click(screen.getByText('Filter'))
        await waitFor(() =>
            expect(runRuntimeReport).toHaveBeenLastCalledWith(
                expect.objectContaining({ offset: 0, filters: [expect.objectContaining({ field: 'Title', value: 'Course' })] })
            )
        )
        fireEvent.click(screen.getByText('Sort'))
        await waitFor(() =>
            expect(runRuntimeReport).toHaveBeenLastCalledWith(
                expect.objectContaining({ offset: 0, sort: [{ field: 'Title', direction: 'asc' }] })
            )
        )
    })

    it('keeps report columns available while a server filter refetch is pending', async () => {
        let resolveFilteredReport: ((value: Awaited<ReturnType<typeof runRuntimeReport>>) => void) | undefined
        vi.mocked(runRuntimeReport)
            .mockResolvedValueOnce({ definition, rows: [{ Title: 'Course overview' }], total: 1, aggregations: {} })
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveFilteredReport = resolve
                })
            )

        renderReport()
        await screen.findByText('Content title:Course overview')
        fireEvent.click(screen.getByText('Filter'))

        await waitFor(() => expect(runRuntimeReport).toHaveBeenCalledTimes(2))
        expect(screen.getByTestId('report-grid-fields')).toHaveTextContent('Title')
        expect(screen.getByTestId('report-grid-column-types')).toHaveTextContent('"field":"Title"')

        resolveFilteredReport?.({ definition, rows: [], total: 0, aggregations: {} })
        await waitFor(() => expect(screen.getByTestId('report-grid')).toBeInTheDocument())
        expect(screen.getByTestId('report-grid-fields')).toHaveTextContent('Title')
    })

    it('sends date-only report filters as calendar dates', async () => {
        vi.stubEnv('TZ', 'Europe/Moscow')
        vi.mocked(runRuntimeReport).mockResolvedValueOnce({
            definition: definitionWithDateOnlyColumn,
            rows: [],
            total: 0,
            aggregations: {}
        })

        try {
            renderReport()

            await waitFor(() => expect(screen.getByTestId('report-grid-fields')).toHaveTextContent('SubmittedOn'))
            fireEvent.click(screen.getByText('Date filter'))

            await waitFor(() =>
                expect(runRuntimeReport).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        filters: [{ field: 'SubmittedOn', operator: 'equals', value: '2026-10-14' }]
                    })
                )
            )
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it('configures date and datetime column operators and submits their typed values', async () => {
        vi.stubEnv('TZ', 'Europe/Moscow')
        vi.mocked(runRuntimeReport).mockResolvedValueOnce({
            definition: definitionWithDateAndDateTimeColumns,
            rows: [],
            total: 0,
            aggregations: {}
        })

        try {
            renderReport()

            await waitFor(() => expect(screen.getByTestId('report-grid-fields')).toHaveTextContent('SubmittedOn,SubmittedAt'))
            const columns = JSON.parse(screen.getByTestId('report-grid-column-types').textContent ?? '[]') as Array<{
                field: string
                type: string
                operators: Array<{ value: string; inputType?: string }>
            }>
            expect(columns).toEqual([
                expect.objectContaining({ field: 'SubmittedOn', type: 'date' }),
                expect.objectContaining({ field: 'SubmittedAt', type: 'dateTime' })
            ])
            expect(columns[0]?.operators.find(({ value }) => value === 'is')?.inputType).toBe('date')
            expect(columns[1]?.operators.find(({ value }) => value === 'is')?.inputType).toBe('datetime-local')
            expect(columns.flatMap(({ operators }) => operators.map(({ value }) => value))).not.toContain('not')

            fireEvent.click(screen.getByText('Date-time filter'))
            await waitFor(() =>
                expect(runRuntimeReport).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        filters: [{ field: 'SubmittedAt', operator: 'equals', value: '2026-10-14T08:30:00.000Z' }]
                    })
                )
            )
        } finally {
            vi.unstubAllEnvs()
        }
    })

    it('treats time-only report columns as text filters instead of datetime inputs', async () => {
        vi.mocked(runRuntimeReport).mockResolvedValueOnce({
            definition: definitionWithTimeOnlyColumn,
            rows: [{ TimeOfDay: '08:30:00' }],
            total: 1,
            aggregations: {}
        })

        renderReport()

        await waitFor(() => expect(screen.getByTestId('report-grid-fields')).toHaveTextContent('TimeOfDay'))
        const columns = JSON.parse(screen.getByTestId('report-grid-column-types').textContent ?? '[]') as Array<{
            field: string
            type: string
            operators?: Array<{ inputType?: string }>
        }>
        expect(columns).toEqual([{ field: 'TimeOfDay', type: 'string' }])
        expect(screen.getByText('Time of day:08:30:00')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Time filter'))
        await waitFor(() =>
            expect(runRuntimeReport).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    filters: [{ field: 'TimeOfDay', operator: 'equals', value: '08:30' }]
                })
            )
        )
    })

    it('exports CSV with the same semantic source, filters and scope', async () => {
        const createUrl = vi.fn(() => 'blob:report')
        const revokeUrl = vi.fn()
        vi.stubGlobal(
            'URL',
            class extends URL {
                static createObjectURL = createUrl
                static revokeObjectURL = revokeUrl
            }
        )
        const click = vi.fn()
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
        renderReport()
        await screen.findByText('Content title:Course overview')
        fireEvent.click(screen.getByText('Filter'))
        await waitFor(() =>
            expect(runRuntimeReport).toHaveBeenLastCalledWith(
                expect.objectContaining({ filters: [expect.objectContaining({ value: 'Course' })] })
            )
        )
        await waitFor(() => expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled())
        fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
        await waitFor(() =>
            expect(exportRuntimeReportCsv).toHaveBeenCalledWith(
                expect.objectContaining({
                    reportCodename: 'LearningContentSummary',
                    applicationId: 'application-a',
                    workspaceId: 'workspace-a',
                    locale: 'en',
                    limit: 5000,
                    offset: 0,
                    filters: [expect.objectContaining({ value: 'Course' })]
                })
            )
        )
        await waitFor(() => expect(click).toHaveBeenCalledOnce())
        expect(revokeUrl).toHaveBeenCalledWith('blob:report')
        vi.unstubAllGlobals()
    })

    it.each([
        { runtimeAccessMode: 'public' as const },
        { permissions: { ...permissions, readReports: false } },
        { permissions: undefined }
    ])('denies report execution and export for unauthorized context %j', async (override) => {
        renderReport(widget, { ...details, ...override })
        expect(await screen.findByText('You do not have access to this content.')).toBeInTheDocument()
        expect(runRuntimeReport).not.toHaveBeenCalled()
        expect(exportRuntimeReportCsv).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    })

    it.each([
        undefined,
        { status: 'required-missing' as const },
        { status: 'permission-denied' as const },
        { status: 'ready' as const, data: { kind: 'report' as const, codename: 'OtherReport', title: 'Other' } },
        { status: 'ready' as const, data: { kind: 'title' as const, text: 'Not a report' } }
    ])('requires ready matching report source %j', (runtimeData) => {
        renderReport({ ...widget, runtimeData })
        expect(runRuntimeReport).not.toHaveBeenCalled()
        expect(exportRuntimeReportCsv).not.toHaveBeenCalled()
        expect(screen.queryByTestId('report-grid')).not.toBeInTheDocument()
    })

    it('isolates cached reports by application, workspace and locale', async () => {
        const { client, unmount } = renderReport()
        await screen.findByText('Content title:Course overview')
        unmount()
        for (const override of [{ applicationId: 'application-b' }, { currentWorkspaceId: 'workspace-b' }, { locale: 'ru' }]) {
            const view = renderReport(widget, { ...details, ...override }, client)
            await waitFor(() =>
                expect(runRuntimeReport).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        applicationId: override.applicationId ?? details.applicationId,
                        workspaceId: override.currentWorkspaceId ?? details.currentWorkspaceId,
                        locale: override.locale ?? details.locale
                    })
                )
            )
            view.unmount()
        }
        expect(client.getQueryCache().getAll()).toHaveLength(4)
    })

    it('uses real Russian report labels and localized failures without exposing backend text', async () => {
        await i18n.changeLanguage('ru')
        vi.mocked(runRuntimeReport).mockRejectedValue(new Error('internal SQL error'))
        renderReport(widget, { ...details, locale: 'ru' })
        expect(await screen.findByText('Не удалось загрузить отчёт.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Экспорт CSV' })).toBeDisabled()
        expect(screen.queryByText('internal SQL error')).not.toBeInTheDocument()
    })

    it.each([
        { locale: 'en', expectedStatus: 'Status:Passed', expectedReason: 'Finish reason:Time expired' },
        { locale: 'ru', expectedStatus: 'Статус:Пройдено', expectedReason: 'Причина завершения:Время истекло' }
    ])('localizes declared status columns for $locale reports', async ({ locale, expectedStatus, expectedReason }) => {
        await i18n.changeLanguage(locale)
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'TrainingCompliance',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [
                { field: 'Status', label: { en: 'Status', ru: 'Статус' }, type: 'status' },
                { field: 'FinishedReason', label: { en: 'Finish reason', ru: 'Причина завершения' }, type: 'status' }
            ]
        })
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [{ Status: 'Passed', FinishedReason: 'timed_out' }],
            total: 1,
            aggregations: {}
        })

        renderReport(widget, { ...details, locale })

        expect(await screen.findByText(expectedStatus)).toBeInTheDocument()
        expect(screen.getByText(expectedReason)).toBeInTheDocument()
    })

    it.each([
        { locale: 'en', expectedStatus: 'Status:In progress' },
        { locale: 'ru', expectedStatus: 'Статус:В процессе' }
    ])('localizes in-progress status codenames for $locale reports', async ({ locale, expectedStatus }) => {
        await i18n.changeLanguage(locale)
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'TrainingCompliance',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'ContentProgress' },
            columns: [{ field: 'Status', label: { en: 'Status', ru: 'Статус' }, type: 'status' }]
        })
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [{ Status: 'in_progress' }],
            total: 1,
            aggregations: {}
        })

        renderReport(widget, { ...details, locale })

        expect(await screen.findByText(expectedStatus)).toBeInTheDocument()
        expect(screen.queryByText(/in_progress/u)).not.toBeInTheDocument()
    })

    it('preserves a readable unknown report status', async () => {
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'TrainingCompliance',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [{ field: 'Status', label: { en: 'Status', ru: 'Статус' }, type: 'status' }]
        })
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [{ Status: 'Awaiting review' }],
            total: 1,
            aggregations: {}
        })

        renderReport({
            ...widget,
            config: { variant: 'report', reportCodename: 'QuizAttemptResults' },
            runtimeData: {
                status: 'ready',
                data: { kind: 'report', codename: 'QuizAttemptResults', title: 'Quiz results' }
            }
        })

        expect(await screen.findByText('Status:Awaiting review')).toBeInTheDocument()
    })

    it('hides UUID and JSON-like unknown report statuses', async () => {
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'TrainingCompliance',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [{ field: 'Status', label: { en: 'Status', ru: 'Статус' }, type: 'status' }]
        })
        const uuidStatus = '019e44fc-a16a-760c-8190-280c4d9dc720'
        const jsonLikeStatus = '{"type":"document","url":"https://internal.example/status"}'
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [{ Status: uuidStatus }, { Status: jsonLikeStatus }],
            total: 2,
            aggregations: {}
        })

        renderReport()

        const reportGrid = await screen.findByTestId('report-grid')
        expect(reportGrid).not.toHaveTextContent(uuidStatus)
        expect(reportGrid).not.toHaveTextContent(jsonLikeStatus)
    })

    it.each([
        { locale: 'en', expectedValue: 'Passed:No' },
        { locale: 'ru', expectedValue: 'Тест пройден:Нет' }
    ])('localizes boolean report columns for $locale reports', async ({ locale, expectedValue }) => {
        await i18n.changeLanguage(locale)
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'QuizAttemptResults',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [{ field: 'Passed', label: { en: 'Passed', ru: 'Тест пройден' }, type: 'boolean' }]
        })
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [{ Passed: false }],
            total: 1,
            aggregations: {}
        })

        renderReport(widget, { ...details, locale })

        expect(await screen.findByText(expectedValue)).toBeInTheDocument()
    })

    it('preserves safe report cells and hides technical IDs', async () => {
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: { ...definition, columns: [...definition.columns, { field: 'OwnerId', label: 'OwnerId', type: 'text' }] },
            rows: [{ Title: { label: 'Readable course' }, OwnerId: '019e44fc-a16a-760c-8190-280c4d9dc720' }],
            total: 1,
            aggregations: {}
        })
        renderReport()
        expect(await screen.findByText('Content title:Readable course')).toBeInTheDocument()
        expect(screen.queryByText(/OwnerId|019e44fc|\[object Object\]/)).not.toBeInTheDocument()
    })

    it('renders resolved labels for technical reference columns while hiding raw identifiers', async () => {
        const attemptDefinition = reportDefinitionSchema.parse({
            codename: 'QuizAttemptResults',
            title: { en: 'Quiz results', ru: 'Результаты тестов' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [
                { field: 'QuizId', label: { en: 'Quiz', ru: 'Тест' }, type: 'text' },
                { field: 'StudentId', label: { en: 'Student name', ru: 'Имя студента' }, type: 'text' },
                { field: 'ClassIdSnapshot', label: { en: 'Class', ru: 'Класс' }, type: 'text' }
            ]
        })
        const quizId = '019e44fc-a16a-760c-8190-280c4d9dc720'
        const studentId = '019e44fc-a16a-760c-8190-280c4d9dc721'
        const classId = '019e44fc-a16a-760c-8190-280c4d9dc722'
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: attemptDefinition,
            rows: [
                {
                    QuizId: { id: quizId, label: 'Marathon — Grade 5' },
                    StudentId: { id: studentId, label: 'Alex Example' },
                    ClassIdSnapshot: { id: classId, label: { en: 'Grade 5', ru: '5 класс' } }
                }
            ],
            total: 1,
            aggregations: {}
        })

        renderReport()

        expect(await screen.findByText('Quiz:Marathon — Grade 5')).toBeInTheDocument()
        const reportGrid = screen.getByTestId('report-grid')
        expect(reportGrid).toHaveTextContent('Quiz:Marathon — Grade 5')
        expect(reportGrid).toHaveTextContent('Student name:Alex Example')
        expect(reportGrid).toHaveTextContent('Class:Grade 5')
        expect(reportGrid).not.toHaveTextContent(quizId)
        expect(reportGrid).not.toHaveTextContent(studentId)
        expect(reportGrid).not.toHaveTextContent(classId)
    })

    it('formats date columns as date-time cells instead of rendering raw ISO values', async () => {
        const submittedAt = '2026-10-14T08:30:00.000Z'
        const dateDefinition = reportDefinitionSchema.parse({
            codename: 'QuizAttemptResults',
            title: { en: 'Quiz results' },
            datasource: { kind: 'records.list', sectionCodename: 'QuizAttempts' },
            columns: [{ field: 'SubmittedAt', label: { en: 'Completed at' }, type: 'date' }]
        })
        vi.mocked(runRuntimeReport).mockResolvedValue({
            definition: dateDefinition,
            rows: [{ SubmittedAt: submittedAt }],
            total: 1,
            aggregations: {}
        })

        renderReport()

        expect(await screen.findByText(/^Completed at:/u)).toBeInTheDocument()
        expect(screen.getByTestId('report-grid')).not.toHaveTextContent(submittedAt)
        expect(screen.getByTestId('report-grid')).not.toHaveTextContent('Invalid Date')
    })

    it('localizes CSV failure and permits retry', async () => {
        await i18n.changeLanguage('ru')
        vi.mocked(exportRuntimeReportCsv).mockRejectedValue(new Error('internal export failure'))
        renderReport(widget, { ...details, locale: 'ru' })
        expect(await screen.findByText('Название контента:Course overview')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Экспорт CSV' }))
        expect(await screen.findByText('Ошибка экспорта: Не удалось экспортировать отчёт.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Экспорт CSV' })).toBeEnabled()
        expect(screen.queryByText('internal export failure')).not.toBeInTheDocument()
    })
})
