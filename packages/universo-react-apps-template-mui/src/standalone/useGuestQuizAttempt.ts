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

type SaveGuestAnswerInput = { attemptId: string; questionId: string; optionId: string }

export type GuestQuizAttemptController = {
    quizAttempt: GuestQuizAttempt | null
    selectedOptionId: string
    timeRemaining: number | null
    isRefreshingAttempt: boolean
    currentQuestionIndex: number
    currentQuestion: GuestQuizQuestion | null
    initializeQuizAttemptMutation: UseMutationResult<GuestQuizAttempt, Error, string>
    saveAnswerMutation: UseMutationResult<GuestQuizAttempt, Error, SaveGuestAnswerInput>
    finalizeQuizMutation: UseMutationResult<GuestQuizAttempt, Error, string>
    handleRetryQuiz: () => void
    handleBackToContent: () => void
    handleSelectOption: (optionId: string) => Promise<void>
    handleRetryAnswer: () => Promise<void>
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
    const answerSaveContinuationRef = useRef(false)
    const attemptRefreshInProgressRef = useRef(false)
    const currentAttemptRef = useRef<GuestQuizAttempt | null>(null)
    const initializedAttemptScopeRef = useRef('')
    const finalizedDeadlineAttemptRef = useRef('')
    const attemptScope =
        runtimeId && session?.participantId && session.sessionToken ? `${applicationId}:${slug}:${session.participantId}:${runtimeId}` : ''
    const attemptScopeRef = useRef(attemptScope)

    useLayoutEffect(() => {
        attemptScopeRef.current = attemptScope
    }, [attemptScope])

    useEffect(() => {
        currentAttemptRef.current = quizAttempt
    }, [quizAttempt])

    const finalizeQuizMutation = useMutation<GuestQuizAttempt, Error, string>({
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

    const saveAnswerMutation = useMutation<GuestQuizAttempt, Error, SaveGuestAnswerInput>({
        mutationFn: async (input) => {
            if (!session) {
                throw new Error(translate('guest.errors.sessionMissing', 'Guest session is required before continuing the quiz.'))
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
            const responseBody: unknown = await response.json().catch(() => null)
            const attempt = normalizeGuestQuizAttempt(isRecord(responseBody) ? responseBody.attempt : null, input.attemptId)
            if (!response.ok && response.status === 403) {
                throw new GuestSessionUnavailableError(
                    translate('guest.errors.sessionUnavailable', 'Your access to this quiz has ended. No further answers can be saved.')
                )
            }
            if (!attempt || (!response.ok && attempt.status !== 'completed')) {
                throw new Error(translate('guest.errors.quizAnswerSave', 'Failed to save your answer.'))
            }
            return attempt
        }
    })

    const quizRuntimeId = runtimeId
    const currentQuestionIndex =
        quizAttempt?.status === 'in_progress' && quizAttempt.currentQuestionIndex < quizAttempt.totalQuestions
            ? quizAttempt.currentQuestionIndex
            : -1
    const currentQuestion = currentQuestionIndex >= 0 ? quizAttempt?.questions[0] ?? null : null
    const quizAttemptId = quizAttempt?.attemptId
    const quizAttemptStatus = quizAttempt?.status
    const secondsRemainingAtServerSync = quizAttempt ? getInitialRemainingSeconds(quizAttempt) : null
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
            if (!session || !requestScope || attemptRefreshInProgressRef.current || answerSaveContinuationRef.current) return
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
                if (currentAttemptRef.current.questions[0]?.id !== serverAttempt.questions[0]?.id) setSelectedOptionId('')
                setQuizAttempt(serverAttempt)
                setTimeRemaining(serverAttempt.status === 'in_progress' ? getInitialRemainingSeconds(serverAttempt) : 0)
                if (
                    serverAttempt.status === 'in_progress' &&
                    serverAttempt.currentQuestionIndex >= serverAttempt.totalQuestions &&
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
        answerSaveContinuationRef.current = false
        finalizedDeadlineAttemptRef.current = ''
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
        if (quizAttemptStatus !== 'in_progress' || secondsRemainingAtServerSync === null) {
            return
        }

        const initialSeconds = secondsRemainingAtServerSync
        setTimeRemaining(initialSeconds)
        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const getElapsedMilliseconds = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
        const timer = window.setInterval(() => {
            const remaining = Math.max(0, Math.ceil(initialSeconds - getElapsedMilliseconds() / 1000))
            setTimeRemaining(remaining)
            if (remaining === 0) {
                window.clearInterval(timer)
            }
        }, 1000)

        return () => window.clearInterval(timer)
    }, [quizAttemptId, quizAttemptStatus, secondsRemainingAtServerSync])

    useEffect(() => {
        if (
            timeRemaining !== 0 ||
            !quizAttemptId ||
            quizAttemptStatus !== 'in_progress' ||
            isSavingAnswer ||
            answerSaveContinuationRef.current ||
            isFinalizing ||
            finalizedDeadlineAttemptRef.current === quizAttemptId
        ) {
            return
        }

        finalizedDeadlineAttemptRef.current = quizAttemptId
        finalizeAttempt(quizAttemptId)
    }, [timeRemaining, quizAttemptId, quizAttemptStatus, isSavingAnswer, isFinalizing, finalizeAttempt])

    const saveSelectedAnswer = useCallback(
        async (optionId: string) => {
            if (
                !quizAttempt ||
                quizAttempt.status !== 'in_progress' ||
                !currentQuestion ||
                !optionId ||
                timeRemaining === 0 ||
                attemptRefreshInProgressRef.current ||
                answerSaveContinuationRef.current
            )
                return

            answerSaveContinuationRef.current = true
            setSelectedOptionId(optionId)
            saveAnswerMutation.reset()
            let serverAttempt: GuestQuizAttempt
            try {
                serverAttempt = await saveAnswerMutation.mutateAsync({
                    attemptId: quizAttempt.attemptId,
                    questionId: currentQuestion.id,
                    optionId
                })
            } catch {
                answerSaveContinuationRef.current = false
                return
            }

            setQuizAttempt(serverAttempt)
            setSelectedOptionId('')
            if (serverAttempt.status === 'completed') {
                setTimeRemaining(0)
                answerSaveContinuationRef.current = false
                return
            }

            if (serverAttempt.currentQuestionIndex >= serverAttempt.totalQuestions) {
                answerSaveContinuationRef.current = false
                finalizedDeadlineAttemptRef.current = quizAttempt.attemptId
                finalizeQuizMutation.mutate(quizAttempt.attemptId)
                return
            }
            answerSaveContinuationRef.current = false
        },
        [quizAttempt, currentQuestion, timeRemaining, saveAnswerMutation, finalizeQuizMutation]
    )

    const handleSelectOption = useCallback(async (optionId: string) => saveSelectedAnswer(optionId), [saveSelectedAnswer])
    const handleRetryAnswer = useCallback(async () => {
        if (selectedOptionId) await saveSelectedAnswer(selectedOptionId)
    }, [selectedOptionId, saveSelectedAnswer])

    const handleRetryQuiz = () => {
        const retryQuizId = activeQuizId ?? runtimeId
        if (!retryQuizId || !session) {
            return
        }

        removeGuestSessionStorage(getGuestAttemptStorageKey(applicationId, slug, session.participantId, retryQuizId))
        answerSaveContinuationRef.current = false
        finalizedDeadlineAttemptRef.current = ''
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
        answerSaveContinuationRef.current = false
        finalizedDeadlineAttemptRef.current = ''
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
