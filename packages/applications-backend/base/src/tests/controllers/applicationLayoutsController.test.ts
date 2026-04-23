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
const mockListApplicationLayoutWidgetCatalog = jest.fn()
const mockGetApplicationLayoutDetail = jest.fn()
const mockCreateApplicationLayout = jest.fn()

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
    listApplicationLayoutWidgetCatalog: (...args: unknown[]) => mockListApplicationLayoutWidgetCatalog(...args),
    listApplicationLayoutWidgets: (...args: unknown[]) => mockListApplicationLayoutWidgets(...args),
    listApplicationLayouts: (...args: unknown[]) => mockListApplicationLayouts(...args),
    moveApplicationLayoutWidget: jest.fn(),
    toggleApplicationLayoutWidget: jest.fn(),
    updateApplicationLayout: jest.fn(),
    updateApplicationLayoutWidgetConfig: jest.fn(),
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
        mockListApplicationLayoutScopes.mockResolvedValue([{ id: 'global', scopeKind: 'global', linkedCollectionId: null, name: 'Global' }])

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
            items: [{ id: 'global', scopeKind: 'global', linkedCollectionId: null, name: 'Global' }]
        })
    })
})
