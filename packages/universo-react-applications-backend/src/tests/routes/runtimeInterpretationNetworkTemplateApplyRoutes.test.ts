import express, { type NextFunction, type Request, type Response } from 'express'
import request from 'supertest'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createApplicationsRoutes } from '../../routes/applicationsRoutes'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('Table Template apply route registration', () => {
    it('is authenticated and uses the write limiter', async () => {
        const { executor } = createMockDbExecutor()
        const ensureAuth = jest.fn((_req: Request, res: Response, _next: NextFunction) => res.status(401).json({ error: 'Unauthorized' }))
        const writeLimiter = jest.fn((_req: Request, _res: Response, next: NextFunction) => next()) as unknown as RateLimitRequestHandler
        const readLimiter = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler
        const router = createApplicationsRoutes(ensureAuth, () => executor, readLimiter, writeLimiter)
        const stack = (
            router as unknown as {
                stack: Array<{
                    handle: unknown
                    route?: {
                        path: string
                        methods: Record<string, boolean>
                        stack: Array<{ handle: unknown }>
                    }
                }>
            }
        ).stack
        const routePath = '/:applicationId/runtime/interpretation-network/templates/:templateId/apply'
        const route = stack.find((layer) => layer.route?.path === routePath)

        expect(stack[0]?.handle).toBe(ensureAuth)
        expect(route?.route?.methods.post).toBe(true)
        expect(route?.route?.stack[0]?.handle).toBe(writeLimiter)

        const app = express()
        app.use('/applications', router)
        await request(app)
            .post('/applications/app-1/runtime/interpretation-network/templates/' + '019f2000-0000-7000-8000-000000000201' + '/apply')
            .send({})
            .expect(401, { error: 'Unauthorized' })
        expect(executor.query).not.toHaveBeenCalled()
    })
})
