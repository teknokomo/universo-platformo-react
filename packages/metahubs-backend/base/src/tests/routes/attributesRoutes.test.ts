jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

const mockEnsureMetahubAccess = jest.fn(async () => undefined)
jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args),
    createEnsureMetahubRouteAccess: () => async (req: any, res: any, metahubId: string, permission?: string) => {
        const user = (req as any).user
        const userId = user?.id ?? user?.sub ?? user?.user_id ?? user?.userId
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' })
            return null
        }
        await mockEnsureMetahubAccess({}, userId, metahubId, permission)
        return userId
    }
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createAttributesRoutes } from '../../domains/attributes/routes/attributesRoutes'
import { MetahubDomainError } from '../../domains/shared/domainErrors'
import { testCodenameVlc } from '../utils/codenameTestHelpers'

const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn((value: string) => value)

const mockKnexInstance = { transaction: jest.fn() }

jest.mock('@universo/database', () => ({
    __esModule: true,
    getKnex: jest.fn(() => mockKnexInstance),
    qSchema: jest.requireActual('@universo/database').qSchema,
    qTable: jest.requireActual('@universo/database').qTable,
    qSchemaTable: jest.requireActual('@universo/database').qSchemaTable,
    qColumn: jest.requireActual('@universo/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo/database').createKnexExecutor
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    acquirePoolAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releasePoolAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args)
}))

const mockAttributesService = {
    findAll: jest.fn(),
    findAllMerged: jest.fn(),
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    moveAttribute: jest.fn(),
    ensureSequentialSortOrder: jest.fn(),
    update: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    findChildAttributes: jest.fn(),
    reorderAttribute: jest.fn(),
    reorderAttributeMergedOrder: jest.fn(),
    setDisplayAttribute: jest.fn(),
    clearDisplayAttribute: jest.fn()
}

const mockObjectsService = {
    findById: jest.fn()
}

const mockEnumerationValuesService = {
    findById: jest.fn()
}

const mockSyncMetahubSchema = jest.fn(async () => undefined)

