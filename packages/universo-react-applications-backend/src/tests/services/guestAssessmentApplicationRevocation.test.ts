const mockListStartedAttempts = jest.fn()
const mockListStartedAttemptsForAccessLink = jest.fn()
const mockFinalizeAttempt = jest.fn()
const mockResolveRuntimeTables = jest.fn()
const mockListWorkspaceIds = jest.fn()
const mockSetWorkspaceContext = jest.fn()
const mockLockWorkspaceForMutation = jest.fn()
const mockResolveGuestConfig = jest.fn()
const mockResolveParticipantObject = jest.fn()
const mockRevokeGuestSessionIdempotencyForWorkspace = jest.fn()
const mockQuery = jest.fn()

jest.mock('../../persistence/guestAssessmentAttemptStore', () => ({
    listStartedGuestAssessmentAttemptIdentities: (...args: unknown[]) => mockListStartedAttempts(...args),
    listStartedGuestAssessmentAttemptIdentitiesForAccessLink: (...args: unknown[]) => mockListStartedAttemptsForAccessLink(...args)
}))

jest.mock('../../services/guestAssessmentAttemptLifecycleService', () => ({
    finalizeGuestAssessmentAttempt: (...args: unknown[]) => mockFinalizeAttempt(...args)
}))

jest.mock('../../services/guestAssessmentRuntimeTables', () => ({
    resolveGuestAssessmentRuntimeTables: (...args: unknown[]) => mockResolveRuntimeTables(...args)
}))

jest.mock('../../shared/publicRuntimeAccess', () => ({
    listActivePublicWorkspaceIds: (...args: unknown[]) => mockListWorkspaceIds(...args),
    lockPublicWorkspaceForMutation: (...args: unknown[]) => mockLockWorkspaceForMutation(...args),
    resolvePublicRuntimeObject: (...args: unknown[]) => mockResolveParticipantObject(...args),
    resolveTopLevelComponents: (binding: { attrs: unknown[] }) => binding.attrs,
    setPublicWorkspaceContext: (...args: unknown[]) => mockSetWorkspaceContext(...args)
}))

jest.mock('../../services/publicGuestRuntimeConfig', () => ({
    resolvePublicGuestRuntimeConfig: (...args: unknown[]) => mockResolveGuestConfig(...args)
}))

jest.mock('../../persistence/guestSessionIdempotencyStore', () => ({
    revokeGuestSessionIdempotencyForWorkspace: (...args: unknown[]) => mockRevokeGuestSessionIdempotencyForWorkspace(...args)
}))

import type { DbExecutor } from '@universo-react/utils'
import { lockApplicationForPublicGuestWithdrawal } from '../../persistence/publicGuestApplicationStore'
import {
    revokeGuestAssessmentAttemptsForApplication,
    revokeGuestAssessmentAttemptsForAccessLink,
    revokeGuestAssessmentAttemptsForWorkspace,
    revokeGuestSessionSecretsForWorkspace
} from '../../services/guestAssessmentApplicationRevocation'

const executor = { query: mockQuery } as unknown as DbExecutor
const participantBinding = {
    tableName: 'students',
    attrs: [
        { codename: 'IsGuest', column_name: 'is_guest', parent_component_id: null },
        { codename: 'GuestSessionToken', column_name: 'guest_session_token', parent_component_id: null }
    ]
}
const config = {
    objects: { participants: 'Students' },
    fields: { participant: { isGuest: 'IsGuest', guestSessionToken: 'GuestSessionToken' } },
    assessment: { objects: {}, fields: {} }
}
const makeTables = (workspaceId: string | null) => ({
    attemptTable: { schemaName: 'app_018f8a787b8f7c1da111222233334442', tableName: 'quiz_attempts', workspaceId },
    responseTable: { schemaName: 'app_018f8a787b8f7c1da111222233334442', tableName: 'quiz_responses', workspaceId }
})

