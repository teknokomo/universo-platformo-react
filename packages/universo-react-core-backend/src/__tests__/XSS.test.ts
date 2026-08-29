import type { Request, Response } from 'express'
import { allowPrivateNetworkAccess, getAllowedCorsOrigins, getCorsOptions } from '../utils/XSS'

const originalCorsOrigins = process.env.CORS_ORIGINS

afterEach(() => {
    if (originalCorsOrigins === undefined) {
        delete process.env.CORS_ORIGINS
    } else {
        process.env.CORS_ORIGINS = originalCorsOrigins
    }
})

describe('allowPrivateNetworkAccess', () => {
    it('adds the PNA response header only for a PNA preflight', () => {
        process.env.CORS_ORIGINS = 'https://allowed.example.test'
        const setHeader = jest.fn()
        const req = {
            method: 'OPTIONS',
            get: (name: string) => {
                const headers: Record<string, string> = {
                    origin: 'https://allowed.example.test',
                    'access-control-request-private-network': 'true'
                }
                return headers[name.toLowerCase()]
            }
        } as unknown as Request
        const next = jest.fn()

        allowPrivateNetworkAccess(req, { setHeader } as unknown as Response, next)

        expect(setHeader).toHaveBeenCalledWith('Access-Control-Allow-Private-Network', 'true')
        expect(next).toHaveBeenCalledWith()
    })

    it('does not opt ordinary requests into private-network access', () => {
        const setHeader = jest.fn()
        const req = { method: 'GET', get: () => undefined } as unknown as Request
        const next = jest.fn()

        allowPrivateNetworkAccess(req, { setHeader } as unknown as Response, next)

        expect(setHeader).not.toHaveBeenCalled()
        expect(next).toHaveBeenCalledWith()
    })

    it('does not authorize a PNA preflight from an unlisted origin', () => {
        process.env.CORS_ORIGINS = 'https://allowed.example.test'
        const setHeader = jest.fn()
        const req = {
            method: 'OPTIONS',
            get: (name: string) =>
                ({ origin: 'https://attacker.example.test', 'access-control-request-private-network': 'true' }[name.toLowerCase()])
        } as unknown as Request
        const next = jest.fn()

        allowPrivateNetworkAccess(req, { setHeader } as unknown as Response, next)

        expect(setHeader).not.toHaveBeenCalled()
        expect(next).toHaveBeenCalledWith()
    })

    it('does not authorize PNA when the CORS wildcard or default is fail-closed', () => {
        for (const configuredOrigins of [undefined, '*']) {
            if (configuredOrigins === undefined) {
                delete process.env.CORS_ORIGINS
            } else {
                process.env.CORS_ORIGINS = configuredOrigins
            }
            const setHeader = jest.fn()
            const req = {
                method: 'OPTIONS',
                get: (name: string) =>
                    ({ origin: 'https://attacker.example.test', 'access-control-request-private-network': 'true' }[name.toLowerCase()])
            } as unknown as Request

            allowPrivateNetworkAccess(req, { setHeader } as unknown as Response, jest.fn())

            expect(setHeader).not.toHaveBeenCalled()
        }
    })
})

describe('getCorsOptions', () => {
    it('fails closed when no explicit allowlist is configured', () => {
        delete process.env.CORS_ORIGINS

        expect(getAllowedCorsOrigins()).toBe('')
        const callback = jest.fn()
        getCorsOptions().origin?.('https://attacker.example.test', callback)

        expect(callback).toHaveBeenCalledWith(expect.any(Error))
    })

    it('reflects only an explicitly allowlisted origin when credentials are enabled', () => {
        process.env.CORS_ORIGINS = 'https://allowed.example.test, https://second.example.test'
        const options = getCorsOptions()
        const allowedCallback = jest.fn()
        const deniedCallback = jest.fn()

        options.origin?.('https://allowed.example.test', allowedCallback)
        options.origin?.('https://attacker.example.test', deniedCallback)

        expect(allowedCallback).toHaveBeenCalledWith(null, 'https://allowed.example.test')
        expect(deniedCallback).toHaveBeenCalledWith(expect.any(Error))
        expect(options.credentials).toBe(true)
    })

    it('treats a wildcard configuration as fail-closed instead of reflecting arbitrary credentials origins', () => {
        process.env.CORS_ORIGINS = '*'
        const callback = jest.fn()

        getCorsOptions().origin?.('https://attacker.example.test', callback)

        expect(callback).toHaveBeenCalledWith(expect.any(Error))
    })
})
