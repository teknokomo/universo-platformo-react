jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

const mockClone = jest.fn(async () => undefined)
const mockDropSchema = jest.fn(async () => undefined)
const mockAcquireAdvisoryLock = jest.fn(async () => true)
const mockReleaseAdvisoryLock = jest.fn(async () => undefined)
const mockUuidToLockKey = jest.fn((value: string) => value)
const mockCreateInitialBranch = jest.fn(async () => ({
    id: 'branch-main',
    metahubId: 'metahub-1',
    codename: 'main'
}))

jest.mock('../../domains/ddl', () => ({
    __esModule: true,
    KnexClient: {
        getInstance: jest.fn(() => ({}))
    },
    acquireAdvisoryLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args),
    releaseAdvisoryLock: (...args: unknown[]) => mockReleaseAdvisoryLock(...args),
    uuidToLockKey: (...args: unknown[]) => mockUuidToLockKey(...args),
    getDDLServices: () => ({
        cloner: { clone: (...args: unknown[]) => mockClone(...args) },
        generator: { dropSchema: (...args: unknown[]) => mockDropSchema(...args) }
    })
}))

jest.mock('../../domains/branches/services/MetahubBranchesService', () => ({
    __esModule: true,
    MetahubBranchesService: jest.fn().mockImplementation(() => ({
        createInitialBranch: (...args: unknown[]) => mockCreateInitialBranch(...args)
    }))
}))

const mockEnsureMetahubAccess = jest.fn(async () => ({
    membership: { id: 'membership-owner', role: 'owner', userId: 'test-user-id', metahubId: 'metahub-1', _uplCreatedAt: new Date() },
    entityId: 'metahub-1',
    metahubId: 'metahub-1',
    isSynthetic: false
}))

jest.mock('../../domains/shared/guards', () => ({
    __esModule: true,
    ensureMetahubAccess: (...args: any[]) => mockEnsureMetahubAccess(...args),
    ROLE_PERMISSIONS: {
        owner: { manageMetahub: true, manageMembers: true, deleteContent: true, editContent: true, viewContent: true },
        admin: { manageMetahub: true, manageMembers: true, deleteContent: true, editContent: true, viewContent: true },
        editor: { manageMetahub: false, manageMembers: false, deleteContent: false, editContent: true, viewContent: true },
        member: { manageMetahub: false, manageMembers: false, deleteContent: false, editContent: false, viewContent: true }
    },
    assertNotOwner: (membership: any, operation = 'modify') => {
        if (membership.role === 'owner') {
            const action = operation === 'modify' ? 'update role of' : 'remove'
            const err = new Error(`Cannot ${action} the owner of this metahub`) as any
            err.statusCode = 403
            throw err
        }
    },
    MetahubRole: {},
    getMetahubMembership: jest.fn(),
    assertPermission: jest.fn(),
    hasPermission: jest.fn()
}))

const mockFindMetahubById = jest.fn(async () => null)
const mockFindMetahubByCodename = jest.fn(async () => null)
const mockFindMetahubBySlug = jest.fn(async () => null)
const mockFindMetahubForUpdate = jest.fn(async () => null)
const mockListMetahubs = jest.fn(async () => ({ items: [], total: 0 }))
const mockCreateMetahub = jest.fn(async () => ({ id: 'mock-id' }))
const mockUpdateMetahub = jest.fn(async () => null)
const mockFindMetahubMembership = jest.fn(async () => null)
const mockFindMetahubMemberById = jest.fn(async () => null)
const mockListMetahubMembers = jest.fn(async () => ({ items: [], total: 0 }))
const mockAddMetahubMember = jest.fn(async () => ({ id: 'membership-new' }))
const mockUpdateMetahubMember = jest.fn(async () => null)
const mockRemoveMetahubMember = jest.fn(async () => undefined)
const mockCountMetahubMembers = jest.fn(async () => 0)
const mockFindBranchByIdAndMetahub = jest.fn(async () => null)
const mockFindBranchesByMetahub = jest.fn(async () => [])
const mockCreateBranch = jest.fn(async () => ({ id: 'branch-new' }))
const mockCountBranches = jest.fn(async () => 0)
const mockFindTemplateByIdNotDeleted = jest.fn(async () => null)
const mockFindTemplateByCodename = jest.fn(async () => null)

