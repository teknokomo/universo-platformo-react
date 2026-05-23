import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type React from 'react'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

vi.mock('../CustomizedDataGrid', () => ({
    default: (props: {
        rows: Array<Record<string, unknown>>
        columns?: Array<{
            field: string
            headerName?: string
            renderCell?: (params: { row: Record<string, unknown>; value: unknown }) => React.ReactNode
        }>
        rowCount?: number
        loading?: boolean
        onSortModelChange?: unknown
        onPaginationModelChange?: (model: { page: number; pageSize: number }) => void
        onFilterModelChange?: (model: { items: Array<{ field: string; operator: string; value?: string }> }) => void
        columnVisibilityModel?: Record<string, boolean>
    }) => {
        const renderedCells = props.rows.flatMap((row) =>
            (props.columns ?? []).flatMap((column) => {
                if (!column.renderCell) return []
                return <div key={`${row.id}-${column.field}`}>{column.renderCell({ row, value: row[column.field] })}</div>
            })
        )

        return (
            <div
                data-testid='customized-grid'
                data-rows={String(props.rows.length)}
                data-row-ids={props.rows.map((row) => String(row.id)).join(',')}
                data-row-count={String(props.rowCount ?? 0)}
                data-column-fields={(props.columns ?? []).map((column) => column.field).join(',')}
                data-column-headers={(props.columns ?? []).map((column) => column.headerName ?? column.field).join(',')}
                data-hidden-fields={Object.entries(props.columnVisibilityModel ?? {})
                    .filter(([, visible]) => visible === false)
                    .map(([field]) => field)
                    .join(',')}
                data-loading={String(Boolean(props.loading))}
                data-server-sort={String(Boolean(props.onSortModelChange))}
            >
                <button
                    type='button'
                    data-testid='mock-grid-next-page'
                    onClick={() => props.onPaginationModelChange?.({ page: 1, pageSize: 10 })}
                >
                    next
                </button>
                <button
                    type='button'
                    data-testid='mock-grid-sort-title'
                    onClick={() => {
                        const handler = props.onSortModelChange as
                            | ((model: Array<{ field: string; sort: 'asc' | 'desc' }>) => void)
                            | undefined
                        handler?.([{ field: 'title', sort: 'desc' }])
                    }}
                >
                    sort
                </button>
                <button
                    type='button'
                    data-testid='mock-grid-filter-status'
                    onClick={() =>
                        props.onFilterModelChange?.({
                            items: [{ field: 'status', operator: 'equals', value: 'Published' }]
                        })
                    }
                >
                    filter
                </button>
                <button
                    type='button'
                    data-testid='mock-grid-filter-first-column'
                    onClick={() =>
                        props.onFilterModelChange?.({
                            items: [{ field: props.columns?.[0]?.field ?? 'status', operator: 'equals', value: 'Published' }]
                        })
                    }
                >
                    filter first column
                </button>
                {renderedCells}
            </div>
        )
    }
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

    it('sanitizes records.list datasource load failures before rendering table errors', async () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: `SQL relation app_runtime.learning_resources failed for ${rawRecordId}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        )
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'LearningResources' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'LearningResources' }],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-list-error',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'LearningResources'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('This content view could not be loaded.')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('SQL relation')
        expect(document.body).not.toHaveTextContent('app_runtime.learning_resources')
        expect(document.body).not.toHaveTextContent(rawRecordId)
    })

    it('applies table column presets to records.list datasources without exposing hidden technical columns', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...createAppDataResponse(),
                columns: [
                    {
                        id: 'title-column',
                        codename: 'Title',
                        field: 'Title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'status-column',
                        codename: 'Status',
                        field: 'Status',
                        dataType: 'STRING',
                        headerName: 'Status',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'project-column',
                        codename: 'ProjectId',
                        field: 'ProjectId',
                        dataType: 'REF',
                        headerName: 'Project',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'created-by-column',
                        codename: 'CreatedBy',
                        field: 'CreatedBy',
                        dataType: 'REF',
                        headerName: 'Created by',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'source-json-column',
                        codename: 'sourceJson',
                        field: 'sourceJson',
                        dataType: 'JSON',
                        headerName: 'Source payload',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: {}
                    }
                ],
                rows: [
                    {
                        id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992',
                        Title: 'Safety page',
                        Status: 'Published',
                        ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                        CreatedBy: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                        sourceJson: { type: 'url', url: 'https://example.test/page' }
                    }
                ]
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
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'LearningResources' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'LearningResources' }],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            columnPreset: {
                                columns: [
                                    { field: 'ProjectId', visible: true },
                                    { field: 'Title', visible: true, flex: 1 },
                                    { field: 'CreatedBy', visible: true },
                                    { field: 'Status', visible: true, width: 160 },
                                    { field: 'sourceJson', visible: true }
                                ]
                            }
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-records-list-preset',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'LearningResources'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'Title,Status')
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('ProjectId'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('CreatedBy'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('sourceJson'))
    })

    it('renders localized row-count warnings for large records.list datasources', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...createAppDataResponse(),
                pagination: {
                    total: 120,
                    limit: 20,
                    offset: 0
                }
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
                        locale: 'ru',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-large-outline',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems'
                            },
                            rowCountWarning: {
                                threshold: 100,
                                message: {
                                    _primary: 'en',
                                    locales: {
                                        en: { content: 'Large outline' },
                                        ru: { content: 'Большая структура' }
                                    }
                                }
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Большая структура')).toBeInTheDocument()
    })

    it('renders sequence availability for detailsTable rows without a custom LMS widget', async () => {
        const firstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073994'
        const secondItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073995'
        const otherCourseFirstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'
        const firstCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const secondCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...createAppDataResponse(),
                columns: [
                    {
                        id: 'title-column',
                        codename: 'Title',
                        field: 'title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: true,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'course-column',
                        codename: 'CourseId',
                        field: 'CourseId',
                        dataType: 'REF',
                        headerName: 'Course',
                        isRequired: true,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'sort-order-column',
                        codename: 'SortOrder',
                        field: 'SortOrder',
                        dataType: 'NUMBER',
                        headerName: 'Sort Order',
                        isRequired: true,
                        validationRules: {},
                        uiConfig: {}
                    }
                ],
                rows: [
                    { id: firstItemId, title: 'Intro page', CourseId: firstCourseId, SortOrder: 1 },
                    { id: secondItemId, title: 'Assessment', CourseId: firstCourseId, SortOrder: 2 },
                    { id: otherCourseFirstItemId, title: 'Other course intro', CourseId: secondCourseId, SortOrder: 1 }
                ],
                pagination: {
                    total: 3,
                    limit: 20,
                    offset: 0
                }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course completion',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            columnPreset: {
                                columns: [
                                    { field: 'title', visible: true, flex: 1 },
                                    { field: 'SortOrder', visible: true, width: 120 },
                                    { field: 'CourseId', visible: false }
                                ]
                            }
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-sequence-outline',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            sequencePolicy: {
                                mode: 'sequential',
                                scopeFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findAllByText('Available')).toHaveLength(2)
        expect(await screen.findByText('Locked')).toBeInTheDocument()
        expect(screen.getByTestId('customized-grid')).toHaveAttribute(
            'data-column-fields',
            '__runtimeSequenceAvailability,__runtimeSequenceLockedBy,title,SortOrder'
        )
        expect(screen.getAllByText('Intro page').some((element) => element.tagName.toLowerCase() === 'p')).toBe(true)
        expect(screen.queryByText(firstItemId)).not.toBeInTheDocument()
        expect(screen.queryByText(otherCourseFirstItemId)).not.toBeInTheDocument()
    })

    it('renders prerequisite sequence locked-by labels without exposing step IDs', async () => {
        const firstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073994'
        const secondItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073995'
        const thirdItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                ...createAppDataResponse(),
                columns: [
                    {
                        id: 'title-column',
                        codename: 'Title',
                        field: 'Title',
                        dataType: 'STRING',
                        headerName: 'Title',
                        isRequired: true,
                        validationRules: {},
                        uiConfig: {}
                    },
                    {
                        id: 'prerequisite-column',
                        codename: 'PrerequisiteIds',
                        field: 'PrerequisiteIds',
                        dataType: 'STRING',
                        headerName: 'Prerequisites',
                        isRequired: false,
                        validationRules: {},
                        uiConfig: { hidden: true }
                    }
                ],
                rows: [
                    { id: firstItemId, Title: 'Intro page', CourseId: courseId },
                    { id: secondItemId, Title: 'Read policy', CourseId: courseId },
                    { id: thirdItemId, Title: 'Final check', CourseId: courseId, PrerequisiteIds: `${firstItemId}, ${secondItemId}` }
                ],
                pagination: {
                    total: 3,
                    limit: 20,
                    offset: 0
                }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course completion',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            columnPreset: {
                                columns: [{ field: 'Title', visible: true, flex: 1 }]
                            }
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-prerequisite-outline',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems'
                            },
                            sequencePolicy: {
                                mode: 'prerequisite',
                                scopeFieldCodename: 'CourseId',
                                prerequisiteFieldCodename: 'PrerequisiteIds'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Prerequisite locked')).toBeInTheDocument()
        expect(screen.getByText('Intro page, Read policy')).toBeInTheDocument()
        expect(screen.queryByText(firstItemId)).not.toBeInTheDocument()
        expect(screen.queryByText(secondItemId)).not.toBeInTheDocument()
    })

    it('renders a generic learner player and completes the selected sequence item through the progress endpoint', async () => {
        const user = userEvent.setup()
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073970'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073971'
        const resourcesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073972'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073973'
        const firstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073974'
        const secondItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073975'
        const resourceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073976'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 })
            }
            if (url.pathname.endsWith('/runtime/progress/content')) {
                const action = JSON.parse(String(init?.body ?? '{}')).action
                return new Response(
                    JSON.stringify({
                        persisted: true,
                        progressPercent: action === 'complete' ? 100 : 0,
                        status: action === 'complete' ? 'completed' : 'inProgress'
                    }),
                    { status: 200 }
                )
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'course-title-column',
                                codename: 'Title',
                                field: 'cmp_course_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, cmp_course_title: 'Safety course' }],
                        pagination: { total: 1, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === courseItemsSectionId) {
                expect(url.searchParams.get('filters')).toContain(courseId)
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                        objectCollection: {
                            id: courseItemsSectionId,
                            codename: 'CourseItems',
                            tableName: 'course_items',
                            name: 'Course Items'
                        },
                        columns: [
                            {
                                id: 'item-course-column',
                                codename: 'CourseId',
                                field: 'cmp_item_course_id',
                                dataType: 'REF',
                                headerName: 'Course',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'item-title-column',
                                codename: 'Title',
                                field: 'cmp_item_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'item-target-object-column',
                                codename: 'TargetObjectCodename',
                                field: 'cmp_item_target_object',
                                dataType: 'STRING',
                                headerName: 'Target Object',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'item-target-record-column',
                                codename: 'TargetRecordId',
                                field: 'cmp_item_target_record',
                                dataType: 'REF',
                                headerName: 'Target Record',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'item-sort-order-column',
                                codename: 'SortOrder',
                                field: 'cmp_item_sort_order',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: firstItemId,
                                cmp_item_course_id: courseId,
                                cmp_item_title: 'Intro page',
                                cmp_item_target_object: 'LearningResources',
                                cmp_item_target_record: resourceId,
                                cmp_item_sort_order: 1
                            },
                            {
                                id: secondItemId,
                                cmp_item_course_id: courseId,
                                cmp_item_title: 'Final check',
                                cmp_item_target_object: 'LearningResources',
                                cmp_item_target_record: resourceId,
                                cmp_item_sort_order: 2
                            }
                        ],
                        pagination: { total: 2, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === resourcesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        objectCollection: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        columns: [
                            {
                                id: 'resource-title-column',
                                codename: 'Title',
                                field: 'cmp_resource_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'resource-description-column',
                                codename: 'Description',
                                field: 'cmp_resource_description',
                                dataType: 'STRING',
                                headerName: 'Description',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'resource-source-column',
                                codename: 'Source',
                                field: 'cmp_resource_source',
                                dataType: 'JSON',
                                headerName: 'Source',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: resourceId,
                                cmp_resource_title: 'Intro resource',
                                cmp_resource_description: 'Open the guide.',
                                cmp_resource_source: { type: 'url', url: 'https://example.com/course-guide', launchMode: 'newTab' }
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            throw new Error(`Unexpected request ${String(input)} ${String(init?.method ?? 'GET')}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        objectCollections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-player',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses',
                                query: { sort: [{ field: 'Title', direction: 'asc' }] }
                            },
                            itemsDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            parentFieldCodename: 'CourseId',
                            completionTargetObjectCodename: 'CourseItems',
                            sequencePolicy: {
                                mode: 'sequential',
                                scopeFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder'
                            },
                            targetContent: {
                                titleFieldCodename: 'Title',
                                descriptionFieldCodename: 'Description',
                                sourceFieldCodename: 'Source'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('learner-player')).toBeInTheDocument()
        expect(screen.getByText('Safety course')).toBeInTheDocument()
        expect(screen.getAllByText(/Intro page/).length).toBeGreaterThan(0)
        expect(screen.getByText(/Final check/)).toBeInTheDocument()
        expect(screen.getByText('Locked')).toBeInTheDocument()
        expect(screen.getByText('Learning Resources')).toBeInTheDocument()
        expect(screen.queryByText('LearningResources')).not.toBeInTheDocument()
        expect(await screen.findByTestId('resource-preview')).toBeInTheDocument()
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([input, init]) => {
                    if (!String(input).includes('/runtime/progress/content')) return false
                    return JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')).action === 'view'
                })
            ).toBe(true)
        )

        await user.click(screen.getByRole('button', { name: 'Complete' }))

        await waitFor(() => expect(screen.getByText('1 of 2 completed')).toBeInTheDocument())
        const progressRequest = fetchMock.mock.calls.find(([input, init]) => {
            if (!String(input).includes('/runtime/progress/content')) return false
            return JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')).action === 'complete'
        })
        expect(progressRequest?.[1]).toMatchObject({ method: 'POST' })
        expect(JSON.parse(String(progressRequest?.[1]?.body))).toEqual(
            expect.objectContaining({
                targetObjectCodename: 'CourseItems',
                targetRecordId: firstItemId,
                action: 'complete'
            })
        )
    })

    it('derives learner player progress from persisted item status after data load', async () => {
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d10'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d11'
        const resourcesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d12'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d13'
        const firstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d14'
        const secondItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d15'
        const resourceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073d16'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            { id: 'course-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' }
                        ],
                        rows: [{ id: courseId, Title: 'Persisted progress course' }],
                        pagination: { total: 1, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === courseItemsSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                        objectCollection: {
                            id: courseItemsSectionId,
                            codename: 'CourseItems',
                            tableName: 'course_items',
                            name: 'Course Items'
                        },
                        columns: [
                            { id: 'item-course-column', codename: 'CourseId', field: 'CourseId', dataType: 'REF', headerName: 'Course' },
                            { id: 'item-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' },
                            {
                                id: 'item-target-object-column',
                                codename: 'TargetObjectCodename',
                                field: 'TargetObjectCodename',
                                dataType: 'STRING',
                                headerName: 'Target Object'
                            },
                            {
                                id: 'item-target-record-column',
                                codename: 'TargetRecordId',
                                field: 'TargetRecordId',
                                dataType: 'REF',
                                headerName: 'Target Record'
                            },
                            {
                                id: 'item-sort-order-column',
                                codename: 'SortOrder',
                                field: 'SortOrder',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order'
                            },
                            {
                                id: 'item-progress-status-column',
                                codename: 'ProgressStatus',
                                field: 'ProgressStatus',
                                dataType: 'STRING',
                                headerName: 'Progress Status'
                            },
                            {
                                id: 'item-progress-percent-column',
                                codename: 'ProgressPercent',
                                field: 'ProgressPercent',
                                dataType: 'NUMBER',
                                headerName: 'Progress Percent'
                            }
                        ],
                        rows: [
                            {
                                id: firstItemId,
                                CourseId: courseId,
                                Title: 'Completed from server',
                                TargetObjectCodename: 'LearningResources',
                                TargetRecordId: resourceId,
                                SortOrder: 1,
                                ProgressStatus: 'completed',
                                ProgressPercent: 100
                            },
                            {
                                id: secondItemId,
                                CourseId: courseId,
                                Title: 'Next item',
                                TargetObjectCodename: 'LearningResources',
                                TargetRecordId: resourceId,
                                SortOrder: 2,
                                ProgressStatus: 'notStarted',
                                ProgressPercent: 0
                            }
                        ],
                        pagination: { total: 2, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === resourcesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        objectCollection: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        columns: [
                            { id: 'resource-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' }
                        ],
                        rows: [{ id: resourceId, Title: 'Persisted resource' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (url.pathname.endsWith('/runtime/progress/content')) {
                return new Response(JSON.stringify({ persisted: true, progressPercent: 0, status: 'viewed' }), { status: 200 })
            }
            throw new Error(`Unexpected request ${String(input)}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        objectCollections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-player',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: { kind: 'records.list', sectionCodename: 'Courses' },
                            itemsDatasource: { kind: 'records.list', sectionCodename: 'CourseItems' },
                            parentFieldCodename: 'CourseId',
                            completionTargetObjectCodename: 'CourseItems',
                            sequencePolicy: {
                                mode: 'sequential',
                                scopeFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder'
                            },
                            targetContent: { titleFieldCodename: 'Title' }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('1 of 2 completed')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Learner progress' })).toHaveAttribute('aria-valuenow', '50')
        expect(screen.getAllByText(/Completed from server/).length).toBeGreaterThan(0)
    })

    it('restores learner player item progress from the persisted progress endpoint after reload', async () => {
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e10'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e11'
        const resourcesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e12'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e13'
        const firstItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e14'
        const secondItemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e15'
        const resourceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073e16'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (url.pathname.endsWith('/runtime/progress/content')) {
                const body = JSON.parse(String(init?.body ?? '{}')) as {
                    action?: string
                    targetObjectCodename?: string
                    targetRecordId?: string
                }
                const restoredFirstItem =
                    body.action === 'view' && body.targetObjectCodename === 'CourseItems' && body.targetRecordId === firstItemId
                return new Response(
                    JSON.stringify({
                        persisted: true,
                        progressPercent: restoredFirstItem ? 100 : 0,
                        status: restoredFirstItem ? 'completed' : 'inProgress'
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            { id: 'course-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' }
                        ],
                        rows: [{ id: courseId, Title: 'Restored progress course' }],
                        pagination: { total: 1, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === courseItemsSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                        objectCollection: {
                            id: courseItemsSectionId,
                            codename: 'CourseItems',
                            tableName: 'course_items',
                            name: 'Course Items'
                        },
                        columns: [
                            { id: 'item-course-column', codename: 'CourseId', field: 'CourseId', dataType: 'REF', headerName: 'Course' },
                            { id: 'item-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' },
                            {
                                id: 'item-target-object-column',
                                codename: 'TargetObjectCodename',
                                field: 'TargetObjectCodename',
                                dataType: 'STRING',
                                headerName: 'Target Object'
                            },
                            {
                                id: 'item-target-record-column',
                                codename: 'TargetRecordId',
                                field: 'TargetRecordId',
                                dataType: 'REF',
                                headerName: 'Target Record'
                            },
                            {
                                id: 'item-sort-order-column',
                                codename: 'SortOrder',
                                field: 'SortOrder',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order'
                            }
                        ],
                        rows: [
                            {
                                id: firstItemId,
                                CourseId: courseId,
                                Title: 'Restored from endpoint',
                                TargetObjectCodename: 'LearningResources',
                                TargetRecordId: resourceId,
                                SortOrder: 1
                            },
                            {
                                id: secondItemId,
                                CourseId: courseId,
                                Title: 'Next item',
                                TargetObjectCodename: 'LearningResources',
                                TargetRecordId: resourceId,
                                SortOrder: 2
                            }
                        ],
                        pagination: { total: 2, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === resourcesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        objectCollection: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        columns: [
                            { id: 'resource-title-column', codename: 'Title', field: 'Title', dataType: 'STRING', headerName: 'Title' }
                        ],
                        rows: [{ id: resourceId, Title: 'Restored resource' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            throw new Error(`Unexpected request ${String(input)}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073e93',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        objectCollections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-player',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: { kind: 'records.list', sectionCodename: 'Courses' },
                            itemsDatasource: { kind: 'records.list', sectionCodename: 'CourseItems' },
                            parentFieldCodename: 'CourseId',
                            completionTargetObjectCodename: 'CourseItems',
                            sequencePolicy: {
                                mode: 'sequential',
                                scopeFieldCodename: 'CourseId',
                                orderFieldCodename: 'SortOrder'
                            },
                            targetContent: { titleFieldCodename: 'Title' }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('1 of 2 completed')).toBeInTheDocument()
        expect(screen.getByRole('progressbar', { name: 'Learner progress' })).toHaveAttribute('aria-valuenow', '50')
        expect(
            fetchMock.mock.calls.some(([input, init]) => {
                if (!String(input).includes('/runtime/progress/content')) return false
                const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')) as {
                    action?: string
                    targetObjectCodename?: string
                    targetRecordId?: string
                }
                return body.action === 'view' && body.targetObjectCodename === 'CourseItems' && body.targetRecordId === firstItemId
            })
        ).toBe(true)
    })

    it('renders learner player missing record titles without exposing row ids', async () => {
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b01'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b02'
        const resourcesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b06'
        const firstCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b03'
        const secondCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b04'
        const itemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b05'
        const resourceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073b07'

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')

            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'missing-course-title-column',
                                codename: 'Title',
                                field: 'cmp_course_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            { id: firstCourseId, cmp_course_title: firstCourseId },
                            { id: secondCourseId, cmp_course_title: secondCourseId }
                        ],
                        pagination: { total: 2, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            if (objectCollectionId === courseItemsSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                        objectCollection: {
                            id: courseItemsSectionId,
                            codename: 'CourseItems',
                            tableName: 'course_items',
                            name: 'Course Items'
                        },
                        columns: [
                            {
                                id: 'missing-item-course-column',
                                codename: 'CourseId',
                                field: 'cmp_item_course_id',
                                dataType: 'REF',
                                headerName: 'Course',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'missing-item-title-column',
                                codename: 'Title',
                                field: 'cmp_item_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'missing-item-target-object-column',
                                codename: 'TargetObjectCodename',
                                field: 'cmp_item_target_object',
                                dataType: 'STRING',
                                headerName: 'Target Object',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'missing-item-target-record-column',
                                codename: 'TargetRecordId',
                                field: 'cmp_item_target_record',
                                dataType: 'REF',
                                headerName: 'Target Record',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'missing-item-sort-order-column',
                                codename: 'SortOrder',
                                field: 'cmp_item_sort_order',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: itemId,
                                cmp_item_course_id: firstCourseId,
                                cmp_item_title: itemId,
                                cmp_item_target_object: 'LearningResources',
                                cmp_item_target_record: resourceId,
                                cmp_item_sort_order: 1
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            if (objectCollectionId === resourcesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        objectCollection: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        columns: [
                            {
                                id: 'missing-resource-title-column',
                                codename: 'Title',
                                field: 'cmp_resource_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'missing-resource-source-column',
                                codename: 'Source',
                                field: 'cmp_resource_source',
                                dataType: 'JSON',
                                headerName: 'Source',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: resourceId,
                                cmp_resource_title: resourceId,
                                cmp_resource_source: { type: 'url', url: 'https://example.com/untitled-resource', launchMode: 'sameTab' }
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            throw new Error(`Unexpected request ${String(input)}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        objectCollections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-player-missing-labels',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            itemsDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            parentFieldCodename: 'CourseId',
                            targetContent: {
                                titleFieldCodename: 'Title'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('learner-player')).toBeInTheDocument()
        expect(screen.getAllByText('Untitled content').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Untitled item/).length).toBeGreaterThan(0)
        expect(await screen.findByTestId('resource-preview')).toHaveTextContent('Untitled item')
        expect(document.body).not.toHaveTextContent(firstCourseId)
        expect(document.body).not.toHaveTextContent(secondCourseId)
        expect(document.body).not.toHaveTextContent(itemId)
        expect(document.body).not.toHaveTextContent(resourceId)
    })

    it('honors generic learner player page settings for outline, progress, and completion controls', async () => {
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a71'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a72'
        const resourcesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a73'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a74'
        const itemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a75'
        const resourceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a76'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/runtime/progress/content')) {
                return new Response(JSON.stringify({ persisted: true, progressPercent: 0, status: 'viewed' }), { status: 200 })
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'settings-course-title-column',
                                codename: 'Title',
                                field: 'cmp_course_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, cmp_course_title: 'Configured course' }],
                        pagination: { total: 1, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === courseItemsSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                        objectCollection: {
                            id: courseItemsSectionId,
                            codename: 'CourseItems',
                            tableName: 'course_items',
                            name: 'Course Items'
                        },
                        columns: [
                            {
                                id: 'settings-item-course-column',
                                codename: 'CourseId',
                                field: 'cmp_item_course_id',
                                dataType: 'REF',
                                headerName: 'Course',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'settings-item-title-column',
                                codename: 'Title',
                                field: 'cmp_item_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'settings-item-target-object-column',
                                codename: 'TargetObjectCodename',
                                field: 'cmp_item_target_object',
                                dataType: 'STRING',
                                headerName: 'Target Object',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'settings-item-target-record-column',
                                codename: 'TargetRecordId',
                                field: 'cmp_item_target_record',
                                dataType: 'REF',
                                headerName: 'Target Record',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'settings-item-sort-order-column',
                                codename: 'SortOrder',
                                field: 'cmp_item_sort_order',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: itemId,
                                cmp_item_course_id: courseId,
                                cmp_item_title: 'Configured page',
                                cmp_item_target_object: 'LearningResources',
                                cmp_item_target_record: resourceId,
                                cmp_item_sort_order: 1
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === resourcesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        objectCollection: {
                            id: resourcesSectionId,
                            codename: 'LearningResources',
                            tableName: 'learning_resources',
                            name: 'Learning Resources'
                        },
                        columns: [
                            {
                                id: 'settings-resource-title-column',
                                codename: 'Title',
                                field: 'cmp_resource_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'settings-resource-body-column',
                                codename: 'Body',
                                field: 'cmp_resource_body',
                                dataType: 'JSON',
                                headerName: 'Body',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: resourceId,
                                cmp_resource_title: 'Configured resource',
                                cmp_resource_body: [
                                    { id: 'intro', type: 'header', data: { level: 2, text: 'Intro' } },
                                    { id: 'practice', type: 'header', data: { level: 3, text: 'Practice' } },
                                    { id: 'body', type: 'paragraph', data: { text: 'Read this configured page.' } }
                                ]
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            throw new Error(`Unexpected request ${String(input)} ${String(init?.method ?? 'GET')}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Course player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        pagePlayer: {
                            showOutline: false,
                            showProgressHeader: false,
                            completeButtonMode: 'hidden'
                        },
                        sections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        objectCollections: [
                            { id: coursesSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' },
                            { id: resourcesSectionId, codename: 'LearningResources' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-player-settings',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            itemsDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            parentFieldCodename: 'CourseId',
                            completionTargetObjectCodename: 'CourseItems',
                            targetContent: {
                                titleFieldCodename: 'Title',
                                bodyFieldCodename: 'Body'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('learner-player')).toBeInTheDocument()
        expect(screen.getByText('Configured course')).toBeInTheDocument()
        expect(screen.getByText('Configured page')).toBeInTheDocument()
        expect(await screen.findByTestId('runtime-page-blocks')).toHaveTextContent('Read this configured page.')
        expect(screen.queryByTestId('learner-player-outline')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-page-outline')).not.toBeInTheDocument()
        expect(screen.queryByLabelText('Learner progress')).not.toBeInTheDocument()
        expect(screen.queryByText('0 of 1 completed')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Mark complete' })).not.toBeInTheDocument()
    })

    it('renders learner player targets from a static metadata-defined target object', async () => {
        const user = userEvent.setup()
        const tracksSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a01'
        const trackStepsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a02'
        const coursesSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a03'
        const trackId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a04'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a05'
        const stepId = '017f22e2-79b0-7cc3-98c4-dc0c0c073a06'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 })
            }
            if (url.pathname.endsWith('/runtime/progress/content')) {
                const action = JSON.parse(String(init?.body ?? '{}')).action
                return new Response(
                    JSON.stringify({
                        persisted: true,
                        progressPercent: action === 'complete' ? 100 : 0,
                        status: action === 'complete' ? 'completed' : 'inProgress'
                    }),
                    { status: 200 }
                )
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === tracksSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: tracksSectionId, codename: 'LearningTracks', tableName: 'learning_tracks', name: 'Learning Tracks' },
                        objectCollection: {
                            id: tracksSectionId,
                            codename: 'LearningTracks',
                            tableName: 'learning_tracks',
                            name: 'Learning Tracks'
                        },
                        columns: [
                            {
                                id: 'track-title-column',
                                codename: 'Title',
                                field: 'cmp_track_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: trackId, cmp_track_title: 'Onboarding track' }],
                        pagination: { total: 1, limit: 50, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === trackStepsSectionId) {
                expect(url.searchParams.get('filters')).toContain(trackId)
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: trackStepsSectionId, codename: 'TrackSteps', tableName: 'track_steps', name: 'Track Steps' },
                        objectCollection: {
                            id: trackStepsSectionId,
                            codename: 'TrackSteps',
                            tableName: 'track_steps',
                            name: 'Track Steps'
                        },
                        columns: [
                            {
                                id: 'step-track-column',
                                codename: 'TrackId',
                                field: 'cmp_step_track_id',
                                dataType: 'REF',
                                headerName: 'Track',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'step-course-column',
                                codename: 'CourseId',
                                field: 'cmp_step_course_id',
                                dataType: 'REF',
                                headerName: 'Course',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'step-title-column',
                                codename: 'Title',
                                field: 'cmp_step_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'step-sort-order-column',
                                codename: 'SortOrder',
                                field: 'cmp_step_sort_order',
                                dataType: 'NUMBER',
                                headerName: 'Sort Order',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: stepId,
                                cmp_step_track_id: trackId,
                                cmp_step_course_id: courseId,
                                cmp_step_title: 'Start onboarding',
                                cmp_step_sort_order: 1
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }
            if (objectCollectionId === coursesSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: coursesSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'course-title-column',
                                codename: 'Title',
                                field: 'cmp_course_title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'course-description-column',
                                codename: 'Description',
                                field: 'cmp_course_description',
                                dataType: 'STRING',
                                headerName: 'Description',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, cmp_course_title: 'Learner Onboarding Course', cmp_course_description: 'Start here.' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200 }
                )
            }

            throw new Error(`Unexpected request ${String(input)} ${String(init?.method ?? 'GET')}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Track player',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: tracksSectionId, codename: 'LearningTracks' },
                            { id: trackStepsSectionId, codename: 'TrackSteps' },
                            { id: coursesSectionId, codename: 'Courses' }
                        ],
                        objectCollections: [
                            { id: tracksSectionId, codename: 'LearningTracks' },
                            { id: trackStepsSectionId, codename: 'TrackSteps' },
                            { id: coursesSectionId, codename: 'Courses' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-track-player',
                        widgetKey: 'learnerPlayer',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'LearningTracks',
                                query: { sort: [{ field: 'Title', direction: 'asc' }] }
                            },
                            itemsDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'TrackSteps',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            parentFieldCodename: 'TrackId',
                            itemTitleFieldCodename: 'Title',
                            targetObjectCodename: 'Courses',
                            targetRecordIdField: 'CourseId',
                            completionTargetObjectCodename: 'TrackSteps',
                            sequencePolicy: {
                                mode: 'sequential',
                                scopeFieldCodename: 'TrackId',
                                orderFieldCodename: 'SortOrder'
                            },
                            targetContent: {
                                titleFieldCodename: 'Title',
                                descriptionFieldCodename: 'Description'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('learner-player')).toBeInTheDocument()
        expect(screen.getByText('Onboarding track')).toBeInTheDocument()
        expect(screen.getAllByText(/Start onboarding/).length).toBeGreaterThan(0)
        expect(screen.getByText('Courses')).toBeInTheDocument()
        expect(await screen.findByText('This content item does not have a previewable source yet.')).toBeInTheDocument()
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(([input, init]) => {
                    if (!String(input).includes('/runtime/progress/content')) return false
                    return JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')).action === 'view'
                })
            ).toBe(true)
        )

        await user.click(screen.getByRole('button', { name: 'Complete' }))

        await waitFor(() => expect(screen.getByText('1 of 1 completed')).toBeInTheDocument())
        const progressRequest = fetchMock.mock.calls.find(([input, init]) => {
            if (!String(input).includes('/runtime/progress/content')) return false
            return JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}')).action === 'complete'
        })
        expect(progressRequest?.[1]).toMatchObject({ method: 'POST' })
        expect(JSON.parse(String(progressRequest?.[1]?.body))).toEqual(
            expect.objectContaining({
                targetObjectCodename: 'TrackSteps',
                targetRecordId: stepId,
                action: 'complete'
            })
        )
    })

    it('renders parent-scoped relation builder panels and filters child rows by the selected parent', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const firstCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const secondCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
        const rawWizardStepId = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')
            const filters = JSON.parse(url.searchParams.get('filters') ?? '[]') as Array<{ field: string; value: string }>

            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            { id: firstCourseId, title: 'Course A' },
                            { id: secondCourseId, title: 'Course B' }
                        ],
                        pagination: { total: 2, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            const parentId = filters.find((filter) => filter.field === 'CourseId')?.value
            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'course_id',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'due-date-column',
                            codename: 'DueDate',
                            field: 'due_date',
                            dataType: 'DATE',
                            headerName: 'Due Date',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows:
                        parentId === secondCourseId
                            ? [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073985', course_id: secondCourseId, title: 'Course B item' }]
                            : [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073984', course_id: firstCourseId, title: 'Course A item' }],
                    pagination: { total: 1, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId',
                                    createDefaults: { TargetType: 'course' },
                                    createWizard: {
                                        steps: [
                                            {
                                                id: 'content',
                                                fieldCodenames: ['Title']
                                            },
                                            {
                                                id: rawWizardStepId,
                                                helperText: 'Set enrollment parameters.',
                                                fieldCodenames: ['DueDate']
                                            }
                                        ]
                                    },
                                    rowCountWarning: {
                                        threshold: 1,
                                        message: 'This course has active enrollments.'
                                    }
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Course A item')).toBeInTheDocument()
        expect(screen.getByText('Course items')).toBeInTheDocument()
        expect(screen.queryByText('course-items')).not.toBeInTheDocument()
        expect(screen.getByText('This course has active enrollments.')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('combobox', { name: 'Course' }))
        await userEvent.click(screen.getByRole('option', { name: 'Course B' }))
        expect(await screen.findByText('Course B item')).toBeInTheDocument()

        const childRequests = fetchMock.mock.calls
            .map((call) => new URL(String(call[0]), 'http://localhost'))
            .filter((url) => url.searchParams.get('objectCollectionId') === courseItemsSectionId)
        expect(childRequests.some((url) => url.searchParams.get('filters')?.includes(firstCourseId))).toBe(true)
        expect(childRequests.some((url) => url.searchParams.get('filters')?.includes(secondCourseId))).toBe(true)

        await userEvent.click(screen.getByRole('button', { name: 'Create' }))
        expect(screen.getByText('Content')).toBeInTheDocument()
        expect(screen.getByText('Step')).toBeInTheDocument()
        expect(screen.queryByText(rawWizardStepId)).not.toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Guided enrollment')
        await userEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Set enrollment parameters.')).toBeInTheDocument()
        expect(screen.getByLabelText('Due Date')).toBeInTheDocument()
    }, 10_000)

    it('keeps relation builder parent labels and child lists free of raw IDs and resource JSON', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const targetRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')

            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, title: courseId }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'CourseId',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'target-record-id-column',
                            codename: 'TargetRecordId',
                            field: 'TargetRecordId',
                            dataType: 'STRING',
                            headerName: 'Target',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'source-json-column',
                            codename: 'SourceJson',
                            field: 'SourceJson',
                            dataType: 'JSON',
                            headerName: 'Source',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'summary-column',
                            codename: 'Summary',
                            field: 'Summary',
                            dataType: 'STRING',
                            headerName: 'Summary',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073984',
                            CourseId: courseId,
                            TargetRecordId: targetRecordId,
                            SourceJson: '{"storageKey":"lesson.pdf","mimeType":"application/pdf"}',
                            Title: 'Readable lesson',
                            Summary: '{"blocks":[{"type":"paragraph","data":{"text":"Raw block"}}]}'
                        }
                    ],
                    pagination: { total: 1, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-display-contract',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Readable lesson')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-relation-builder-parent-select')).toHaveTextContent('Untitled parent')

        const builder = screen.getByTestId('runtime-relation-builder')
        expect(builder).not.toHaveTextContent(courseId)
        expect(builder).not.toHaveTextContent(targetRecordId)
        expect(builder).not.toHaveTextContent('Target')
        expect(builder).not.toHaveTextContent('Source')
        expect(builder).not.toHaveTextContent('storageKey')
        expect(builder).not.toHaveTextContent('mimeType')
        expect(builder).not.toHaveTextContent('blocks')
        expect(builder).not.toHaveTextContent('[object Object]')
    }, 10_000)

    it('sanitizes relation builder load failures before rendering panel errors', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')

            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'Title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, Title: 'Course A' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            return new Response(JSON.stringify({ error: `SQL relation app_runtime.course_items does not exist for ${rawRecordId}` }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-load-error',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Unable to load related records.')).toBeInTheDocument()
        const builder = screen.getByTestId('runtime-relation-builder')
        expect(builder).not.toHaveTextContent('SQL relation')
        expect(builder).not.toHaveTextContent('app_runtime.course_items')
        expect(builder).not.toHaveTextContent(rawRecordId)
    }, 10_000)

    it('sanitizes relation builder create mutation failures before rendering dialog errors', async () => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                return new Response(JSON.stringify({ error: `duplicate key violates course_items_pkey for ${rawRecordId}` }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'Title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, Title: 'Course A' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'CourseId',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [],
                    pagination: { total: 0, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-create-error',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('runtime-relation-builder')).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Create' }))
        await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'New item')
        await userEvent.click(screen.getByTestId('entity-form-submit'))

        expect(await screen.findByText('Please try again or reload the page.')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).not.toHaveTextContent('duplicate key')
        expect(screen.getByRole('dialog')).not.toHaveTextContent('course_items_pkey')
        expect(screen.getByRole('dialog')).not.toHaveTextContent(rawRecordId)
    }, 10_000)

    it('sanitizes relation builder delete mutation failures before rendering confirmation errors', async () => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const itemId = '017f22e2-79b0-7cc3-98c4-dc0c0c073984'
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (init?.method === 'DELETE' && url.pathname.includes('/runtime/rows/')) {
                return new Response(JSON.stringify({ error: `delete violates relation course_items for ${rawRecordId}` }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'Title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, Title: 'Course A' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'CourseId',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [{ id: itemId, CourseId: courseId, Title: 'Existing item' }],
                    pagination: { total: 1, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-delete-error',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Existing item')).toBeInTheDocument()
        await userEvent.click(screen.getByTestId(`runtime-relation-delete-course-items-${itemId}`))
        await userEvent.click(screen.getByTestId('confirm-delete-confirm'))

        expect(await screen.findByText('Please try again or reload the page.')).toBeInTheDocument()
        expect(screen.getByRole('dialog')).not.toHaveTextContent('delete violates')
        expect(screen.getByRole('dialog')).not.toHaveTextContent('course_items')
        expect(screen.getByRole('dialog')).not.toHaveTextContent(rawRecordId)
    }, 10_000)

    it('uses an authoritative max sort-order probe before creating relation-builder rows', async () => {
        window.localStorage.clear()
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073986'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (init?.method === 'POST' && url.pathname.endsWith('/runtime/rows')) {
                return new Response(JSON.stringify({ id: 'new-course-item' }), {
                    status: 201,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const objectCollectionId = url.searchParams.get('objectCollectionId')
            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'Title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, Title: 'Course with many items' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            const isMaxSortProbe = url.searchParams.get('limit') === '1' && url.searchParams.get('sort')?.includes('"desc"')
            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'CourseId',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'Title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'sort-order-column',
                            codename: 'SortOrder',
                            field: 'SortOrder',
                            dataType: 'NUMBER',
                            headerName: 'Sort Order',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: isMaxSortProbe
                        ? [{ id: 'last-loaded-item', CourseId: courseId, Title: 'Last item', SortOrder: 250 }]
                        : [{ id: 'visible-item', CourseId: courseId, Title: 'Visible item', SortOrder: 100 }],
                    pagination: { total: 250, limit: isMaxSortProbe ? 1 : 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        objectCollections: [
                            { id: courseSectionId, codename: 'Courses' },
                            { id: courseItemsSectionId, codename: 'CourseItems' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-sort-order',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems',
                                        query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                    },
                                    parentFieldCodename: 'CourseId',
                                    sortOrderFieldCodename: 'SortOrder'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Visible item')).toBeInTheDocument()
        await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled())
        await userEvent.click(screen.getByRole('button', { name: 'Create' }))
        await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'New item')
        await userEvent.click(screen.getByTestId('entity-form-submit'))

        await waitFor(() => {
            const createCall = fetchMock.mock.calls.find(
                ([input, init]) => String(input).includes('/runtime/rows') && init?.method === 'POST'
            )
            expect(createCall).toBeDefined()
            expect(JSON.parse(String(createCall?.[1]?.body))).toMatchObject({
                objectCollectionId: courseItemsSectionId,
                data: {
                    CourseId: courseId,
                    Title: 'New item',
                    SortOrder: 251
                }
            })
        })
    }, 10_000)

    it('resolves relation builder parents from the active runtime section without case-sensitive codename matching', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073986'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            const objectCollectionId = url.searchParams.get('objectCollectionId')

            if (objectCollectionId === courseSectionId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        section: { id: courseSectionId, codename: 'courses', tableName: 'courses', name: 'Courses' },
                        objectCollection: { id: courseSectionId, codename: 'courses', tableName: 'courses', name: 'Courses' },
                        columns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: courseId, title: 'Current course' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    { status: 200, headers: { 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'courseitems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'courseitems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'course_id',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073989', course_id: courseId, title: 'Current course item' }],
                    pagination: { total: 1, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sectionId: courseSectionId,
                        sectionCodename: 'courses',
                        objectCollectionId: courseSectionId,
                        objectCollectionCodename: 'courses',
                        sections: [],
                        objectCollections: [{ id: courseItemsSectionId, codename: 'CourseItems' }],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-current-section',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText('Current course item')).toBeInTheDocument()
        expect(screen.queryByText('Create a parent record before adding related records.')).not.toBeInTheDocument()

        const requestedParentUrl = fetchMock.mock.calls
            .map((call) => new URL(String(call[0]), 'http://localhost'))
            .find((url) => url.searchParams.get('objectCollectionId') === courseSectionId)
        expect(requestedParentUrl).toBeDefined()
    }, 30_000)

    it('uses the current runtime dataset while the same-section parent query is still loading', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073986'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const courseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const unresolvedParentRequest = new Promise<Response>(() => new Response())
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.searchParams.get('objectCollectionId') === courseSectionId) {
                return unresolvedParentRequest
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'course_id',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073989', course_id: courseId, title: 'Current course item' }],
                    pagination: { total: 1, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sectionId: courseSectionId,
                        sectionCodename: 'Courses',
                        objectCollectionId: courseSectionId,
                        objectCollectionCodename: 'Courses',
                        sections: [],
                        objectCollections: [{ id: courseItemsSectionId, codename: 'CourseItems' }],
                        rows: [{ id: courseId, title: 'Current course' }],
                        columns: [],
                        runtimeColumns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ]
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-current-rows',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses'
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('runtime-relation-builder')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-relation-builder-parent-select')).toHaveTextContent('Current course')
        expect(await screen.findByText('Current course item')).toBeInTheDocument()
    })

    it('adopts authoritative parent ordering after a same-section fallback before manual selection', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073986'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073987'
        const firstCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073988'
        const secondCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073989'
        let resolveParentRequest: ((response: Response) => void) | undefined
        const parentRequest = new Promise<Response>((resolve) => {
            resolveParentRequest = resolve
        })
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.searchParams.get('objectCollectionId') === courseSectionId) {
                return parentRequest
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseItemsSectionId, codename: 'CourseItems', tableName: 'course_items', name: 'Course Items' },
                    objectCollection: {
                        id: courseItemsSectionId,
                        codename: 'CourseItems',
                        tableName: 'course_items',
                        name: 'Course Items'
                    },
                    columns: [
                        {
                            id: 'course-id-column',
                            codename: 'CourseId',
                            field: 'course_id',
                            dataType: 'REF',
                            headerName: 'Course',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [],
                    pagination: { total: 0, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Courses',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sectionId: courseSectionId,
                        sectionCodename: 'Courses',
                        objectCollectionId: courseSectionId,
                        objectCollectionCodename: 'Courses',
                        sections: [],
                        objectCollections: [{ id: courseItemsSectionId, codename: 'CourseItems' }],
                        rows: [{ id: secondCourseId, title: 'Learner Onboarding Course' }],
                        columns: [],
                        runtimeColumns: [
                            {
                                id: 'title-column',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ]
                    }}
                >
                    {renderWidget({
                        id: 'widget-relation-builder-authoritative-rows',
                        widgetKey: 'relationBuilder',
                        sortOrder: 0,
                        config: {
                            parentDatasource: {
                                kind: 'records.list',
                                sectionCodename: 'Courses',
                                query: { sort: [{ field: 'Title', direction: 'asc' }] }
                            },
                            parentLabel: 'Course',
                            parentTitleFieldCodename: 'Title',
                            panels: [
                                {
                                    id: 'course-items',
                                    title: 'Items',
                                    datasource: {
                                        kind: 'records.list',
                                        sectionCodename: 'CourseItems'
                                    },
                                    parentFieldCodename: 'CourseId'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('runtime-relation-builder-parent-select')).toHaveTextContent('Learner Onboarding Course')

        resolveParentRequest?.(
            new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    section: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                    objectCollection: { id: courseSectionId, codename: 'Courses', tableName: 'courses', name: 'Courses' },
                    columns: [
                        {
                            id: 'title-column',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: true,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        { id: firstCourseId, title: 'Compliance Refresh Course' },
                        { id: secondCourseId, title: 'Learner Onboarding Course' }
                    ],
                    pagination: { total: 2, limit: 100, offset: 0 }
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        )

        await waitFor(() =>
            expect(screen.getByTestId('runtime-relation-builder-parent-select')).toHaveTextContent('Compliance Refresh Course')
        )
    })

    it('renders reorder-enabled records.list datasources through the runtime list surface and persists row order', async () => {
        window.localStorage.clear()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (url.pathname.endsWith('/runtime/rows/reorder')) {
                return new Response(JSON.stringify({ status: 'reordered' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const response = createAppDataResponse()
            return new Response(
                JSON.stringify({
                    ...response,
                    columns: [
                        {
                            id: 'project-column',
                            codename: 'ProjectId',
                            field: 'ProjectId',
                            dataType: 'REF',
                            headerName: 'Project ID',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'title-column',
                            codename: 'title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'status-column',
                            codename: 'Status',
                            field: 'Status',
                            dataType: 'STRING',
                            headerName: 'Status',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992',
                            ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            title: 'Intro',
                            Status: 'Draft',
                            _upl_version: 2
                        },
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073994',
                            ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            title: 'Practice',
                            Status: 'Published',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 2, limit: 100, offset: 0 }
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
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            columnPreset: {
                                columns: [
                                    { field: 'title', visible: true, flex: 1 },
                                    { field: 'Status', visible: true, width: 140 },
                                    { field: 'ProjectId', visible: false }
                                ]
                            }
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-reorder',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.list',
                                sectionCodename: 'CourseItems',
                                query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                            },
                            enableRowReordering: true
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByText('Intro')).toBeInTheDocument())
        expect(screen.getByText('Practice')).toBeInTheDocument()
        expect(screen.getByText('Published')).toBeInTheDocument()
        expect(screen.queryByText('Project ID')).not.toBeInTheDocument()
        expect(screen.queryByText('017f22e2-79b0-7cc3-98c4-dc0c0c073991')).not.toBeInTheDocument()

        await userEvent.click(screen.getByTestId('runtime-row-move-down-017f22e2-79b0-7cc3-98c4-dc0c0c073992'))

        await waitFor(() => {
            const reorderCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/runtime/rows/reorder'))
            expect(reorderCall).toBeDefined()
            expect(reorderCall?.[1]).toMatchObject({
                method: 'POST',
                body: JSON.stringify({
                    orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073994', '017f22e2-79b0-7cc3-98c4-dc0c0c073992'],
                    objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                    expectedVersionsByRowId: {
                        '017f22e2-79b0-7cc3-98c4-dc0c0c073994': 3,
                        '017f22e2-79b0-7cc3-98c4-dc0c0c073992': 2
                    }
                })
            })
        })
    })

    it('renders nested reorder-enabled records.list datasources using the active detail codename fallback', async () => {
        const fetchMock = vi.fn(async () => {
            const response = createAppDataResponse()
            return new Response(
                JSON.stringify({
                    ...response,
                    rows: [
                        { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', title: 'Intro' },
                        { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073994', title: 'Practice' }
                    ],
                    pagination: { total: 2, limit: 100, offset: 0 }
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
                        title: 'Course Items',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        currentWorkspaceId: 'workspace-1',
                        sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                        sectionCodename: 'CourseItems',
                        objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                        objectCollectionCodename: 'CourseItems',
                        sections: [],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'columns-widget',
                        widgetKey: 'columnsContainer',
                        sortOrder: 0,
                        config: {
                            columns: [
                                {
                                    id: 'outline-column',
                                    width: 12,
                                    widgets: [
                                        {
                                            id: 'course-items-outline',
                                            widgetKey: 'detailsTable',
                                            config: {
                                                datasource: {
                                                    kind: 'records.list',
                                                    sectionCodename: 'CourseItems',
                                                    query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                                                },
                                                enableRowReordering: true
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('runtime-list-surface')).toBeInTheDocument())
        expect(await screen.findByText('Intro')).toBeInTheDocument()
        expect(screen.getByText('Practice')).toBeInTheDocument()

        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.searchParams.get('objectCollectionId')).toBe('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(requestedUrl.searchParams.get('workspaceId')).toBe('workspace-1')
    })

    it('renders records.union datasources through the same shared data grid contract', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const response = createAppDataResponse()
            expect(url.pathname).toBe('/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/datasources/records/union')
            expect(init?.method).toBe('POST')
            expect(JSON.parse(String(init?.body))).toMatchObject({
                datasource: {
                    kind: 'records.union',
                    targets: [
                        {
                            sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            sectionCodename: 'LearningResources',
                            displayType: 'page',
                            titleField: 'Title',
                            statusField: 'PublicationStatus',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073992',
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        }
                    ],
                    query: { libraryView: 'starred', search: 'Safety' }
                },
                limit: 20,
                offset: 0,
                locale: 'en'
            })

            return new Response(
                JSON.stringify({
                    ...response,
                    columns: [
                        {
                            id: 'runtime-union-type',
                            codename: 'Type',
                            field: 'type',
                            dataType: 'STRING',
                            headerName: 'Type',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridSortable: false, gridFilterable: false }
                        },
                        ...response.columns,
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073994',
                            codename: 'Name',
                            field: 'name',
                            dataType: 'STRING',
                            headerName: 'Name',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073995',
                            codename: 'CreatedBy',
                            field: 'created_by',
                            dataType: 'STRING',
                            headerName: 'Created By',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073996',
                            codename: 'status',
                            field: 'status',
                            dataType: 'STRING',
                            headerName: 'Status',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c07399a',
                            codename: 'Project',
                            field: 'project',
                            dataType: 'STRING',
                            headerName: 'Project',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridSortable: false, gridFilterable: false }
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            title: 'Welcome page',
                            project: { id: '017f22e2-79b0-7cc3-98c4-dc0c0c07399b', label: 'Onboarding' }
                        },
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992:017f22e2-79b0-7cc3-98c4-dc0c0c073998',
                            title: 'Safety course',
                            name: '{ "_schema": "1", "locales": { "en": { "content": "Internal name" } } }',
                            created_by: '017f22e2-79b0-7cc3-98c4-dc0c0c073999',
                            status: 'Published',
                            project: { id: '017f22e2-79b0-7cc3-98c4-dc0c0c07399b', label: 'Onboarding' }
                        }
                    ],
                    pagination: { total: 2, limit: 20, offset: 0 }
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'ContentProjects' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'page',
                                        titleField: 'Title',
                                        statusField: 'PublicationStatus',
                                        projectField: 'ProjectId'
                                    },
                                    {
                                        sectionCodename: 'Courses',
                                        displayType: 'course',
                                        titleField: 'Title',
                                        statusField: 'Status',
                                        projectField: 'ProjectId'
                                    }
                                ],
                                query: { libraryView: 'starred', search: 'Safety' }
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '2'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '2')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'type,title,status,project')
        expect(screen.getAllByText('Onboarding')).toHaveLength(2)
        expect(
            fetchMock.mock.calls.some(([input]) =>
                new URL(String(input), 'http://localhost').pathname.endsWith('/runtime/datasources/records/union')
            )
        ).toBe(true)
    })

    it('sanitizes records.union datasource load failures before rendering table errors', async () => {
        const rawRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/runtime/datasources/records/union')) {
                return new Response(JSON.stringify({ error: `SQL relation app_runtime.union_view failed for ${rawRecordId}` }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            throw new Error(`Unexpected fetch request: ${String(input)}`)
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
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-error',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'resource' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        const table = await screen.findByTestId('records-union-details-table')
        expect(await within(table).findByText('This content view could not be loaded.')).toBeInTheDocument()
        expect(table).not.toHaveTextContent('SQL relation')
        expect(table).not.toHaveTextContent('app_runtime.union_view')
        expect(table).not.toHaveTextContent(rawRecordId)
    })

    it('renders a generic records.union create menu and delegates the selected target', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [],
                    pagination: { total: 0, limit: 20, offset: 0 }
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073994', codename: 'LearningTracks' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        onOpenCreateTarget
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-create-targets',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    { sectionCodename: 'LearningResources', displayType: 'resource' },
                                    { sectionCodename: 'Courses', displayType: 'course' }
                                ]
                            },
                            createTargets: [
                                { id: 'create-project', label: 'Project', sectionCodename: 'ContentProjects' },
                                {
                                    id: 'create-page',
                                    label: 'Page',
                                    sectionCodename: 'LearningResources',
                                    createDefaults: [
                                        { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                                        { fieldCodename: 'Source', resourceSourceType: 'page' }
                                    ]
                                },
                                { id: 'create-link', label: 'Link', sectionCodename: 'LearningResources' },
                                { id: 'create-course', label: 'Course', sectionCodename: 'Courses' },
                                { id: 'create-track', label: 'Learning Track', sectionCodename: 'LearningTracks' },
                                {
                                    id: 'create-quiz-lite',
                                    label: 'Quiz-lite',
                                    sectionCodename: 'Quizzes',
                                    disabled: true,
                                    disabledReason: 'Quiz authoring is planned for a later phase.'
                                },
                                {
                                    id: 'create-assignment-lite',
                                    label: 'Assignment-lite',
                                    sectionCodename: 'Assignments',
                                    disabled: true,
                                    disabledReason: 'Assignment authoring is planned for a later phase.'
                                },
                                {
                                    id: 'create-package',
                                    label: 'Import package',
                                    sectionCodename: 'LearningResources',
                                    disabled: true,
                                    disabledReason: 'File import and SCORM/xAPI support are planned for a later phase.'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await user.click(screen.getByRole('button', { name: /create/i }))
        await expect(screen.findByRole('menuitem', { name: /page/i })).resolves.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /project/i })).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /quiz-lite/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Quiz authoring is planned for a later phase.')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /assignment-lite/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Assignment authoring is planned for a later phase.')).toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /import package/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('File import and SCORM/xAPI support are planned for a later phase.')).toBeInTheDocument()

        await user.click(screen.getByRole('menuitem', { name: /project/i }))
        expect(onOpenCreateTarget).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'create-project', sectionCodename: 'ContentProjects' })
        )

        await user.click(screen.getByRole('button', { name: /create/i }))
        await user.click(screen.getByRole('menuitem', { name: /page/i }))
        expect(onOpenCreateTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'create-page',
                sectionCodename: 'LearningResources',
                createDefaults: [
                    { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                    { fieldCodename: 'Source', resourceSourceType: 'page' }
                ]
            })
        )

        await user.click(screen.getByRole('button', { name: /create/i }))
        await user.click(screen.getByRole('menuitem', { name: /course/i }))
        expect(onOpenCreateTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'create-course', sectionCodename: 'Courses' }))

        await user.click(screen.getByRole('button', { name: /create/i }))
        await user.click(screen.getByRole('menuitem', { name: /learning track/i }))
        expect(onOpenCreateTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'create-track', sectionCodename: 'LearningTracks' }))
    }, 20000)

    it('disables resource-source create targets when application settings block their type', async () => {
        const user = userEvent.setup()
        const onOpenCreateTarget = vi.fn()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [],
                    pagination: { total: 0, limit: 20, offset: 0 }
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        resourceSourceTypes: [
                            { resourceType: 'page', enabled: false },
                            { resourceType: 'url', enabled: true, deferred: true }
                        ],
                        onOpenCreateTarget
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-create-target-policy',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    { sectionCodename: 'LearningResources', displayType: 'resource' },
                                    { sectionCodename: 'Courses', displayType: 'course' }
                                ]
                            },
                            createTargets: [
                                {
                                    id: 'create-page',
                                    label: 'Page',
                                    sectionCodename: 'LearningResources',
                                    createDefaults: [{ fieldCodename: 'Source', resourceSourceType: 'page' }]
                                },
                                {
                                    id: 'create-link',
                                    label: 'Link',
                                    sectionCodename: 'LearningResources',
                                    createDefaults: [{ fieldCodename: 'Source', resourceSourceType: 'url' }]
                                },
                                {
                                    id: 'create-embed',
                                    label: 'Embed',
                                    sectionCodename: 'LearningResources',
                                    createDefaults: [{ fieldCodename: 'Source', resourceSourceType: 'embed' }]
                                },
                                { id: 'create-course', label: 'Course', sectionCodename: 'Courses' }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await user.click(screen.getByRole('button', { name: /create/i }))

        expect(await screen.findByRole('menuitem', { name: /page/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Page is disabled in application settings.')).toBeInTheDocument()
        expect(screen.queryByText('page is disabled in application settings.')).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /link/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Link is planned for a later phase.')).toBeInTheDocument()
        expect(screen.queryByText('url is planned for a later phase.')).not.toBeInTheDocument()
        expect(screen.getByRole('menuitem', { name: /embed/i })).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByText('Embed is disabled in application settings.')).toBeInTheDocument()
        expect(screen.queryByText('embed is disabled in application settings.')).not.toBeInTheDocument()

        await user.click(screen.getByRole('menuitem', { name: /course/i }))
        expect(onOpenCreateTarget).toHaveBeenCalledTimes(1)
        expect(onOpenCreateTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'create-course', sectionCodename: 'Courses' }))
    }, 30_000)

    it('delegates records.union table row actions to the source row target', async () => {
        const user = userEvent.setup()
        const onOpenRowTarget = vi.fn()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeSourceRowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            title: 'Welcome page',
                            _upl_version: 2
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: { createContent: true, editContent: true, deleteContent: true },
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        onOpenRowTarget
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-row-actions',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(
            screen.getByTestId('grid-row-actions-trigger-017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997')
        )
        await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))

        expect(onOpenRowTarget).toHaveBeenCalledWith(
            {
                rowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                objectCollectionCodename: 'LearningResources'
            },
            'edit'
        )
    })

    it('runs generic records.union library row actions without edit permissions', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (url.pathname.endsWith('/runtime/rows/017f22e2-79b0-7cc3-98c4-dc0c0c073997/library/starred')) {
                expect(init?.method).toBe('POST')
                expect(init?.body).toBe(
                    JSON.stringify({
                        objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                        active: true
                    })
                )
                return new Response(JSON.stringify({ relationKey: 'starred', active: true, changed: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeSourceRowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            __runtimeStarred: false,
                            title: 'Welcome page'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: {},
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-library-actions',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'toggle-starred',
                                    kind: 'library.toggle',
                                    libraryView: 'starred',
                                    icon: 'star'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(
            screen.getByTestId('grid-row-actions-trigger-017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997')
        )
        await user.click(await screen.findByRole('menuitem', { name: 'Add to starred' }))

        await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/library/starred'))).toBe(true))
    })

    it('runs generic records.union shared row actions without exposing principal IDs', async () => {
        const user = userEvent.setup()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (url.pathname.endsWith('/runtime/rows/017f22e2-79b0-7cc3-98c4-dc0c0c073997/library/shared')) {
                expect(init?.method).toBe('POST')
                expect(init?.body).toBe(
                    JSON.stringify({
                        objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                        active: true
                    })
                )
                return new Response(JSON.stringify({ relationKey: 'shared', active: true, changed: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeSourceRowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            __runtimeShared: false,
                            title: 'Welcome page'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: {},
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-shared-actions',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'toggle-shared',
                                    kind: 'library.toggle',
                                    libraryView: 'shared',
                                    icon: 'share'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        expect(screen.queryByText('017f22e2-79b0-7cc3-98c4-dc0c0c073997')).not.toBeInTheDocument()

        await user.click(
            screen.getByTestId('grid-row-actions-trigger-017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997')
        )
        await user.click(await screen.findByRole('menuitem', { name: 'Add to shared' }))

        await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/library/shared'))).toBe(true))
    })

    it('runs generic records.union shared row actions with a workspace member picker without requiring global edit permission in the UI', async () => {
        const user = userEvent.setup()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const sourceRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const workspaceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        const memberUserId = '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
        const unsafeMemberUserId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith(`/runtime/workspaces/${workspaceId}/members`)) {
                return new Response(
                    JSON.stringify({
                        items: [
                            {
                                userId: unsafeMemberUserId,
                                roleCodename: 'member',
                                email: JSON.stringify({ recordId: unsafeMemberUserId }),
                                nickname: unsafeMemberUserId,
                                canRemove: false
                            },
                            {
                                userId: memberUserId,
                                roleCodename: 'member',
                                email: 'learner@example.test',
                                nickname: 'Learner One',
                                canRemove: false
                            }
                        ],
                        total: 1,
                        limit: 100,
                        offset: 0
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            if (url.pathname.endsWith(`/runtime/rows/${sourceRowId}/library/shared`)) {
                expect(init?.method).toBe('POST')
                expect(init?.body).toBe(
                    JSON.stringify({
                        objectCollectionId: learningResourcesId,
                        active: true,
                        principalType: 'workspaceMember',
                        principalId: memberUserId
                    })
                )
                return new Response(JSON.stringify({ relationKey: 'shared', active: true, changed: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: `${learningResourcesId}:${sourceRowId}`,
                            __runtimeSourceRowId: sourceRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            __runtimeShared: false,
                            title: 'Welcome page'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: workspaceId,
                        permissions: {},
                        sections: [{ id: learningResourcesId, codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-share-picker',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'share-with-member',
                                    kind: 'library.toggle',
                                    libraryView: 'shared',
                                    principalTarget: 'workspaceMember',
                                    icon: 'share',
                                    label: 'Share',
                                    dialogTitle: 'Share content',
                                    targetLabel: 'Workspace member'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(screen.getByTestId(`grid-row-actions-trigger-${learningResourcesId}:${sourceRowId}`))
        await user.click(await screen.findByRole('menuitem', { name: 'Share' }))

        const dialog = await screen.findByRole('dialog', { name: 'Share content' })
        expect(within(dialog).queryByText(memberUserId)).not.toBeInTheDocument()
        await user.click(within(dialog).getByRole('combobox', { name: 'Workspace member' }))
        expect(await screen.findByRole('option', { name: 'Workspace member' })).toBeInTheDocument()
        expect(screen.queryByText(unsafeMemberUserId)).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent('recordId')
        await user.click(await screen.findByRole('option', { name: 'Learner One (learner@example.test)' }))
        await user.click(within(dialog).getByRole('button', { name: 'Share' }))

        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => String(input).includes(`/runtime/rows/${sourceRowId}/library/shared`) && init?.method === 'POST'
                )
            ).toBe(true)
        )
    })

    it('sanitizes failed records.union shared row action mutations', async () => {
        const user = userEvent.setup()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const sourceRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const workspaceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        const memberUserId = '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith(`/runtime/workspaces/${workspaceId}/members`)) {
                return new Response(
                    JSON.stringify({
                        items: [
                            {
                                userId: memberUserId,
                                roleCodename: 'member',
                                email: 'learner@example.test',
                                nickname: 'Learner One',
                                canRemove: false
                            }
                        ],
                        total: 1,
                        limit: 100,
                        offset: 0
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            if (url.pathname.endsWith(`/runtime/rows/${sourceRowId}/library/shared`)) {
                expect(init?.method).toBe('POST')
                return new Response(
                    JSON.stringify({
                        error: `SQL relation app_runtime.library_shared failed for ${memberUserId}`
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: `${learningResourcesId}:${sourceRowId}`,
                            __runtimeSourceRowId: sourceRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            __runtimeShared: false,
                            title: 'Welcome page'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: workspaceId,
                        permissions: { editContent: true },
                        sections: [{ id: learningResourcesId, codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-share-picker-error',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'share-with-member',
                                    kind: 'library.toggle',
                                    libraryView: 'shared',
                                    principalTarget: 'workspaceMember',
                                    icon: 'share',
                                    label: 'Share',
                                    dialogTitle: 'Share content',
                                    targetLabel: 'Workspace member'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(screen.getByTestId(`grid-row-actions-trigger-${learningResourcesId}:${sourceRowId}`))
        await user.click(await screen.findByRole('menuitem', { name: 'Share' }))

        const dialog = await screen.findByRole('dialog', { name: 'Share content' })
        await user.click(within(dialog).getByRole('combobox', { name: 'Workspace member' }))
        await user.click(await screen.findByRole('option', { name: 'Learner One (learner@example.test)' }))
        await user.click(within(dialog).getByRole('button', { name: 'Share' }))

        expect(await within(dialog).findByText('Access could not be updated.')).toBeInTheDocument()
        expect(dialog).not.toHaveTextContent('SQL')
        expect(dialog).not.toHaveTextContent('app_runtime')
        expect(dialog).not.toHaveTextContent(memberUserId)
    })

    it('runs generic records.union target-field actions with a human-readable picker', async () => {
        const user = userEvent.setup()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const sourceRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const projectRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073902'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith(`/runtime/rows/${sourceRowId}`)) {
                expect(init?.method).toBe('PATCH')
                expect(init?.body).toBe(
                    JSON.stringify({
                        data: { ProjectId: projectRowId },
                        objectCollectionId: learningResourcesId,
                        expectedVersion: 4
                    })
                )
                return new Response(JSON.stringify({ id: sourceRowId, ProjectId: projectRowId }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        activeObjectCollectionId: contentProjectsId,
                        columns: [
                            {
                                id: 'runtime-project-name',
                                codename: 'Name',
                                field: 'Name',
                                dataType: 'STRING',
                                headerName: 'Project',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: projectRowId, Codename: 'ContentProjects', Name: 'Safety project' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: `${learningResourcesId}:${sourceRowId}`,
                            __runtimeSourceRowId: sourceRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            title: 'Welcome page',
                            _upl_version: 4
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: { editContent: true },
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-target-field-actions',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'move-project',
                                    kind: 'field.updateWithTarget',
                                    fieldCodename: 'ProjectId',
                                    targetObjectCollectionCodename: 'ContentProjects',
                                    labelFields: ['Codename', 'Name'],
                                    icon: 'move',
                                    label: 'Move to project',
                                    dialogTitle: 'Move to project',
                                    targetLabel: 'Project'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(screen.getByTestId(`grid-row-actions-trigger-${learningResourcesId}:${sourceRowId}`))
        await user.click(await screen.findByRole('menuitem', { name: 'Move to project' }))

        const dialog = await screen.findByRole('dialog', { name: 'Move to project' })
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([input]) => new URL(String(input), 'http://localhost').searchParams.get('objectCollectionId') === contentProjectsId
                )
            ).toBe(true)
        )
        expect(within(dialog).queryByText(projectRowId)).not.toBeInTheDocument()
        await user.click(within(dialog).getByRole('combobox', { name: 'Project' }))
        expect(screen.queryByRole('option', { name: 'ContentProjects' })).not.toBeInTheDocument()
        await user.click(await screen.findByRole('option', { name: 'Safety project' }))
        await user.click(within(dialog).getByRole('button', { name: 'Move to project' }))

        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([input, init]) => String(input).includes(`/runtime/rows/${sourceRowId}`) && init?.method === 'PATCH'
                )
            ).toBe(true)
        )
    })

    it('sanitizes failed records.union target-field action mutations', async () => {
        const user = userEvent.setup()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const sourceRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const projectRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073902'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith(`/runtime/rows/${sourceRowId}`)) {
                expect(init?.method).toBe('PATCH')
                return new Response(
                    JSON.stringify({
                        error: `SQL relation app_runtime.learning_resources failed for ${projectRowId}`
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        activeObjectCollectionId: contentProjectsId,
                        columns: [
                            {
                                id: 'runtime-project-name',
                                codename: 'Name',
                                field: 'Name',
                                dataType: 'STRING',
                                headerName: 'Project',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [{ id: projectRowId, Name: 'Safety project' }],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: `${learningResourcesId}:${sourceRowId}`,
                            __runtimeSourceRowId: sourceRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            __runtimeObjectCollectionCodename: 'LearningResources',
                            title: 'Welcome page',
                            _upl_version: 4
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: { editContent: true },
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-target-field-actions-error',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            },
                            rowActions: [
                                {
                                    id: 'move-project',
                                    kind: 'field.updateWithTarget',
                                    fieldCodename: 'ProjectId',
                                    targetObjectCollectionCodename: 'ContentProjects',
                                    labelFields: ['Name'],
                                    icon: 'move',
                                    label: 'Move to project',
                                    dialogTitle: 'Move to project',
                                    targetLabel: 'Project'
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,actions'))
        await user.click(screen.getByTestId(`grid-row-actions-trigger-${learningResourcesId}:${sourceRowId}`))
        await user.click(await screen.findByRole('menuitem', { name: 'Move to project' }))

        const dialog = await screen.findByRole('dialog', { name: 'Move to project' })
        await user.click(within(dialog).getByRole('combobox', { name: 'Project' }))
        await user.click(await screen.findByRole('option', { name: 'Safety project' }))
        await user.click(within(dialog).getByRole('button', { name: 'Move to project' }))

        expect(await within(dialog).findByText('Record could not be updated.')).toBeInTheDocument()
        expect(dialog).not.toHaveTextContent('SQL')
        expect(dialog).not.toHaveTextContent('app_runtime')
        expect(dialog).not.toHaveTextContent(projectRowId)
    })

    it('delegates records.union card row actions to the source row target', async () => {
        window.localStorage.clear()
        const user = userEvent.setup()
        const onOpenRowTarget = vi.fn()
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeSourceRowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            title: 'Welcome page'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        permissions: { createContent: true, editContent: true, deleteContent: true },
                        tableDefaults: { defaultViewMode: 'card' },
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        onOpenRowTarget
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-card-row-actions',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await user.click(
            await screen.findByTestId(
                'records-union-card-actions-017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997'
            )
        )
        await user.click(await screen.findByRole('menuitem', { name: 'Copy' }))

        expect(onOpenRowTarget).toHaveBeenCalledWith(
            expect.objectContaining({
                rowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
            }),
            'copy'
        )
    })

    it('delegates records.union pagination to the server-side datasource endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const response = createAppDataResponse()
            expect(url.pathname).toBe('/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/datasources/records/union')
            expect(init?.method).toBe('POST')
            expect(JSON.parse(String(init?.body))).toMatchObject({
                limit: 20,
                offset: 0,
                datasource: {
                    kind: 'records.union',
                    targets: [
                        { sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', sectionCodename: 'LearningResources' },
                        { sectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', sectionCodename: 'Courses' }
                    ]
                }
            })

            return new Response(
                JSON.stringify({
                    ...response,
                    rows: Array.from({ length: 20 }, (_, index) => ({
                        id: `union-row-${index}`,
                        title: `Content ${index + 1}`
                    })),
                    pagination: { total: 50, limit: 20, offset: 0 }
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-paginated',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    { sectionCodename: 'LearningResources', displayType: 'page' },
                                    { sectionCodename: 'Courses', displayType: 'course' }
                                ]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '20'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '50')
        expect(
            fetchMock.mock.calls.some(([input]) =>
                new URL(String(input), 'http://localhost').pathname.endsWith('/runtime/datasources/records/union')
            )
        ).toBe(true)
    })

    it('delegates records.union pagination, sort, and filters to the server-side datasource endpoint', async () => {
        const user = userEvent.setup()
        const unionBodies: Array<Record<string, unknown>> = []
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            unionBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [{ id: `union-row-${unionBodies.length}`, title: `Content ${unionBodies.length}` }],
                    pagination: {
                        total: 50,
                        limit: Number((unionBodies.at(-1) as { limit?: unknown } | undefined)?.limit ?? 20),
                        offset: Number((unionBodies.at(-1) as { offset?: unknown } | undefined)?.offset ?? 0)
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-interactive',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'page',
                                        titleField: 'Title',
                                        statusField: 'PublicationStatus'
                                    },
                                    {
                                        sectionCodename: 'Courses',
                                        displayType: 'course',
                                        titleField: 'Title',
                                        statusField: 'Status'
                                    }
                                ]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(unionBodies).toHaveLength(1))

        await user.click(screen.getByTestId('mock-grid-next-page'))
        await waitFor(() => expect(unionBodies.some((body) => body.limit === 10 && body.offset === 10)).toBe(true))

        await user.click(screen.getByTestId('mock-grid-sort-title'))
        await waitFor(() =>
            expect(
                unionBodies.some((body) => {
                    const datasource = body.datasource as { query?: { sort?: unknown } } | undefined
                    return JSON.stringify(datasource?.query?.sort ?? []).includes('"field":"title"')
                })
            ).toBe(true)
        )

        await user.click(screen.getByTestId('mock-grid-filter-status'))
        await waitFor(() =>
            expect(
                unionBodies.some((body) => {
                    const datasource = body.datasource as { query?: { filters?: unknown } } | undefined
                    return JSON.stringify(datasource?.query?.filters ?? []).includes('"field":"status"')
                })
            ).toBe(true)
        )
    })

    it('delegates records.union toolbar search to the server datasource and resets pagination', async () => {
        const user = userEvent.setup()
        const unionBodies: Array<Record<string, unknown>> = []
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            unionBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [{ id: `union-search-row-${unionBodies.length}`, title: `Content ${unionBodies.length}` }],
                    pagination: {
                        total: 50,
                        limit: Number((unionBodies.at(-1) as { limit?: unknown } | undefined)?.limit ?? 20),
                        offset: Number((unionBodies.at(-1) as { offset?: unknown } | undefined)?.offset ?? 0)
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-search',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            showSearch: true,
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'page',
                                        titleField: 'Title'
                                    },
                                    {
                                        sectionCodename: 'Courses',
                                        displayType: 'course',
                                        titleField: 'Title'
                                    }
                                ]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(unionBodies).toHaveLength(1))
        await user.click(screen.getByTestId('mock-grid-next-page'))
        await waitFor(() => expect(unionBodies.some((body) => body.offset === 10)).toBe(true))

        await user.type(screen.getByRole('textbox', { name: 'toolbar.search' }), 'Safety')

        await waitFor(() =>
            expect(
                unionBodies.some((body) => {
                    const datasource = body.datasource as { query?: { search?: unknown } } | undefined
                    return datasource?.query?.search === 'Safety' && body.offset === 0
                })
            ).toBe(true)
        )
    })

    it('applies records.union target filters to the server datasource and resets pagination', async () => {
        const user = userEvent.setup()
        const unionBodies: Array<Record<string, unknown>> = []
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            unionBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [{ id: `union-filter-row-${unionBodies.length}`, title: `Content ${unionBodies.length}` }],
                    pagination: {
                        total: 50,
                        limit: Number((unionBodies.at(-1) as { limit?: unknown } | undefined)?.limit ?? 20),
                        offset: Number((unionBodies.at(-1) as { offset?: unknown } | undefined)?.offset ?? 0)
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
                        sections: [
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' },
                            { id: '017f22e2-79b0-7cc3-98c4-dc0c0c073992', codename: 'Courses' }
                        ],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-target-filter',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'resource',
                                        titleField: 'Title'
                                    },
                                    {
                                        sectionCodename: 'Courses',
                                        displayType: 'course',
                                        titleField: 'Title'
                                    }
                                ]
                            },
                            targetFilters: [
                                {
                                    id: 'resources',
                                    label: 'Resources',
                                    targetDisplayTypes: ['resource']
                                },
                                {
                                    id: 'courses',
                                    label: 'Courses',
                                    targetDisplayTypes: ['course']
                                }
                            ]
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(unionBodies).toHaveLength(1))
        await user.click(screen.getByTestId('mock-grid-next-page'))
        await waitFor(() => expect(unionBodies.some((body) => body.offset === 10)).toBe(true))

        await user.click(screen.getByRole('combobox', { name: /toolbar\.typeFilter|Type/i }))
        await user.click(await screen.findByRole('option', { name: 'Courses' }))

        await waitFor(() =>
            expect(
                unionBodies.some((body) => {
                    const datasource = body.datasource as { targets?: Array<{ displayType?: string }> } | undefined
                    return body.offset === 0 && datasource?.targets?.length === 1 && datasource.targets[0]?.displayType === 'course'
                })
            ).toBe(true)
        )
    })

    it('keeps the generic recentAt projection visible in records.union display columns', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-type',
                            codename: 'Type',
                            field: 'type',
                            dataType: 'STRING',
                            headerName: 'Type',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridSortable: false, gridFilterable: false }
                        },
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'runtime-union-recent-at',
                            codename: 'RecentAt',
                            field: 'recentAt',
                            dataType: 'DATE',
                            headerName: 'Viewed',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridFilterable: false }
                        },
                        {
                            id: 'runtime-union-updated-at',
                            codename: 'UpdatedAt',
                            field: 'updatedAt',
                            dataType: 'DATE',
                            headerName: 'Updated',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridFilterable: false }
                        },
                        {
                            id: 'runtime-target-id',
                            codename: 'TargetRecordId',
                            field: 'TargetRecordId',
                            dataType: 'STRING',
                            headerName: 'Target Record',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: 'union-row-1',
                            type: 'Page',
                            title: 'Welcome',
                            recentAt: '2026-05-21T08:30:00.000Z',
                            updatedAt: '2026-05-20T08:30:00.000Z',
                            TargetRecordId: '018f8a78-7b8f-7c1d-a111-2222333344d3'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-recent',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'page',
                                        titleField: 'Title'
                                    }
                                ],
                                query: {
                                    libraryView: 'recent',
                                    sort: [{ field: 'recentAt', direction: 'desc' }]
                                }
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() =>
            expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'type,title,recentAt,updatedAt')
        )
    })

    it('lets users hide safe records.union columns without exposing technical columns in the menu', async () => {
        window.localStorage.clear()
        const user = userEvent.setup()
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: RequestInfo | URL) => {
                const url = new URL(String(input), 'http://localhost')
                if (url.pathname === '/api/v1/auth/csrf') {
                    return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    })
                }

                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        columns: [
                            {
                                id: 'runtime-union-title',
                                codename: 'Title',
                                field: 'title',
                                dataType: 'STRING',
                                headerName: 'Title',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'runtime-union-status',
                                codename: 'Status',
                                field: 'status',
                                dataType: 'STRING',
                                headerName: 'Status',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            },
                            {
                                id: 'runtime-union-target',
                                codename: 'TargetRecordId',
                                field: 'TargetRecordId',
                                dataType: 'STRING',
                                headerName: 'Target Record ID',
                                isRequired: false,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        rows: [
                            {
                                id: 'resource-1:row-1',
                                title: 'Welcome page',
                                status: 'Published',
                                TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
                            }
                        ],
                        pagination: { total: 1, limit: 20, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            })
        )

        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-columns',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            showViewToggle: true,
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'title,status'))
        await user.click(screen.getByRole('button', { name: 'Columns' }))

        expect(screen.getByText('Title')).toBeVisible()
        expect(screen.getByText('Status')).toBeVisible()
        expect(screen.queryByText('Target Record ID')).not.toBeInTheDocument()

        await user.click(screen.getByText('Status'))

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-hidden-fields', 'status'))
    })

    it('applies generic table defaults to records.union column order and card view', async () => {
        window.localStorage.clear()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(JSON.parse(String(init?.body))).toMatchObject({
                datasource: {
                    kind: 'records.union'
                }
            })

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-type',
                            codename: 'Type',
                            field: 'type',
                            dataType: 'STRING',
                            headerName: 'Type',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: { gridSortable: false, gridFilterable: false }
                        },
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'runtime-union-status',
                            codename: 'Status',
                            field: 'status',
                            dataType: 'STRING',
                            headerName: 'Status',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'runtime-union-project',
                            codename: 'ProjectId',
                            field: 'ProjectId',
                            dataType: 'STRING',
                            headerName: 'Project',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: 'resource-1:row-1',
                            type: 'Learning Resources',
                            title: 'Welcome page',
                            status: 'Published',
                            ProjectId: '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            defaultViewMode: 'card',
                            columnPreset: {
                                columns: [
                                    { field: 'type', visible: true, width: 140 },
                                    { field: 'title', visible: true, flex: 1 },
                                    { field: 'status', visible: true, width: 160 },
                                    { field: 'ProjectId', visible: false }
                                ]
                            }
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-card-default',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            showViewToggle: true,
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    {
                                        sectionCodename: 'LearningResources',
                                        displayType: 'page',
                                        titleField: 'Title',
                                        statusField: 'PublicationStatus'
                                    }
                                ]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByTestId('records-union-card-view')).toBeInTheDocument()
        expect(await screen.findByText('Welcome page')).toBeInTheDocument()
        expect(await screen.findByText('Published')).toBeInTheDocument()
        expect(screen.queryByText('017f22e2-79b0-7cc3-98c4-dc0c0c073999')).not.toBeInTheDocument()
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
    })

    it('sanitizes records.union card title and description values without leaking technical text', async () => {
        window.localStorage.clear()
        const unsafeRecordId = '017f22e2-79b0-7cc3-98c4-dc0c0c073999'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(JSON.parse(String(init?.body))).toMatchObject({
                datasource: {
                    kind: 'records.union'
                }
            })

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    columns: [
                        {
                            id: 'runtime-union-title',
                            codename: 'Title',
                            field: 'title',
                            dataType: 'STRING',
                            headerName: 'Title',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'runtime-union-status',
                            codename: 'Status',
                            field: 'status',
                            dataType: 'STRING',
                            headerName: 'Status',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        },
                        {
                            id: 'runtime-union-resource-type',
                            codename: 'ResourceType',
                            field: 'resourceType',
                            dataType: 'STRING',
                            headerName: 'Resource type',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {}
                        }
                    ],
                    rows: [
                        {
                            id: 'resource-1:row-1',
                            type: 'Learning Resources',
                            title: `Project ${unsafeRecordId}`,
                            status: '{"storageKey":"lesson.pdf","mimeType":"application/pdf"}',
                            resourceType: { codename: 'StandaloneContent' }
                        },
                        {
                            id: 'resource-1:row-2',
                            type: 'Learning Resources',
                            title: 'Readable page',
                            status: 'Published',
                            resourceType: { label: 'Page' }
                        }
                    ],
                    pagination: { total: 2, limit: 20, offset: 0 }
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
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: [],
                        tableDefaults: {
                            defaultViewMode: 'card'
                        }
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-card-safe-display',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page', titleField: 'Title' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await screen.findByText('Untitled item')
        const cardView = screen.getByTestId('records-union-card-view')
        expect(within(cardView).getByText('Untitled item')).toBeInTheDocument()
        expect(within(cardView).getByText('Readable page')).toBeInTheDocument()
        expect(within(cardView).getByText('Published')).toBeInTheDocument()
        expect(within(cardView).queryByText((content) => content.includes(unsafeRecordId))).not.toBeInTheDocument()
        expect(within(cardView).queryByText(/storageKey|mimeType|StandaloneContent|\[object Object\]/)).not.toBeInTheDocument()
    })

    it('does not fall back to the current-object grid when a records.union datasource lacks runtime context', () => {
        render(
            <QueryClientProvider client={createQueryClient()}>
                <DashboardDetailsProvider
                    value={{
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        locale: 'en',
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        rows: [{ id: 'fallback-row', TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997' }],
                        columns: [{ field: 'TargetRecordId', headerName: 'Target Record ID' }]
                    }}
                >
                    {renderWidget({
                        id: 'widget-union-missing-runtime',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(screen.getByTestId('records-union-details-table')).toBeInTheDocument()
        expect(screen.getByText('This content view is not available yet. Check the application runtime configuration.')).toBeInTheDocument()
        expect(screen.queryByTestId('customized-grid')).not.toBeInTheDocument()
        expect(screen.queryByText('017f22e2-79b0-7cc3-98c4-dc0c0c073997')).not.toBeInTheDocument()
    })

    it('adds a restore action for deleted records.union rows', async () => {
        window.localStorage.clear()
        const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/restore')) {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const response = createAppDataResponse()
            return new Response(
                JSON.stringify({
                    ...response,
                    rows: [
                        {
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991:017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeSourceRowId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                            __runtimeObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                            title: 'Archived page',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073991', codename: 'LearningResources' }],
                        objectCollections: [],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-trash',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }],
                                query: { lifecycleState: 'deleted' }
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))

        await waitFor(() => {
            const restoreCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/restore'))
            expect(restoreCall).toBeDefined()
            expect(new URL(String(restoreCall?.[0])).pathname).toBe(
                '/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/rows/017f22e2-79b0-7cc3-98c4-dc0c0c073997/restore'
            )
            expect(restoreCall?.[1]).toMatchObject({
                method: 'POST',
                body: JSON.stringify({
                    objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073991',
                    expectedVersion: 3
                })
            })
        })

        const unionCall = fetchMock.mock.calls.find(([input]) =>
            new URL(String(input), 'http://localhost').pathname.endsWith('/runtime/datasources/records/union')
        )
        expect(JSON.parse(String(unionCall?.[1]?.body))).toMatchObject({
            datasource: {
                query: { lifecycleState: 'deleted' }
            }
        })
    })

    it('uses the generic restore target picker for deleted records.union rows when metadata configures one', async () => {
        window.localStorage.clear()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const archivedRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const projectRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073902'
        const unsafeProjectRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073905'
        const workspaceId = '017f22e2-79b0-7cc3-98c4-dc0c0c073904'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/restore')) {
                return new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const response = createAppDataResponse()
            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(
                    JSON.stringify({
                        ...response,
                        rows: [
                            { id: unsafeProjectRowId, Codename: 'ContentProjects' },
                            { id: projectRowId, Name: 'Safety project' }
                        ],
                        columns: [
                            {
                                id: '017f22e2-79b0-7cc3-98c4-dc0c0c073903',
                                codename: 'Name',
                                field: 'Name',
                                dataType: 'STRING',
                                headerName: 'Name',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...response,
                    rows: [
                        {
                            id: `${learningResourcesId}:${archivedRowId}`,
                            __runtimeSourceRowId: archivedRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            title: 'Archived page',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: workspaceId,
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        objectCollections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-trash',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }],
                                query: { lifecycleState: 'deleted' }
                            },
                            restoreTarget: {
                                targetObjectCollectionCodename: 'ContentProjects',
                                parentFieldCodename: 'ProjectId',
                                dialogTitle: 'Restore to project',
                                targetLabel: 'Project'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))
        const dialog = await screen.findByRole('dialog', { name: 'Restore to project' })
        await waitFor(() =>
            expect(
                fetchMock.mock.calls.some(
                    ([input]) => new URL(String(input), 'http://localhost').searchParams.get('objectCollectionId') === contentProjectsId
                )
            ).toBe(true)
        )
        await userEvent.click(within(dialog).getByRole('combobox', { name: 'Project' }))
        expect(await screen.findByRole('option', { name: 'Untitled target' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'ContentProjects' })).not.toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(unsafeProjectRowId)
        await userEvent.click(await screen.findByRole('option', { name: 'Safety project' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))

        await waitFor(() => {
            const restoreCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/restore'))
            expect(restoreCall).toBeDefined()
            expect(restoreCall?.[1]).toMatchObject({
                method: 'POST',
                body: JSON.stringify({
                    objectCollectionId: learningResourcesId,
                    expectedVersion: 3,
                    restoreTarget: {
                        mode: 'target',
                        targetObjectCollectionId: contentProjectsId,
                        targetRecordId: projectRowId,
                        targetWorkspaceId: workspaceId,
                        parentFieldCodename: 'ProjectId'
                    }
                })
            })
        })
    })

    it('shows a localized restore target load error without exposing backend details', async () => {
        window.localStorage.clear()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const archivedRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(JSON.stringify({ error: 'SQL relation app_runtime.projects does not exist' }), {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [
                        {
                            id: `${learningResourcesId}:${archivedRowId}`,
                            __runtimeSourceRowId: archivedRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            title: 'Archived page',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: '017f22e2-79b0-7cc3-98c4-dc0c0c073904',
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        objectCollections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-trash',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }],
                                query: { lifecycleState: 'deleted' }
                            },
                            restoreTarget: {
                                targetObjectCollectionCodename: 'ContentProjects',
                                parentFieldCodename: 'ProjectId',
                                labelFields: ['Name'],
                                dialogTitle: 'Restore to project',
                                targetLabel: 'Project'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))

        const dialog = await screen.findByRole('dialog', { name: 'Restore to project' })
        expect(await within(dialog).findByText('Restore targets could not be loaded.')).toBeInTheDocument()
        expect(within(dialog).queryByText(/SQL relation/i)).not.toBeInTheDocument()
    })

    it('keeps restore confirmation disabled when the target picker has no valid options', async () => {
        window.localStorage.clear()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const archivedRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        activeObjectCollectionId: contentProjectsId,
                        rows: [],
                        pagination: { total: 0, limit: 100, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [
                        {
                            id: `${learningResourcesId}:${archivedRowId}`,
                            __runtimeSourceRowId: archivedRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            title: 'Archived page',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: '017f22e2-79b0-7cc3-98c4-dc0c0c073904',
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        objectCollections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-trash',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }],
                                query: { lifecycleState: 'deleted' }
                            },
                            restoreTarget: {
                                targetObjectCollectionCodename: 'ContentProjects',
                                parentFieldCodename: 'ProjectId',
                                labelFields: ['Name'],
                                dialogTitle: 'Restore to project',
                                targetLabel: 'Project'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))

        const dialog = await screen.findByRole('dialog', { name: 'Restore to project' })
        expect(await within(dialog).findByText('No available targets were found.')).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Restore' })).toBeDisabled()
    })

    it('sanitizes failed restore mutations in the generic restore target picker', async () => {
        window.localStorage.clear()
        const learningResourcesId = '017f22e2-79b0-7cc3-98c4-dc0c0c073991'
        const contentProjectsId = '017f22e2-79b0-7cc3-98c4-dc0c0c073901'
        const archivedRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
        const projectRowId = '017f22e2-79b0-7cc3-98c4-dc0c0c073902'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/restore')) {
                return new Response(JSON.stringify({ error: 'duplicate key value violates orders_project_id_fkey' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            if (url.pathname.endsWith('/runtime') && url.searchParams.get('objectCollectionId') === contentProjectsId) {
                return new Response(
                    JSON.stringify({
                        ...createAppDataResponse(),
                        activeObjectCollectionId: contentProjectsId,
                        rows: [{ id: projectRowId, Name: 'Safety project' }],
                        columns: [
                            {
                                id: '017f22e2-79b0-7cc3-98c4-dc0c0c073903',
                                codename: 'Name',
                                field: 'Name',
                                dataType: 'STRING',
                                headerName: 'Name',
                                isRequired: true,
                                validationRules: {},
                                uiConfig: {}
                            }
                        ],
                        pagination: { total: 1, limit: 100, offset: 0 }
                    }),
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
            }

            return new Response(
                JSON.stringify({
                    ...createAppDataResponse(),
                    rows: [
                        {
                            id: `${learningResourcesId}:${archivedRowId}`,
                            __runtimeSourceRowId: archivedRowId,
                            __runtimeObjectCollectionId: learningResourcesId,
                            title: 'Archived page',
                            _upl_version: 3
                        }
                    ],
                    pagination: { total: 1, limit: 20, offset: 0 }
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
                        currentWorkspaceId: '017f22e2-79b0-7cc3-98c4-dc0c0c073904',
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        objectCollections: [
                            { id: learningResourcesId, codename: 'LearningResources' },
                            { id: contentProjectsId, codename: 'ContentProjects', name: 'Projects' }
                        ],
                        rows: [],
                        columns: []
                    }}
                >
                    {renderWidget({
                        id: 'widget-trash',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [{ sectionCodename: 'LearningResources', displayType: 'page' }],
                                query: { lifecycleState: 'deleted' }
                            },
                            restoreTarget: {
                                targetObjectCollectionCodename: 'ContentProjects',
                                parentFieldCodename: 'ProjectId',
                                labelFields: ['Name'],
                                dialogTitle: 'Restore to project',
                                targetLabel: 'Project'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))
        const dialog = await screen.findByRole('dialog', { name: 'Restore to project' })
        await userEvent.click(within(dialog).getByRole('combobox', { name: 'Project' }))
        await userEvent.click(await screen.findByRole('option', { name: 'Safety project' }))
        await userEvent.click(within(dialog).getByRole('button', { name: 'Restore' }))

        expect(await within(dialog).findByText('Record could not be restored.')).toBeInTheDocument()
        expect(within(dialog).queryByText(/duplicate key|orders_project_id_fkey/i)).not.toBeInTheDocument()
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
                            ProgressDelta: 10,
                            id: 'payload-id-that-must-not-replace-grid-row-id',
                            TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                            sourceJson: { type: 'url', url: 'https://example.test/lesson' },
                            _upl_version: 7,
                            __internalPayload: { hidden: true },
                            Metadata: { status: ['active'], score: { gte: 80 } }
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
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-ids', 'fact-1')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '1')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'createdAt,Learner,ProgressDelta,Metadata')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-headers', 'Created At,Learner,Progress Delta,Metadata')
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('TargetRecordId'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('sourceJson'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('_upl_version'))
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('https://example.test/lesson')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('[object Object]')

        const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(requestedUrl.pathname).toBe(
            '/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/ledgers/017f22e2-79b0-7cc3-98c4-dc0c0c073995/facts'
        )
        expect(requestedUrl.searchParams.get('limit')).toBe('20')
        expect(requestedUrl.searchParams.get('offset')).toBe('0')
    })

    it('renders ledger projection datasources without exposing technical fields or raw payloads', async () => {
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
                    projection: { codename: 'ProgressByLearner' },
                    rows: [
                        {
                            LearnerName: 'Ana',
                            ProgressPercent: 80,
                            TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                            sourceJson: { type: 'url', url: 'https://example.test/projection' },
                            _upl_version: 11,
                            __internalPayload: { hidden: true },
                            Metadata: { status: ['active'], score: { gte: 80 } }
                        }
                    ],
                    limit: 20,
                    offset: 0
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
                                kind: 'ledger.projection',
                                ledgerId: '017f22e2-79b0-7cc3-98c4-dc0c0c073995',
                                projectionCodename: 'ProgressByLearner'
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-ids', 'ledger-row-0')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'LearnerName,ProgressPercent,Metadata')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-headers', 'Learner Name,Progress Percent,Metadata')
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('TargetRecordId'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('sourceJson'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('_upl_version'))
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('https://example.test/projection')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('[object Object]')

        const queryCall = fetchMock.mock.calls.find(([input]) => String(input).includes('/runtime/ledgers/'))!
        const requestedUrl = new URL(queryCall[0] as string)
        expect(requestedUrl.pathname).toBe(
            '/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/ledgers/017f22e2-79b0-7cc3-98c4-dc0c0c073995/query'
        )
        expect(queryCall[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({ projectionCodename: 'ProgressByLearner', limit: 20, offset: 0 })
        })
    })

    it('renders saved report codename references through the shared data grid contract', async () => {
        window.localStorage.clear()
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
                    rows: [
                        {
                            ProgressPercent: 75,
                            ProjectId: { label: 'Operations project' },
                            TargetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                            sourceJson: { type: 'url', url: 'https://example.test/report-source' },
                            _upl_version: 5
                        }
                    ],
                    total: 1,
                    definition: {
                        codename: 'LearnerProgress',
                        title: 'Learner progress',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'ContentProgress'
                        },
                        columns: [
                            { field: 'ProgressPercent', label: 'Progress', type: 'number' },
                            { field: 'ProjectId', label: 'Project', type: 'text' },
                            { field: 'TargetRecordId', label: 'Target Record Id', type: 'text' },
                            { field: 'sourceJson', label: 'Source JSON', type: 'text' },
                            { field: '_upl_version', label: 'UPL Version', type: 'number' }
                        ]
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
                            reportCodename: 'LearnerProgress'
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-row-count', '1')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-fields', 'ProgressPercent,ProjectId')
        expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-column-headers', 'Progress,Project')
        expect(screen.getByTestId('customized-grid')).toHaveTextContent('Operations project')
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('TargetRecordId'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('sourceJson'))
        expect(screen.getByTestId('customized-grid')).not.toHaveAttribute('data-column-fields', expect.stringContaining('_upl_version'))
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('017f22e2-79b0-7cc3-98c4-dc0c0c073990')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('https://example.test/report-source')
        expect(screen.getByTestId('customized-grid')).not.toHaveTextContent('[object Object]')

        const reportCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/runtime/reports/run'))
        expect(reportCall).toBeDefined()
        const requestedUrl = new URL(String(reportCall?.[0]))
        expect(requestedUrl.pathname).toBe('/api/v1/applications/017f22e2-79b0-7cc3-98c4-dc0c0c073993/runtime/reports/run')
        expect(requestedUrl.searchParams.get('workspaceId')).toBe('workspace-1')
        expect(reportCall?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                reportCodename: 'LearnerProgress',
                limit: 20,
                offset: 0
            })
        })
    })

    it('shows a localized report load failure without leaking backend details', async () => {
        window.localStorage.clear()
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
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
                    error: `SQL relation app_runtime.progress does not exist for ${leakedUuid}`
                }),
                {
                    status: 500,
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
                            reportCodename: 'LearnerProgress'
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText(/reports\.loadError|Report could not be loaded/)).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(leakedUuid)
        expect(document.body).not.toHaveTextContent(/SQL relation/i)
        expect(document.body).not.toHaveTextContent(/app_runtime/i)
    })

    it('passes report grid filters to saved report run and export requests', async () => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:runtime-report')
        })
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn()
        })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const pathname = new URL(url, 'http://localhost:3000').pathname
            if (pathname.endsWith('/runtime/reports/export')) {
                return new Response('Status\r\nPublished\r\n', {
                    status: 200,
                    headers: { 'Content-Type': 'text/csv; charset=utf-8' }
                })
            }

            return new Response(
                JSON.stringify({
                    rows: [{ Status: 'Published' }],
                    total: 1,
                    definition: {
                        codename: 'LearningContentSummary',
                        title: 'Learning content summary',
                        datasource: {
                            kind: 'records.union',
                            targets: [{ objectCollectionCodename: 'LearningResources', displayType: 'Resource' }]
                        },
                        columns: [{ field: 'Status', label: 'Status', type: 'status' }]
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
                            reportCodename: 'LearningContentSummary'
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        await userEvent.click(screen.getByTestId('mock-grid-filter-first-column'))

        await waitFor(() => {
            const runCalls = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/runtime/reports/run'))
            expect(runCalls).toHaveLength(2)
        })
        const runCalls = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname.endsWith('/runtime/reports/run'))
        expect(runCalls.at(-1)?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                reportCodename: 'LearningContentSummary',
                filters: [{ field: 'Status', operator: 'equals', value: 'Published' }],
                limit: 20,
                offset: 0
            })
        })

        await userEvent.click(screen.getByRole('button', { name: 'reports.exportCsv' }))
        await waitFor(() => {
            const exportCalls = fetchMock.mock.calls.filter(([input]) =>
                new URL(String(input)).pathname.endsWith('/runtime/reports/export')
            )
            expect(exportCalls).toHaveLength(1)
        })
        const exportCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/runtime/reports/export'))
        expect(exportCall?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                reportCodename: 'LearningContentSummary',
                filters: [{ field: 'Status', operator: 'equals', value: 'Published' }],
                limit: 5000,
                offset: 0,
                locale: 'en'
            })
        })
    })

    it('uses the localized report title instead of the technical codename for CSV export filenames', async () => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        let clickedDownload = ''
        Object.defineProperty(URL, 'createObjectURL', {
            configurable: true,
            value: vi.fn(() => 'blob:runtime-report')
        })
        Object.defineProperty(URL, 'revokeObjectURL', {
            configurable: true,
            value: vi.fn()
        })
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
            clickedDownload = this.download
        })

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            const pathname = new URL(url, 'http://localhost:3000').pathname
            if (pathname.endsWith('/runtime/reports/export')) {
                return new Response('Progress\r\n75\r\n', {
                    status: 200,
                    headers: { 'Content-Type': 'text/csv; charset=utf-8' }
                })
            }

            return new Response(
                JSON.stringify({
                    rows: [{ ProgressPercent: 75 }],
                    total: 1,
                    definition: {
                        codename: 'LearnerProgressInternal',
                        title: { en: 'Learner progress report', ru: 'Learner progress report' },
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'ContentProgress'
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
                            reportCodename: 'LearnerProgressInternal'
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        await userEvent.click(screen.getByRole('button', { name: 'reports.exportCsv' }))

        await waitFor(() => expect(clickedDownload).toBe('Learner-progress-report.csv'))
        expect(clickedDownload).not.toContain('LearnerProgressInternal')
        const exportCall = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname.endsWith('/runtime/reports/export'))
        expect(exportCall?.[1]).toMatchObject({
            method: 'POST',
            body: JSON.stringify({
                reportCodename: 'LearnerProgressInternal',
                limit: 5000,
                offset: 0,
                locale: 'en'
            })
        })
    })

    it('shows a localized report export failure without leaking backend details', async () => {
        window.localStorage.clear()
        window.sessionStorage.clear()
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const pathname = new URL(url, 'http://localhost:3000').pathname
            if (pathname.endsWith('/runtime/reports/export')) {
                return new Response(
                    JSON.stringify({
                        error: `duplicate key violates constraint reports_workspace_unique for ${leakedUuid}`
                    }),
                    {
                        status: 500,
                        headers: { 'Content-Type': 'application/json' }
                    }
                )
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
                            sectionCodename: 'ContentProgress'
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
                            reportCodename: 'LearnerProgress'
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        await userEvent.click(screen.getByRole('button', { name: 'reports.exportCsv' }))

        expect(await screen.findByText(/reports\.exportError|Export failed/)).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(leakedUuid)
        expect(document.body).not.toHaveTextContent(/duplicate key/i)
        expect(document.body).not.toHaveTextContent(/constraint/i)
    })

    it('suppresses primitive ID values in report cells while preserving resolved labels', async () => {
        window.localStorage.clear()
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
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
                    rows: [
                        {
                            ProgressStudentId: leakedUuid,
                            TargetId: 'track-learning-path',
                            ResolvedStudentId: { displayName: 'Ava Learner' },
                            ProgressPercent: 75,
                            Note: `Ticket ${leakedUuid}`
                        }
                    ],
                    total: 1,
                    definition: {
                        codename: 'LearnerProgress',
                        title: 'Learner progress',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'ContentProgress'
                        },
                        columns: [
                            { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                            { field: 'TargetId', label: 'Learning Item', type: 'text' },
                            { field: 'ResolvedStudentId', label: 'Resolved learner', type: 'text' },
                            { field: 'ProgressPercent', label: 'Progress', type: 'number' },
                            { field: 'Note', label: 'Note', type: 'text' }
                        ]
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
                                    sectionCodename: 'ContentProgress'
                                },
                                columns: [
                                    { field: 'ProgressStudentId', label: 'Learner', type: 'text' },
                                    { field: 'TargetId', label: 'Learning Item', type: 'text' },
                                    { field: 'ResolvedStudentId', label: 'Resolved learner', type: 'text' },
                                    { field: 'ProgressPercent', label: 'Progress', type: 'number' },
                                    { field: 'Note', label: 'Note', type: 'text' }
                                ]
                            }
                        }
                    })}
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        await waitFor(() => expect(screen.getByTestId('customized-grid')).toHaveAttribute('data-rows', '1'))
        expect(screen.getByText('Ava Learner')).toBeInTheDocument()
        expect(screen.getByText('75')).toBeInTheDocument()
        expect(document.body).not.toHaveTextContent(leakedUuid)
        expect(document.body).not.toHaveTextContent('track-learning-path')
        expect(screen.queryByText(/Ticket/)).not.toBeInTheDocument()
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
        expect(screen.getByText('Video')).toBeInTheDocument()
        expect(screen.queryByText('video')).not.toBeInTheDocument()
    })

    it('renders generic detailsTabs and switches between existing widget panels', async () => {
        render(
            <DashboardDetailsProvider value={{ locale: 'en' } as never}>
                {renderWidget({
                    id: 'course-tabs',
                    widgetKey: 'detailsTabs',
                    sortOrder: 0,
                    config: {
                        tabs: [
                            {
                                id: 'outline',
                                label: 'Outline',
                                widgets: [
                                    {
                                        widgetKey: 'resourcePreview',
                                        config: {
                                            title: 'Outline panel',
                                            source: {
                                                type: 'url',
                                                url: 'https://example.com/outline'
                                            }
                                        }
                                    }
                                ]
                            },
                            {
                                id: 'reports',
                                label: 'Reports',
                                widgets: [
                                    {
                                        widgetKey: 'resourcePreview',
                                        config: {
                                            title: 'Reports panel',
                                            source: {
                                                type: 'url',
                                                url: 'https://example.com/reports'
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                })}
            </DashboardDetailsProvider>
        )

        expect(screen.getByTestId('runtime-details-tabs')).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Reports' })).toBeInTheDocument()
        expect(screen.getByText('Outline panel')).toBeInTheDocument()
        expect(screen.queryByText('Reports panel')).not.toBeInTheDocument()

        await userEvent.click(screen.getByRole('tab', { name: 'Reports' }))

        expect(screen.getByText('Reports panel')).toBeInTheDocument()
        expect(screen.queryByText('Outline panel')).not.toBeInTheDocument()
    })

    it('renders generic detailsTabs fallback labels without exposing raw tab IDs', () => {
        const rawTabId = '017f22e2-79b0-7cc3-98c4-dc0c0c073996'

        render(
            <DashboardDetailsProvider value={{ locale: 'en' } as never}>
                {renderWidget({
                    id: 'fallback-tabs',
                    widgetKey: 'detailsTabs',
                    sortOrder: 0,
                    config: {
                        tabs: [
                            {
                                id: 'course-outline',
                                widgets: [
                                    {
                                        widgetKey: 'resourcePreview',
                                        config: {
                                            title: 'Course outline panel',
                                            source: {
                                                type: 'url',
                                                url: 'https://example.com/outline'
                                            }
                                        }
                                    }
                                ]
                            },
                            {
                                id: rawTabId,
                                widgets: [
                                    {
                                        widgetKey: 'resourcePreview',
                                        config: {
                                            title: 'Technical fallback panel',
                                            source: {
                                                type: 'url',
                                                url: 'https://example.com/technical'
                                            }
                                        }
                                    }
                                ]
                            }
                        ]
                    }
                })}
            </DashboardDetailsProvider>
        )

        expect(screen.getByRole('tab', { name: 'Course outline' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
        expect(screen.queryByRole('tab', { name: 'course-outline' })).not.toBeInTheDocument()
        expect(screen.queryByText(rawTabId)).not.toBeInTheDocument()
    })
})
