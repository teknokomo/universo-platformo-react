import express, { type Request, type RequestHandler } from 'express'
import request from 'supertest'
import { createOnboardingRoutes } from '../../routes/onboardingRoutes'

var mockGetUserProfile = jest.fn()
var mockMarkOnboardingCompleted = jest.fn()

jest.mock('@universo/profile-backend', () => ({
    ProfileService: jest.fn().mockImplementation(() => ({
        getUserProfile: mockGetUserProfile,
        markOnboardingCompleted: mockMarkOnboardingCompleted
    }))
}))

const passThrough: RequestHandler = (_req, _res, next) => next()
const readLimiter = passThrough as never
const writeLimiter = passThrough as never
const mockAssignSystemRole = jest.fn()

const createApp = (queryImpl: jest.Mock, withUser = true, transactionImpl?: jest.Mock, assignSystemRole = mockAssignSystemRole) => {
    const app = express()
    app.use(express.json())

    if (withUser) {
        app.use((req, _res, next) => {
            ;(req as Request & { user?: { id: string; email?: string } }).user = { id: 'user-1', email: 'user@example.com' }
            next()
        })
    }

    const transaction =
        transactionImpl ??
        jest.fn(async (callback: (trx: { query: jest.Mock; transaction: jest.Mock; isReleased: () => boolean }) => Promise<unknown>) =>
            callback({ query: queryImpl, transaction: jest.fn(), isReleased: () => false })
        )

    app.use(
        '/onboarding',
        createOnboardingRoutes(
            passThrough,
            () => ({ query: queryImpl, transaction, isReleased: () => false } as never),
            readLimiter,
            writeLimiter,
            assignSystemRole
        )
    )

    return app
}

const goalRow = {
    id: '00000000-0000-4000-a000-000000000001',
    codename: 'goal_one',
    name: { defaultLocale: 'en', versions: [{ locale: 'en', value: 'Goal One', updatedAt: '2024-12-06T00:00:00.000Z' }] },
    description: { defaultLocale: 'en', versions: [{ locale: 'en', value: 'Desc', updatedAt: '2024-12-06T00:00:00.000Z' }] },
    sort_order: 1,
    is_active: true
}

