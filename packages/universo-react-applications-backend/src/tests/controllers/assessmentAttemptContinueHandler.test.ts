import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import type {
    GuestAssessmentAttemptHandlerDependencies,
    GuestAssessmentAttemptSupport
} from '../../controllers/runtimeGuest/assessmentAttemptSupport'
import { createContinueGuestAssessmentAttemptHandler } from '../../controllers/runtimeGuest/assessmentAttemptContinueHandler'

const mockLockEvents: string[] = []
const mockLockGuestAccessLinkWorkspace = jest.fn(async () => {
    mockLockEvents.push('workspace')
})

jest.mock('../../services/guestAccessLinkRevocation', () => ({
    ...jest.requireActual('../../services/guestAccessLinkRevocation'),
    lockGuestAccessLinkWorkspace: (...args: unknown[]) => mockLockGuestAccessLinkWorkspace(...args)
}))

const applicationId = '019cf151-74a0-7d52-92bb-2cc72451f001'
const attemptId = '019cf151-74a0-7d52-92bb-2cc72451f002'
const participantId = '019cf151-74a0-7d52-92bb-2cc72451f003'
const accessLinkId = '019cf151-74a0-7d52-92bb-2cc72451f004'
const workspaceId = '019cf151-74a0-7d52-92bb-2cc72451f005'

describe('continue guest assessment attempt handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockLockEvents.length = 0
    })

    it('locks the application before the workspace to match the withdrawal lock order', async () => {
        const manager = {} as DbExecutor
        Object.assign(manager, {
            transaction: async (work: (tx: DbExecutor) => Promise<unknown>) => work(manager)
        })
        const context = {
            manager,
            schemaName: 'app_019cf15174a07d5292bb2cc72451f001',
            workspacesEnabled: true
        }
        const link = { id: accessLinkId, workspaceId, isActive: true }
        const dependencies = {
            withPublicRuntimeContext: async (_id: string, _res: Response, work: (ctx: typeof context) => Promise<void>) => work(context),
            requirePublicGuestRuntimeConfig: jest.fn(() => ({})),
            resolveGuestRuntimeLocale: jest.fn(() => ({ valid: true, locale: 'en' })),
            resolveGuestAssessmentRuntimeTables: jest.fn(async () => ({ attemptTable: {}, responseTable: {} })),
            lockPublicApplicationForGuestAssessment: jest.fn(async () => {
                mockLockEvents.push('application')
                return true
            }),
            loadCurrentAccessLinkRecordForUpdate: jest.fn(async () => {
                mockLockEvents.push('access-link')
                return null
            })
        } as unknown as GuestAssessmentAttemptHandlerDependencies
        const support = {
            guestAttemptSessionSchema: z.object({ participantId: z.string().uuid(), sessionToken: z.string() }),
            resolveGuestAttemptAccess: jest.fn(async () => ({ link }))
        } as unknown as GuestAssessmentAttemptSupport
        const response = {
            setHeader: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        } as unknown as Response
        const handler = createContinueGuestAssessmentAttemptHandler(dependencies, support)
        const request = {
            params: { applicationId, attemptId },
            query: { locale: 'en' },
            body: { participantId, sessionToken: 'opaque-session-token', phaseRevision: 0 }
        } as unknown as Request

        await handler(request, response)

        expect(mockLockEvents).toEqual(['application', 'workspace', 'access-link'])
        expect(mockLockGuestAccessLinkWorkspace).toHaveBeenCalledWith({
            executor: manager,
            schemaName: context.schemaName,
            workspacesEnabled: true,
            workspaceId
        })
        expect(response.status).toHaveBeenCalledWith(404)
    })
})
