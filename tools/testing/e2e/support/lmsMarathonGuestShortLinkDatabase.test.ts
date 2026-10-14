import assert from 'node:assert/strict'
import test from 'node:test'
import { parseGuestAssessmentResponseRecord } from './lmsMarathonGuestShortLinkResponseParser.ts'

const validResponse = () => ({
    id: '018f8a78-7b8f-7c1d-a111-222233334444',
    attemptId: '018f8a78-7b8f-7c1d-a111-222233334445',
    studentId: '018f8a78-7b8f-7c1d-a111-222233334446',
    quizId: '018f8a78-7b8f-7c1d-a111-222233334447',
    questionId: '018f8a78-7b8f-7c1d-a111-222233334448',
    selectedOptionIds: ['018f8a78-7b8f-7c1d-a111-222233334449'],
    isCorrect: false,
    attemptNumber: 1,
    submittedAt: new Date('2026-10-13T12:00:00.000Z')
})

test('preserves valid PostgreSQL answer data and parses JSON-encoded option arrays strictly', () => {
    const response = validResponse()
    assert.deepEqual(parseGuestAssessmentResponseRecord(response), {
        ...response,
        submittedAt: '2026-10-13T12:00:00.000Z'
    })

    const jsonEncodedResponse = { ...response, selectedOptionIds: JSON.stringify(response.selectedOptionIds) }
    assert.deepEqual(parseGuestAssessmentResponseRecord(jsonEncodedResponse).selectedOptionIds, response.selectedOptionIds)
    assert.equal(parseGuestAssessmentResponseRecord(response).isCorrect, false)
})

test('rejects nullable or non-boolean correctness values instead of treating them as incorrect answers', () => {
    for (const isCorrect of [null, undefined, 0, 'false']) {
        assert.throws(() => parseGuestAssessmentResponseRecord({ ...validResponse(), isCorrect }), /boolean IsCorrect/u)
    }
})

test('rejects option arrays with invalid entries or malformed JSON instead of silently filtering selections', () => {
    for (const selectedOptionIds of [['018f8a78-7b8f-7c1d-a111-222233334449', null], [], '["valid", null]', '{broken json}']) {
        assert.throws(() => parseGuestAssessmentResponseRecord({ ...validResponse(), selectedOptionIds }), /SelectedOptionIds/u)
    }
})

test('rejects invalid database timestamps instead of stringifying missing or malformed values', () => {
    for (const submittedAt of [null, undefined, 'not-a-timestamp', new Date(Number.NaN)]) {
        assert.throws(() => parseGuestAssessmentResponseRecord({ ...validResponse(), submittedAt }), /SubmittedAt/u)
    }
})