jest.mock('../../persistence', () => ({
    __esModule: true,
    findMetahubById: (...args: any[]) => mockFindMetahubById(...args),
    findMetahubByCodename: (...args: any[]) => mockFindMetahubByCodename(...args),
    findMetahubBySlug: (...args: any[]) => mockFindMetahubBySlug(...args),
    findMetahubForUpdate: (...args: any[]) => mockFindMetahubForUpdate(...args),
    listMetahubs: (...args: any[]) => mockListMetahubs(...args),
    createMetahub: (...args: any[]) => mockCreateMetahub(...args),
    updateMetahub: (...args: any[]) => mockUpdateMetahub(...args),
    findMetahubMembership: (...args: any[]) => mockFindMetahubMembership(...args),
    findMetahubMemberById: (...args: any[]) => mockFindMetahubMemberById(...args),
    listMetahubMembers: (...args: any[]) => mockListMetahubMembers(...args),
    addMetahubMember: (...args: any[]) => mockAddMetahubMember(...args),
    updateMetahubMember: (...args: any[]) => mockUpdateMetahubMember(...args),
    removeMetahubMember: (...args: any[]) => mockRemoveMetahubMember(...args),
    countMetahubMembers: (...args: any[]) => mockCountMetahubMembers(...args),
    findBranchByIdAndMetahub: (...args: any[]) => mockFindBranchByIdAndMetahub(...args),
    findBranchesByMetahub: (...args: any[]) => mockFindBranchesByMetahub(...args),
    createBranch: (...args: any[]) => mockCreateBranch(...args),
    countBranches: (...args: any[]) => mockCountBranches(...args),
    findTemplateByIdNotDeleted: (...args: any[]) => mockFindTemplateByIdNotDeleted(...args),
    findTemplateByCodename: (...args: any[]) => mockFindTemplateByCodename(...args),
    softDelete: jest.fn(async () => true)
}))

import type { Request, Response, NextFunction } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMetahubsRoutes } from '../../domains/metahubs/routes/metahubsRoutes'

