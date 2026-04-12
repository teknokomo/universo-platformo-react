import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()
const mockEnsureSchema = jest.fn()
const mockCopyDesignTimeObjectChildren = jest.fn()
const mockQueryMany = jest.fn(async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) =>
    db.query(sql, params)
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

const mockAttributesService = {
    findCatalogReferenceBlockers: jest.fn(),
    findReferenceBlockersByTarget: jest.fn()
}

const mockConstantsService = {
    countByObjectId: jest.fn(),
    countByObjectIds: jest.fn(),
    findSetReferenceBlockers: jest.fn()
}

const mockEntityTypeService = {
    listCustomTypes: jest.fn(),
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
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
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

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubConstantsService', () => ({
    __esModule: true,
    MetahubConstantsService: jest.fn().mockImplementation(() => mockConstantsService)
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
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureSchema.mockResolvedValue('mhb_a1b2c3d4e5f67890abcdef1234567890_b1')
        mockQueryMany.mockImplementation(
            async (db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> }, sql: string, params?: unknown[]) =>
                db.query(sql, params)
        )
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: { role: 'owner' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })

        mockExec.query.mockResolvedValue([])
        mockSettingsService.findByKey.mockResolvedValue(null)
        mockAttributesService.findCatalogReferenceBlockers.mockResolvedValue([])
        mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([])
        mockConstantsService.countByObjectId.mockResolvedValue(0)
        mockConstantsService.countByObjectIds.mockResolvedValue(new Map())
        mockConstantsService.findSetReferenceBlockers.mockResolvedValue([])
        mockEntityTypeService.listCustomTypes.mockResolvedValue([])
        mockEntityTypeService.resolveType.mockResolvedValue(null)
        mockResolver.resolve.mockResolvedValue({ kindKey: 'custom-order', source: 'custom', components: {} })
        mockCopyDesignTimeObjectChildren.mockResolvedValue({
            attributesCopied: 0,
            elementsCopied: 0,
            constantsCopied: 0,
            valuesCopied: 0
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

    it('rejects built-in kinds on generic routes', async () => {
        mockResolver.resolve.mockResolvedValueOnce({ kindKey: 'catalog', source: 'builtin', components: {} })
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entities?kind=catalog').expect(400)

        expect(response.body.error).toBe('Generic entity routes currently support custom entity kinds only')
        expect(mockObjectsService.findAllByKind).not.toHaveBeenCalled()
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
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
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
            source: 'custom',
            components: {},
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
            source: 'custom',
            components: {
                dataSchema: { enabled: true },
                predefinedElements: { enabled: true },
                constants: { enabled: true },
                enumerationValues: { enabled: true }
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
                copyAttributes: true,
                copyElements: true,
                copyConstants: true,
                copyEnumerationValues: true,
                codenameStyle: 'pascal-case',
                codenameAlphabet: 'en-ru'
            })
        )
    })

    it('allows catalog-style copy options to suppress design-time child copying for custom entities', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom-order',
            source: 'custom',
            components: {
                dataSchema: { enabled: true },
                predefinedElements: { enabled: true },
                constants: false,
                enumerationValues: false
            }
        })

        const app = buildApp()

        await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({ copyAttributes: false, copyElements: false }).expect(201)

        expect(mockCopyDesignTimeObjectChildren).not.toHaveBeenCalled()
    })

    it('rejects copyElements=true when copyAttributes=false for custom entity copies', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity/entity-1/copy')
            .send({ copyAttributes: false, copyElements: true })
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

    it('uses editContent parity for catalog-compatible creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.catalog-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'catalog'
                }
            }
        })
        mockObjectsService.createObject.mockResolvedValueOnce({
            id: 'entity-2',
            kind: 'custom.catalog-v2',
            codename: 'CatalogV2'
        })

        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'custom.catalog-v2',
                codename: 'CatalogV2',
                name: { en: 'Catalogs V2' },
                namePrimaryLocale: 'en'
            })
            .expect(201)

        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('uses editContent parity for set-compatible creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.set-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'set'
                }
            }
        })
        mockObjectsService.createObject.mockResolvedValueOnce({
            id: 'entity-2',
            kind: 'custom.set-v2',
            codename: 'SetV2'
        })

        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'custom.set-v2',
                codename: 'SetV2',
                name: { en: 'Sets V2' },
                namePrimaryLocale: 'en'
            })
            .expect(201)

        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('returns 403 when metahub access check fails for catalog-compatible creates on the generic route surface', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.catalog-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'catalog'
                }
            }
        })
        mockEnsureMetahubAccess.mockRejectedValueOnce(Object.assign(new Error('Access denied to this metahub'), { statusCode: 403 }))

        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entities')
            .send({
                kind: 'custom.catalog-v2',
                codename: 'CatalogV2',
                name: { en: 'Catalogs V2' },
                namePrimaryLocale: 'en'
            })
            .expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects catalog-compatible copies when catalogs.allowCopy is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.catalog-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'catalog'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.catalog-v2',
            codename: 'CatalogV2',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Catalogs V2' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'catalogs.allowCopy') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/entity/entity-1/copy').send({}).expect(403)

        expect(response.body.error).toBe('Copying catalogs is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'editContent', mockDbSession)
        expect(mockObjectsService.createObject).not.toHaveBeenCalled()
    })

    it('rejects set-compatible copies when sets.allowCopy is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.set-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'set'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.set-v2',
            codename: 'SetV2',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Sets V2' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'sets.allowCopy') {
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

    it('blocks catalog-compatible deletes when other catalogs reference the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.catalog-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'catalog'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.catalog-v2',
            codename: 'CatalogV2',
            name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Catalogs V2' } } },
            description: null,
            config: { enabled: true },
            _mhb_deleted: false
        })
        mockAttributesService.findCatalogReferenceBlockers.mockResolvedValueOnce([
            {
                sourceCatalogId: 'catalog-2',
                sourceCatalogCodename: 'source-catalog',
                attributeId: 'attribute-1',
                attributeCodename: 'linked-attribute'
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1').expect(409)

        expect(response.body.error).toBe('Cannot delete catalog: it is referenced by attributes in other catalogs')
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('blocks set-compatible deletes when blocking constant references exist', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.set-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'set'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.set-v2',
            codename: 'SetV2',
            _mhb_deleted: false
        })
        mockConstantsService.findSetReferenceBlockers.mockResolvedValueOnce([
            {
                sourceCatalogId: 'catalog-2',
                sourceCatalogCodename: 'ProductsCatalog',
                attributeId: 'attr-1',
                attributeCodename: 'OwnerRef'
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
            kindKey: 'custom.hub-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'hub'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.hub-v2',
            codename: 'HubV2',
            _mhb_deleted: false
        })
        mockEntityTypeService.listCustomTypes.mockResolvedValueOnce([
            {
                kindKey: 'custom.hub-v2',
                config: { compatibility: { legacyObjectKind: 'hub' } }
            }
        ])
        mockExec.query
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
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
        expect(response.body.blockingChildHubs).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.delete).not.toHaveBeenCalled()
    })

    it('removes hub relations before deleting hub-compatible custom entities', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.hub-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'hub'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.hub-v2',
            codename: 'HubV2',
            _mhb_deleted: false
        })
        mockEntityTypeService.listCustomTypes.mockResolvedValueOnce([
            {
                kindKey: 'custom.hub-v2',
                config: { compatibility: { legacyObjectKind: 'hub' } }
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

    it('blocks enumeration-compatible permanent delete when attributes still reference the entity', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.enumeration-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'enumeration'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.enumeration-v2',
            codename: 'EnumerationV2',
            _mhb_deleted: true
        })
        mockAttributesService.findReferenceBlockersByTarget.mockResolvedValueOnce([
            {
                attributeId: 'attr-1',
                catalogId: 'catalog-1',
                codename: 'status'
            }
        ])

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(409)

        expect(response.body.error).toBe('Cannot delete enumeration: it is referenced by attributes')
        expect(response.body.blockingReferences).toHaveLength(1)
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockEnsureMetahubAccess).not.toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('rejects catalog-compatible permanent delete when catalogs.allowDelete is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.catalog-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'catalog'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.catalog-v2',
            codename: 'CatalogV2',
            _mhb_deleted: true
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'catalogs.allowDelete') {
                return { key, value: { _value: false } }
            }
            return null
        })

        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity/entity-1/permanent').expect(403)

        expect(response.body.error).toBe('Deleting catalogs is disabled in metahub settings')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'deleteContent', mockDbSession)
        expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
    })

    it('rejects enumeration-compatible permanent delete when enumerations.allowDelete is disabled', async () => {
        mockResolver.resolve.mockResolvedValueOnce({
            kindKey: 'custom.enumeration-v2',
            source: 'custom',
            components: {},
            config: {
                compatibility: {
                    legacyObjectKind: 'enumeration'
                }
            }
        })
        mockObjectsService.findById.mockResolvedValueOnce({
            id: 'entity-1',
            kind: 'custom.enumeration-v2',
            codename: 'EnumerationV2',
            _mhb_deleted: true
        })
        mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
            if (key === 'enumerations.allowDelete') {
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
})
