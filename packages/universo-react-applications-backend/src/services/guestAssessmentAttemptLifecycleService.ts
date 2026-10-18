import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { DbExecutor } from '@universo-react/utils'
import {
    findGuestAssessmentAttempt,
    listExpiredGuestAssessmentAttemptIdentities,
    listGuestAssessmentResponses,
    updateGuestAssessmentAttempt,
    type GuestAssessmentAttemptTable,
    type GuestAssessmentResponseTable
} from '../persistence/guestAssessmentAttemptStore'
import { assessmentAttemptQuestionsSchema, scoreAssessmentAttempt } from './assessmentAttemptLifecycle'
import { assessmentAttemptFlowSnapshotSchema, parseAssessmentAttemptRuntimeState } from './assessmentAttemptFlow'

type AssessmentAttemptFinishReason = 'submitted' | 'timed_out' | 'revoked'
type StoredAttempt = Record<string, unknown> & { id: string }

const normalizeDate = (value: unknown): string | null => {
    const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

const normalizeNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

const parseSelectedOptionId = (value: unknown): string | null => {
    let decoded = value
    if (typeof value === 'string') {
        try {
            decoded = JSON.parse(value)
        } catch {
            return null
        }
    }
    if (!Array.isArray(decoded) || typeof decoded[0] !== 'string') return null
    return decoded[0]
}

export const finalizeGuestAssessmentAttempt = async (
    executor: DbExecutor,
    attemptTable: GuestAssessmentAttemptTable,
    responseTable: GuestAssessmentResponseTable,
    attemptId: string,
    participantId: string,
    finishedReason: AssessmentAttemptFinishReason,
    now = new Date()
): Promise<StoredAttempt | null> => {
    await acquireAdvisoryXactLock(executor, `${attemptTable.schemaName}:guest-attempt:${attemptTable.workspaceId ?? ''}:${attemptId}`)
    const attempt = await findGuestAssessmentAttempt(executor, attemptTable, attemptId, participantId, true)
    if (!attempt) return null
    if (String(attempt.status ?? '').toLowerCase() !== 'started') return attempt

    const deadlineAt = normalizeDate(attempt.deadlineAt)
    const timerState = String(attempt.timerState ?? '')
    const deadlineExpired = timerState === 'running' && deadlineAt !== null && Date.parse(deadlineAt) <= now.getTime()
    if (finishedReason === 'timed_out' && !deadlineExpired) return attempt

    const effectiveReason = finishedReason === 'submitted' && deadlineExpired ? 'timed_out' : finishedReason
    const questionsValue = typeof attempt.questionsSnapshot === 'string' ? JSON.parse(attempt.questionsSnapshot) : attempt.questionsSnapshot
    const questions = assessmentAttemptQuestionsSchema.parse(questionsValue)
    const flowValue = typeof attempt.flowSnapshot === 'string' ? JSON.parse(attempt.flowSnapshot) : attempt.flowSnapshot
    const flow = assessmentAttemptFlowSnapshotSchema.parse(flowValue)
    parseAssessmentAttemptRuntimeState({
        phase: String(attempt.phase ?? ''),
        phaseRevision: normalizeNumber(attempt.phaseRevision) ?? Number.NaN,
        timerState,
        deadlineAt,
        frozenRemainingMs: normalizeNumber(attempt.frozenRemainingMs),
        effectiveTimeLimitSeconds: Math.floor(normalizeNumber(attempt.effectiveTimeLimitSeconds) ?? 0),
        status: String(attempt.status),
        flow,
        questionBlockKeys: questions.map((question) => question.blockKey)
    })
    const responses = await listGuestAssessmentResponses(executor, responseTable, attemptId)
    const responseMap = new Map<string, string>()
    for (const response of responses) {
        const optionId = parseSelectedOptionId(response.selectedOptionIds)
        if (optionId) responseMap.set(String(response.questionId), optionId)
    }

    const score = scoreAssessmentAttempt(questions, responseMap)
    const scorePercent = Math.round((score.score / Math.max(score.total, 1)) * 10_000) / 100
    const passingScorePercent = normalizeNumber(attempt.passingScorePercentSnapshot)
    const passed = passingScorePercent === null || (score.score / Math.max(score.total, 1)) * 100 >= passingScorePercent
    const status = effectiveReason === 'timed_out' ? 'TimedOut' : effectiveReason === 'revoked' ? 'Revoked' : passed ? 'Passed' : 'Failed'
    const submittedAt = effectiveReason === 'timed_out' && deadlineAt ? deadlineAt : now.toISOString()
    const columns = attemptTable.columns

    await updateGuestAssessmentAttempt(
        executor,
        attemptTable,
        attemptId,
        participantId,
        {
            [columns.status]: status,
            [columns.finishedReason]: effectiveReason,
            [columns.score]: score.score,
            [columns.scorePercent]: scorePercent,
            [columns.totalQuestions]: score.total,
            [columns.passed]: passed,
            [columns.submittedAt]: submittedAt
        },
        participantId
    )

    return {
        ...attempt,
        status,
        finishedReason: effectiveReason,
        score: score.score,
        scorePercent,
        totalQuestions: score.total,
        passed,
        submittedAt
    }
}

/** Finalize expired attempts before an authorized report reads the attempt table. */
export const reconcileExpiredGuestAssessmentAttempts = async (
    executor: DbExecutor,
    attemptTable: GuestAssessmentAttemptTable,
    responseTable: GuestAssessmentResponseTable,
    now = new Date(),
    limit = 1000
): Promise<number> => {
    let finalizedCount = 0
    let cursor: { id: string; deadlineAt: string | Date } | undefined

    for (;;) {
        const expiredAttempts = await listExpiredGuestAssessmentAttemptIdentities(executor, attemptTable, now.toISOString(), limit, cursor)
        if (expiredAttempts.length === 0) break

        for (const expiredAttempt of expiredAttempts) {
            const finalized = await executor.transaction((transaction) =>
                finalizeGuestAssessmentAttempt(
                    transaction,
                    attemptTable,
                    responseTable,
                    expiredAttempt.id,
                    expiredAttempt.studentId,
                    'timed_out',
                    now
                )
            )
            if (String(finalized?.status ?? '').toLowerCase() === 'timedout') finalizedCount += 1
        }

        if (expiredAttempts.length < limit) break
        const lastAttempt = expiredAttempts[expiredAttempts.length - 1]
        cursor = { id: lastAttempt.id, deadlineAt: lastAttempt.deadlineAt }
    }

    return finalizedCount
}
