jest.mock(
    'typeorm',
    () => {
        const decorator = () => () => {}
        return {
            __esModule: true,
            Entity: decorator,
            PrimaryGeneratedColumn: decorator,
            PrimaryColumn: decorator,
            Column: decorator,
            CreateDateColumn: decorator,
            UpdateDateColumn: decorator,
            VersionColumn: decorator,
            ManyToOne: decorator,
            OneToMany: decorator,
            OneToOne: decorator,
            ManyToMany: decorator,
            JoinTable: decorator,
            JoinColumn: decorator,
            Index: decorator,
            Unique: decorator,
            In: jest.fn((value) => value)
        }
    },
    { virtual: true }
)

jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuserByDataSource: jest.fn(async () => false),
    getGlobalRoleCodenameByDataSource: jest.fn(async () => null),
    hasSubjectPermissionByDataSource: jest.fn(async () => false)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDataSource } from '../utils/typeormMocks'
import { createAttributesRoutes } from '../../domains/attributes/routes/attributesRoutes'

const mockTrx = { __trx: true }
const mockKnexTransaction = jest.fn(async (cb: (trx: unknown) => Promise<unknown>) => cb(mockTrx))
const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn((value: string) => value)

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: jest.fn(() => ({
            transaction: mockKnexTransaction
        }))
    },
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args)
}))

const mockAttributesService = {
    countByObjectId: jest.fn(),
    findById: jest.fn(),
    ensureSequentialSortOrder: jest.fn(),
    update: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    findChildAttributes: jest.fn(),
    reorderAttribute: jest.fn()
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

    const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
        if (res.headersSent) {
            return next(err)
        }
        res.status(500).json({ error: err.message || 'Internal Server Error' })
    }

    const buildApp = () => {
        const dataSource = createMockDataSource({})
        const app = express()
        app.use(express.json())
        app.use(createAttributesRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockKnexTransaction.mockImplementation(async (cb: (trx: unknown) => Promise<unknown>) => cb(mockTrx))
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockAttributesService.countByObjectId.mockResolvedValue(0)
        mockAttributesService.findById.mockResolvedValue(null)
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
        mockEnumerationValuesService.findById.mockResolvedValue(null)
    })

    describe('POST /metahub/:metahubId/catalog/:catalogId/attributes', () => {
        it('returns 400 with TABLE_DISPLAY_ATTRIBUTE_FORBIDDEN code for TABLE display attribute create attempt', async () => {
            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: 'TableField',
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
            const tableLimitError = Object.assign(new Error('TABLE_ATTRIBUTE_LIMIT_REACHED: Maximum 10 TABLE attributes per catalog'), {
                code: 'TABLE_ATTRIBUTE_LIMIT_REACHED',
                maxTableAttributes: 10
            })
            mockAttributesService.create.mockRejectedValueOnce(tableLimitError)

            const app = buildApp()
            const response = await request(app)
                .post('/metahub/metahub-1/catalog/catalog-1/attributes')
                .send({
                    codename: 'ItemsTable',
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
                new Error('TRANSFER_NOT_ALLOWED: Moving attributes between root and child lists is disabled by settings')
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
            expect(response.body.message).toContain('TRANSFER_NOT_ALLOWED')
        })

        it('returns structured 409 when TABLE child limit is reached', async () => {
            const limitError = Object.assign(new Error('TABLE_CHILD_LIMIT_REACHED: Maximum 3 child attributes per TABLE'), {
                code: 'TABLE_CHILD_LIMIT_REACHED',
                maxChildAttributes: 3
            })
            mockAttributesService.reorderAttribute.mockRejectedValueOnce(limitError)

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
            expect(mockKnexTransaction).toHaveBeenCalledTimes(1)
            expect(mockAttributesService.findByCodename).toHaveBeenCalledWith(
                'metahub-1',
                'catalog-1',
                'ProductsCopy',
                null,
                'test-user-id',
                mockTrx,
                { ignoreParentScope: false }
            )
            expect(mockAttributesService.create).toHaveBeenCalledWith(
                'metahub-1',
                expect.objectContaining({
                    parentAttributeId: 'attr-copy',
                    codename: 'name'
                }),
                'test-user-id',
                mockTrx
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
