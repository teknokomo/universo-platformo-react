import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    batchUpdateTabularRows,
    copyAppRow,
    createAppRow,
    deleteAppRow,
    fetchAppData,
    fetchTabularRows,
    fetchRuntimeRecordsUnion,
    recalculateLearningContentProgress,
    reorderAppRows,
    restoreAppRow,
    setRuntimeLibraryRelation,
    updateAppRow,
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

    it('passes object collection codename when a datasource target has no resolved runtime id', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime')
            expect(url.searchParams.get('objectCollectionId')).toBeNull()
            expect(url.searchParams.get('objectCollectionCodename')).toBe('LearningResources')
            return new Response(JSON.stringify(runtimeListResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await fetchAppData({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionCodename: 'LearningResources',
            limit: 20,
            offset: 0,
            locale: 'en'
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

    it('runs records.union datasources through the generic server-side endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/datasources/records/union')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(init?.method).toBe('POST')
            expect(init?.body).toBe(
                JSON.stringify({
                    datasource: {
                        kind: 'records.union',
                        targets: [{ sectionCodename: 'LearningResources' }],
                        query: { libraryView: 'starred' }
                    },
                    limit: 20,
                    offset: 40,
                    locale: 'en'
                })
            )
            return new Response(JSON.stringify(runtimeListResponse), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await fetchRuntimeRecordsUnion({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            limit: 20,
            offset: 40,
            locale: 'en',
            datasource: {
                kind: 'records.union',
                targets: [{ sectionCodename: 'LearningResources' }],
                query: { libraryView: 'starred' }
            }
        })

        expect(fetchMock).toHaveBeenCalledTimes(2)
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
            expectedVersion: 4,
            restoreTarget: {
                mode: 'target',
                targetObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073900',
                targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073901',
                parentFieldCodename: 'ProjectId'
            }
        })

        const restoreRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(restoreRequest.method).toBe('POST')
        expect(restoreRequest.body).toBe(
            JSON.stringify({
                objectCollectionId: 'collection-1',
                expectedVersion: 4,
                restoreTarget: {
                    mode: 'target',
                    targetObjectCollectionId: '017f22e2-79b0-7cc3-98c4-dc0c0c073900',
                    targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073901',
                    parentFieldCodename: 'ProjectId'
                }
            })
        )
        expect(new Headers(restoreRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('updates runtime library relation state through the generic row endpoint', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/rows/row-1/library/starred')
            expect(init?.method).toBe('POST')
            expect(init?.body).toBe(JSON.stringify({ objectCollectionId: 'collection-1', active: true }))
            return new Response(JSON.stringify({ relationKey: 'starred', active: true, changed: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await expect(
            setRuntimeLibraryRelation({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                rowId: 'row-1',
                objectCollectionId: 'collection-1',
                relationKey: 'starred',
                active: true
            })
        ).resolves.toEqual({ relationKey: 'starred', active: true, changed: true })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('updates shared runtime library relation state without raw principal IDs by default', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/rows/row-1/library/shared')
            expect(init?.method).toBe('POST')
            expect(init?.body).toBe(JSON.stringify({ objectCollectionId: 'collection-1', active: true }))
            return new Response(JSON.stringify({ relationKey: 'shared', active: true, changed: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await expect(
            setRuntimeLibraryRelation({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                rowId: 'row-1',
                objectCollectionId: 'collection-1',
                relationKey: 'shared',
                active: true
            })
        ).resolves.toEqual({ relationKey: 'shared', active: true, changed: true })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('updates shared runtime library relation state for an explicit workspace member principal', async () => {
        const principalId = '018f8a78-7b8f-7c1d-a111-2222333344b6'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'http://localhost')
            if (url.pathname === '/api/v1/auth/csrf') {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/rows/row-1/library/shared')
            expect(init?.method).toBe('POST')
            expect(init?.body).toBe(
                JSON.stringify({
                    objectCollectionId: 'collection-1',
                    active: true,
                    principalType: 'user',
                    principalId
                })
            )
            return new Response(JSON.stringify({ relationKey: 'shared', active: true, changed: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await expect(
            setRuntimeLibraryRelation({
                apiBaseUrl: '/api/v1',
                applicationId: 'app-1',
                rowId: 'row-1',
                objectCollectionId: 'collection-1',
                relationKey: 'shared',
                active: true,
                principalType: 'user',
                principalId
            })
        ).resolves.toEqual({ relationKey: 'shared', active: true, changed: true })
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('passes optimistic version through runtime row updates', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1?workspaceId=workspace-1')
            return new Response(JSON.stringify({ id: 'row-1', title: 'Updated' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await updateAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1',
            data: { title: 'Updated' },
            expectedVersion: 4
        })

        const updateRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(fetchMock.mock.calls[1]?.[0]).toBe(
            'http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1?workspaceId=workspace-1'
        )
        expect(updateRequest.method).toBe('PATCH')
        expect(updateRequest.body).toBe(
            JSON.stringify({ data: { title: 'Updated' }, objectCollectionId: 'collection-1', expectedVersion: 4 })
        )
        expect(new Headers(updateRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('passes workspace scope through runtime row deletes', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe(
                'http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1?workspaceId=workspace-1&objectCollectionId=collection-1&expectedVersion=4'
            )
            return new Response(null, { status: 204 })
        })
        vi.stubGlobal('fetch', fetchMock)

        await deleteAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1',
            expectedVersion: 4
        })

        const deleteRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(deleteRequest.method).toBe('DELETE')
        expect(new Headers(deleteRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
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

    it('passes workspace scope through create, copy, and tabular row helpers', async () => {
        const seenUrls: string[] = []
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            seenUrls.push(url)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            if (url.includes('/tabular/')) {
                return new Response(JSON.stringify({ items: [], total: 0 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            return new Response(JSON.stringify({ id: 'row-created', status: 'created' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await createAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1',
            data: { Title: 'Created row' }
        })
        await copyAppRow({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            rowId: 'row-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1'
        })
        await fetchTabularRows({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            parentRecordId: 'row-1',
            componentId: 'component-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1'
        })

        const runtimeUrls = seenUrls.filter((url) => !url.endsWith('/auth/csrf')).map((url) => new URL(url))
        expect(runtimeUrls).toHaveLength(3)
        expect(runtimeUrls[0].pathname).toBe('/api/v1/applications/app-1/runtime/rows')
        expect(runtimeUrls[0].searchParams.get('workspaceId')).toBe('workspace-1')
        expect(runtimeUrls[1].pathname).toBe('/api/v1/applications/app-1/runtime/rows/row-1/copy')
        expect(runtimeUrls[1].searchParams.get('workspaceId')).toBe('workspace-1')
        expect(runtimeUrls[2].pathname).toBe('/api/v1/applications/app-1/runtime/rows/row-1/tabular/component-1')
        expect(runtimeUrls[2].searchParams.get('objectCollectionId')).toBe('collection-1')
        expect(runtimeUrls[2].searchParams.get('workspaceId')).toBe('workspace-1')
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
            action: 'complete'
        })

        const progressRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(progressRequest.method).toBe('POST')
        expect(progressRequest.body).toBe(
            JSON.stringify({
                targetObjectCodename: 'LearningResources',
                targetRecordId: '017f22e2-79b0-7cc3-98c4-dc0c0c073997',
                action: 'complete'
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

            expect(url).toBe('http://localhost:3000/api/v1/applications/app-1/runtime/rows/reorder?workspaceId=workspace-1')
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
            workspaceId: 'workspace-1',
            orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073997', '017f22e2-79b0-7cc3-98c4-dc0c0c073998'],
            expectedVersionsByRowId: {
                '017f22e2-79b0-7cc3-98c4-dc0c0c073997': 2,
                '017f22e2-79b0-7cc3-98c4-dc0c0c073998': 3
            }
        })

        const reorderRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(reorderRequest.method).toBe('POST')
        expect(reorderRequest.body).toBe(
            JSON.stringify({
                orderedRowIds: ['017f22e2-79b0-7cc3-98c4-dc0c0c073997', '017f22e2-79b0-7cc3-98c4-dc0c0c073998'],
                objectCollectionId: 'collection-1',
                expectedVersionsByRowId: {
                    '017f22e2-79b0-7cc3-98c4-dc0c0c073997': 2,
                    '017f22e2-79b0-7cc3-98c4-dc0c0c073998': 3
                }
            })
        )
        expect(new Headers(reorderRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('persists atomic tabular batch updates with workspace scope and CSRF protection', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.endsWith('/auth/csrf')) {
                return new Response(JSON.stringify({ csrfToken: 'csrf-token' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            expect(url).toBe(
                'http://localhost:3000/api/v1/applications/app-1/runtime/rows/row-1/tabular/component-1/batch?objectCollectionId=collection-1&workspaceId=workspace-1'
            )
            return new Response(JSON.stringify({ status: 'ok', updated: ['child-1', 'child-2'] }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        await batchUpdateTabularRows({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            parentRecordId: 'row-1',
            componentId: 'component-1',
            objectCollectionId: 'collection-1',
            workspaceId: 'workspace-1',
            updates: [
                { childRowId: 'child-1', data: { Title: 'First' } },
                { childRowId: 'child-2', data: { Title: 'Second' }, expectedVersion: 3 }
            ]
        })

        const batchRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(batchRequest.method).toBe('POST')
        expect(batchRequest.body).toBe(
            JSON.stringify({
                updates: [
                    { childRowId: 'child-1', data: { Title: 'First' } },
                    { childRowId: 'child-2', data: { Title: 'Second' }, expectedVersion: 3 }
                ]
            })
        )
        expect(new Headers(batchRequest.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })
})
