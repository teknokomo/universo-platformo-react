import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn()
const mockCopyDesignTimeObjectChildren = jest.fn()
const mockQueryMany = jest.fn(
    async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) => db.query(sql, params)
)
const mockQueryOne = jest.fn(
    async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) => {
        const rows = await db.query(sql, params)
        return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
    }
)
const mockIsUniqueViolation = jest.fn((error: unknown) => {
    if (!error || typeof error !== 'object') {
        return false
    }

    const root = error as { code?: unknown; driverError?: { code?: unknown } }
    return root.code === '23505' || root.driverError?.code === '23505'
})
const mockGetDbErrorConstraint = jest.fn((error: unknown) => {
    if (!error || typeof error !== 'object') {
        return undefined
    }

    const root = error as { constraint?: unknown; driverError?: { constraint?: unknown } }
    if (typeof root.constraint === 'string') {
        return root.constraint
    }

    return typeof root.driverError?.constraint === 'string' ? root.driverError.constraint : undefined
})

const mockObjectsService = {
    findAllByKind: jest.fn(),
    findAllByKinds: jest.fn(),
    findById: jest.fn(),
    findByCodenameAndKind: jest.fn(),
    createObject: jest.fn(),
    updateObject: jest.fn(),
    delete: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn(),
    reorderByKind: jest.fn()
}

const mockSettingsService = {
    findByKey: jest.fn()
}

const mockComponentsService = {
    countByObjectIds: jest.fn(),
    findObjectReferenceBlockers: jest.fn(),
    findReferenceBlockersByTarget: jest.fn()
}

const mockRecordsService = {
    countByObjectIds: jest.fn()
}

const mockFixedValuesService = {
    countByObjectId: jest.fn(),
    countByObjectIds: jest.fn(),
    findSetReferenceBlockers: jest.fn()
}

const mockOptionValuesService = {
    countByObjectId: jest.fn(),
    countByObjectIds: jest.fn(),
    findAll: jest.fn(),
    findAllMerged: jest.fn(),
    findById: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    moveValue: jest.fn(),
    reorderValue: jest.fn(),
    reorderValueMergedOrder: jest.fn(),
    delete: jest.fn()
}

const mockEntityTypeService = {
    listEditableTypes: jest.fn(),
    resolveType: jest.fn()
}

const mockResolver = {
    resolve: jest.fn()
}

const mockMutationService = {
    run: jest.fn()
}

const mockDbSession = { isReleased: () => false }

const readMockCodenameText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }

    if (value && typeof value === 'object') {
        const raw = value as {
            _primary?: unknown
            locales?: Record<string, { content?: unknown }>
        }
        const primaryLocale = typeof raw._primary === 'string' ? raw._primary : 'en'
        const primaryContent = raw.locales?.[primaryLocale]?.content
        if (typeof primaryContent === 'string') {
            return primaryContent
        }

        const firstContent = Object.values(raw.locales ?? {}).find((locale) => typeof locale?.content === 'string')?.content
        if (typeof firstContent === 'string') {
            return firstContent
        }
    }

    return ''
}

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession,
    queryOne: (...args: unknown[]) => mockQueryOne(...args),
    queryMany: (...args: unknown[]) => mockQueryMany(...args),
    isUniqueViolation: (...args: unknown[]) => mockIsUniqueViolation(...args),
    getDbErrorConstraint: (...args: unknown[]) => mockGetDbErrorConstraint(...args)
}))

