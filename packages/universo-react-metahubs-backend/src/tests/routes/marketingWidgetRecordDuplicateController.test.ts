import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, getLayoutWidgetDefinition } from '@universo-react/types'

const mockEnsureMetahubAccess = jest.fn()
const mockDuplicateMarketingWidgetRecordAndPlace = jest.fn()

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/layouts/services/marketingWidgetRecordDuplicate', () => {
    const actual = jest.requireActual('../../domains/layouts/services/marketingWidgetRecordDuplicate') as Record<string, unknown>
    return {
        ...actual,
        duplicateMarketingWidgetRecordAndPlace: (...args: unknown[]) => mockDuplicateMarketingWidgetRecordAndPlace(...args)
    }
})

import { createMarketingWidgetRecordDuplicateController } from '../../domains/layouts/controllers/marketingWidgetRecordDuplicateController'

const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const entityId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const userId = '0190a9b5-3cde-7abc-8def-0123456789a4'
const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a5'
const sourceSemanticKey = 'image-card'

const createRequest = () => {
    const definition = getLayoutWidgetDefinition('marketing.image')
    if (!definition) throw new Error('marketing.image must be registered')
    const bindings = buildSingleTargetWidgetBinding(definition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageImage',
        semanticKey: sourceSemanticKey
    })
    return {
        zone: 'marketing-main',
        widgetKey: 'marketing.image',
        config: encodeWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: '0190a9b5-3cde-7abc-8def-0123456789b1' }, neutral: { bindings } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.image', zone: 'marketing-main' }
        ),
        expectedVersion: 4,
        recordCopy: {
            entityId,
            recordId,
            sourceKey: 'MarketingPageImage',
            sourceSemanticKey,
            slot: 'content'
        }
    }
}

const createInvocation = (body: unknown) => {
    let status = 200
    let responseBody: unknown
    const res = {
        status: jest.fn((nextStatus: number) => {
            status = nextStatus
            return res
        }),
        json: jest.fn((nextBody: unknown) => {
            responseBody = nextBody
            return res
        })
    }
    const context = {
        req: { params: { layoutId }, body },
        res,
        metahubId,
        userId,
        exec: { query: jest.fn() },
        schemaService: {}
    }
    let handler: ((value: typeof context) => Promise<unknown>) | undefined
    let permission: unknown
    const createHandler = (nextHandler: typeof handler, options?: { permission?: string }) => {
        handler = nextHandler
        permission = options?.permission
        return nextHandler
    }
    createMarketingWidgetRecordDuplicateController(createHandler as never)
    return {
        invoke: () => {
            if (!handler) throw new Error('The duplicate controller handler was not registered')
            return handler(context)
        },
        getStatus: () => status,
        getBody: () => responseBody,
        permission,
        res
    }
}

describe('Marketing widget record duplicate controller', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureMetahubAccess.mockResolvedValue({ metahubId })
        mockDuplicateMarketingWidgetRecordAndPlace.mockResolvedValue({ id: '0190a9b5-3cde-7abc-8def-0123456789b2' })
    })

    it('requires layout management and content edit permission before invoking the transactional service', async () => {
        const request = createRequest()
        const call = createInvocation(request)

        await call.invoke()

        expect(call.permission).toBe('manageMetahub')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(expect.anything(), userId, metahubId, 'editContent')
        expect(mockDuplicateMarketingWidgetRecordAndPlace).toHaveBeenCalledWith({
            executor: expect.anything(),
            metahubId,
            layoutId,
            userId,
            request
        })
        expect(call.getStatus()).toBe(201)
        expect(call.getBody()).toEqual({ id: '0190a9b5-3cde-7abc-8def-0123456789b2' })
    })

    it('fails before copying when the caller lacks content edit permission', async () => {
        const forbidden = Object.assign(new Error('Access denied'), { statusCode: 403 })
        mockEnsureMetahubAccess.mockRejectedValueOnce(forbidden)
        const call = createInvocation(createRequest())

        await expect(call.invoke()).rejects.toBe(forbidden)

        expect(mockDuplicateMarketingWidgetRecordAndPlace).not.toHaveBeenCalled()
    })

    it('rejects non-v7 source identities before the content permission check or mutation', async () => {
        const request = createRequest()
        request.recordCopy.recordId = '00000000-0000-4000-8000-000000000001'
        const call = createInvocation(request)

        await call.invoke()

        expect(call.getStatus()).toBe(400)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalled()
        expect(mockDuplicateMarketingWidgetRecordAndPlace).not.toHaveBeenCalled()
    })
})
