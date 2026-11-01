jest.mock('../../persistence/applicationBotBindingsStore', () => ({
    createApplicationBotBindingInTransaction: jest.fn(),
    findApplicationBotBindingById: jest.fn(),
    listApplicationBotBindings: jest.fn(),
    releaseApplicationBotBindingInTransaction: jest.fn(),
    resolveMessengerBindingAttribution: jest.fn(),
    updateApplicationBotBindingInTransaction: jest.fn()
}))

jest.mock('../../services/publicApplicationRuntime', () => {
    const actual = jest.requireActual('../../services/publicApplicationRuntime')
    return { ...actual, resolvePublicApplication: jest.fn() }
})

import type { DbExecutor } from '@universo-react/utils'
import {
    createApplicationBotBindingInTransaction,
    findApplicationBotBindingById,
    listApplicationBotBindings,
    releaseApplicationBotBindingInTransaction,
    resolveMessengerBindingAttribution,
    updateApplicationBotBindingInTransaction,
    type ApplicationBotBindingRecord
} from '../../persistence/applicationBotBindingsStore'
import { PublicApplicationUnavailableError, resolvePublicApplication } from '../../services/publicApplicationRuntime'
import {
    ApplicationBotBindingApplicationNotFoundError,
    ApplicationBotBindingIdentityConflictError,
    createApplicationBotBindingsService
} from '../../services/applicationBotBindings'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312299'
const bindingId = '019ccefc-2f7b-7b36-82f4-85cdb1312300'
const shortId = 'AAAAAAAAAAAAAAAAAAAAAA'
const executor = { query: jest.fn(), transaction: jest.fn(), isReleased: jest.fn().mockReturnValue(false) } as unknown as DbExecutor

const binding: ApplicationBotBindingRecord = {
    id: bindingId,
    applicationId,
    platform: 'telegram',
    botUsername: 'my_testbot',
    displayName: null,
    status: 'draft',
    shortId,
    releasedAt: null,
    version: 1,
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z')
}

describe('applicationBotBindings service boundary', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('maps persisted list rows to the stable public DTO', async () => {
        ;(listApplicationBotBindings as jest.Mock).mockResolvedValue([{ ...binding, updatedBy: 'private-actor' }])

        const result = await createApplicationBotBindingsService(executor).list(applicationId)

        expect(listApplicationBotBindings).toHaveBeenCalledWith(executor, applicationId)
        expect(result).toEqual([
            {
                ...binding,
                releasedAt: null,
                createdAt: binding.createdAt.toISOString(),
                updatedAt: binding.updatedAt.toISOString()
            }
        ])
        expect(result[0]).not.toHaveProperty('updatedBy')
    })

    it('normalizes create input and maps persistence conflicts to domain errors', async () => {
        ;(createApplicationBotBindingInTransaction as jest.Mock).mockResolvedValue(binding)

        const service = createApplicationBotBindingsService(executor)
        await expect(
            service.create({
                applicationId,
                platform: 'telegram',
                botUsername: ' @My_TestBot ',
                displayName: null
            })
        ).resolves.toEqual({
            ...binding,
            createdAt: binding.createdAt.toISOString(),
            updatedAt: binding.updatedAt.toISOString()
        })
        expect(createApplicationBotBindingInTransaction).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({ botUsername: 'my_testbot' })
        )

        const conflict = Object.assign(new Error('unique conflict'), {
            code: '23505',
            constraint: 'uq_application_bot_bindings_identity'
        })
        ;(createApplicationBotBindingInTransaction as jest.Mock).mockRejectedValueOnce(conflict)
        await expect(
            service.create({
                applicationId,
                platform: 'telegram',
                botUsername: 'my_testbot',
                displayName: null
            })
        ).rejects.toBeInstanceOf(ApplicationBotBindingIdentityConflictError)
        ;(createApplicationBotBindingInTransaction as jest.Mock).mockRejectedValueOnce(
            new Error('Application was not found or is already deleted')
        )
        await expect(
            service.create({
                applicationId,
                platform: 'telegram',
                botUsername: 'my_testbot',
                displayName: null
            })
        ).rejects.toBeInstanceOf(ApplicationBotBindingApplicationNotFoundError)
    })

    it('loads the existing platform before validating and updating a username', async () => {
        ;(findApplicationBotBindingById as jest.Mock).mockResolvedValue({ ...binding, platform: 'max' })
        ;(updateApplicationBotBindingInTransaction as jest.Mock).mockResolvedValue({
            ...binding,
            platform: 'max',
            botUsername: 'mabcdefghijbot'
        })

        const result = await createApplicationBotBindingsService(executor).update({
            applicationId,
            bindingId,
            expectedVersion: 1,
            botUsername: 'MABCDEFGHIJbot'
        })

        expect(findApplicationBotBindingById).toHaveBeenCalledWith(executor, applicationId, bindingId)
        expect(updateApplicationBotBindingInTransaction).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({ botUsername: 'mabcdefghijbot', expectedVersion: 1 })
        )
        expect(result).toEqual(expect.objectContaining({ botUsername: 'mabcdefghijbot' }))
    })

    it('maps a concurrent Application deletion during binding release to a domain 404', async () => {
        ;(releaseApplicationBotBindingInTransaction as jest.Mock).mockRejectedValueOnce(
            new Error('Application was not found or is already deleted')
        )

        await expect(
            createApplicationBotBindingsService(executor).release({ applicationId, bindingId, expectedVersion: 1 })
        ).rejects.toBeInstanceOf(ApplicationBotBindingApplicationNotFoundError)
        expect(releaseApplicationBotBindingInTransaction).toHaveBeenCalledWith(executor, {
            applicationId,
            bindingId,
            expectedVersion: 1
        })
    })

    it('resolves only a public application platform and suppresses unavailable references', async () => {
        ;(resolvePublicApplication as jest.Mock).mockResolvedValue({ application: { id: applicationId } })
        ;(resolveMessengerBindingAttribution as jest.Mock).mockResolvedValue({ platform: 'telegram' })
        const service = createApplicationBotBindingsService(executor)

        await expect(service.resolvePublicAttribution('seventy-third-meridian', shortId)).resolves.toBe('telegram')
        expect(resolvePublicApplication).toHaveBeenCalledWith(executor, 'seventy-third-meridian')
        expect(resolveMessengerBindingAttribution).toHaveBeenCalledWith(executor, applicationId, shortId)
        ;(resolvePublicApplication as jest.Mock).mockRejectedValueOnce(new PublicApplicationUnavailableError('reference_not_found'))
        await expect(service.resolvePublicAttribution('missing-alias', shortId)).resolves.toBeNull()
        expect(resolveMessengerBindingAttribution).toHaveBeenCalledTimes(1)
    })
})
