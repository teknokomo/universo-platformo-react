import {
    buildAssessmentAttemptSnapshot,
    createAssessmentQuestionSetDigest,
    scoreAssessmentAttempt,
    toGuestAssessmentAttemptState,
    type SourceAssessmentQuestion
} from '../../services/assessmentAttemptLifecycle'

const uuidV7 = (index: number): string => `018f4e2a-6d50-7abc-8def-${index.toString(16).padStart(12, '0')}`
const optionId = (questionIndex: number, optionIndex: number): string => uuidV7(500 + questionIndex * 20 + optionIndex)

const buildQuestion = (index: number, optionCount = 4): SourceAssessmentQuestion => ({
    id: uuidV7(index + 1),
    prompt: `Question ${index + 1}`,
    description: `Description ${index + 1}`,
    explanation: `Private explanation ${index + 1}`,
    sortOrder: index + 1,
    options: Array.from({ length: optionCount }, (_, optionIndex) => ({
        id: optionId(index, optionIndex),
        label: optionIndex === 0 ? `Correct ${index + 1}` : `Wrong ${optionIndex} ${index + 1}`,
        isCorrect: optionIndex === 0
    }))
})

describe('assessment attempt lifecycle helpers', () => {
    it('balances correct option positions across a 30-question attempt and keeps stable question order', () => {
        const questions = Array.from({ length: 30 }, (_, index) => buildQuestion(index)).reverse()
        const snapshot = buildAssessmentAttemptSnapshot(questions)
        const positionCounts = [0, 0, 0, 0]

        expect(snapshot.map((question) => question.sortOrder)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1))

        for (const question of snapshot) {
            const correctIndex = question.options.findIndex((option) => option.isCorrect)
            expect(correctIndex).toBeGreaterThanOrEqual(0)
            positionCounts[correctIndex] += 1
            expect(question.options).toHaveLength(4)
        }

        expect(positionCounts.sort()).toEqual([7, 7, 8, 8])
    })

    it('preserves source order when authored questions have the same sort order', () => {
        const firstQuestion = buildQuestion(0)
        const secondQuestion = buildQuestion(1)
        firstQuestion.sortOrder = 0
        secondQuestion.sortOrder = 0

        const snapshot = buildAssessmentAttemptSnapshot([secondQuestion, firstQuestion])

        expect(snapshot.map((question) => question.prompt)).toEqual(['Question 2', 'Question 1'])
    })

    it.each([2, 5, 20])('balances correct positions for questions with %i options', (optionCount) => {
        const questions = Array.from({ length: optionCount * 3 }, (_, index) => buildQuestion(index, optionCount))
        const snapshot = buildAssessmentAttemptSnapshot(questions)
        const positionCounts = Array.from({ length: optionCount }, () => 0)

        for (const question of snapshot) {
            const correctIndex = question.options.findIndex((option) => option.isCorrect)
            expect(correctIndex).toBeGreaterThanOrEqual(0)
            expect(correctIndex).toBeLessThan(optionCount)
            expect(question.options).toHaveLength(optionCount)
            positionCounts[correctIndex] += 1
        }

        expect(positionCounts).toEqual(Array.from({ length: optionCount }, () => 3))
    })

    it('rejects questions without exactly one correct option or with duplicate option IDs', () => {
        const noKey = buildQuestion(0)
        noKey.options = noKey.options.map((option) => ({ ...option, isCorrect: false }))
        expect(() => buildAssessmentAttemptSnapshot([noKey])).toThrow('Exactly one correct option is required')

        const duplicate = buildQuestion(1)
        duplicate.options[1] = { ...duplicate.options[1], id: duplicate.options[0].id }
        expect(() => buildAssessmentAttemptSnapshot([duplicate])).toThrow('Option identifiers must be unique')
    })

    it('rejects answer option identifiers that are not UUID v7 values', () => {
        const question = buildQuestion(0)
        question.options[0] = { ...question.options[0], id: 'correct-option' }

        expect(() => buildAssessmentAttemptSnapshot([question])).toThrow('UUID v7 is required')
    })

    it('scores only persisted selected option identities and treats missing answers as incorrect', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1)])
        const score = scoreAssessmentAttempt(
            questions,
            new Map([
                [questions[0].id, questions[0].options.find((option) => option.isCorrect)?.id ?? ''],
                [questions[1].id, questions[1].options.find((option) => !option.isCorrect)?.id ?? '']
            ])
        )

        expect(score).toEqual({ score: 1, total: 2, correctQuestionIds: [questions[0].id] })
        expect(scoreAssessmentAttempt(questions, new Map()).score).toBe(0)
    })

    it('exposes only the current unanswered question and numeric progress', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1), buildQuestion(2)])
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(100),
            attemptNumber: 2,
            status: 'in_progress',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id]
        })

        expect(state.currentQuestionIndex).toBe(1)
        expect(state.totalQuestions).toBe(3)
        expect(state.answeredCount).toBe(1)
        expect(state.attemptNumber).toBe(2)
        expect(state.questions).toHaveLength(1)
        expect(state.questions[0].id).toBe(questions[1].id)
        expect(JSON.stringify(state)).not.toContain('isCorrect')
        expect(JSON.stringify(state)).not.toContain('explanation')
        expect(JSON.stringify(state)).not.toContain('Private explanation')
        expect(JSON.stringify(state)).not.toContain(questions[0].prompt)
        expect(JSON.stringify(state)).not.toContain(questions[2].prompt)
        expect(state).not.toHaveProperty('answeredQuestionIds')
        expect(state.questions[0].options.every((option) => Object.keys(option).sort().join(',') === 'id,label')).toBe(true)
    })

    it('withholds every question and answer identity after completion or revocation', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1)])
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(101),
            attemptNumber: 1,
            status: 'completed',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id],
            result: { score: 0, total: 2, passed: false, finishedReason: 'submitted' }
        })

        expect(state.questions).toEqual([])
        expect(state.answeredCount).toBe(1)
        expect(state.currentQuestionIndex).toBe(2)
        expect(state.totalQuestions).toBe(2)
        expect(JSON.stringify(state)).not.toContain('Question 1')
        expect(JSON.stringify(state)).not.toContain('Correct 2')
        expect(state).not.toHaveProperty('answeredQuestionIds')
    })

    it('hides progress identities and content after revocation', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0)])
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(102),
            attemptNumber: 1,
            status: 'revoked',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id],
            result: { score: 0, total: 1, passed: false, finishedReason: 'revoked' }
        })

        expect(state.questions).toEqual([])
        expect(state.answeredCount).toBe(0)
        expect(state.currentQuestionIndex).toBe(1)
        expect(JSON.stringify(state)).not.toContain(questions[0].id)
        expect(JSON.stringify(state)).not.toContain('Question 1')
    })

    it('emits a deterministic digest for a persisted snapshot', () => {
        const snapshot = buildAssessmentAttemptSnapshot([buildQuestion(0)])
        expect(createAssessmentQuestionSetDigest(snapshot)).toBe(createAssessmentQuestionSetDigest(snapshot))
    })
})
