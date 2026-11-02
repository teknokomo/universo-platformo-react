import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { DbExecutor } from '@universo-react/utils'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('../../services/applicationBotBindings', () => ({ createApplicationBotBindingsService: jest.fn() }))

import { createApplicationBotBindingsService } from '../../services/applicationBotBindings'
import { createPublicApplicationsRoutes } from '../../routes/publicApplicationsRoutes'

const alias = 'seventy-third-meridian'
const validShortId = 'AAAAAAAAAAAAAAAAAAAAAA'
const resolvePublicAttribution = jest.fn()

const transactionExecutor = {
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn().mockReturnValue(false)
} as unknown as DbExecutor
const executor = {
    query: jest.fn(),
    transaction: jest.fn(async (callback: (transaction: DbExecutor) => Promise<unknown>) => callback(transactionExecutor)),
    isReleased: jest.fn().mockReturnValue(false)
} as unknown as DbExecutor

const limiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler

const app = express()
app.use(createPublicApplicationsRoutes(() => executor, limiter, limiter))

describe('public Application attribution route', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resolvePublicAttribution.mockReset()
        ;(createApplicationBotBindingsService as jest.Mock).mockReturnValue({ resolvePublicAttribution })
    })

    it('delegates the public reference and short id to the application service', async () => {
        resolvePublicAttribution.mockResolvedValue('max')

        const response = await request(app).get(`/public/applications/${alias}/attribution/${validShortId}`).expect(200)

        expect(response.body).toEqual({ platform: 'max' })
        expect(createApplicationBotBindingsService).toHaveBeenCalledWith(transactionExecutor)
        expect(resolvePublicAttribution).toHaveBeenCalledWith(alias, validShortId)
    })

    it('returns attribution-null for malformed or disabled short ids', async () => {
        resolvePublicAttribution.mockResolvedValue(null)

        const malformed = await request(app).get(`/public/applications/${alias}/attribution/not-a-short-id`).expect(200)
        const disabled = await request(app).get(`/public/applications/${alias}/attribution/${validShortId}`).expect(200)

        expect(malformed.body).toEqual({ platform: null })
        expect(disabled.body).toEqual({ platform: null })
        expect(resolvePublicAttribution).toHaveBeenNthCalledWith(1, alias, 'not-a-short-id')
        expect(resolvePublicAttribution).toHaveBeenNthCalledWith(2, alias, validShortId)
        for (const response of [malformed, disabled]) {
            expect(response.body).not.toHaveProperty('applicationId')
            expect(response.body).not.toHaveProperty('bindingId')
        }
    })

    it('does not query attribution when the public Application reference is unavailable', async () => {
        resolvePublicAttribution.mockResolvedValue(null)

        const response = await request(app).get(`/public/applications/missing-alias/attribution/${validShortId}`).expect(200)

        expect(response.body).toEqual({ platform: null })
        expect(resolvePublicAttribution).toHaveBeenCalledWith('missing-alias', validShortId)
    })
})
