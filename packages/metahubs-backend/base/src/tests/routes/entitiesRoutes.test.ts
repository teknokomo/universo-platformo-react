import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

const mockResolveUserId = jest.fn<() => string | undefined>()
const mockEnsureMetahubAccess = jest.fn()

const mockEntityTypeService = {
    listTypes: jest.fn(),
    listEditableTypes: jest.fn(),
    getTypeById: jest.fn(),
    createType: jest.fn(),
    updateType: jest.fn(),
    deleteType: jest.fn(),
    resolveTypeInSchema: jest.fn()
}

const mockActionService = {
    listByObjectId: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
}

const mockEventBindingService = {
    listByObjectId: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
}

const mockDbSession = { isReleased: () => false }

jest.mock('../../utils', () => ({
    __esModule: true,
    getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
}))

jest.mock('@universo/utils/database', () => ({
    __esModule: true,
    getRequestDbSession: () => mockDbSession
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
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

jest.mock('../../domains/entities/services/ActionService', () => ({
    __esModule: true,
    ActionService: jest.fn().mockImplementation(() => mockActionService)
}))

jest.mock('../../domains/entities/services/EventBindingService', () => ({
    __esModule: true,
    EventBindingService: jest.fn().mockImplementation(() => mockEventBindingService)
}))

import { createEntityTypesRoutes } from '../../domains/entities/routes/entityTypesRoutes'
import { createActionsRoutes } from '../../domains/entities/routes/actionsRoutes'
import { createEventBindingsRoutes } from '../../domains/entities/routes/eventBindingsRoutes'
import { MetahubConflictError } from '../../domains/shared/domainErrors'
import createError from 'http-errors'

describe('Entity ECAE routes', () => {
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
            createEntityTypesRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use(
            '/',
            createActionsRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use(
            '/',
            createEventBindingsRoutes(ensureAuth, () => mockExec as never, mockRateLimiter, mockRateLimiter)
        )
        app.use((error: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
            res.status(error.statusCode || error.status || 500).json({ error: error.message })
        })
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockResolveUserId.mockReturnValue('user-1')
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: { role: 'owner' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })

        mockEntityTypeService.listTypes.mockResolvedValue([
            {
                kindKey: 'catalog',
                ui: { nameKey: 'Catalog', iconName: 'IconBox', tabs: ['general'], sidebarSection: 'objects' },
                codename: null
            },
            {
                id: 'entity-type-1',
                kindKey: 'custom-order',
                ui: { nameKey: 'Custom Order', iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects' },
                codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
                components: {},
                published: true
            }
        ])
        mockEntityTypeService.listEditableTypes.mockResolvedValue([])
        mockEntityTypeService.getTypeById.mockResolvedValue(null)
        mockEntityTypeService.createType.mockResolvedValue({ id: 'entity-type-1', kindKey: 'custom-order' })
        mockEntityTypeService.updateType.mockResolvedValue({ id: 'entity-type-1', kindKey: 'custom-order' })
        mockEntityTypeService.deleteType.mockResolvedValue(undefined)

        mockActionService.listByObjectId.mockResolvedValue([{ id: 'action-1', objectId: 'object-1', actionType: 'builtin' }])
        mockActionService.getById.mockResolvedValue({ id: 'action-1', objectId: 'object-1', actionType: 'builtin' })
        mockActionService.create.mockResolvedValue({ id: 'action-1', objectId: 'object-1', actionType: 'builtin' })
        mockActionService.update.mockResolvedValue({ id: 'action-1', objectId: 'object-1', actionType: 'script' })
        mockActionService.delete.mockResolvedValue(undefined)

        mockEventBindingService.listByObjectId.mockResolvedValue([{ id: 'binding-1', objectId: 'object-1', eventName: 'beforeCreate' }])
        mockEventBindingService.getById.mockResolvedValue({ id: 'binding-1', objectId: 'object-1', eventName: 'beforeCreate' })
        mockEventBindingService.create.mockResolvedValue({ id: 'binding-1', objectId: 'object-1', eventName: 'beforeCreate' })
        mockEventBindingService.update.mockResolvedValue({ id: 'binding-1', objectId: 'object-1', eventName: 'afterCreate' })
        mockEventBindingService.delete.mockResolvedValue(undefined)
    })

    it('lists paginated entity types and applies search filtering', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entity-types?search=custom&limit=1&offset=0').expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.items[0].kindKey).toBe('custom-order')
        expect(response.body.items[0].published).toBe(true)
        expect(response.body.pagination).toEqual({ limit: 1, offset: 0, total: 1, hasMore: false })
        expect(mockEntityTypeService.listTypes).toHaveBeenCalledWith('metahub-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('allows metahub members to fetch entity type definitions for read-only surfaces', async () => {
        mockEnsureMetahubAccess.mockResolvedValueOnce({
            membership: { role: 'member' },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })
        mockEntityTypeService.getTypeById.mockResolvedValueOnce({
            id: 'entity-type-1',
            kindKey: 'custom-order',
            ui: { nameKey: 'Custom Order', iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects' },
            codename: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'custom-order' } } },
            components: {},
            published: true
        })

        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entity-type/entity-type-1').expect(200)

        expect(response.body.kindKey).toBe('custom-order')
        expect(mockEntityTypeService.getTypeById).toHaveBeenCalledWith('metahub-1', 'entity-type-1', 'user-1')
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', undefined, mockDbSession)
    })

    it('creates a custom entity type through the guarded route surface', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-order',
                codename: 'custom-order',
                components: { dataSchema: { enabled: true } },
                ui: { iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects', nameKey: 'Custom Order' },
                published: false
            })
            .expect(201)

        expect(response.body.id).toBe('entity-type-1')
        expect(mockEntityTypeService.createType).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ kindKey: 'custom-order', published: false }),
            'user-1'
        )
        expect(mockEnsureMetahubAccess).toHaveBeenCalledWith(mockExec, 'user-1', 'metahub-1', 'manageMetahub', mockDbSession)
    })

    it('returns 403 when a read-only metahub member attempts to create an entity type', async () => {
        mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Access denied to this metahub'))
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-order',
                codename: 'custom-order',
                components: { dataSchema: { enabled: true } },
                ui: { iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects', nameKey: 'Custom Order' }
            })
            .expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockEntityTypeService.createType).not.toHaveBeenCalled()
    })

    it('forwards custom resource surface metadata through the guarded create route', async () => {
        const app = buildApp()

        await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-knowledge',
                codename: 'custom-knowledge',
                components: {
                    dataSchema: { enabled: true },
                    records: false,
                    treeAssignment: false,
                    optionValues: false,
                    fixedValues: false,
                    hierarchy: false,
                    nestedCollections: false,
                    relations: false,
                    actions: { enabled: true },
                    events: { enabled: true },
                    scripting: false,
                    layoutConfig: false,
                    runtimeBehavior: false,
                    physicalTable: false
                },
                ui: {
                    iconName: 'IconBook',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Knowledge',
                    resourceSurfaces: [
                        {
                            key: 'attributes',
                            capability: 'dataSchema',
                            routeSegment: 'attributes',
                            fallbackTitle: 'Attributes'
                        }
                    ]
                }
            })
            .expect(201)

        expect(mockEntityTypeService.createType).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({
                ui: expect.objectContaining({
                    resourceSurfaces: [
                        expect.objectContaining({
                            key: 'attributes',
                            capability: 'dataSchema',
                            routeSegment: 'attributes',
                            fallbackTitle: 'Attributes'
                        })
                    ]
                })
            }),
            'user-1'
        )
    })

    it('rejects malformed resource surface payloads before the service layer', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-order',
                codename: 'custom-order',
                components: { dataSchema: { enabled: true } },
                ui: {
                    iconName: 'IconBolt',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Custom Order',
                    resourceSurfaces: [
                        {
                            key: '',
                            capability: 'dataSchema',
                            routeSegment: 'attributes',
                            fallbackTitle: 'Attributes'
                        }
                    ]
                }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid input')
        expect(mockEntityTypeService.createType).not.toHaveBeenCalled()
    })

    it('rejects malformed localized resource surface titles before the service layer', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-order',
                codename: 'custom-order',
                components: { dataSchema: { enabled: true } },
                ui: {
                    iconName: 'IconBolt',
                    tabs: ['general'],
                    sidebarSection: 'objects',
                    nameKey: 'Custom Order',
                    resourceSurfaces: [
                        {
                            key: 'attributes',
                            capability: 'dataSchema',
                            routeSegment: 'attributes',
                            title: {
                                _primary: 'en',
                                locales: {
                                    ru: { content: 'Атрибуты' }
                                }
                            },
                            fallbackTitle: 'Attributes'
                        }
                    ]
                }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid input')
        expect(mockEntityTypeService.createType).not.toHaveBeenCalled()
    })

    it('returns 409 when creating a custom entity type with a duplicate codename', async () => {
        mockEntityTypeService.createType.mockRejectedValueOnce(
            new MetahubConflictError('Entity type codename already exists', {
                code: 'CODENAME_CONFLICT',
                codename: 'custom-order',
                kindKey: 'custom-order'
            })
        )
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/entity-types')
            .send({
                kindKey: 'custom-order',
                codename: 'custom-order',
                components: { dataSchema: { enabled: true } },
                ui: { iconName: 'IconBolt', tabs: ['general'], sidebarSection: 'objects', nameKey: 'Custom Order' }
            })
            .expect(409)

        expect(response.body.error).toBe('Entity type codename already exists')
        expect(response.body.code).toBe('CODENAME_CONFLICT')
        expect(response.body.codename).toBe('custom-order')
    })

    it('updates a custom entity type publication flag through the guarded route surface', async () => {
        const app = buildApp()

        await request(app).patch('/metahub/metahub-1/entity-type/entity-type-1').send({ published: false, expectedVersion: 2 }).expect(200)

        expect(mockEntityTypeService.updateType).toHaveBeenCalledWith(
            'metahub-1',
            'entity-type-1',
            expect.objectContaining({ published: false, expectedVersion: 2 }),
            'user-1'
        )
    })

    it('returns 403 when a read-only metahub member attempts to update an entity type', async () => {
        mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Access denied to this metahub'))
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/entity-type/entity-type-1')
            .send({ published: false, expectedVersion: 2 })
            .expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockEntityTypeService.updateType).not.toHaveBeenCalled()
    })

    it('returns 404 when a custom entity type is missing', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/entity-type/missing').expect(404)

        expect(response.body).toEqual({ error: 'Entity type not found' })
    })

    it('returns 409 when deleting a custom entity type that still has dependent instances', async () => {
        mockEntityTypeService.deleteType.mockRejectedValueOnce(
            new MetahubConflictError('Entity type cannot be deleted while dependent entity instances still exist', {
                dependentObjects: 2,
                entityTypeId: 'entity-type-1',
                kindKey: 'custom-order'
            })
        )
        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity-type/entity-type-1').expect(409)

        expect(response.body.error).toBe('Entity type cannot be deleted while dependent entity instances still exist')
        expect(response.body.dependentObjects).toBe(2)
    })

    it('returns 403 when a read-only metahub member attempts to delete an entity type', async () => {
        mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Access denied to this metahub'))
        const app = buildApp()

        const response = await request(app).delete('/metahub/metahub-1/entity-type/entity-type-1').expect(403)

        expect(response.body.error).toBe('Access denied to this metahub')
        expect(mockEntityTypeService.deleteType).not.toHaveBeenCalled()
    })

    it('lists actions for an object', async () => {
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/object/object-1/actions').expect(200)

        expect(response.body.items).toEqual([{ id: 'action-1', objectId: 'object-1', actionType: 'builtin' }])
        expect(mockActionService.listByObjectId).toHaveBeenCalledWith('metahub-1', 'object-1', 'user-1')
    })

    it('rejects invalid action payloads before the service layer', async () => {
        const app = buildApp()

        const response = await request(app).post('/metahub/metahub-1/object/object-1/actions').send({ codename: 'run-script' }).expect(400)

        expect(response.body.error).toBe('Invalid input')
        expect(mockActionService.create).not.toHaveBeenCalled()
    })

    it('updates an action through the route controller', async () => {
        const app = buildApp()

        const response = await request(app)
            .patch('/metahub/metahub-1/action/action-1')
            .send({ actionType: 'script', scriptId: 'script-1', expectedVersion: 2 })
            .expect(200)

        expect(response.body.actionType).toBe('script')
        expect(mockActionService.update).toHaveBeenCalledWith(
            'metahub-1',
            'action-1',
            expect.objectContaining({ actionType: 'script', scriptId: 'script-1', expectedVersion: 2 }),
            'user-1'
        )
    })

    it('returns 404 when an event binding is missing', async () => {
        mockEventBindingService.getById.mockResolvedValueOnce(null)
        const app = buildApp()

        const response = await request(app).get('/metahub/metahub-1/event-binding/missing').expect(404)

        expect(response.body).toEqual({ error: 'Event binding not found' })
    })

    it('creates an event binding for an object', async () => {
        const app = buildApp()

        const response = await request(app)
            .post('/metahub/metahub-1/object/object-1/event-bindings')
            .send({ eventName: 'beforeCreate', actionId: 'action-1' })
            .expect(201)

        expect(response.body.id).toBe('binding-1')
        expect(mockEventBindingService.create).toHaveBeenCalledWith(
            'metahub-1',
            expect.objectContaining({ objectId: 'object-1', eventName: 'beforeCreate', actionId: 'action-1' }),
            'user-1'
        )
    })
})
