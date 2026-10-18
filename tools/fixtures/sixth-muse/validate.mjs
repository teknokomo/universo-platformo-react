import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const SIXTH_MUSE_SOURCE_SHA256 = '3cf486bb6ecbddeae52c0d2cc337d2e739a06058bbb058df45e2dbb5f7a14376'
export const SIXTH_MUSE_TRANSCRIPTION_SHA256 = '86ae1a6fd3d661416b7aef76b7062435d1a802ab8d31675713a02aeb6cedfa45'
export const SIXTH_MUSE_BLOCK_TITLES = ['Прозвища лицеистов', 'Достижения и судьбы', 'Даты и цифры']
export const SIXTH_MUSE_EDITORIAL_QUESTION_NUMBERS = [1, 2, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20, 21, 22, 23, 24, 27, 28, 29, 30]
export const SIXTH_MUSE_VERIFIED_POSITION_COUNTS = { 1: 8, 2: 7, 3: 7, 4: 8 }
export const SIXTH_MUSE_POSITION_ALGORITHM = 'sha256-seeded-balanced-fisher-yates-v1'

const DATASET_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(DATASET_DIR, '../../..')
const SOURCE_PATH = path.join(DATASET_DIR, 'source.json')
const ORIGINAL_SOURCE_PATH = path.join(PROJECT_ROOT, '.backup/Квиз-Шестая-муза.md')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

export function seededShuffle(values, seed) {
    const shuffled = [...values]
    let counter = 0

    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const hashWord = createHash('sha256').update(`${seed}:${counter}`).digest().readUInt32BE(0)
        counter += 1
        const swapIndex = Math.floor((hashWord / 0x100000000) * (index + 1))
        ;[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]]
    }

    return shuffled
}

export function createBalancedPositionSequence(seed) {
    const balancedPositions = Object.entries(SIXTH_MUSE_VERIFIED_POSITION_COUNTS).flatMap(([position, count]) =>
        Array(count).fill(Number(position))
    )
    return seededShuffle(balancedPositions, `${seed}:positions`)
}

export function createExpectedOptionOrder(question, position, seed) {
    const correctOption = question.options?.find(({ isCorrect }) => isCorrect === true)
    if (!correctOption || !Number.isInteger(position) || position < 1 || position > 4) return []

    const distractors = question.options
        .filter(({ isCorrect }) => isCorrect === false)
        .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    const shuffledDistractors = seededShuffle(distractors, `${seed}:question:${question.sourceQuestionNumber}:distractors`)
    shuffledDistractors.splice(position - 1, 0, correctOption)
    return shuffledDistractors.map(({ id }) => id)
}

export function parseOriginalSource(markdown) {
    const blocks = []
    let currentBlock
    let pendingQuestion

    for (const line of markdown.split(/\r?\n/)) {
        const blockMatch = line.match(/^Блок (\d+): (.+)$/)
        if (blockMatch) {
            if (currentBlock) blocks.push(currentBlock)
            currentBlock = { order: Number(blockMatch[1]), title: blockMatch[2], questions: [] }
            continue
        }

        const questionMatch = line.match(/^(\d+)\. (.+)$/)
        if (questionMatch) {
            pendingQuestion = { number: Number(questionMatch[1]), prompt: questionMatch[2] }
            continue
        }

        const answerMatch = line.match(/^Ответ: (.+)$/)
        if (answerMatch && pendingQuestion && currentBlock) {
            currentBlock.questions.push({ ...pendingQuestion, answer: answerMatch[1] })
            pendingQuestion = undefined
        }
    }

    if (currentBlock) blocks.push(currentBlock)
    return blocks
}

export function getDatasetTranscription(dataset) {
    return (dataset?.blocks ?? []).flatMap((block) =>
        (block.questions ?? []).map((question) => ({
            number: question.sourceQuestionNumber,
            blockTitle: block.title,
            prompt: question.originalPrompt,
            answer: question.sourceAnswer
        }))
    )
}

const normalizedOptionText = (value) =>
    typeof value === 'string' ? value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru') : ''

function addReferenceErrors(errors, label, refs, evidenceSources) {
    if (!Array.isArray(refs) || refs.length === 0) {
        errors.push(`${label} must retain one or more evidence references`)
        return
    }

    for (const ref of refs) {
        if (!Object.hasOwn(evidenceSources, ref)) errors.push(`${label} references missing evidence source ${ref}`)
    }
}

