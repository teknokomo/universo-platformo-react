const mockExec = { query: jest.fn(), transaction: jest.fn() }
const mockDbSession = { isReleased: () => false }
const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

jest.mock('../../domains/shared/routeAuth', () => ({
    __esModule: true,
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn(() => ({ sync: jest.fn() }))
}))

import type { Request, Response } from 'express'
import { MetahubDomainError } from '../../domains/shared/domainErrors'
import { createMetahubHandlerFactory } from '../../domains/shared/createMetahubHandler'

// ─── Helpers ───

function buildReqRes(): { req: Request; res: Response } {
    const req = {
        params: { metahubId: 'mh-1' },
        user: { id: 'user-1' }
    } as unknown as Request

    const jsonFn = jest.fn()
    const statusFn = jest.fn().mockReturnValue({ json: jsonFn })
    const res = { status: statusFn, json: jsonFn } as unknown as Response

    return { req, res }
}

// ─── Tests ───

describe('createMetahubHandler', () => {
    const createMetahubHandler = createMetahubHandlerFactory(() => mockExec as never)

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureMetahubAccess.mockResolvedValue({ userId: 'user-1', role: 'owner' })
    })

    it('calls the handler with metahub context', async () => {
        const handler = jest.fn(async (ctx) => {
            ctx.res.status(200).json({ ok: true })
        })
        const wrapped = createMetahubHandler(handler)
        const { req, res } = buildReqRes()

        await wrapped(req, res)

        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'mh-1',
                userId: 'user-1',
                exec: mockExec
            })
        )
    })

    it('calls ensureMetahubAccess with correct args', async () => {
        const handler = jest.fn()
        const wrapped = createMetahubHandler(handler, { permission: 'manageMetahub' })
        const { req, res } = buildReqRes()

        await wrapped(req, res)

        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'mh-1', 'manageMetahub', mockDbSession)
    })

    it('returns 401 when userId is missing', async () => {
        mockResolveUserId.mockReturnValue(undefined)
        const handler = jest.fn()
        const wrapped = createMetahubHandler(handler)
        const { req, res } = buildReqRes()

        await wrapped(req, res)

        expect(handler).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('catches MetahubDomainError and returns structured JSON', async () => {
        const handler = jest.fn(async () => {
            throw new MetahubDomainError({
                message: 'Catalog limit reached',
                statusCode: 422,
                code: 'LIMIT_REACHED',
                details: { limit: 50 }
            })
        })
        const wrapped = createMetahubHandler(handler)
        const { req, res } = buildReqRes()

        await wrapped(req, res)

        expect(res.status).toHaveBeenCalledWith(422)
        const jsonFn = (res.status as ReturnType<typeof jest.fn>).mock.results[0].value.json
        expect(jsonFn).toHaveBeenCalledWith({
            error: 'Catalog limit reached',
            code: 'LIMIT_REACHED',
            limit: 50
        })
    })

    it('catches MetahubDomainError without details', async () => {
        const handler = jest.fn(async () => {
            throw new MetahubDomainError({
                message: 'Not found',
                statusCode: 404,
                code: 'NOT_FOUND'
            })
        })
        const wrapped = createMetahubHandler(handler)
        const { req, res } = buildReqRes()

        await wrapped(req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        const jsonFn = (res.status as ReturnType<typeof jest.fn>).mock.results[0].value.json
        expect(jsonFn).toHaveBeenCalledWith({
            error: 'Not found',
            code: 'NOT_FOUND'
        })
    })

    it('re-throws non-domain errors', async () => {
        const handler = jest.fn(async () => {
            throw new Error('unexpected failure')
        })
        const wrapped = createMetahubHandler(handler)
        const { req, res } = buildReqRes()

        await expect(wrapped(req, res)).rejects.toThrow('unexpected failure')
    })

    it('supports custom metahubIdParam', async () => {
        const handler = jest.fn()
        const wrapped = createMetahubHandler(handler, { metahubIdParam: 'hubId' })
        const req = { params: { hubId: 'custom-hub' }, user: { id: 'user-1' } } as unknown as Request
        const jsonFn = jest.fn()
        const res = { status: jest.fn().mockReturnValue({ json: jsonFn }), json: jsonFn } as unknown as Response

        await wrapped(req, res)

        expect(handler).toHaveBeenCalledWith(expect.objectContaining({ metahubId: 'custom-hub' }))
    })
})
