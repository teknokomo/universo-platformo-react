jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: jest.fn()
}))

jest.mock('../../services/applicationBotBindings', () => ({
    ApplicationBotBindingApplicationNotFoundError: class ApplicationBotBindingApplicationNotFoundError extends Error {},
    ApplicationBotBindingIdentityConflictError: class ApplicationBotBindingIdentityConflictError extends Error {},
    InvalidMessengerBotUsernameError: jest.requireActual('../../services/messengerBotBindingIdentity').InvalidMessengerBotUsernameError,
    createApplicationBotBindingsService: jest.fn()
}))

import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import { ensureApplicationAccess } from '../../routes/guards'
import {
    ApplicationBotBindingApplicationNotFoundError,
    ApplicationBotBindingIdentityConflictError,
    createApplicationBotBindingsService
} from '../../services/applicationBotBindings'
import {
    createApplicationBotBindingsController,
    createMessengerBindingAttributionController
} from '../../controllers/applicationBotBindingsController'

const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312299'
const bindingId = '019ccefc-2f7b-7b36-82f4-85cdb1312300'
const bindingService = {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    release: jest.fn(),
    resolvePublicAttribution: jest.fn()
}

const createResponse = () => {
    const response = {
        status: jest.fn(),
        json: jest.fn()
    }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response & { status: jest.Mock; json: jest.Mock }
}

const createRequest = (body: unknown, params: Record<string, string> = {}) =>
    ({
        body,
        params: { applicationId, ...params },
        user: { id: userId }
    } as unknown as Request)

