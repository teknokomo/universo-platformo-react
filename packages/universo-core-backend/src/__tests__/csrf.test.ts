import { createCsrfProtection } from '../middlewares/csrf'
import type { Request, Response } from 'express'

function createMockRequest(overrides: Partial<Request> = {}): Request {
    const session: Record<string, unknown> = {}
    return {
        method: 'GET',
        headers: {},
        body: {},
        query: {},
        session,
        get(name: string) {
            const val = (this as unknown as Request).headers[name.toLowerCase()]
            return Array.isArray(val) ? val[0] : val
        },
        ...overrides
    } as unknown as Request
}

function createMockResponse(): Response {
    return {} as Response
}

describe('createCsrfProtection', () => {
    const middleware = createCsrfProtection()

    it('initializes csrfSecret on session and attaches csrfToken()', () => {
        const req = createMockRequest()
        const res = createMockResponse()
        const next = jest.fn()

        middleware(req, res, next)

        expect(req.session).toHaveProperty('csrfSecret')
        expect(typeof (req.session as Record<string, unknown>).csrfSecret).toBe('string')
        expect(typeof req.csrfToken).toBe('function')
        expect(typeof req.csrfToken()).toBe('string')
        expect(next).toHaveBeenCalledWith()
    })

    it('skips validation for safe methods (GET, HEAD, OPTIONS)', () => {
        for (const method of ['GET', 'HEAD', 'OPTIONS']) {
            const req = createMockRequest({ method } as Partial<Request>)
            const next = jest.fn()
            middleware(req, createMockResponse(), next)
            expect(next).toHaveBeenCalledWith()
        }
    })

    it('rejects POST without a token with EBADCSRFTOKEN', () => {
        const req = createMockRequest({ method: 'POST' } as Partial<Request>)
        const next = jest.fn()

        middleware(req, createMockResponse(), next)

        expect(next).toHaveBeenCalledTimes(1)
        const err = next.mock.calls[0][0] as Error & { code?: string; status?: number }
        expect(err).toBeInstanceOf(Error)
        expect(err.code).toBe('EBADCSRFTOKEN')
        expect(err.status).toBe(403)
    })

    it('rejects POST with an invalid token', () => {
        const req = createMockRequest({ method: 'POST' } as Partial<Request>)
        const next = jest.fn()

        // First call as GET to initialize the session secret
        middleware(createMockRequest({ session: req.session } as Partial<Request>), createMockResponse(), jest.fn())

        // Now POST with bad token in header
        req.headers['x-csrf-token'] = 'invalid-token'
        middleware(req, createMockResponse(), next)

        const err = next.mock.calls[0][0] as Error & { code?: string }
        expect(err.code).toBe('EBADCSRFTOKEN')
    })

    it('accepts POST with a valid X-CSRF-Token header', () => {
        const session: Record<string, unknown> = {}
        const getReq = createMockRequest({ session } as Partial<Request>)
        const next1 = jest.fn()

        // GET to init session + get token
        middleware(getReq, createMockResponse(), next1)
        const token = getReq.csrfToken()

        // POST with valid token
        const postReq = createMockRequest({
            method: 'POST',
            session,
            headers: { 'x-csrf-token': token }
        } as Partial<Request>)
        const next2 = jest.fn()
        middleware(postReq, createMockResponse(), next2)

        expect(next2).toHaveBeenCalledWith()
    })

    it('accepts token from req.body._csrf', () => {
        const session: Record<string, unknown> = {}
        const getReq = createMockRequest({ session } as Partial<Request>)
        middleware(getReq, createMockResponse(), jest.fn())
        const token = getReq.csrfToken()

        const postReq = createMockRequest({
            method: 'POST',
            session,
            body: { _csrf: token }
        } as Partial<Request>)
        const next = jest.fn()
        middleware(postReq, createMockResponse(), next)

        expect(next).toHaveBeenCalledWith()
    })

    it('accepts token from req.query._csrf', () => {
        const session: Record<string, unknown> = {}
        const getReq = createMockRequest({ session } as Partial<Request>)
        middleware(getReq, createMockResponse(), jest.fn())
        const token = getReq.csrfToken()

        const postReq = createMockRequest({
            method: 'POST',
            session,
            query: { _csrf: token }
        } as Partial<Request>)
        const next = jest.fn()
        middleware(postReq, createMockResponse(), next)

        expect(next).toHaveBeenCalledWith()
    })

    it('preserves existing csrfSecret across requests', () => {
        const session: Record<string, unknown> = {}
        const req1 = createMockRequest({ session } as Partial<Request>)
        middleware(req1, createMockResponse(), jest.fn())
        const secret1 = session.csrfSecret

        const req2 = createMockRequest({ session } as Partial<Request>)
        middleware(req2, createMockResponse(), jest.fn())
        const secret2 = session.csrfSecret

        expect(secret1).toBe(secret2)
    })
})
