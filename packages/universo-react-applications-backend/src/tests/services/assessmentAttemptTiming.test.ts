import {
    createAssessmentAttemptTiming,
    freezeAssessmentAttemptTimer,
    getAssessmentAttemptRemainingMs,
    resumeAssessmentAttemptTimer
} from '../../services/assessmentAttemptTiming'

describe('assessment attempt timing', () => {
    const now = new Date('2026-10-17T10:00:00.000Z')

    it('starts running or paused from the authoritative server clock and preserves exact milliseconds', () => {
        expect(createAssessmentAttemptTiming({ effectiveTimeLimitSeconds: 2700, startsOnPausedIntro: false, now })).toEqual({
            timerState: 'running',
            deadlineAt: '2026-10-17T10:45:00.000Z',
            frozenRemainingMs: null
        })
        expect(createAssessmentAttemptTiming({ effectiveTimeLimitSeconds: 2700, startsOnPausedIntro: true, now })).toEqual({
            timerState: 'paused',
            deadlineAt: null,
            frozenRemainingMs: 2700000
        })
        expect(createAssessmentAttemptTiming({ effectiveTimeLimitSeconds: 0, startsOnPausedIntro: true, now })).toEqual({
            timerState: 'untimed',
            deadlineAt: null,
            frozenRemainingMs: null
        })
    })

    it('freezes only positive remaining time and resumes it exactly once from server time', () => {
        const running = { timerState: 'running' as const, deadlineAt: '2026-10-17T10:45:00.000Z', frozenRemainingMs: null }
        const frozen = freezeAssessmentAttemptTimer(running, new Date('2026-10-17T10:02:13.456Z'))
        expect(frozen).toEqual({
            timing: { timerState: 'paused', deadlineAt: null, frozenRemainingMs: 2566544 }
        })
        if (!('timing' in frozen)) throw new Error('Expected a valid frozen timer')
        expect(getAssessmentAttemptRemainingMs(frozen.timing, new Date('2026-10-17T12:00:00.000Z'))).toBe(2566544)
        expect(resumeAssessmentAttemptTimer(frozen.timing, new Date('2026-10-17T12:00:00.000Z'))).toEqual({
            timerState: 'running',
            deadlineAt: '2026-10-17T12:42:46.544Z',
            frozenRemainingMs: null
        })
    })

    it('returns the exact deadline for a timeout instead of freezing zero time', () => {
        const timing = { timerState: 'running' as const, deadlineAt: '2026-10-17T10:00:00.000Z', frozenRemainingMs: null }
        expect(freezeAssessmentAttemptTimer(timing, now)).toEqual({ expiredAt: '2026-10-17T10:00:00.000Z' })
        expect(getAssessmentAttemptRemainingMs(timing, now)).toBe(0)
    })
})