describe('Application bot binding controller', () => {
    const transactionExecutor = {
        query: jest.fn(),
        transaction: jest.fn(),
        isReleased: jest.fn().mockReturnValue(false)
    } as unknown as DbExecutor
    const executor = {
        query: jest.fn(),
        transaction: jest.fn(async (callback: (transaction: DbExecutor) => Promise<unknown>) => callback(transactionExecutor)),
        isReleased: jest.fn().mockReturnValue(false)
    } as unknown as DbExecutor
    const controller = createApplicationBotBindingsController(() => executor)

    beforeEach(() => {
        jest.clearAllMocks()
        bindingService.list.mockReset()
        bindingService.create.mockReset()
        bindingService.update.mockReset()
        bindingService.release.mockReset()
        bindingService.resolvePublicAttribution.mockReset()
        ;(createApplicationBotBindingsService as jest.Mock).mockReturnValue(bindingService)
        ;(executor.transaction as jest.Mock).mockImplementation(async (callback: (transaction: DbExecutor) => Promise<unknown>) =>
            callback(transactionExecutor)
        )
    })

    it.each([
        ['list', {}],
        ['create', { platform: 'telegram', botUsername: 'my_testbot' }],
        ['update', { status: 'active', expectedVersion: 1 }],
        ['release', { expectedVersion: 1 }]
    ] as const)('rejects a non-v7 application path id before DB access on %s', async (method, body) => {
        const response = createResponse()
        const request = createRequest(body, { applicationId: '018f8a78-7b8f-4c1d-a111-2222333344a3', bindingId })

        await controller[method](request, response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({ error: 'Invalid application id' })
        expect(ensureApplicationAccess).not.toHaveBeenCalled()
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('requires owner or admin access and stores normalized username without a secret surface', async () => {
        const binding = {
            id: bindingId,
            applicationId,
            platform: 'telegram',
            botUsername: 'my_testbot',
            displayName: null,
            status: 'draft',
            shortId: 'AAAAAAAAAAAAAAAAAAAAAA',
            releasedAt: null,
            version: 1,
            createdAt: '2026-10-31T00:00:00.000Z',
            updatedAt: '2026-10-31T00:00:00.000Z'
        }
        bindingService.create.mockResolvedValue(binding)
        const response = createResponse()

        await controller.create(createRequest({ platform: 'telegram', botUsername: ' @My_TestBot ' }), response)

        expect(ensureApplicationAccess).toHaveBeenCalledWith(transactionExecutor, userId, applicationId, ['owner', 'admin'])
        expect(createApplicationBotBindingsService).toHaveBeenCalledWith(transactionExecutor)
        expect(bindingService.create).toHaveBeenCalledWith(expect.objectContaining({ platform: 'telegram', botUsername: 'my_testbot' }))
        expect(response.status).toHaveBeenCalledWith(201)
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ id: bindingId, botUsername: 'my_testbot' }))
    })

    it('rejects secret or messenger identity input without echoing the field or value', async () => {
        const response = createResponse()
        await controller.create(createRequest({ platform: 'max', botUsername: 'mabcdefghijbot', botToken: 'do-not-echo-this' }), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({ error: 'Secret and messenger identity fields are not accepted' })
        expect(String(response.json.mock.calls[0]?.[0])).not.toContain('do-not-echo-this')
        expect(bindingService.create).not.toHaveBeenCalled()
    })

    it.each([
        ['firstName', 'private-first-name'],
        ['full_name', 'private-full-name'],
        ['surname', 'private-surname'],
        ['dateOfBirth', 'private-birth-date']
    ])('rejects personal identity field %s without echoing its value', async (field, value) => {
        const response = createResponse()
        await controller.create(createRequest({ platform: 'telegram', botUsername: 'my_testbot', [field]: value }), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({ error: 'Secret and messenger identity fields are not accepted' })
        expect(String(response.json.mock.calls[0]?.[0])).not.toContain(value)
        expect(bindingService.create).not.toHaveBeenCalled()
    })

    it('bounds secret-field scanning for deeply nested untrusted request bodies', async () => {
        const response = createResponse()
        const body: Record<string, unknown> = { platform: 'max', botUsername: 'mabcdefghijbot' }
        let current = body
        for (let index = 0; index < 40; index += 1) {
            const nested: Record<string, unknown> = {}
            current.nested = nested
            current = nested
        }

        await controller.create(createRequest(body), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(response.json).toHaveBeenCalledWith({ error: 'Secret and messenger identity fields are not accepted' })
        expect(bindingService.create).not.toHaveBeenCalled()
    })

    it.each(['array', 'object'] as const)(
        'bounds queued work for wide untrusted request bodies before walking every child (%s)',
        async (kind) => {
            const response = createResponse()
            const wideValue =
                kind === 'array'
                    ? { metadata: new Array(10_001).fill(null) }
                    : Object.fromEntries(Array.from({ length: 10_001 }, (_, index) => [`metadata${index}`, null]))
            const body = { platform: 'max', botUsername: 'mabcdefghijbot', ...wideValue }

            await controller.create(createRequest(body), response)

            expect(response.status).toHaveBeenCalledWith(400)
            expect(response.json).toHaveBeenCalledWith({ error: 'Secret and messenger identity fields are not accepted' })
            expect(bindingService.create).not.toHaveBeenCalled()
        }
    )

    it('rejects MAX usernames without a bot suffix before persistence', async () => {
        const response = createResponse()
        await controller.create(createRequest({ platform: 'max', botUsername: 'MABCDEFGHIJ' }), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(bindingService.create).not.toHaveBeenCalled()
    })

    it('requires expectedVersion and strict fields for binding updates', async () => {
        const response = createResponse()
        await controller.update(createRequest({ status: 'active' }, { bindingId }), response)

        expect(response.status).toHaveBeenCalledWith(400)
        expect(bindingService.update).not.toHaveBeenCalled()

        const strictResponse = createResponse()
        await controller.update(createRequest({ status: 'active', expectedVersion: 1, extra: true }, { bindingId }), strictResponse)
        expect(strictResponse.status).toHaveBeenCalledWith(400)
    })

    it('validates updates against the stored platform and uses optimistic versioning', async () => {
        bindingService.update.mockResolvedValue({ id: bindingId, status: 'active', version: 2 })
        const response = createResponse()

        await controller.update(
            createRequest({ botUsername: 'MABCDEFGHIJbot', status: 'active', expectedVersion: 1 }, { bindingId }),
            response
        )

        expect(bindingService.update).toHaveBeenCalledWith(expect.objectContaining({ botUsername: 'MABCDEFGHIJbot', expectedVersion: 1 }))
        expect(response.json).toHaveBeenCalledWith({ id: bindingId, status: 'active', version: 2 })
    })

    it('delegates public reference and short-id attribution to the application service', async () => {
        bindingService.resolvePublicAttribution.mockResolvedValue('telegram')
        const response = createResponse()
        const attribution = createMessengerBindingAttributionController(() => executor)

        await attribution.resolveAttribution(
            createRequest({}, { applicationRef: 'seventy-third-meridian', shortId: 'AAAAAAAAAAAAAAAAAAAAAA' }),
            response
        )

        expect(createApplicationBotBindingsService).toHaveBeenCalledWith(transactionExecutor)
        expect(bindingService.resolvePublicAttribution).toHaveBeenCalledWith('seventy-third-meridian', 'AAAAAAAAAAAAAAAAAAAAAA')
        expect(response.json).toHaveBeenCalledWith({ platform: 'telegram' })
        expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('applicationId')
    })

    it('returns null for an invalid short id and does not expose binding or Application identifiers', async () => {
        bindingService.resolvePublicAttribution.mockResolvedValue(null)
        const response = createResponse()
        const attribution = createMessengerBindingAttributionController(() => executor)

        await attribution.resolveAttribution(
            createRequest({}, { applicationRef: 'seventy-third-meridian', shortId: 'invalid-short-id' }),
            response
        )

        expect(bindingService.resolvePublicAttribution).toHaveBeenCalledWith('seventy-third-meridian', 'invalid-short-id')
        expect(response.json).toHaveBeenCalledWith({ platform: null })
        expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('bindingId')
        expect(response.json.mock.calls[0]?.[0]).not.toHaveProperty('applicationId')
    })

    it('returns null for disabled or unavailable bindings', async () => {
        bindingService.resolvePublicAttribution.mockResolvedValueOnce(null)
        const response = createResponse()
        const attribution = createMessengerBindingAttributionController(() => executor)

        await attribution.resolveAttribution(
            createRequest({}, { applicationRef: applicationId, shortId: 'BBBBBBBBBBBBBBBBBBBBBB' }),
            response
        )

        expect(response.json).toHaveBeenCalledWith({ platform: null })
        expect(bindingService.resolvePublicAttribution).toHaveBeenCalledWith(applicationId, 'BBBBBBBBBBBBBBBBBBBBBB')
    })

    it('lists bindings only after the existing application manager authorization check', async () => {
        bindingService.list.mockResolvedValue([])
        const response = createResponse()
        await controller.list(createRequest(undefined), response)

        expect(ensureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId, ['owner', 'admin'])
        expect(createApplicationBotBindingsService).toHaveBeenCalledWith(executor)
        expect(bindingService.list).toHaveBeenCalledWith(applicationId)
        expect(response.json).toHaveBeenCalledWith({ items: [] })
    })

    it('uses expectedVersion for irreversible release', async () => {
        bindingService.release.mockResolvedValue({ id: bindingId, version: 3 })
        const response = createResponse()

        await controller.release(createRequest({ expectedVersion: 2 }, { bindingId }), response)

        expect(bindingService.release).toHaveBeenCalledWith(expect.objectContaining({ applicationId, bindingId, expectedVersion: 2 }))
        expect(response.json).toHaveBeenCalledWith({ id: bindingId, version: 3 })
    })

    it('maps service conflicts and missing applications to existing HTTP responses', async () => {
        bindingService.create.mockRejectedValueOnce(new ApplicationBotBindingIdentityConflictError())
        const conflictResponse = createResponse()
        await controller.create(createRequest({ platform: 'telegram', botUsername: 'my_testbot' }), conflictResponse)
        expect(conflictResponse.status).toHaveBeenCalledWith(409)

        bindingService.create.mockRejectedValueOnce(new ApplicationBotBindingApplicationNotFoundError())
        const missingResponse = createResponse()
        await controller.create(createRequest({ platform: 'telegram', botUsername: 'my_testbot' }), missingResponse)
        expect(missingResponse.status).toHaveBeenCalledWith(404)
    })

    it.each([
        ['update', { status: 'active', expectedVersion: 1 }],
        ['release', { expectedVersion: 1 }]
    ] as const)('maps an Application deletion race during %s to HTTP 404', async (method, body) => {
        bindingService[method].mockRejectedValueOnce(new ApplicationBotBindingApplicationNotFoundError())
        const response = createResponse()

        await controller[method](createRequest(body, { bindingId }), response)

        expect(response.status).toHaveBeenCalledWith(404)
        expect(response.json).toHaveBeenCalledWith({ error: 'Application not found' })
    })
})
