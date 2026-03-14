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

const mockPoolQuery = jest.fn(async () => ({ rows: [] }))

jest.mock('@universo/database', () => ({
    __esModule: true,
    getPoolExecutor: jest.fn(() => ({
        query: (...args: unknown[]) => mockPoolQuery(...args)
    })),
    qSchema: jest.requireActual('@universo/database').qSchema,
    qTable: jest.requireActual('@universo/database').qTable,
    qSchemaTable: jest.requireActual('@universo/database').qSchemaTable,
    qColumn: jest.requireActual('@universo/database').qColumn,
    createKnexExecutor: jest.requireActual('@universo/database').createKnexExecutor
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args),
    acquirePoolAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releasePoolAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    hasPoolRuntimeHistoryTable: (...args: unknown[]) => mockHasTable(...args),
    createPoolTemplateSeedCleanupService: jest.fn(() => ({
        analyze: (...args: unknown[]) => mockCleanupAnalyze(...args),
        apply: (...args: unknown[]) => mockCleanupApply(...args)
    })),
    createPoolTemplateSeedMigrator: jest.fn(() => ({
        migrateSeed: (...args: unknown[]) => mockSeedMigrate(...args)
    }))
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

import { createMetahubMigrationsRoutes } from '../../domains/metahubs/routes/metahubMigrationsRoutes'
import { CURRENT_STRUCTURE_VERSION, CURRENT_STRUCTURE_VERSION_SEMVER } from '../../domains/metahubs/services/structureVersions'
import { basicTemplate } from '../../domains/templates/data/basic.template'

const mockFindMetahubById = jest.fn()
const mockFindMetahubForUpdate = jest.fn()
const mockFindBranchByIdAndMetahub = jest.fn()
const mockFindMetahubMembership = jest.fn()
const mockFindTemplateById = jest.fn()
const mockFindTemplateVersionById = jest.fn()

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: unknown[]) => mockFindMetahubById(...args),
    findMetahubForUpdate: (...args: unknown[]) => mockFindMetahubForUpdate(...args),
    findBranchByIdAndMetahub: (...args: unknown[]) => mockFindBranchByIdAndMetahub(...args),
    findMetahubMembership: (...args: unknown[]) => mockFindMetahubMembership(...args),
    findTemplateById: (...args: unknown[]) => mockFindTemplateById(...args),
    findTemplateVersionById: (...args: unknown[]) => mockFindTemplateVersionById(...args)
}))

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

    const mockExec = {
        query: jest.fn(async () => []),
        transaction: jest.fn(async (cb: any) => cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })),
        isReleased: () => false
    }

    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createMetahubMigrationsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler)
        return app
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
        const metahubId = 'metahub-1'
        const branchId = 'branch-1'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b1',
            structureVersion: 1
        })

        mockHasTable.mockResolvedValue(true)
        mockPoolQuery.mockResolvedValueOnce([{ count: '1' }]).mockResolvedValueOnce([
            {
                id: 'mig-1',
                name: 'baseline_structure_v1',
                applied_at: new Date('2026-02-11T09:43:05.944Z'),
                from_version: 1,
                to_version: 1,
                meta: '{invalid-json'
            }
        ])

        const app = buildApp()
        const response = await request(app).get(`/metahub/${metahubId}/migrations`).expect(200)

        expect(response.body.items).toHaveLength(1)
        expect(response.body.items[0]).toMatchObject({
            id: 'mig-1',
            name: 'baseline_structure_v1',
            fromVersion: CURRENT_STRUCTURE_VERSION_SEMVER,
            toVersion: CURRENT_STRUCTURE_VERSION_SEMVER,
            meta: null
        })
        expect(mockEnsureMetahubAccess).toHaveBeenCalled()
    })

    it('returns 409 when apply lock cannot be acquired', async () => {
        const metahubId = 'metahub-2'
        const branchId = 'branch-2'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b2',
            structureVersion: 1
        })

        mockAcquireAdvisoryLock.mockResolvedValue(false)

        const app = buildApp()
        const response = await request(app).post(`/metahub/${metahubId}/migrations/apply`).send({ dryRun: false }).expect(409)

        expect(response.body.error).toContain('Could not acquire migration apply lock')
    })

    it('returns structured migration plan payload for v1 baseline', async () => {
        const metahubId = 'metahub-3'
        const branchId = 'branch-3'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3',
            structureVersion: 1
        })

        const app = buildApp()
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(200)

        expect(response.body).toMatchObject({
            branchId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3',
            currentStructureVersion: CURRENT_STRUCTURE_VERSION_SEMVER,
            targetStructureVersion: CURRENT_STRUCTURE_VERSION_SEMVER,
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
        const metahubId = 'metahub-branch-template-source'
        const branchId = 'branch-template-source'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v100-target'
        const branchTemplateVersionId = 'template-v100-branch'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_tpl_source',
            structureVersion: CURRENT_STRUCTURE_VERSION,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '0.1.0'
        })
        mockFindTemplateById.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        mockFindTemplateVersionById.mockImplementation(async (_exec: any, id: string) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp()
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(200)

        expect(response.body.currentTemplateVersionId).toBe(branchTemplateVersionId)
        expect(response.body.targetTemplateVersionId).toBe(targetTemplateVersionId)
        expect(response.body.templateUpgradeRequired).toBe(true)
    })

    it('returns up-to-date migration status payload for route-level guard checks', async () => {
        const metahubId = 'metahub-3-status'
        const branchId = 'branch-3-status'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_b3_status',
            structureVersion: 1
        })

        const app = buildApp()
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
        const metahubId = 'metahub-status-lightweight'
        const branchId = 'branch-status-lightweight'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v100-target'
        const branchTemplateVersionId = 'template-v100-branch'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_status_light',
            structureVersion: CURRENT_STRUCTURE_VERSION,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '0.1.0'
        })
        mockFindTemplateById.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        mockFindTemplateVersionById.mockImplementation(async (_exec: any, id: string) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp()
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
        const metahubId = 'metahub-status-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp()
        const response = await request(app).get(`/metahub/${metahubId}/migrations/status`).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations list endpoint', async () => {
        const metahubId = 'metahub-list-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp()
        const response = await request(app).get(`/metahub/${metahubId}/migrations`).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations plan endpoint', async () => {
        const metahubId = 'metahub-plan-timeout'

        mockEnsureMetahubAccess.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp()
        const response = await request(app).post(`/metahub/${metahubId}/migrations/plan`).send({}).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('maps DB timeout to deterministic 503 for migrations apply endpoint pre-plan phase', async () => {
        const metahubId = 'metahub-apply-timeout'
        const branchId = 'branch-apply-timeout'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'))

        const app = buildApp()
        const response = await request(app).post(`/metahub/${metahubId}/migrations/apply`).send({ dryRun: false }).expect(503)

        expect(response.body).toMatchObject({
            code: 'CONNECTION_POOL_EXHAUSTED'
        })
    })

    it('blocks apply when cleanup mode is dry_run and cleanup has pending destructive changes', async () => {
        const metahubId = 'metahub-4'
        const branchId = 'branch-4'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId: null,
            templateVersionId: null
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
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

        const app = buildApp()
        const response = await request(app)
            .post(`/metahub/${metahubId}/migrations/apply`)
            .send({ dryRun: false, cleanupMode: 'dry_run' })
            .expect(422)

        expect(response.body.error).toContain('Migration contains blockers')
        expect(response.body.blockers).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'template.cleanup_dry_run' })]))
    })

    it('does not update metahub template pointer when branch template sync is not confirmed', async () => {
        const metahubId = 'metahub-template-sync-check'
        const branchId = 'branch-template-sync-check'
        const templateId = 'template-basic'
        const targetTemplateVersionId = 'template-v100-target'
        const branchTemplateVersionId = 'template-v100-branch'

        mockFindMetahubById.mockResolvedValue({
            id: metahubId,
            defaultBranchId: branchId,
            templateId,
            templateVersionId: targetTemplateVersionId
        })
        mockFindMetahubMembership.mockResolvedValue({
            metahubId,
            userId: 'test-user-id',
            activeBranchId: branchId
        })
        mockFindBranchByIdAndMetahub.mockResolvedValue({
            id: branchId,
            metahubId,
            schemaName: 'mhb_019c4c15185c78f5a2e4f3c9a6aa3d40_tpl_sync_check',
            structureVersion: 1,
            lastTemplateVersionId: branchTemplateVersionId,
            lastTemplateVersionLabel: '0.1.0'
        })
        mockFindTemplateById.mockResolvedValue({
            id: templateId,
            activeVersionId: targetTemplateVersionId
        })
        mockFindTemplateVersionById.mockImplementation(async (_exec: any, id: string) => {
            if (id === branchTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: null }
            }
            if (id === targetTemplateVersionId) {
                return { id, templateId, versionLabel: '0.1.0', manifestJson: basicTemplate }
            }
            return null
        })

        const app = buildApp()
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
        expect(mockExec.transaction).not.toHaveBeenCalled()
    })
})
