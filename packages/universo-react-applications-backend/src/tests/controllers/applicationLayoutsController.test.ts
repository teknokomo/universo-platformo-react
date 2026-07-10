import type { Request, Response } from 'express'

const mockEnsureApplicationAccess = jest.fn()
const mockGetRequestDbExecutor = jest.fn()
const mockNormalizeLocale = jest.fn((locale?: string) => locale ?? 'en')
const mockResolveUserId = jest.fn(() => 'user-1')
const mockApplicationLayoutTablesExist = jest.fn()
const mockGetApplicationRuntimeSchemaName = jest.fn()
const mockListApplicationLayouts = jest.fn()
const mockListApplicationLayoutScopes = jest.fn()
const mockListApplicationLayoutWidgets = jest.fn()
const mockListApplicationLayoutWidgetObject = jest.fn()
const mockGetApplicationLayoutDetail = jest.fn()
const mockCreateApplicationLayout = jest.fn()
const mockUpdateApplicationLayoutWidgetConfigsBatch = jest.fn()

jest.mock('../../routes/guards', () => ({
    __esModule: true,
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args)
}))

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (...args: unknown[]) => mockGetRequestDbExecutor(...args)
}))

jest.mock('../../shared/runtimeHelpers', () => ({
    __esModule: true,
    normalizeLocale: (...args: unknown[]) => mockNormalizeLocale(...args),
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../persistence/applicationLayoutsStore', () => ({
    __esModule: true,
    applicationLayoutTablesExist: (...args: unknown[]) => mockApplicationLayoutTablesExist(...args),
    copyApplicationLayout: jest.fn(),
    createApplicationLayout: (...args: unknown[]) => mockCreateApplicationLayout(...args),
    deleteApplicationLayout: jest.fn(),
    deleteApplicationLayoutWidget: jest.fn(),
    getApplicationLayoutDetail: (...args: unknown[]) => mockGetApplicationLayoutDetail(...args),
    getApplicationRuntimeSchemaName: (...args: unknown[]) => mockGetApplicationRuntimeSchemaName(...args),
    listApplicationLayoutScopes: (...args: unknown[]) => mockListApplicationLayoutScopes(...args),
    listApplicationLayoutWidgetObject: (...args: unknown[]) => mockListApplicationLayoutWidgetObject(...args),
    listApplicationLayoutWidgets: (...args: unknown[]) => mockListApplicationLayoutWidgets(...args),
    listApplicationLayouts: (...args: unknown[]) => mockListApplicationLayouts(...args),
    moveApplicationLayoutWidget: jest.fn(),
    toggleApplicationLayoutWidget: jest.fn(),
    updateApplicationLayout: jest.fn(),
    updateApplicationLayoutWidgetConfig: jest.fn(),
    updateApplicationLayoutWidgetConfigsBatch: (...args: unknown[]) => mockUpdateApplicationLayoutWidgetConfigsBatch(...args),
    upsertApplicationLayoutWidget: jest.fn()
}))

import { createApplicationLayoutsController } from '../../controllers/applicationLayoutsController'

function createResponse() {
    const json = jest.fn()
    const send = jest.fn()
    const status = jest.fn().mockReturnValue({ json, send })

    return {
        status,
        json,
        send
    } as unknown as Response & { status: jest.Mock; json: jest.Mock; send: jest.Mock }
}

describe('applicationLayoutsController', () => {
    const executor = {
        query: jest.fn(),
        transaction: jest.fn(),
        isReleased: jest.fn(() => false)
    }

    beforeEach(() => {
        jest.clearAllMocks()
        executor.query.mockReset()
        executor.transaction.mockReset()
        executor.isReleased.mockReset()
        executor.isReleased.mockReturnValue(false)
        mockGetRequestDbExecutor.mockReturnValue(executor)
        mockGetApplicationRuntimeSchemaName.mockResolvedValue('app_runtime_schema')
        mockApplicationLayoutTablesExist.mockResolvedValue(true)
        mockEnsureApplicationAccess.mockResolvedValue({
            applicationId: 'app-1',
            membership: { role: 'editor' }
        })
    })

    it('allows editor reads when application settings explicitly permit layout reads', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        executor.query.mockResolvedValueOnce([
            {
                settings: {
                    applicationLayouts: {
                        readRoles: ['editor']
                    }
                }
            }
        ])
        mockListApplicationLayouts.mockResolvedValue({ items: [], total: 0 })

        await controller.list(
            {
                params: { applicationId: 'app-1' },
                query: {}
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin', 'editor'])
        expect(res.json).toHaveBeenCalledWith({ items: [], total: 0 })
    })

    it('keeps create mutations restricted to owner/admin even when read policy includes editor', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        executor.query.mockResolvedValueOnce([
            {
                settings: {
                    applicationLayouts: {
                        readRoles: ['editor', 'member']
                    }
                }
            }
        ])
        mockCreateApplicationLayout.mockResolvedValue({ id: 'layout-1' })

        await controller.create(
            {
                params: { applicationId: 'app-1' },
                body: { name: { en: 'Main' }, templateKey: 'dashboard' }
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(res.status).toHaveBeenCalledWith(201)
    })

    it('falls back to admin-only read access when no explicit layout-read policy exists', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        executor.query.mockResolvedValueOnce([{ settings: null }])
        mockListApplicationLayoutScopes.mockResolvedValue([{ id: 'global', scopeKind: 'global', objectCollectionId: null, name: 'Global' }])

        await controller.listScopes(
            {
                params: { applicationId: 'app-1' },
                query: { locale: 'ru' }
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockNormalizeLocale).toHaveBeenCalledWith('ru')
        expect(res.json).toHaveBeenCalledWith({
            items: [{ id: 'global', scopeKind: 'global', objectCollectionId: null, name: 'Global' }]
        })
    })

    it('maps atomic widget config batch conflicts to HTTP 409 for owner/admin writes', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 7,
                    config: { matrixMode: 'hierarchicalCells' }
                }
            ]
        }
        mockUpdateApplicationLayoutWidgetConfigsBatch.mockRejectedValue(new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'))

        await controller.updateWidgetConfigsBatch(
            {
                params: { applicationId: 'app-1' },
                body
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockUpdateApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith(executor, 'app_runtime_schema', body, 'user-1')
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'
        })
    })

    it('maps malformed widget config batch payloads to HTTP 400 without calling the store', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        await controller.updateWidgetConfigsBatch(
            {
                params: { applicationId: 'app-1' },
                body: {
                    updates: [
                        {
                            layoutId: 'not-a-uuid',
                            widgetId: 'not-a-uuid',
                            config: { matrixMode: 'hierarchicalCells' }
                        }
                    ]
                }
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockUpdateApplicationLayoutWidgetConfigsBatch).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_WIDGET_BATCH_INVALID'
        })
    })
})
