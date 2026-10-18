import type { GuestAssessmentTimerState } from '@universo-react/types'

export interface AssessmentAttemptTiming {
    timerState: GuestAssessmentTimerState
    deadlineAt: string | null
    frozenRemainingMs: number | null
}

export const createAssessmentAttemptTiming = (input: {
    effectiveTimeLimitSeconds: number
    startsOnPausedIntro: boolean
    now: Date
}): AssessmentAttemptTiming => {
    const seconds = Math.floor(input.effectiveTimeLimitSeconds)
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return { timerState: 'untimed', deadlineAt: null, frozenRemainingMs: null }
    }
    const budgetMs = seconds * 1000
    if (input.startsOnPausedIntro) {
        return { timerState: 'paused', deadlineAt: null, frozenRemainingMs: budgetMs }
    }
    return {
        timerState: 'running',
        deadlineAt: new Date(input.now.getTime() + budgetMs).toISOString(),
        frozenRemainingMs: null
    }
}

export const getAssessmentAttemptRemainingMs = (timing: AssessmentAttemptTiming, now: Date): number | null => {
    if (timing.timerState === 'untimed') return null
    if (timing.timerState === 'paused') return timing.frozenRemainingMs
    if (!timing.deadlineAt) throw new Error('Running assessment attempt requires a deadline')
    return Math.max(0, Date.parse(timing.deadlineAt) - now.getTime())
}

export const freezeAssessmentAttemptTimer = (
    timing: AssessmentAttemptTiming,
    now: Date
): { expiredAt: string } | { timing: AssessmentAttemptTiming } => {
    if (timing.timerState !== 'running') return { timing }
    if (!timing.deadlineAt) throw new Error('Running assessment attempt requires a deadline')
    const deadlineMs = Date.parse(timing.deadlineAt)
    if (!Number.isFinite(deadlineMs)) throw new Error('Running assessment attempt has an invalid deadline')
    const remainingMs = deadlineMs - now.getTime()
    if (remainingMs <= 0) return { expiredAt: new Date(deadlineMs).toISOString() }
    return { timing: { timerState: 'paused', deadlineAt: null, frozenRemainingMs: remainingMs } }
}

export const resumeAssessmentAttemptTimer = (timing: AssessmentAttemptTiming, now: Date): AssessmentAttemptTiming => {
    if (timing.timerState !== 'paused' || timing.frozenRemainingMs === null || timing.frozenRemainingMs <= 0) {
        throw new Error('A paused assessment attempt requires positive frozen time')
    }
    return {
        timerState: 'running',
        deadlineAt: new Date(now.getTime() + timing.frozenRemainingMs).toISOString(),
        frozenRemainingMs: null
    }
}
