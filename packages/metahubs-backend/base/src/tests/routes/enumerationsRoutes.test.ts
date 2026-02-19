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
import { createEnumerationsRoutes } from '../../domains/enumerations/routes/enumerationsRoutes'

const baseNameVlc = {
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: 'Status', version: 1, isActive: true, createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' }
    }
}
const baseDescriptionVlc = {
    _schema: '1',
    _primary: 'ru',
    locales: {
        ru: {
            content: 'Старое описание',
            version: 1,
            isActive: true,
            createdAt: '1970-01-01T00:00:00.000Z',
            updatedAt: '1970-01-01T00:00:00.000Z'
        }
    }
}

const mockObjectsService = {
    findById: jest.fn(),
    updateEnumeration: jest.fn(),
    restore: jest.fn(),
    permanentDelete: jest.fn()
}

const mockAttributesService = {
    findReferenceBlockersByTarget: jest.fn()
}

const mockValuesService = {}
const mockHubsService = {
    findByIds: jest.fn()
}

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({}))
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    __esModule: true,
    MetahubObjectsService: jest.fn().mockImplementation(() => mockObjectsService)
}))

jest.mock('../../domains/metahubs/services/MetahubAttributesService', () => ({
    __esModule: true,
    MetahubAttributesService: jest.fn().mockImplementation(() => mockAttributesService)
}))

jest.mock('../../domains/metahubs/services/MetahubEnumerationValuesService', () => ({
    __esModule: true,
    MetahubEnumerationValuesService: jest.fn().mockImplementation(() => mockValuesService)
}))

jest.mock('../../domains/metahubs/services/MetahubHubsService', () => ({
    __esModule: true,
    MetahubHubsService: jest.fn().mockImplementation(() => mockHubsService)
}))

describe('Enumerations Routes', () => {
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
        app.use(createEnumerationsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter))
        app.use(errorHandler)
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockObjectsService.findById.mockResolvedValue({
            id: 'enum-1',
            kind: 'enumeration',
            codename: 'status',
            presentation: {
                name: baseNameVlc,
                description: baseDescriptionVlc
            },
            config: {
                hubs: ['hub-1'],
                isSingleHub: false,
                isRequiredHub: false,
                sortOrder: 0
            },
            _upl_version: 1,
            _upl_created_at: new Date('2026-02-18T00:00:00.000Z').toISOString(),
            _upl_updated_at: new Date('2026-02-18T00:00:00.000Z').toISOString()
        })
        mockObjectsService.updateEnumeration.mockImplementation(async (_metahubId: string, enumerationId: string, payload: any) => ({
            id: enumerationId,
            codename: payload.codename ?? 'status',
            presentation: {
                name: payload.name ?? baseNameVlc,
                description: payload.description ?? baseDescriptionVlc
            },
            config: {
                hubs: payload.config?.hubs ?? ['hub-1'],
                isSingleHub: payload.config?.isSingleHub ?? false,
                isRequiredHub: payload.config?.isRequiredHub ?? false,
                sortOrder: payload.config?.sortOrder ?? 0
            },
            _upl_version: 2,
            _upl_created_at: new Date('2026-02-18T00:00:00.000Z').toISOString(),
            _upl_updated_at: new Date('2026-02-18T01:00:00.000Z').toISOString()
        }))
        mockObjectsService.restore.mockResolvedValue(undefined)
        mockObjectsService.permanentDelete.mockResolvedValue(undefined)
        mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([])
        mockHubsService.findByIds.mockResolvedValue([
            {
                id: 'hub-1',
                name: baseNameVlc,
                codename: 'main-hub'
            }
        ])
    })

    describe('DELETE /metahub/:metahubId/enumeration/:enumerationId/permanent', () => {
        it('returns 409 when enumeration has blocking references', async () => {
            mockAttributesService.findReferenceBlockersByTarget.mockResolvedValue([
                {
                    attributeId: 'attr-1',
                    catalogId: 'catalog-1',
                    codename: 'status'
                }
            ])

            const app = buildApp()
            const response = await request(app).delete('/metahub/metahub-1/enumeration/enum-1/permanent').expect(409)

            expect(response.body.error).toBe('Cannot delete enumeration: it is referenced by attributes')
            expect(response.body.blockingReferences).toHaveLength(1)
            expect(mockObjectsService.permanentDelete).not.toHaveBeenCalled()
        })
    })

    describe('POST /metahub/:metahubId/enumeration/:enumerationId/restore', () => {
        it('returns 409 on codename unique conflict', async () => {
            const uniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
                code: '23505',
                constraint: 'idx_mhb_objects_kind_codename_active'
            })
            mockObjectsService.restore.mockRejectedValueOnce(uniqueViolation)

            const app = buildApp()
            const response = await request(app).post('/metahub/metahub-1/enumeration/enum-1/restore').expect(409)

            expect(response.body.error).toBe('Cannot restore enumeration: codename already exists in this metahub')
            expect(mockObjectsService.restore).toHaveBeenCalledWith('metahub-1', 'enum-1', 'test-user-id')
        })
    })

    describe('PATCH /metahub/:metahubId/hub/:hubId/enumeration/:enumerationId', () => {
        it('preserves existing description primary locale when descriptionPrimaryLocale is omitted', async () => {
            const app = buildApp()
            await request(app)
                .patch('/metahub/metahub-1/hub/hub-1/enumeration/enum-1')
                .send({
                    description: {
                        ru: 'Новое описание'
                    }
                })
                .expect(200)

            expect(mockObjectsService.updateEnumeration).toHaveBeenCalled()
            const payload = mockObjectsService.updateEnumeration.mock.calls[0][2]
            expect(payload.description?._primary).toBe('ru')
        })
    })
})
