import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createInterpretationNetworkMatrixCell,
    createInterpretationNetworkMaterial,
    createInterpretationNetworkStructure,
    deleteInterpretationNetworkStructure,
    ensureInterpretationNetworkSystemStructure,
    fetchInterpretationNetworkTemplateDetail,
    fetchInterpretationNetworkTemplates,
    instantiateInterpretationNetworkTemplate,
    moveInterpretationNetworkMatrixCells,
    saveInterpretationNetworkTemplate
} from '../interpretationNetwork'
import { AppsApiError } from '../client'

const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    })

describe('interpretation network aggregate API helpers', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        window.sessionStorage.clear()
    })

    it('uses the application runtime route for system structure bootstrap', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/system-structure/ensure')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            return jsonResponse({
                structureId: '019f7f10-0000-7000-8000-000000000001',
                interpretationId: '019f7f10-0000-7000-8000-000000000002',
                rootCellId: '019f7f10-0000-7000-8000-000000000003',
                created: true,
                canCreate: false
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await ensureInterpretationNetworkSystemStructure({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            locale: 'ru'
        })

        expect(result.created).toBe(true)
        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(request.method).toBe('POST')
        expect(request.body).toBe(JSON.stringify({ locale: 'ru' }))
        expect(new Headers(request.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })

    it('lists templates through the runtime aggregate route', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/templates')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            return jsonResponse({
                items: [
                    {
                        id: '019f7f10-0000-7000-8000-000000000004',
                        name: 'Template',
                        description: null,
                        includesMaterials: false,
                        version: 1
                    }
                ]
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await fetchInterpretationNetworkTemplates({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1'
        })

        expect(result.items).toHaveLength(1)
        expect(fetchMock).toHaveBeenCalledWith(
            'http://localhost:3000/api/v1/applications/app-1/runtime/interpretation-network/templates?workspaceId=workspace-1',
            { credentials: 'include' }
        )
    })

    it('loads a safe template business summary without child-row data', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe(
                '/api/v1/applications/app-1/runtime/interpretation-network/templates/019f7f10-0000-7000-8000-000000000004'
            )
            return jsonResponse({
                id: '019f7f10-0000-7000-8000-000000000004',
                name: 'Template',
                description: 'Summary',
                includesMaterials: true,
                version: 1,
                matrix: { cellCount: 8, rootCount: 1, maxDepth: 3 },
                materialCount: 4
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await fetchInterpretationNetworkTemplateDetail({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            templateId: '019f7f10-0000-7000-8000-000000000004'
        })

        expect(result.matrix).toEqual({ cellCount: 8, rootCount: 1, maxDepth: 3 })
        expect(result.materialCount).toBe(4)
        expect(result).not.toHaveProperty('matrixRows')
    })

    it('saves and instantiates templates through the application runtime route', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/templates/019f7f10-0000-7000-8000-000000000006/instantiate')) {
                expect(url.pathname).toBe(
                    '/api/v1/applications/app-1/runtime/interpretation-network/templates/019f7f10-0000-7000-8000-000000000006/instantiate'
                )
                return jsonResponse({
                    structureId: '019f7f10-0000-7000-8000-000000000007',
                    interpretationId: '019f7f10-0000-7000-8000-000000000008'
                })
            }
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/templates')
            return jsonResponse(
                {
                    id: '019f7f10-0000-7000-8000-000000000006',
                    name: 'Reusable',
                    description: 'Description',
                    includesMaterials: true,
                    version: 2
                },
                201
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        await saveInterpretationNetworkTemplate({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            sourceStructureId: '019f7f10-0000-7000-8000-000000000005',
            templateName: 'Reusable',
            description: 'Description',
            includeMaterials: true,
            expectedVersion: 4,
            locale: 'en'
        })
        await instantiateInterpretationNetworkTemplate({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            templateId: '019f7f10-0000-7000-8000-000000000006',
            structureName: 'From template',
            description: 'Created from template',
            expectedVersion: 2,
            locale: 'en'
        })

        const saveRequest = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(JSON.parse(String(saveRequest.body))).toEqual({
            sourceStructureId: '019f7f10-0000-7000-8000-000000000005',
            templateName: 'Reusable',
            description: 'Description',
            includeMaterials: true,
            expectedVersion: 4,
            locale: 'en'
        })
        const instantiateRequest = fetchMock.mock.calls[2]?.[1] as RequestInit
        expect(JSON.parse(String(instantiateRequest.body))).toEqual({
            structureName: 'From template',
            description: 'Created from template',
            expectedVersion: 2,
            locale: 'en'
        })
    })

    it('creates a material through the interpretation network aggregate route', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/materials')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            return jsonResponse(
                {
                    id: '019f7f10-0000-7000-8000-000000000009',
                    matrixRowId: 'matrix-row-1'
                },
                201
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await createInterpretationNetworkMaterial({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            interpretationId: '019f7f10-0000-7000-8000-000000000012',
            matrixRowId: 'matrix-row-1',
            cellId: 'cell-1',
            data: { Title: 'Material title' },
            expectedVersion: 7
        })

        expect(result.id).toBe('019f7f10-0000-7000-8000-000000000009')
        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(request.method).toBe('POST')
        expect(new Headers(request.headers).get('X-CSRF-Token')).toBe('csrf-token')
        expect(JSON.parse(String(request.body))).toEqual({
            interpretationId: '019f7f10-0000-7000-8000-000000000012',
            matrixRowId: 'matrix-row-1',
            cellId: 'cell-1',
            data: { Title: 'Material title' },
            expectedVersion: 7
        })
    })

    it('creates and moves matrix cells through server-owned commands', async () => {
        const cellId = '019f7f10-0000-7000-8000-000000000020'
        const rowId = '019f7f10-0000-7000-8000-000000000021'
        const interpretationId = '019f7f10-0000-7000-8000-000000000022'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/matrix/cells/move')) return jsonResponse({ status: 'ok', updated: [rowId] })
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/matrix/cells')
            return jsonResponse({ id: rowId, status: 'created', item: { id: rowId, CellId: cellId } }, 201)
        })
        vi.stubGlobal('fetch', fetchMock)

        const created = await createInterpretationNetworkMatrixCell({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            interpretationId,
            data: { CellValue: 'Child' },
            placement: { parentCellId: cellId, sortOrder: 2 }
        })
        await moveInterpretationNetworkMatrixCells({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            interpretationId,
            updates: [{ matrixRowId: rowId, expectedVersion: 1, placement: { parentCellId: null, sortOrder: 0 } }]
        })

        expect(created.item.CellId).toBe(cellId)
        expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
            interpretationId,
            data: { CellValue: 'Child' },
            placement: { parentCellId: cellId, sortOrder: 2 }
        })
        expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
            interpretationId,
            updates: [{ matrixRowId: rowId, expectedVersion: 1, placement: { parentCellId: null, sortOrder: 0 } }]
        })
    })

    it('preserves the safe backend code for a rejected matrix command', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            return jsonResponse(
                {
                    error: 'Invalid Matrix cell payload',
                    code: 'INTERPRETATION_NETWORK_INVALID_CELL',
                    details: { field: 'ParentCellId' }
                },
                400
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const operation = createInterpretationNetworkMatrixCell({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            interpretationId: '019f7f10-0000-7000-8000-000000000022',
            data: { CellValue: 'Child' },
            placement: { parentCellId: '019f7f10-0000-7000-8000-000000000020' }
        })

        await expect(operation).rejects.toMatchObject<Partial<AppsApiError>>({
            name: 'AppsApiError',
            status: 400,
            code: 'INTERPRETATION_NETWORK_INVALID_CELL',
            message: 'Invalid Matrix cell payload',
            details: { field: 'ParentCellId' }
        })
    })

    it('creates a Structure aggregate through one atomic command', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/structures')
            expect(url.searchParams.get('widgetId')).toBe('interpretation-widget')
            expect(url.searchParams.get('layoutId')).toBe('layout-1')
            return jsonResponse(
                {
                    structureId: '019f7f10-0000-7000-8000-000000000030',
                    interpretationId: '019f7f10-0000-7000-8000-000000000031',
                    rootCellId: '019f7f10-0000-7000-8000-000000000032'
                },
                201
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        await createInterpretationNetworkStructure({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            widgetId: 'interpretation-widget',
            layoutId: 'layout-1',
            name: { locales: { en: { content: 'Structure' } } },
            description: { locales: { en: { content: 'Description' } } },
            locale: 'en'
        })

        expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
            name: { locales: { en: { content: 'Structure' } } },
            description: { locales: { en: { content: 'Description' } } },
            locale: 'en'
        })
    })

    it('deletes a whole structure through the aggregate route with only its business identity', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe(
                '/api/v1/applications/app-1/runtime/interpretation-network/structures/019f7f10-0000-7000-8000-000000000014'
            )
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            return new Response(null, { status: 204 })
        })
        vi.stubGlobal('fetch', fetchMock)

        await deleteInterpretationNetworkStructure({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            structureId: '019f7f10-0000-7000-8000-000000000014',
            expectedVersion: 5
        })

        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(request.method).toBe('DELETE')
        expect(JSON.parse(String(request.body))).toEqual({ expectedVersion: 5 })
    })
})
