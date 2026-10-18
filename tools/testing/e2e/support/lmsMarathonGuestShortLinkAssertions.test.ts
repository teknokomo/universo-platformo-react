import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPublicAssessmentAttemptState, assertPublicGuestAnswerResponse } from './lmsMarathonPublicDtoContract.ts'

const publicAttempt = () => ({
    attemptId: '018f8a78-7b8f-7c1d-a111-222233334444',
    attemptNumber: 1,
    status: 'in_progress',
    startedAt: '2026-10-12T12:00:00.000Z',
    deadlineAt: '2026-10-12T12:45:00.000Z',
    serverNow: '2026-10-12T12:00:00.000Z',
    locale: 'en',
    currentQuestionIndex: 0,
    totalQuestions: 2,
    answeredCount: 0,
    phase: 'question',
    phaseRevision: 0,
    timerState: 'running',
    remainingMs: 2700000,
    numberingMode: 'global',
    currentBlock: null,
    questions: [
        {
            id: '018f8a78-7b8f-7c1d-a111-222233334445',
            prompt: 'Question',
            description: null,
            sortOrder: 0,
            displayNumber: '1',
            options: [{ id: '018f8a78-7b8f-7c1d-a111-222233334446', label: 'Choice' }]
        }
    ],
    result: null,
    completionText: ''
})

test('accepts the documented public attempt projection and answer-save envelope', () => {
    const attempt = publicAttempt()
    assert.doesNotThrow(() => assertPublicAssessmentAttemptState(attempt, 'attempt'))
    assert.doesNotThrow(() => assertPublicGuestAnswerResponse({ ok: true, attempt }, 'answer response'))
})

test('rejects private answer data nested in public question, option, or result DTOs', () => {
    const questionLeak = publicAttempt()
    Object.assign(questionLeak.questions[0]!, { correctOptionId: 'private' })
    assert.throws(() => assertPublicAssessmentAttemptState(questionLeak, 'attempt'), /allowlist/u)

    const optionLeak = publicAttempt()
    Object.assign(optionLeak.questions[0]!.options[0]!, { answerKey: true })
    assert.throws(() => assertPublicAssessmentAttemptState(optionLeak, 'attempt'), /allowlist/u)

    const resultLeak = publicAttempt()
    Object.assign(resultLeak, { result: { score: 1, total: 1, passed: true, finishedReason: 'submitted', explanation: 'private' } })
    assert.throws(() => assertPublicAssessmentAttemptState(resultLeak, 'attempt'), /allowlist/u)
})

test('rejects unrecognized fields added to the answer-save response envelope', () => {
    assert.throws(
        () => assertPublicGuestAnswerResponse({ ok: true, attempt: publicAttempt(), answerKey: 'private' }, 'answer response'),
        /allowlist/u
    )
})

test('accepts an in-progress boundary after the final saved answer and a terminal projection', () => {
    const finalAnswerSaved = publicAttempt()
    finalAnswerSaved.phase = 'question'
    finalAnswerSaved.currentQuestionIndex = 2
    finalAnswerSaved.answeredCount = 2
    finalAnswerSaved.questions = []
    assert.doesNotThrow(() => assertPublicAssessmentAttemptState(finalAnswerSaved, 'final answer response'))

    const completed = {
        ...finalAnswerSaved,
        status: 'completed',
        result: { score: 2, total: 2, passed: true, finishedReason: 'submitted' }
    }
    assert.doesNotThrow(() => assertPublicAssessmentAttemptState(completed, 'completed attempt'))
})

test('rejects future question leaks, non-sequential progress, and the removed answeredQuestionIds field', () => {
    const multipleQuestions = publicAttempt()
    multipleQuestions.questions.push({
        id: '018f8a78-7b8f-7c1d-a111-222233334447',
        prompt: 'Future question',
        description: null,
        sortOrder: 1,
        displayNumber: '2',
        options: [{ id: '018f8a78-7b8f-7c1d-a111-222233334448', label: 'Future choice' }]
    })
    assert.throws(() => assertPublicAssessmentAttemptState(multipleQuestions, 'attempt'), /current unanswered question/u)

    const inconsistentProgress = publicAttempt()
    inconsistentProgress.answeredCount = 1
    assert.throws(() => assertPublicAssessmentAttemptState(inconsistentProgress, 'attempt'), /answeredCount/u)

    const legacyProgress = publicAttempt() as ReturnType<typeof publicAttempt> & { answeredQuestionIds: string[] }
    legacyProgress.answeredQuestionIds = []
    assert.throws(() => assertPublicAssessmentAttemptState(legacyProgress, 'attempt'), /answeredQuestionIds/u)
})
