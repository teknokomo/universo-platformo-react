import { getInitialRemainingSeconds, normalizeGuestQuizAttempt } from '../guestRuntimeUtils'

const activeAttempt = {
    attemptId: 'attempt-1',
    attemptNumber: 1,
    status: 'in_progress',
    phase: 'question',
    phaseRevision: 0,
    timerState: 'running',
    remainingMs: 2_640_000,
    numberingMode: 'global',
    currentBlock: null,
    currentQuestionIndex: 1,
    totalQuestions: 3,
    answeredCount: 1,
    deadlineAt: '2030-01-01T00:45:00.000Z',
    serverNow: '2030-01-01T00:01:00.000Z',
    questions: [{ id: 'question-2', prompt: 'Current prompt', displayNumber: '2', options: [{ id: 'option-2', label: 'Current option' }] }]
}

describe('guest attempt DTO normalization', () => {
    it('accepts only the current question and numeric progress', () => {
        const attempt = normalizeGuestQuizAttempt(activeAttempt)

        expect(attempt).toMatchObject({
            currentQuestionIndex: 1,
            totalQuestions: 3,
            answeredCount: 1,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'running',
            remainingMs: 2_640_000,
            numberingMode: 'global',
            currentBlock: null,
            questions: [{ id: 'question-2', prompt: 'Current prompt', displayNumber: '2' }]
        })
    })

    it('rejects payloads that expose multiple questions or inconsistent progress', () => {
        expect(
            normalizeGuestQuizAttempt({
                ...activeAttempt,
                questions: [...activeAttempt.questions, { id: 'question-3', prompt: 'Future prompt', options: [] }]
            })
        ).toBeNull()
        expect(normalizeGuestQuizAttempt({ ...activeAttempt, answeredCount: 0 })).toBeNull()
    })

    it('keeps completion results while dropping all question content', () => {
        const attempt = normalizeGuestQuizAttempt({
            ...activeAttempt,
            status: 'completed',
            questions: [],
            currentQuestionIndex: 3,
            answeredCount: 2,
            result: { score: 1, total: 3, passed: false, finishedReason: 'submitted' },
            completionText: 'Thank you'
        })

        expect(attempt).toMatchObject({
            status: 'completed',
            phase: 'question',
            totalQuestions: 3,
            currentQuestionIndex: 3,
            answeredCount: 2,
            questions: [],
            result: { correctCount: 1, totalQuestions: 3, completionText: 'Thank you' }
        })
    })

    it('accepts block introductions without a question and strips unknown block metadata', () => {
        const attempt = normalizeGuestQuizAttempt({
            ...activeAttempt,
            phase: 'block_intro',
            phaseRevision: 3,
            numberingMode: 'block',
            currentQuestionIndex: 1,
            answeredCount: 1,
            questions: [],
            currentBlock: { key: 'private-block-key', title: 'Module two', introduction: 'Read these instructions.' }
        })

        expect(attempt).toMatchObject({
            phase: 'block_intro',
            phaseRevision: 3,
            numberingMode: 'block',
            currentBlock: { title: 'Module two', introduction: 'Read these instructions.' },
            questions: []
        })
        expect(attempt?.currentBlock).not.toHaveProperty('key')
    })

    it('allows terminal block-intro DTOs without a current block but keeps active intros strict', () => {
        expect(
            normalizeGuestQuizAttempt({
                ...activeAttempt,
                phase: 'block_intro',
                phaseRevision: 3,
                numberingMode: 'block',
                currentQuestionIndex: 0,
                answeredCount: 0,
                questions: [],
                currentBlock: null
            })
        ).toBeNull()

        const attempt = normalizeGuestQuizAttempt({
            ...activeAttempt,
            status: 'timed_out',
            phase: 'block_intro',
            phaseRevision: 3,
            timerState: 'running',
            remainingMs: 0,
            numberingMode: 'block',
            currentBlock: null,
            currentQuestionIndex: 0,
            answeredCount: 0,
            deadlineAt: '2030-01-01T00:45:00.000Z',
            serverNow: '2030-01-01T00:45:00.000Z',
            questions: [],
            result: { score: 1, total: 3, passed: false, finishedReason: 'timed_out' }
        })

        expect(attempt).toMatchObject({
            status: 'completed',
            phase: 'block_intro',
            phaseRevision: 3,
            currentBlock: null,
            questions: [],
            result: { correctCount: 1, totalQuestions: 3, finishedReason: 'timed_out' }
        })
    })

    it('requires the phase contract and rejects malformed display numbers or timer values', () => {
        expect(normalizeGuestQuizAttempt({ ...activeAttempt, phase: undefined })).toBeNull()
        expect(normalizeGuestQuizAttempt({ ...activeAttempt, phaseRevision: -1 })).toBeNull()
        expect(normalizeGuestQuizAttempt({ ...activeAttempt, remainingMs: null })).toBeNull()
        expect(
            normalizeGuestQuizAttempt({
                ...activeAttempt,
                questions: [{ ...activeAttempt.questions[0], displayNumber: undefined }]
            })
        ).toBeNull()
        expect(normalizeGuestQuizAttempt({ ...activeAttempt, currentBlock: undefined })).toBeNull()
    })

    it('uses server remaining time and keeps paused timer values frozen', () => {
        const pausedAttempt = normalizeGuestQuizAttempt({
            ...activeAttempt,
            timerState: 'paused',
            remainingMs: 125_000
        })

        expect(pausedAttempt).not.toBeNull()
        expect(getInitialRemainingSeconds(pausedAttempt!)).toBe(125)
        expect(getInitialRemainingSeconds({ ...pausedAttempt!, remainingMs: 124_000 })).toBe(124)
    })
})
