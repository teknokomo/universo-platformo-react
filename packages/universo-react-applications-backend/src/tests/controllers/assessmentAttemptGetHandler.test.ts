import type { DbExecutor } from '@universo-react/utils'
import type {
    GuestAssessmentAttemptHandlerDependencies,
    GuestAssessmentAttemptSupport
} from '../../controllers/runtimeGuest/assessmentAttemptSupport'
import { createGetGuestAssessmentAttemptHandler } from '../../controllers/runtimeGuest/assessmentAttemptGetHandler'
import { findGuestAssessmentAttempt, findGuestAssessmentAttemptIdentity } from '../../persistence/guestAssessmentAttemptStore'

jest.mock('../../persistence/guestAssessmentAttemptStore', () => ({
    findGuestAssessmentAttempt: jest.fn(),
    findGuestAssessmentAttemptIdentity: jest.fn()
}))

const mockFindGuestAssessmentAttempt = jest.mocked(findGuestAssessmentAttempt)
const mockFindGuestAssessmentAttemptIdentity = jest.mocked(findGuestAssessmentAttemptIdentity)

const applicationId = '019cf151-74a0-7d52-92bb-2cc72451f001'
const attemptId = '019cf151-74a0-7d52-92bb-2cc72451f002'
const participantId = '019cf151-74a0-7d52-92bb-2cc72451f003'
const accessLinkId = '019cf151-74a0-7d52-92bb-2cc72451f004'
const schemaName = 'app_019cf15174a07d5292bb2cc72451f001'

describe('GET guest assessment attempt handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('takes the shared attempt lock before reading and projecting saved responses', async () => {
        const events: string[] = []
        const manager = { query: jest.fn() } as unknown as DbExecutor
        const link = { id: accessLinkId, workspaceId: null, isActive: true }
        const attempt = {
            id: attemptId,
            accessLinkId,
            status: 'started',
            timerState: 'untimed'
        }
        const attemptState = { attemptId, phase: 'question', phaseRevision: 0 }
        mockFindGuestAssessmentAttempt.mockImplementation(async () => {
            events.push('read-attempt')
            return attempt as never
        })

        const context = { manager, schemaName, workspacesEnabled: false }
        const dependencies = {
            withPublicRuntimeContext: async (_id: string, _response: unknown, work: (ctx: typeof context) => Promise<void>) =>
                work(context),
            requirePublicGuestRuntimeConfig: jest.fn(() => ({})),
            resolveGuestRuntimeLocale: jest.fn(() => ({ valid: true, locale: 'en' })),
            resolveGuestAssessmentRuntimeTables: jest.fn(async () => ({ attemptTable: {}, responseTable: {} })),
            lockPublicApplicationForGuestAssessment: jest.fn(async () => true),
            lockPublicGuestRuntimeKey: jest.fn(async () => {
                events.push('lock-attempt')
            }),
            loadCurrentAccessLinkRecordForUpdate: jest.fn(async () => link),
            normalizeAccessLinkDate: jest.fn(() => null),
            guestParticipantIdHeader: 'x-guest-participant-id',
            legacyGuestStudentIdHeader: 'x-guest-student-id',
            guestSessionTokenHeader: 'x-guest-session-token',
            maxGuestSessionTokenLength: 256
        } as unknown as GuestAssessmentAttemptHandlerDependencies
        const support = {
            resolveGuestAttemptAccess: jest.fn(async () => ({ link })),
            revalidateGuestAttemptAccess: jest.fn(async () => true),
            toGuestAttemptState: jest.fn(async () => {
                events.push('project-responses')
                return attemptState
            })
        } as unknown as GuestAssessmentAttemptSupport
        const handler = createGetGuestAssessmentAttemptHandler(dependencies, support)
        const response = {
            setHeader: jest.fn(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        }
        const headers = new Map([
            ['x-guest-participant-id', participantId],
            ['x-guest-session-token', 'opaque-session-token']
        ])
        const request = {
            params: { applicationId, attemptId },
            query: { locale: 'en' },
            get: (name: string) => headers.get(name.toLowerCase())
        }

        await handler(request as never, response as never)

        expect(events).toEqual(['lock-attempt', 'read-attempt', 'project-responses'])
        expect(dependencies.lockPublicGuestRuntimeKey).toHaveBeenCalledWith(manager, `${schemaName}:guest-attempt::${attemptId}`)
        expect(mockFindGuestAssessmentAttemptIdentity).not.toHaveBeenCalled()
        expect(response.json).toHaveBeenCalledWith(attemptState)
    })
})