describe('createOnboardingRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetUserProfile.mockResolvedValue(null)
        mockMarkOnboardingCompleted.mockResolvedValue({ onboarding_completed: true })
        process.env.AUTO_ROLE_AFTER_ONBOARDING = 'true'
    })

    describe('GET /items', () => {
        it('returns catalog items grouped by kind with selection status', async () => {
            mockGetUserProfile.mockResolvedValueOnce({ onboarding_completed: false })

            const query = jest
                .fn()
                // fetchCatalogItems goals
                .mockResolvedValueOnce([goalRow])
                // fetchCatalogItems topics
                .mockResolvedValueOnce([])
                // fetchCatalogItems features
                .mockResolvedValueOnce([])
                // fetchAllUserSelections
                .mockResolvedValueOnce([
                    { id: 's-1', user_id: 'user-1', catalog_kind: 'goals', item_id: '00000000-0000-4000-a000-000000000001' }
                ])

            const app = createApp(query)
            const res = await request(app).get('/onboarding/items')

            expect(res.status).toBe(200)
            expect(res.body.onboardingCompleted).toBe(false)
            expect(res.body.goals).toHaveLength(1)
            expect(res.body.goals[0].isSelected).toBe(true)
            expect(res.body.goals[0].codename).toBe('goal_one')
            expect(res.body.topics).toEqual([])
            expect(res.body.features).toEqual([])
            expect(mockGetUserProfile).toHaveBeenCalledWith('user-1')
        })

        it('returns 401 when unauthenticated', async () => {
            const query = jest.fn()
            const app = createApp(query, false)
            const res = await request(app).get('/onboarding/items')

            expect(res.status).toBe(401)
            expect(query).not.toHaveBeenCalled()
        })
    })

    describe('POST /selections', () => {
        it('validates and syncs selections across all catalog kinds', async () => {
            const query = jest
                .fn()
                // validateItemExists for goal UUID
                .mockResolvedValueOnce([{ id: '00000000-0000-4000-a000-000000000001' }])
                // syncUserSelections: fetchUserSelections(goals) – no existing
                .mockResolvedValueOnce([])
                // syncUserSelections: INSERT for goal
                .mockResolvedValueOnce([
                    { id: 's-1', user_id: 'user-1', catalog_kind: 'goals', item_id: '00000000-0000-4000-a000-000000000001' }
                ])
                // syncUserSelections: fetchUserSelections(topics) – no existing
                .mockResolvedValueOnce([])
                // syncUserSelections: fetchUserSelections(features) – no existing
                .mockResolvedValueOnce([])

            const transaction = jest.fn(
                async (callback: (trx: { query: jest.Mock; transaction: jest.Mock; isReleased: () => boolean }) => Promise<unknown>) =>
                    callback({ query, transaction: jest.fn(), isReleased: () => false })
            )

            const app = createApp(query, true, transaction)
            const res = await request(app)
                .post('/onboarding/selections')
                .send({ goals: ['00000000-0000-4000-a000-000000000001'], topics: [], features: [] })

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.added.goals).toBe(1)
            expect(res.body.removed.goals).toBe(0)
            expect(transaction).toHaveBeenCalledTimes(1)
        })

        it('rejects invalid body', async () => {
            const query = jest.fn()
            const app = createApp(query)

            const res = await request(app).post('/onboarding/selections').send({ goals: 'not-an-array' })

            expect(res.status).toBe(400)
            expect(res.body.error).toBe('Invalid request body')
        })

        it('rejects non-existent item IDs', async () => {
            const query = jest
                .fn()
                // validateItemExists returns empty
                .mockResolvedValueOnce([])

            const app = createApp(query)
            const res = await request(app)
                .post('/onboarding/selections')
                .send({ goals: ['00000000-0000-4000-a000-000000000099'], topics: [], features: [] })

            expect(res.status).toBe(400)
            expect(res.body.error).toContain('not found')
        })

        it('returns 401 when unauthenticated', async () => {
            const query = jest.fn()
            const app = createApp(query, false)
            const res = await request(app).post('/onboarding/selections').send({ goals: [], topics: [], features: [] })

            expect(res.status).toBe(401)
            expect(query).not.toHaveBeenCalled()
        })

        it('deduplicates repeated item IDs before validation and sync', async () => {
            const query = jest
                .fn()
                .mockResolvedValueOnce([{ id: '00000000-0000-4000-a000-000000000001' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([
                    { id: 's-1', user_id: 'user-1', catalog_kind: 'goals', item_id: '00000000-0000-4000-a000-000000000001' }
                ])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])

            const app = createApp(query)
            const res = await request(app)
                .post('/onboarding/selections')
                .send({
                    goals: ['00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001'],
                    topics: [],
                    features: []
                })

            expect(res.status).toBe(200)
            expect(res.body.added.goals).toBe(1)
            expect(query).toHaveBeenCalledTimes(5)
        })

        it('does not leave partial writes outside a transaction boundary', async () => {
            const query = jest
                .fn()
                .mockResolvedValueOnce([{ id: '00000000-0000-4000-a000-000000000001' }])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 's-1' }])
                .mockRejectedValueOnce(new Error('topic write failed'))

            const transaction = jest.fn(
                async (callback: (trx: { query: jest.Mock; transaction: jest.Mock; isReleased: () => boolean }) => Promise<unknown>) =>
                    callback({ query, transaction: jest.fn(), isReleased: () => false })
            )

            const app = createApp(query, true, transaction)
            const res = await request(app)
                .post('/onboarding/selections')
                .send({ goals: ['00000000-0000-4000-a000-000000000001'], topics: [], features: [] })

            expect(res.status).toBe(500)
            expect(transaction).toHaveBeenCalledTimes(1)
        })
    })

    describe('POST /complete', () => {
        it('marks onboarding as completed via ProfileService', async () => {
            const query = jest.fn()
            const app = createApp(query)
            const res = await request(app).post('/onboarding/complete')

            expect(res.status).toBe(200)
            expect(res.body.success).toBe(true)
            expect(res.body.onboardingCompleted).toBe(true)
            expect(mockMarkOnboardingCompleted).toHaveBeenCalledWith('user-1', 'user@example.com')
            expect(mockAssignSystemRole).toHaveBeenCalledWith({
                userId: 'user-1',
                roleCodename: 'user',
                reason: 'auto-assigned on onboarding completion'
            })
        })

        it('skips automatic user-role assignment when the env flag disables it', async () => {
            process.env.AUTO_ROLE_AFTER_ONBOARDING = 'false'

            const query = jest.fn()
            const app = createApp(query)
            const res = await request(app).post('/onboarding/complete')

            expect(res.status).toBe(200)
            expect(mockAssignSystemRole).not.toHaveBeenCalled()
        })

        it('rolls back onboarding_completed when automatic role assignment fails for a newly completed profile', async () => {
            const query = jest.fn()
            const failingAssignSystemRole = jest.fn().mockRejectedValue(new Error('role assignment failed'))

            mockGetUserProfile.mockResolvedValueOnce({ onboarding_completed: false })

            const app = createApp(query, true, undefined, failingAssignSystemRole)
            const res = await request(app).post('/onboarding/complete')

            expect(res.status).toBe(500)
            expect(failingAssignSystemRole).toHaveBeenCalledWith({
                userId: 'user-1',
                roleCodename: 'user',
                reason: 'auto-assigned on onboarding completion'
            })
            expect(query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE profiles.cat_profiles'),
                [false, 'user-1']
            )
        })

        it('returns 401 when unauthenticated', async () => {
            const query = jest.fn()
            const app = createApp(query, false)
            const res = await request(app).post('/onboarding/complete')

            expect(res.status).toBe(401)
        })
    })
})
