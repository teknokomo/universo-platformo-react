jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: any, _res: any, next: any) => next()
}))

const instancesStore = {
    listInstances: jest.fn(),
    findInstanceById: jest.fn(),
    updateInstance: jest.fn(),
    getInstanceStats: jest.fn()
}

const settingsStore = {
    listSettings: jest.fn(),
    findSetting: jest.fn(),
    upsertSetting: jest.fn(),
    bulkUpsertSettings: jest.fn(),
    deleteSetting: jest.fn(),
    transformSettingRow: jest.fn((row) => row)
}

const rolesStore = {
    listRoles: jest.fn(),
    listAssignableRoles: jest.fn(),
    findRoleById: jest.fn(),
    findRoleByCodename: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    replacePermissions: jest.fn(),
    countUsersByRoleId: jest.fn(),
    listRoleUsers: jest.fn()
}

const localesStore = {
    listLocales: jest.fn(),
    findLocaleById: jest.fn(),
    findLocaleByCode: jest.fn(),
    createLocale: jest.fn(),
    updateLocale: jest.fn(),
    deleteLocale: jest.fn(),
    transformLocaleRow: jest.fn((row) => row)
}

jest.mock('../../persistence/instancesStore', () => instancesStore)
jest.mock('../../persistence/settingsStore', () => settingsStore)
jest.mock('../../persistence/rolesStore', () => rolesStore)
jest.mock('../../persistence/localesStore', () => localesStore)

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createInstancesRoutes } from '../../routes/instancesRoutes'
import { createAdminSettingsRoutes } from '../../routes/adminSettingsRoutes'
import { createRolesRoutes } from '../../routes/rolesRoutes'
import { createLocalesRoutes } from '../../routes/localesRoutes'

const buildExecutors = () => {
    const poolExec = { query: jest.fn(), transaction: jest.fn(), isReleased: jest.fn(() => false) }
    const requestExec = { query: jest.fn(), transaction: jest.fn(), isReleased: jest.fn(() => false) }
    const session = { query: jest.fn(), isReleased: jest.fn(() => false) }

    return { poolExec, requestExec, session }
}

const attachRequestContext = (app: import('express').Express, requestExec: any, session: any) => {
    app.use((req, _res, next) => {
        ;(req as any).user = { id: 'user-1' }
        ;(req as any).dbContext = {
            executor: requestExec,
            session,
            isReleased: () => false,
            query: session.query
        }
        next()
    })
}

describe('admin routes request-scoped executor usage', () => {
    beforeEach(() => {
        jest.clearAllMocks()

        instancesStore.listInstances.mockResolvedValue({ items: [], total: 0 })
        settingsStore.listSettings.mockResolvedValue([])
        rolesStore.listRoles.mockResolvedValue({ items: [], total: 0 })
        localesStore.listLocales.mockResolvedValue({ items: [], total: 0 })
    })

    it('uses request-scoped executor in instances routes', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        const app = express()
        app.use(express.json())
        attachRequestContext(app, requestExec, session)
        app.use(
            '/instances',
            createInstancesRoutes({
                globalAccessService: {} as never,
                permissionService: {} as never,
                getDbExecutor: () => poolExec as never
            })
        )

        const response = await request(app).get('/instances')

        expect(response.status).toBe(200)
        expect(instancesStore.listInstances).toHaveBeenCalledWith(requestExec, expect.any(Object))
    })

    it('uses request-scoped executor in admin settings routes', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        const app = express()
        app.use(express.json())
        attachRequestContext(app, requestExec, session)
        app.use(
            '/settings',
            createAdminSettingsRoutes({
                globalAccessService: {} as never,
                permissionService: {} as never,
                getDbExecutor: () => poolExec as never
            })
        )

        const response = await request(app).get('/settings?category=metahubs')

        expect(response.status).toBe(200)
        expect(settingsStore.listSettings).toHaveBeenCalledWith(requestExec, 'metahubs')
    })

    it('uses request-scoped executor in roles routes', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        const app = express()
        app.use(express.json())
        attachRequestContext(app, requestExec, session)
        app.use(
            '/roles',
            createRolesRoutes({
                globalAccessService: {} as never,
                permissionService: {} as never,
                getDbExecutor: () => poolExec as never
            })
        )

        const response = await request(app).get('/roles')

        expect(response.status).toBe(200)
        expect(rolesStore.listRoles).toHaveBeenCalledWith(requestExec, expect.any(Object))
    })

    it('uses request-scoped executor in locales routes', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        const app = express()
        app.use(express.json())
        attachRequestContext(app, requestExec, session)
        app.use(
            '/locales',
            createLocalesRoutes({
                globalAccessService: {} as never,
                permissionService: {} as never,
                getDbExecutor: () => poolExec as never
            })
        )

        const response = await request(app).get('/locales')

        expect(response.status).toBe(200)
        expect(localesStore.listLocales).toHaveBeenCalledWith(requestExec, expect.any(Object))
    })
})
