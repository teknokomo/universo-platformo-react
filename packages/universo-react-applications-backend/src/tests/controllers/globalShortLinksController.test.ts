import type { Request, Response } from 'express'
import type { GlobalShortLinkRecord, GlobalShortLinkTarget } from '@universo-react/types'

jest.mock('@universo-react/admin-backend', () => ({ isSuperuser: jest.fn() }))

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
    releaseGlobalShortLink: jest.fn()
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
import { getApplicationMembership } from '../../routes/guards'
import { PublicApplicationUnavailableError, resolvePublicApplication } from '../../services/publicApplicationRuntime'
import { createGlobalShortLinksController } from '../../controllers/globalShortLinksController'
import { createMockDbExecutor } from '../utils/dbMocks'

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
const mockIsPublicQuizAccessLinkAvailable = jest.fn()
const mockLockPublicQuizAccessLink = jest.fn()

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const otherApplicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312272'
const linkId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const actorId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
const target: GlobalShortLinkTarget = { kind: 'application-entry', applicationId }
const workspaceQuizTarget: GlobalShortLinkTarget = {
    kind: 'lms-access-link',
    applicationId,
    accessLinkId: linkId,
    accessLinkSlug: 'grade-7-quiz',
    workspaceId
}
const record: GlobalShortLinkRecord = {
    id: linkId,
    slug: 'meridian',
    target,
    releasedAt: null,
    createdAt: '2026-10-11T10:00:00.000Z',
    updatedAt: '2026-10-11T10:00:00.000Z'
}

const { executor, txExecutor } = createMockDbExecutor()
const createController = (listEligiblePublicQuizAccessLinks = jest.fn()) =>
    createGlobalShortLinksController(
        () => executor,
        () => executor,
        {
            isPublicQuizAccessLinkAvailable: mockIsPublicQuizAccessLinkAvailable,
            lockPublicQuizAccessLink: mockLockPublicQuizAccessLink,
            listEligiblePublicQuizAccessLinks
        }
    )

const makeRequest = (overrides: Partial<Request> = {}) =>
    ({ user: { id: actorId }, params: {}, query: {}, body: {}, ...overrides } as Request)

const makeResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn(),
        setHeader: jest.fn()
    }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return { response: response as unknown as Response, status: response.status, json: response.json }
}

