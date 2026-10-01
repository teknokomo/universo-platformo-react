import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { createMarketingWidgetRecordDuplicateController } from '../../domains/layouts/controllers/marketingWidgetRecordDuplicateController'

const mockEnsureMetahubAccess = jest.fn()
const mockDuplicateMarketingWidgetRecordAndPlace = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/layouts/services/marketingWidgetRecordDuplicate', () => {
    const actual = jest.requireActual('../../domains/layouts/services/marketingWidgetRecordDuplicate')
    return {
        ...actual,
        duplicateMarketingWidgetRecordAndPlace: (...args: unknown[]) => mockDuplicateMarketingWidgetRecordAndPlace(...args)
    }
})

type DuplicateHandlerContext = {
    req: { params: Record<string, string>; body: unknown }
    res: { status: (code: number) => { json: (body: unknown) => unknown } }
    metahubId: string
    userId: string
    exec: unknown
    schemaService: unknown
}

type DuplicateHandler = (context: DuplicateHandlerContext) => Promise<unknown>

const metahubId = 'metahub-1'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const entityId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const userId = 'user-1'

const requestBody = () => ({
    zone: 'marketing-main',
    widgetKey: 'marketing.image',
    config: {},
    expectedVersion: 4,
    recordCopy: {
        entityId,
        recordId,
        sourceKey: 'MarketingPageImage',
        sourceSemanticKey: 'image-campaign',
        slot: 'content'
    }
})

const createHarness = () => {
    let handler: DuplicateHandler | undefined
    let handlerOptions: unknown
    const createHandler = (callback: DuplicateHandler, options?: unknown) => {
        handler = callback
        handlerOptions = options
        return callback
    }
    const controller = createMarketingWidgetRecordDuplicateController(createHandler as never)
    const exec = { query: jest.fn(), transaction: jest.fn(), isReleased: () => false }
    const responseBody = jest.fn()
    const status = jest.fn(() => ({ json: responseBody }))

    return {
        handlerOptions,
        exec,
        responseBody,
        status,
        invoke: (body: unknown = requestBody()) =>
            (handler ?? (controller.duplicateZoneWidget as unknown as DuplicateHandler))({
                req: { params: { layoutId }, body },
                res: { status, json: responseBody } as never,
                metahubId,
                userId,
                exec,
                schemaService: {}
            })
    }
}

describe('Marketing widget record duplicate controller', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockDuplicateMarketingWidgetRecordAndPlace.mockResolvedValue({
            id: '0190a9b5-3cde-7abc-8def-0123456789a4',
            layoutId,
            zone: 'marketing-main',
            widgetKey: 'marketing.image',
            version: 1
        })
    })

    it('requires manageMetahub and editContent and returns the normal placement DTO', async () => {
        const harness = createHarness()
        await harness.invoke()

        expect(harness.handlerOptions).toEqual({ permission: 'manageMetahub' })
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(harness.exec, userId, metahubId, 'editContent')
        expect(mockDuplicateMarketingWidgetRecordAndPlace).toHaveBeenCalledWith({
            executor: harness.exec,
            metahubId,
            layoutId,
            userId,
            request: requestBody()
        })
        expect(harness.status).toHaveBeenCalledWith(201)
        expect(harness.responseBody).toHaveBeenCalledWith(
            expect.objectContaining({ id: '0190a9b5-3cde-7abc-8def-0123456789a4', layoutId, widgetKey: 'marketing.image' })
        )
    })

    it('rejects unknown body fields before content authorization or mutation', async () => {
        const harness = createHarness()
        await harness.invoke({ ...requestBody(), unexpected: true })

        expect(harness.status).toHaveBeenCalledWith(400)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        expect(mockDuplicateMarketingWidgetRecordAndPlace).not.toHaveBeenCalled()
    })
})
