import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import {
    GUEST_PARTICIPANT_ID_HEADER,
    GUEST_SESSION_TOKEN_HEADER,
    GuestSessionUnavailableError,
    getGuestAttemptStorageKey,
    getInitialRemainingSeconds,
    isRecord,
    normalizeGuestQuizAttempt,
    readGuestSessionStorage,
    removeGuestSessionStorage,
    writeGuestSessionStorage
} from './guestRuntimeUtils'
import type { GuestFetchWithPublicCsrf, GuestQuizAttempt, GuestQuizQuestion, GuestSession, GuestTranslate } from './guestRuntimeTypes'

type GuestAttemptActionInput =
    | { kind: 'answer'; attemptId: string; questionId: string; optionId: string }
    | { kind: 'continue'; attemptId: string; phaseRevision: number }

const isUnavailableGuestSessionStatus = (status: number): boolean => status === 403 || status === 404

const createUnavailableGuestSessionError = (translate: GuestTranslate): GuestSessionUnavailableError =>
    new GuestSessionUnavailableError(
        translate('guest.errors.sessionUnavailable', 'Your access to this quiz has ended. No further answers can be saved.')
    )

export type GuestQuizAttemptController = {
    quizAttempt: GuestQuizAttempt | null
    selectedOptionId: string
    timeRemaining: number | null
    isRefreshingAttempt: boolean
    currentQuestionIndex: number
    currentQuestion: GuestQuizQuestion | null
    initializeQuizAttemptMutation: UseMutationResult<GuestQuizAttempt, Error, string>
    saveAnswerMutation: UseMutationResult<GuestQuizAttempt, Error, GuestAttemptActionInput>
    finalizeQuizMutation: UseMutationResult<GuestQuizAttempt, Error, string>
    handleRetryQuiz: () => void
    handleBackToContent: () => void
    handleSelectOption: (optionId?: string) => Promise<void>
    handleRetryAnswer: (optionId?: string) => Promise<void>
}

type UseGuestQuizAttemptOptions = {
    applicationId: string
    slug: string
    apiBaseUrl: string
    locale: string
    session: GuestSession | null
    activeQuizId: string | null
    runtimeId: string | null
    fetchWithPublicCsrf: GuestFetchWithPublicCsrf
    translate: GuestTranslate
    onBackToContent: () => void
}

