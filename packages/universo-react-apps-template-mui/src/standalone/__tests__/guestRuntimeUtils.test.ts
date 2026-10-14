import { normalizeGuestQuizAttempt } from '../guestRuntimeUtils'

const activeAttempt = {
    attemptId: 'attempt-1',
    attemptNumber: 1,
    status: 'in_progress',
    currentQuestionIndex: 1,
    totalQuestions: 3,
    answeredCount: 1,
    deadlineAt: '2030-01-01T00:45:00.000Z',
    serverNow: '2030-01-01T00:01:00.000Z',
    questions: [{ id: 'question-2', prompt: 'Current prompt', options: [{ id: 'option-2', label: 'Current option' }] }]
}

describe('guest attempt DTO normalization', () => {
    it('accepts only the current question and numeric progress', () => {
        const attempt = normalizeGuestQuizAttempt(activeAttempt)

        expect(attempt).toMatchObject({
            currentQuestionIndex: 1,
            totalQuestions: 3,
            answeredCount: 1,
            questions: [{ id: 'question-2', prompt: 'Current prompt' }]
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
            totalQuestions: 3,
            currentQuestionIndex: 3,
            answeredCount: 2,
            questions: [],
            result: { correctCount: 1, totalQuestions: 3, completionText: 'Thank you' }
        })
    })
})
