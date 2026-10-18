type JsonRecord = Record<string, unknown>

const PUBLIC_ATTEMPT_KEYS = [
    'attemptId',
    'attemptNumber',
    'status',
    'startedAt',
    'deadlineAt',
    'serverNow',
    'locale',
    'currentQuestionIndex',
    'totalQuestions',
    'answeredCount',
    'phase',
    'phaseRevision',
    'timerState',
    'remainingMs',
    'numberingMode',
    'currentBlock',
    'questions',
    'result',
    'completionText'
] as const
const PUBLIC_QUESTION_KEYS = ['id', 'prompt', 'description', 'sortOrder', 'displayNumber', 'options'] as const
const PUBLIC_OPTION_KEYS = ['id', 'label'] as const
const PUBLIC_RESULT_KEYS = ['score', 'total', 'passed', 'finishedReason'] as const

function asRecord(value: unknown): JsonRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null
}

function assertExactPublicKeys(value: unknown, allowedKeys: readonly string[], path: string): JsonRecord {
    const record = asRecord(value)
    if (!record) throw new Error(`${path} must be an object in the public assessment DTO`)

    const actualKeys = Object.keys(record).sort()
    const expectedKeys = [...allowedKeys].sort()
    if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
        const unexpectedKeys = actualKeys.filter((key) => !allowedKeys.includes(key))
        const missingKeys = expectedKeys.filter((key) => !actualKeys.includes(key))
        throw new Error(
            `${path} has unexpected keys [${unexpectedKeys.join(', ')}] or missing required keys [${missingKeys.join(
                ', '
            )}] outside the public assessment DTO allowlist`
        )
    }
    return record
}

/** Fail closed if any nested public guest response contains private answer material. */
export function assertNoPrivateAnswerMaterial(value: unknown, path = 'response'): void {
    const privateKeys = new Set(['answer', 'answerkey', 'correctanswer', 'correctoptionid', 'iscorrect', 'explanation'])
    if (Array.isArray(value)) {
        value.forEach((entry, index) => assertNoPrivateAnswerMaterial(entry, `${path}[${index}]`))
        return
    }

    const record = asRecord(value)
    if (!record) return
    for (const [key, nestedValue] of Object.entries(record)) {
        const normalizedKey = key.replace(/[_-]/gu, '').toLowerCase()
        if (privateKeys.has(normalizedKey)) throw new Error(`${path}.${key} must not expose private answer data`)
        assertNoPrivateAnswerMaterial(nestedValue, `${path}.${key}`)
    }
}

/** Fail closed if a guest response adds fields outside the public assessment DTO. */
export function assertPublicAssessmentAttemptState(value: unknown, label: string): void {
    const attempt = assertExactPublicKeys(value, PUBLIC_ATTEMPT_KEYS, label)
    if (typeof attempt.serverNow !== 'string' || !Number.isFinite(Date.parse(attempt.serverNow))) {
        throw new Error(`${label}.serverNow must be a valid server timestamp`)
    }
    if (typeof attempt.locale !== 'string' || !/^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/u.test(attempt.locale)) {
        throw new Error(`${label}.locale must be a supported locale tag`)
    }
    if (!Array.isArray(attempt.questions)) throw new Error(`${label}.questions must be an array`)
    if (attempt.phase !== 'block_intro' && attempt.phase !== 'question') throw new Error(`${label}.phase must be a supported phase`)
    if (!Number.isSafeInteger(attempt.phaseRevision) || Number(attempt.phaseRevision) < 0) {
        throw new Error(`${label}.phaseRevision must be a non-negative safe integer`)
    }
    if (attempt.timerState !== 'untimed' && attempt.timerState !== 'running' && attempt.timerState !== 'paused') {
        throw new Error(`${label}.timerState must be a supported timer state`)
    }
    if (attempt.numberingMode !== 'global' && attempt.numberingMode !== 'block') {
        throw new Error(`${label}.numberingMode must be a supported numbering mode`)
    }
    if (
        attempt.remainingMs !== null &&
        (typeof attempt.remainingMs !== 'number' || !Number.isFinite(attempt.remainingMs) || attempt.remainingMs < 0)
    ) {
        throw new Error(`${label}.remainingMs must be non-negative milliseconds or null`)
    }
    if (attempt.timerState === 'untimed' ? attempt.remainingMs !== null : typeof attempt.remainingMs !== 'number') {
        throw new Error(`${label}.remainingMs must agree with its timer state`)
    }
    if (attempt.currentBlock !== null) {
        const block = assertExactPublicKeys(attempt.currentBlock, ['title', 'introduction'], `${label}.currentBlock`)
        if (typeof block.title !== 'string' || typeof block.introduction !== 'string') {
            throw new Error(`${label}.currentBlock must contain localized display text`)
        }
    }

    const counters = ['currentQuestionIndex', 'totalQuestions', 'answeredCount'] as const
    for (const counter of counters) {
        if (!Number.isSafeInteger(attempt[counter]) || Number(attempt[counter]) < 0) {
            throw new Error(`${label}.${counter} must be a non-negative safe integer`)
        }
    }
    const currentQuestionIndex = Number(attempt.currentQuestionIndex)
    const totalQuestions = Number(attempt.totalQuestions)
    const answeredCount = Number(attempt.answeredCount)
    if (currentQuestionIndex > totalQuestions || answeredCount > totalQuestions) {
        throw new Error(`${label} question counters must not exceed totalQuestions`)
    }
    if (attempt.status === 'in_progress' && answeredCount !== currentQuestionIndex) {
        throw new Error(`${label}.answeredCount must equal currentQuestionIndex while the attempt is in progress`)
    }
    const expectedQuestionCount =
        attempt.status === 'in_progress' && attempt.phase === 'question' && currentQuestionIndex < totalQuestions ? 1 : 0
    if (attempt.questions.length !== expectedQuestionCount) {
        throw new Error(`${label}.questions must contain only the current unanswered question for its phase`)
    }
    if (attempt.status === 'in_progress' && attempt.phase === 'block_intro' && attempt.currentBlock === null) {
        throw new Error(`${label}.currentBlock must be present during a block introduction`)
    }
    if (attempt.phase === 'question' && attempt.currentBlock !== null) {
        throw new Error(`${label}.currentBlock must be null while a question is active`)
    }

    attempt.questions.forEach((question, questionIndex) => {
        const questionPath = `${label}.questions[${questionIndex}]`
        const publicQuestion = assertExactPublicKeys(question, PUBLIC_QUESTION_KEYS, questionPath)
        if (typeof publicQuestion.sortOrder !== 'number' || !Number.isFinite(publicQuestion.sortOrder)) {
            throw new Error(`${questionPath}.sortOrder must be a finite source-order value`)
        }
        if (!Array.isArray(publicQuestion.options)) throw new Error(`${questionPath}.options must be an array`)
        publicQuestion.options.forEach((option, optionIndex) => {
            assertExactPublicKeys(option, PUBLIC_OPTION_KEYS, `${questionPath}.options[${optionIndex}]`)
        })
    })

    if (attempt.result !== null) assertExactPublicKeys(attempt.result, PUBLIC_RESULT_KEYS, `${label}.result`)
    assertNoPrivateAnswerMaterial(value, label)
}

/** Validate the answer-save envelope as well as its nested public attempt state. */
export function assertPublicGuestAnswerResponse(value: unknown, label: string): void {
    const response = assertExactPublicKeys(value, ['ok', 'attempt'], label)
    if (response.ok !== true) throw new Error(`${label}.ok must be true`)
    assertPublicAssessmentAttemptState(response.attempt, `${label}.attempt`)
}
