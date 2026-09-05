import type { Request, Response } from 'express'

const mockEnsureApplicationAccess = jest.fn()
const mockGetRequestDbExecutor = jest.fn()
const mockNormalizeLocale = jest.fn((locale?: string) => locale ?? 'en')
const mockResolveUserId = jest.fn(() => 'user-1')
const mockApplicationLayoutTablesExist = jest.fn()
const mockGetApplicationRuntimeSchemaName = jest.fn()
const mockCopyApplicationLayout = jest.fn()
const mockListApplicationLayouts = jest.fn()
const mockListApplicationLayoutScopes = jest.fn()
const mockListApplicationLayoutWidgets = jest.fn()
const mockListApplicationLayoutWidgetObject = jest.fn()
const mockGetApplicationLayoutDetail = jest.fn()
const mockCreateApplicationLayout = jest.fn()
const mockDeleteApplicationLayout = jest.fn()
const mockDeleteApplicationLayoutWidget = jest.fn()
const mockResetApplicationLayoutConfig = jest.fn()
const mockUpdateApplicationLayoutWidgetConfigsBatch = jest.fn()
const mockResetApplicationLayoutWidgetConfigsBatch = jest.fn()
const mockToggleApplicationLayoutWidget = jest.fn()
const mockUpdateApplicationLayout = jest.fn()
const mockUpdateApplicationLayoutWidgetConfig = jest.fn()
const mockUpsertApplicationLayoutWidget = jest.fn()

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
    copyApplicationLayout: (...args: unknown[]) => mockCopyApplicationLayout(...args),
    createApplicationLayout: (...args: unknown[]) => mockCreateApplicationLayout(...args),
    deleteApplicationLayout: (...args: unknown[]) => mockDeleteApplicationLayout(...args),
    deleteApplicationLayoutWidget: (...args: unknown[]) => mockDeleteApplicationLayoutWidget(...args),
    getApplicationLayoutDetail: (...args: unknown[]) => mockGetApplicationLayoutDetail(...args),
    getApplicationRuntimeSchemaName: (...args: unknown[]) => mockGetApplicationRuntimeSchemaName(...args),
    listApplicationLayoutScopes: (...args: unknown[]) => mockListApplicationLayoutScopes(...args),
    listApplicationLayoutWidgetObject: (...args: unknown[]) => mockListApplicationLayoutWidgetObject(...args),
    listApplicationLayoutWidgets: (...args: unknown[]) => mockListApplicationLayoutWidgets(...args),
    listApplicationLayouts: (...args: unknown[]) => mockListApplicationLayouts(...args),
    moveApplicationLayoutWidget: jest.fn(),
    resetApplicationLayoutConfig: (...args: unknown[]) => mockResetApplicationLayoutConfig(...args),
    resetApplicationLayoutWidgetConfigsBatch: (...args: unknown[]) => mockResetApplicationLayoutWidgetConfigsBatch(...args),
    toggleApplicationLayoutWidget: (...args: unknown[]) => mockToggleApplicationLayoutWidget(...args),
    updateApplicationLayout: (...args: unknown[]) => mockUpdateApplicationLayout(...args),
    updateApplicationLayoutWidgetConfig: (...args: unknown[]) => mockUpdateApplicationLayoutWidgetConfig(...args),
    updateApplicationLayoutWidgetConfigsBatch: (...args: unknown[]) => mockUpdateApplicationLayoutWidgetConfigsBatch(...args),
    upsertApplicationLayoutWidget: (...args: unknown[]) => mockUpsertApplicationLayoutWidget(...args)
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

    it('maps a concurrent default unique conflict to the stable HTTP 409 shape', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const error = 'APPLICATION_LAYOUT_DEFAULT_CONFLICT'
        mockCreateApplicationLayout.mockRejectedValue(new Error(error))

        await controller.create(
            {
                params: { applicationId: 'app-1' },
                body: { name: { en: 'Main' }, templateKey: 'dashboard' }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error })
    })

    it('maps a stale layout update to HTTP 409 and preserves the route layout id', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = { expectedVersion: 3, name: { en: 'Updated' } }
        mockUpdateApplicationLayout.mockRejectedValue(new Error('APPLICATION_LAYOUT_VERSION_CONFLICT'))

        await controller.update(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-route' },
                body
            } as unknown as Request,
            res
        )

        expect(mockUpdateApplicationLayout).toHaveBeenCalledWith(executor, 'app_runtime_schema', 'layout-route', body, 'user-1')
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'APPLICATION_LAYOUT_VERSION_CONFLICT' })
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

    it('resets marketing appearance through the owner/admin application boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = { expectedVersion: 7 }
        const item = { id: '018f8a78-7b8f-7c1d-a111-2222333344a1', templateKey: 'marketing-page', version: 8 }
        mockResetApplicationLayoutConfig.mockResolvedValue(item)

        await controller.resetConfig(
            {
                params: { applicationId: 'app-1', layoutId: item.id },
                body
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockResetApplicationLayoutConfig).toHaveBeenCalledWith(executor, 'app_runtime_schema', item.id, body, 'user-1')
        expect(res.json).toHaveBeenCalledWith({ item })
    })

    it('rejects malformed marketing appearance reset payloads before the store boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        await controller.resetConfig(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                body: { expectedVersion: 0, unexpected: true }
            } as unknown as Request,
            res
        )

        expect(mockResetApplicationLayoutConfig).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_CONFIG_RESET_INVALID'
        })
    })

    it.each(['abc', '0', '-1', '1.5', '9007199254740992'])(
        'rejects malformed delete expectedVersion %s before the store boundary',
        async (expectedVersion) => {
            const controller = createApplicationLayoutsController(() => executor as never)
            const res = createResponse()

            await controller.remove(
                {
                    params: { applicationId: 'app-1', layoutId: 'layout-1' },
                    query: { expectedVersion }
                } as unknown as Request,
                res
            )

            expect(mockDeleteApplicationLayout).not.toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(400)
            expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
                error: 'APPLICATION_LAYOUT_EXPECTED_VERSION_INVALID'
            })
        }
    )

    it('passes a valid delete expectedVersion to the store', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        mockDeleteApplicationLayout.mockResolvedValue(true)

        await controller.remove(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                query: { expectedVersion: '7' }
            } as unknown as Request,
            res
        )

        expect(mockDeleteApplicationLayout).toHaveBeenCalledWith(executor, 'app_runtime_schema', 'layout-1', 'user-1', 7)
        expect(res.status).toHaveBeenCalledWith(204)
    })

    it('requires and forwards the source version for layout copies', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = { expectedVersion: 4 }
        const item = { id: 'copied-layout', version: 1 }
        mockCopyApplicationLayout.mockResolvedValue(item)

        await controller.copy(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                body
            } as unknown as Request,
            res
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockCopyApplicationLayout).toHaveBeenCalledWith(executor, 'app_runtime_schema', 'layout-1', body, 'user-1')
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ item })
    })

    it('rejects an unversioned or extra-field layout copy before the store boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        await controller.copy(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                body: { unexpected: true }
            } as unknown as Request,
            res
        )

        expect(mockCopyApplicationLayout).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'APPLICATION_LAYOUT_COPY_INVALID' })
    })

    it('maps a stale layout copy to HTTP 409', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        mockCopyApplicationLayout.mockRejectedValue(new Error('APPLICATION_LAYOUT_VERSION_CONFLICT'))

        await controller.copy(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                body: { expectedVersion: 7 }
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: 'APPLICATION_LAYOUT_VERSION_CONFLICT' })
    })

    it('maps a duplicate marketing instance key to HTTP 409 and preserves both route ids', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = {
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            expectedVersion: 3,
            config: {
                instanceKey: 'hero',
                source: { entityCodename: 'MarketingPageSiteSettings', entityKind: 'object' },
                showLeadForm: false
            }
        }
        mockUpsertApplicationLayoutWidget.mockRejectedValue(new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE'))

        await controller.upsertWidget(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-route' },
                body
            } as unknown as Request,
            res
        )

        expect(mockUpsertApplicationLayoutWidget).toHaveBeenCalledWith(executor, 'app_runtime_schema', 'layout-route', body, 'user-1')
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE'
        })
    })

    it('passes the route layout id to widget config updates', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = { expectedVersion: 3, config: { instanceKey: 'hero', source: { entityCodename: 'MarketingPageSiteSettings' } } }
        mockUpdateApplicationLayoutWidgetConfig.mockResolvedValue({ id: 'widget-1' })

        await controller.updateWidgetConfig(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-route', widgetId: 'widget-route' },
                body
            } as unknown as Request,
            res
        )

        expect(mockUpdateApplicationLayoutWidgetConfig).toHaveBeenCalledWith(
            executor,
            'app_runtime_schema',
            'layout-route',
            'widget-route',
            body,
            'user-1'
        )
        expect(res.json).toHaveBeenCalledWith({ item: { id: 'widget-1' } })
    })

    it('passes the route layout id to widget active-state updates', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = { isActive: false, expectedVersion: 4 }
        mockToggleApplicationLayoutWidget.mockResolvedValue({ id: 'widget-1', isActive: false })

        await controller.toggleWidget(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-route', widgetId: 'widget-route' },
                body
            } as unknown as Request,
            res
        )

        expect(mockToggleApplicationLayoutWidget).toHaveBeenCalledWith(
            executor,
            'app_runtime_schema',
            'layout-route',
            'widget-route',
            body,
            'user-1'
        )
        expect(res.json).toHaveBeenCalledWith({ item: { id: 'widget-1', isActive: false } })
    })

    it('passes the route layout id and expectedVersion to widget deletion', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        mockDeleteApplicationLayoutWidget.mockResolvedValue(true)

        await controller.removeWidget(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-route', widgetId: 'widget-route' },
                query: { expectedVersion: '5' }
            } as unknown as Request,
            res
        )

        expect(mockDeleteApplicationLayoutWidget).toHaveBeenCalledWith(
            executor,
            'app_runtime_schema',
            'layout-route',
            'widget-route',
            'user-1',
            5
        )
        expect(res.status).toHaveBeenCalledWith(204)
    })

    it('requires an optimistic version before entering the reset store boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        await controller.resetConfig(
            {
                params: { applicationId: 'app-1', layoutId: 'layout-1' },
                body: {}
            } as unknown as Request,
            res
        )

        expect(mockResetApplicationLayoutConfig).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_CONFIG_RESET_INVALID'
        })
    })

    it.each(['APPLICATION_LAYOUT_VERSION_CONFLICT', 'APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED'])(
        'maps marketing appearance reset conflict %s to HTTP 409',
        async (code) => {
            const controller = createApplicationLayoutsController(() => executor as never)
            const res = createResponse()
            mockResetApplicationLayoutConfig.mockRejectedValue(new Error(code))

            await controller.resetConfig(
                {
                    params: { applicationId: 'app-1', layoutId: 'layout-1' },
                    body: { expectedVersion: 7 }
                } as unknown as Request,
                res
            )

            expect(res.status).toHaveBeenCalledWith(409)
            expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({ error: code })
        }
    )

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

    it('resets inherited widget configs through the owner/admin application boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 7
                }
            ]
        }
        mockResetApplicationLayoutWidgetConfigsBatch.mockResolvedValue([{ id: body.updates[0].widgetId }])

        await controller.resetWidgetConfigsBatch({ params: { applicationId: 'app-1' }, body } as unknown as Request, res)

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', 'app-1', ['owner', 'admin'])
        expect(mockResetApplicationLayoutWidgetConfigsBatch).toHaveBeenCalledWith(executor, 'app_runtime_schema', body, 'user-1')
        expect(res.json).toHaveBeenCalledWith({ items: [{ id: body.updates[0].widgetId }] })
    })

    it('rejects malformed reset payloads before the store boundary', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()

        await controller.resetWidgetConfigsBatch(
            {
                params: { applicationId: 'app-1' },
                body: { updates: [{ layoutId: 'not-a-uuid', widgetId: 'not-a-uuid', unexpected: true }] }
            } as unknown as Request,
            res
        )

        expect(mockResetApplicationLayoutWidgetConfigsBatch).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_LAYOUT_WIDGET_RESET_BATCH_INVALID'
        })
    })

    it.each([
        'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT',
        'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST',
        'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
    ])('maps reset conflict %s to HTTP 409', async (code) => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 7
                }
            ]
        }
        mockResetApplicationLayoutWidgetConfigsBatch.mockRejectedValue(new Error(code))

        await controller.resetWidgetConfigsBatch({ params: { applicationId: 'app-1' }, body } as unknown as Request, res)

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith(
            code.startsWith('APPLICATION_INTERPRETATION_NETWORK_') ? { error: code, code } : { error: code }
        )
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

    it('maps an unsafe single-system transition to a stable HTTP 409 code', async () => {
        const controller = createApplicationLayoutsController(() => executor as never)
        const res = createResponse()
        const body = {
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    expectedVersion: 7,
                    config: { structureMode: 'singleSystem' }
                }
            ]
        }
        mockUpdateApplicationLayoutWidgetConfigsBatch.mockRejectedValue(
            new Error('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')
        )

        await controller.updateWidgetConfigsBatch(
            {
                params: { applicationId: 'app-1' },
                body
            } as unknown as Request,
            res
        )

        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.status.mock.results[0]?.value.json).toHaveBeenCalledWith({
            error: 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST',
            code: 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
        })
    })
})
