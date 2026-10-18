import {
    buildAssessmentAttemptSnapshot,
    createAssessmentQuestionSetDigest,
    scoreAssessmentAttempt,
    toGuestAssessmentAttemptState,
    type SourceAssessmentQuestion
} from '../../services/assessmentAttemptLifecycle'
import { createAssessmentAttemptFlowSnapshot, parseAssessmentAttemptRuntimeState } from '../../services/assessmentAttemptFlow'

const flatFlow = createAssessmentAttemptFlowSnapshot({
    blocks: [],
    pauseTimerOnBlockIntro: false,
    numberingMode: 'global',
    completionText: ''
})

const uuidV7 = (index: number): string => `018f4e2a-6d50-7abc-8def-${index.toString(16).padStart(12, '0')}`
const optionId = (questionIndex: number, optionIndex: number): string => uuidV7(500 + questionIndex * 20 + optionIndex)

const buildQuestion = (index: number, optionCount = 4): SourceAssessmentQuestion => ({
    id: uuidV7(index + 1),
    prompt: `Question ${index + 1}`,
    description: `Description ${index + 1}`,
    explanation: `Private explanation ${index + 1}`,
    sortOrder: index + 1,
    blockKey: null,
    options: Array.from({ length: optionCount }, (_, optionIndex) => ({
        id: optionId(index, optionIndex),
        label: optionIndex === 0 ? `Correct ${index + 1}` : `Wrong ${optionIndex} ${index + 1}`,
        isCorrect: optionIndex === 0
    }))
})

