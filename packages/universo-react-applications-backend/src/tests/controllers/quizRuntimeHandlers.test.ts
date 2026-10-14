import type { Request, Response } from 'express'
import type { DbExecutor } from '@universo-react/utils'
jest.mock('../../shared/publicRuntimeAccess', () => ({
    ...jest.requireActual('../../shared/publicRuntimeAccess'),
    resolvePublicRuntimeSchema: jest.fn()
}))
jest.mock('../../services/publicGuestRuntimeConfig', () => ({
    ...jest.requireActual('../../services/publicGuestRuntimeConfig'),
    resolvePublicGuestRuntimeConfig: jest.fn()
}))

import {
    createGuestRuntimeHandler,
    createPublicQuizAccessLinkAvailabilityCheck,
    createPublicQuizAccessLinkLockCheck
} from '../../controllers/runtimeGuest/quizRuntimeHandlers'
import type { RuntimeGuestServices } from '../../controllers/runtimeGuest/services'
import type { PublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'
import { resolvePublicRuntimeSchema } from '../../shared/publicRuntimeAccess'
import { resolvePublicGuestRuntimeConfig } from '../../services/publicGuestRuntimeConfig'

const mockResolvePublicRuntimeSchema = jest.mocked(resolvePublicRuntimeSchema)
const mockResolvePublicGuestRuntimeConfig = jest.mocked(resolvePublicGuestRuntimeConfig)

describe('public quiz access-link row lock', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('locks the matching quiz access-link row for update through the caller transaction', async () => {
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
        const slug = 'grade-7-marathon'
        const config = {} as PublicGuestRuntimeConfig
        const executor = { query: jest.fn() } as unknown as DbExecutor
        const link = { id: accessLinkId, slug, isActive: true, targetType: 'quiz' }
        const resolveAccessLinkRecordBy = jest.fn().mockResolvedValue(link)
        const services = { resolveAccessLinkRecordBy } as unknown as RuntimeGuestServices
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            manager: executor,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspacesEnabled: false,
            settings: {}
        } as never)
        mockResolvePublicGuestRuntimeConfig.mockReturnValue(config)

        const lockPublicQuizAccessLink = createPublicQuizAccessLinkLockCheck(services)
        const locked = await lockPublicQuizAccessLink(executor, applicationId, accessLinkId, slug, null)

        expect(locked).toBe(true)
        expect(resolveAccessLinkRecordBy).toHaveBeenCalledWith(
            executor,
            'app_019ccefc2f7b7b3682f485cdb1312268',
            config,
            false,
            { type: 'id', value: accessLinkId },
            true,
            null
        )
    })

    it('does not lock an inactive, mismatched, or differently scoped access link', async () => {
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
        const config = {} as PublicGuestRuntimeConfig
        const executor = { query: jest.fn() } as unknown as DbExecutor
        const resolveAccessLinkRecordBy = jest.fn().mockResolvedValue({
            id: accessLinkId,
            slug: 'another-slug',
            isActive: true,
            targetType: 'quiz'
        })
        const services = { resolveAccessLinkRecordBy } as unknown as RuntimeGuestServices
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            manager: executor,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspacesEnabled: false,
            settings: {}
        } as never)
        mockResolvePublicGuestRuntimeConfig.mockReturnValue(config)

        const lockPublicQuizAccessLink = createPublicQuizAccessLinkLockCheck(services)
        const locked = await lockPublicQuizAccessLink(executor, applicationId, accessLinkId, 'grade-7-marathon', null)
        const wrongWorkspace = await lockPublicQuizAccessLink(
            executor,
            applicationId,
            accessLinkId,
            'grade-7-marathon',
            '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        )

        expect(locked).toBe(false)
        expect(wrongWorkspace).toBe(false)
        expect(resolveAccessLinkRecordBy).toHaveBeenCalledTimes(1)
    })

    it('establishes the target workspace context before locking a workspace-scoped access link', async () => {
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const config = {} as PublicGuestRuntimeConfig
        const executor = { query: jest.fn() } as unknown as DbExecutor
        const resolveAccessLinkRecordBy = jest.fn().mockResolvedValue({
            id: accessLinkId,
            slug: 'grade-7-marathon',
            isActive: true,
            targetType: 'quiz',
            workspaceId
        })
        const services = { resolveAccessLinkRecordBy } as unknown as RuntimeGuestServices
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            manager: executor,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspacesEnabled: true,
            settings: {}
        } as never)
        mockResolvePublicGuestRuntimeConfig.mockReturnValue(config)

        const lockPublicQuizAccessLink = createPublicQuizAccessLinkLockCheck(services)
        const locked = await lockPublicQuizAccessLink(executor, applicationId, accessLinkId, 'grade-7-marathon', workspaceId)

        expect(locked).toBe(true)
        expect(resolveAccessLinkRecordBy).toHaveBeenCalledWith(
            executor,
            'app_019ccefc2f7b7b3682f485cdb1312268',
            config,
            true,
            { type: 'id', value: accessLinkId },
            true,
            workspaceId
        )
    })
})

