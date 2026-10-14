import type { GuestQuizAttempt, GuestQuizQuestion, GuestSession } from './guestRuntimeTypes'

export const GUEST_PARTICIPANT_ID_HEADER = 'X-Guest-Participant-Id'
export const GUEST_SESSION_TOKEN_HEADER = 'X-Guest-Session-Token'

export class GuestSessionUnavailableError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'GuestSessionUnavailableError'
    }
}

export const isGuestSessionUnavailableError = (error: unknown): error is GuestSessionUnavailableError =>
    error instanceof GuestSessionUnavailableError

const GUEST_INTAKE_IDEMPOTENCY_STORAGE_KEY_PREFIX = 'apps-template-mui:guest-intake-idempotency'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const normalizeGuestSession = (value: unknown): GuestSession | null => {
    if (!isRecord(value)) {
        return null
    }

    const participantId =
        typeof value.participantId === 'string' ? value.participantId : typeof value.studentId === 'string' ? value.studentId : ''
    const sessionToken = typeof value.sessionToken === 'string' ? value.sessionToken : ''
    if (!participantId || !sessionToken) {
        return null
    }

    return {
        participantId,
        studentId: typeof value.studentId === 'string' ? value.studentId : participantId,
        sessionToken
    }
}

const normalizePositiveInteger = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const normalizeNonNegativeInteger = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

export const normalizeAttemptLimit = (value: unknown): number | null => {
    if (value === null || value === undefined) {
        return null
    }

    const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export const normalizeGuestQuizAttempt = (value: unknown, fallbackAttemptId = '', resumed = false): GuestQuizAttempt | null => {
    if (!isRecord(value)) {
        return null
    }

    const attemptId = typeof value.attemptId === 'string' ? value.attemptId : fallbackAttemptId
    if (!attemptId) {
        return null
    }

    if (value.status === 'completed' || value.status === 'timed_out' || value.status === 'revoked') {
        const rawResult = isRecord(value.result) ? value.result : value
        const resultDetails = isRecord(rawResult.result) ? rawResult.result : rawResult
        const rawScore =
            typeof resultDetails.score === 'number'
                ? resultDetails.score
                : typeof resultDetails.correctCount === 'number'
                ? resultDetails.correctCount
                : typeof rawResult.score === 'number'
                ? rawResult.score
                : typeof rawResult.correctCount === 'number'
                ? rawResult.correctCount
                : Number.NaN
        const rawTotal =
            typeof resultDetails.total === 'number'
                ? resultDetails.total
                : typeof resultDetails.totalQuestions === 'number'
                ? resultDetails.totalQuestions
                : typeof rawResult.total === 'number'
                ? rawResult.total
                : typeof rawResult.totalQuestions === 'number'
                ? rawResult.totalQuestions
                : Number.NaN
        const rawPassed =
            resultDetails.passed === null || typeof resultDetails.passed === 'boolean' ? resultDetails.passed : rawResult.passed
        const finishedReason =
            typeof resultDetails.finishedReason === 'string'
                ? resultDetails.finishedReason
                : typeof rawResult.finishedReason === 'string'
                ? rawResult.finishedReason
                : typeof value.finishedReason === 'string'
                ? value.finishedReason
                : value.status === 'timed_out'
                ? 'timed_out'
                : value.status === 'revoked'
                ? 'revoked'
                : 'submitted'
        const correctCount = rawScore
        const totalQuestions = rawTotal
        const hasValidScore =
            Number.isInteger(correctCount) &&
            Number.isInteger(totalQuestions) &&
            correctCount >= 0 &&
            totalQuestions >= 1 &&
            correctCount <= totalQuestions
        const isRevoked = finishedReason === 'revoked' || value.status === 'revoked'
        if (!hasValidScore && !isRevoked) {
            return null
        }
        const normalizedTotal = normalizePositiveInteger(value.totalQuestions) ?? (hasValidScore ? totalQuestions : 0)
        const answeredCount = normalizeNonNegativeInteger(value.answeredCount) ?? 0

        return {
            attemptId,
            attemptNumber: normalizePositiveInteger(value.attemptNumber),
            status: 'completed',
            currentQuestionIndex: normalizedTotal,
            totalQuestions: normalizedTotal,
            answeredCount: Math.min(answeredCount, normalizedTotal),
            deadlineAt: null,
            serverNow: null,
            questions: [],
            result: {
                correctCount: hasValidScore ? correctCount : null,
                totalQuestions: hasValidScore ? totalQuestions : null,
                passed: typeof rawPassed === 'boolean' ? rawPassed : null,
                finishedReason,
                completionText: typeof value.completionText === 'string' ? value.completionText : ''
            },
            resumed
        }
    }

    const currentQuestionIndex = normalizeNonNegativeInteger(value.currentQuestionIndex)
    const totalQuestions = normalizePositiveInteger(value.totalQuestions)
    const answeredCount = normalizeNonNegativeInteger(value.answeredCount)
    if (
        (value.deadlineAt !== null && typeof value.deadlineAt !== 'string') ||
        typeof value.serverNow !== 'string' ||
        !Array.isArray(value.questions) ||
        currentQuestionIndex === null ||
        totalQuestions === null ||
        answeredCount === null ||
        currentQuestionIndex > totalQuestions ||
        answeredCount !== currentQuestionIndex
    ) {
        return null
    }
    if (
        (typeof value.deadlineAt === 'string' && !Number.isFinite(Date.parse(value.deadlineAt))) ||
        !Number.isFinite(Date.parse(value.serverNow)) ||
        (currentQuestionIndex < totalQuestions && value.questions.length !== 1) ||
        (currentQuestionIndex === totalQuestions && value.questions.length !== 0)
    ) {
        return null
    }

    const questions: GuestQuizQuestion[] = []
    for (const rawQuestion of value.questions) {
        if (
            !isRecord(rawQuestion) ||
            typeof rawQuestion.id !== 'string' ||
            typeof rawQuestion.prompt !== 'string' ||
            !Array.isArray(rawQuestion.options)
        ) {
            return null
        }

        const options: GuestQuizQuestion['options'] = []
        for (const rawOption of rawQuestion.options) {
            if (!isRecord(rawOption) || typeof rawOption.id !== 'string' || typeof rawOption.label !== 'string') {
                return null
            }
            options.push({ id: rawOption.id, label: rawOption.label })
        }

        questions.push({ id: rawQuestion.id, prompt: rawQuestion.prompt, options })
    }

    return {
        attemptId,
        attemptNumber: normalizePositiveInteger(value.attemptNumber),
        status: 'in_progress',
        currentQuestionIndex,
        totalQuestions,
        answeredCount,
        deadlineAt: typeof value.deadlineAt === 'string' ? value.deadlineAt : null,
        serverNow: value.serverNow,
        questions,
        result: null,
        resumed
    }
}

export const getInitialRemainingSeconds = (attempt: GuestQuizAttempt) => {
    if (!attempt.deadlineAt || !attempt.serverNow) {
        return null
    }

    const deadline = Date.parse(attempt.deadlineAt)
    const serverNow = Date.parse(attempt.serverNow)
    if (!Number.isFinite(deadline) || !Number.isFinite(serverNow)) {
        return 0
    }

    return Math.max(0, Math.ceil((deadline - serverNow) / 1000))
}

export const getGuestAttemptStorageKey = (applicationId: string, slug: string, participantId: string, assessmentId: string) =>
    `apps-template-mui:guest-attempt:${applicationId}:${slug}:${participantId}:${assessmentId}`

export const readGuestSessionStorage = (key: string) => {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key)
    } catch {
        return null
    }
}

