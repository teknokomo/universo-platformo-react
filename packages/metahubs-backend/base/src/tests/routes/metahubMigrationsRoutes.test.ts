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

const mockEnsureMetahubAccess = jest.fn(async () => ({ membership: { role: 'owner' } }))
jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: unknown[]) => mockEnsureMetahubAccess(...args)
}))

const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn(() => 12345)
const mockEnsureSchema = jest.fn(async () => 'mock_schema')
const mockSeedMigrate = jest.fn(async () => ({
    layoutsAdded: 0,
    zoneWidgetsAdded: 0,
    settingsAdded: 0,
    entitiesAdded: 0,
    attributesAdded: 0,
    elementsAdded: 0,
    skipped: []
}))
const mockCleanupAnalyze = jest.fn(async (params: { mode: string }) => ({
    mode: params.mode,
    hasChanges: false,
    blockers: [],
    notes: [],
    summary: { entitiesDeleted: 0, attributesDeleted: 0, elementsDeleted: 0, settingsDeleted: 0 }
}))
const mockCleanupApply = jest.fn(async (params: { mode: string }) => ({
    mode: params.mode,
    hasChanges: false,
    blockers: [],
    notes: [],
    summary: { entitiesDeleted: 0, attributesDeleted: 0, elementsDeleted: 0, settingsDeleted: 0 }
}))

const mockHasTable = jest.fn(async () => true)
const mockMigrationRows = jest.fn(async () => [])
const mockMigrationCount = jest.fn(async () => ({ count: '0' }))

const migrationsQueryBuilder = {
    count: jest.fn().mockReturnThis(),
    first: jest.fn(() => mockMigrationCount()),
    select: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn(() => mockMigrationRows())
}

const mockKnex = {
    schema: {
        withSchema: jest.fn(() => ({
            hasTable: (...args: unknown[]) => mockHasTable(...args)
        }))
    },
    withSchema: jest.fn(() => ({
        from: jest.fn(() => migrationsQueryBuilder)
    }))
}

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: () => mockKnex
    },
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args),
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args)
}))

jest.mock('../../domains/templates/services/TemplateSeedCleanupService', () => ({
    __esModule: true,
    TEMPLATE_CLEANUP_MODES: ['keep', 'dry_run', 'confirm'],
    TemplateSeedCleanupService: jest.fn().mockImplementation(() => ({
        analyze: (...args: unknown[]) => mockCleanupAnalyze(...args),
        apply: (...args: unknown[]) => mockCleanupApply(...args)
    }))
}))

