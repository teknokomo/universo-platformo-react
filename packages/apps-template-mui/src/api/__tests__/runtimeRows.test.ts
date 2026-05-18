import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    copyAppRow,
    fetchAppData,
    recalculateLearningContentProgress,
    reorderAppRows,
    restoreAppRow,
    updateLearningContentProgress
} from '../api'

const runtimeListResponse = {
    objectCollection: {
        id: 'collection-1',
        codename: 'LearningResources',
        tableName: 'learning_resources',
        name: 'Learning Resources'
    },
    columns: [],
    rows: [],
    pagination: {
        total: 0,
        limit: 20,
        offset: 0
    },
    permissions: {
        createContent: true,
        editContent: true,
        deleteContent: true
    },
    layoutConfig: {},
    zoneWidgets: {
        left: [],
        right: [],
        center: []
    },
    menus: []
}

describe('runtime row API helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('passes deleted lifecycle state to the runtime list endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime')
            expect(url.searchParams.get('lifecycleState')).toBe('deleted')
            expect(url.searchParams.get('objectCollectionId')).toBe('collection-1')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            return new Response(JSON.stringify(runtimeListResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await fetchAppData({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'collection-1',
            limit: 20,
            offset: 0,
            locale: 'en',
            workspaceId: 'workspace-1',
            lifecycleState: 'deleted'
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('passes metadata-driven library views to the runtime list endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime')
            expect(url.searchParams.get('libraryView')).toBe('shared')
            return new Response(JSON.stringify(runtimeListResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await fetchAppData({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'collection-1',
            limit: 20,
            offset: 0,
            locale: 'en',
            libraryView: 'shared'
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('normalizes localized runtime option codenames from REF and enumeration columns', async () => {
        const localizedCodename = {
            _schema: '1',
            locales: {
                en: {
                    content: 'Published',
                    version: 1,
                    isActive: true,
                    createdAt: '2026-05-17T00:00:00.000Z',
                    updatedAt: '2026-05-17T00:00:00.000Z'
                }
            },
            _primary: 'en'
        }
        const fetchMock = vi.fn(async () => {
            return new Response(
                JSON.stringify({
                    ...runtimeListResponse,
                    columns: [
                        {
                            id: 'status-column',
                            codename: 'Status',
                            field: 'status',
                            dataType: 'REF',
                            headerName: 'Status',
                            isRequired: false,
                            validationRules: {},
                            uiConfig: {},
                            refOptions: [{ id: 'published-id', label: 'Published', codename: localizedCodename }],
                            enumOptions: [{ id: 'published-id', label: 'Published', codename: localizedCodename }]
                        }
                    ]
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const data = await fetchAppData({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'collection-1',
            limit: 20,
            offset: 0,
            locale: 'en'
        })

        expect(data.columns[0]?.refOptions?.[0]?.codename).toBe('Published')
        expect(data.columns[0]?.enumOptions?.[0]?.codename).toBe('Published')
    })

    it('restores a runtime row through the generic restore endpoint with CSRF protection', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1/restore')
            return new Response(JSON.stringify({ status: 'restored' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await restoreAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'collection-1',
            expectedVersion: 4
        })

        const restoreRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(restoreRequest.method).toBe('POST')
        expect(restoreRequest.body).toBe(JSON.stringify({ objectCollectionId: 'collection-1', expectedVersion: 4 }))
        expect(new Headers(restoreRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('copies a runtime row through the generic copy endpoint with overrides and optimistic version', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1/copy')
            return new Response(JSON.stringify({ id: 'row-2', status: 'created' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await copyAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'collection-1',
            data: { Title: 'Copied row' },
            expectedVersion: 4
        })

        const copyRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(copyRequest.method).toBe('POST')
        expect(copyRequest.body).toBe(
            JSON.stringify({
                copyChildTables: true,
                objectCollectionId: 'collection-1',
                data: { Title: 'Copied row' },
                expectedVersion: 4
            })
        )
        expect(new Headers(copyRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('persists Learning Content progress through the server-owned runtime endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/progress/content')
            return new Response(JSON.stringify({ persisted: true, progressPercent: 100, status: 'completed' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await updateLearningContentProgress({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            targetObjectCodename: 'LearningResources',
            targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
            progressPercent: 100,
            status: 'completed'
        })

        const progressRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(progressRequest.method).toBe('POST')
        expect(progressRequest.body).toBe(
            JSON.stringify({
                targetObjectCodename: 'LearningResources',
                targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                progressPercent: 100,
                status: 'completed'
            })
        )
        expect(new Headers(progressRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('requests metadata-driven Learning Content progress recalculation without client progress values', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/progress/content')
            return new Response(JSON.stringify({ persisted: true, action: 'recalculate' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await recalculateLearningContentProgress({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            targetObjectCodename: 'CourseItems',
            targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073998'
        })

        const progressRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(progressRequest.method).toBe('POST')
        expect(progressRequest.body).toBe(
            JSON.stringify({
                targetObjectCodename: 'CourseItems',
                targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073998',
                action: 'recalculate'
            })
        )
        expect(new Headers(progressRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('persists runtime row order through the generic reorder endpoint with CSRF protection', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/rows/reorder')
            return new Response(JSON.stringify({ status: 'reordered' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await reorderAppRows({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'collection-1',
            orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073997', '017f22e2-79b0-7cc3-98c4-dc0c0c073998']
        })

        const reorderRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(reorderRequest.method).toBe('POST')
        expect(reorderRequest.body).toBe(
            JSON.stringify({
                orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073997', '017f22e2-79b0-7cc3-98c4-dc0c0c073998'],
                objectCollectionId: 'collection-1'
            })
        )
        expect(new Headers(reorderRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })
})