jest.mock('../../domains/metahubs/services/schemaSync', () => ({
    __esModule: true,
    syncMetahubSchema: (...args: unknown[]) => mockSyncMetahubSchema(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubEnumerationValuesService', () => ({
    __esModule: true,
    MetahubEnumerationValuesService: jest.fn().mockImplementation(() => mockEnumerationValuesService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async () => null),
    findAll: jest.fn(async () => [
        { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
        { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
        { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
        { key: 'catalogs.attributeCodenameScope', value: { _value: 'per-level' } },
        {
            key: 'catalogs.allowedAttributeTypes',
            value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
        }
    ])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Attributes Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as unknown as { user?: { id: string } }).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (
        err: Error & { status?: number; statusCode?: number; code?: string; details?: Record<string, unknown> },
        _req: Request,
        res: Response,
        next: NextFunction
    ) => {
        if (res.headersSent) {
            return next(err)
        }
        const statusCode = err.statusCode || err.status || 500
        res.status(statusCode).json({
            error: err.message || 'Internal Server Error',
            ...(err.code ? { code: err.code } : {}),
            ...(err.details ?? {})
        })
    }

    let mockExecutor: ReturnType<typeof createMockDbExecutor>

    const buildApp = () => {
        mockExecutor = createMockDbExecutor()
        const app = express()
        app.use(express.json())
        app.use(createAttributesRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockAttributesService.findAll.mockResolvedValue([])
        mockAttributesService.findAllMerged.mockResolvedValue([])
        mockAttributesService.countByObjectId.mockResolvedValue(0)
        mockAttributesService.findById.mockResolvedValue(null)
        mockAttributesService.moveAttribute.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: 'catalog-1',
            sortOrder: 1,
            parentAttributeId: null
        })
        mockAttributesService.ensureSequentialSortOrder.mockResolvedValue(undefined)
        mockAttributesService.update.mockResolvedValue({})
        mockAttributesService.findByCodename.mockResolvedValue(null)
        mockAttributesService.create.mockResolvedValue({})
        mockAttributesService.findChildAttributes.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue({
            id: 'catalog-1',
            kind: 'catalog'
        })
        mockAttributesService.reorderAttribute.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            sortOrder: 1,
            parentAttributeId: null
        })
        mockAttributesService.reorderAttributeMergedOrder.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            effectiveSortOrder: 1,
            isShared: true,
            parentAttributeId: null
        })
        mockEnumerationValuesService.findById.mockResolvedValue(null)
    })

    it('GET /metahub/:metahubId/catalog/:catalogId/attributes uses merged read when includeShared=true', async () => {
        mockAttributesService.findAllMerged.mockResolvedValue([
            {
                id: 'shared-attr-1',
                catalogId: 'shared-catalog-1',
                codename: 'SharedTitle',
                dataType: 'STRING',
                name: { en: 'Shared Title' },
                validationRules: {},
                uiConfig: {},
                isRequired: false,
                sortOrder: 1,
                effectiveSortOrder: 1,
                isShared: true,
                isActive: true,
                isExcluded: false,
                sharedBehavior: { canDeactivate: true, canExclude: true, positionLocked: false },
                createdAt: '2026-03-04T10:00:00.000Z',
                updatedAt: '2026-03-04T10:00:00.000Z'
            }
        ])

        const app = buildApp()
        const response = await request(app).get('/metahub/metahub-1/catalog/catalog-1/attributes?includeShared=true').expect(200)

        expect(response.body.items[0]).toMatchObject({ id: 'shared-attr-1', isShared: true, effectiveSortOrder: 1 })
        expect(response.body.meta).toMatchObject({ includeShared: true })
        expect(mockAttributesService.findAllMerged).toHaveBeenCalledWith('metahub-1', 'catalog-1', 'test-user-id', 'business')
        expect(mockAttributesService.findAll).not.toHaveBeenCalled()
    })

    describe('POST /metahub/:metahubId/catalog/:catalogId/attributes', () => {
        it('returns 400 with TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN code for TABLE display attribute create attempt', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: testCodenameVlc('TableField'),
                    dataType: 'TABLE',
                    name: { en: 'Table Field' },
                    isDisplayAttribute: true
                })
                .expect(400)

            expect(response.body).toMatchObject({
                code: 'TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN'
            })
            expect(mockAttributesService.create).not.toHaveBeenCalled()
        })

        it('returns structured 409 when TABLE attribute catalog limit is reached', async () => {
            mockAttributesService.create.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 10 TABLE attributes per catalog',
                    statusCode: 409,
                    code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                    details: { maxTableAttributes: 10 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: testCodenameVlc('ItemsTable'),
                    dataType: 'TABLE',
                    name: { en: 'Items' },
                    isDisplayAttribute: false
                })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                maxTableAttributes: 10
            })
        })

        it('passes uiConfig.sharedBehavior through create validation when provided', async () => {
            mockAttributesService.create.mockResolvedValueOnce({
                id: 'attr-1',
                catalogId: 'catalog-1',
                codename: 'Title',
                dataType: 'STRING',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {
                    sharedBehavior: {
                        canDeactivate: false,
                        canExclude: true,
                        positionLocked: true
                    }
                },
                validationRules: {}
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: testCodenameVlc('title'),
                    dataType: 'STRING',
                    name: { en: 'Title' },
                    uiConfig: {
                        sharedBehavior: {
                            canDeactivate: false,
                            canExclude: true,
                            positionLocked: true
                        }
                    }
                })
                .expect(201)

            expect(mockAttributesService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    catalogId: 'catalog-1',
                    uiConfig: {
                        sharedBehavior: {
                            canDeactivate: false,
                            canExclude: true,
                            positionLocked: true
                        }
                    }
                }),
                'test-user-id',
                expect.any(Object)
            )
            expect(response.body).toMatchObject({ id: 'attr-1', codename: 'Title' })
        })

        it('fails closed when schema sync fails after attribute creation', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockAttributesService.create.mockResolvedValueOnce({
                id: 'attr-1',
                catalogId: 'catalog-1',
                codename: 'Title',
                dataType: 'STRING',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {},
                validationRules: {}
            })
            mockSyncMetahubSchema.mockRejectedValueOnce(new Error('sync boom'))

            const app = buildApp()
            mockExecutor.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx as any))
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: testCodenameVlc('title'),
                    dataType: 'STRING',
                    name: { en: 'Title' }
                })
                .expect(500)

            expect(response.body).toMatchObject({
                code: 'SCHEMA_SYNC_FAILED',
                error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
                details: { operation: 'attribute create' }
            })
            expect(mockAttributesService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    catalogId: 'catalog-1',
                    codename: expect.objectContaining({
                        _primary: 'en',
                        locales: expect.objectContaining({
                            en: expect.objectContaining({ content: 'Title' })
                        })
                    })
                }),
                'test-user-id',
                tx
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalledWith('metahub-1', tx, 'test-user-id')
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:catalogId/attributes/reorder', () => {
        it('passes cross-list move settings to reorder service', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                const values: Record<string, unknown> = {
                    'catalogs.attributeCodenameScope': 'per-level',
                    'general.codenameStyle': 'pascal-case',
                    'catalogs.allowAttributeMoveBetweenRootAndChildren': false,
                    'catalogs.allowAttributeMoveBetweenChildLists': false
                }

                return key in values ? { key, value: { _value: values[key] } } : null
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attributes/reorder')
                .send({
                    attributeId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentAttributeId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(200)

            expect(mockAttributesService.reorderAttribute).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                '11111111-1111-1111-1111-111111111111',
                2,
                '33333333-3333-3333-3333-333333333333',
                'per-level',
                'pascal-case',
                false,
                false,
                undefined,
                'test-user-id'
            )
        })

        it('returns 403 when service rejects cross-list transfer by settings', async () => {
            mockAttributesService.reorderAttribute.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Moving attributes between root and child lists is disabled by settings',
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attributes/reorder')
                .send({
                    attributeId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentAttributeId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(403)

            expect(response.body.code).toBe('TRANSFER_NOT_ALLOWED')
            expect(response.body.error).toContain('Moving attributes between root and child lists is disabled by settings')
        })

        it('returns structured 409 when TABLE child limit is reached', async () => {
            mockAttributesService.reorderAttribute.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 3 child attributes per TABLE',
                    statusCode: 409,
                    code: 'TABLE_CHILD_LIMIT_REACHED',
                    details: { maxChildAttributes: 3 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attributes/reorder')
                .send({
                    attributeId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentAttributeId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'TABLE_CHILD_LIMIT_REACHED',
                maxChildAttributes: 3
            })
        })

        it('calls merged reorder service when mergedOrderIds are provided for same-list reorder', async () => {
            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attributes/reorder')
                .send({
                    attributeId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    mergedOrderIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
                })
                .expect(200)

            expect(mockAttributesService.reorderAttributeMergedOrder).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                '11111111-1111-1111-1111-111111111111',
                ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
                'test-user-id'
            )
            expect(mockAttributesService.reorderAttribute).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/move', () => {
        it('moves an attribute only when it belongs to the routed catalog', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-1',
                catalogId: 'catalog-1',
                sortOrder: 2,
                parentAttributeId: null,
                isSystem: false
            })

            const app = buildApp()
            await request(app).patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-1/move').send({ direction: 'up' }).expect(200)

            expect(mockAttributesService.moveAttribute).toHaveBeenCalledWith('metahub-1', 'catalog-1', 'attr-1', 'up', 'test-user-id')
        })

        it('returns 404 when the attribute belongs to another catalog', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-foreign',
                catalogId: 'catalog-2',
                sortOrder: 2,
                parentAttributeId: null,
                isSystem: false
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-foreign/move')
                .send({ direction: 'up' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Attribute not found' })
            expect(mockAttributesService.moveAttribute).not.toHaveBeenCalled()
        })

        it('returns 404 when a shared-pool attribute id is submitted through a catalog route', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'shared-attr-1',
                catalogId: 'shared-catalog-pool-1',
                sortOrder: 1,
                parentAttributeId: null,
                isSystem: false,
                isShared: true
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/shared-attr-1/move')
                .send({ direction: 'down' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Attribute not found' })
            expect(mockAttributesService.moveAttribute).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId', () => {
        it('allows guarded isEnabled updates for system attributes', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockAttributesService.update.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: false
                }
            })

            const app = buildApp()
            mockExecutor.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx as any))
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(200)

            expect(response.body.system?.isEnabled).toBe(false)
            expect(mockAttributesService.update).toHaveBeenCalledWith(
                'metahub-1',
                'attr-system',
                {
                    isEnabled: false,
                    expectedVersion: 4,
                    updatedBy: 'test-user-id'
                },
                'test-user-id',
                tx
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalledWith('metahub-1', tx, 'test-user-id')
        })

        it('fails closed when schema sync fails after a guarded system update', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockAttributesService.update.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: false
                }
            })
            mockSyncMetahubSchema.mockRejectedValueOnce(new Error('sync boom'))

            const app = buildApp()
            mockExecutor.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx as any))
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(500)

            expect(response.body).toMatchObject({
                code: 'SCHEMA_SYNC_FAILED',
                error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
                details: { operation: 'attribute update' }
            })
            expect(mockAttributesService.update).toHaveBeenCalledWith(
                'metahub-1',
                'attr-system',
                {
                    isEnabled: false,
                    expectedVersion: 4,
                    updatedBy: 'test-user-id'
                },
                'test-user-id',
                tx
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalledWith('metahub-1', tx, 'test-user-id')
        })

        it('rejects forbidden system-attribute patch fields before update', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-system')
                .send({ isRequired: true })
                .expect(409)

            expect(response.body.code).toBe('SYSTEM_ATTRIBUTE_PROTECTED')
            expect(response.body.error).toContain('Forbidden fields: isRequired')
            expect(mockAttributesService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns structured 409 when protected system field disable is rejected by the service', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-system',
                catalogId: 'catalog-1',
                codename: '_upl_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayAttribute: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'upl.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockAttributesService.update.mockRejectedValue(
                new MetahubDomainError({
                    message: 'System attribute upl.deleted cannot be disabled',
                    statusCode: 409,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-system')
                .send({ isEnabled: false, expectedVersion: 2 })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'SYSTEM_ATTRIBUTE_PROTECTED',
                error: 'System attribute upl.deleted cannot be disabled'
            })
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/toggle-required', () => {
        it('returns 400 when trying to make display attribute optional', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-1',
                catalogId: 'catalog-1',
                dataType: 'STRING',
                isDisplayAttribute: true,
                isRequired: true,
                uiConfig: {}
            })

            const app = buildApp()
            const response = await request(app).patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-1/toggle-required').expect(400)

            expect(response.body.error).toBe('Display attribute must be required')
            expect(mockAttributesService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 for enum label mode without default value', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-1',
                catalogId: 'catalog-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label' }
            })

            const app = buildApp()
            const response = await request(app).patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-1/toggle-required').expect(400)

            expect(response.body.error).toBe('required REF label mode requires defaultEnumValueId')
            expect(mockAttributesService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 when default enum value does not belong to selected enumeration', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-1',
                catalogId: 'catalog-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label', defaultEnumValueId: 'value-1' }
            })
            mockEnumerationValuesService.findById.mockResolvedValue({
                id: 'value-1',
                objectId: 'enum-2'
            })

            const app = buildApp()
            const response = await request(app).patch('/metahub/metahub-1/catalog/catalog-1/attribute/attr-1/toggle-required').expect(400)

            expect(response.body.error).toBe('defaultEnumValueId must reference a value from the selected target enumeration')
            expect(mockAttributesService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/catalog/:catalogId/attribute/:attributeId/copy', () => {
        it('copies TABLE attribute and child attributes inside a transaction', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-source',
                catalogId: 'catalog-1',
                codename: 'products',
                dataType: 'TABLE',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: { showTitle: true },
                validationRules: {},
                isRequired: true,
                parentAttributeId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockAttributesService.findByCodename.mockResolvedValue(null)
            mockAttributesService.create
                .mockResolvedValueOnce({
                    id: 'attr-copy',
                    catalogId: 'catalog-1',
                    codename: 'products-copy',
                    dataType: 'TABLE'
                })
                .mockResolvedValueOnce({
                    id: 'child-copy',
                    catalogId: 'catalog-1',
                    codename: 'name',
                    dataType: 'STRING'
                })
            mockAttributesService.findChildAttributes.mockResolvedValue([
                {
                    id: 'child-1',
                    codename: 'name',
                    dataType: 'STRING',
                    name: { _primary: 'en', locales: { en: { content: 'Name' } } },
                    validationRules: {},
                    uiConfig: {},
                    isRequired: false,
                    sortOrder: 1,
                    targetEntityId: null,
                    targetEntityKind: null
                }
            ])

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/catalog/catalog-1/attribute/attr-source/copy').expect(201)

            expect(response.body.id).toBe('attr-copy')
            expect(response.body.copiedChildAttributes).toBe(1)
            expect(mockExecutor.transaction).toHaveBeenCalledTimes(1)
            expect(mockAttributesService.findByCodename).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                'ProductsCopy',
                null,
                'test-user-id',
                mockExecutor,
                { ignoreParentScope: false }
            )
            expect(mockAttributesService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    parentAttributeId: 'attr-copy',
                    codename: 'name'
                }),
                'test-user-id',
                mockExecutor
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalled()
        })

        it('returns 409 when unique codename cannot be generated', async () => {
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-source',
                catalogId: 'catalog-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentAttributeId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockAttributesService.findByCodename.mockResolvedValue({ id: 'existing' })

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/catalog/catalog-1/attribute/attr-source/copy').expect(409)

            expect(response.body.error).toBe('Unable to generate unique codename for attribute copy')
            expect(mockAttributesService.create).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 409 when global codename lock cannot be acquired', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                if (key === 'catalogs.attributeCodenameScope') {
                    return { key, value: { _value: 'global' } }
                }
                const defaults: Record<string, unknown> = {
                    'general.codenameStyle': 'pascal-case',
                    'general.codenameAlphabet': 'en-ru',
                    'general.codenameAllowMixedAlphabets': false
                }
                return key in defaults ? { key, value: { _value: defaults[key] } } : null
            })
            mockAcquireAdvisoryLock.mockResolvedValue(false)
            mockAttributesService.findById.mockResolvedValue({
                id: 'attr-source',
                catalogId: 'catalog-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentAttributeId: null,
                targetEntityId: null,
                targetEntityKind: null
            })

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/catalog/catalog-1/attribute/attr-source/copy').expect(409)

            expect(response.body.error).toContain('Could not acquire attribute codename lock')
            expect(mockAttributesService.create).not.toHaveBeenCalled()
            expect(mockReleaseAdvisoryLock).not.toHaveBeenCalled()
        })
    })
})