jest.mock('../../domains/shared/routeAuth', () => ({
    __esModule: true,
    resolveUserId: (...args: unknown[]) => mockResolveUserId(...args)
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args),
    createEnsureMetahubRouteAccess:
        () =>
        async (_req: Request, res: Response, metahubId: string, permission?: string): Promise<string | null> => {
            const userId = mockResolveUserId()
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' })
                return null
            }

            await mockEnsureMetahubAccess(undefined, userId, metahubId, permission)
            return userId
        }
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

jest.mock('../../domains/metahubs/services/MetahubComponentsService', () => ({
    __esModule: true,
    MetahubComponentsService: jest.fn().mockImplementation(() => mockComponentsService)
}))

jest.mock('../../domains/metahubs/services/MetahubRecordsService', () => ({
    __esModule: true,
    MetahubRecordsService: jest.fn().mockImplementation(() => mockRecordsService)
}))

jest.mock('../../domains/metahubs/services/MetahubFixedValuesService', () => ({
    __esModule: true,
    MetahubFixedValuesService: jest.fn().mockImplementation(() => mockFixedValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubOptionValuesService', () => ({
    __esModule: true,
    MetahubOptionValuesService: jest.fn().mockImplementation(() => mockOptionValuesService)
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

jest.mock('../../domains/shared/entityTypeResolver', () => ({
    __esModule: true,
    EntityTypeResolver: jest.fn().mockImplementation(() => mockResolver)
}))

jest.mock('../../domains/entities/services/ActionService', () => ({
    __esModule: true,
    ActionService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/entities/services/EventBindingService', () => ({
    __esModule: true,
    EventBindingService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/entities/services/EntityEventRouter', () => ({
    __esModule: true,
    EntityEventRouter: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/entities/services/EntityMutationService', () => ({
    __esModule: true,
    EntityMutationService: jest.fn().mockImplementation(() => mockMutationService)
}))

jest.mock('../../domains/entities/services/designTimeObjectChildrenCopy', () => ({
    __esModule: true,
    copyDesignTimeObjectChildren: (...args: unknown[]) => mockCopyDesignTimeObjectChildren(...args)
}))

import { createEntityInstancesRoutes } from '../../domains/entities/routes/entityInstancesRoutes'

describe('Entity instance routes', () => {
    const ensureAuth = (_req: Request, _res: Response, next: NextFunction) => next()
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const mockExec = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockExec)),
        isReleased: jest.fn(() => false)
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createEntityInstancesRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use((error: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode || error.status || 500).json({ error: error.message })
        })
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        ;[
            mockExec.query,
            mockObjectsService.findAllByKind,
            mockObjectsService.findAllByKinds,
            mockObjectsService.findById,
            mockObjectsService.findByCodenameAndKind,
            mockObjectsService.createObject,
            mockObjectsService.updateObject,
            mockObjectsService.delete,
            mockObjectsService.restore,
            mockObjectsService.permanentDelete,
            mockObjectsService.reorderByKind,
            mockSettingsService.findByKey,
            mockComponentsService.countByObjectIds,
            mockComponentsService.findObjectReferenceBlockers,
            mockComponentsService.findReferenceBlockersByTarget,
            mockRecordsService.countByObjectIds,
            mockFixedValuesService.countByObjectId,
            mockFixedValuesService.countByObjectIds,
            mockFixedValuesService.findSetReferenceBlockers,
            mockOptionValuesService.countByObjectId,
            mockOptionValuesService.countByObjectIds,
            mockOptionValuesService.findAll,
            mockOptionValuesService.findAllMerged,
            mockOptionValuesService.findById,
            mockOptionValuesService.findByCodename,
            mockOptionValuesService.create,
            mockOptionValuesService.update,
            mockOptionValuesService.moveValue,
            mockOptionValuesService.reorderValue,
            mockOptionValuesService.reorderValueMergedOrder,
            mockOptionValuesService.delete,
            mockEntityTypeService.listEditableTypes,
            mockEntityTypeService.resolveType,
            mockResolver.resolve,
            mockCopyDesignTimeObjectChildren,
            mockMutationService.run
        ].forEach((mockFn) => mockFn.mockReset())
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockQueryMany.mockImplementation(
            async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) =>
                db.query(sql, params)
        )
        mockQueryOne.mockImplementation(
            async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) => {
                const rows = await db.query(sql, params)
                return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
            }
        )
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: { role: 'owner' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })

        mockExec.query.mockResolvedValue([])
        mockSettingsService.findByKey.mockResolvedValue(null)
        mockComponentsService.countByObjectIds.mockResolvedValue(new Map())
        mockComponentsService.findObjectReferenceBlockers.mockResolvedValue([])
        mockComponentsService.findReferenceBlockersByTarget.mockResolvedValue([])
        mockRecordsService.countByObjectIds.mockResolvedValue(new Map())
        mockFixedValuesService.countByObjectId.mockResolvedValue(0)
        mockFixedValuesService.countByObjectIds.mockResolvedValue(new Map())
        mockFixedValuesService.findSetReferenceBlockers.mockResolvedValue([])
        mockOptionValuesService.countByObjectId.mockResolvedValue(0)
        mockOptionValuesService.countByObjectIds.mockResolvedValue(new Map())
        mockOptionValuesService.findAll.mockResolvedValue([])
        mockOptionValuesService.findAllMerged.mockResolvedValue([])
        mockOptionValuesService.findById.mockResolvedValue(null)
        mockOptionValuesService.findByCodename.mockResolvedValue(null)
        mockOptionValuesService.create.mockResolvedValue({ id: 'value-1', objectId: 'enumeration-1', codename: 'Draft' })
        mockOptionValuesService.update.mockResolvedValue({ id: 'value-1', objectId: 'enumeration-1', codename: 'Draft' })
        mockOptionValuesService.moveValue.mockResolvedValue({ id: 'value-1', sortOrder: 2 })
        mockOptionValuesService.reorderValue.mockResolvedValue({ id: 'value-1', sortOrder: 3 })
        mockOptionValuesService.reorderValueMergedOrder.mockResolvedValue({ id: 'value-1', sortOrder: 3 })
        mockOptionValuesService.delete.mockResolvedValue(undefined)
        mockEntityTypeService.listEditableTypes.mockResolvedValue([])
        mockEntityTypeService.resolveType.mockResolvedValue(null)
        mockResolver.resolve.mockResolvedValue({ kindKey: 'custom-order', capabilities: {} })
        mockCopyDesignTimeObjectChildren.mockResolvedValue({
            componentsCopied: 0,
            recordsCopied: 0,
            fixedValuesCopied: 0,
            optionValuesCopied: 0
        })
        mockMutationService.run.mockImplementation(async ({ mutation }) => mutation(mockExec))

        mockObjectsService.findAllByKind.mockResolvedValue([
            {
                id: 'entity-1',
                kind: 'custom-order',
                codename: 'CustomOrder',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Custom order' } } },
                description: null,
                config: { enabled: true },
                _mhb_deleted: false
            }
        ])
        mockObjectsService.findAllByKinds.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Custom order' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockObjectsService.findByCodenameAndKind.mockResolvedValue(null)
        mockObjectsService.createObject.mockResolvedValue({ id: 'entity-2', kind: 'custom-order', codename: 'CustomOrder2' })
        mockObjectsService.updateObject.mockResolvedValue({ id: 'entity-1', kind: 'custom-order', codename: 'CustomOrderUpdated' })
        mockObjectsService.delete.mockResolvedValue(undefined)
        mockObjectsService.restore.mockResolvedValue(undefined)
        mockObjectsService.permanentDelete.mockResolvedValue(undefined)
        mockObjectsService.reorderByKind.mockResolvedValue({ id: 'entity-1', sort_order: 3 })
    })

    it('lists paginated custom entities', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities?kind=custom-order&limit=10&offset=0').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.items[0].id).toBe('entity-1')
        expect(mockResolver.resolve).toHaveBeenCalledWith('custom-order', { metahubId: 'metahub-1', userId: 'user-1' })
        expect(mockObjectsService.findAllByKind).toHaveBeenCalledWith('metahub-1', 'custom-order', 'user-1', {
            includeDeleted: false,
            onlyDeleted: false
        })
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('loads a custom entity through membership-only access for read-only surfaces', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entity/entity-1').expect(200)

        expect(response.body.id).toBe('entity-1')
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('allows explicit includeDeleted reads for generic entity detail lookups', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Custom order' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: true
        })
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entity/entity-1?includeDeleted=true').expect(200)

        expect(response.body.id).toBe('entity-1')
        expect(response.body._mhb_deleted).toBe(true)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1', { includeDeleted: true })
    })

    it('lists direct standard kinds on generic routes after entity promotion', async () => {
        mockResolver.resolve.mockResolvedValueOnce({ kindKey: 'object', capabilities: {}, config: {} })
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities?kind=object').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(mockObjectsService.findAllByKind).toHaveBeenCalledWith('metahub-1', 'object', 'user-1', {
            includeDeleted: false,
            onlyDeleted: false
        })
    })

    it('lists nested hubs through the entity-owned child route without tree controller dispatch', async () => {
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([])
        mockExec.query
            .mockResolvedValueOnce([
                {
                    id: 'hub-1',
                    kind: 'hub',
                    codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'ParentHub' } } },
                    presentation: { name: { en: 'Parent hub' }, description: null },
                    config: { sortOrder: 1, parentTreeEntityId: null },
                    _upl_version: 1,
                    _upl_created_at: '2026-04-15T00:00:00.000Z',
                    _upl_updated_at: '2026-04-15T00:00:00.000Z'
                }
            ])
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([
                {
                    id: 'hub-2',
                    codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'ChildHub' } } },
                    presentation: { name: { en: 'Child hub' }, description: null },
                    config: { sortOrder: 2, parentTreeEntityId: 'hub-1' },
                    _upl_version: 3,
                    _upl_created_at: '2026-04-15T01:00:00.000Z',
                    _upl_updated_at: '2026-04-15T02:00:00.000Z'
                }
            ])

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/hub/instance/hub-1/instances?limit=10&offset=0').expect(200)

        expect(response.body.items).toEqual([
            {
                id: 'hub-2',
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'ChildHub' } } },
                name: { en: 'Child hub' },
                description: null,
                sortOrder: 2,
                parentTreeEntityId: 'hub-1',
                version: 3,
                createdAt: '2026-04-15T01:00:00.000Z',
                updatedAt: '2026-04-15T02:00:00.000Z'
            }
        ])
        expect(response.body.pagination).toEqual({ total: 1, limit: 10, offset: 0 })
    })

    it('allows custom data-schema kinds on generic routes', async () => {
        mockResolver.resolve.mockResolvedValueOnce({ kindKey: 'custom.invoice', capabilities: {}, config: {} })
        mockObjectsService.findAllByKind.mockResolvedValueOnce([
            {
                id: 'invoice-1',
                kind: 'custom.invoice',
                codename: 'CustomerInvoice',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Customer invoice' } } },
                description: null,
                config: { enabled: true },
                _mhb_deleted: false
            }
        ])
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities?kind=custom.invoice').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.items[0]).toMatchObject({ id: 'invoice-1', kind: 'custom.invoice' })
        expect(mockObjectsService.findAllByKind).toHaveBeenCalledWith('metahub-1', 'custom.invoice', 'user-1', {
            includeDeleted: false,
            onlyDeleted: false
        })
    })

    it('lists enumeration values through the entity-owned nested route surface', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'enumeration-1',
            kind: 'enumeration',
            codename: 'Status',
            presentation: { name: { en: 'Status' }, description: null },
            config: { hubs: ['hub-1'] },
            _mhb_deleted: false
        })
        mockOptionValuesService.findAll.mockResolvedValueOnce([
            { id: 'value-1', objectId: 'enumeration-1', codename: 'Draft' },
            { id: 'value-2', objectId: 'enumeration-1', codename: 'Published' }
        ])

        const app = buildApp()

        const response = await request(app)
            .get('/metahub/metahub-1/entities/enumeration/instance/hub-1/instance/enumeration-1/values')
            .expect(200)

        expect(response.body.items).toHaveLength(2)
        expect(response.body.total).toBe(2)
        expect(response.body.meta).toEqual({ includeShared: false })
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'enumeration-1', 'user-1')
        expect(mockOptionValuesService.findAll).toHaveBeenCalledWith('metahub-1', 'enumeration-1', 'user-1')
    })

    it('loads a nested set through the entity-owned route surface', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'set-1',
            kind: 'set',
            codename: 'Statuses',
            presentation: { name: { en: 'Statuses' }, description: null },
            config: { hubs: ['hub-1'], sortOrder: 4, isSingleHub: false, isRequiredHub: false },
            _upl_version: 2,
            _upl_created_at: '2026-04-15T01:00:00.000Z',
            _upl_updated_at: '2026-04-15T02:00:00.000Z',
            _mhb_deleted: false
        })
        mockFixedValuesService.countByObjectId.mockResolvedValueOnce(3)

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/set/instance/hub-1/instance/set-1').expect(200)

        expect(response.body.id).toBe('set-1')
        expect(response.body.fixedValuesCount).toBe(3)
        expect(response.body.sortOrder).toBe(4)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'set-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('loads a nested object through the entity-owned route surface', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'object-1',
            kind: 'object',
            codename: 'Products',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Products' } } },
            description: null,
            config: { hubs: ['hub-1'], sortOrder: 7, isSingleHub: false, isRequiredHub: true },
            _upl_version: 3,
            created_at: '2026-04-15T03:00:00.000Z',
            updated_at: '2026-04-15T04:00:00.000Z',
            _mhb_deleted: false
        })
        mockComponentsService.countByObjectIds.mockResolvedValueOnce(new Map([['object-1', 2]]))
        mockRecordsService.countByObjectIds.mockResolvedValueOnce(new Map([['object-1', 5]]))

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/object/instance/hub-1/instance/object-1').expect(200)

        expect(response.body.id).toBe('object-1')
        expect(response.body.componentsCount).toBe(2)
        expect(response.body.recordsCount).toBe(5)
        expect(response.body.sortOrder).toBe(7)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'object-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('creates a custom entity through the generic route surface', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'custom-order',
                codename: 'CustomOrder',
                name: { en: 'Custom order' },
                namePrimaryLocale: 'en',
                config: { enabled: true }
            })
            .expect(201)

        const createMutationInput = mockMutationService.run.mock.calls[0][0]

        expect(response.body.id).toBe('entity-2')
        expect(mockMutationService.run).toHaveBeenCalledWith(
            expect.objectContaining({
                beforeEvent: 'beforeCreate',
                afterEvent: 'afterCreate',
                afterEventObjectId: expect.any(Function),
                actionExecutor: expect.any(Function)
            })
        )
        expect(mockObjectsService.createObject).toHaveBeenCalledWith(
            'metahub-1',
            'custom-order',
            expect.objectContaining({ id: createMutationInput.objectId, config: { enabled: true } }),
            'user-1',
            mockExec
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'createContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('rejects invalid Page block content before persisting the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {
                blockContent: { enabled: true }
            }
        })

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'page',
                codename: 'LandingPage',
                name: { en: 'Landing page' },
                namePrimaryLocale: 'en',
                config: {
                    blockContent: {
                        format: 'editorjs',
                        blocks: [{ id: 'unsafe-html', type: 'html', data: { html: '<script />' } }]
                    }
                }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid page block content')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects Page block content that violates Entity-specific block constraints', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {
                blockContent: {
                    enabled: true,
                    storage: 'objectConfig',
                    defaultFormat: 'editorjs',
                    supportedFormats: ['editorjs'],
                    allowedBlockTypes: ['paragraph'],
                    maxBlocks: 1
                }
            }
        })

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'page',
                codename: 'LandingPage',
                name: { en: 'Landing page' },
                namePrimaryLocale: 'en',
                config: {
                    blockContent: {
                        format: 'editorjs',
                        blocks: [{ id: 'title', type: 'header', data: { text: 'Title', level: 2 } }]
                    }
                }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid page block content')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('normalizes Editor.js list 2.x output before persisting Page block content', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {
                blockContent: { enabled: true }
            }
        })

        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'page',
                codename: 'LandingPage',
                name: { en: 'Landing page' },
                namePrimaryLocale: 'en',
                config: {
                    blockContent: {
                        time: 1,
                        version: '2.31.6',
                        blocks: [
                            {
                                id: 'list-1',
                                type: 'list',
                                data: {
                                    style: 'unordered',
                                    items: [
                                        { content: 'First item', meta: {}, items: [] },
                                        { content: 'Second item', meta: {}, items: [] }
                                    ]
                                }
                            }
                        ]
                    }
                }
            })
            .expect(201)

        expect(mockObjectsService.createObject).toHaveBeenCalledWith(
            'metahub-1',
            'page',
            expect.objectContaining({
                config: {
                    blockContent: {
                        format: 'editorjs',
                        data: {
                            time: 1,
                            version: '2.31.6',
                            blocks: [
                                {
                                    id: 'list-1',
                                    type: 'list',
                                    data: {
                                        style: 'unordered',
                                        items: ['First item', 'Second item']
                                    }
                                }
                            ]
                        }
                    }
                }
            }),
            'user-1',
            mockExec
        )
    })

    it('rejects inline HTML in Page block content before persisting the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {
                blockContent: { enabled: true }
            }
        })

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'page',
                codename: 'LandingPage',
                name: { en: 'Landing page' },
                namePrimaryLocale: 'en',
                config: {
                    blockContent: {
                        format: 'editorjs',
                        blocks: [{ id: 'paragraph-1', type: 'paragraph', data: { text: '<b>Unsafe</b>' } }]
                    }
                }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid page block content')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('updates a custom entity via the mutation service', async () => {
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/entity/entity-1')
            .send({ name: { en: 'Updated order' }, namePrimaryLocale: 'en', expectedVersion: 2 })
            .expect(200)

        expect(response.body.codename).toBe('CustomOrderUpdated')
        expect(mockMutationService.run).toHaveBeenCalledWith(
            expect.objectContaining({
                objectId: 'entity-1',
                beforeEvent: 'beforeUpdate',
                afterEvent: 'afterUpdate',
                actionExecutor: expect.any(Function)
            })
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.updateObject).toHaveBeenCalledWith(
            'metahub-1',
            'entity-1',
            'custom-order',
            expect.objectContaining({ expectedVersion: 2, updatedBy: 'user-1' }),
            'user-1',
            mockExec
        )
    })

    it('deletes a custom entity via the mutation service', async () => {
        const app = buildApp()

        await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(204)

        expect(mockMutationService.run).toHaveBeenCalledWith(
            expect.objectContaining({
                objectId: 'entity-1',
                beforeEvent: 'beforeDelete',
                afterEvent: 'afterDelete',
                actionExecutor: expect.any(Function)
            })
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.delete).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1', mockExec)
    })

    it('returns 403 when metahub access check fails for generic delete routes', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Custom order' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom-order',
            capabilities: {},
            config: {}
        })
        mockEnsureMetahubAccess.mockRejectedValueOnce(Object.assign(new Error('Access denied to this metahub'), { statusCode: 403 }))

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('copies a custom entity via the mutation service', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Custom order' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(201)

        expect(response.body.id).toBe('entity-2')
        expect(mockMutationService.run).toHaveBeenCalledWith(
            expect.objectContaining({ objectId: 'entity-1', mode: 'copy', actionExecutor: expect.any(Function) })
        )
        expect(mockObjectsService.createObject).toHaveBeenCalledWith(
            'metahub-1',
            'custom-order',
            expect.objectContaining({ config: { enabled: true } }),
            'user-1',
            mockExec
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockCopyDesignTimeObjectChildren).not.toHaveBeenCalled()
    })

    it('retries copy after codename unique violation and succeeds', async () => {
        const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
            constraint: 'idx_mhb_objects_kind_codename_active'
        })
        const occupiedCodenames = new Set(['CustomOrder'])

        mockObjectsService.findByCodenameAndKind.mockReset()
        mockObjectsService.createObject.mockReset()
        mockMutationService.run.mockReset()
        mockMutationService.run.mockImplementation(async ({ mutation }) => mutation(mockExec))

        mockObjectsService.findByCodenameAndKind.mockImplementation(async (_metahubId: string, codename: string) =>
            occupiedCodenames.has(codename) ? { id: `occupied-${codename}` } : null
        )
        mockObjectsService.createObject.mockImplementationOnce(async (_metahubId: string, _kind: string, input: { codename?: unknown }) => {
            occupiedCodenames.add(readMockCodenameText(input.codename))
            throw uniqueViolation
        })
        mockObjectsService.createObject.mockResolvedValueOnce({ id: 'entity-3', kind: 'custom-order', codename: 'CustomOrder3' })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(201)

        expect(response.body.id).toBe('entity-3')
        expect(mockObjectsService.createObject).toHaveBeenCalledTimes(2)
        expect(mockObjectsService.findByCodenameAndKind).toHaveBeenCalledWith('metahub-1', 'CustomOrder2', 'custom-order', 'user-1')
        expect(mockObjectsService.findByCodenameAndKind).toHaveBeenCalledWith('metahub-1', 'CustomOrder3', 'custom-order', 'user-1')
    })

    it('returns 409 after exhausting generated codename retries for copy', async () => {
        const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
            code: '23505',
            constraint: 'idx_mhb_objects_kind_codename_active'
        })
        const occupiedCodenames = new Set(['CustomOrder'])

        mockObjectsService.findByCodenameAndKind.mockReset()
        mockObjectsService.createObject.mockReset()
        mockMutationService.run.mockReset()
        mockMutationService.run.mockImplementation(async ({ mutation }) => mutation(mockExec))

        mockObjectsService.findByCodenameAndKind.mockImplementation(async (_metahubId: string, codename: string) =>
            occupiedCodenames.has(codename) ? { id: `occupied-${codename}` } : null
        )
        mockObjectsService.createObject.mockImplementation(async (_metahubId: string, _kind: string, input: { codename?: unknown }) => {
            const codename = readMockCodenameText(input.codename)
            occupiedCodenames.add(codename)
            throw uniqueViolation
        })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(409)

        expect(response.body.error).toBe('Unable to generate a unique codename for the copied entity')
        expect(mockObjectsService.createObject).toHaveBeenCalledTimes(999)
    })

    it('copies enabled design-time children for custom entity kinds', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom-order',
            capabilities: {
                dataSchema: { enabled: true },
                records: { enabled: true },
                fixedValues: { enabled: true },
                optionValues: { enabled: true }
            }
        })

        const app = buildApp()

        await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(201)

        expect(mockEnsureSchema).toHaveBeenCalledWith('metahub-1', 'user-1')
        expect(mockCopyDesignTimeObjectChildren).toHaveBeenCalledWith(
            expect.objectContaining({
                metahubId: 'metahub-1',
                sourceObjectId: 'entity-1',
                targetObjectId: 'entity-2',
                schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                copyComponents: true,
                copyRecords: true,
                copyFixedValues: true,
                copyOptionValues: true,
                codenameStyle: 'pascal-case',
                codenameAlphabet: 'en-ru'
            })
        )
    })

    it('allows object-style copy options to suppress design-time child copying for custom entities', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom-order',
            capabilities: {
                dataSchema: { enabled: true },
                records: { enabled: true },
                fixedValues: false,
                optionValues: false
            }
        })

        const app = buildApp()

        await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({ copyComponents: false, copyRecords: false }).expect(201)

        expect(mockCopyDesignTimeObjectChildren).not.toHaveBeenCalled()
    })

    it('rejects copyRecords=true when copyComponents=false for custom entity copies', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity/entity-1/copy')
            .send({ copyComponents: false, copyRecords: true })
            .expect(400)

        expect(response.body.error).toBe('Invalid input')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
        expect(mockCopyDesignTimeObjectChildren).not.toHaveBeenCalled()
    })

    it('restores a deleted custom entity via restore mode', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            _mhb_deleted: true
        })
        const app = buildApp()

        await request(app).post('/metahub/metahub-1/entity/entity-1/restore').expect(204)

        expect(mockMutationService.run).toHaveBeenCalledWith(expect.objectContaining({ objectId: 'entity-1', mode: 'restore' }))
        expect(mockObjectsService.restore).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1', mockExec)
    })

    it('reorders entities within a custom kind', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities/reorder')
            .send({ kind: 'custom-order', entityId: '11111111-1111-4111-8111-111111111111', newSortOrder: 3 })
            .expect(200)

        expect(response.body.sort_order).toBe(3)
        expect(mockObjectsService.reorderByKind).toHaveBeenCalledWith(
            'metahub-1',
            'custom-order',
            '11111111-1111-4111-8111-111111111111',
            3,
            'user-1'
        )
    })

    it('permanently deletes a deleted custom entity without the mutation layer', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            _mhb_deleted: true
        })
        const app = buildApp()

        await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(204)

        expect(mockObjectsService.permanentDelete).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockMutationService.run).not.toHaveBeenCalledWith(expect.objectContaining({ objectId: 'entity-1', mode: 'seed' }))
    })

    it('rejects permanent delete when the custom entity is not in trash', async () => {
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom-order',
            codename: 'CustomOrder',
            _mhb_deleted: false
        })
        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(400)

        expect(response.body.error).toBe('Entity is not deleted')
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('uses createContent for object entity creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {}
        })
        mockObjectsService.createObject.mockResolvedValueOnce({
            id: 'entity-2',
            kind: 'object',
            codename: 'Object'
        })

        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'object',
                codename: 'Object',
                name: { en: 'Object' },
                namePrimaryLocale: 'en'
            })
            .expect(201)

        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'createContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('uses createContent for set-compatible creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'set',
            capabilities: {}
        })
        mockObjectsService.createObject.mockResolvedValueOnce({
            id: 'entity-2',
            kind: 'set',
            codename: 'Set'
        })

        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'set',
                codename: 'Set',
                name: { en: 'Set' },
                namePrimaryLocale: 'en'
            })
            .expect(201)

        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'createContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('returns 403 when metahub access check fails for object entity creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {}
        })
        mockEnsureMetahubAccess.mockRejectedValueOnce(Object.assign(new Error('Access denied to this metahub'), { statusCode: 403 }))

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'object',
                codename: 'Object',
                name: { en: 'Object' },
                namePrimaryLocale: 'en'
            })
            .expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects object entity copies when entity.object.allowCopy is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'object',
            codename: 'Object',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Object' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.object.allowCopy') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(403)

        expect(response.body.error).toBe('Copying objects is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects set-compatible copies when entity.set.allowCopy is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'set',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'set',
            codename: 'Set',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Set' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.set.allowCopy') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(403)

        expect(response.body.error).toBe('Copying sets is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects Page copies when entity.page.allowCopy is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'page',
            codename: 'Page',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Page' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.page.allowCopy') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(403)

        expect(response.body.error).toBe('Copying pages is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('blocks object entity deletes when other objects reference the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'object',
            codename: 'Object',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Object' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockComponentsService.findObjectReferenceBlockers.mockResolvedValueOnce([
            {
                sourceObjectCollectionId: 'object-2',
                sourceObjectCodename: 'source-object',
                componentId: 'component-1',
                componentCodename: 'linked-component'
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(409)

        expect(response.body.error).toBe('Cannot delete object: it is referenced by components in other objects')
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('blocks set-compatible deletes when blocking constant references exist', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'set',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'set',
            codename: 'Set',
            _mhb_deleted: false
        })
        mockFixedValuesService.findSetReferenceBlockers.mockResolvedValueOnce([
            {
                sourceObjectCollectionId: 'object-2',
                sourceObjectCodename: 'ProductsCatalog',
                componentId: 'attr-1',
                componentCodename: 'OwnerRef'
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(409)

        expect(response.body.error).toBe('Cannot delete set because there are blocking references')
        expect(response.body.code).toBe('SET_DELETE_BLOCKED_BY_REFERENCES')
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('blocks hub-compatible deletes when required relations or child hubs would become orphaned', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'hub',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'hub',
            codename: 'Hub',
            _mhb_deleted: false
        })
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([
            {
                kindKey: 'hub'
            }
        ])
        mockExec.query.mockResolvedValueOnce([
            {
                id: 'child-hub-1',
                codename: 'ChildHub',
                presentation: { name: { en: 'Child hub' } }
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(409)

        expect(response.body.error).toBe('Cannot delete hub: required objects would become orphaned')
        expect(response.body.totalBlocking).toBe(1)
        expect(response.body.blockingChildTreeEntities).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('blocks hub deletes when a required hub-assignable page would become orphaned', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'hub',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'hub',
            codename: 'Hub',
            _mhb_deleted: false
        })
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([
            {
                kindKey: 'hub',
                capabilities: {}
            },
            {
                kindKey: 'page',
                codename: 'Page',
                capabilities: {
                    treeAssignment: { enabled: true }
                },
                presentation: {
                    name: { _primary: 'en', locales: { en: { content: 'Pages' } } }
                },
                ui: {
                    nameKey: 'metahubs:pages.title'
                }
            }
        ])
        mockExec.query.mockResolvedValueOnce([
            {
                id: 'page-1',
                kind: 'page',
                codename: 'WelcomePage',
                presentation: { name: { en: 'Welcome Page' } }
            }
        ])
        mockExec.query.mockResolvedValueOnce([])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(409)

        expect(response.body.error).toBe('Cannot delete hub: required objects would become orphaned')
        expect(response.body.totalBlocking).toBe(1)
        expect(response.body.blockingRelatedObjects).toEqual([
            expect.objectContaining({
                id: 'page-1',
                kind: 'page',
                typeNameKey: 'metahubs:pages.title'
            })
        ])
        expect(response.body.blockingChildTreeEntities).toEqual([])
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('returns hub blocking dependencies through the behavior-based entity endpoint', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'hub',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'hub',
            codename: 'Hub',
            _mhb_deleted: false
        })
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([
            {
                kindKey: 'hub'
            }
        ])
        mockExec.query.mockResolvedValueOnce([
            {
                id: 'child-hub-1',
                codename: 'ChildHub',
                presentation: { name: { en: 'Child hub' } }
            }
        ])

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/hub/instance/entity-1/blocking-dependencies').expect(200)

        expect(response.body.treeEntityId).toBe('entity-1')
        expect(response.body.totalBlocking).toBe(1)
        expect(response.body.canDelete).toBe(false)
        expect(response.body.blockingChildTreeEntities).toHaveLength(1)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('returns object blocking references through the behavior-based entity endpoint', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {},
            config: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'object',
            codename: 'Object',
            _mhb_deleted: false
        })
        mockComponentsService.findObjectReferenceBlockers.mockResolvedValueOnce([
            {
                sourceObjectCollectionId: 'object-2',
                sourceObjectCodename: 'ProductsCatalog',
                componentId: 'attr-1',
                componentCodename: 'OwnerRef'
            }
        ])

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/object/instance/entity-1/blocking-references').expect(200)

        expect(response.body.objectCollectionId).toBe('entity-1')
        expect(response.body.canDelete).toBe(false)
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('returns set blocking references through the behavior-based entity endpoint', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'set',
            capabilities: {},
            config: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'set',
            codename: 'Set',
            _mhb_deleted: false
        })
        mockFixedValuesService.findSetReferenceBlockers.mockResolvedValueOnce([
            {
                sourceObjectCollectionId: 'object-2',
                sourceObjectCodename: 'ProductsCatalog',
                componentId: 'attr-1',
                componentCodename: 'OwnerRef'
            }
        ])

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/set/instance/entity-1/blocking-references').expect(200)

        expect(response.body.valueGroupId).toBe('entity-1')
        expect(response.body.canDelete).toBe(false)
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('returns enumeration blocking references through the behavior-based entity endpoint', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'enumeration',
            capabilities: {},
            config: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'enumeration',
            codename: 'Enumeration',
            _mhb_deleted: false
        })
        mockComponentsService.findReferenceBlockersByTarget.mockResolvedValueOnce([
            {
                sourceObjectCollectionId: 'object-2',
                sourceObjectCodename: 'ProductsCatalog',
                componentId: 'attr-1',
                componentCodename: 'OwnerRef'
            }
        ])

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/enumeration/instance/entity-1/blocking-references').expect(200)

        expect(response.body.optionListId).toBe('entity-1')
        expect(response.body.canDelete).toBe(false)
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockObjectsService.findById).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('rejects hub blocking-references requests on the generic behavior-based endpoint', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities/hub/instance/entity-1/blocking-references').expect(404)

        expect(response.body.error).toBe('Entity not found')
        expect(mockResolver.resolve).not.toHaveBeenCalledWith('hub', { metahubId: 'metahub-1', userId: 'user-1' })
    })

    it('removes hub relations before deleting hub-compatible custom entities', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'hub',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'hub',
            codename: 'Hub',
            _mhb_deleted: false
        })
        mockEntityTypeService.listEditableTypes.mockResolvedValueOnce([
            {
                kindKey: 'hub'
            }
        ])
        mockExec.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])

        const app = buildApp()

        await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(204)

        expect(mockExec.transaction).toHaveBeenCalledTimes(1)
        expect(mockMutationService.run).toHaveBeenCalledWith(
            expect.objectContaining({
                objectId: 'entity-1',
                beforeEvent: 'beforeDelete',
                afterEvent: 'afterDelete'
            })
        )
        expect(mockObjectsService.delete).toHaveBeenCalledWith('metahub-1', 'entity-1', 'user-1', mockExec)
    })

    it('blocks enumeration-compatible permanent delete when components still reference the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'enumeration',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'enumeration',
            codename: 'Enumeration',
            _mhb_deleted: true
        })
        mockComponentsService.findReferenceBlockersByTarget.mockResolvedValueOnce([
            {
                componentId: 'attr-1',
                objectCollectionId: 'object-1',
                codename: 'status'
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(409)

        expect(response.body.error).toBe('Cannot delete enumeration: it is referenced by components')
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('rejects object entity permanent delete when entity.object.allowDelete is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'object',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'object',
            codename: 'Object',
            _mhb_deleted: true
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.object.allowDelete') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(403)

        expect(response.body.error).toBe('Deleting objects is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('rejects enumeration-compatible permanent delete when entity.enumeration.allowDelete is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'enumeration',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'enumeration',
            codename: 'Enumeration',
            _mhb_deleted: true
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.enumeration.allowDelete') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(403)

        expect(response.body.error).toBe('Deleting enumerations is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('rejects Page permanent delete when entity.page.allowDelete is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'page',
            capabilities: {}
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'page',
            codename: 'Page',
            _mhb_deleted: true
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'entity.page.allowDelete') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(403)

        expect(response.body.error).toBe('Deleting pages is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })
})
