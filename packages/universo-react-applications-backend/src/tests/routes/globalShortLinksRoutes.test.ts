import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { GlobalShortLinkRecord, GlobalShortLinkTarget } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('@universo-react/admin-backend', () => ({
    isSuperuser: jest.fn()
}))

jest.mock('../../routes/guards', () => ({
    ...jest.requireActual('../../routes/guards'),
    getApplicationMembership: jest.fn()
}))

jest.mock('../../persistence/globalShortLinksStore', () => ({
    createGlobalShortLink: jest.fn(),
    findActiveGlobalShortLinkApplicationId: jest.fn(),
    findActiveGlobalShortLinkTarget: jest.fn(),
    lockActiveGlobalShortLinkApplication: jest.fn(),
    listGlobalShortLinks: jest.fn(),
    releaseGlobalShortLink: jest.fn(),
    releaseActiveGlobalShortLinksForAccessLink: jest.fn()
}))

jest.mock('../../persistence/globalShortLinkResourcesStore', () => ({ listGlobalShortLinkResourceOptions: jest.fn() }))

jest.mock('../../services/globalShortLinkResourceAvailability', () => ({
    isGlobalShortLinkApplicationResourceAvailable: jest.fn()
}))

jest.mock('../../services/publicApplicationRuntime', () => {
    const actual = jest.requireActual('../../services/publicApplicationRuntime')
    return { ...actual, resolvePublicApplication: jest.fn() }
})

import { isSuperuser } from '@universo-react/admin-backend'
import { getApplicationMembership } from '../../routes/guards'
import {
    createGlobalShortLink,
    findActiveGlobalShortLinkApplicationId,
    findActiveGlobalShortLinkTarget,
    lockActiveGlobalShortLinkApplication,
    listGlobalShortLinks,
    releaseGlobalShortLink
} from '../../persistence/globalShortLinksStore'
import { listGlobalShortLinkResourceOptions } from '../../persistence/globalShortLinkResourcesStore'
import { isGlobalShortLinkApplicationResourceAvailable } from '../../services/globalShortLinkResourceAvailability'
import { PublicApplicationUnavailableError, resolvePublicApplication } from '../../services/publicApplicationRuntime'
import { createGlobalShortLinksRoutes } from '../../routes/globalShortLinksRoutes'

const mockIsSuperuser = jest.mocked(isSuperuser)
const mockGetApplicationMembership = jest.mocked(getApplicationMembership)
const mockCreateGlobalShortLink = jest.mocked(createGlobalShortLink)
const mockFindActiveGlobalShortLinkApplicationId = jest.mocked(findActiveGlobalShortLinkApplicationId)
const mockFindActiveGlobalShortLinkTarget = jest.mocked(findActiveGlobalShortLinkTarget)
const mockLockActiveGlobalShortLinkApplication = jest.mocked(lockActiveGlobalShortLinkApplication)
const mockListGlobalShortLinks = jest.mocked(listGlobalShortLinks)
const mockReleaseGlobalShortLink = jest.mocked(releaseGlobalShortLink)
const mockResolvePublicApplication = jest.mocked(resolvePublicApplication)
const mockListGlobalShortLinkResourceOptions = jest.mocked(listGlobalShortLinkResourceOptions)
const mockIsGlobalShortLinkApplicationResourceAvailable = jest.mocked(isGlobalShortLinkApplicationResourceAvailable)
const mockListEligiblePublicQuizAccessLinks = jest.fn()
const validatePublicQuizAccessLink = jest.fn<Promise<boolean>, [DbExecutor, string, string, string, string | null]>()

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const otherApplicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
const linkId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312271'
const actorId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const target: GlobalShortLinkTarget = { kind: 'application-entry', applicationId }
const record: GlobalShortLinkRecord = {
    id: linkId,
    slug: 'meridian',
    target,
    releasedAt: null,
    createdAt: '2026-10-11T10:00:00.000Z',
    updatedAt: '2026-10-11T10:00:00.000Z'
}
const releasedRecord: GlobalShortLinkRecord = {
    ...record,
    releasedAt: '2026-10-11T11:00:00.000Z',
    updatedAt: '2026-10-11T11:00:00.000Z'
}

const publicTxExecutor = { query: jest.fn().mockResolvedValue([]) }
const poolExecutor = {
    query: jest.fn(),
    transaction: jest.fn(async (callback: (executor: DbExecutor) => Promise<unknown>) =>
        callback(publicTxExecutor as unknown as DbExecutor)
    )
} as unknown as DbExecutor
const requestExecutorQuery = jest.fn(async (_sql: string, _params?: unknown[]): Promise<unknown[]> => [])
const requestExecutor = { query: requestExecutorQuery } as unknown as DbExecutor
requestExecutor.transaction = async <T>(callback: (executor: DbExecutor) => Promise<T>) => callback(requestExecutor)
requestExecutor.isReleased = () => false
const mockLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler

