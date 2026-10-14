import type { Request, Response } from 'express'
import sanitizeHtml from 'sanitize-html'
import { allowPrivateNetworkAccess, getAllowedCorsOrigins, getCorsOptions, sanitizeMiddleware } from '../utils/XSS'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('sanitize-html', () => ({
    __esModule: true,
    default: jest.fn((value: string) => value.replaceAll('<unsafe>', ''))
}))

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

describe('sanitizeMiddleware', () => {
    it('handles bracket query parameters parsed by Express on relation-scoped row requests', async () => {
        const app = express()
        app.delete('/api/v1/applications/:applicationId/runtime/rows/:rowId', sanitizeMiddleware, (req, res) => res.json(req.query))

        const response = await request(app).delete('/api/v1/applications/app-1/runtime/rows/rh1.test-row-handle').query({
            'relationScope[fieldCodename]': '<unsafe>ParentId',
            'relationScope[parentRecordId]': '018f8a78-7b8f-7c1d-a111-222233334401',
            'relationScope[layoutTarget][targetKind]': 'object',
            'relationScope[layoutTarget][entityTypeId]': '018f8a78-7b8f-7c1d-a111-222233334410',
            expectedVersion: '3'
        })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            relationScope: {
                fieldCodename: 'ParentId',
                parentRecordId: '018f8a78-7b8f-7c1d-a111-222233334401',
                layoutTarget: { targetKind: 'object', entityTypeId: '018f8a78-7b8f-7c1d-a111-222233334410' }
            },
            expectedVersion: '3'
        })
        expect(sanitizeHtml).toHaveBeenCalledWith('<unsafe>ParentId')
    })

    it('sanitizes nested query strings without flattening structured request values', () => {
        const req = {
            url: '/api/runtime/rows?relationScope[fieldCodename]=ParentId',
            query: {
                relationScope: {
                    fieldCodename: '<unsafe>ParentId',
                    parentRecordId: '018f8a78-7b8f-7c1d-a111-222233334401',
                    layoutTarget: { targetKind: 'object', entityTypeId: '018f8a78-7b8f-7c1d-a111-222233334410' }
                },
                filters: ['<unsafe>visible', { label: '<unsafe>safe' }],
                expectedVersion: 3
            }
        } as unknown as Request
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response
        const next = jest.fn()

        sanitizeMiddleware(req, res, next)

        expect(req.query).toEqual({
            relationScope: {
                fieldCodename: 'ParentId',
                parentRecordId: '018f8a78-7b8f-7c1d-a111-222233334401',
                layoutTarget: { targetKind: 'object', entityTypeId: '018f8a78-7b8f-7c1d-a111-222233334410' }
            },
            filters: ['visible', { label: 'safe' }],
            expectedVersion: 3
        })
        expect(sanitizeHtml).toHaveBeenCalledWith('<unsafe>ParentId')
        expect(sanitizeHtml).toHaveBeenCalledWith('<unsafe>visible')
        expect(sanitizeHtml).toHaveBeenCalledWith('<unsafe>safe')
        expect(next).toHaveBeenCalledTimes(1)
    })

    it('rejects malformed percent encoding without passing the request onward', () => {
        const req = { url: '/api/runtime/rows?value=%E0%A4%A', query: {} } as unknown as Request
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response
        const next = jest.fn()

        sanitizeMiddleware(req, res, next)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: 'Malformed request URL' })
        expect(next).not.toHaveBeenCalled()
    })
})
