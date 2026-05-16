import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

vi.mock('../CustomizedDataGrid', () => ({
    default: (props: { rows: Array<unknown>; rowCount?: number; loading?: boolean; onSortModelChange?: unknown }) => (
        <div
            data-testid='customized-grid'
            data-rows={String(props.rows.length)}
            data-row-count={String(props.rowCount ?? 0)}
            data-loading={String(Boolean(props.loading))}
            data-server-sort={String(Boolean(props.onSortModelChange))}
        />
    )
}))

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
    columns: [
        {
            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
            codename: 'title',
            field: 'title',
            dataType: 'STRING',
            headerName: 'Title',
            isRequired: false,
            validationRules: {},
            uiConfig: {}
        }
    ],
    rows: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', title: 'Safety course' }],
    pagination: {
        total: 1,
        limit: 20,
        offset: 0
    },
    layoutConfig: {},
    zoneWidgets: { left: [], right: [], center: [] },
    menus: [],
    activeMenuId: null
})

describe('widgetRenderer detailsTable datasource', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('renders records.list datasources through the shared data grid contract', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => createAppDataResponse()
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'courses' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'courses' }],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-1',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'courses',
                                query: { search: 'Safety' }
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '1')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-server-sort', 'true')

        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.pathname).toBe('/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime')
        expect(requestedUrl.searchParams.get('objectCollectionId')).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(requestedUrl.searchParams.get('search')).toBe('Safety')
        expect(requestedUrl.searchParams.get('locale')).toBe('en')
    })

    it('renders ledger facts datasources through the shared data grid contract', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                rows: [
                    {
                        id: 'fact-1',
                        createdAt: '2026-05-10T10:00:00.000Z',
                        data: {
                            Learner: 'Ana',
                            ProgressDelta: 10
                        }
                    }
                ],
                limit: 20,
                offset: 0
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-1',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'ledger.facts',
                                ledgerId: '017f22e2-79b0-7cc3-98c4-dc0c0c073995'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '1')

        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.pathname).toBe(
            '/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/ledgers/017f22e2-79b0-7cc3-98c4-dc0c0c073995/facts'
        )
        expect(requestedUrl.searchParams.get('limit')).toBe('20')
        expect(requestedUrl.searchParams.get('offset')).toBe('0')
    })

    it('renders inline report definitions through the shared data grid contract', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    rows: [{ ProgressPercent: 75 }],
                    total: 1,
                    definition: {
                        codename: 'LearnerProgress',
                        title: 'Learner progress',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'ModuleProgress'
                        },
                        columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }]
                    }
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        currentWorkspaceId: 'workspace-1',
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'report-widget',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            reportDefinition: {
                                codename: 'LearnerProgress',
                                title: 'Learner progress',
                                datasource: {
                                    kind: 'records.list',
                                    sectionCodename: 'ModuleProgress'
                                },
                                columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '1')

        const requestedUrl = new URL(fetchMock.mock.calls[1][0] as string)
        expect(requestedUrl.pathname).toBe('/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/reports/run')
        expect(requestedUrl.searchParams.get('workspaceId')).toBe('workspace-1')
        expect(fetchMock.mock.calls[1][1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                reportCodename: 'LearnerProgress',
                limit: 20,
                offset: 0
            })
        })
    })

    it('does not render columnsContainer when all child widgets are inactive or missing', () => {
        const { container } = render(
            <>
                {renderWidget({
                    id: 'columns-widget',
                    widgetKey: 'columnsContainer',
                    sortOrder: 0,
                    config: {
                        columns: [
                            { id: 'empty-column', width: 4, widgets: [] },
                            {
                                id: 'inactive-column',
                                width: 4,
                                widgets: [
                                    {
                                        id: 'inactive-table',
                                        widgetKey: 'detailsTable',
                                        isActive: false,
                                        config: {}
                                    }
                                ]
                            }
                        ]
                    }
                })}
            </>
        )

        expect(container).toBeEmptyDOMElement()
    })

    it('renders resourcePreview widgets through the generic resource preview component', () => {
        render(
            <DashboardDetailsProvider value={{ locale: 'en' } as never}>
                {renderWidget({
                    id: 'resource-widget',
                    widgetKey: 'resourcePreview',
                    sortOrder: 0,
                    config: {
                        title: 'Intro video',
                        description: 'Watch before the course.',
                        source: {
                            type: 'video',
                            url: 'https://cdn.example.com/intro.mp4',
                            mimeType: 'video/mp4'
                        }
                    }
                })}
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('resource-preview')).toBeInTheDocument()
        expect(screen.getByText('Intro video')).toBeInTheDocument()
        expect(screen.getByText('Watch before the course.')).toBeInTheDocument()
        expect(screen.getByText('video')).toBeInTheDocument()
    })
})
