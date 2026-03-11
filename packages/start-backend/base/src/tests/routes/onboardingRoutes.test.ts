import express, { type Request, type RequestHandler } from 'express'
import request from 'supertest'
import { createOnboardingRoutes } from '../../routes/onboardingRoutes'

const passThrough: RequestHandler = (_req, _res, next) => next()
const readLimiter = passThrough as never
const writeLimiter = passThrough as never

const createApp = (queryImpl: jest.Mock, withUser = true) => {
    const app = express()
    app.use(express.json())

    if (withUser) {
        app.use((req, _res, next) => {
            ;(req as Request & { user?: { id: string; email?: string } }).user = { id: 'user-1', email: 'user@example.com' }
            next()
        })
    }

    app.use(
        '/onboarding',
        createOnboardingRoutes(passThrough, () => ({ query: queryImpl, transaction: jest.fn() } as never), readLimiter, writeLimiter)
    )

    return app
}

describe('createOnboardingRoutes', () => {
    it('returns onboarding status with empty legacy item lists', async () => {
        const query = jest.fn().mockResolvedValue([{ onboarding_completed: true }])
        const app = createApp(query)

        const response = await request(app).get('/onboarding/items')

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            onboardingCompleted: true,
            projects: [],
            campaigns: [],
            clusters: []
        })
        expect(query).toHaveBeenCalledWith('SELECT onboarding_completed FROM public.profiles WHERE user_id = $1 LIMIT 1', ['user-1'])
    })

    it('bootstraps a missing profile and completes onboarding successfully', async () => {
        const createdProfile = {
            id: 'profile-1',
            user_id: 'user-1',
            nickname: 'user_user-1',
            settings: {},
            onboarding_completed: false
        }
        const completedProfile = {
            ...createdProfile,
            onboarding_completed: true
        }
        const query = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([createdProfile]).mockResolvedValueOnce([completedProfile])
        const app = createApp(query)

        const response = await request(app).post('/onboarding/join').send({ projectIds: [], campaignIds: [], clusterIds: [] })

        expect(response.status).toBe(200)
        expect(response.body).toEqual({
            success: true,
            added: { projects: 0, campaigns: 0, clusters: 0 },
            removed: { projects: 0, campaigns: 0, clusters: 0 },
            onboardingCompleted: true
        })
        expect(query).toHaveBeenNthCalledWith(1, 'SELECT * FROM public.profiles WHERE user_id = $1 LIMIT 1', ['user-1'])
        expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining('INSERT INTO public.profiles'), [
            'user-1',
            'user_user-1',
            null,
            null,
            '{}'
        ])
        expect(query).toHaveBeenNthCalledWith(
            3,
            'UPDATE public.profiles SET onboarding_completed = $1, updated_at = NOW() WHERE user_id = $2 RETURNING *',
            [true, 'user-1']
        )
    })

    it('returns 401 when the request has no authenticated user', async () => {
        const query = jest.fn()
        const app = createApp(query, false)

        const response = await request(app).get('/onboarding/items')

        expect(response.status).toBe(401)
        expect(response.body).toEqual({ error: 'User not authenticated' })
        expect(query).not.toHaveBeenCalled()
    })
})
