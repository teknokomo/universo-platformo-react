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
    const localizedValue = {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: 'Editor',
                version: 1,
                isActive: true,
                createdAt: '2026-03-18T00:00:00.000Z',
                updatedAt: '2026-03-18T00:00:00.000Z'
            }
        }
    }

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

    it('validates and persists platform system-attribute toggle batches through the request executor', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        settingsStore.bulkUpsertSettings.mockResolvedValue([
            { category: 'metahubs', key: 'platformSystemAttributesConfigurable', value: { _value: true } },
            { category: 'metahubs', key: 'platformSystemAttributesRequired', value: { _value: true } },
            { category: 'metahubs', key: 'platformSystemAttributesIgnoreMetahubSettings', value: { _value: false } }
        ])

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

        const response = await request(app)
            .put('/settings/metahubs')
            .send({
                values: {
                    platformSystemAttributesConfigurable: true,
                    platformSystemAttributesRequired: true,
                    platformSystemAttributesIgnoreMetahubSettings: false
                }
            })

        expect(response.status).toBe(200)
        expect(settingsStore.bulkUpsertSettings).toHaveBeenCalledWith(requestExec, 'metahubs', [
            ['platformSystemAttributesConfigurable', true],
            ['platformSystemAttributesRequired', true],
            ['platformSystemAttributesIgnoreMetahubSettings', false]
        ])
    })

    it('rejects unknown metahubs platform-toggle keys before persistence', async () => {
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

        const response = await request(app)
            .put('/settings/metahubs')
            .send({
                values: {
                    platformSystemAttributesUnknown: true
                }
            })

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Unknown metahubs setting key: platformSystemAttributesUnknown')
        expect(settingsStore.bulkUpsertSettings).not.toHaveBeenCalled()
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

    it('returns 409 when role creation races on codename uniqueness', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        rolesStore.findRoleByCodename.mockResolvedValue(null)
        rolesStore.createRole.mockRejectedValue({ code: '23505' })
        requestExec.transaction.mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => fn(requestExec))

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

        const response = await request(app).post('/roles').send({
            codename: 'editor-copy',
            name: localizedValue,
            description: localizedValue,
            color: '#111111',
            isSuperuser: false,
            permissions: []
        })

        expect(response.status).toBe(409)
        expect(response.body.error).toContain('editor-copy')
    })

    it('returns 409 when role copy hits a concurrent codename conflict after validation', async () => {
        const { poolExec, requestExec, session } = buildExecutors()
        const sourceRoleId = '00000000-0000-4000-a000-000000000001'
        rolesStore.findRoleById.mockResolvedValue({
            id: sourceRoleId,
            codename: 'editor',
            name: localizedValue,
            description: localizedValue,
            color: '#111111',
            is_superuser: false,
            is_system: false,
            permissions: []
        })
        rolesStore.findRoleByCodename.mockResolvedValue(null)
        requestExec.transaction.mockRejectedValue({ code: '23505' })

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

        const response = await request(app).post(`/roles/${sourceRoleId}/copy`).send({
            codename: 'editor-copy',
            name: localizedValue,
            description: localizedValue,
            color: '#111111',
            copyPermissions: true
        })

        expect(response.status).toBe(409)
        expect(response.body.error).toContain('editor-copy')
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
