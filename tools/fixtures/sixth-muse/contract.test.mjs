import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
    collectSixthMuseContractErrors,
    createBalancedPositionSequence,
    createExpectedOptionOrder,
    loadOriginalSourceIfPresent,
    loadSixthMuseSource,
    parseOriginalSource
} from './validate.mjs'

const dataset = await loadSixthMuseSource()
const originalMarkdown = await loadOriginalSourceIfPresent()
const questions = dataset.blocks.flatMap(({ questions: blockQuestions }) => blockQuestions)
const questionByNumber = (number) => questions.find(({ sourceQuestionNumber }) => sourceQuestionNumber === number)

test('source is generation-ready and preserves the original Markdown transcription', () => {
    assert.deepEqual(collectSixthMuseContractErrors(dataset, originalMarkdown), [])
    assert.equal(dataset.blocks.length, 3)
    assert.equal(questions.length, 30)
    assert.equal(dataset.review.authorDecisionRequiredRows, 0)
    assert.deepEqual(dataset.review.unresolvedQuestionIds, [])

    if (typeof originalMarkdown === 'string') {
        const parsed = parseOriginalSource(originalMarkdown)
        const originalRows = parsed.flatMap(({ title, questions: blockQuestions }) =>
            blockQuestions.map((question) => ({ ...question, blockTitle: title }))
        )
        assert.equal(originalRows.length, 30)
        for (const [index, original] of originalRows.entries()) {
            const question = questions[index]
            assert.equal(question.originalPrompt, original.prompt)
            assert.equal(question.sourceAnswer, original.answer)
        }
    }
})

test('every runtime question has one verified answer and three fact-checked distractors', () => {
    for (const question of questions) {
        assert.ok(question.runtimePrompt.trim())
        assert.equal(question.review.disposition, 'scoring-approved')
        assert.equal(question.review.ambiguityStatus, 'reviewed-single-correct')
        assert.ok(question.review.singleCorrectRationale.trim())
        assert.equal(question.options.length, 4)
        assert.equal(new Set(question.options.map(({ text }) => text.normalize('NFC').trim())).size, 4)
        assert.equal(question.options.filter(({ isCorrect }) => isCorrect).length, 1)
        assert.equal(question.options.filter(({ kind }) => kind === 'distractor').length, 3)

        const correct = question.options.find(({ isCorrect }) => isCorrect)
        assert.equal(correct.id, question.verifiedCorrectOptionId)
        assert.equal(correct.text, question.verifiedCorrectAnswer)
        for (const option of question.options) {
            assert.ok(option.reviewNote.trim())
            assert.ok(option.evidenceRefs.length > 0)
            assert.ok(option.evidenceRefs.every((ref) => dataset.evidenceSources[ref]))
        }
    }
})

test('answer positions are balanced and options follow the reproducible seeded shuffle', () => {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const schedule = dataset.answerPositionSchedule
    const positions = createBalancedPositionSequence(schedule.seed)
    assert.deepEqual(schedule.positionsByQuestion, positions)

    for (const [index, question] of questions.entries()) {
        counts[question.verifiedCorrectPosition] += 1
        assert.equal(question.verifiedCorrectPosition, positions[index])
        assert.equal(question.options[question.verifiedCorrectPosition - 1].id, question.verifiedCorrectOptionId)
        assert.deepEqual(
            question.options.map(({ id }) => id),
            createExpectedOptionOrder(question, question.verifiedCorrectPosition, schedule.seed)
        )
    }
    assert.deepEqual(counts, { 1: 8, 2: 7, 3: 7, 4: 8 })
    assert.deepEqual(schedule.verifiedCorrectPositionCounts, counts)
    assert.notDeepEqual(
        positions,
        questions.map((_, index) => (index % 4) + 1)
    )
    assert.ok(new Set(positions.slice(0, -2).map((_, index) => positions.slice(index, index + 3).join(''))).size >= 20)
    for (let index = 2; index < positions.length; index += 1) {
        assert.ok(positions[index] !== positions[index - 1] || positions[index] !== positions[index - 2])
    }

    assert.equal(dataset.provenanceReviewRegister.length, 30)
    assert.equal(new Set(dataset.provenanceReviewRegister.map(({ questionId }) => questionId)).size, 30)
    assert.equal(dataset.editorialChanges.length, 23)
})

