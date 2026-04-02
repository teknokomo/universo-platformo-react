jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next()
}))

jest.mock('../../persistence/instancesStore', () => ({
    listInstances: jest.fn(),
    findInstanceById: jest.fn(),
    updateInstance: jest.fn(),
    getInstanceStats: jest.fn()
}))

import express from 'express'
const request = require('supertest')

import { createInstancesRoutes } from '../../routes/instancesRoutes'
import { listInstances, findInstanceById, updateInstance, getInstanceStats } from '../../persistence/instancesStore'

const mockListInstances = listInstances as jest.MockedFunction<typeof listInstances>
const mockFindInstanceById = findInstanceById as jest.MockedFunction<typeof findInstanceById>
const mockUpdateInstance = updateInstance as jest.MockedFunction<typeof updateInstance>
const mockGetInstanceStats = getInstanceStats as jest.MockedFunction<typeof getInstanceStats>

function buildApp() {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
        ;(req as never as Record<string, unknown>).user = { id: 'admin-1' }
        ;(req as never as Record<string, unknown>).dbContext = {
            session: { query: jest.fn(), isReleased: jest.fn(() => false) },
            isReleased: () => false,
            query: jest.fn()
        }
        next()
    })
    app.use(
        '/instances',
        createInstancesRoutes({
            globalAccessService: {} as never,
            permissionService: {} as never,
            getDbExecutor: () => ({ query: jest.fn(), transaction: jest.fn() }) as never
        })
    )
    return app
}

describe('instancesRoutes', () => {
    beforeEach(() => jest.clearAllMocks())

    // ── GET / ──────────────────────────────────────────────────
    it('lists instances with pagination headers', async () => {
        mockListInstances.mockResolvedValue({ items: [{ id: 'i-1', codename: 'main' }], total: 1 } as never)

        const res = await request(buildApp()).get('/instances')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.headers['x-total-count']).toBe('1')
        expect(res.headers['x-pagination-has-more']).toBe('false')
    })

    it('rejects invalid query parameters', async () => {
        const res = await request(buildApp()).get('/instances?limit=-1')
        expect(res.status).toBe(400)
    })

    // ── GET /:id ───────────────────────────────────────────────
    it('returns instance by id', async () => {
        mockFindInstanceById.mockResolvedValue({ id: 'i-1', codename: 'main', is_local: true } as never)

        const res = await request(buildApp()).get('/instances/i-1')

        expect(res.status).toBe(200)
        expect(res.body.data.codename).toBe('main')
    })

    it('returns 404 for missing instance', async () => {
        mockFindInstanceById.mockResolvedValue(null as never)

        const res = await request(buildApp()).get('/instances/not-found')
        expect(res.status).toBe(404)
    })

    // ── PUT /:id ───────────────────────────────────────────────
    it('updates instance fields', async () => {
        const instance = { id: 'i-1', codename: 'main', is_local: true }
        mockFindInstanceById.mockResolvedValue(instance as never)
        mockUpdateInstance.mockResolvedValue({ ...instance, codename: 'updated' } as never)

        const res = await request(buildApp()).put('/instances/i-1').send({ codename: 'updated' })

        expect(res.status).toBe(200)
        expect(mockUpdateInstance).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when updating non-existent instance', async () => {
        mockFindInstanceById.mockResolvedValue(null as never)

        const res = await request(buildApp()).put('/instances/not-found').send({ codename: 'x' })
        expect(res.status).toBe(404)
    })

    it('rejects is_local modification', async () => {
        mockFindInstanceById.mockResolvedValue({ id: 'i-1', is_local: true } as never)

        const res = await request(buildApp()).put('/instances/i-1').send({ is_local: false })
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('is_local')
    })

    it('rejects invalid status value', async () => {
        mockFindInstanceById.mockResolvedValue({ id: 'i-1', is_local: true } as never)

        const res = await request(buildApp()).put('/instances/i-1').send({ status: 'invalid' })
        expect(res.status).toBe(400)
    })

    // ── GET /:id/stats ─────────────────────────────────────────
    it('returns stats for local instance', async () => {
        mockFindInstanceById.mockResolvedValue({ id: 'i-1', is_local: true, name: 'Main', status: 'active' } as never)
        mockGetInstanceStats.mockResolvedValue({ totalUsers: 10, globalAccessUsers: 3, totalRoles: 5 } as never)

        const res = await request(buildApp()).get('/instances/i-1/stats')

        expect(res.status).toBe(200)
        expect(res.body.data.available).toBe(true)
        expect(res.body.data.totalUsers).toBe(10)
    })

    it('returns unavailable for remote instance stats', async () => {
        mockFindInstanceById.mockResolvedValue({ id: 'i-2', is_local: false } as never)

        const res = await request(buildApp()).get('/instances/i-2/stats')

        expect(res.status).toBe(200)
        expect(res.body.data.available).toBe(false)
    })

    it('returns 404 for stats of missing instance', async () => {
        mockFindInstanceById.mockResolvedValue(null as never)

        const res = await request(buildApp()).get('/instances/not-found/stats')
        expect(res.status).toBe(404)
    })
})
