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

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: jest.fn(() => ({
            transaction: mockKnexTransaction
        }))
    }
}))

const mockAttributesService = {
    findById: jest.fn(),
    update: jest.fn(),
    findByCodename: jest.fn(),
    create: jest.fn(),
    findChildAttributes: jest.fn()
}

const mockObjectsService = {}

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
        mockAttributesService.findById.mockResolvedValue(null)
        mockAttributesService.update.mockResolvedValue({})
        mockAttributesService.findByCodename.mockResolvedValue(null)
        mockAttributesService.create.mockResolvedValue({})
        mockAttributesService.findChildAttributes.mockResolvedValue([])
        mockEnumerationValuesService.findById.mockResolvedValue(null)
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
                'products-copy',
                null,
                'test-user-id',
                mockTrx
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
    })
})
