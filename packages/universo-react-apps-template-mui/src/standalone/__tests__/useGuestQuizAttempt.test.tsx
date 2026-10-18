import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuestSessionUnavailableError } from '../guestRuntimeUtils'
import type { GuestFetchWithPublicCsrf } from '../guestRuntimeTypes'
import { useGuestQuizAttempt } from '../useGuestQuizAttempt'

const makeResponse = (status: number, payload: unknown) => {
    const json = vi.fn(async () => payload)
    return {
        response: { ok: status >= 200 && status < 300, status, json } as unknown as Response,
        json
    }
}

const makeQuestionAttempt = () => ({
    attemptId: 'attempt-1',
    attemptNumber: 1,
    status: 'in_progress',
    phase: 'question',
    phaseRevision: 0,
    timerState: 'untimed',
    remainingMs: null,
    numberingMode: 'global',
    currentBlock: null,
    currentQuestionIndex: 0,
    totalQuestions: 1,
    answeredCount: 0,
    deadlineAt: null,
    serverNow: '2030-01-01T00:00:00.000Z',
    questions: [{ id: 'question-1', prompt: 'Question', displayNumber: '1', options: [{ id: 'option-1', label: 'First' }] }],
    result: null
})

const renderAttemptHook = (fetchWithPublicCsrf: GuestFetchWithPublicCsrf) => {
    const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    return renderHook(
        () =>
            useGuestQuizAttempt({
                applicationId: 'app-1',
                slug: 'demo-content',
                apiBaseUrl: '/api/v1',
                locale: 'en',
                session: { participantId: 'student-1', sessionToken: 'token-1' },
                activeQuizId: 'quiz-1',
                runtimeId: 'quiz-1',
                fetchWithPublicCsrf,
                translate: (_key, fallback) => fallback,
                onBackToContent: vi.fn()
            }),
        { wrapper }
    )
}

describe('useGuestQuizAttempt', () => {
    it.each([403, 404])(
        'marks a %i Continue response as an unavailable guest session without exposing the response body',
        async (status) => {
            window.sessionStorage.clear()
            const continuationResponse = makeResponse(status, { error: 'private revocation detail' })
            const fetchWithPublicCsrf = vi
                .fn<GuestFetchWithPublicCsrf>()
                .mockResolvedValueOnce(
                    makeResponse(200, {
                        attemptId: 'attempt-1',
                        attemptNumber: 1,
                        status: 'in_progress',
                        phase: 'block_intro',
                        phaseRevision: 0,
                        timerState: 'untimed',
                        remainingMs: null,
                        numberingMode: 'block',
                        currentBlock: { key: 'internal-block-key', title: 'Unit one', introduction: 'Instructions' },
                        currentQuestionIndex: 0,
                        totalQuestions: 1,
                        answeredCount: 0,
                        deadlineAt: null,
                        serverNow: '2030-01-01T00:00:00.000Z',
                        questions: [],
                        result: null
                    }).response
                )
                .mockResolvedValueOnce(continuationResponse.response)
            const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
            const wrapper = ({ children }: { children: ReactNode }) => (
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            )
            const { result } = renderHook(
                () =>
                    useGuestQuizAttempt({
                        applicationId: 'app-1',
                        slug: 'demo-content',
                        apiBaseUrl: '/api/v1',
                        locale: 'en',
                        session: { participantId: 'student-1', sessionToken: 'token-1' },
                        activeQuizId: 'quiz-1',
                        runtimeId: 'quiz-1',
                        fetchWithPublicCsrf,
                        translate: (_key, fallback) => fallback,
                        onBackToContent: vi.fn()
                    }),
                { wrapper }
            )

            await waitFor(() => expect(result.current.quizAttempt?.phase).toBe('block_intro'))
            await act(async () => result.current.handleSelectOption())

            await waitFor(() => expect(result.current.saveAnswerMutation.error).toBeInstanceOf(GuestSessionUnavailableError))
            expect(result.current.saveAnswerMutation.error?.message).toBe(
                'Your access to this quiz has ended. No further answers can be saved.'
            )
            expect(result.current.saveAnswerMutation.error?.message).not.toContain('private revocation detail')
            expect(continuationResponse.json).not.toHaveBeenCalled()
        }
    )

    it.each([403, 404])('marks a %i answer response as an unavailable guest session', async (status) => {
        window.sessionStorage.clear()
        const answerResponse = makeResponse(status, { error: 'private revocation detail' })
        const fetchWithPublicCsrf = vi
            .fn<GuestFetchWithPublicCsrf>()
            .mockResolvedValueOnce(makeResponse(200, makeQuestionAttempt()).response)
            .mockResolvedValueOnce(answerResponse.response)
        const { result } = renderAttemptHook(fetchWithPublicCsrf)

        await waitFor(() => expect(result.current.currentQuestion?.id).toBe('question-1'))
        await act(async () => result.current.handleSelectOption('option-1'))

        await waitFor(() => expect(result.current.saveAnswerMutation.error).toBeInstanceOf(GuestSessionUnavailableError))
        expect(result.current.saveAnswerMutation.error?.message).toBe(
            'Your access to this quiz has ended. No further answers can be saved.'
        )
        expect(result.current.saveAnswerMutation.error?.message).not.toContain('private revocation detail')
        expect(answerResponse.json).not.toHaveBeenCalled()
    })

    it.each([403, 404])('marks a %i finalize response as an unavailable guest session', async (status) => {
        window.sessionStorage.clear()
        const finalizeResponse = makeResponse(status, { error: 'private revocation detail' })
        const completedAnswerState = {
            ...makeQuestionAttempt(),
            currentQuestionIndex: 1,
            answeredCount: 1,
            questions: []
        }
        const fetchWithPublicCsrf = vi
            .fn<GuestFetchWithPublicCsrf>()
            .mockResolvedValueOnce(makeResponse(200, makeQuestionAttempt()).response)
            .mockResolvedValueOnce(makeResponse(200, { attempt: completedAnswerState }).response)
            .mockResolvedValueOnce(finalizeResponse.response)
        const { result } = renderAttemptHook(fetchWithPublicCsrf)

        await waitFor(() => expect(result.current.currentQuestion?.id).toBe('question-1'))
        await act(async () => result.current.handleSelectOption('option-1'))

        await waitFor(() => expect(result.current.finalizeQuizMutation.error).toBeInstanceOf(GuestSessionUnavailableError))
        expect(result.current.finalizeQuizMutation.error?.message).toBe(
            'Your access to this quiz has ended. No further answers can be saved.'
        )
        expect(result.current.finalizeQuizMutation.error?.message).not.toContain('private revocation detail')
        expect(finalizeResponse.json).not.toHaveBeenCalled()
    })
})
