import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type React from 'react'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'
import { renderWidget } from '../widgetRenderer'

vi.mock('../CustomizedDataGrid', () => ({
    default: (props: {
        rows: Array<Record<string, unknown>>
        columns?: Array<{ field: string; renderCell?: (params: { row: Record<string, unknown>; value: unknown }) => React.ReactNode }>
        rowCount?: number
        loading?: boolean
        onSortModelChange?: unknown
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
                data-row-count={String(props.rowCount ?? 0)}
                data-loading={String(Boolean(props.loading))}
                data-server-sort={String(Boolean(props.onSortModelChange))}
            >
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
                        columns: []
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
        expect(screen.getByText(firstItemId)).toBeInTheDocument()
        expect(screen.queryByText(otherCourseFirstItemId)).not.toBeInTheDocument()
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
                return new Response(JSON.stringify({ persisted: true, progressPercent: 100, status: 'completed' }), { status: 200 })
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
        expect(await screen.findByTestId('resource-preview')).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Complete' }))

        await waitFor(() => expect(screen.getByText('1 of 2 completed')).toBeInTheDocument())
        const progressRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/runtime/progress/content'))
        expect(progressRequest?.[1]).toMatchObject({ method: 'POST' })
        expect(JSON.parse(String(progressRequest?.[1]?.body))).toEqual(
            expect.objectContaining({
                targetObjectCodename: 'CourseItems',
                targetRecordId: firstItemId,
                action: 'complete',
                progressPercent: 100,
                status: 'completed'
            })
        )
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
                return new Response(JSON.stringify({ persisted: true, progressPercent: 100, status: 'completed' }), { status: 200 })
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

        await user.click(screen.getByRole('button', { name: 'Complete' }))

        await waitFor(() => expect(screen.getByText('1 of 1 completed')).toBeInTheDocument())
        const progressRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/runtime/progress/content'))
        expect(progressRequest?.[1]).toMatchObject({ method: 'POST' })
        expect(JSON.parse(String(progressRequest?.[1]?.body))).toEqual(
            expect.objectContaining({
                targetObjectCodename: 'TrackSteps',
                targetRecordId: stepId,
                action: 'complete',
                progressPercent: 100,
                status: 'completed'
            })
        )
    })

    it('renders parent-scoped relation builder panels and filters child rows by the selected parent', async () => {
        const courseSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073980'
        const courseItemsSectionId = '017f22e2-79b0-7cc3-98c4-dc0c0c073981'
        const firstCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073982'
        const secondCourseId = '017f22e2-79b0-7cc3-98c4-dc0c0c073983'
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
                                    title: 'Items',
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
                                                label: 'Content',
                                                fieldCodenames: ['Title']
                                            },
                                            {
                                                id: 'parameters',
                                                label: 'Parameters',
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
        expect(screen.getByText('Parameters')).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
        await userEvent.type(screen.getByRole('textbox', { name: 'Title' }), 'Guided enrollment')
        await userEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText('Set enrollment parameters.')).toBeInTheDocument()
        expect(screen.getByLabelText('Due Date')).toBeInTheDocument()
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
    })

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
                        title: 'Details',
                        applicationId: '017f22e2-79b0-7cc3-98c4-dc0c0c073993',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        runtimeQueryKeyPrefix: ['runtime', 'app-1'],
                        sections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        objectCollections: [{ id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990', codename: 'CourseItems' }],
                        rows: [],
                        columns: []
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

        await userEvent.click(screen.getByTestId('runtime-row-move-down-017f22e2-79b0-7cc3-98c4-dc0c0c073992'))

        await waitFor(() => {
            const reorderCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/runtime/rows/reorder'))
            expect(reorderCall).toBeDefined()
            expect(reorderCall?.[1]).toMatchObject({
                method: 'POST',
                body: JSON.stringify({
                    orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073994', '017f22e2-79b0-7cc3-98c4-dc0c0c073992'],
                    objectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073990'
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
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            const targetId = url.searchParams.get('objectCollectionId')
            const response = createAppDataResponse()

            return new Response(
                JSON.stringify({
                    ...response,
                    rows: [
                        {
                            id: targetId?.endsWith('3991')
                                ? '017f22e2-79b0-7cc3-98c4-dc0c0c073997'
                                : '017f22e2-79b0-7cc3-98c4-dc0c0c073998',
                            title: targetId?.endsWith('3991') ? 'Welcome page' : 'Safety course'
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
                        id: 'widget-union',
                        widgetKey: 'detailsTable',
                        sortOrder: 0,
                        config: {
                            datasource: {
                                kind: 'records.union',
                                targets: [
                                    { sectionCodename: 'LearningResources', displayType: 'page' },
                                    { sectionCodename: 'Courses', displayType: 'course' }
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
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const requestedTargets = fetchMock.mock.calls.map((call) => new URL(call[0] as string).searchParams.get('objectCollectionId'))
        expect(requestedTargets).toEqual(['017f22e2-79b0-7cc3-98c4-dc0c0c073991', '017f22e2-79b0-7cc3-98c4-dc0c0c073992'])
        expect(fetchMock.mock.calls.map((call) => new URL(call[0] as string).searchParams.get('libraryView'))).toEqual([
            'starred',
            'starred'
        ])
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
                            id: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
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

        const firstRequestUrl = new URL(fetchMock.mock.calls[0][0] as string)
        expect(firstRequestUrl.searchParams.get('lifecycleState')).toBe('deleted')
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
                            reportDefinition: {
                                codename: 'LearnerProgress',
                                title: 'Learner progress',
                                datasource: {
                                    kind: 'records.list',
                                    sectionCodename: 'ContentProgress'
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
})
