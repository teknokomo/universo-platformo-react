import type { Request, Response } from 'express'
import { EffectiveLayoutError } from '../../services/effectiveLayoutContract'

const mockEnsureApplicationAccess = jest.fn()
const mockResolveEffectiveLayout = jest.fn()

jest.mock('../../routes/guards', () => ({
    __esModule: true,
    ensureApplicationAccess: (...args: unknown[]) => mockEnsureApplicationAccess(...args)
}))

jest.mock('../../services/effectiveLayoutResolver', () => ({
    __esModule: true,
    resolveEffectiveLayoutForRequest: (...args: unknown[]) => mockResolveEffectiveLayout(...args)
}))

import { createEffectiveLayoutController } from '../../controllers/effectiveLayoutController'

const applicationId = '018f8a78-7b8f-7c1d-a111-222233334444'
const entityId = '0190a9b5-3cde-7abc-8def-0123456789ad'
const executor = {
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
}

const createResponse = () => {
    const json = jest.fn()
    const response = {
        status: jest.fn().mockReturnThis(),
        json
    }
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const createRequest = (query: Record<string, unknown> = {}, withContext = true) => {
    const request = {
        params: { applicationId },
        query,
        user: { id: 'user-1' }
    } as unknown as Request & { dbContext?: unknown }
    if (withContext) {
        request.dbContext = {
            executor,
            isReleased: () => false
        }
    }
    return request
}

beforeEach(() => {
    jest.clearAllMocks()
    mockEnsureApplicationAccess.mockResolvedValue({
        applicationId,
        membership: { role: 'member' }
    })
    mockResolveEffectiveLayout.mockResolvedValue({ status: 'ok', effectiveHash: 'hash' })
})

describe('effectiveLayoutController', () => {
    it('rejects a request without the RLS request context before application lookup', async () => {
        const controller = createEffectiveLayoutController()
        const response = createResponse()

        await controller.getEffectiveLayout(createRequest({}, false), response)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.json).toHaveBeenCalledWith({ status: 'failed', error: { code: 'UNAUTHORIZED', httpStatus: 401 } })
        expect(mockEnsureApplicationAccess).not.toHaveBeenCalled()
        expect(mockResolveEffectiveLayout).not.toHaveBeenCalled()
    })

    it('passes the request executor and normalized authenticated target to the resolver', async () => {
        const controller = createEffectiveLayoutController()
        const response = createResponse()

        await controller.getEffectiveLayout(
            createRequest({ targetKind: 'object', entityTypeId: entityId, locale: 'ru', themeVariant: 'dark' }),
            response
        )

        expect(mockEnsureApplicationAccess).toHaveBeenCalledWith(executor, 'user-1', applicationId)
        expect(mockResolveEffectiveLayout).toHaveBeenCalledWith(
            executor,
            { applicationId, userId: 'user-1', role: 'member' },
            { applicationId, targetKind: 'object', entityTypeId: entityId, locale: 'ru', themeVariant: 'dark' }
        )
        expect(response.json).toHaveBeenCalledWith({ status: 'ok', effectiveHash: 'hash' })
    })

    it('rejects recordKey and other targetless compatibility parameters', async () => {
        const controller = createEffectiveLayoutController()
        const response = createResponse()

        await controller.getEffectiveLayout(createRequest({ recordKey: 'content-only' }), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({
            status: 'failed',
            error: { code: 'LAYOUT_REQUEST_INVALID', httpStatus: 400 }
        })
        expect(mockEnsureApplicationAccess).not.toHaveBeenCalled()
    })

    it('maps guard denial to the stable target-forbidden contract', async () => {
        mockEnsureApplicationAccess.mockRejectedValue(Object.assign(new Error('denied'), { status: 403 }))
        const controller = createEffectiveLayoutController()
        const response = createResponse()

        await controller.getEffectiveLayout(createRequest(), response)

        expect(response.status).toHaveBeenCalledWith(403)
        expect(response.json).toHaveBeenCalledWith({
            status: 'failed',
            error: { code: 'LAYOUT_TARGET_FORBIDDEN', httpStatus: 403 }
        })
    })

    it('serializes typed resolver failures without exposing parser or SQL details', async () => {
        mockResolveEffectiveLayout.mockRejectedValue(new EffectiveLayoutError('LAYOUT_PERSISTED_INVALID'))
        const controller = createEffectiveLayoutController()
        const response = createResponse()

        await controller.getEffectiveLayout(createRequest(), response)

        expect(response.status).toHaveBeenCalledWith(409)
        expect(response.json).toHaveBeenCalledWith({
            status: 'failed',
            error: { code: 'LAYOUT_PERSISTED_INVALID', httpStatus: 409 }
        })
    })
})