describe('Metahubs Routes', () => {
    const ensureAuth = (req: Request, _res: Response, next: NextFunction) => {
        ;(req as any).user = { id: 'test-user-id' }
        next()
    }

    // Mock rate limiters (no-op middleware for tests)
    const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
        next()
    }) as RateLimitRequestHandler

    // Error handler middleware for http-errors compatibility
    const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
        // Don't send if headers already sent
        if (res.headersSent) {
            return _next(err)
        }
        // Handle http-errors (from createError) - extract statusCode/status
        const statusCode = err.statusCode || err.status || 500
        const message = err.message || 'Internal Server Error'
        res.status(statusCode).json({ error: message })
    }

    let mockExec: any

    // Helper to build Express app with error handler
    const buildApp = () => {
        const app = express()
        app.use(express.json())
        app.use(
            '/',
            createMetahubsRoutes(ensureAuth, () => mockExec as any, mockRateLimiter, mockRateLimiter)
        )
        app.use(errorHandler) // Must be after routes to catch errors from asyncHandler
        return app
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockClone.mockClear()
        mockDropSchema.mockClear()
        mockAcquireAdvisoryLock.mockResolvedValue(true)
        mockReleaseAdvisoryLock.mockResolvedValue(undefined)
        mockUuidToLockKey.mockImplementation((value: string) => value)
        mockCreateInitialBranch.mockResolvedValue({
            id: 'branch-main',
            metahubId: 'metahub-1',
            codename: 'main'
        })
        mockExec = {
            query: jest.fn(async () => []),
            transaction: jest.fn(async (cb: any) =>
                cb({ query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false })
            ),
            isReleased: () => false
        }
        mockEnsureMetahubAccess.mockResolvedValue({
            membership: {
                id: 'membership-owner',
                role: 'owner',
                userId: 'test-user-id',
                metahubId: 'metahub-1',
                _uplCreatedAt: new Date()
            },
            entityId: 'metahub-1',
            metahubId: 'metahub-1',
            isSynthetic: false
        })
    })

    describe('GET /metahubs', () => {
        it('should return empty array for user with no metahubs', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            const response = await request(app).get('/metahubs').expect(200)

            expect(response.body).toMatchObject({
                items: [],
                total: 0,
                limit: 100,
                offset: 0
            })
        })

        it('should return metahubs with counts for authenticated user', async () => {
            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'Test Description',
                    codename: null,
                    codenameLocalized: null,
                    slug: null,
                    isPublic: false,
                    templateId: null,
                    templateVersionId: null,
                    _uplVersion: 1,
                    _uplCreatedAt: new Date('2025-01-01'),
                    _uplUpdatedAt: new Date('2025-01-02'),
                    membershipRole: 'owner',
                    membersCount: 0
                }
            ]

            mockListMetahubs.mockResolvedValue({ items: mockMetahubs, total: 1 })

            const app = buildApp()

            const response = await request(app).get('/metahubs').expect(200)

            expect(response.body.items).toHaveLength(1)
            expect(response.body.items[0]).toMatchObject({
                id: 'metahub-1',
                name: 'Test Metahub',
                description: 'Test Description',
                hubsCount: 0,
                catalogsCount: 0,
                membersCount: 0
            })
            expect(response.body.items[0]).toHaveProperty('createdAt')
            expect(response.body.items[0]).toHaveProperty('updatedAt')
            expect(response.body).toMatchObject({ total: 1, limit: 100, offset: 0 })
        })

        it('should handle pagination parameters correctly', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            await request(app).get('/metahubs?limit=5&offset=10&sortBy=name&sortOrder=asc').expect(200)

            expect(mockListMetahubs).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ limit: 5, offset: 10, sortBy: 'name', sortOrder: 'asc' })
            )
        })

        it('should validate pagination parameters', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            // Test 1: Negative offset is rejected by validation
            await request(app).get('/metahubs?offset=-5').expect(400)

            // Test 2: Limit over 1000 is rejected by validation
            await request(app).get('/metahubs?limit=2000').expect(400)

            // Test 3: Valid params pass through
            await request(app).get('/metahubs?limit=50&offset=10').expect(200)
            expect(mockListMetahubs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 50, offset: 10 }))
        })

        it('should use default pagination when no parameters provided', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            await request(app).get('/metahubs').expect(200)

            // Should use defaults: limit=100, offset=0, orderBy updatedAt DESC
            expect(mockListMetahubs).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc' })
            )
        })

        it('should return 401 when user is not authenticated', async () => {
            const noAuthMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
                // No user set in request
                next()
            }

            // Special case: test with noAuthMiddleware
            const app = express()
            app.use(express.json())
            app.use(
                '/',
                createMetahubsRoutes(noAuthMiddleware, () => mockExec as any, mockRateLimiter, mockRateLimiter)
            )
            app.use(errorHandler)

            await request(app).get('/metahubs').expect(401)
        })

        it('should handle database errors gracefully', async () => {
            mockListMetahubs.mockRejectedValue(new Error('Database connection failed'))

            const app = buildApp()

            const response = await request(app).get('/metahubs').expect(500)

            expect(response.body).toMatchObject({ error: 'Database connection failed' })
        })

        it('should filter by search query (case-insensitive)', async () => {
            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'A test description',
                    codename: null,
                    codenameLocalized: null,
                    slug: null,
                    isPublic: false,
                    templateId: null,
                    templateVersionId: null,
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date(),
                    membershipRole: 'owner',
                    membersCount: 0
                }
            ]

            mockListMetahubs.mockResolvedValue({ items: mockMetahubs, total: 1 })

            const app = buildApp()

            await request(app).get('/metahubs?search=test').expect(200)

            expect(mockListMetahubs).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ search: 'test' }))
        })

        it('should set correct pagination headers', async () => {
            const mockMetahubs = [
                {
                    id: 'metahub-1',
                    name: 'Test Metahub',
                    description: 'Test Description',
                    codename: null,
                    codenameLocalized: null,
                    slug: null,
                    isPublic: false,
                    templateId: null,
                    templateVersionId: null,
                    _uplVersion: 1,
                    _uplCreatedAt: new Date('2025-01-01'),
                    _uplUpdatedAt: new Date('2025-01-02'),
                    membershipRole: 'owner',
                    membersCount: 0
                }
            ]

            mockListMetahubs.mockResolvedValue({ items: mockMetahubs, total: 1 })

            const app = buildApp()

            await request(app)
                .get('/metahubs?limit=50&offset=25')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toMatchObject({ limit: 50, offset: 25, total: 1 })
                })
        })
    })

    // NOTE: Removed tests for deprecated /entities and /sections endpoints.
    // These endpoints were removed in the metadata-driven platform refactoring.
    // New tests for /hubs, /attributes, and /elements should be added.

    describe('POST /metahub/:metahubId/copy', () => {
        it('should copy metahub with default branch and access rules', async () => {
            mockFindMetahubById
                .mockResolvedValueOnce({
                    id: 'metahub-1',
                    codename: 'source-hub',
                    slug: 'source-hub',
                    isPublic: false,
                    defaultBranchId: 'branch-1',
                    templateId: null,
                    templateVersionId: null,
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: { en: { content: 'Source Metahub' }, ru: { content: 'Исходный метахаб' } }
                    },
                    description: null
                })
                .mockResolvedValueOnce({
                    id: '018f8a78-7b8f-7c1d-a111-222233334444',
                    codename: 'source-hub-copy',
                    slug: 'source-hub-copy',
                    isPublic: false,
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Source Metahub (copy)' } } },
                    description: null,
                    codenameLocalized: null,
                    _uplVersion: 1,
                    _uplCreatedAt: new Date(),
                    _uplUpdatedAt: new Date()
                })

            mockFindBranchesByMetahub.mockResolvedValue([
                {
                    id: 'branch-1',
                    metahubId: 'metahub-1',
                    sourceBranchId: null,
                    branchNumber: 1,
                    codename: 'main',
                    codenameLocalized: null,
                    schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                    structureVersion: '0.1.0',
                    lastTemplateVersionId: 'tpl-v100',
                    lastTemplateVersionLabel: '0.1.0',
                    lastTemplateSyncedAt: new Date('2026-02-12T11:00:00.000Z'),
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Main' } } },
                    description: null,
                    _uplDeleted: false,
                    _mhbDeleted: false
                },
                {
                    id: 'branch-2',
                    metahubId: 'metahub-1',
                    sourceBranchId: 'branch-1',
                    branchNumber: 2,
                    codename: 'feature',
                    codenameLocalized: null,
                    schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b2',
                    structureVersion: '0.1.0',
                    lastTemplateVersionId: 'tpl-v100',
                    lastTemplateVersionLabel: '0.1.0',
                    lastTemplateSyncedAt: new Date('2026-02-12T11:00:00.000Z'),
                    name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Feature' } } },
                    description: null,
                    _uplDeleted: false,
                    _mhbDeleted: false
                }
            ])

            mockFindMetahubByCodename.mockResolvedValue(null)
            mockFindMetahubBySlug.mockResolvedValue(null)

            mockCreateMetahub.mockResolvedValue({
                id: '018f8a78-7b8f-7c1d-a111-222233334444',
                codename: 'SourceHubCopy',
                slug: 'source-hub-copy',
                name: { _schema: 'v1', _primary: 'en', locales: { en: { content: 'Source Metahub (copy)' } } },
                description: null,
                isPublic: false,
                templateId: null,
                templateVersionId: null,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            })

            mockCreateBranch.mockResolvedValue({
                id: 'new-branch-1',
                metahubId: '018f8a78-7b8f-7c1d-a111-222233334444',
                codename: 'main',
                schemaName: 'mhb_018f8a787b8f7c1da111222233334444_b1'
            })

            mockAddMetahubMember.mockResolvedValue({
                id: 'membership-new',
                metahubId: '018f8a78-7b8f-7c1d-a111-222233334444',
                userId: 'test-user-id',
                role: 'owner'
            })

            mockExec.query.mockImplementation(async (sql: string) => {
                if (sql.includes('uuid_generate_v7')) return [{ id: '018f8a78-7b8f-7c1d-a111-222233334444' }]
                return []
            })

            const txQuery = jest.fn(async () => [])
            mockExec.transaction.mockImplementation(async (cb: any) => {
                const tx = { query: txQuery, transaction: jest.fn(), isReleased: () => false }
                return cb(tx)
            })

            const app = buildApp()

            const response = await request(app)
                .post('/metahub/metahub-1/copy')
                .send({
                    name: { en: 'Source Metahub (copy)' },
                    codename: 'source-hub-copy',
                    copyDefaultBranchOnly: true,
                    copyAccess: true
                })
                .expect(201)

            expect(response.body.id).toBe('018f8a78-7b8f-7c1d-a111-222233334444')
            expect(mockClone).toHaveBeenCalledTimes(1)
            expect(mockClone).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceSchema: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1',
                    targetSchema: 'mhb_018f8a787b8f7c1da111222233334444_b1',
                    copyData: true
                })
            )
            expect(mockCreateBranch).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    lastTemplateVersionId: 'tpl-v100',
                    lastTemplateVersionLabel: '0.1.0'
                })
            )
            expect(mockAddMetahubMember).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    metahubId: '018f8a78-7b8f-7c1d-a111-222233334444',
                    userId: 'test-user-id',
                    role: 'owner'
                })
            )
        })
    })

    describe('DELETE /metahub/:metahubId', () => {
        it('should drop branch schemas before deleting metahub metadata', async () => {
            mockFindMetahubById.mockResolvedValue({
                id: 'metahub-1',
                codename: 'source-hub'
            })

            mockFindMetahubForUpdate.mockResolvedValue({
                id: 'metahub-1',
                codename: 'source-hub'
            })

            const txQuery = jest.fn(async (sql: string) => {
                if (sql.includes('metahubs_branches')) {
                    return [
                        { schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b1' },
                        { schemaName: 'mhb_a1b2c3d4e5f67890abcdef1234567890_b2' }
                    ]
                }
                return []
            })
            mockExec.transaction.mockImplementation(async (cb: any) => {
                const tx = { query: txQuery, transaction: jest.fn(), isReleased: () => false }
                return cb(tx)
            })

            const app = buildApp()

            await request(app).delete('/metahub/metahub-1').expect(204)

            expect(txQuery).toHaveBeenCalledWith(
                expect.stringContaining('DROP SCHEMA IF EXISTS "mhb_a1b2c3d4e5f67890abcdef1234567890_b1" CASCADE')
            )
            expect(txQuery).toHaveBeenCalledWith(
                expect.stringContaining('DROP SCHEMA IF EXISTS "mhb_a1b2c3d4e5f67890abcdef1234567890_b2" CASCADE')
            )
            // Cascade soft-delete children
            expect(txQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE metahubs.metahubs_branches'),
                expect.arrayContaining(['metahub-1'])
            )
            expect(txQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE metahubs.metahubs_users'),
                expect.arrayContaining(['metahub-1'])
            )
            expect(txQuery).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE metahubs.publications'),
                expect.arrayContaining(['metahub-1'])
            )
        })
    })

    describe('Members management endpoints', () => {
        it('should return members when user has manageMembers permission', async () => {
            mockEnsureMetahubAccess.mockResolvedValueOnce({
                membership: {
                    id: 'membership-admin',
                    role: 'admin',
                    userId: 'test-user-id',
                    metahubId: 'metahub-1',
                    _uplCreatedAt: new Date()
                },
                entityId: 'metahub-1',
                metahubId: 'metahub-1',
                isSynthetic: false
            })

            const now = new Date('2024-01-01T00:00:00.000Z')

            mockListMetahubMembers.mockResolvedValue({
                items: [
                    {
                        id: 'membership-owner',
                        metahubId: 'metahub-1',
                        userId: 'owner-id',
                        role: 'owner',
                        email: 'owner@example.com',
                        nickname: null,
                        comment: null,
                        _uplCreatedAt: now
                    },
                    {
                        id: 'membership-editor',
                        metahubId: 'metahub-1',
                        userId: 'editor-id',
                        role: 'editor',
                        email: 'editor@example.com',
                        nickname: null,
                        comment: null,
                        _uplCreatedAt: now
                    }
                ],
                total: 2
            })

            const app = buildApp()

            const response = await request(app).get('/metahub/metahub-1/members').expect(200)

            expect(response.body).toMatchObject({ total: 2, role: 'admin' })
            expect(Array.isArray(response.body.members)).toBe(true)
            expect(response.body.members).toEqual([
                expect.objectContaining({
                    id: 'membership-owner',
                    userId: 'owner-id',
                    email: 'owner@example.com',
                    role: 'owner'
                }),
                expect.objectContaining({
                    id: 'membership-editor',
                    userId: 'editor-id',
                    email: 'editor@example.com',
                    role: 'editor'
                })
            ])
        })

        it('should allow listing members without manageMembers permission', async () => {
            mockEnsureMetahubAccess.mockResolvedValueOnce({
                membership: {
                    id: 'membership-basic',
                    role: 'member',
                    userId: 'test-user-id',
                    metahubId: 'metahub-1',
                    _uplCreatedAt: new Date()
                },
                entityId: 'metahub-1',
                metahubId: 'metahub-1',
                isSynthetic: false
            })

            mockListMetahubMembers.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            const response = await request(app).get('/metahub/metahub-1/members').expect(200)
            expect(response.body).toMatchObject({ role: 'member' })
            expect(response.body.permissions?.manageMembers).toBe(false)
        })

        it('should create member when requester can manage members', async () => {
            mockExec.query.mockImplementation(async (sql: string) => {
                if (sql.includes('auth.users')) return [{ id: 'target-user', email: 'target@example.com' }]
                return []
            })

            mockFindMetahubMembership.mockResolvedValue(null)

            mockAddMetahubMember.mockResolvedValue({
                id: 'new-membership-id',
                metahubId: 'metahub-1',
                userId: 'target-user',
                role: 'editor',
                comment: null,
                _uplCreatedAt: new Date()
            })

            const app = buildApp()

            const response = await request(app)
                .post('/metahub/metahub-1/members')
                .send({ email: 'target@example.com', role: 'editor' })
                .expect(201)

            expect(response.body).toMatchObject({
                userId: 'target-user',
                email: 'target@example.com',
                role: 'editor'
            })
            expect(mockAddMetahubMember).toHaveBeenCalled()
        })

        it('should reject creating member without permission', async () => {
            const createError = (status: number, message: string) => {
                const err = new Error(message) as any
                err.statusCode = status
                return err
            }
            mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Forbidden'))

            const app = buildApp()

            await request(app).post('/metahub/metahub-1/members').send({ email: 'target@example.com', role: 'member' }).expect(403)

            expect(mockAddMetahubMember).not.toHaveBeenCalled()
        })

        it('should update member role when authorized', async () => {
            mockFindMetahubMemberById.mockResolvedValue({
                id: 'membership-target',
                metahubId: 'metahub-1',
                userId: 'target-user',
                role: 'member',
                _uplCreatedAt: new Date()
            })

            mockUpdateMetahubMember.mockResolvedValue({
                id: 'membership-target',
                metahubId: 'metahub-1',
                userId: 'target-user',
                role: 'editor',
                comment: null,
                _uplCreatedAt: new Date()
            })

            const app = buildApp()

            const response = await request(app).patch('/metahub/metahub-1/member/membership-target').send({ role: 'editor' }).expect(200)

            expect(response.body).toMatchObject({
                id: 'membership-target',
                role: 'editor'
            })
            expect(mockUpdateMetahubMember).toHaveBeenCalledWith(
                expect.anything(),
                'membership-target',
                expect.objectContaining({ role: 'editor' })
            )
        })

        it('should forbid updating member without permission', async () => {
            const createError = (status: number, message: string) => {
                const err = new Error(message) as any
                err.statusCode = status
                return err
            }
            mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Forbidden'))

            const app = buildApp()

            await request(app).patch('/metahub/metahub-1/member/membership-target').send({ role: 'editor' }).expect(403)
        })

        it('should delete member when authorized', async () => {
            mockFindMetahubMemberById.mockResolvedValue({
                id: 'membership-target',
                metahubId: 'metahub-1',
                userId: 'target-user',
                role: 'member'
            })

            const app = buildApp()

            await request(app).delete('/metahub/metahub-1/member/membership-target').expect(204)
            expect(mockRemoveMetahubMember).toHaveBeenCalledWith(expect.anything(), 'membership-target', 'test-user-id')
        })

        it('should reject deleting member without permission', async () => {
            const createError = (status: number, message: string) => {
                const err = new Error(message) as any
                err.statusCode = status
                return err
            }
            mockEnsureMetahubAccess.mockRejectedValueOnce(createError(403, 'Forbidden'))

            const app = buildApp()

            await request(app).delete('/metahub/metahub-1/member/membership-target').expect(403)
        })

        describe('Members data enrichment', () => {
            it('should fetch nickname from profiles table via batch query', async () => {
                mockEnsureMetahubAccess.mockResolvedValueOnce({
                    membership: {
                        id: 'membership-admin',
                        role: 'admin',
                        userId: 'test-user-id',
                        metahubId: 'metahub-1',
                        _uplCreatedAt: new Date()
                    },
                    entityId: 'metahub-1',
                    metahubId: 'metahub-1',
                    isSynthetic: false
                })

                const now = new Date('2024-01-01T00:00:00.000Z')

                mockListMetahubMembers.mockResolvedValue({
                    items: [
                        {
                            id: 'membership-owner',
                            metahubId: 'metahub-1',
                            userId: 'owner-id',
                            role: 'owner',
                            email: 'owner@example.com',
                            nickname: 'OwnerNick',
                            comment: null,
                            _uplCreatedAt: now
                        },
                        {
                            id: 'membership-editor',
                            metahubId: 'metahub-1',
                            userId: 'editor-id',
                            role: 'editor',
                            email: 'editor@example.com',
                            nickname: 'EditorNick',
                            comment: 'Test comment',
                            _uplCreatedAt: now
                        }
                    ],
                    total: 2
                })

                const app = buildApp()

                const response = await request(app).get('/metahub/metahub-1/members').expect(200)

                // Verify nickname is fetched from profiles table
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'owner-id',
                            email: 'owner@example.com',
                            nickname: 'OwnerNick',
                            role: 'owner'
                        }),
                        expect.objectContaining({
                            userId: 'editor-id',
                            email: 'editor@example.com',
                            nickname: 'EditorNick',
                            role: 'editor',
                            comment: 'Test comment'
                        })
                    ])
                )
            })

            it('should fetch comment from metahubs_users table', async () => {
                mockEnsureMetahubAccess.mockResolvedValueOnce({
                    membership: {
                        id: 'membership-admin',
                        role: 'admin',
                        userId: 'test-user-id',
                        metahubId: 'metahub-1',
                        _uplCreatedAt: new Date()
                    },
                    entityId: 'metahub-1',
                    metahubId: 'metahub-1',
                    isSynthetic: false
                })

                const now = new Date('2024-01-01T00:00:00.000Z')

                mockListMetahubMembers.mockResolvedValue({
                    items: [
                        {
                            id: 'membership-editor',
                            metahubId: 'metahub-1',
                            userId: 'editor-id',
                            role: 'editor',
                            email: 'editor@example.com',
                            nickname: 'EditorNick',
                            comment: 'This is a test comment from metahubs_users table',
                            _uplCreatedAt: now
                        }
                    ],
                    total: 1
                })

                const app = buildApp()

                const response = await request(app).get('/metahub/metahub-1/members').expect(200)

                // Verify comment is returned from MetahubUser entity
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'editor-id',
                            comment: 'This is a test comment from metahubs_users table'
                        })
                    ])
                )
            })

            it('should handle null email and nickname gracefully', async () => {
                mockEnsureMetahubAccess.mockResolvedValueOnce({
                    membership: {
                        id: 'membership-admin',
                        role: 'admin',
                        userId: 'test-user-id',
                        metahubId: 'metahub-1',
                        _uplCreatedAt: new Date()
                    },
                    entityId: 'metahub-1',
                    metahubId: 'metahub-1',
                    isSynthetic: false
                })

                const now = new Date('2024-01-01T00:00:00.000Z')

                mockListMetahubMembers.mockResolvedValue({
                    items: [
                        {
                            id: 'membership-orphan',
                            metahubId: 'metahub-1',
                            userId: 'orphan-user-id',
                            role: 'member',
                            email: null,
                            nickname: null,
                            comment: null,
                            _uplCreatedAt: now
                        }
                    ],
                    total: 1
                })

                const app = buildApp()

                const response = await request(app).get('/metahub/metahub-1/members').expect(200)

                // Should return null for missing email and nickname
                expect(response.body.members).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            userId: 'orphan-user-id',
                            email: null,
                            nickname: null,
                            role: 'member'
                        })
                    ])
                )
            })
        })

        describe('Comment validation with trim', () => {
            it('should trim comment and validate max 500 characters on create', async () => {
                mockExec.query.mockImplementation(async (sql: string) => {
                    if (sql.includes('auth.users')) return [{ id: 'target-user', email: 'target@example.com' }]
                    return []
                })

                mockFindMetahubMembership.mockResolvedValue(null) // No existing membership

                mockAddMetahubMember.mockImplementation(async (_exec: any, data: any) =>
                    Promise.resolve({
                        ...data,
                        id: 'new-membership-id',
                        _uplCreatedAt: new Date()
                    })
                )

                const commentWithWhitespace = '   This comment has leading and trailing spaces   '

                const app = buildApp()

                const response = await request(app)
                    .post('/metahub/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: commentWithWhitespace
                    })
                    .expect(201)

                // Verify comment was trimmed before saving
                expect(mockAddMetahubMember).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({
                        comment: expect.objectContaining({
                            _schema: '1',
                            _primary: 'en',
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'This comment has leading and trailing spaces',
                                    version: 1,
                                    isActive: true
                                })
                            })
                        })
                    })
                )
            })

            it('should reject comment longer than 500 characters after trim', async () => {
                // Create comment with exactly 501 characters (after trim)
                const longComment = 'a'.repeat(501)

                const app = buildApp()

                const response = await request(app)
                    .post('/metahub/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'editor',
                        comment: longComment
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload',
                    details: {
                        formErrors: ['Comment must be 500 characters or less'],
                        fieldErrors: { comment: ['Comment must be 500 characters or less'] }
                    }
                })
            })

            it('should return 400 with validation details for invalid role or email', async () => {
                const app = buildApp()

                // Test invalid role
                let response = await request(app)
                    .post('/metahub/metahub-1/members')
                    .send({
                        email: 'target@example.com',
                        role: 'invalid-role'
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload'
                })
                expect(response.body.details).toBeDefined()

                // Test invalid email
                response = await request(app)
                    .post('/metahub/metahub-1/members')
                    .send({
                        email: 'not-an-email',
                        role: 'editor'
                    })
                    .expect(400)

                expect(response.body).toMatchObject({
                    error: 'Invalid payload'
                })
                expect(response.body.details).toBeDefined()

                // Verify no member was created
                expect(mockAddMetahubMember).not.toHaveBeenCalled()
            })
        })
    })

    describe('Unique conflict handling', () => {
        it('threads createOptions into initial branch creation when creating a metahub', async () => {
            mockFindMetahubByCodename.mockResolvedValue(null)

            mockCreateMetahub.mockResolvedValue({
                id: 'mock-id',
                name: 'New Hub',
                description: null,
                codename: 'NewHub',
                codenameLocalized: null,
                slug: null,
                isPublic: false,
                templateId: null,
                templateVersionId: null,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            })

            mockExec.transaction.mockImplementation(async (cb: any) => {
                const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
                return cb(tx)
            })

            const app = buildApp()

            await request(app)
                .post('/metahubs')
                .send({
                    name: 'New Hub',
                    codename: 'NewHub',
                    createOptions: {
                        createHub: false,
                        createCatalog: true,
                        createSet: false,
                        createEnumeration: true
                    }
                })
                .expect(201)

            expect(mockCreateInitialBranch).toHaveBeenCalledWith(
                expect.objectContaining({
                    metahubId: 'mock-id',
                    createdBy: 'test-user-id',
                    createOptions: {
                        createHub: false,
                        createCatalog: true,
                        createSet: false,
                        createEnumeration: true
                    }
                })
            )
        })

        it('returns 409 on create when database reports codename unique violation', async () => {
            mockFindMetahubByCodename.mockResolvedValue(null)
            mockExec.transaction.mockRejectedValueOnce({
                code: '23505',
                constraint: 'idx_metahubs_codename_active'
            })

            const app = buildApp()
            const response = await request(app).post('/metahubs').send({ name: 'New Hub', codename: 'new-hub' }).expect(409)

            expect(response.body).toMatchObject({ error: 'Codename already in use' })
        })

        it('returns generic 409 on create when unique violation constraint is unknown', async () => {
            mockFindMetahubByCodename.mockResolvedValue(null)
            mockExec.transaction.mockRejectedValueOnce({
                driverError: {
                    code: '23505',
                    constraint: 'metahubs_some_unknown_unique_idx'
                }
            })

            const app = buildApp()
            const response = await request(app).post('/metahubs').send({ name: 'New Hub', codename: 'new-hub' }).expect(409)

            expect(response.body).toMatchObject({ error: 'Unique constraint conflict' })
        })

        it('returns 409 on update when database reports codename unique violation from driverError', async () => {
            mockFindMetahubById.mockResolvedValue({
                id: 'metahub-1',
                codename: 'old-codename',
                slug: null,
                name: { _schema: '1', _primary: 'en', locales: { en: { content: 'Old hub' } } },
                description: null,
                isPublic: false,
                _uplVersion: 1,
                _uplUpdatedAt: new Date('2026-02-11T10:00:00.000Z'),
                _uplUpdatedBy: 'test-user-id'
            })
            mockFindMetahubByCodename.mockResolvedValue(null)
            mockUpdateMetahub.mockRejectedValueOnce({
                driverError: {
                    code: '23505',
                    constraint: 'idx_metahubs_codename_active'
                }
            })

            const app = buildApp()
            const response = await request(app).put('/metahub/metahub-1').send({ codename: 'new-codename', expectedVersion: 1 }).expect(409)

            expect(response.body).toMatchObject({ error: 'Codename already in use' })
            expect(mockFindMetahubByCodename).toHaveBeenCalledWith(expect.anything(), 'NewCodename')
        })
    })

    describe('Rate Limiting', () => {
        // Note: Rate limiting tests use mock limiters since we test the integration,
        // not the actual rate limiting library functionality.
        // The real rate limiting is tested via integration tests with actual Redis.

        it('should allow requests within read limit (integration test with mock)', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })

            const app = buildApp()

            // Make 5 requests (well below 100 limit)
            for (let i = 0; i < 5; i++) {
                await request(app).get('/metahubs').expect(200)
            }

            // All requests should pass with mock limiter
        })

        it.skip('should return 429 after exceeding read limit (requires real Redis)', async () => {
            // This test requires actual Redis connection and real rate limiters
            // Skip in unit tests - covered by integration tests
        })

        it.skip('should return 429 after exceeding write limit (requires real Redis)', async () => {
            // This test requires actual Redis connection and real rate limiters
            // Skip in unit tests - covered by integration tests
        })

        it('should have separate limits for read and write', async () => {
            mockListMetahubs.mockResolvedValue({ items: [], total: 0 })
            mockFindMetahubByCodename.mockResolvedValue(null)

            mockCreateMetahub.mockResolvedValue({
                id: 'new-id',
                name: 'test',
                description: null,
                codename: 'TestMetahub',
                codenameLocalized: null,
                slug: null,
                isPublic: false,
                templateId: null,
                templateVersionId: null,
                _uplVersion: 1,
                _uplCreatedAt: new Date(),
                _uplUpdatedAt: new Date()
            })

            mockExec.transaction.mockImplementation(async (cb: any) => {
                const tx = { query: jest.fn(async () => []), transaction: jest.fn(), isReleased: () => false }
                return cb(tx)
            })

            const app = buildApp()

            // Make 100 GET requests (at read limit)
            for (let i = 0; i < 100; i++) {
                await request(app).get('/metahubs').expect(200)
            }

            // POST should still work (separate write counter)
            await request(app).post('/metahubs').send({ name: 'test', description: 'test', codename: 'test-metahub' }).expect(201)
        })

        it.skip('should include rate limit headers in response (requires real Redis)', async () => {
            // This test requires actual rate limiter with Redis to inject headers
            // Skip in unit tests - covered by integration tests
        })
    })
})
