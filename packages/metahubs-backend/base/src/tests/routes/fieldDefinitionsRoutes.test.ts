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
import { createEntityFieldDefinitionRoutes } from '../../domains/entities/metadata/fieldDefinition/routes'
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

const mockFieldDefinitionsService = {
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

const mockFixedValuesService = {
    belongsToSet: jest.fn()
}

const mockEntityTypeService = {
    resolveType: jest.fn()
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

jest.mock('../../domains/metahubs/services/MetahubFieldDefinitionsService', () => ({
    __esModule: true,
    MetahubFieldDefinitionsService: jest.fn().mockImplementation(() => mockFieldDefinitionsService)
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubOptionValuesService', () => ({
    __esModule: true,
    MetahubOptionValuesService: jest.fn().mockImplementation(() => mockEnumerationValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubFixedValuesService', () => ({
    __esModule: true,
    MetahubFixedValuesService: jest.fn().mockImplementation(() => mockFixedValuesService)
}))

jest.mock('../../domains/entities/services/EntityTypeService', () => ({
    __esModule: true,
    EntityTypeService: jest.fn().mockImplementation(() => mockEntityTypeService)
}))

const mockSettingsService = {
    findByKey: jest.fn(async () => null),
    findAll: jest.fn(async () => [
        { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
        { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
        { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
        { key: 'entity.catalog.attributeCodenameScope', value: { _value: 'per-level' } },
        {
            key: 'entity.catalog.allowedAttributeTypes',
            value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
        }
    ])
}

jest.mock('../../domains/settings/services/MetahubSettingsService', () => ({
    __esModule: true,
    MetahubSettingsService: jest.fn().mockImplementation(() => mockSettingsService)
}))

describe('Field Definition Routes', () => {
    const resetMockCollection = (collection: Record<string, jest.Mock>) => {
        Object.values(collection).forEach((mockFn) => mockFn.mockReset())
    }

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
        app.use(createEntityFieldDefinitionRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        resetMockCollection(mockFieldDefinitionsService)
        resetMockCollection(mockObjectsService)
        resetMockCollection(mockFixedValuesService)
        resetMockCollection(mockEntityTypeService)
        resetMockCollection(mockEnumerationValuesService)
        resetMockCollection(mockSettingsService)
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockFieldDefinitionsService.findAll.mockResolvedValue([])
        mockFieldDefinitionsService.findAllMerged.mockResolvedValue([])
        mockFieldDefinitionsService.countByObjectId.mockResolvedValue(0)
        mockFieldDefinitionsService.findById.mockResolvedValue(null)
        mockFieldDefinitionsService.moveAttribute.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: 'catalog-1',
            sortOrder: 1,
            parentAttributeId: null
        })
        mockFieldDefinitionsService.ensureSequentialSortOrder.mockResolvedValue(undefined)
        mockFieldDefinitionsService.update.mockResolvedValue({})
        mockFieldDefinitionsService.findByCodename.mockResolvedValue(null)
        mockFieldDefinitionsService.create.mockResolvedValue({})
        mockFieldDefinitionsService.findChildAttributes.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue({
            id: 'catalog-1',
            kind: 'catalog'
        })
        mockFixedValuesService.belongsToSet.mockResolvedValue(true)
        mockSettingsService.findByKey.mockResolvedValue(null)
        mockSettingsService.findAll.mockResolvedValue([
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'entity.catalog.attributeCodenameScope', value: { _value: 'per-level' } },
            {
                key: 'entity.catalog.allowedAttributeTypes',
                value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
            }
        ])
        mockEntityTypeService.resolveType.mockImplementation(async (_metahubId: string, kind: string) => {
            if (kind === 'enumeration') {
                return { kindKey: 'enumeration', components: { dataSchema: false } }
            }

            if (kind === 'catalog' || kind === 'set' || kind === 'custom.invoice') {
                return { kindKey: kind, components: { dataSchema: { enabled: true } } }
            }

            return null
        })
        mockFieldDefinitionsService.reorderAttribute.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            sortOrder: 1,
            parentAttributeId: null
        })
        mockFieldDefinitionsService.reorderAttributeMergedOrder.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            effectiveSortOrder: 1,
            isShared: true,
            parentAttributeId: null
        })
        mockEnumerationValuesService.findById.mockResolvedValue(null)
    })

    it('GET /metahub/:metahubId/catalog/:linkedCollectionId/field-definitions uses merged read when includeShared=true', async () => {
        mockFieldDefinitionsService.findAllMerged.mockResolvedValue([
            {
                id: 'shared-attr-1',
                linkedCollectionId: 'shared-catalog-1',
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
        const response = await request(app)
            .get('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions?includeShared=true')
            .expect(200)

        expect(response.body.items[0]).toMatchObject({ id: 'shared-attr-1', isShared: true, effectiveSortOrder: 1 })
        expect(response.body.meta).toMatchObject({ includeShared: true })
        expect(mockFieldDefinitionsService.findAllMerged).toHaveBeenCalledWith('metahub-1', 'catalog-1', 'test-user-id', 'business')
        expect(mockFieldDefinitionsService.findAll).not.toHaveBeenCalled()
    })

    describe('POST /metahub/:metahubId/catalog/:linkedCollectionId/field-definitions', () => {
        it('returns 400 with TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN code for TABLE display attribute create attempt', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
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
            expect(mockFieldDefinitionsService.create).not.toHaveBeenCalled()
        })

        it('returns structured 409 when TABLE attribute catalog limit is reached', async () => {
            mockFieldDefinitionsService.create.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 10 TABLE attributes per catalog',
                    statusCode: 409,
                    code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                    details: { maxTableAttributes: 10 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
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
            mockFieldDefinitionsService.create.mockResolvedValueOnce({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
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
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
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

            expect(mockFieldDefinitionsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    linkedCollectionId: 'catalog-1',
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

        it('accepts REF targets backed by generic entity kinds with dataSchema enabled', async () => {
            const invoiceId = '33333333-3333-4333-8333-333333333333'
            mockObjectsService.findById
                .mockResolvedValueOnce({ id: 'catalog-1', kind: 'catalog' })
                .mockResolvedValueOnce({ id: invoiceId, kind: 'custom.invoice' })
            mockFieldDefinitionsService.create.mockResolvedValueOnce({
                id: 'attr-invoice-ref',
                linkedCollectionId: 'catalog-1',
                codename: 'OwnerInvoice',
                dataType: 'REF',
                targetEntityId: invoiceId,
                targetEntityKind: 'custom.invoice',
                validationRules: {},
                uiConfig: {},
                isRequired: false,
                isDisplayAttribute: false
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
                .send({
                    codename: testCodenameVlc('OwnerInvoice'),
                    dataType: 'REF',
                    name: { en: 'Owner invoice' },
                    targetEntityId: invoiceId,
                    targetEntityKind: 'custom.invoice'
                })
                .expect(201)

            expect(mockEntityTypeService.resolveType).toHaveBeenCalledWith('metahub-1', 'custom.invoice', 'test-user-id')
            expect(mockFieldDefinitionsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    targetEntityId: invoiceId,
                    targetEntityKind: 'custom.invoice'
                }),
                'test-user-id',
                expect.any(Object)
            )
            expect(response.body).toMatchObject({ id: 'attr-invoice-ref', targetEntityKind: 'custom.invoice' })
        })

        it('fails closed when schema sync fails after attribute creation', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockFieldDefinitionsService.create.mockResolvedValueOnce({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
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
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions')
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
            expect(mockFieldDefinitionsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    linkedCollectionId: 'catalog-1',
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

    describe('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/field-definitions/reorder', () => {
        it('passes cross-list move settings to reorder service', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                const values: Record<string, unknown> = {
                    'entity.catalog.attributeCodenameScope': 'per-level',
                    'general.codenameStyle': 'pascal-case',
                    'entity.catalog.allowAttributeMoveBetweenRootAndChildren': false,
                    'entity.catalog.allowAttributeMoveBetweenChildLists': false
                }

                return key in values ? { key, value: { _value: values[key] } } : null
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions/reorder')
                .send({
                    fieldDefinitionId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentAttributeId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(200)

            expect(mockFieldDefinitionsService.reorderAttribute).toHaveBeenCalledWith(
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
            mockFieldDefinitionsService.reorderAttribute.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Moving attributes between root and child lists is disabled by settings',
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions/reorder')
                .send({
                    fieldDefinitionId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentAttributeId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(403)

            expect(response.body.code).toBe('TRANSFER_NOT_ALLOWED')
            expect(response.body.error).toContain('Moving attributes between root and child lists is disabled by settings')
        })

        it('returns structured 409 when TABLE child limit is reached', async () => {
            mockFieldDefinitionsService.reorderAttribute.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 3 child attributes per TABLE',
                    statusCode: 409,
                    code: 'TABLE_CHILD_LIMIT_REACHED',
                    details: { maxChildAttributes: 3 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions/reorder')
                .send({
                    fieldDefinitionId: '11111111-1111-1111-1111-111111111111',
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
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definitions/reorder')
                .send({
                    fieldDefinitionId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    mergedOrderIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
                })
                .expect(200)

            expect(mockFieldDefinitionsService.reorderAttributeMergedOrder).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                '11111111-1111-1111-1111-111111111111',
                ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
                'test-user-id'
            )
            expect(mockFieldDefinitionsService.reorderAttribute).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/field-definition/:fieldDefinitionId/move', () => {
        it('moves an attribute only when it belongs to the routed catalog', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
                sortOrder: 2,
                parentAttributeId: null,
                isSystem: false
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-1/move')
                .send({ direction: 'up' })
                .expect(200)

            expect(mockFieldDefinitionsService.moveAttribute).toHaveBeenCalledWith('metahub-1', 'catalog-1', 'attr-1', 'up', 'test-user-id')
        })

        it('returns 404 when the attribute belongs to another catalog', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-foreign',
                linkedCollectionId: 'catalog-2',
                sortOrder: 2,
                parentAttributeId: null,
                isSystem: false
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-foreign/move')
                .send({ direction: 'up' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Attribute not found' })
            expect(mockFieldDefinitionsService.moveAttribute).not.toHaveBeenCalled()
        })

        it('returns 404 when a shared-pool attribute id is submitted through a catalog route', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'shared-attr-1',
                linkedCollectionId: 'shared-catalog-pool-1',
                sortOrder: 1,
                parentAttributeId: null,
                isSystem: false,
                isShared: true
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/shared-attr-1/move')
                .send({ direction: 'down' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Attribute not found' })
            expect(mockFieldDefinitionsService.moveAttribute).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/field-definition/:fieldDefinitionId', () => {
        it('allows guarded isEnabled updates for system attributes', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
            mockFieldDefinitionsService.update.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(200)

            expect(response.body.system?.isEnabled).toBe(false)
            expect(mockFieldDefinitionsService.update).toHaveBeenCalledWith(
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
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
            mockFieldDefinitionsService.update.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(500)

            expect(response.body).toMatchObject({
                code: 'SCHEMA_SYNC_FAILED',
                error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
                details: { operation: 'attribute update' }
            })
            expect(mockFieldDefinitionsService.update).toHaveBeenCalledWith(
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
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-system')
                .send({ isRequired: true })
                .expect(409)

            expect(response.body.code).toBe('SYSTEM_ATTRIBUTE_PROTECTED')
            expect(response.body.error).toContain('Forbidden fields: isRequired')
            expect(mockFieldDefinitionsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns structured 409 when protected system field disable is rejected by the service', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-system',
                linkedCollectionId: 'catalog-1',
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
            mockFieldDefinitionsService.update.mockRejectedValue(
                new MetahubDomainError({
                    message: 'System attribute upl.deleted cannot be disabled',
                    statusCode: 409,
                    code: 'SYSTEM_ATTRIBUTE_PROTECTED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-system')
                .send({ isEnabled: false, expectedVersion: 2 })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'SYSTEM_ATTRIBUTE_PROTECTED',
                error: 'System attribute upl.deleted cannot be disabled'
            })
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/catalog/:linkedCollectionId/field-definition/:fieldDefinitionId/toggle-required', () => {
        it('returns 400 when trying to make display attribute optional', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
                dataType: 'STRING',
                isDisplayAttribute: true,
                isRequired: true,
                uiConfig: {}
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('Display attribute must be required')
            expect(mockFieldDefinitionsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 for enum label mode without default value', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label' }
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('required REF label mode requires defaultEnumValueId')
            expect(mockFieldDefinitionsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 when default enum value does not belong to selected enumeration', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-1',
                linkedCollectionId: 'catalog-1',
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
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('defaultEnumValueId must reference a value from the selected target enumeration')
            expect(mockFieldDefinitionsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/catalog/:linkedCollectionId/field-definition/:fieldDefinitionId/copy', () => {
        it('copies TABLE attribute and child attributes inside a transaction', async () => {
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-source',
                linkedCollectionId: 'catalog-1',
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
            mockFieldDefinitionsService.findByCodename.mockResolvedValue(null)
            mockFieldDefinitionsService.create
                .mockResolvedValueOnce({
                    id: 'attr-copy',
                    linkedCollectionId: 'catalog-1',
                    codename: 'products-copy',
                    dataType: 'TABLE'
                })
                .mockResolvedValueOnce({
                    id: 'child-copy',
                    linkedCollectionId: 'catalog-1',
                    codename: 'name',
                    dataType: 'STRING'
                })
            mockFieldDefinitionsService.findChildAttributes.mockResolvedValue([
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
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-source/copy')
                .expect(201)

            expect(response.body.id).toBe('attr-copy')
            expect(response.body.copiedChildAttributes).toBe(1)
            expect(mockExecutor.transaction).toHaveBeenCalledTimes(1)
            expect(mockFieldDefinitionsService.findByCodename).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                'ProductsCopy',
                null,
                'test-user-id',
                mockExecutor,
                { ignoreParentScope: false }
            )
            expect(mockFieldDefinitionsService.create).toHaveBeenCalledWith(
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
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-source',
                linkedCollectionId: 'catalog-1',
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
            mockFieldDefinitionsService.findByCodename.mockResolvedValue({ id: 'existing' })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-source/copy')
                .expect(409)

            expect(response.body.error).toBe('Unable to generate unique codename for field definition copy')
            expect(mockFieldDefinitionsService.create).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 409 when global codename lock cannot be acquired', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                if (key === 'entity.catalog.attributeCodenameScope') {
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
            mockFieldDefinitionsService.findById.mockResolvedValue({
                id: 'attr-source',
                linkedCollectionId: 'catalog-1',
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
            const response = await request(app)
                .post('/metahub/metahub-1/entities/catalog/instance/catalog-1/field-definition/attr-source/copy')
                .expect(409)

            expect(response.body.error).toContain('Could not acquire attribute codename lock')
            expect(mockFieldDefinitionsService.create).not.toHaveBeenCalled()
            expect(mockReleaseAdvisoryLock).not.toHaveBeenCalled()
        })
    })
})