describe('guest assessment application withdrawal', () => {
    beforeEach(() => {
        jest.resetAllMocks()
        mockQuery.mockResolvedValue([])
        mockResolveGuestConfig.mockReturnValue(config)
        mockResolveParticipantObject.mockResolvedValue(participantBinding)
        mockResolveRuntimeTables.mockImplementation(
            async (_executor: DbExecutor, _schema: string, _config: unknown, workspaceId: string | null) => makeTables(workspaceId)
        )
        mockListWorkspaceIds.mockResolvedValue([])
        mockLockWorkspaceForMutation.mockResolvedValue(true)
        mockSetWorkspaceContext.mockResolvedValue(true)
        mockListStartedAttempts.mockResolvedValue([])
        mockListStartedAttemptsForAccessLink.mockResolvedValue([])
        mockFinalizeAttempt.mockImplementation(
            async (_executor: DbExecutor, _attemptTable: unknown, _responseTable: unknown, id: string) => ({
                id,
                status: 'Revoked'
            })
        )
    })

    it('leaves applications without assessment runtime untouched', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', false, {})
        ).resolves.toBe(0)

        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
        expect(mockListStartedAttempts).not.toHaveBeenCalled()
    })

    it('fails closed when quiz runtime mapping is configured but incomplete', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', false, {
                publicRuntime: { guest: { objects: { quizAttempts: 'QuizAttempts' } } }
            })
        ).rejects.toThrow('Guest runtime mapping is incomplete')
        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
    })

    it('revokes every started attempt without requiring a timer', async () => {
        const attempts = [
            { id: '018f8a78-7b8f-7c1d-a111-222233334443', studentId: '018f8a78-7b8f-7c1d-a111-222233334444' },
            { id: '018f8a78-7b8f-7c1d-a111-222233334445', studentId: '018f8a78-7b8f-7c1d-a111-222233334446' }
        ]
        mockListStartedAttempts.mockResolvedValueOnce(attempts).mockResolvedValueOnce([])

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', false, {
                publicRuntime: { guest: {} }
            })
        ).resolves.toBe(2)

        expect(mockListStartedAttempts).toHaveBeenNthCalledWith(1, executor, expect.objectContaining({ workspaceId: null }), 500, undefined)
        expect(mockListStartedAttempts).toHaveBeenCalledTimes(1)
        expect(mockFinalizeAttempt).toHaveBeenCalledTimes(2)
        expect(mockFinalizeAttempt).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({ workspaceId: null }),
            expect.objectContaining({ workspaceId: null }),
            attempts[0].id,
            attempts[0].studentId,
            'revoked',
            expect.any(Date)
        )
    })

    it('finalizes only started attempts for one access link and its workspace', async () => {
        const accessLinkId = '018f8a78-7b8f-7c1d-a111-222233334451'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334452'
        const now = new Date('2026-10-12T10:00:00.000Z')
        const attempt = { id: '018f8a78-7b8f-7c1d-a111-222233334453', studentId: '018f8a78-7b8f-7c1d-a111-222233334454' }
        mockListStartedAttemptsForAccessLink.mockResolvedValueOnce([attempt]).mockResolvedValueOnce([])

        await expect(
            revokeGuestAssessmentAttemptsForAccessLink(
                executor,
                'app_018f8a787b8f7c1da111222233334442',
                { publicRuntime: { guest: {} } },
                workspaceId,
                accessLinkId,
                now
            )
        ).resolves.toBe(1)

        expect(mockListStartedAttemptsForAccessLink).toHaveBeenNthCalledWith(
            1,
            executor,
            expect.objectContaining({ workspaceId }),
            accessLinkId,
            500,
            undefined
        )
        expect(mockFinalizeAttempt).toHaveBeenCalledWith(
            executor,
            expect.objectContaining({ workspaceId }),
            expect.objectContaining({ workspaceId }),
            attempt.id,
            attempt.studentId,
            'revoked',
            now
        )
        expect(mockListStartedAttempts).not.toHaveBeenCalled()
    })

    it('leaves quiz-free guest access links without an assessment mapping untouched', async () => {
        mockResolveGuestConfig.mockReturnValue({ ...config, assessment: undefined })

        await expect(
            revokeGuestAssessmentAttemptsForAccessLink(
                executor,
                'app_018f8a787b8f7c1da111222233334442',
                { publicRuntime: { guest: {} } },
                null,
                '018f8a78-7b8f-7c1d-a111-222233334451'
            )
        ).resolves.toBe(0)
        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
        expect(mockListStartedAttemptsForAccessLink).not.toHaveBeenCalled()
    })

    it('continues through subsequent bounded batches with a UUID keyset cursor', async () => {
        const firstBatch = Array.from({ length: 500 }, (_, index) => ({
            id: `018f8a78-7b8f-7c1d-a111-${(index + 1).toString(16).padStart(12, '0')}`,
            studentId: '018f8a78-7b8f-7c1d-a111-222233334444'
        }))
        mockListStartedAttempts.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce([])

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', false, {
                publicRuntime: { guest: {} }
            })
        ).resolves.toBe(500)

        expect(mockListStartedAttempts).toHaveBeenNthCalledWith(2, executor, expect.anything(), 500, firstBatch[499]?.id)
        expect(mockFinalizeAttempt).toHaveBeenCalledTimes(500)
    })

    it('switches through every active guest workspace and restores an unbound workspace context', async () => {
        const firstWorkspace = '018f8a78-7b8f-7c1d-a111-222233334447'
        const secondWorkspace = '018f8a78-7b8f-7c1d-a111-222233334448'
        mockListWorkspaceIds.mockResolvedValue([firstWorkspace, secondWorkspace])
        mockListStartedAttempts
            .mockResolvedValueOnce([{ id: '018f8a78-7b8f-7c1d-a111-222233334449', studentId: '018f8a78-7b8f-7c1d-a111-222233334450' }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])

        const count = await revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', true, {
            publicRuntime: { guest: {} }
        })

        expect(count).toBe(1)
        expect(mockLockWorkspaceForMutation).toHaveBeenNthCalledWith(1, executor, 'app_018f8a787b8f7c1da111222233334442', firstWorkspace)
        expect(mockLockWorkspaceForMutation).toHaveBeenNthCalledWith(2, executor, 'app_018f8a787b8f7c1da111222233334442', secondWorkspace)
        expect(mockSetWorkspaceContext).toHaveBeenNthCalledWith(1, executor, 'app_018f8a787b8f7c1da111222233334442', firstWorkspace)
        expect(mockSetWorkspaceContext).toHaveBeenNthCalledWith(2, executor, 'app_018f8a787b8f7c1da111222233334442', secondWorkspace)
        expect(mockSetWorkspaceContext).toHaveBeenLastCalledWith(executor, 'app_018f8a787b8f7c1da111222233334442', null)
    })

    it('locks the application before locking workspaces during access withdrawal', async () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334443'
        const schemaName = 'app_018f8a787b8f7c1da111222233334442'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334447'
        mockQuery.mockResolvedValueOnce([
            {
                id: applicationId,
                schemaName,
                settings: { publicRuntime: { guest: {} } },
                isPublic: true,
                workspacesEnabled: true
            }
        ])
        mockListWorkspaceIds.mockResolvedValue([workspaceId])

        const application = await lockApplicationForPublicGuestWithdrawal(executor, applicationId)
        expect(application).not.toBeNull()
        if (!application) throw new Error('Public application lock was not acquired')

        await revokeGuestAssessmentAttemptsForApplication(
            executor,
            application.schemaName,
            application.workspacesEnabled,
            application.settings
        )

        expect(mockQuery.mock.invocationCallOrder[0]).toBeLessThan(mockLockWorkspaceForMutation.mock.invocationCallOrder[0] ?? Infinity)
    })

    it('invalidates stored guest session secrets in every public workspace', async () => {
        const firstWorkspace = '018f8a78-7b8f-7c1d-a111-222233334447'
        const secondWorkspace = '018f8a78-7b8f-7c1d-a111-222233334448'
        mockListWorkspaceIds.mockResolvedValue([firstWorkspace, secondWorkspace])

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', true, {
                publicRuntime: { guest: {} }
            })
        ).resolves.toBe(0)

        const sessionUpdates = mockQuery.mock.calls.filter(([sql]) =>
            String(sql).includes('UPDATE "app_018f8a787b8f7c1da111222233334442"."students"')
        )
        expect(sessionUpdates).toHaveLength(2)
        expect(sessionUpdates[0]).toMatchObject([expect.stringContaining('"guest_session_token" = NULL'), [firstWorkspace]])
        expect(sessionUpdates[1]).toMatchObject([expect.stringContaining('"guest_session_token" = NULL'), [secondWorkspace]])
        expect(sessionUpdates[0]?.[0]).toContain('"is_guest" = TRUE')
        expect(sessionUpdates[0]?.[0]).toContain('AND "workspace_id" = $1')
    })

    it('fails the withdrawal transaction when assessment storage or a workspace becomes unavailable', async () => {
        mockResolveRuntimeTables.mockResolvedValueOnce(null)

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', false, {
                publicRuntime: { guest: {} }
            })
        ).rejects.toThrow('Guest assessment storage is unavailable')

        mockListWorkspaceIds.mockResolvedValueOnce(['018f8a78-7b8f-7c1d-a111-222233334447'])
        mockLockWorkspaceForMutation.mockResolvedValueOnce(false)
        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', true, {
                publicRuntime: { guest: {} }
            })
        ).rejects.toThrow('workspace changed')
        expect(mockSetWorkspaceContext).not.toHaveBeenCalled()
    })

    it('fails the withdrawal transaction when workspace context cannot be cleared', async () => {
        mockSetWorkspaceContext.mockResolvedValue(false)

        await expect(
            revokeGuestAssessmentAttemptsForApplication(executor, 'app_018f8a787b8f7c1da111222233334442', true, {
                publicRuntime: { guest: {} }
            })
        ).rejects.toThrow('workspace context could not be cleared')
        expect(mockSetWorkspaceContext).toHaveBeenCalledWith(executor, 'app_018f8a787b8f7c1da111222233334442', null)
    })

    it('clears only workspace guest session secrets and leaves assessment results untouched', async () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334442'
        const schemaName = 'app_018f8a787b8f7c1da111222233334442'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334447'
        mockRevokeGuestSessionIdempotencyForWorkspace.mockResolvedValue(2)

        await expect(
            revokeGuestSessionSecretsForWorkspace(executor, schemaName, applicationId, { publicRuntime: { guest: {} } }, workspaceId)
        ).resolves.toBe(2)

        expect(mockSetWorkspaceContext).toHaveBeenCalledTimes(1)
        expect(mockSetWorkspaceContext).toHaveBeenCalledWith(executor, schemaName, workspaceId)
        expect(mockResolveParticipantObject).toHaveBeenCalledWith(executor, schemaName, 'Students')
        const sessionUpdateIndex = mockQuery.mock.calls.findIndex(([sql]) =>
            String(sql).includes('UPDATE "app_018f8a787b8f7c1da111222233334442"."students"')
        )
        expect(sessionUpdateIndex).toBeGreaterThanOrEqual(0)
        const [sessionUpdateSql, sessionUpdateParams] = mockQuery.mock.calls[sessionUpdateIndex] as [string, unknown[]]
        expect(sessionUpdateSql).toContain('"guest_session_token" = NULL')
        expect(sessionUpdateSql).toContain('"is_guest" = TRUE')
        expect(sessionUpdateSql).toContain('AND "workspace_id" = $1')
        expect(sessionUpdateParams).toEqual([workspaceId])
        expect(mockRevokeGuestSessionIdempotencyForWorkspace).toHaveBeenCalledWith(executor, applicationId, workspaceId, schemaName)
        expect(mockRevokeGuestSessionIdempotencyForWorkspace.mock.invocationCallOrder[0]).toBeGreaterThan(
            mockQuery.mock.invocationCallOrder[sessionUpdateIndex]
        )
        expect(mockFinalizeAttempt).not.toHaveBeenCalled()
        expect(mockListStartedAttempts).not.toHaveBeenCalled()
        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
    })

    it('finalizes workspace attempts from persisted answers before workspace archival', async () => {
        const schemaName = 'app_018f8a787b8f7c1da111222233334442'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334447'
        const now = new Date('2026-10-12T12:00:00.000Z')
        const attempts = [
            { id: '018f8a78-7b8f-7c1d-a111-222233334443', studentId: '018f8a78-7b8f-7c1d-a111-222233334444' },
            { id: '018f8a78-7b8f-7c1d-a111-222233334445', studentId: '018f8a78-7b8f-7c1d-a111-222233334446' }
        ]
        mockListStartedAttempts.mockResolvedValueOnce(attempts).mockResolvedValueOnce([])

        await expect(
            revokeGuestAssessmentAttemptsForWorkspace(executor, schemaName, { publicRuntime: { guest: {} } }, workspaceId, now)
        ).resolves.toBe(2)

        expect(mockSetWorkspaceContext).toHaveBeenCalledWith(executor, schemaName, workspaceId)
        expect(mockResolveRuntimeTables).toHaveBeenCalledWith(executor, schemaName, config, workspaceId)
        expect(mockListStartedAttempts).toHaveBeenCalledWith(executor, makeTables(workspaceId).attemptTable, 500, undefined)
        expect(mockFinalizeAttempt).toHaveBeenNthCalledWith(
            1,
            executor,
            makeTables(workspaceId).attemptTable,
            makeTables(workspaceId).responseTable,
            attempts[0]?.id,
            attempts[0]?.studentId,
            'revoked',
            now
        )
        expect(mockFinalizeAttempt).toHaveBeenNthCalledWith(
            2,
            executor,
            makeTables(workspaceId).attemptTable,
            makeTables(workspaceId).responseTable,
            attempts[1]?.id,
            attempts[1]?.studentId,
            'revoked',
            now
        )
    })

    it('fails workspace archival closed when the assessment mapping is incomplete', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(
            revokeGuestAssessmentAttemptsForWorkspace(
                executor,
                'app_018f8a787b8f7c1da111222233334442',
                { publicRuntime: { guest: { objects: { quizAttempts: 'QuizAttempts' } } } },
                '018f8a78-7b8f-7c1d-a111-222233334447'
            )
        ).rejects.toThrow('Guest assessment mapping is incomplete during workspace deletion')
        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
        expect(mockListStartedAttempts).not.toHaveBeenCalled()
    })

    it('fails workspace deletion closed when guest session mapping is incomplete', async () => {
        mockResolveGuestConfig.mockReturnValue(null)

        await expect(
            revokeGuestSessionSecretsForWorkspace(
                executor,
                'app_018f8a787b8f7c1da111222233334442',
                '018f8a78-7b8f-7c1d-a111-222233334442',
                {
                    publicRuntime: {
                        guest: {
                            objects: { participants: 'Students' },
                            fields: { participant: { guestSessionToken: 'GuestSessionToken' } }
                        }
                    }
                },
                '018f8a78-7b8f-7c1d-a111-222233334447'
            )
        ).rejects.toThrow('Guest runtime mapping is incomplete during workspace deletion')
        expect(mockSetWorkspaceContext).not.toHaveBeenCalled()
        expect(mockResolveRuntimeTables).not.toHaveBeenCalled()
        expect(mockRevokeGuestSessionIdempotencyForWorkspace).not.toHaveBeenCalled()
    })

    it('purges scoped replay credentials when the application has no guest runtime mapping', async () => {
        const applicationId = '018f8a78-7b8f-7c1d-a111-222233334442'
        const schemaName = 'app_018f8a787b8f7c1da111222233334442'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334447'
        mockResolveGuestConfig.mockReturnValue(null)
        mockRevokeGuestSessionIdempotencyForWorkspace.mockResolvedValue(1)

        await expect(revokeGuestSessionSecretsForWorkspace(executor, schemaName, applicationId, {}, workspaceId)).resolves.toBe(1)

        expect(mockRevokeGuestSessionIdempotencyForWorkspace).toHaveBeenCalledWith(executor, applicationId, workspaceId, schemaName)
        expect(mockResolveParticipantObject).not.toHaveBeenCalled()
        expect(mockFinalizeAttempt).not.toHaveBeenCalled()
    })
})
