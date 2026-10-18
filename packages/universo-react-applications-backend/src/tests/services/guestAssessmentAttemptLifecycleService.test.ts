const mockAcquireAdvisoryLock = jest.fn()
const mockFindAttempt = jest.fn()
const mockListExpiredAttempts = jest.fn()
const mockListResponses = jest.fn()
const mockUpdateAttempt = jest.fn()

jest.mock('@universo-react/utils/database', () => ({
    acquireAdvisoryXactLock: (...args: unknown[]) => mockAcquireAdvisoryLock(...args)
}))

jest.mock('../../persistence/guestAssessmentAttemptStore', () => ({
    findGuestAssessmentAttempt: (...args: unknown[]) => mockFindAttempt(...args),
    listExpiredGuestAssessmentAttemptIdentities: (...args: unknown[]) => mockListExpiredAttempts(...args),
    listGuestAssessmentResponses: (...args: unknown[]) => mockListResponses(...args),
    updateGuestAssessmentAttempt: (...args: unknown[]) => mockUpdateAttempt(...args)
}))

import type { DbExecutor } from '@universo-react/utils'
import {
    finalizeGuestAssessmentAttempt,
    reconcileExpiredGuestAssessmentAttempts
} from '../../services/guestAssessmentAttemptLifecycleService'
import type { GuestAssessmentAttemptTable, GuestAssessmentResponseTable } from '../../persistence/guestAssessmentAttemptStore'

const uuidV7 = (value: number): string => `018f4e2a-6d50-7abc-8def-${value.toString(16).padStart(12, '0')}`
const participantId = uuidV7(1)
const attemptId = uuidV7(2)
const questionId = uuidV7(3)
const correctOptionId = uuidV7(4)
const wrongOptionId = uuidV7(5)
const now = new Date('2026-10-11T12:00:00.000Z')
const attemptTable: GuestAssessmentAttemptTable = {
    schemaName: 'app_018f4e2a6d507abc8def123456789abc',
    tableName: 'quiz_attempts',
    workspaceId: uuidV7(6),
    columns: {
        studentId: 'student_id',
        quizId: 'quiz_id',
        attemptNumber: 'attempt_number',
        startedAt: 'started_at',
        submittedAt: 'submitted_at',
        deadlineAt: 'deadline_at',
        effectiveTimeLimitSeconds: 'effective_time_limit_seconds',
        passingScorePercentSnapshot: 'passing_score_percent_snapshot',
        finishedReason: 'finished_reason',
        questionsSnapshot: 'questions_snapshot',
        questionSetDigest: 'question_set_digest',
        flowSnapshot: 'flow_snapshot',
        phase: 'phase',
        phaseRevision: 'phase_revision',
        timerState: 'timer_state',
        frozenRemainingMs: 'frozen_remaining_ms',
        accessLinkId: 'access_link_id',
        classIdSnapshot: 'class_id_snapshot',
        score: 'score',
        scorePercent: 'score_percent',
        totalQuestions: 'total_questions',
        passed: 'passed',
        status: 'status'
    }
}
const responseTable: GuestAssessmentResponseTable = {
    schemaName: attemptTable.schemaName,
    tableName: 'quiz_responses',
    workspaceId: attemptTable.workspaceId,
    columns: {
        studentId: 'student_id',
        quizId: 'quiz_id',
        attemptId: 'attempt_id',
        questionId: 'question_id',
        selectedOptionIds: 'selected_option_ids',
        isCorrect: 'is_correct',
        attemptNumber: 'attempt_number',
        submittedAt: 'submitted_at'
    }
}
const questionsSnapshot = [
    {
        id: questionId,
        prompt: 'Question',
        description: null,
        explanation: 'Private explanation',
        sortOrder: 1,
        blockKey: null,
        options: [
            { id: correctOptionId, label: 'Correct', isCorrect: true },
            { id: wrongOptionId, label: 'Wrong', isCorrect: false }
        ]
    }
]
const makeAttempt = (deadlineAt: string, id = attemptId) => ({
    id,
    studentId: participantId,
    attemptNumber: 1,
    status: 'Started',
    deadlineAt,
    effectiveTimeLimitSeconds: 2700,
    phase: 'question',
    phaseRevision: 0,
    timerState: 'running',
    frozenRemainingMs: null,
    flowSnapshot: { contractVersion: 1, blocks: [], pauseTimerOnBlockIntro: false, numberingMode: 'global', completionText: '' },
    questionsSnapshot,
    passingScorePercentSnapshot: 100
})
const executor = { query: jest.fn(), transaction: jest.fn() } as unknown as DbExecutor