describe('assessment attempt lifecycle helpers', () => {
    it('balances correct option positions across a 30-question attempt and keeps stable question order', () => {
        const questions = Array.from({ length: 30 }, (_, index) => buildQuestion(index)).reverse()
        const snapshot = buildAssessmentAttemptSnapshot(questions, flatFlow)
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

        const snapshot = buildAssessmentAttemptSnapshot([secondQuestion, firstQuestion], flatFlow)

        expect(snapshot.map((question) => question.prompt)).toEqual(['Question 2', 'Question 1'])
    })

    it.each([2, 5, 20])('balances correct positions for questions with %i options', (optionCount) => {
        const questions = Array.from({ length: optionCount * 3 }, (_, index) => buildQuestion(index, optionCount))
        const snapshot = buildAssessmentAttemptSnapshot(questions, flatFlow)
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
        expect(() => buildAssessmentAttemptSnapshot([noKey], flatFlow)).toThrow('Exactly one correct option is required')

        const duplicate = buildQuestion(1)
        duplicate.options[1] = { ...duplicate.options[1], id: duplicate.options[0].id }
        expect(() => buildAssessmentAttemptSnapshot([duplicate], flatFlow)).toThrow('Option identifiers must be unique')
    })

    it('rejects answer option identifiers that are not UUID v7 values', () => {
        const question = buildQuestion(0)
        question.options[0] = { ...question.options[0], id: 'correct-option' }

        expect(() => buildAssessmentAttemptSnapshot([question], flatFlow)).toThrow('UUID v7 is required')
    })

    it('scores only persisted selected option identities and treats missing answers as incorrect', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1)], flatFlow)
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
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1), buildQuestion(2)], flatFlow)
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(100),
            attemptNumber: 2,
            status: 'in_progress',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id],
            flow: flatFlow,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'running',
            remainingMs: 60000
        })

        expect(state.currentQuestionIndex).toBe(1)
        expect(state.totalQuestions).toBe(3)
        expect(state.answeredCount).toBe(1)
        expect(state.attemptNumber).toBe(2)
        expect(state.questions).toHaveLength(1)
        expect(state.questions[0].id).toBe(questions[1].id)
        expect(Object.keys(state.questions[0]).sort()).toEqual(['description', 'displayNumber', 'id', 'options', 'prompt', 'sortOrder'])
        expect(state.questions[0].sortOrder).toBe(2)
        expect(JSON.stringify(state)).not.toContain('isCorrect')
        expect(JSON.stringify(state)).not.toContain('explanation')
        expect(JSON.stringify(state)).not.toContain('Private explanation')
        expect(JSON.stringify(state)).not.toContain(questions[0].prompt)
        expect(JSON.stringify(state)).not.toContain(questions[2].prompt)
        expect(state).not.toHaveProperty('answeredQuestionIds')
        expect(state.questions[0].options.every((option) => Object.keys(option).sort().join(',') === 'id,label')).toBe(true)
    })

    it('withholds every question and answer identity after completion or revocation', () => {
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0), buildQuestion(1)], flatFlow)
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(101),
            attemptNumber: 1,
            status: 'completed',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id],
            flow: flatFlow,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'running',
            remainingMs: 1000,
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
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0)], flatFlow)
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(102),
            attemptNumber: 1,
            status: 'revoked',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [questions[0].id],
            flow: flatFlow,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'running',
            remainingMs: 0,
            result: { score: 0, total: 1, passed: false, finishedReason: 'revoked' }
        })

        expect(state.questions).toEqual([])
        expect(state.answeredCount).toBe(0)
        expect(state.currentQuestionIndex).toBe(1)
        expect(JSON.stringify(state)).not.toContain(questions[0].id)
        expect(JSON.stringify(state)).not.toContain('Question 1')
    })

    it('emits a deterministic digest for a persisted snapshot', () => {
        const snapshot = buildAssessmentAttemptSnapshot([buildQuestion(0)], flatFlow)
        expect(createAssessmentQuestionSetDigest(snapshot)).toBe(createAssessmentQuestionSetDigest(snapshot))
    })

    it('uses global numbering for empty-block quizzes at start, snapshot parsing, and display projection', () => {
        const startedFlow = createAssessmentAttemptFlowSnapshot({
            blocks: [],
            pauseTimerOnBlockIntro: false,
            numberingMode: 'block',
            completionText: ''
        })
        const legacySnapshot = { ...flatFlow, numberingMode: 'block' as const }
        const parsedRuntime = parseAssessmentAttemptRuntimeState({
            phase: 'question',
            phaseRevision: 0,
            timerState: 'untimed',
            deadlineAt: null,
            frozenRemainingMs: null,
            effectiveTimeLimitSeconds: 0,
            status: 'started',
            flow: legacySnapshot,
            questionBlockKeys: [null]
        })
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0)], startedFlow)
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(1000),
            attemptNumber: 1,
            status: 'in_progress',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: null,
            questions,
            answeredQuestionIds: [],
            flow: legacySnapshot,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'untimed',
            remainingMs: null
        })

        expect(startedFlow.numberingMode).toBe('global')
        expect(parsedRuntime.flow.numberingMode).toBe('global')
        expect(state.numberingMode).toBe('global')
        expect(state.questions[0]?.displayNumber).toBe('1')
    })

    it('orders blocked snapshots by block order and question order and exposes only the active introduction', () => {
        const firstBlockKey = uuidV7(900)
        const secondBlockKey = uuidV7(901)
        const flow = createAssessmentAttemptFlowSnapshot({
            blocks: [
                { key: secondBlockKey, title: 'Second block', introduction: null, sortOrder: 2 },
                { key: firstBlockKey, title: 'First block', introduction: 'Read this first.', sortOrder: 1 }
            ],
            pauseTimerOnBlockIntro: true,
            numberingMode: 'block',
            completionText: 'Finished'
        })
        const secondQuestion = { ...buildQuestion(1), blockKey: secondBlockKey, sortOrder: 2 }
        const firstBlockSecondQuestion = { ...buildQuestion(2), blockKey: firstBlockKey, sortOrder: 2 }
        const firstQuestion = { ...buildQuestion(0), blockKey: firstBlockKey, sortOrder: 1 }
        const questions = buildAssessmentAttemptSnapshot([secondQuestion, firstBlockSecondQuestion, firstQuestion], flow)

        expect(questions.map((question) => question.id)).toEqual([firstQuestion.id, firstBlockSecondQuestion.id, secondQuestion.id])
        const intro = toGuestAssessmentAttemptState({
            attemptId: uuidV7(902),
            attemptNumber: 1,
            status: 'in_progress',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: null,
            questions,
            answeredQuestionIds: [],
            flow,
            phase: 'block_intro',
            phaseRevision: 0,
            timerState: 'paused',
            remainingMs: 2700000
        })
        expect(intro.currentBlock).toEqual({ title: 'First block', introduction: 'Read this first.' })
        expect(intro.questions).toEqual([])
        expect(JSON.stringify(intro)).not.toContain(firstBlockKey)
        expect(intro.remainingMs).toBe(2700000)

        const questionState = toGuestAssessmentAttemptState({
            attemptId: uuidV7(902),
            attemptNumber: 1,
            status: 'in_progress',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: '2026-10-11T10:45:00.000Z',
            questions,
            answeredQuestionIds: [],
            flow,
            phase: 'question',
            phaseRevision: 1,
            timerState: 'running',
            remainingMs: 2699000
        })
        expect(questionState.questions[0]?.displayNumber).toBe('1.1')
        expect(questionState.currentBlock).toBeNull()
        expect(questionState.currentQuestionIndex).toBe(0)
    })

    it('resolves completion text using the locale requested for the current attempt response', () => {
        const flow = createAssessmentAttemptFlowSnapshot({
            blocks: [],
            pauseTimerOnBlockIntro: false,
            numberingMode: 'global',
            completionText: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Thank you' },
                    ru: { content: 'Спасибо' }
                }
            }
        })
        const questions = buildAssessmentAttemptSnapshot([buildQuestion(0)], flow)
        const state = toGuestAssessmentAttemptState({
            attemptId: uuidV7(990),
            attemptNumber: 1,
            status: 'completed',
            startedAt: '2026-10-11T10:00:00.000Z',
            deadlineAt: null,
            questions,
            answeredQuestionIds: [],
            flow,
            phase: 'question',
            phaseRevision: 0,
            timerState: 'untimed',
            remainingMs: null,
            locale: 'ru'
        })

        expect(state.completionText).toBe('Спасибо')
    })

    it('rejects invalid block membership and impossible paused runtime states', () => {
        const blockKey = uuidV7(950)
        const flow = createAssessmentAttemptFlowSnapshot({
            blocks: [{ key: blockKey, title: 'Block', introduction: null, sortOrder: 0 }],
            pauseTimerOnBlockIntro: true,
            numberingMode: 'global',
            completionText: ''
        })
        expect(() => buildAssessmentAttemptSnapshot([{ ...buildQuestion(0), blockKey: null }], flow)).toThrow(
            'Every blocked assessment question must belong to a non-empty block'
        )
        expect(() =>
            parseAssessmentAttemptRuntimeState({
                phase: 'block_intro',
                phaseRevision: 0,
                timerState: 'paused',
                deadlineAt: null,
                frozenRemainingMs: 0,
                effectiveTimeLimitSeconds: 2700,
                status: 'Started',
                flow,
                questionBlockKeys: [blockKey]
            })
        ).toThrow()
    })
})
