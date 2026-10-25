import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createInterpretationNetworkMatrixCell,
    createInterpretationNetworkMaterial,
    createInterpretationNetworkStructure,
    applyInterpretationNetworkTemplateToCell,
    deleteInterpretationNetworkMatrixCell,
    deleteInterpretationNetworkMaterial,
    deleteInterpretationNetworkStructure,
    ensureInterpretationNetworkSystemStructure,
    fetchInterpretationNetworkTemplateDetail,
    fetchInterpretationNetworkMaterialAssociations,
    fetchInterpretationNetworkTemplates,
    instantiateInterpretationNetworkTemplate,
    moveInterpretationNetworkMatrixCells,
    saveInterpretationNetworkTemplate,
    setInterpretationNetworkPrimaryMaterial,
    updateInterpretationNetworkMaterial,
    updateInterpretationNetworkMatrixCell
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

    it('loads and validates all pages of safe material association pairs', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/material-associations')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(url.searchParams.get('interpretationId')).toBe('019f7f10-0000-7000-8000-000000000021')
            if (url.searchParams.get('offset') === '0') {
                return jsonResponse({
                    items: [{ cellId: '019f7f10-0000-7000-8000-000000000022', materialId: '019f7f10-0000-7000-8000-000000000023' }],
                    page: { offset: 0, limit: 250, hasMore: true }
                })
            }
            expect(url.searchParams.get('offset')).toBe('250')
            return jsonResponse({
                items: [{ cellId: '019f7f10-0000-7000-8000-000000000024', materialId: '019f7f10-0000-7000-8000-000000000025' }],
                page: { offset: 250, limit: 250, hasMore: false }
            })
        })
        vi.stubGlobal('fetch', fetchMock)

        const associations = await fetchInterpretationNetworkMaterialAssociations({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            interpretationId: '019f7f10-0000-7000-8000-000000000021'
        })

        expect(associations).toEqual([
            { cellId: '019f7f10-0000-7000-8000-000000000022', materialId: '019f7f10-0000-7000-8000-000000000023' },
            { cellId: '019f7f10-0000-7000-8000-000000000024', materialId: '019f7f10-0000-7000-8000-000000000025' }
        ])
        expect(fetchMock).toHaveBeenCalledTimes(2)
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
            scope: { kind: 'wholeStructure' },
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
            scope: { kind: 'wholeStructure' },
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

    it('sends a UUID v7 root selector when saving a selected branch', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            return jsonResponse(
                {
                    id: '019f7f10-0000-7000-8000-000000000006',
                    name: 'Branch',
                    description: null,
                    includesMaterials: false,
                    version: 1
                },
                201
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        await saveInterpretationNetworkTemplate({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            sourceStructureId: '019f7f10-0000-7000-8000-000000000005',
            templateName: 'Branch',
            includeMaterials: false,
            scope: { kind: 'selectedBranch', rootCellId: '019f7f10-0000-7000-8000-000000000009' }
        })

        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(JSON.parse(String(request.body))).toMatchObject({
            scope: { kind: 'selectedBranch', rootCellId: '019f7f10-0000-7000-8000-000000000009' }
        })
    })

    it('creates a material through the interpretation network aggregate route', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe('/api/v1/applications/app-1/runtime/interpretation-network/materials')
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(url.searchParams.get('widgetId')).toBe('widget-1')
            expect(url.searchParams.get('layoutId')).toBe('layout-1')
            return jsonResponse(
                {
                    id: '019f7f10-0000-7000-8000-000000000009',
                    matrixRowId: '019f7f10-0000-7000-8000-000000000013'
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
            cellId: 'cell-1',
            data: { Title: 'Material title' },
            expectedCellVersion: 7,
            widgetId: 'widget-1',
            layoutId: 'layout-1'
        })

        expect(result.id).toBe('019f7f10-0000-7000-8000-000000000009')
        expect(result.matrixRowId).toBe('019f7f10-0000-7000-8000-000000000013')
        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(request.method).toBe('POST')
        expect(new Headers(request.headers).get('X-CSRF-Token')).toBe('csrf-token')
        expect(JSON.parse(String(request.body))).toEqual({
            interpretationId: '019f7f10-0000-7000-8000-000000000012',
            cellId: 'cell-1',
            data: { Title: 'Material title' },
            expectedCellVersion: 7
        })
    })

    it('updates, sets and clears Primary Material, and deletes with scoped aggregate requests', async () => {
        const materialId = '019f7f10-0000-7000-8000-000000000031'
        const interpretationId = '019f7f10-0000-7000-8000-000000000032'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(url.searchParams.get('widgetId')).toBe('widget-1')
            expect(url.searchParams.get('layoutId')).toBe('layout-1')
            if (url.pathname.endsWith(`/materials/${materialId}`) && init?.method === 'PATCH') {
                return jsonResponse({ id: materialId, version: 6 })
            }
            if (url.pathname.endsWith('/materials/primary') && init?.method === 'PUT') {
                const body = JSON.parse(String(init.body)) as { materialId: string | null }
                return jsonResponse({ primaryMaterialId: body.materialId, cellVersion: 8 })
            }
            if (url.pathname.endsWith(`/materials/${materialId}`) && init?.method === 'DELETE') return new Response(null, { status: 204 })
            throw new Error(`Unexpected request: ${init?.method} ${url.pathname}`)
        })
        vi.stubGlobal('fetch', fetchMock)
        const scope = {
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            widgetId: 'widget-1',
            layoutId: 'layout-1',
            interpretationId,
            cellId: 'cell-1'
        }

        const updated = await updateInterpretationNetworkMaterial({
            ...scope,
            materialId,
            data: { Description: 'Updated' },
            expectedCellVersion: 7,
            expectedMaterialVersion: 5
        })
        expect(updated).toEqual({ id: materialId, version: 6 })
        expect(JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')?.[1]?.body ?? '{}'))).toEqual({
            interpretationId,
            cellId: 'cell-1',
            data: { Description: 'Updated' },
            expectedCellVersion: 7,
            expectedMaterialVersion: 5
        })

        expect(await setInterpretationNetworkPrimaryMaterial({ ...scope, materialId, expectedCellVersion: 7 })).toEqual({
            primaryMaterialId: materialId,
            cellVersion: 8
        })
        expect(await setInterpretationNetworkPrimaryMaterial({ ...scope, materialId: null, expectedCellVersion: 8 })).toEqual({
            primaryMaterialId: null,
            cellVersion: 8
        })
        await deleteInterpretationNetworkMaterial({
            ...scope,
            materialId,
            expectedCellVersion: 8,
            expectedMaterialVersion: 6
        })

        const primaryBodies = fetchMock.mock.calls
            .filter(([, init]) => init?.method === 'PUT')
            .map(([, init]) => JSON.parse(String(init?.body ?? '{}')))
        expect(primaryBodies).toEqual([
            { interpretationId, cellId: 'cell-1', materialId, expectedCellVersion: 7 },
            { interpretationId, cellId: 'cell-1', materialId: null, expectedCellVersion: 8 }
        ])
        const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
        expect(JSON.parse(String(deleteCall?.[1]?.body ?? '{}'))).toEqual({
            interpretationId,
            cellId: 'cell-1',
            expectedCellVersion: 8,
            expectedMaterialVersion: 6
        })
        for (const [input, init] of fetchMock.mock.calls) {
            if (!init?.method) continue
            const url = new URL(String(input))
            expect(url.pathname).not.toContain('matrix-row')
        }
    })

    it('creates and moves matrix cells through server-owned commands', async () => {
        const cellId = '019f7f10-0000-7000-8000-000000000020'
        const rowId = '019f7f10-0000-7000-8000-000000000021'
        const interpretationId = '019f7f10-0000-7000-8000-000000000022'
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            if (url.pathname.endsWith('/matrix/cells/move')) return jsonResponse({ status: 'ok', updated: [cellId] })
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
            updates: [{ cellId, expectedVersion: 1, placement: { parentCellId: null, sortOrder: 0 } }]
        })

        expect(created.item.CellId).toBe(cellId)
        expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
            interpretationId,
            data: { CellValue: 'Child' },
            placement: { parentCellId: cellId, sortOrder: 2 }
        })
        expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual({
            interpretationId,
            updates: [{ cellId, expectedVersion: 1, placement: { parentCellId: null, sortOrder: 0 } }]
        })
    })

    it('updates and deletes matrix cells through scoped CellId commands', async () => {
        const cellId = '019f7f10-0000-7000-8000-000000000023'
        const interpretationId = '019f7f10-0000-7000-8000-000000000024'
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(url.searchParams.get('widgetId')).toBe('widget-1')
            expect(url.searchParams.get('layoutId')).toBe('layout-1')
            if (url.pathname.endsWith(`/matrix/cells/${cellId}`) && init?.method === 'PATCH') {
                return jsonResponse({ cellId, version: 5 })
            }
            if (url.pathname.endsWith(`/matrix/cells/${cellId}`) && init?.method === 'DELETE') return new Response(null, { status: 204 })
            throw new Error(`Unexpected request: ${init?.method} ${url.pathname}`)
        })
        vi.stubGlobal('fetch', fetchMock)
        const scope = {
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            widgetId: 'widget-1',
            layoutId: 'layout-1',
            interpretationId
        }

        await expect(
            updateInterpretationNetworkMatrixCell({
                ...scope,
                cellId,
                expectedCellVersion: 4,
                data: { CellValue: 'Updated' }
            })
        ).resolves.toEqual({ cellId, version: 5 })
        await deleteInterpretationNetworkMatrixCell({ ...scope, cellId, expectedCellVersion: 5 })

        const updateCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
        expect(JSON.parse(String(updateCall?.[1]?.body ?? '{}'))).toEqual({
            interpretationId,
            data: { CellValue: 'Updated' },
            expectedCellVersion: 4
        })
        const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE')
        expect(JSON.parse(String(deleteCall?.[1]?.body ?? '{}'))).toEqual({ interpretationId, expectedCellVersion: 5 })
        for (const [input, init] of fetchMock.mock.calls) {
            if (!init?.method) continue
            expect(JSON.stringify(init.body ?? '')).not.toContain('matrixRowId')
            expect(new URL(String(input)).pathname).not.toMatch(/tabular|material/)
        }
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

    it('applies a saved template to a selected cell with expected versions and runtime scope', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = new URL(String(input))
            if (url.pathname === '/api/v1/auth/csrf') return jsonResponse({ csrfToken: 'csrf-token' })
            expect(url.pathname).toBe(
                '/api/v1/applications/app-1/runtime/interpretation-network/templates/019f7f10-0000-7000-8000-000000000006/apply'
            )
            expect(url.searchParams.get('workspaceId')).toBe('workspace-1')
            expect(url.searchParams.get('widgetId')).toBe('019f7f10-0000-7000-8000-000000000010')
            expect(url.searchParams.get('layoutId')).toBe('019f7f10-0000-7000-8000-000000000011')
            return jsonResponse(
                {
                    templateId: '019f7f10-0000-7000-8000-000000000006',
                    templateVersion: 2,
                    interpretationId: '019f7f10-0000-7000-8000-000000000008',
                    targetCellId: '019f7f10-0000-7000-8000-000000000012',
                    targetCellVersion: 3,
                    insertedRootCellId: '019f7f10-0000-7000-8000-000000000013',
                    insertedCellCount: 4,
                    insertedMaterialCount: 2
                },
                201
            )
        })
        vi.stubGlobal('fetch', fetchMock)

        const result = await applyInterpretationNetworkTemplateToCell({
            apiBaseUrl: '/api/v1',
            applicationId: 'app-1',
            workspaceId: 'workspace-1',
            templateId: '019f7f10-0000-7000-8000-000000000006',
            interpretationId: '019f7f10-0000-7000-8000-000000000008',
            targetCellId: '019f7f10-0000-7000-8000-000000000012',
            expectedTemplateVersion: 2,
            expectedTargetVersion: 3,
            widgetId: '019f7f10-0000-7000-8000-000000000010',
            layoutId: '019f7f10-0000-7000-8000-000000000011'
        })

        expect(result.insertedCellCount).toBe(4)
        expect(result.insertedMaterialCount).toBe(2)
        const request = fetchMock.mock.calls[1]?.[1] as RequestInit
        expect(request.method).toBe('POST')
        expect(JSON.parse(String(request.body))).toEqual({
            interpretationId: '019f7f10-0000-7000-8000-000000000008',
            targetCellId: '019f7f10-0000-7000-8000-000000000012',
            expectedTemplateVersion: 2,
            expectedTargetVersion: 3
        })
        expect(new Headers(request.headers).get('X-CSRF-Token')).toBe('csrf-token')
    })
})