describe('public quiz access-link availability', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('restores the target workspace context before validating the access link and quiz', async () => {
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const accessLinkId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312273'
        const quizId = '019ccefc-2f7b-7b36-82f4-85cdb1312274'
        const slug = 'grade-7-marathon'
        const config = {} as PublicGuestRuntimeConfig
        const executor = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (tx: DbExecutor) => Promise<boolean>) => callback(executor as unknown as DbExecutor))
        } as unknown as DbExecutor
        const link = { id: accessLinkId, slug, isActive: true, targetType: 'quiz', targetId: quizId, workspaceId }
        const resolveAccessLinkRecordBy = jest.fn().mockResolvedValue(link)
        const resolveAllowedRuntimeTarget = jest.fn().mockResolvedValue({ id: quizId, type: 'quiz' })
        const buildQuizPayload = jest.fn().mockResolvedValue({
            questions: [{ options: [{ isCorrect: true }, { isCorrect: false }] }]
        })
        const services = {
            resolveAccessLinkRecordBy,
            resolveAllowedRuntimeTarget,
            buildQuizPayload
        } as unknown as RuntimeGuestServices
        mockResolvePublicRuntimeSchema.mockResolvedValue({
            manager: executor,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspacesEnabled: true,
            settings: {}
        } as never)
        mockResolvePublicGuestRuntimeConfig.mockReturnValue(config)

        const isAvailable = createPublicQuizAccessLinkAvailabilityCheck(services)
        const available = await isAvailable(executor, applicationId, accessLinkId, slug, workspaceId)

        expect(available).toBe(true)
        expect(resolveAccessLinkRecordBy).toHaveBeenCalledWith(
            executor,
            'app_019ccefc2f7b7b3682f485cdb1312268',
            config,
            true,
            { type: 'id', value: accessLinkId },
            false,
            workspaceId
        )
        expect(resolveAllowedRuntimeTarget).toHaveBeenCalledWith(
            executor,
            'app_019ccefc2f7b7b3682f485cdb1312268',
            config,
            link,
            'quiz',
            quizId
        )
        expect(buildQuizPayload).toHaveBeenCalledWith(
            executor,
            'app_019ccefc2f7b7b3682f485cdb1312268',
            config,
            quizId,
            true,
            'en',
            workspaceId
        )
    })
})

describe('public guest quiz runtime payload', () => {
    it('requests metadata only and does not return question content before an attempt starts', async () => {
        const participantId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const sessionToken = 'guest-session-token'
        const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const quizId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        const link = {
            id: '019ccefc-2f7b-7b36-82f4-85cdb1312270',
            slug: 'grade-7-marathon',
            targetType: 'quiz',
            targetId: quizId,
            isActive: true,
            workspaceId: null
        }
        const config = {} as PublicGuestRuntimeConfig
        const quiz = {
            type: 'quiz' as const,
            id: quizId,
            title: 'Grade 7 Marathon',
            questionCount: 2,
            questions: []
        }
        const buildQuizPayload = jest.fn(async (...args: unknown[]) =>
            args[7] === false ? quiz : { ...quiz, questions: [{ prompt: 'Private question' }] }
        )
        const context = {
            manager: { query: jest.fn() } as unknown as DbExecutor,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
            workspacesEnabled: false,
            settings: {}
        }
        const services = {
            withPublicRuntimeContext: async (_id: string, _res: Response, callback: (ctx: typeof context) => Promise<void>) =>
                callback(context),
            requirePublicGuestRuntimeConfig: jest.fn(() => config),
            validateGuestSession: jest.fn(async () => ({
                isValid: true,
                accessLinkId: link.id,
                workspaceId: null,
                quizIntakeVerified: true
            })),
            setPublicWorkspaceContext: jest.fn(async () => true),
            loadAccessLinkRecordBy: jest.fn(async () => link),
            loadAccessLinkRecord: jest.fn(),
            assertAccessLinkAvailable: jest.fn(() => ({ ok: true as const })),
            resolveAllowedRuntimeTarget: jest.fn(async () => ({ type: 'quiz' as const, id: quizId })),
            buildQuizPayload,
            buildContentPayload: jest.fn()
        } as unknown as RuntimeGuestServices
        const handler = createGuestRuntimeHandler(services)
        const request = {
            params: { applicationId },
            query: { slug: link.slug, locale: 'en' },
            get: (name: string) =>
                ({
                    'x-guest-participant-id': participantId,
                    'x-guest-session-token': sessionToken
                }[name.toLowerCase() as 'x-guest-participant-id' | 'x-guest-session-token'])
        } as unknown as Request
        const response = {
            setHeader: jest.fn(),
            status: jest.fn(),
            json: jest.fn()
        } as unknown as Response

        await handler(request, response)

        expect(buildQuizPayload).toHaveBeenCalledWith(context.manager, context.schemaName, config, quizId, false, 'en', null, false)
        expect(response.json).toHaveBeenCalledWith(quiz)
        expect(JSON.stringify(quiz)).not.toContain('Private question')
    })
})
