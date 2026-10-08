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
vi.mock('../CustomizedDataGrid', () => ({
    default: (props: CustomizedDataGridProps) => (
        <div data-testid='report-grid'>
            <span>
                {props.paginationModel?.page}:{props.rowCount}
            </span>
            {props.rows.map((row) =>
                props.columns.map((column) => (
                    <span key={`${row.id}:${column.field}`}>
                        {column.headerName}:
                        {column.renderCell
                            ? column.renderCell({ value: row[column.field], row } as GridRenderCellParams)
                            : String(row[column.field] ?? '')}
                    </span>
                ))
            )}
            <button onClick={() => props.onPaginationModelChange?.({ page: 1, pageSize: 20 })}>Next page</button>
            <button onClick={() => props.onFilterModelChange?.({ items: [{ field: 'Title', operator: 'contains', value: 'Course' }] })}>
                Filter
            </button>
        </div>
    )
}))

const definition = reportDefinitionSchema.parse({
    codename: 'LearningContentSummary',
    title: { en: 'Content summary', ru: 'Сводка контента' },
    datasource: { kind: 'records.list', objectCollectionCodename: 'LearningContent' },
    columns: [{ field: 'Title', label: { en: 'Content title', ru: 'Название контента' }, type: 'text' }]
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
    clients.forEach((client) => client.clear())
    clients.length = 0
    vi.restoreAllMocks()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
})

describe('saved report details table', () => {
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