export function useGuestQuizAttempt({
    applicationId,
    slug,
    apiBaseUrl,
    locale,
    session,
    activeQuizId,
    runtimeId,
    fetchWithPublicCsrf,
    translate,
    onBackToContent
}: UseGuestQuizAttemptOptions): GuestQuizAttemptController {
    const [quizAttempt, setQuizAttempt] = useState<GuestQuizAttempt | null>(null)
    const [selectedOptionId, setSelectedOptionId] = useState('')
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
    const [isRefreshingAttempt, setIsRefreshingAttempt] = useState(false)
    const attemptActionInProgressRef = useRef(false)
    const attemptRefreshInProgressRef = useRef(false)
    const currentAttemptRef = useRef<GuestQuizAttempt | null>(null)
    const initializedAttemptScopeRef = useRef('')
    const finalizedDeadlineAttemptRef = useRef('')
    const failedFinalizationAttemptRef = useRef('')
    const attemptScope =
        runtimeId && session?.participantId && session.sessionToken ? `${applicationId}:${slug}:${session.participantId}:${runtimeId}` : ''
    const mutationScopeId = `guest-quiz-attempt:${quizAttempt?.attemptId ?? `${applicationId}:${runtimeId ?? ''}`}`
    const attemptScopeRef = useRef(attemptScope)

    useLayoutEffect(() => {
        attemptScopeRef.current = attemptScope
    }, [attemptScope])

    useEffect(() => {
        currentAttemptRef.current = quizAttempt
    }, [quizAttempt])

    const finalizeQuizMutation = useMutation<GuestQuizAttempt, Error, string>({
        scope: { id: mutationScopeId },
        mutationFn: async (attemptId) => {
            if (!session) {
                throw new Error(translate('guest.errors.sessionMissing', 'Guest session is required before continuing the quiz.'))
            }

            const headers = new Headers({ 'Content-Type': 'application/json' })
            headers.set(GUEST_PARTICIPANT_ID_HEADER, session.participantId)
            headers.set(GUEST_SESSION_TOKEN_HEADER, session.sessionToken)
            const response = await fetchWithPublicCsrf(
                `${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/${encodeURIComponent(attemptId)}/finalize?${new URLSearchParams({
                    locale
                }).toString()}`,
                {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        participantId: session.participantId,
                        sessionToken: session.sessionToken
                    })
                }
            )
            if (!response.ok && isUnavailableGuestSessionStatus(response.status)) {
                throw createUnavailableGuestSessionError(translate)
            }
            if (!response.ok) {
                throw new Error(translate('guest.errors.quizFinalize', 'Failed to finish the quiz.'))
            }
            const payload = normalizeGuestQuizAttempt(await response.json(), attemptId)
            if (!payload || payload.status !== 'completed' || !payload.result) {
                throw new Error(translate('guest.errors.quizFinalize', 'Failed to finish the quiz.'))
            }
            return payload
        },
        onSuccess: (completedAttempt, attemptId) => {
            setQuizAttempt((current) => (current?.attemptId === attemptId ? completedAttempt : current))
            setTimeRemaining(0)
        },
        onError: (_error, attemptId) => {
            if (finalizedDeadlineAttemptRef.current === attemptId) {
                finalizedDeadlineAttemptRef.current = ''
            }
            failedFinalizationAttemptRef.current = attemptId
        }
    })

    const initializeQuizAttemptMutation = useMutation<GuestQuizAttempt, Error, string>({
        mutationFn: async (assessmentId) => {
            if (!session) {
                throw new Error(translate('guest.errors.sessionMissing', 'Guest session is required before continuing the quiz.'))
            }

            const attemptStorageKey = getGuestAttemptStorageKey(applicationId, slug, session.participantId, assessmentId)
            const storedAttemptId = readGuestSessionStorage(attemptStorageKey)
            const headers = new Headers()
            headers.set(GUEST_PARTICIPANT_ID_HEADER, session.participantId)
            headers.set(GUEST_SESSION_TOKEN_HEADER, session.sessionToken)
            const localeQuery = new URLSearchParams({ locale }).toString()

            if (storedAttemptId) {
                const response = await fetch(
                    `${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/${encodeURIComponent(storedAttemptId)}?${localeQuery}`,
                    { headers }
                )
                if (!response.ok) {
                    throw new Error(translate('guest.errors.quizAttemptLoad', 'Failed to resume the quiz.'))
                }
                const attempt = normalizeGuestQuizAttempt(await response.json(), storedAttemptId, true)
                if (!attempt) {
                    throw new Error(translate('guest.errors.quizAttemptLoad', 'Failed to resume the quiz.'))
                }
                return attempt
            }

            const response = await fetchWithPublicCsrf(`${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/start?${localeQuery}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    [GUEST_PARTICIPANT_ID_HEADER]: session.participantId,
                    [GUEST_SESSION_TOKEN_HEADER]: session.sessionToken
                },
                body: JSON.stringify({
                    participantId: session.participantId,
                    sessionToken: session.sessionToken,
                    assessmentId
                })
            })
            if (!response.ok) {
                if (response.status === 409) {
                    throw new Error(
                        translate(
                            'guest.errors.quizAttemptUnavailable',
                            'This quiz is no longer available or its attempt limit has been reached.'
                        )
                    )
                }
                throw new Error(translate('guest.errors.quizAttemptStart', 'Failed to start the quiz.'))
            }
            const attempt = normalizeGuestQuizAttempt(await response.json())
            if (!attempt) {
                throw new Error(translate('guest.errors.quizAttemptStart', 'Failed to start the quiz.'))
            }
            writeGuestSessionStorage(attemptStorageKey, attempt.attemptId)
            return attempt
        },
        onSuccess: (attempt) => {
            setQuizAttempt(attempt)
            setSelectedOptionId('')
            setTimeRemaining(getInitialRemainingSeconds(attempt))
            if (attempt.status === 'in_progress' && attempt.currentQuestionIndex >= attempt.totalQuestions) {
                finalizedDeadlineAttemptRef.current = attempt.attemptId
                finalizeQuizMutation.mutate(attempt.attemptId)
            }
        }
    })

    const saveAnswerMutation = useMutation<GuestQuizAttempt, Error, GuestAttemptActionInput>({
        scope: { id: mutationScopeId },
        mutationFn: async (input) => {
            if (!session) {
                throw new Error(translate('guest.errors.sessionMissing', 'Guest session is required before continuing the quiz.'))
            }

            if (input.kind === 'continue') {
                const response = await fetchWithPublicCsrf(
                    `${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/${encodeURIComponent(
                        input.attemptId
                    )}/continue?${new URLSearchParams({ locale }).toString()}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            [GUEST_PARTICIPANT_ID_HEADER]: session.participantId,
                            [GUEST_SESSION_TOKEN_HEADER]: session.sessionToken
                        },
                        body: JSON.stringify({
                            participantId: session.participantId,
                            sessionToken: session.sessionToken,
                            phaseRevision: input.phaseRevision
                        })
                    }
                )
                if (!response.ok && isUnavailableGuestSessionStatus(response.status)) {
                    throw createUnavailableGuestSessionError(translate)
                }
                const responseBody: unknown = await response.json().catch(() => null)
                const attempt = normalizeGuestQuizAttempt(responseBody, input.attemptId)
                if (!attempt || (!response.ok && attempt.status !== 'completed')) {
                    const nestedAttempt = normalizeGuestQuizAttempt(isRecord(responseBody) ? responseBody.attempt : null, input.attemptId)
                    const isNewerConflictState =
                        response.status === 409 &&
                        nestedAttempt &&
                        (nestedAttempt.status === 'completed' || nestedAttempt.phaseRevision > input.phaseRevision)
                    if (!isNewerConflictState) {
                        throw new Error(translate('guest.errors.quizContinue', 'Failed to continue to the next quiz question.'))
                    }
                    return nestedAttempt
                }
                return attempt
            }

            const response = await fetchWithPublicCsrf(
                `${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/${encodeURIComponent(
                    input.attemptId
                )}/answers?${new URLSearchParams({ locale }).toString()}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        [GUEST_PARTICIPANT_ID_HEADER]: session.participantId,
                        [GUEST_SESSION_TOKEN_HEADER]: session.sessionToken
                    },
                    body: JSON.stringify({
                        participantId: session.participantId,
                        sessionToken: session.sessionToken,
                        questionId: input.questionId,
                        optionId: input.optionId
                    })
                }
            )
            if (!response.ok && isUnavailableGuestSessionStatus(response.status)) {
                throw createUnavailableGuestSessionError(translate)
            }
            const responseBody: unknown = await response.json().catch(() => null)
            const attempt = normalizeGuestQuizAttempt(isRecord(responseBody) ? responseBody.attempt : null, input.attemptId)
            if (!attempt || (!response.ok && attempt.status !== 'completed')) {
                throw new Error(translate('guest.errors.quizAnswerSave', 'Failed to save your answer.'))
            }
            return attempt
        }
    })

    const quizRuntimeId = runtimeId
    const currentQuestionIndex =
        quizAttempt?.status === 'in_progress' &&
        quizAttempt.phase === 'question' &&
        quizAttempt.currentQuestionIndex < quizAttempt.totalQuestions
            ? quizAttempt.currentQuestionIndex
            : -1
    const currentQuestion = currentQuestionIndex >= 0 ? quizAttempt?.questions[0] ?? null : null
    const quizAttemptId = quizAttempt?.attemptId
    const quizAttemptStatus = quizAttempt?.status
    const quizAttemptTimerState = quizAttempt?.timerState
    const remainingMillisecondsAtServerSync = quizAttempt?.remainingMs ?? null
    const initializeAttempt = initializeQuizAttemptMutation.mutate
    const resetAttemptInitialization = initializeQuizAttemptMutation.reset
    const resetAnswerMutation = saveAnswerMutation.reset
    const resetFinalization = finalizeQuizMutation.reset
    const finalizeAttempt = finalizeQuizMutation.mutate
    const isSavingAnswer = saveAnswerMutation.isPending
    const isFinalizing = finalizeQuizMutation.isPending

    const refreshAttemptFromServer = useCallback(
        async (attemptId: string) => {
            const requestScope = attemptScope
            if (!session || !requestScope || attemptRefreshInProgressRef.current || attemptActionInProgressRef.current) return
            attemptRefreshInProgressRef.current = true
            setIsRefreshingAttempt(true)
            try {
                const response = await fetch(
                    `${apiBaseUrl}/public/a/${applicationId}/runtime/attempts/${encodeURIComponent(attemptId)}?${new URLSearchParams({
                        locale
                    })}`,
                    {
                        headers: {
                            [GUEST_PARTICIPANT_ID_HEADER]: session.participantId,
                            [GUEST_SESSION_TOKEN_HEADER]: session.sessionToken
                        }
                    }
                )
                if (!response.ok) return
                const serverAttempt = normalizeGuestQuizAttempt(await response.json(), attemptId)
                if (!serverAttempt || attemptScopeRef.current !== requestScope || currentAttemptRef.current?.attemptId !== attemptId) {
                    return
                }
                failedFinalizationAttemptRef.current = ''
                if (currentAttemptRef.current.questions[0]?.id !== serverAttempt.questions[0]?.id) setSelectedOptionId('')
                setQuizAttempt(serverAttempt)
                const remainingSeconds = serverAttempt.status === 'in_progress' ? getInitialRemainingSeconds(serverAttempt) : 0
                setTimeRemaining(remainingSeconds)
                if (
                    serverAttempt.status === 'in_progress' &&
                    (serverAttempt.currentQuestionIndex >= serverAttempt.totalQuestions ||
                        (serverAttempt.timerState === 'running' && remainingSeconds === 0)) &&
                    finalizedDeadlineAttemptRef.current !== attemptId
                ) {
                    finalizedDeadlineAttemptRef.current = attemptId
                    finalizeAttempt(attemptId)
                }
            } catch {
                // The server remains authoritative and rejects answers after the deadline.
            } finally {
                attemptRefreshInProgressRef.current = false
                setIsRefreshingAttempt(false)
            }
        },
        [apiBaseUrl, applicationId, attemptScope, finalizeAttempt, locale, session]
    )

    useEffect(() => {
        if (!attemptScope || !quizRuntimeId) {
            initializedAttemptScopeRef.current = ''
            currentAttemptRef.current = null
            setQuizAttempt(null)
            setSelectedOptionId('')
            setTimeRemaining(null)
            return
        }
        if (initializedAttemptScopeRef.current === attemptScope) {
            return
        }

        initializedAttemptScopeRef.current = attemptScope
        currentAttemptRef.current = null
        attemptActionInProgressRef.current = false
        finalizedDeadlineAttemptRef.current = ''
        failedFinalizationAttemptRef.current = ''
        setQuizAttempt(null)
        setSelectedOptionId('')
        setTimeRemaining(null)
        resetAttemptInitialization()
        resetAnswerMutation()
        resetFinalization()
        initializeAttempt(quizRuntimeId)
    }, [attemptScope, quizRuntimeId, initializeAttempt, resetAttemptInitialization, resetAnswerMutation, resetFinalization])

    useEffect(() => {
        if (quizAttemptStatus !== 'in_progress' || !quizAttemptId || !session) return

        const refreshIfVisible = () => {
            if (document.visibilityState === 'visible') void refreshAttemptFromServer(quizAttemptId)
        }
        document.addEventListener('visibilitychange', refreshIfVisible)
        window.addEventListener('online', refreshIfVisible)
        window.addEventListener('pageshow', refreshIfVisible)
        return () => {
            document.removeEventListener('visibilitychange', refreshIfVisible)
            window.removeEventListener('online', refreshIfVisible)
            window.removeEventListener('pageshow', refreshIfVisible)
        }
    }, [quizAttemptStatus, quizAttemptId, session, refreshAttemptFromServer])

    useEffect(() => {
        if (quizAttemptStatus !== 'in_progress' || remainingMillisecondsAtServerSync === null) {
            setTimeRemaining(null)
            return
        }

        const initialMilliseconds = remainingMillisecondsAtServerSync
        setTimeRemaining(Math.max(0, Math.ceil(initialMilliseconds / 1000)))
        if (quizAttemptTimerState !== 'running') return

        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const getElapsedMilliseconds = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
        const timer = window.setInterval(() => {
            const remaining = Math.max(0, Math.ceil((initialMilliseconds - getElapsedMilliseconds()) / 1000))
            setTimeRemaining(remaining)
            if (remaining === 0) {
                window.clearInterval(timer)
            }
        }, 1000)

        return () => window.clearInterval(timer)
    }, [quizAttemptId, quizAttemptStatus, quizAttemptTimerState, remainingMillisecondsAtServerSync])

    useEffect(() => {
        if (
            timeRemaining !== 0 ||
            !quizAttemptId ||
            quizAttemptStatus !== 'in_progress' ||
            quizAttemptTimerState !== 'running' ||
            isSavingAnswer ||
            attemptActionInProgressRef.current ||
            isFinalizing ||
            failedFinalizationAttemptRef.current === quizAttemptId ||
            finalizedDeadlineAttemptRef.current === quizAttemptId
        ) {
            return
        }

        finalizedDeadlineAttemptRef.current = quizAttemptId
        finalizeAttempt(quizAttemptId)
    }, [timeRemaining, quizAttemptId, quizAttemptStatus, quizAttemptTimerState, isSavingAnswer, isFinalizing, finalizeAttempt])

    const saveSelectedAnswer = useCallback(
        async (optionId: string) => {
            if (
                !quizAttempt ||
                quizAttempt.status !== 'in_progress' ||
                !currentQuestion ||
                !optionId ||
                timeRemaining === 0 ||
                attemptRefreshInProgressRef.current ||
                attemptActionInProgressRef.current
            )
                return

            attemptActionInProgressRef.current = true
            setSelectedOptionId(optionId)
            saveAnswerMutation.reset()
            let serverAttempt: GuestQuizAttempt
            try {
                serverAttempt = await saveAnswerMutation.mutateAsync({
                    kind: 'answer',
                    attemptId: quizAttempt.attemptId,
                    questionId: currentQuestion.id,
                    optionId
                })
            } catch {
                attemptActionInProgressRef.current = false
                return
            }

            setQuizAttempt(serverAttempt)
            setSelectedOptionId('')
            if (serverAttempt.status === 'completed') {
                setTimeRemaining(0)
                attemptActionInProgressRef.current = false
                return
            }

            if (serverAttempt.currentQuestionIndex >= serverAttempt.totalQuestions) {
                attemptActionInProgressRef.current = false
                finalizedDeadlineAttemptRef.current = quizAttempt.attemptId
                finalizeQuizMutation.mutate(quizAttempt.attemptId)
                return
            }
            attemptActionInProgressRef.current = false
        },
        [quizAttempt, currentQuestion, timeRemaining, saveAnswerMutation, finalizeQuizMutation]
    )

    const continueBlockIntro = useCallback(async () => {
        if (
            !quizAttempt ||
            quizAttempt.status !== 'in_progress' ||
            quizAttempt.phase !== 'block_intro' ||
            timeRemaining === 0 ||
            isRefreshingAttempt ||
            attemptRefreshInProgressRef.current ||
            attemptActionInProgressRef.current ||
            finalizeQuizMutation.isPending
        ) {
            return
        }

        attemptActionInProgressRef.current = true
        setSelectedOptionId('')
        saveAnswerMutation.reset()
        try {
            const serverAttempt = await saveAnswerMutation.mutateAsync({
                kind: 'continue',
                attemptId: quizAttempt.attemptId,
                phaseRevision: quizAttempt.phaseRevision
            })
            if (attemptScopeRef.current !== attemptScope || currentAttemptRef.current?.attemptId !== quizAttempt.attemptId) return
            setQuizAttempt(serverAttempt)
            setTimeRemaining(serverAttempt.status === 'in_progress' ? getInitialRemainingSeconds(serverAttempt) : 0)
        } catch {
            // Keep the current phase visible so the learner can retry.
        } finally {
            attemptActionInProgressRef.current = false
        }
    }, [attemptScope, finalizeQuizMutation.isPending, isRefreshingAttempt, quizAttempt, saveAnswerMutation, timeRemaining])

    const handleSelectOption = useCallback(
        async (optionId?: string) => {
            if (quizAttempt?.phase === 'block_intro') {
                await continueBlockIntro()
                return
            }
            if (optionId) await saveSelectedAnswer(optionId)
        },
        [continueBlockIntro, quizAttempt?.phase, saveSelectedAnswer]
    )
    const handleRetryAnswer = useCallback(
        async (optionId = selectedOptionId) => {
            if (optionId) await saveSelectedAnswer(optionId)
        },
        [selectedOptionId, saveSelectedAnswer]
    )

    const handleRetryQuiz = () => {
        const retryQuizId = activeQuizId ?? runtimeId
        if (!retryQuizId || !session) {
            return
        }

        removeGuestSessionStorage(getGuestAttemptStorageKey(applicationId, slug, session.participantId, retryQuizId))
        attemptActionInProgressRef.current = false
        finalizedDeadlineAttemptRef.current = ''
        failedFinalizationAttemptRef.current = ''
        currentAttemptRef.current = null
        initializeQuizAttemptMutation.reset()
        saveAnswerMutation.reset()
        finalizeQuizMutation.reset()
        setQuizAttempt(null)
        setSelectedOptionId('')
        setTimeRemaining(null)
        initializeQuizAttemptMutation.mutate(retryQuizId)
    }

    const handleBackToContent = useCallback(() => {
        initializedAttemptScopeRef.current = ''
        currentAttemptRef.current = null
        attemptActionInProgressRef.current = false
        finalizedDeadlineAttemptRef.current = ''
        failedFinalizationAttemptRef.current = ''
        setQuizAttempt(null)
        setSelectedOptionId('')
        setTimeRemaining(null)
        onBackToContent()
    }, [onBackToContent])

    return {
        quizAttempt,
        selectedOptionId,
        timeRemaining,
        isRefreshingAttempt,
        currentQuestionIndex,
        currentQuestion,
        initializeQuizAttemptMutation,
        saveAnswerMutation,
        finalizeQuizMutation,
        handleRetryQuiz,
        handleBackToContent,
        handleSelectOption,
        handleRetryAnswer
    }
}