export function collectSixthMuseContractErrors(dataset, originalMarkdown) {
    const errors = []
    const blocks = Array.isArray(dataset?.blocks) ? dataset.blocks : []
    const questions = blocks.flatMap((block) => (Array.isArray(block.questions) ? block.questions : []))
    const evidenceSources = dataset?.evidenceSources ?? {}

    if (dataset?.datasetId !== 'sixth-muse') errors.push('datasetId must be sixth-muse')
    if (dataset?.datasetVersion !== 1) errors.push('datasetVersion must remain 1')
    if (dataset?.title !== 'Шестая муза' || dataset?.language !== 'ru') errors.push('title and source language must remain canonical')
    if (dataset?.status !== 'reviewed' || dataset?.review?.status !== 'reviewed') errors.push('dataset and review status must be reviewed')
    if (dataset?.promotionStatus !== 'ready-for-generation') errors.push('dataset must be ready for generation')
    if (dataset?.originalSource?.file !== '.backup/Квиз-Шестая-муза.md') errors.push('original author source path must remain pinned')
    if (blocks.length !== 3) errors.push('dataset must contain exactly three blocks')
    if (JSON.stringify(blocks.map(({ title }) => title)) !== JSON.stringify(SIXTH_MUSE_BLOCK_TITLES)) {
        errors.push('block titles and order must match the source document')
    }
    if (questions.length !== 30) errors.push('dataset must contain exactly 30 questions')
    if (blocks.some((block) => !Array.isArray(block.questions) || block.questions.length !== 10)) {
        errors.push('each block must contain exactly 10 questions')
    }

    const allIds = [
        ...blocks.map(({ id }) => id),
        ...questions.flatMap(({ id, options = [] }) => [id, ...options.map(({ id: optionId }) => optionId)])
    ]
    if (new Set(allIds).size !== allIds.length) errors.push('block, question, and option IDs must be globally unique')

    for (const [sourceId, source] of Object.entries(evidenceSources)) {
        if (
            !sourceId ||
            typeof source.title !== 'string' ||
            typeof source.publisher !== 'string' ||
            typeof source.note !== 'string' ||
            !source.note.trim() ||
            typeof source.url !== 'string' ||
            !source.url.startsWith('https://') ||
            source.checkedAt !== '2026-10-17'
        ) {
            errors.push(
                `evidence source ${sourceId || '(missing id)'} must include a reviewed title, publisher, note, date, and direct HTTPS URL`
            )
        }
    }

    const verifiedPositionCounts = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const answerPositionSchedule = dataset?.answerPositionSchedule ?? {}
    const answerPositionSeed = answerPositionSchedule.seed
    const scheduledPositions =
        typeof answerPositionSeed === 'string' && answerPositionSeed.trim() ? createBalancedPositionSequence(answerPositionSeed) : []
    if (answerPositionSchedule.algorithm !== SIXTH_MUSE_POSITION_ALGORITHM) {
        errors.push(`answer-position schedule algorithm must be ${SIXTH_MUSE_POSITION_ALGORITHM}`)
    }
    if (!answerPositionSeed?.trim()) errors.push('answer-position schedule must include its reproducible shuffle seed')
    if (JSON.stringify(answerPositionSchedule.positionsByQuestion) !== JSON.stringify(scheduledPositions)) {
        errors.push('answer-position schedule must match the balanced seeded shuffle')
    }
    const questionNumbers = new Set()
    const register = Array.isArray(dataset?.provenanceReviewRegister) ? dataset.provenanceReviewRegister : []
    const registerById = new Map(register.map((entry) => [entry.questionId, entry]))
    const observedEditorialNumbers = []

    for (const [blockIndex, block] of blocks.entries()) {
        if (!/^sixth-muse-block-[1-3]$/.test(block.id) || block.semanticKey !== block.id) {
            errors.push(`${block.id ?? '(block)'} must use a stable semantic block identity`)
        }
        if (block.order !== blockIndex + 1) errors.push(`${block.id} must preserve the declared block order`)

        for (const [questionIndex, question] of (block.questions ?? []).entries()) {
            const number = question.sourceQuestionNumber
            const expectedId = `sixth-muse-q${String(number).padStart(2, '0')}`
            const label = question.id ?? expectedId
            if (question.id !== expectedId) errors.push(`${label} must use its stable semantic question ID`)
            if (number !== blockIndex * 10 + questionIndex + 1) {
                errors.push(`${label} must preserve its contiguous global source order within the declared block`)
            }
            if (question.orderWithinBlock !== questionIndex + 1) errors.push(`${label} must preserve its one-based order within the block`)
            if (questionNumbers.has(number)) errors.push(`${label} duplicates a source question number`)
            questionNumbers.add(number)

            if (!question.originalPrompt || !question.runtimePrompt || !question.sourceAnswer || !question.verifiedCorrectAnswer) {
                errors.push(`${label} must retain source prompt/key and provide a scored runtime prompt/key`)
            }
            if (question.review?.status !== 'reviewed' || question.review?.disposition !== 'scoring-approved') {
                errors.push(`${label} must be fully reviewed and scoring-approved`)
            }
            if (question.review?.ambiguityStatus !== 'reviewed-single-correct' || !question.review?.singleCorrectRationale?.trim()) {
                errors.push(`${label} must have a documented single-correct ambiguity review`)
            }
            if (question.editorialMapping && !question.editorialMapping.rationale?.trim()) {
                errors.push(`${label} editorial mapping must explain its runtime change`)
            }
            addReferenceErrors(errors, `${label} review`, question.review?.evidenceRefs, evidenceSources)
            if (question.editorialMapping) {
                addReferenceErrors(errors, `${label} editorial mapping`, question.editorialMapping.evidenceRefs, evidenceSources)
            }

            const options = Array.isArray(question.options) ? question.options : []
            if (options.length !== 4) errors.push(`${label} must contain exactly four options`)
            if (new Set(options.map(({ text }) => normalizedOptionText(text))).size !== 4) {
                errors.push(`${label} must contain four unique normalized option texts`)
            }
            if (new Set(options.map(({ id }) => id)).size !== 4) errors.push(`${label} must contain four unique option IDs`)
            if (options.filter(({ kind }) => kind === 'distractor').length !== 3) {
                errors.push(`${label} must have exactly three reviewed distractors`)
            }

            const correctOptions = options.filter(({ isCorrect }) => isCorrect === true)
            if (correctOptions.length !== 1) errors.push(`${label} must have exactly one correct option`)
            const correctOption = correctOptions[0]
            if (
                !correctOption ||
                correctOption.id !== question.verifiedCorrectOptionId ||
                correctOption.text !== question.verifiedCorrectAnswer ||
                correctOption.kind !== 'verified-correct' ||
                correctOption.reviewStatus !== 'verified-correct'
            ) {
                errors.push(`${label} verified key must match its only correct, evidence-reviewed option`)
            }

            const distractors = options.filter(({ isCorrect }) => isCorrect === false)
            for (const option of options) {
                if (!/^sixth-muse-q\d{2}-(?:answer|choice)-[a-z0-9-]+$/.test(option.id ?? '')) {
                    errors.push(`${label} option ${option.id ?? '(missing ID)'} must use a stable semantic option ID`)
                }
                if (typeof option.text !== 'string' || !option.text.trim()) errors.push(`${label} has an empty option`)
                if (typeof option.reviewNote !== 'string' || !option.reviewNote.trim()) {
                    errors.push(`${label} option ${option.id} must retain a factual review note`)
                }
                addReferenceErrors(errors, `${label} option ${option.id}`, option.evidenceRefs, evidenceSources)
                if (option.isCorrect === false && (option.kind !== 'distractor' || option.reviewStatus !== 'reviewed-as-distractor')) {
                    errors.push(`${label} contains a distractor without a reviewed disposition`)
                }
                if (option.isCorrect !== true && option.isCorrect !== false)
                    errors.push(`${label} option ${option.id} must declare isCorrect`)
            }
            if (distractors.length !== 3) errors.push(`${label} must have exactly three incorrect distractor choices`)

            const position = question.verifiedCorrectPosition
            if (
                !Number.isInteger(position) ||
                position < 1 ||
                position > 4 ||
                options[position - 1]?.id !== question.verifiedCorrectOptionId
            ) {
                errors.push(`${label} verified-correct position must match its option order`)
            } else {
                verifiedPositionCounts[position] += 1
            }
            if (scheduledPositions[number - 1] !== position) {
                errors.push(`${label} verified-correct position must follow the seeded balanced shuffle`)
            }
            const expectedOptionOrder = createExpectedOptionOrder(question, position, answerPositionSeed)
            if (expectedOptionOrder.length === 4 && JSON.stringify(options.map(({ id }) => id)) !== JSON.stringify(expectedOptionOrder)) {
                errors.push(`${label} options must follow the seeded randomized option order`)
            }

            const registerEntry = registerById.get(question.id)
            if (!registerEntry) {
                errors.push(`${label} must have a provenance/review register entry`)
            } else {
                for (const field of [
                    'sourceQuestionNumber',
                    'sourceBlockId',
                    'originalPrompt',
                    'sourceAnswer',
                    'runtimePrompt',
                    'verifiedCorrectAnswer',
                    'verifiedCorrectOptionId',
                    'verifiedCorrectPosition',
                    'disposition',
                    'ambiguityStatus',
                    'reviewedAt'
                ]) {
                    const expected =
                        field === 'sourceBlockId'
                            ? block.id
                            : field === 'disposition'
                            ? question.review?.disposition
                            : field === 'ambiguityStatus'
                            ? question.review?.ambiguityStatus
                            : field === 'reviewedAt'
                            ? question.review?.reviewedAt
                            : question[field]
                    if (registerEntry[field] !== expected)
                        errors.push(`${label} provenance register field ${field} must match the question row`)
                }
                if (JSON.stringify(registerEntry.editorialMapping) !== JSON.stringify(question.editorialMapping)) {
                    errors.push(`${label} provenance register editorial mapping must match the question row`)
                }
                if (JSON.stringify(registerEntry.evidenceRefs) !== JSON.stringify(question.review?.evidenceRefs)) {
                    errors.push(`${label} provenance register evidence references must match the review row`)
                }
            }

            if (question.editorialMapping) observedEditorialNumbers.push(number)
        }
    }

    if (
        JSON.stringify([...questionNumbers].sort((a, b) => a - b)) !== JSON.stringify(Array.from({ length: 30 }, (_, index) => index + 1))
    ) {
        errors.push('source question numbering must cover exactly 1 through 30')
    }
    if (JSON.stringify(verifiedPositionCounts) !== JSON.stringify(SIXTH_MUSE_VERIFIED_POSITION_COUNTS)) {
        errors.push('verified-correct positions must distribute as 8/7/7/8')
    }
    if (scheduledPositions.length === 30) {
        let currentRun = 1
        for (let index = 1; index < scheduledPositions.length; index += 1) {
            currentRun = scheduledPositions[index] === scheduledPositions[index - 1] ? currentRun + 1 : 1
            if (currentRun > 2) {
                errors.push('seeded answer positions must not repeat the same position more than twice consecutively')
                break
            }
        }
    }
    if (
        JSON.stringify(dataset?.answerPositionSchedule?.verifiedCorrectPositionCounts) !==
        JSON.stringify(SIXTH_MUSE_VERIFIED_POSITION_COUNTS)
    ) {
        errors.push('answer-position schedule must publish the verified 8/7/7/8 distribution')
    }
    if (register.length !== 30 || registerById.size !== 30)
        errors.push('provenance/review register must cover exactly 30 unique question IDs')
    if (JSON.stringify(observedEditorialNumbers) !== JSON.stringify(SIXTH_MUSE_EDITORIAL_QUESTION_NUMBERS)) {
        errors.push('editorial mapping register must list every reviewed runtime edit')
    }

    const review = dataset?.review ?? {}
    if (review.scoringApprovedRows !== 30) errors.push('review summary must report 30 scoring-approved rows')
    if (review.authorDecisionRequiredRows !== 0) errors.push('review summary must report zero author decisions required')
    if (!Array.isArray(review.unresolvedQuestionIds) || review.unresolvedQuestionIds.length !== 0) {
        errors.push('review summary must have no unresolved question IDs')
    }

    for (const field of [
        'timeLimitSeconds',
        'confirmAnswerBeforeNext',
        'pauseTimerOnBlockIntro',
        'blockRelativeNumbering',
        'passingScorePercent',
        'maxAttempts',
        'classKey'
    ]) {
        const policy = dataset?.quizPolicies ?? {}
        const expected = {
            timeLimitSeconds: 1800,
            confirmAnswerBeforeNext: false,
            pauseTimerOnBlockIntro: false,
            blockRelativeNumbering: false,
            passingScorePercent: 50,
            maxAttempts: 1,
            classKey: null
        }[field]
        if (policy[field] !== expected) errors.push(`quiz policy ${field} must remain ${expected}`)
    }
    const guestAccess = dataset?.quizPolicies?.guestAccess ?? {}
    if (
        guestAccess.anonymousAccess !== true ||
        guestAccess.firstNameRequired !== true ||
        guestAccess.lastNameRequired !== true ||
        guestAccess.termsConsentRequired !== true ||
        guestAccess.privacyConsentRequired !== true ||
        guestAccess.captchaEnabled !== false
    ) {
        errors.push('guest-intake policies must preserve required name and Terms/Privacy consent with CAPTCHA disabled')
    }
    if (guestAccess.maxUses !== 500) errors.push('guest access link maxUses must be 500')
    if (!guestAccess.shortLinkProvisioning?.startsWith('Create after application publication')) {
        errors.push('application-owned short links must be created after publication, not embedded in this source')
    }

    const expectedIntroductions = [
        'Ответьте на вопросы о прозвищах воспитанников Царскосельского лицея.',
        'Ответьте на вопросы о достижениях лицеистов и о том, как сложились их судьбы.',
        'Ответьте на вопросы о важных датах и числах из истории Царскосельского лицея.'
    ]
    if (JSON.stringify(blocks.map(({ introduction }) => introduction)) !== JSON.stringify(expectedIntroductions)) {
        errors.push('each reviewed block must have its canonical introduction text')
    }

    const expectedPairAnswers = new Map([
        [19, 'Модест Корф и Дмитрий Маслов.'],
        [23, 'Сергей Ломоносов и Модест Корф.'],
        [24, 'Константин Данзас и Александр Корнилов.']
    ])
    for (const [number, expectedAnswer] of expectedPairAnswers) {
        const question = questions.find(({ sourceQuestionNumber }) => sourceQuestionNumber === number)
        if (question?.sourceAnswer !== expectedAnswer) errors.push(`Q${number} must preserve the exact original pair answer`)
    }

    const transcription = getDatasetTranscription(dataset)
    const transcriptionDigest = sha256(JSON.stringify(transcription))
    if (dataset?.originalSource?.sha256 !== SIXTH_MUSE_SOURCE_SHA256)
        errors.push('original source SHA-256 does not match the reviewed source')
    if (
        dataset?.originalSource?.transcriptionSha256 !== SIXTH_MUSE_TRANSCRIPTION_SHA256 ||
        transcriptionDigest !== SIXTH_MUSE_TRANSCRIPTION_SHA256
    ) {
        errors.push('source transcription digest does not match the pinned original prompts and answer keys')
    }

    if (typeof originalMarkdown === 'string') {
        if (sha256(originalMarkdown) !== SIXTH_MUSE_SOURCE_SHA256)
            errors.push('local original Markdown SHA-256 differs from the reviewed source')
        const parsedBlocks = parseOriginalSource(originalMarkdown)
        const sourceRows = parsedBlocks.flatMap((block) => block.questions.map((question) => ({ ...question, blockTitle: block.title })))
        if (
            parsedBlocks.length !== blocks.length ||
            JSON.stringify(parsedBlocks.map(({ title }) => title)) !== JSON.stringify(SIXTH_MUSE_BLOCK_TITLES)
        ) {
            errors.push('local source block structure differs from the reviewed dataset')
        }
        if (sourceRows.length !== transcription.length) errors.push('local source question count differs from the reviewed dataset')
        for (const [index, sourceRow] of sourceRows.entries()) {
            const fixtureRow = transcription[index]
            if (
                sourceRow.number !== fixtureRow?.number ||
                sourceRow.blockTitle !== fixtureRow?.blockTitle ||
                sourceRow.prompt !== fixtureRow?.prompt ||
                sourceRow.answer !== fixtureRow?.answer
            ) {
                errors.push(`source question ${sourceRow.number} prompt or answer differs from the author file`)
            }
        }
    }

    return errors
}

export async function loadSixthMuseSource() {
    return JSON.parse(await readFile(SOURCE_PATH, 'utf8'))
}

export async function loadOriginalSourceIfPresent() {
    try {
        return await readFile(ORIGINAL_SOURCE_PATH, 'utf8')
    } catch (error) {
        if (error?.code === 'ENOENT') return undefined
        throw error
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const dataset = await loadSixthMuseSource()
    const markdown = await loadOriginalSourceIfPresent()
    const errors = collectSixthMuseContractErrors(dataset, markdown)
    if (errors.length > 0) {
        for (const error of errors) process.stderr.write(`FAIL ${error}\n`)
        process.exitCode = 1
    } else {
        process.stdout.write(
            `Sixth Muse source contract passed: ${
                dataset.blocks.length
            } blocks, 30 reviewed single-correct questions, and verified answer positions ${JSON.stringify(
                dataset.answerPositionSchedule.verifiedCorrectPositionCounts
            )}.\n`
        )
    }
}