jest.mock('../../domains/templates/services/TemplateSeedMigrator', () => ({
    __esModule: true,
    TemplateSeedMigrator: jest.fn().mockImplementation(() => ({
        migrateSeed: (...args: unknown[]) => mockSeedMigrate(...args)
    }))
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    __esModule: true,
    MetahubSchemaService: jest.fn().mockImplementation(() => ({
        ensureSchema: (...args: unknown[]) => mockEnsureSchema(...args)
    }))
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDataSource, createMockRepository } from '../utils/typeormMocks'
import { createMetahubMigrationsRoutes } from '../../domains/metahubs/routes/metahubMigrationsRoutes'
import { basicTemplate } from '../../domains/templates/data/basic.template'

describe('Metahub Migrations Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
        if (res.headersSent) return _next(err)
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    const buildApp = (dataSource: any) => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createMetahubMigrationsRoutes(ensureAuth, () => dataSource, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
    }

    const setupDataSource = () => {
        const metahubRepo = createMockRepository<any>()
        const branchRepo = createMockRepository<any>()
        const metahubUserRepo = createMockRepository<any>()
        const templateRepo = createMockRepository<any>()
        const templateVersionRepo = createMockRepository<any>()

        const dataSource = createMockDataSource({
            Metahub: metahubRepo,
            MetahubBranch: branchRepo,
            MetahubUser: metahubUserRepo,
            Template: templateRepo,
            TemplateVersion: templateVersionRepo
        })

        return {
            dataSource,
            metahubRepo,
            branchRepo,
            metahubUserRepo,
            templateRepo,
            templateVersionRepo
        }
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockReturnValue(12345)
        mockEnsureSchema.mockResolvedValue('mock_schema')
        mockSeedMigrate.mockResolvedValue({
            layoutsAdded: 0,
            zoneWidgetsAdded: 0,
            settingsAdded: 0,
            entitiesAdded: 0,
            attributesAdded: 0,
            elementsAdded: 0,
            skipped: []
        })
        mockCleanupAnalyze.mockImplementation(async (params: { mode: string }) => ({
            mode: params.mode,
            hasChanges: false,
            blockers: [],
            notes: [],
            summary: { entitiesDeleted: 0, attributesDeleted: 0, elementsDeleted: 0, settingsDeleted: 0 }
        }))
        mockCleanupApply.mockImplementation(async (params: { mode: string }) => ({
            mode: params.mode,
            hasChanges: false,
            blockers: [],
            notes: [],
            summary: { entitiesDeleted: 0, attributesDeleted: 0, elementsDeleted: 0, settingsDeleted: 0 }
        }))
    })

    it('returns migration list and safely handles invalid JSON meta payloads', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-1'
        const branchId = 'branch-1'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b1',
            structureVersion: 1
        })

        mockHasTable.mockResolvedValue(true)
        mockMigrationCount.mockResolvedValue({ count: '1' })
        mockMigrationRows.mockResolvedValue([
            {
                id: 'mig-1',
                name: 'baseline_structure_v1',
                applied_at: new Date('2026-02-11T09:43:05.944Z'),
                from_version: 1,
                to_version: 1,
                meta: '{invalid-json'
            }
        ])

        const app = buildApp(dataSource)
        const response = await request(app).get(`/metahub/${metahubId}/migrations`).expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.items[0]).toMatchObject({
            id: 'mig-1',
            name: 'baseline_structure_v1',
            fromVersion: 1,
            toVersion: 1,
            meta: null
        })
        expect(mockEnsureMetahubAccess).toHaveBeenCalled()
    })

    it('returns 409 when apply lock cannot be acquired', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-2'
        const branchId = 'branch-2'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b2',
            structureVersion: 1
        })

        mockAcquireAdvisoryLock.mockResolvedValue(false)

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/apply`).send({ dryRun: false }).expect(409)

        expect(response.body.error).toContain('Could not acquire migration apply lock')
    })

    it('returns structured migration plan payload', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-3'
        const branchId = 'branch-3'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3',
            structureVersion: 1
        })

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(200)

        expect(response.body).toMatchObject({
            branchId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3',
            currentStructureVersion: 1,
            targetStructureVersion: 1,
            structureUpgradeRequired: false,
            templateId: null,
            currentTemplateVersionId: null,
            targetTemplateVersionId: null,
            templateUpgradeRequired: false,
            structurePlan: {
                blockers: []
            },
            templatePlan: {
                cleanup: {
                    hasChanges: false
                },
                blockers: [],
                structureCompatible: true
            }
        })
    })

    it('uses branch last synced template version as current template source in migration plan', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo, templateRepo, templateVersionRepo } = setupDataSource()
        const metahubId = 'metahub-branch-template-source'
        const branchId = 'branch-template-source'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v110'
        const branchTemplateVersionId = 'template-v100'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_tpl_source',
            structureVersion: 2,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '1.0.0'
        })
        templateRepo.findOneBy.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        templateVersionRepo.findOneBy.mockImplementation(async ({ id }: { id: string }) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '1.0.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '1.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(200)

        expect(response.body.currentTemplateVersionId).toBe(branchTemplateVersionId)
        expect(response.body.targetTemplateVersionId).toBe(targetTemplateVersionId)
        expect(response.body.templateUpgradeRequired).toBe(true)
    })

    it('returns migration status payload for route-level guard checks', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-3-status'
        const branchId = 'branch-3-status'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3_status',
            structureVersion: 1
        })

        const app = buildApp(dataSource)
        const response = await request(app).get(`/metahub/${metahubId}/migrations/status`).expect(200)

        expect(response.body).toMatchObject({
            branchId,
            migrationRequired: false,
            status: 'up_to_date',
            code: 'UP_TO_DATE',
            structureUpgradeRequired: false,
            templateUpgradeRequired: false
        })
    })

    it('does not execute template seed dry-run in migrations status endpoint', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo, templateRepo, templateVersionRepo } = setupDataSource()
        const metahubId = 'metahub-status-lightweight'
        const branchId = 'branch-status-lightweight'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v110'
        const branchTemplateVersionId = 'template-v100'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_status_light',
            structureVersion: 2,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '1.0.0'
        })
        templateRepo.findOneBy.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        templateVersionRepo.findOneBy.mockImplementation(async ({ id }: { id: string }) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '1.0.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '1.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp(dataSource)
        const response = await request(app).get(`/metahub/${metahubId}/migrations/status`).expect(200)

        expect(response.body).toMatchObject({
            branchId,
            migrationRequired: true,
            structureUpgradeRequired: false,
            templateUpgradeRequired: true
        })
        expect(mockSeedMigrate).not.toHaveBeenCalled()
    })

    it('maps DB timeout to deterministic 503 for migrations status endpoint', async () => {
        const { dataSource } = setupDataSource()
        const metahubId = 'metahub-status-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp(dataSource)
        const response = await request(app).get(`/metahub/${metahubId}/migrations/status`).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations list endpoint', async () => {
        const { dataSource } = setupDataSource()
        const metahubId = 'metahub-list-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp(dataSource)
        const response = await request(app).get(`/metahub/${metahubId}/migrations`).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations plan endpoint', async () => {
        const { dataSource } = setupDataSource()
        const metahubId = 'metahub-plan-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations apply endpoint pre-plan phase', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-apply-timeout'
        const branchId = 'branch-apply-timeout'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/apply`).send({ dryRun: false }).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('blocks apply when cleanup mode is dry_run and cleanup has pending destructive changes', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo } = setupDataSource()
        const metahubId = 'metahub-4'
        const branchId = 'branch-4'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b4',
            structureVersion: 1
        })

        mockCleanupAnalyze.mockResolvedValue({
            mode: 'dry_run',
            hasChanges: true,
            blockers: [],
            notes: [],
            summary: { entitiesDeleted: 1, attributesDeleted: 2, elementsDeleted: 3, settingsDeleted: 1 }
        })

        const app = buildApp(dataSource)
        const response = await request(app)
            .post(`/metahub/${metahubId}/migrations/apply`)
            .send({ dryRun: false, cleanupMode: 'dry_run' })
            .expect(422)

        expect(response.body.error).toContain('Migration contains blockers')
        expect(response.body.blockers).toEqual(
            expect.arrayContaining([expect.stringContaining('cleanup mode "dry_run" cannot apply destructive cleanup')])
        )
    })

    it('does not update metahub template pointer when branch template sync is not confirmed', async () => {
        const { dataSource, metahubRepo, branchRepo, metahubUserRepo, templateRepo, templateVersionRepo } = setupDataSource()
        const metahubId = 'metahub-template-sync-check'
        const branchId = 'branch-template-sync-check'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v110'
        const branchTemplateVersionId = 'template-v100'

        metahubRepo.findOneBy.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        metahubUserRepo.findOne.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        branchRepo.findOne.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_tpl_sync_check',
            structureVersion: 1,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '1.0.0'
        })
        templateRepo.findOneBy.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        templateVersionRepo.findOneBy.mockImplementation(async ({ id }: { id: string }) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '1.0.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '1.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp(dataSource)
        const response = await request(app).post(`/metahub/${metahubId}/migrations/apply`).send({ dryRun: false }).expect(409)

        expect(response.body).toMatchObject({
            code: 'TEMPLATE_SYNC_NOT_CONFIRMED',
            branchTemplateVersionId,
            targetTemplateVersionId
        })
        expect(mockEnsureSchema).toHaveBeenCalledWith(
            metahubId,
            'test-user-id',
            expect.objectContaining({
                mode: 'apply_migrations',
                templateVersionId: targetTemplateVersionId
            })
        )
        expect(dataSource.transaction).not.toHaveBeenCalled()
    })
})