describe('guest assessment attempt lifecycle service', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAcquireAdvisoryLock.mockResolvedValue(undefined)
        mockUpdateAttempt.mockResolvedValue(undefined)
    })

    it('scores and persists an expired attempt from its server snapshot and saved responses', async () => {
        mockFindAttempt.mockResolvedValue(makeAttempt('2026-10-11T11:00:00.000Z'))
        mockListResponses.mockResolvedValue([{ questionId, selectedOptionIds: JSON.stringify([correctOptionId]), isCorrect: true }])

        const result = await finalizeGuestAssessmentAttempt(
            executor,
            attemptTable,
            responseTable,
            attemptId,
            participantId,
            'timed_out',
            now
        )

        expect(result).toMatchObject({ status: 'TimedOut', finishedReason: 'timed_out', score: 1, totalQuestions: 1, passed: true })
        expect(mockAcquireAdvisoryLock).toHaveBeenCalledWith(
            executor,
            `${attemptTable.schemaName}:guest-attempt:${attemptTable.workspaceId}:${attemptId}`
        )
        expect(mockAcquireAdvisoryLock.mock.invocationCallOrder[0]).toBeLessThan(mockFindAttempt.mock.invocationCallOrder[0])
        expect(mockUpdateAttempt).toHaveBeenCalledWith(
            executor,
            attemptTable,
            attemptId,
            participantId,
            expect.objectContaining({
                status: 'TimedOut',
                finished_reason: 'timed_out',
                score: 1,
                score_percent: 100,
                total_questions: 1,
                passed: true,
                submitted_at: '2026-10-11T11:00:00.000Z'
            }),
            participantId
        )
    })

    it('times out a resumed block-flow attempt at its server deadline', async () => {
        const blockKey = uuidV7(7)
        const resumedBlockAttempt = {
            ...makeAttempt('2026-10-11T11:00:00.000Z'),
            phaseRevision: 3,
            timerState: 'running',
            flowSnapshot: {
                contractVersion: 1,
                blocks: [{ key: blockKey, title: 'Second block', introduction: null, sortOrder: 0 }],
                pauseTimerOnBlockIntro: true,
                numberingMode: 'block',
                completionText: ''
            },
            questionsSnapshot: questionsSnapshot.map((question) => ({ ...question, blockKey }))
        }
        mockFindAttempt.mockResolvedValue(resumedBlockAttempt)
        mockListResponses.mockResolvedValue([{ questionId, selectedOptionIds: JSON.stringify([correctOptionId]), isCorrect: true }])

        const result = await finalizeGuestAssessmentAttempt(
            executor,
            attemptTable,
            responseTable,
            attemptId,
            participantId,
            'timed_out',
            now
        )

        expect(result).toMatchObject({
            status: 'TimedOut',
            finishedReason: 'timed_out',
            phase: 'question',
            phaseRevision: 3,
            score: 1,
            totalQuestions: 1,
            passed: true,
            submittedAt: '2026-10-11T11:00:00.000Z'
        })
        expect(mockUpdateAttempt).toHaveBeenCalledWith(
            executor,
            attemptTable,
            attemptId,
            participantId,
            expect.objectContaining({
                status: 'TimedOut',
                finished_reason: 'timed_out',
                submitted_at: '2026-10-11T11:00:00.000Z'
            }),
            participantId
        )
    })

    it('does not let a premature timeout request finalize an active attempt', async () => {
        const activeAttempt = makeAttempt('2026-10-11T13:00:00.000Z')
        mockFindAttempt.mockResolvedValue(activeAttempt)

        const result = await finalizeGuestAssessmentAttempt(
            executor,
            attemptTable,
            responseTable,
            attemptId,
            participantId,
            'timed_out',
            now
        )

        expect(result).toBe(activeAttempt)
        expect(mockListResponses).not.toHaveBeenCalled()
        expect(mockUpdateAttempt).not.toHaveBeenCalled()
    })

    it('stores the final Passed state when a submitted attempt reaches the passing score', async () => {
        mockFindAttempt.mockResolvedValue(makeAttempt('2026-10-11T13:00:00.000Z'))
        mockListResponses.mockResolvedValue([{ questionId, selectedOptionIds: JSON.stringify([correctOptionId]), isCorrect: true }])

        const result = await finalizeGuestAssessmentAttempt(
            executor,
            attemptTable,
            responseTable,
            attemptId,
            participantId,
            'submitted',
            now
        )

        expect(result).toMatchObject({
            status: 'Passed',
            finishedReason: 'submitted',
            score: 1,
            scorePercent: 100,
            totalQuestions: 1,
            passed: true
        })
        expect(mockUpdateAttempt).toHaveBeenCalledWith(
            executor,
            attemptTable,
            attemptId,
            participantId,
            expect.objectContaining({ status: 'Passed', finished_reason: 'submitted', score_percent: 100, passed: true }),
            participantId
        )
    })

    it('stores the final Failed state when a submitted attempt is below the passing score', async () => {
        mockFindAttempt.mockResolvedValue(makeAttempt('2026-10-11T13:00:00.000Z'))
        mockListResponses.mockResolvedValue([{ questionId, selectedOptionIds: JSON.stringify([wrongOptionId]), isCorrect: false }])

        const result = await finalizeGuestAssessmentAttempt(
            executor,
            attemptTable,
            responseTable,
            attemptId,
            participantId,
            'submitted',
            now
        )

        expect(result).toMatchObject({
            status: 'Failed',
            finishedReason: 'submitted',
            score: 0,
            scorePercent: 0,
            totalQuestions: 1,
            passed: false
        })
        expect(mockUpdateAttempt).toHaveBeenCalledWith(
            executor,
            attemptTable,
            attemptId,
            participantId,
            expect.objectContaining({ status: 'Failed', finished_reason: 'submitted', score_percent: 0, passed: false }),
            participantId
        )
    })

    it('reconciles expired identities in bounded pages and finalizes them through locked transactions', async () => {
        const transactionExecutor = { query: jest.fn() } as unknown as DbExecutor
        const transactionalExecutor = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (value: DbExecutor) => Promise<unknown>) => callback(transactionExecutor))
        } as unknown as DbExecutor
        const firstDeadlineAt = '2026-10-11T10:00:00.000Z'
        const secondDeadlineAt = '2026-10-11T11:00:00.000Z'
        const secondAttemptId = uuidV7(7)
        mockListExpiredAttempts
            .mockResolvedValueOnce([{ id: attemptId, studentId: participantId, deadlineAt: firstDeadlineAt }])
            .mockResolvedValueOnce([{ id: secondAttemptId, studentId: participantId, deadlineAt: secondDeadlineAt }])
            .mockResolvedValueOnce([])
        mockFindAttempt.mockImplementation(async (_executor: DbExecutor, _table: unknown, id: string) =>
            makeAttempt(id === attemptId ? firstDeadlineAt : secondDeadlineAt, id)
        )
        mockListResponses.mockResolvedValue([])

        const count = await reconcileExpiredGuestAssessmentAttempts(transactionalExecutor, attemptTable, responseTable, now, 1)

        expect(count).toBe(2)
        expect(mockListExpiredAttempts).toHaveBeenNthCalledWith(1, transactionalExecutor, attemptTable, now.toISOString(), 1, undefined)
        expect(mockListExpiredAttempts).toHaveBeenNthCalledWith(2, transactionalExecutor, attemptTable, now.toISOString(), 1, {
            id: attemptId,
            deadlineAt: firstDeadlineAt
        })
        expect(mockListExpiredAttempts).toHaveBeenNthCalledWith(3, transactionalExecutor, attemptTable, now.toISOString(), 1, {
            id: secondAttemptId,
            deadlineAt: secondDeadlineAt
        })
        expect(mockAcquireAdvisoryLock).toHaveBeenCalledWith(
            transactionExecutor,
            `${attemptTable.schemaName}:guest-attempt:${attemptTable.workspaceId}:${attemptId}`
        )
        expect(mockUpdateAttempt).toHaveBeenCalledTimes(2)
    })
})