test('runtime editorial resolutions address the known source ambiguities without changing provenance', () => {
    assert.match(questionByNumber(2).runtimePrompt, /прозвище.*Антона Дельвига/i)
    assert.equal(questionByNumber(2).verifiedCorrectAnswer, '«Тося»')
    assert.equal(questionByNumber(9).verifiedCorrectAnswer, '«Паяс»')
    assert.doesNotMatch(questionByNumber(10).runtimePrompt, /Маслависти/i)
    assert.match(questionByNumber(12).runtimePrompt, /редактор/i)
    assert.match(questionByNumber(13).runtimePrompt, /январе 1825 года.*Михайловском/i)
    assert.match(questionByNumber(14).runtimePrompt, /поэт.*восстании декабристов.*Аргивяне/i)
    assert.doesNotMatch(questionByNumber(17).runtimePrompt, /профессиональн/i)
    assert.doesNotMatch(questionByNumber(19).runtimePrompt, /исключительно/i)
    assert.doesNotMatch(questionByNumber(22).runtimePrompt, /самым старшим/i)
    assert.equal(questionByNumber(23).verifiedCorrectAnswer, 'В 1799 году.')
    assert.equal(questionByNumber(24).verifiedCorrectAnswer, 'В 1801 году.')
    assert.match(questionByNumber(27).runtimePrompt, /умер.*1856 году/i)
    assert.doesNotMatch(questionByNumber(28).runtimePrompt, /33 года/i)

    const expectedSourceAnswers = new Map([
        [19, 'Модест Корф и Дмитрий Маслов.'],
        [23, 'Сергей Ломоносов и Модест Корф.'],
        [24, 'Константин Данзас и Александр Корнилов.']
    ])
    for (const [number, sourceAnswer] of expectedSourceAnswers) assert.equal(questionByNumber(number).sourceAnswer, sourceAnswer)
})

test('rejects duplicated options, multiple correct choices, and unresolved review status', () => {
    const duplicateOption = structuredClone(dataset)
    duplicateOption.blocks[0].questions[0].options[0].text = duplicateOption.blocks[0].questions[0].options[1].text
    assert.ok(
        collectSixthMuseContractErrors(duplicateOption, originalMarkdown).some((error) => error.includes('unique normalized option texts'))
    )

    const multipleCorrect = structuredClone(dataset)
    multipleCorrect.blocks[0].questions[0].options[1].isCorrect = true
    assert.ok(
        collectSixthMuseContractErrors(multipleCorrect, originalMarkdown).some((error) => error.includes('exactly one correct option'))
    )

    const unresolved = structuredClone(dataset)
    unresolved.blocks[2].questions[2].review.disposition = 'author-decision-required'
    assert.ok(
        collectSixthMuseContractErrors(unresolved, originalMarkdown).some((error) => error.includes('fully reviewed and scoring-approved'))
    )
})

test('requires evidence references only for an actual editorial mapping', () => {
    const unchangedPrompt = structuredClone(dataset)
    assert.equal(questionByNumber(3).editorialMapping, null)
    assert.ok(questionByNumber(3).review.evidenceRefs.length > 0)
    assert.ok(questionByNumber(3).options.find(({ isCorrect }) => isCorrect).evidenceRefs.length > 0)
    assert.ok(
        !collectSixthMuseContractErrors(unchangedPrompt, originalMarkdown).some((error) =>
            error.includes('sixth-muse-q03 editorial mapping')
        )
    )

    const missingMappingEvidence = structuredClone(dataset)
    const mappedQuestion = missingMappingEvidence.blocks
        .flatMap(({ questions: rows }) => rows)
        .find(({ sourceQuestionNumber }) => sourceQuestionNumber === 2)
    mappedQuestion.editorialMapping.evidenceRefs = []
    assert.ok(
        collectSixthMuseContractErrors(missingMappingEvidence, originalMarkdown).some((error) =>
            error.includes('sixth-muse-q02 editorial mapping must retain one or more evidence references')
        )
    )
})