export const writeGuestSessionStorage = (key: string, value: string) => {
    try {
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(key, value)
        }
    } catch {
        // Guest progress remains available for the current page session if storage is unavailable.
    }
}

export const removeGuestSessionStorage = (key: string) => {
    try {
        if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(key)
        }
    } catch {
        // Ignore unavailable storage and keep the current page session usable.
    }
}

export const guestIntakeIdempotencyStorageKey = (applicationId: string, accessLinkId: string, workspaceId?: string | null) =>
    `${GUEST_INTAKE_IDEMPOTENCY_STORAGE_KEY_PREFIX}:${applicationId}:${workspaceId ? `${workspaceId}:` : ''}${accessLinkId}`

const isGuestIdempotencyKey = (value: string | null): value is string => Boolean(value && /^[A-Za-z0-9_-]{43}$/u.test(value))

const createGuestIdempotencyKey = (): string => {
    if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
        throw new Error('Secure random generation is unavailable')
    }

    const bytes = window.crypto.getRandomValues(new Uint8Array(32))
    let binary = ''
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte)
    })
    return window.btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

export const getGuestIdempotencyKey = (storageKey: string): string => {
    if (typeof window === 'undefined') throw new Error('Guest intake is unavailable')

    try {
        const stored = window.sessionStorage.getItem(storageKey)
        if (isGuestIdempotencyKey(stored)) return stored
        if (stored) window.sessionStorage.removeItem(storageKey)

        const key = createGuestIdempotencyKey()
        window.sessionStorage.setItem(storageKey, key)
        return key
    } catch {
        throw new Error('Guest intake storage is unavailable')
    }
}

export const removeGuestIdempotencyKey = (storageKey: string) => {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.removeItem(storageKey)
    } catch {
        // Ignore unavailable storage after the request reaches a final outcome.
    }
}
