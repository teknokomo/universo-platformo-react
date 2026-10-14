import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    resetGuestAppTestHarness,
    GuestApp,
    QueryClientProvider,
    clickStartLearning,
    completeGuestQuiz,
    createQueryClient,
    enApps,
    fillGuestIntake,
    fireEvent,
    getRequestPathname,
    guestTestState,
    i18nState,
    readGuestProgressRequestBodies,
    render,
    ruApps,
    screen,
    waitFor
} from './GuestApp.testHarness'

describe('GuestApp results and retries', () => {
    beforeEach(resetGuestAppTestHarness)

    it('keeps the quiz result visible until the guest explicitly returns to the content', async () => {
        guestTestState.deferGuestAnswerResponse = true
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        fillGuestIntake('Guest learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Open quiz' })).toBeInTheDocument()
        })
        await waitFor(() => {
            expect(readGuestProgressRequestBodies()).toHaveLength(1)
        })
        expect(readGuestProgressRequestBodies()[0]).toMatchObject({
            participantId: 'student-1',
            sessionToken: 'token-1',
            contentNodeId: 'content-1',
            contentItemId: 'item-2',
            action: 'view'
        })
        expect(readGuestProgressRequestBodies()[0]).not.toHaveProperty('progressPercent')
        expect(readGuestProgressRequestBodies()[0]).not.toHaveProperty('status')
        expect(readGuestProgressRequestBodies()[0]).not.toHaveProperty('lastAccessedItemIndex')

        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))

        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Second question' })).not.toBeInTheDocument()
        expect(screen.getByRole('timer')).toHaveTextContent('45:00')
        expect(screen.getByText('You have 45 minutes to complete this quiz.')).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Correct option'))

        expect(await screen.findByText('Saving answer...')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Second question' })).not.toBeInTheDocument()
        guestTestState.releaseGuestAnswerResponse?.()
        expect(await screen.findByRole('heading', { name: 'Second question' })).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Question prompt' })).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Second question' })).toHaveFocus()

        fireEvent.click(screen.getByLabelText('Second option'))

        await waitFor(() => {
            expect(screen.getByText('Correct answers: 1 of 2')).toBeInTheDocument()
            expect(screen.getByText('Well done.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Back to content' })).toBeInTheDocument()
        })

        const calls = (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls
        const startCall = calls.find(([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/start')
        expect(JSON.parse(String(startCall?.[1]?.body))).toEqual({
            participantId: 'student-1',
            sessionToken: 'token-1',
            assessmentId: 'quiz-1'
        })
        const startHeaders = new Headers(startCall?.[1]?.headers)
        expect(startHeaders.get('X-CSRF-Token')).toBe('csrf-token')
        expect(startHeaders.get('X-Guest-Participant-Id')).toBe('student-1')
        expect(startHeaders.get('X-Guest-Session-Token')).toBe('token-1')
        expect(new URL(String(startCall?.[0]), 'http://localhost').searchParams.get('locale')).toBe('en')
        expect(window.sessionStorage.getItem('apps-template-mui:guest-attempt:app-1:demo-content:student-1:quiz-1')).toBe('attempt-1')

        const answerCalls = calls.filter(([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-1/answers')
        expect(answerCalls).toHaveLength(2)
        expect(JSON.parse(String(answerCalls[0][1]?.body))).toMatchObject({
            participantId: 'student-1',
            sessionToken: 'token-1',
            questionId: 'question-1',
            optionId: 'option-1'
        })
        expect(JSON.parse(String(answerCalls[0][1]?.body))).not.toHaveProperty('requestId')
        const answerHeaders = new Headers(answerCalls[0][1]?.headers)
        expect(answerHeaders.get('X-CSRF-Token')).toBe('csrf-token')
        expect(answerHeaders.get('X-Guest-Participant-Id')).toBe('student-1')
        expect(answerHeaders.get('X-Guest-Session-Token')).toBe('token-1')
        expect(new URL(String(answerCalls[0][0]), 'http://localhost').searchParams.get('locale')).toBe('en')
        const finalizeCall = calls.find(([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-1/finalize')
        expect(JSON.parse(String(finalizeCall?.[1]?.body))).toEqual({ participantId: 'student-1', sessionToken: 'token-1' })
        const finalizeHeaders = new Headers(finalizeCall?.[1]?.headers)
        expect(finalizeHeaders.get('X-CSRF-Token')).toBe('csrf-token')
        expect(finalizeHeaders.get('X-Guest-Participant-Id')).toBe('student-1')
        expect(finalizeHeaders.get('X-Guest-Session-Token')).toBe('token-1')
        expect(new URL(String(finalizeCall?.[0]), 'http://localhost').searchParams.get('locale')).toBe('en')
        expect(calls.some(([input]) => String(input).endsWith('/runtime/guest-submit'))).toBe(false)

        fireEvent.click(screen.getByRole('button', { name: 'Back to content' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Open quiz' })).toBeInTheDocument()
        })
    })

    it('offers a new server attempt when attempts remain and clears the saved attempt key first', async () => {
        guestTestState.guestRuntimeMaxAttempts = '3'
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            attemptNumber: '1',
            status: 'completed',
            result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
            completionText: 'Well done.'
        }
        guestTestState.guestAttemptStartResponses = [
            null,
            {
                ok: true,
                status: 200,
                payload: {
                    attemptId: 'attempt-2',
                    attemptNumber: '2',
                    deadlineAt: '2030-01-01T00:45:00.000Z',
                    serverNow: '2030-01-01T00:00:00.000Z',
                    status: 'in_progress',
                    currentQuestionIndex: 0,
                    totalQuestions: 1,
                    answeredCount: 0,
                    questions: [
                        {
                            id: 'retry-question',
                            prompt: 'New attempt question',
                            options: [{ id: 'retry-option', label: 'Retry option' }]
                        }
                    ]
                }
            }
        ]
        const attemptStorageKey = 'apps-template-mui:guest-attempt:app-1:demo-content:student-1:quiz-1'
        guestTestState.guestAttemptStartObserver = () => {
            if (guestTestState.guestAttemptStartCalls === 2) {
                expect(window.sessionStorage.getItem(attemptStorageKey)).toBeNull()
            }
        }

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        await completeGuestQuiz()
        expect(screen.getByRole('button', { name: enApps.guest.retryQuiz })).toBeInTheDocument()
        expect(window.sessionStorage.getItem(attemptStorageKey)).toBe('attempt-1')

        fireEvent.click(screen.getByRole('button', { name: enApps.guest.retryQuiz }))

        expect(await screen.findByRole('heading', { name: 'New attempt question' })).toBeInTheDocument()
        expect(screen.queryByText('Correct answers: 1 of 2')).not.toBeInTheDocument()
        expect(screen.getByLabelText('Retry option')).not.toBeChecked()
        await waitFor(() => {
            expect(guestTestState.guestAttemptStartCalls).toBe(2)
            expect(window.sessionStorage.getItem(attemptStorageKey)).toBe('attempt-2')
        })
    })

    it('offers a retry when a guest opens the quiz directly from its access link', async () => {
        guestTestState.guestDirectQuizLink = true
        guestTestState.guestRuntimeMaxAttempts = 3
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            attemptNumber: 1,
            status: 'completed',
            result: { score: 1, total: 2, passed: false, finishedReason: 'timed_out' },
            completionText: 'Well done.'
        }
        guestTestState.guestAttemptStartResponses = [
            null,
            {
                ok: true,
                status: 200,
                payload: {
                    attemptId: 'attempt-2',
                    attemptNumber: 2,
                    deadlineAt: '2030-01-01T00:45:00.000Z',
                    serverNow: '2030-01-01T00:00:00.000Z',
                    status: 'in_progress',
                    currentQuestionIndex: 0,
                    totalQuestions: 1,
                    answeredCount: 0,
                    questions: [
                        { id: 'retry-question', prompt: 'New attempt question', options: [{ id: 'retry-option', label: 'Retry option' }] }
                    ]
                }
            }
        ]

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake()
        clickStartLearning()
        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Correct option'))
        expect(await screen.findByRole('heading', { name: 'Second question' })).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Second option'))

        expect(await screen.findByText('Time expired. Your saved answers were scored.')).toBeInTheDocument()
        const retryButton = screen.getByRole('button', { name: enApps.guest.retryQuiz })
        expect(retryButton).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Back to content' })).not.toBeInTheDocument()

        fireEvent.click(retryButton)
        expect(await screen.findByRole('heading', { name: 'New attempt question' })).toBeInTheDocument()
        await waitFor(() => expect(guestTestState.guestAttemptStartCalls).toBe(2))
    })

    it('hides retry when the attempt limit is reached or the attempt number is missing', async () => {
        const scenarios = [
            {
                description: 'the final allowed attempt',
                maxAttempts: 2,
                attemptNumber: 2
            },
            {
                description: 'a finite limit with no API attempt number',
                maxAttempts: 3,
                attemptNumber: undefined
            }
        ]

        for (const scenario of scenarios) {
            window.sessionStorage.clear()
            guestTestState.guestSavedAnswerIds = []
            guestTestState.guestAttemptStartCalls = 0
            guestTestState.guestRuntimeMaxAttempts = scenario.maxAttempts
            guestTestState.guestAttemptNumber = scenario.attemptNumber ?? 1
            guestTestState.guestFinalizeResponse = {
                attemptId: 'attempt-1',
                ...(scenario.attemptNumber !== undefined ? { attemptNumber: scenario.attemptNumber } : {}),
                status: 'completed',
                result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
                completionText: 'Well done.'
            }

            const queryClient = createQueryClient()
            const { unmount } = render(
                <QueryClientProvider client={queryClient}>
                    <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
                </QueryClientProvider>
            )

            await completeGuestQuiz()
            expect(screen.queryByRole('button', { name: enApps.guest.retryQuiz })).not.toBeInTheDocument()
            unmount()
        }
    })

    it.each([null, undefined])('treats a missing or null attempt limit as unlimited (%s)', async (maxAttempts) => {
        guestTestState.guestRuntimeMaxAttempts = maxAttempts
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            attemptNumber: 1,
            status: 'completed',
            result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
            completionText: 'Well done.'
        }

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        await completeGuestQuiz()
        expect(screen.getByRole('button', { name: enApps.guest.retryQuiz })).toBeInTheDocument()
    })

    it.each([
        { locale: 'en', message: enApps.guest.errors.quizAttemptUnavailable },
        { locale: 'ru', message: ruApps.guest.errors.quizAttemptUnavailable }
    ])('shows a localized message when the server refuses a retry with HTTP 409 ($locale)', async ({ locale, message }) => {
        i18nState.locale = locale
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            attemptNumber: 1,
            status: 'completed',
            result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
            completionText: 'Well done.'
        }
        guestTestState.guestAttemptStartResponses = [null, { ok: false, status: 409, payload: { error: 'attempt limit reached' } }]

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale={locale} apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        await completeGuestQuiz()
        fireEvent.click(screen.getByRole('button', { name: locale === 'ru' ? ruApps.guest.retryQuiz : enApps.guest.retryQuiz }))

        expect(await screen.findByRole('alert')).toHaveTextContent(message)
        expect(screen.queryByText('attempt limit reached')).not.toBeInTheDocument()
    })

    it('renders a timed-out result returned by the server', async () => {
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            status: 'timed_out',
            result: { score: 1, total: 2, passed: false, finishedReason: 'timed_out' },
            completionText: 'Time is up.'
        }

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest', 'Learner')
        clickStartLearning()
        expect(await screen.findByText('Content title')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))
        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Correct option'))
        expect(await screen.findByRole('heading', { name: 'Second question' })).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Second option'))

        expect(await screen.findByText('Correct answers: 1 of 2')).toBeInTheDocument()
        expect(screen.getByText('Time expired. Your saved answers were scored.')).toBeInTheDocument()
        expect(screen.getByText('Time is up.')).toBeInTheDocument()
    })

    it('keeps the start action disabled until the access link is resolved', async () => {
        let releaseLinkRequest: (() => void) | null = null

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL, init?: RequestInit) => {
                const url = String(input)

                if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
                    await new Promise<void>((resolve) => {
                        releaseLinkRequest = resolve
                    })
                    return {
                        ok: true,
                        json: async () => ({
                            id: 'link-1',
                            title: 'Demo content',
                            targetType: 'content',
                            targetId: 'content-1'
                        })
                    } as Response
                }

                if (url.endsWith('/api/v1/auth/csrf')) {
                    return {
                        ok: true,
                        json: async () => ({
                            csrfToken: 'csrf-token'
                        })
                    } as Response
                }

                if (url.endsWith('/public/a/app-1/guest-session')) {
                    return {
                        ok: true,
                        json: async () => ({
                            studentId: 'student-1',
                            sessionToken: 'token-1'
                        })
                    } as Response
                }

                if (url.includes('/public/a/app-1/runtime?') && url.includes('slug=demo-content') && url.includes('locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({
                            type: 'content',
                            id: 'content-1',
                            title: 'Content title',
                            contentItems: []
                        })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
            })
        )

        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        const button = screen.getByRole('button', { name: 'Start learning' })
        fillGuestIntake('Guest learner')

        await waitFor(() => {
            expect(button).toBeDisabled()
            expect(screen.getByText('Loading access link...')).toBeInTheDocument()
        })

        releaseLinkRequest?.()

        await waitFor(() => {
            expect(button).not.toBeDisabled()
            expect(screen.getByText('Demo content')).toBeInTheDocument()
        })
    })

    it('isolates public csrf tokens per application id', async () => {
        const csrfHeaders: string[] = []
        let csrfCounter = 0

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL, init?: RequestInit) => {
                const url = String(input)

                if (url.endsWith('/api/v1/auth/csrf')) {
                    csrfCounter += 1
                    return {
                        ok: true,
                        json: async () => ({ csrfToken: `csrf-token-${csrfCounter}` })
                    } as Response
                }

                if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({ id: 'link-1', title: 'Demo content', targetType: 'content', targetId: 'content-1' })
                    } as Response
                }

                if (url.includes('/public/a/app-2/links/demo-content?locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({ id: 'link-2', title: 'Second content', targetType: 'content', targetId: 'content-2' })
                    } as Response
                }

                if (url.endsWith('/public/a/app-1/guest-session') || url.endsWith('/public/a/app-2/guest-session')) {
                    csrfHeaders.push(new Headers(init?.headers).get('X-CSRF-Token') ?? '')
                    return {
                        ok: true,
                        json: async () => ({ studentId: 'student-1', sessionToken: 'token-1' })
                    } as Response
                }

                if (url.includes('/public/a/app-1/runtime?') || url.includes('/public/a/app-2/runtime?')) {
                    return {
                        ok: true,
                        json: async () => ({ type: 'content', id: 'content-1', title: 'Content title', contentItems: [] })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
            })
        )

        const firstClient = createQueryClient()
        const firstRender = render(
            <QueryClientProvider client={firstClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner 1')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))
        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
        })
        firstRender.unmount()

        const secondClient = createQueryClient()
        render(
            <QueryClientProvider client={secondClient}>
                <GuestApp applicationId='app-2' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Second content')).toBeInTheDocument()
        fillGuestIntake('Guest learner 2')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))
        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
        })

        expect(csrfHeaders).toEqual(['csrf-token-1', 'csrf-token-2'])
    })
})
