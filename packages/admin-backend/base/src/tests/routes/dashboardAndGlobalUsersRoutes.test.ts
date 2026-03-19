jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next()
}))

import express, { type Request } from 'express'
const request = require('supertest')

import { createDashboardRoutes } from '../../routes/dashboardRoutes'
import { createGlobalUsersRoutes } from '../../routes/globalUsersRoutes'

const attachRequestContext = (app: express.Express, userId = 'admin-1') => {
    const sessionQuery = jest.fn()

    app.use((req, _res, next) => {
        ;(req as Request & { user?: { id: string }; dbContext?: unknown }).user = { id: userId }
        ;(req as Request & { dbContext?: unknown }).dbContext = {
            session: { query: sessionQuery, isReleased: jest.fn(() => false) },
            isReleased: () => false,
            query: jest.fn()
        }
        next()
    })

    return { sessionQuery }
}

describe('dashboard and global users routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.ADMIN_PANEL_ENABLED = 'true'
    })

    it('allows shared dashboard stats for ordinary workspace users', async () => {
        const globalAccessService = {
            hasWorkspaceAccess: jest.fn().mockResolvedValue(true),
            getStats: jest.fn().mockResolvedValue({
                totalGlobalUsers: 3,
                byRole: { user: 2, registered: 1 },
                totalRoles: 4,
                totalApplications: 5,
                totalMetahubs: 6
            })
        }

        const app = express()
        attachRequestContext(app, 'user-1')
        app.use('/dashboard', createDashboardRoutes({ globalAccessService } as never))

        const response = await request(app).get('/dashboard/stats')

        expect(response.status).toBe(200)
        expect(globalAccessService.getStats).toHaveBeenCalledTimes(1)
        expect(response.body.data.totalApplications).toBe(5)
    })

    it('denies shared dashboard stats for registered-only users', async () => {
        const globalAccessService = {
            hasWorkspaceAccess: jest.fn().mockResolvedValue(false),
            getStats: jest.fn()
        }

        const app = express()
        attachRequestContext(app, 'user-registered')
        app.use('/dashboard', createDashboardRoutes({ globalAccessService } as never))

        const response = await request(app).get('/dashboard/stats')

        expect(response.status).toBe(403)
        expect(globalAccessService.getStats).not.toHaveBeenCalled()
    })

    it('rolls back a newly created auth user when role assignment fails', async () => {
        const globalAccessService = {}
        const provisioningService = {
            provisionAuthUserWithRoleIds: jest
                .fn()
                .mockRejectedValue(
                    new Error('Failed to assign roles to the newly created user. Newly created auth account was rolled back.')
                )
        }

        const app = express()
        app.use(express.json())
        attachRequestContext(app, 'admin-1')
        app.use(
            '/global-users',
            createGlobalUsersRoutes({
                globalAccessService,
                permissionService: {} as never,
                provisioningService: provisioningService as never
            })
        )

        const response = await request(app)
            .post('/global-users/create-user')
            .send({
                email: 'neo@example.com',
                password: 'password123',
                roleIds: ['00000000-0000-4000-a000-000000000001']
            })

        expect(response.status).toBe(500)
        expect(provisioningService.provisionAuthUserWithRoleIds).toHaveBeenCalledWith({
            email: 'neo@example.com',
            password: 'password123',
            roleIds: ['00000000-0000-4000-a000-000000000001'],
            grantedBy: 'admin-1',
            comment: 'created from admin panel'
        })
        expect(response.text).toContain('rolled back')
    })

    it('uses legacy patch route as a compatibility wrapper over user-level role updates', async () => {
        const globalAccessService = {
            updateLegacyUserAccess: jest.fn().mockResolvedValue({ id: 'user-1', userId: 'user-1', roles: [] })
        }

        const app = express()
        app.use(express.json())
        attachRequestContext(app, 'admin-1')
        app.use('/global-users', createGlobalUsersRoutes({ globalAccessService, permissionService: {} as never }))

        const memberId = '00000000-0000-4000-a000-000000000002'
        const response = await request(app).patch(`/global-users/${memberId}`).send({ role: 'editor', comment: 'legacy edit' })

        expect(response.status).toBe(200)
        expect(globalAccessService.updateLegacyUserAccess).toHaveBeenCalledWith(
            memberId,
            { roleCodename: 'editor', comment: 'legacy edit' },
            'admin-1'
        )
    })

    it('returns explicit superuser state from /me and prefers the superuser role as primary', async () => {
        const globalAccessService = {
            getGlobalAccessInfo: jest.fn().mockResolvedValue({
                isSuperuser: true,
                canAccessAdmin: true,
                globalRoles: [
                    {
                        codename: 'editor',
                        metadata: {
                            codename: 'editor',
                            name: { _schema: '1', _primary: 'en', locales: {} },
                            color: '#222222',
                            isSuperuser: false
                        }
                    },
                    {
                        codename: 'superuser',
                        metadata: {
                            codename: 'superuser',
                            name: { _schema: '1', _primary: 'en', locales: {} },
                            color: '#111111',
                            isSuperuser: true
                        }
                    }
                ]
            })
        }

        const app = express()
        attachRequestContext(app, 'admin-1')
        app.use('/global-users', createGlobalUsersRoutes({ globalAccessService, permissionService: {} as never }))

        const response = await request(app).get('/global-users/me')

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(
            expect.objectContaining({
                role: 'superuser',
                hasGlobalAccess: true,
                isSuperuser: true,
                roleMetadata: expect.objectContaining({ codename: 'superuser', isSuperuser: true })
            })
        )
    })

    it('uses legacy delete route to revoke all user roles by user id', async () => {
        const globalAccessService = {
            revokeGlobalAccess: jest.fn().mockResolvedValue(true)
        }

        const app = express()
        attachRequestContext(app, 'admin-1')
        app.use('/global-users', createGlobalUsersRoutes({ globalAccessService, permissionService: {} as never }))

        const memberId = '00000000-0000-4000-a000-000000000003'
        const response = await request(app).delete(`/global-users/${memberId}`)

        expect(response.status).toBe(200)
        expect(globalAccessService.revokeGlobalAccess).toHaveBeenCalledWith(memberId, 'admin-1')
    })
})