describe('global short-link controller application authorization', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsPublicQuizAccessLinkAvailable.mockResolvedValue(true)
        mockLockPublicQuizAccessLink.mockResolvedValue(true)
        mockIsSuperuser.mockResolvedValue(false)
        mockGetApplicationMembership.mockImplementation(async (_executor, userId, requestedApplicationId) =>
            requestedApplicationId === applicationId
                ? ({ userId, applicationId: requestedApplicationId, role: 'owner', _uplCreatedAt: new Date() } as never)
                : null
        )
        mockCreateGlobalShortLink.mockResolvedValue(record)
        mockFindActiveGlobalShortLinkTarget.mockResolvedValue(workspaceQuizTarget)
        mockListGlobalShortLinks.mockResolvedValue([record])
        mockFindActiveGlobalShortLinkApplicationId.mockResolvedValue(applicationId)
        mockLockActiveGlobalShortLinkApplication.mockResolvedValue(true)
        mockReleaseGlobalShortLink.mockResolvedValue(record)
        mockResolvePublicApplication.mockResolvedValue({
            application: { id: applicationId, schemaName: 'app_018f8a787b8f7c1da111222233334444', workspacesEnabled: true }
        } as never)
        mockListGlobalShortLinkResourceOptions.mockResolvedValue([
            { targetKind: 'page', entityTypeCodename: 'home', label: 'Главная' },
            { targetKind: 'object', entityTypeCodename: 'quizzes', label: 'Тесты' }
        ])
        mockIsGlobalShortLinkApplicationResourceAvailable.mockResolvedValue(true)
    })

    it('allows a target-application owner to list and create without global alias permissions', async () => {
        const controller = createController()
        const listResponse = makeResponse()
        await controller.list(makeRequest({ query: { applicationId } }), listResponse.response)

        expect(listResponse.status).toHaveBeenCalledWith(200)
        expect(mockListGlobalShortLinks).toHaveBeenCalledWith(executor, expect.objectContaining({ applicationId }))

        const createResponse = makeResponse()
        await controller.create(makeRequest({ body: { slug: 'meridian', target } }), createResponse.response)

        expect(createResponse.status).toHaveBeenCalledWith(201)
        expect(mockLockActiveGlobalShortLinkApplication).toHaveBeenCalledWith(txExecutor, applicationId)
        expect(mockCreateGlobalShortLink).toHaveBeenCalledWith(txExecutor, { slug: 'meridian', target }, actorId)
    })

    it('rejects link creation if the application is deleted before its row lock is acquired', async () => {
        mockLockActiveGlobalShortLinkApplication.mockResolvedValue(false)
        const controller = createController()
        const response = makeResponse()

        await controller.create(makeRequest({ body: { slug: 'meridian', target } }), response.response)

        expect(response.status).toHaveBeenCalledWith(422)
        expect(response.json).toHaveBeenCalledWith({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })
        expect(mockResolvePublicApplication).not.toHaveBeenCalled()
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('locks the target workspace while creating a workspace-scoped LMS short link', async () => {
        txExecutor.query.mockImplementation(async (sql: string) => (sql.includes('"_app_workspaces"') ? [{ id: workspaceId }] : []))
        mockCreateGlobalShortLink.mockResolvedValueOnce({ ...record, target: workspaceQuizTarget })
        const controller = createController()
        const response = makeResponse()

        await controller.create(makeRequest({ body: { slug: 'grade-7-marathon', target: workspaceQuizTarget } }), response.response)

        expect(txExecutor.query).toHaveBeenCalledWith(expect.stringContaining('FOR SHARE'), [workspaceId])
        expect(mockLockPublicQuizAccessLink).toHaveBeenCalledWith(txExecutor, applicationId, linkId, 'grade-7-quiz', workspaceId)
        expect(mockLockPublicQuizAccessLink.mock.invocationCallOrder[0]).toBeLessThan(
            mockIsPublicQuizAccessLinkAvailable.mock.invocationCallOrder[0]
        )
        expect(mockCreateGlobalShortLink).toHaveBeenCalledWith(
            txExecutor,
            { slug: 'grade-7-marathon', target: workspaceQuizTarget },
            actorId
        )
        expect(response.status).toHaveBeenCalledWith(201)
    })

    it('does not create an LMS short link if its access-link row disappeared before the lock', async () => {
        txExecutor.query.mockImplementation(async (sql: string) => (sql.includes('"_app_workspaces"') ? [{ id: workspaceId }] : []))
        mockLockPublicQuizAccessLink.mockResolvedValueOnce(false)
        const controller = createController()
        const response = makeResponse()

        await controller.create(makeRequest({ body: { slug: 'grade-7-marathon', target: workspaceQuizTarget } }), response.response)

        expect(response.status).toHaveBeenCalledWith(422)
        expect(response.json).toHaveBeenCalledWith({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })
        expect(mockIsPublicQuizAccessLinkAvailable).not.toHaveBeenCalled()
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('refuses a workspace-scoped LMS short link when its workspace is already archived', async () => {
        txExecutor.query.mockImplementation(async () => [])
        const controller = createController()
        const response = makeResponse()

        await controller.create(makeRequest({ body: { slug: 'grade-7-marathon', target: workspaceQuizTarget } }), response.response)

        expect(response.status).toHaveBeenCalledWith(422)
        expect(response.json).toHaveBeenCalledWith({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })

    it('resolves a workspace-scoped LMS short link without a repeatable-read row lock', async () => {
        txExecutor.query.mockResolvedValue([])
        const controller = createController()
        const response = makeResponse()

        await controller.resolve(makeRequest({ params: { slug: 'grade-7-marathon' } }), response.response)

        expect(mockFindActiveGlobalShortLinkTarget).toHaveBeenCalledWith(txExecutor, 'grade-7-marathon')
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('FOR SHARE'))).toBe(false)
        expect(response.status).toHaveBeenCalledWith(200)
    })

    it('denies an unrelated application manager from listing another application', async () => {
        const controller = createController()
        const response = makeResponse()

        await controller.list(makeRequest({ query: { applicationId: otherApplicationId } }), response.response)

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(executor, actorId, otherApplicationId)
        expect(response.status).toHaveBeenCalledWith(403)
        expect(mockListGlobalShortLinks).not.toHaveBeenCalled()
    })

    it('denies a cross-application release before updating the link', async () => {
        mockFindActiveGlobalShortLinkApplicationId.mockResolvedValue(otherApplicationId)
        const controller = createController()
        const response = makeResponse()

        await controller.release(makeRequest({ params: { id: linkId } }), response.response)

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(executor, actorId, otherApplicationId)
        expect(response.status).toHaveBeenCalledWith(403)
        expect(mockReleaseGlobalShortLink).not.toHaveBeenCalled()
    })

    it('authorizes quiz options against only the application id in the request path', async () => {
        const listEligiblePublicQuizAccessLinks = jest.fn()
        const controller = createController(listEligiblePublicQuizAccessLinks)
        const response = makeResponse()

        await controller.listQuizAccessOptions(
            makeRequest({ params: { applicationId: otherApplicationId }, query: { locale: 'ru' } }),
            response.response
        )

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(executor, actorId, otherApplicationId)
        expect(response.status).toHaveBeenCalledWith(403)
        expect(listEligiblePublicQuizAccessLinks).not.toHaveBeenCalled()
    })

    it('returns no quiz options when the authorized application is not yet public', async () => {
        mockResolvePublicApplication.mockRejectedValueOnce(new PublicApplicationUnavailableError('application_unpublished'))
        const listEligiblePublicQuizAccessLinks = jest.fn()
        const controller = createController(listEligiblePublicQuizAccessLinks)
        const response = makeResponse()

        await controller.listQuizAccessOptions(makeRequest({ params: { applicationId }, query: { locale: 'en' } }), response.response)

        expect(response.status).toHaveBeenCalledWith(200)
        expect(response.json).toHaveBeenCalledWith({ items: [] })
        expect(listEligiblePublicQuizAccessLinks).not.toHaveBeenCalled()
    })

    it('lists only available published application resource options for an authorized application manager', async () => {
        mockIsGlobalShortLinkApplicationResourceAvailable.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
        const controller = createController()
        const response = makeResponse()

        await controller.listApplicationResourceOptions(
            makeRequest({ params: { applicationId }, query: { locale: 'ru' } }),
            response.response
        )

        expect(mockGetApplicationMembership).toHaveBeenCalledWith(executor, actorId, applicationId)
        expect(mockListGlobalShortLinkResourceOptions).toHaveBeenCalledWith(executor, 'app_018f8a787b8f7c1da111222233334444', 'ru')
        expect(mockIsGlobalShortLinkApplicationResourceAvailable).toHaveBeenNthCalledWith(
            1,
            executor,
            expect.objectContaining({ id: applicationId }),
            { kind: 'application-resource', applicationId, targetKind: 'page', entityTypeCodename: 'home' }
        )
        expect(response.json).toHaveBeenCalledWith({
            items: [{ targetKind: 'object', entityTypeCodename: 'quizzes', label: 'Тесты' }]
        })
    })

    it('creates an application resource link only after public layout availability is verified', async () => {
        const resourceTarget: GlobalShortLinkTarget = {
            kind: 'application-resource',
            applicationId,
            targetKind: 'page',
            entityTypeCodename: 'home'
        }
        const controller = createController()
        const response = makeResponse()

        await controller.create(makeRequest({ body: { slug: 'lyceum-home', target: resourceTarget } }), response.response)

        expect(mockIsGlobalShortLinkApplicationResourceAvailable).toHaveBeenCalledWith(
            txExecutor,
            expect.objectContaining({ id: applicationId }),
            resourceTarget
        )
        expect(mockCreateGlobalShortLink).toHaveBeenCalledWith(txExecutor, { slug: 'lyceum-home', target: resourceTarget }, actorId)
        expect(response.status).toHaveBeenCalledWith(201)
    })

    it('does not persist an application resource link when the public layout is unavailable', async () => {
        mockIsGlobalShortLinkApplicationResourceAvailable.mockResolvedValue(false)
        const controller = createController()
        const response = makeResponse()

        await controller.create(
            makeRequest({
                body: {
                    slug: 'missing-resource',
                    target: { kind: 'application-resource', applicationId, targetKind: 'object', entityTypeCodename: 'missing' }
                }
            }),
            response.response
        )

        expect(response.status).toHaveBeenCalledWith(422)
        expect(response.json).toHaveBeenCalledWith({ code: 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE' })
        expect(mockCreateGlobalShortLink).not.toHaveBeenCalled()
    })
})