test('content resolutions use cited source-specific facts for previously ambiguous rows', () => {
    const expected = new Map([
        [1, { prompt: /Модест Корф.*«Французом»/i, answer: 'Александр Пушкин.', evidence: 'museumSobriquets' }],
        [4, { prompt: /МГИМО.*какое прозвище/i, answer: '«Крот»', evidence: 'mgimoLomonosov' }],
        [7, { prompt: /Культура\.РФ.*«Казак»/i, answer: 'Иван Малиновский.', evidence: 'cultureLiceyFates' }],
        [9, { prompt: /форму прозвища.*Всероссийского музея/i, answer: '«Паяс»', evidence: 'museumSobriquets' }],
        [
            15,
            { prompt: /министром иностранных дел.*государственным канцлером/i, answer: 'Александр Горчаков.', evidence: 'prlibGorchakov' }
        ],
        [18, { prompt: /Алексей Илличевский/i, answer: 'Он стал поэтом и переводчиком.', evidence: 'febIllichevskyTranslation' }],
        [
            20,
            {
                prompt: /основная служба Владимира Вольховского/i,
                answer: 'К военной службе; дослужился до генерал-майора.',
                evidence: 'museumVolkhovsky'
            }
        ],
        [26, { prompt: /умер в 1837 году/i, answer: 'Алексей Илличевский.', evidence: 'febIllichevskyDates' }]
    ])

    for (const [number, fact] of expected) {
        const question = questionByNumber(number)
        assert.match(question.runtimePrompt, fact.prompt)
        assert.equal(question.verifiedCorrectAnswer, fact.answer)
        const correct = question.options.find(({ isCorrect }) => isCorrect)
        assert.ok(correct.evidenceRefs.includes(fact.evidence), `Q${number} must cite ${fact.evidence}`)
    }
    assert.doesNotMatch(questionByNumber(1).runtimePrompt, /Егоза/i)
    assert.match(questionByNumber(20).verifiedCorrectAnswer, /генерал-майора/)
})

test('rejects source-provenance drift and wrong answer-position metadata', () => {
    if (typeof originalMarkdown === 'string') {
        const changedSource = structuredClone(dataset)
        changedSource.blocks[0].questions[0].originalPrompt += ' '
        assert.ok(collectSixthMuseContractErrors(changedSource, originalMarkdown).some((error) => error.includes('transcription digest')))
        assert.ok(
            collectSixthMuseContractErrors(changedSource, originalMarkdown).some((error) => error.includes('differs from the author file'))
        )
    }

    const changedPosition = structuredClone(dataset)
    changedPosition.blocks[0].questions[0].verifiedCorrectPosition = 4
    assert.ok(
        collectSixthMuseContractErrors(changedPosition, originalMarkdown).some((error) =>
            error.includes('position must match its option order')
        )
    )
})

test('keeps the fixture valid UTF-8 JSON and verifies source keys for pair-based questions', async () => {
    const raw = await readFile(new URL('./source.json', import.meta.url), 'utf8')
    assert.doesNotThrow(() => JSON.parse(raw))
    assert.equal(questionByNumber(19).sourceAnswer, 'Модест Корф и Дмитрий Маслов.')
    assert.equal(questionByNumber(23).sourceAnswer, 'Сергей Ломоносов и Модест Корф.')
    assert.equal(questionByNumber(24).sourceAnswer, 'Константин Данзас и Александр Корнилов.')
})
