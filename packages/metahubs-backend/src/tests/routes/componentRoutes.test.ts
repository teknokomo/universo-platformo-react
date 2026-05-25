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
import { createEntityComponentRoutes } from '../../domains/entities/metadata/component/routes'
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

const mockComponentsService = {
    findAll: jest.fn(),
    findAllMerged: jest.fn(),
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    moveComponent: jest.fn(),
    ensureSequentialSortOrder: jest.fn(),
    update: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    findChildComponents: jest.fn(),
    reorderComponent: jest.fn(),
    reorderComponentMergedOrder: jest.fn(),
    setDisplayComponent: jest.fn(),
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

jest.mock('../../domains/metahubs/services/MetahubComponentsService', () => ({
    __esModule: true,
    MetahubComponentsService: jest.fn().mockImplementation(() => mockComponentsService)
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
        { key: 'entity.object.componentCodenameScope', value: { _value: 'per-level' } },
        {
            key: 'entity.object.allowedComponentTypes',
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
        app.use(createEntityComponentRoutes(ensureAuth, () => mockExecutor, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        resetMockCollection(mockComponentsService)
        resetMockCollection(mockObjectsService)
        resetMockCollection(mockFixedValuesService)
        resetMockCollection(mockEntityTypeService)
        resetMockCollection(mockEnumerationValuesService)
        resetMockCollection(mockSettingsService)
        mockEnsureMetahubAccess.mockResolvedValue(undefined)
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockComponentsService.findAll.mockResolvedValue([])
        mockComponentsService.findAllMerged.mockResolvedValue([])
        mockComponentsService.countByObjectId.mockResolvedValue(0)
        mockComponentsService.findById.mockResolvedValue(null)
        mockComponentsService.moveComponent.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: 'object-1',
            sortOrder: 1,
            parentComponentId: null
        })
        mockComponentsService.ensureSequentialSortOrder.mockResolvedValue(undefined)
        mockComponentsService.update.mockResolvedValue({})
        mockComponentsService.findByCodename.mockResolvedValue(null)
        mockComponentsService.create.mockResolvedValue({})
        mockComponentsService.findChildComponents.mockResolvedValue([])
        mockObjectsService.findById.mockResolvedValue({
            id: 'object-1',
            kind: 'object'
        })
        mockFixedValuesService.belongsToSet.mockResolvedValue(true)
        mockSettingsService.findByKey.mockResolvedValue(null)
        mockSettingsService.findAll.mockResolvedValue([
            { key: 'general.codenameStyle', value: { _value: 'pascal-case' } },
            { key: 'general.codenameAlphabet', value: { _value: 'en-ru' } },
            { key: 'general.codenameAllowMixedAlphabets', value: { _value: false } },
            { key: 'entity.object.componentCodenameScope', value: { _value: 'per-level' } },
            {
                key: 'entity.object.allowedComponentTypes',
                value: { _value: ['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF', 'JSON', 'TABLE'] }
            }
        ])
        mockEntityTypeService.resolveType.mockImplementation(async (_metahubId: string, kind: string) => {
            if (kind === 'enumeration') {
                return { kindKey: 'enumeration', capabilities: { dataSchema: false } }
            }

            if (kind === 'object' || kind === 'set' || kind === 'custom.invoice') {
                return { kindKey: kind, capabilities: { dataSchema: { enabled: true } } }
            }

            return null
        })
        mockComponentsService.reorderComponent.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            sortOrder: 1,
            parentComponentId: null
        })
        mockComponentsService.reorderComponentMergedOrder.mockResolvedValue({
            id: '11111111-1111-1111-1111-111111111111',
            objectId: '22222222-2222-2222-2222-222222222222',
            effectiveSortOrder: 1,
            isShared: true,
            parentComponentId: null
        })
        mockEnumerationValuesService.findById.mockResolvedValue(null)
    })

    it('GET /metahub/:metahubId/object/:objectCollectionId/components uses merged read when includeShared=true', async () => {
        mockComponentsService.findAllMerged.mockResolvedValue([
            {
                id: 'shared-attr-1',
                objectCollectionId: 'shared-object-1',
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
            .get('/metahub/metahub-1/entities/object/instance/object-1/components?includeShared=true')
            .expect(200)

        expect(response.body.items[0]).toMatchObject({ id: 'shared-attr-1', isShared: true, effectiveSortOrder: 1 })
        expect(response.body.meta).toMatchObject({ includeShared: true })
        expect(mockComponentsService.findAllMerged).toHaveBeenCalledWith('metahub-1', 'object-1', 'test-user-id', 'business')
        expect(mockComponentsService.findAll).not.toHaveBeenCalled()
    })

    describe('POST /metahub/:metahubId/object/:objectCollectionId/components', () => {
        it('returns 400 with TABLE_DISPLAY_COMPONENT_FORBIDDEN code for TABLE display component create attempt', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('TableField'),
                    dataType: 'TABLE',
                    name: { en: 'Table Field' },
                    isDisplayComponent: true
                })
                .expect(400)

            expect(response.body).toMatchObject({
                code: 'TABLE_DISPLAY_COMPONENT_FORBIDDEN'
            })
            expect(mockComponentsService.create).not.toHaveBeenCalled()
        })

        it('returns structured 409 when TABLE component object limit is reached', async () => {
            mockComponentsService.create.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 10 TABLE components per object',
                    statusCode: 409,
                    code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                    details: { maxTableAttributes: 10 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('ItemsTable'),
                    dataType: 'TABLE',
                    name: { en: 'Items' },
                    isDisplayComponent: false
                })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                maxTableAttributes: 10
            })
        })

        it('passes uiConfig.sharedBehavior through create validation when provided', async () => {
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                codename: 'Title',
                dataType: 'STRING',
                isRequired: false,
                isDisplayComponent: false,
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
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
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

            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    objectCollectionId: 'object-1',
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

        it('accepts JSON block content widget configuration for application-side authoring', async () => {
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-content',
                objectCollectionId: 'object-1',
                codename: 'ArticleContent',
                dataType: 'JSON',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {
                    widget: 'editorjsBlockContent',
                    blockEditor: {
                        allowedBlockTypes: ['paragraph', 'header'],
                        maxBlocks: 5
                    }
                },
                validationRules: {}
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('ArticleContent'),
                    dataType: 'JSON',
                    name: { en: 'Article content' },
                    uiConfig: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph', 'header'],
                            maxBlocks: 5
                        }
                    }
                })
                .expect(201)

            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    objectCollectionId: 'object-1',
                    dataType: 'JSON',
                    uiConfig: {
                        widget: 'editorjsBlockContent',
                        blockEditor: {
                            allowedBlockTypes: ['paragraph', 'header'],
                            maxBlocks: 5
                        }
                    }
                }),
                'test-user-id',
                expect.any(Object)
            )
            expect(response.body).toMatchObject({ id: 'attr-content', dataType: 'JSON' })
        })

        it('rejects JSON editor widget configuration on non-JSON components', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('ArticleContent'),
                    dataType: 'STRING',
                    name: { en: 'Article content' },
                    uiConfig: {
                        widget: 'editorjsBlockContent'
                    }
                })
                .expect(400)

            expect(response.body.error).toBe('JSON editor widgets are supported only for JSON components')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
        })

        it('accepts REF targets backed by generic entity kinds with dataSchema enabled', async () => {
            const invoiceId = '33333333-3333-4333-8333-333333333333'
            mockObjectsService.findById
                .mockResolvedValueOnce({ id: 'object-1', kind: 'object' })
                .mockResolvedValueOnce({ id: invoiceId, kind: 'custom.invoice' })
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-invoice-ref',
                objectCollectionId: 'object-1',
                codename: 'OwnerInvoice',
                dataType: 'REF',
                targetEntityId: invoiceId,
                targetEntityKind: 'custom.invoice',
                validationRules: {},
                uiConfig: {},
                isRequired: false,
                isDisplayComponent: false
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('OwnerInvoice'),
                    dataType: 'REF',
                    name: { en: 'Owner invoice' },
                    targetEntityId: invoiceId,
                    targetEntityKind: 'custom.invoice'
                })
                .expect(201)

            expect(mockEntityTypeService.resolveType).toHaveBeenCalledWith('metahub-1', 'custom.invoice', 'test-user-id')
            expect(mockComponentsService.create).toHaveBeenCalledWith(
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

        it('fails closed when schema sync fails after component creation', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockComponentsService.create.mockResolvedValueOnce({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                codename: 'Title',
                dataType: 'STRING',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {}
            })
            mockSyncMetahubSchema.mockRejectedValueOnce(new Error('sync boom'))

            const app = buildApp()
            mockExecutor.transaction.mockImplementationOnce(async (callback: (trx: unknown) => Promise<unknown>) => callback(tx as any))
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/components')
                .send({
                    codename: testCodenameVlc('title'),
                    dataType: 'STRING',
                    name: { en: 'Title' }
                })
                .expect(500)

            expect(response.body).toMatchObject({
                code: 'SCHEMA_SYNC_FAILED',
                error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
                details: { operation: 'component create' }
            })
            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    objectCollectionId: 'object-1',
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

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/components/reorder', () => {
        it('passes cross-list move settings to reorder service', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                const values: Record<string, unknown> = {
                    'entity.object.componentCodenameScope': 'per-level',
                    'general.codenameStyle': 'pascal-case',
                    'entity.object.allowAttributeMoveBetweenRootAndChildren': false,
                    'entity.object.allowAttributeMoveBetweenChildLists': false
                }

                return key in values ? { key, value: { _value: values[key] } } : null
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/components/reorder')
                .send({
                    componentId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentComponentId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(200)

            expect(mockComponentsService.reorderComponent).toHaveBeenCalledWith(
                'metahub-1',
                'object-1',
                '11111111-1111-1111-1111-111111111111',
                2,
                '33333333-3333-3333-3333-333333333333',
                'per-level',
                'pascal-case',
                true,
                true,
                undefined,
                'test-user-id'
            )
        })

        it('returns 403 when service rejects cross-list transfer by settings', async () => {
            mockComponentsService.reorderComponent.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Moving components between root and child lists is disabled by settings',
                    statusCode: 403,
                    code: 'TRANSFER_NOT_ALLOWED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/components/reorder')
                .send({
                    componentId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentComponentId: '33333333-3333-3333-3333-333333333333'
                })
                .expect(403)

            expect(response.body.code).toBe('TRANSFER_NOT_ALLOWED')
            expect(response.body.error).toContain('Moving components between root and child lists is disabled by settings')
        })

        it('returns structured 409 when TABLE child limit is reached', async () => {
            mockComponentsService.reorderComponent.mockRejectedValueOnce(
                new MetahubDomainError({
                    message: 'Maximum 3 child components per TABLE',
                    statusCode: 409,
                    code: 'TABLE_CHILD_LIMIT_REACHED',
                    details: { maxChildAttributes: 3 }
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/components/reorder')
                .send({
                    componentId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    newParentComponentId: '33333333-3333-3333-3333-333333333333'
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
                .patch('/metahub/metahub-1/entities/object/instance/object-1/components/reorder')
                .send({
                    componentId: '11111111-1111-1111-1111-111111111111',
                    newSortOrder: 2,
                    mergedOrderIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222']
                })
                .expect(200)

            expect(mockComponentsService.reorderComponentMergedOrder).toHaveBeenCalledWith(
                'metahub-1',
                'object-1',
                '11111111-1111-1111-1111-111111111111',
                ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'],
                'test-user-id'
            )
            expect(mockComponentsService.reorderComponent).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId/move', () => {
        it('moves an component only when it belongs to the routed object', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                sortOrder: 2,
                parentComponentId: null,
                isSystem: false
            })

            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/move')
                .send({ direction: 'up' })
                .expect(200)

            expect(mockComponentsService.moveComponent).toHaveBeenCalledWith('metahub-1', 'object-1', 'attr-1', 'up', 'test-user-id')
        })

        it('returns 404 when the component belongs to another object', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-foreign',
                objectCollectionId: 'object-2',
                sortOrder: 2,
                parentComponentId: null,
                isSystem: false
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-foreign/move')
                .send({ direction: 'up' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Component not found' })
            expect(mockComponentsService.moveComponent).not.toHaveBeenCalled()
        })

        it('returns 404 when a shared-pool component id is submitted through a object route', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'shared-attr-1',
                objectCollectionId: 'shared-object-pool-1',
                sortOrder: 1,
                parentComponentId: null,
                isSystem: false,
                isShared: true
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/shared-attr-1/move')
                .send({ direction: 'down' })
                .expect(404)

            expect(response.body).toMatchObject({ error: 'Component not found' })
            expect(mockComponentsService.moveComponent).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId', () => {
        it('allows guarded isEnabled updates for system components', async () => {
            const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockComponentsService.update.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
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
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(200)

            expect(response.body.system?.isEnabled).toBe(false)
            expect(mockComponentsService.update).toHaveBeenCalledWith(
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
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'app.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockComponentsService.update.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
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
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-system')
                .send({ isEnabled: false, expectedVersion: 4 })
                .expect(500)

            expect(response.body).toMatchObject({
                code: 'SCHEMA_SYNC_FAILED',
                error: 'Metahub schema synchronization failed after the change. The change was not acknowledged.',
                details: { operation: 'component update' }
            })
            expect(mockComponentsService.update).toHaveBeenCalledWith(
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

        it('rejects forbidden system-component patch fields before update', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
                codename: '_app_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayComponent: false,
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
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-system')
                .send({ isRequired: true })
                .expect(409)

            expect(response.body.code).toBe('SYSTEM_COMPONENT_PROTECTED')
            expect(response.body.error).toContain('Forbidden fields: isRequired')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns structured 409 when protected system field disable is rejected by the service', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-system',
                objectCollectionId: 'object-1',
                codename: '_upl_deleted',
                dataType: 'BOOLEAN',
                isRequired: false,
                isDisplayComponent: false,
                uiConfig: {},
                validationRules: {},
                system: {
                    isSystem: true,
                    systemKey: 'upl.deleted',
                    isManaged: true,
                    isEnabled: true
                }
            })
            mockComponentsService.update.mockRejectedValue(
                new MetahubDomainError({
                    message: 'System component upl.deleted cannot be disabled',
                    statusCode: 409,
                    code: 'SYSTEM_COMPONENT_PROTECTED'
                })
            )

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-system')
                .send({ isEnabled: false, expectedVersion: 2 })
                .expect(409)

            expect(response.body).toMatchObject({
                code: 'SYSTEM_COMPONENT_PROTECTED',
                error: 'System component upl.deleted cannot be disabled'
            })
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /metahub/:metahubId/object/:objectCollectionId/component/:componentId/toggle-required', () => {
        it('returns 400 when trying to make display component optional', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                dataType: 'STRING',
                isDisplayComponent: true,
                isRequired: true,
                uiConfig: {}
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('Display component must be required')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 for enum label mode without default value', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
                dataType: 'REF',
                targetEntityId: 'enum-1',
                targetEntityKind: 'enumeration',
                isRequired: false,
                uiConfig: { enumPresentationMode: 'label' }
            })

            const app = buildApp()
            const response = await request(app)
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('required REF label mode requires defaultEnumValueId')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 400 when default enum value does not belong to selected enumeration', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-1',
                objectCollectionId: 'object-1',
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
                .patch('/metahub/metahub-1/entities/object/instance/object-1/component/attr-1/toggle-required')
                .expect(400)

            expect(response.body.error).toBe('defaultEnumValueId must reference a value from the selected target enumeration')
            expect(mockComponentsService.update).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/object/:objectCollectionId/component/:componentId/copy', () => {
        it('copies TABLE component and child components inside a transaction', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'TABLE',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: { showTitle: true },
                validationRules: {},
                isRequired: true,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockComponentsService.findByCodename.mockResolvedValue(null)
            mockComponentsService.create
                .mockResolvedValueOnce({
                    id: 'attr-copy',
                    objectCollectionId: 'object-1',
                    codename: 'products-copy',
                    dataType: 'TABLE'
                })
                .mockResolvedValueOnce({
                    id: 'child-copy',
                    objectCollectionId: 'object-1',
                    codename: 'name',
                    dataType: 'STRING'
                })
            mockComponentsService.findChildComponents.mockResolvedValue([
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
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(201)

            expect(response.body.id).toBe('attr-copy')
            expect(response.body.copiedChildComponents).toBe(1)
            expect(mockExecutor.transaction).toHaveBeenCalledTimes(1)
            expect(mockComponentsService.findByCodename).toHaveBeenCalledWith(
                'metahub-1',
                'object-1',
                'ProductsCopy',
                null,
                'test-user-id',
                mockExecutor,
                { ignoreParentScope: false }
            )
            expect(mockComponentsService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    parentComponentId: 'attr-copy',
                    codename: 'name'
                }),
                'test-user-id',
                mockExecutor
            )
            expect(mockSyncMetahubSchema).toHaveBeenCalled()
        })

        it('returns 409 when unique codename cannot be generated', async () => {
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })
            mockComponentsService.findByCodename.mockResolvedValue({ id: 'existing' })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(409)

            expect(response.body.error).toBe('Unable to generate unique codename for component copy')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
            expect(mockSyncMetahubSchema).not.toHaveBeenCalled()
        })

        it('returns 409 when global codename lock cannot be acquired', async () => {
            mockSettingsService.findByKey.mockImplementation(async (_metahubId: string, key: string) => {
                if (key === 'entity.object.componentCodenameScope') {
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
            mockComponentsService.findById.mockResolvedValue({
                id: 'attr-source',
                objectCollectionId: 'object-1',
                codename: 'products',
                dataType: 'STRING',
                name: { _primary: 'en', locales: { en: { content: 'Products' } } },
                uiConfig: {},
                validationRules: {},
                isRequired: false,
                parentComponentId: null,
                targetEntityId: null,
                targetEntityKind: null
            })

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/entities/object/instance/object-1/component/attr-source/copy')
                .expect(409)

            expect(response.body.error).toContain('Could not acquire component codename lock')
            expect(mockComponentsService.create).not.toHaveBeenCalled()
            expect(mockReleaseAdvisoryLock).not.toHaveBeenCalled()
        })
    })
})