const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.header('authorization')?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' })
    const id = req.header('x-user-id') ?? actorId
    ;(req as Request & { user?: { id: string } }).user = { id }
    return next()
}

const buildApp = (validateQuizLink = validatePublicQuizAccessLink) => {
    const app = express()
    app.use(express.json())
    app.use(
        '/api/v1',
        createGlobalShortLinksRoutes(
            ensureAuth,
            () => poolExecutor,
            mockLimiter,
            mockLimiter,
            () => requestExecutor,
            {
                isPublicQuizAccessLinkAvailable: validateQuizLink,
                lockPublicQuizAccessLink: async () => true,
                listEligiblePublicQuizAccessLinks: mockListEligiblePublicQuizAccessLinks
            }
        )
    )
    return app
}

describe('global short-link HTTP routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsSuperuser.mockResolvedValue(false)
        mockGetApplicationMembership.mockImplementation(async (_executor, userId, targetApplicationId) =>
            targetApplicationId === applicationId
                ? ({ userId, applicationId: targetApplicationId, role: 'owner', _uplCreatedAt: new Date() } as never)
                : null
        )
        mockFindActiveGlobalShortLinkApplicationId.mockResolvedValue(applicationId)
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(target)
        mockLockActiveGlobalShortLinkApplication.mockResolvedValue(true)
        mockCreateGlobalShortLink.mockResolvedValue(record)
        mockListGlobalShortLinks.mockResolvedValue([record])
        mockReleaseGlobalShortLink.mockResolvedValue(releasedRecord)
        mockResolvePublicApplication.mockResolvedValue({
            application: {
                id: applicationId,
                schemaName: 'app_018f8a787b8f7c1da111222233334444',
                workspacesEnabled: true
            }
        } as never)
        mockListGlobalShortLinkResourceOptions.mockResolvedValue([{ targetKind: 'page', entityTypeCodename: 'home', label: 'Home' }])
        mockIsGlobalShortLinkApplicationResourceAvailable.mockResolvedValue(true)
        validatePublicQuizAccessLink.mockResolvedValue(true)
        mockListEligiblePublicQuizAccessLinks.mockImplementation(async (_req, res) => {
            return res.status(200).json({
                items: [
                    {
                        slug: 'grade-5',
                        label: 'Grade 5 Marathon',
                        workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269',
                        workspaceLabel: 'Public workspace'
                    }
                ]
            })
        })
    })

    it('returns only the typed allowlisted target from the anonymous resolver', async () => {
        const response = await request(buildApp()).get('/api/v1/public/l/Meridian').expect(200)

        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body).toEqual({ target })
        expect(Object.keys(response.body)).toEqual(['target'])
        expect(response.headers.location).toBeUndefined()
        expect(mockFindActiveGlobalShortLinkTarget).toHaveBeenCalledWith(publicTxExecutor, 'meridian')
        expect(mockResolvePublicApplication).toHaveBeenCalledWith(publicTxExecutor, applicationId)
        expect(publicTxExecutor.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
    })

    it('serves only currently available resource options to an authorized application manager', async () => {
        const response = await request(buildApp())
            .get(`/api/v1/global-short-links/applications/${applicationId}/application-resource-options?locale=en`)
            .set('Authorization', 'Bearer test-token')
            .expect(200)

        expect(response.body).toEqual({ items: [{ targetKind: 'page', entityTypeCodename: 'home', label: 'Home' }] })
        expect(mockGetApplicationMembership).toHaveBeenCalledWith(requestExecutor, actorId, applicationId)
        expect(mockListGlobalShortLinkResourceOptions).toHaveBeenCalledWith(requestExecutor, 'app_018f8a787b8f7c1da111222233334444', 'en')
        expect(mockIsGlobalShortLinkApplicationResourceAvailable).toHaveBeenCalledWith(
            requestExecutor,
            expect.objectContaining({ id: applicationId }),
            { kind: 'application-resource', applicationId, targetKind: 'page', entityTypeCodename: 'home' }
        )
    })

    it.each(['missing-link', 'released-link'])('returns the same not-found response for %s', async (slug) => {
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(null)

        const response = await request(buildApp()).get(`/api/v1/public/l/${slug}`).expect(404)

        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.body).toEqual({ code: 'GLOBAL_SHORT_LINK_NOT_FOUND' })
    })

    it('uses the public-application readiness policy and hides unavailable applications', async () => {
        mockResolvePublicApplication.mockRejectedValue(new PublicApplicationUnavailableError('application_private'))

        const response = await request(buildApp()).get('/api/v1/public/l/meridian').expect(404)

        expect(response.body).toEqual({ code: 'GLOBAL_SHORT_LINK_NOT_FOUND' })
        expect(JSON.stringify(response.body)).not.toContain(applicationId)
    })

    it('fails closed for target kinds without a supported published runtime adapter', async () => {
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue({
            kind: 'unsupported-target',
            applicationId
        } as unknown as GlobalShortLinkTarget)
        await request(buildApp()).get('/api/v1/public/l/meridian').expect(404, { code: 'GLOBAL_SHORT_LINK_NOT_FOUND' })
        expect(mockResolvePublicApplication).not.toHaveBeenCalled()
    })

    it('rejects unsupported destination sections before storing a dead link', async () => {
        await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .send({ slug: 'unavailable-target', target: { kind: 'application-section', applicationId, section: 'reports' } })
            .expect(400)

        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('rejects a quiz destination that is not currently available', async () => {
        validatePublicQuizAccessLink.mockResolvedValue(false)
        const quizTarget: GlobalShortLinkTarget = {
            kind: 'lms-access-link',
            applicationId,
            accessLinkId,
            accessLinkSlug: 'grade-5',
            workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        }
        requestExecutorQuery.mockResolvedValueOnce([{ id: quizTarget.workspaceId }])

        await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .send({ slug: 'marathon-grade-5', target: quizTarget })
            .expect(422, { code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })

        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('resolves an LMS short link only when its quiz access link is still available', async () => {
        const quizTarget: GlobalShortLinkTarget = {
            kind: 'lms-access-link',
            applicationId,
            accessLinkId,
            accessLinkSlug: 'grade-5',
            workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        }
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(quizTarget)

        const response = await request(buildApp()).get('/api/v1/public/l/marathon-grade-5').expect(200)

        expect(response.body).toEqual({ target: quizTarget })
        expect(validatePublicQuizAccessLink).toHaveBeenCalledWith(
            publicTxExecutor,
            applicationId,
            accessLinkId,
            'grade-5',
            '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        )
        validatePublicQuizAccessLink.mockResolvedValue(false)
        mockFindActiveGlobalShortLinkTarget.mockResolvedValueOnce(quizTarget)
        await request(buildApp()).get('/api/v1/public/l/marathon-grade-5').expect(404, { code: 'GLOBAL_SHORT_LINK_NOT_FOUND' })
    })

    it('resolves an allowlisted application section only after application readiness passes', async () => {
        const sectionTarget: GlobalShortLinkTarget = { kind: 'application-section', applicationId, section: 'workspace' }
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(sectionTarget)

        const response = await request(buildApp()).get('/api/v1/public/l/meridian').expect(200)

        expect(response.body).toEqual({ target: sectionTarget })
        expect(mockResolvePublicApplication).toHaveBeenCalledWith(publicTxExecutor, applicationId)
    })

    it('rejects unauthenticated create and release requests before touching the store', async () => {
        const app = buildApp()

        await request(app).post('/api/v1/global-short-links').send({ slug: 'meridian', target }).expect(401)
        await request(app).post(`/api/v1/global-short-links/${linkId}/release`).expect(401)

        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
        expect(mockReleaseGlobalShortLink).not.toHaveBeenCalled()
        expect(mockGetApplicationMembership).not.toHaveBeenCalled()
    })

    it('rejects targets containing arbitrary URL data through the shared Zod contract', async () => {
        const response = await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .send({
                slug: 'external',
                target: { kind: 'application-entry', applicationId, url: 'https://example.test' }
            })
            .expect(400)

        expect(response.body.error).toBe('Invalid request')
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('rejects an authenticated request with an invalid actor identity', async () => {
        await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .set('x-user-id', 'not-a-uuid')
            .send({ slug: 'meridian', target })
            .expect(401)

        expect(mockGetApplicationMembership).not.toHaveBeenCalled()
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('accepts existing authenticated users with a valid non-v7 UUID actor ID', async () => {
        const legacyAuthUserId = '550e8400-e29b-41d4-a716-446655440000'

        await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .set('x-user-id', legacyAuthUserId)
            .send({ slug: 'meridian', target })
            .expect(201)

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(requestExecutor, legacyAuthUserId, applicationId)
        expect(mockCreateGlobalShortLink).toHaveBeenCalledWith(requestExecutor, { slug: 'meridian', target }, legacyAuthUserId)
    })

    it('lets a same-application owner create, list, and release through request-scoped RLS', async () => {
        const app = buildApp()

        const created = await request(app)
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .send({ slug: 'meridian', target })
            .expect(201)
        expect(created.body).toEqual(record)

        const listed = await request(app)
            .get(`/api/v1/global-short-links?applicationId=${applicationId}&includeReleased=true&limit=25&offset=5`)
            .set('Authorization', 'Bearer test-token')
            .expect(200)
        expect(listed.body).toEqual({ items: [record], limit: 25, offset: 5 })

        const released = await request(app)
            .post(`/api/v1/global-short-links/${linkId}/release`)
            .set('Authorization', 'Bearer test-token')
            .expect(200)
        expect(released.body).toEqual(releasedRecord)
        expect(released.body.releasedAt).toBeTruthy()

        expect(mockCreateGlobalShortLink).toHaveBeenCalledWith(requestExecutor, { slug: 'meridian', target }, actorId)
        expect(mockListGlobalShortLinks).toHaveBeenCalledWith(requestExecutor, {
            applicationId,
            includeReleased: true,
            limit: 25,
            offset: 5
        })
        expect(mockFindActiveGlobalShortLinkApplicationId).toHaveBeenCalledWith(requestExecutor, linkId)
        expect(mockReleaseGlobalShortLink).toHaveBeenCalledWith(requestExecutor, linkId, applicationId, actorId)
        expect(mockGetApplicationMembership.mock.calls).toEqual([
            [requestExecutor, actorId, applicationId],
            [requestExecutor, actorId, applicationId],
            [requestExecutor, actorId, applicationId]
        ])
    })

    it('lists only safe localized quiz-link selector fields for the requested application manager', async () => {
        const response = await request(buildApp())
            .get(`/api/v1/global-short-links/applications/${applicationId}/quiz-access-options?locale=ru`)
            .set('Authorization', 'Bearer test-token')
            .expect(200)

        expect(response.body).toEqual({
            items: [
                {
                    slug: 'grade-5',
                    label: 'Grade 5 Marathon',
                    workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312269',
                    workspaceLabel: 'Public workspace'
                }
            ]
        })
        expect(JSON.stringify(response.body)).not.toContain(applicationId)
        expect(mockListEligiblePublicQuizAccessLinks).toHaveBeenCalledWith(
            expect.objectContaining({
                params: expect.objectContaining({ applicationId }),
                query: { locale: 'ru' }
            }),
            expect.any(Object)
        )
        expect(mockGetApplicationMembership).toHaveBeenCalledWith(requestExecutor, actorId, applicationId)
    })

    it.each([
        `/api/v1/global-short-links/applications/not-a-uuid/quiz-access-options`,
        `/api/v1/global-short-links/applications/${applicationId}/quiz-access-options?locale=xx`,
        `/api/v1/global-short-links/applications/${applicationId}/quiz-access-options?unexpected=true`
    ])('rejects malformed quiz selector query %s before calling the runtime', async (path) => {
        await request(buildApp()).get(path).set('Authorization', 'Bearer test-token').expect(400)
        expect(mockListEligiblePublicQuizAccessLinks).not.toHaveBeenCalled()
    })

    it('requires an application scope for registry listing', async () => {
        await request(buildApp()).get('/api/v1/global-short-links').set('Authorization', 'Bearer test-token').expect(400)
        expect(mockGetApplicationMembership).not.toHaveBeenCalled()
        expect(mockListGlobalShortLinks).not.toHaveBeenCalled()
    })

    it('denies list and release across applications for a manager of another application', async () => {
        mockFindActiveGlobalShortLinkApplicationId.mockResolvedValue(otherApplicationId)

        await request(buildApp())
            .get(`/api/v1/global-short-links?applicationId=${otherApplicationId}`)
            .set('Authorization', 'Bearer test-token')
            .expect(403)
        await request(buildApp()).post(`/api/v1/global-short-links/${linkId}/release`).set('Authorization', 'Bearer test-token').expect(403)

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(requestExecutor, actorId, otherApplicationId)
        expect(mockFindActiveGlobalShortLinkApplicationId).toHaveBeenCalledWith(requestExecutor, linkId)
        expect(mockListGlobalShortLinks).not.toHaveBeenCalled()
        expect(mockReleaseGlobalShortLink).not.toHaveBeenCalled()
    })

    it('denies creation for a target application the actor does not manage', async () => {
        await request(buildApp())
            .post('/api/v1/global-short-links')
            .set('Authorization', 'Bearer test-token')
            .send({ slug: 'other-app-link', target: { kind: 'application-entry', applicationId: otherApplicationId } })
            .expect(403)

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(requestExecutor, actorId, otherApplicationId)
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('lets a superuser manage a target application without an application membership', async () => {
        mockIsSuperuser.mockResolvedValue(true)

        await request(buildApp())
            .get(`/api/v1/global-short-links?applicationId=${otherApplicationId}`)
            .set('Authorization', 'Bearer test-token')
            .expect(200)

        expect(mockGetApplicationMembership).not.toHaveBeenCalled()
        expect(mockListGlobalShortLinks).toHaveBeenCalledWith(
            requestExecutor,
            expect.objectContaining({ applicationId: otherApplicationId })
        )
    })
})
