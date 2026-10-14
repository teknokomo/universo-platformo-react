import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import {
    resetGuestAppTestHarness,
    GuestApp,
    QueryClientProvider,
    clickStartLearning,
    createQueryClient,
    enApps,
    fillGuestIntake,
    fireEvent,
    getRequestPathname,
    guestTestState,
    render,
    screen,
    waitFor
} from './GuestApp.testHarness'

describe('GuestApp quiz attempts', () => {
    beforeEach(resetGuestAppTestHarness)

    it('submits the selected answer and advances automatically in the default mode', async () => {
        const user = userEvent.setup()
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        clickStartLearning()
        expect(await screen.findByText('Content title')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))
        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()

        const firstOption = screen.getByLabelText('Correct option')
        const chosenOption = screen.getByLabelText('Wrong option')
        firstOption.focus()
        await user.keyboard('{ArrowDown}')

        expect(chosenOption).toBeChecked()
        expect(chosenOption).toHaveFocus()
        expect(guestTestState.guestSavedAnswerIds).toEqual([])
        expect(screen.queryByRole('button', { name: enApps.guest.quizSubmitAnswer })).not.toBeInTheDocument()
        expect(screen.getByText(enApps.guest.quizKeyboardSubmitHint)).toBeVisible()

        await user.keyboard(' ')

        expect(await screen.findByText('Second question')).toBeInTheDocument()
        expect(guestTestState.guestSavedAnswerIds).toEqual(['question-1'])
    })

    it('lets learners change a staged answer until they confirm it', async () => {
        const user = userEvent.setup()
        guestTestState.guestConfirmAnswerBeforeNext = true
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        clickStartLearning()
        expect(await screen.findByText('Content title')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))
        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()

        const correctOption = screen.getByLabelText('Correct option')
        const wrongOption = screen.getByLabelText('Wrong option')
        await user.click(wrongOption)
        expect(wrongOption).toBeChecked()
        expect(guestTestState.guestSavedAnswerIds).toEqual([])
        expect(screen.getByRole('button', { name: enApps.guest.quizSubmitAnswer })).toBeVisible()
        expect(screen.getByText(enApps.guest.quizAnswerSelectedToConfirm)).toBeVisible()

        await user.click(correctOption)
        expect(correctOption).toBeChecked()
        expect(guestTestState.guestSavedAnswerIds).toEqual([])
        await user.click(screen.getByRole('button', { name: enApps.guest.quizSubmitAnswer }))

        expect(await screen.findByText('Second question')).toBeInTheDocument()
        expect(guestTestState.guestSavedAnswerIds).toEqual(['question-1'])
    })

    it('saves one quiz answer at a time and sanitizes save errors', async () => {
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
        window.sessionStorage.setItem(
            'apps-template-mui:guest-session:app-1:demo-content',
            JSON.stringify({ participantId: 'student-1', sessionToken: 'token-1' })
        )
        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)
                if (url.endsWith('/api/v1/auth/csrf')) {
                    return {
                        ok: true,
                        json: async () => ({ csrfToken: 'csrf-token' })
                    } as Response
                }
                if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 'link-1',
                            title: 'Demo quiz',
                            targetType: 'quiz',
                            targetId: 'quiz-1'
                        })
                    } as Response
                }
                if (url.includes('/public/a/app-1/runtime?')) {
                    return {
                        ok: true,
                        json: async () => ({
                            type: 'quiz',
                            id: 'quiz-1',
                            title: 'Quiz title',
                            questionCount: 1,
                            questions: []
                        })
                    } as Response
                }
                if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/start') {
                    return {
                        ok: true,
                        json: async () => ({
                            attemptId: 'attempt-1',
                            deadlineAt: '2030-01-01T00:45:00.000Z',
                            serverNow: '2030-01-01T00:00:00.000Z',
                            status: 'in_progress',
                            currentQuestionIndex: 0,
                            totalQuestions: 1,
                            answeredCount: 0,
                            questions: [
                                {
                                    id: 'question-1',
                                    prompt: 'Question prompt',
                                    options: [{ id: 'option-1', label: 'Correct option' }]
                                }
                            ]
                        })
                    } as Response
                }
                if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/attempt-1/answers') {
                    throw new Error(`SQL relation guest_quiz_submissions does not exist for ${leakedUuid}`)
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()
        expect(screen.getByRole('timer')).toHaveTextContent('45:00')
        fireEvent.click(screen.getByLabelText('Correct option'))

        expect(await screen.findByText('Failed to save your answer.')).toBeInTheDocument()
        expect(screen.queryByText(new RegExp(leakedUuid, 'i'))).not.toBeInTheDocument()
        expect(screen.queryByText(/SQL relation|guest_quiz_submissions/i)).not.toBeInTheDocument()
        const fetchCalls = (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls
        const firstAnswerCall = fetchCalls.find(
            ([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-1/answers'
        )
        const firstAnswerBody = JSON.parse(String(firstAnswerCall?.[1]?.body))
        expect(firstAnswerBody).not.toHaveProperty('requestId')
        fireEvent.click(screen.getByRole('button', { name: 'Retry saving answer' }))
        await waitFor(() => {
            const answerCalls = fetchCalls.filter(
                ([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-1/answers'
            )
            expect(answerCalls).toHaveLength(2)
            expect(JSON.parse(String(answerCalls[1][1]?.body))).toEqual(firstAnswerBody)
        })
    })

    it('ends answer entry without offering a retry after the guest session is revoked', async () => {
        guestTestState.guestSessionUnavailable = true

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        clickStartLearning()
        expect(await screen.findByText('Content title')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))
        expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Correct option'))

        expect(await screen.findByText('Your access to this quiz has ended. No further answers can be saved.')).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Question prompt' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Retry saving answer' })).not.toBeInTheDocument()
    })

    it.each([
        {
            label: 'a revoked link returned with success',
            responseOk: true,
            attempt: {
                attemptId: 'attempt-1',
                status: 'revoked',
                result: { score: 1, total: 2, passed: false, finishedReason: 'revoked' }
            },
            expectedNotice: enApps.guest.quizRevokedResult,
            expectedScore: null
        },
        {
            label: 'a timed-out attempt returned with conflict',
            responseOk: false,
            attempt: {
                attemptId: 'attempt-1',
                status: 'timed_out',
                result: { score: 0, total: 2, passed: false, finishedReason: 'timed_out' }
            },
            expectedNotice: enApps.guest.quizTimedOutResult,
            expectedScore: 'Correct answers: 0 of 2'
        }
    ])(
        'renders the terminal server attempt when answer saving returns $label',
        async ({ responseOk, attempt, expectedNotice, expectedScore }) => {
            render(
                <QueryClientProvider client={createQueryClient()}>
                    <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
                </QueryClientProvider>
            )

            expect(await screen.findByText('Demo content')).toBeInTheDocument()
            fillGuestIntake('Guest learner')
            clickStartLearning()
            expect(await screen.findByText('Content title')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))
            expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()

            guestTestState.guestAnswerResponseOverride = { ok: responseOk, payload: { attempt } }
            fireEvent.click(screen.getByLabelText('Correct option'))

            expect(await screen.findByRole('heading', { name: enApps.guest.quizResultTitle })).toBeInTheDocument()
            expect(await screen.findByText(expectedNotice)).toBeInTheDocument()
            if (expectedScore) {
                expect(screen.getByText(expectedScore)).toBeInTheDocument()
            } else {
                expect(screen.queryByText(/Correct answers:/)).not.toBeInTheDocument()
            }
            expect(screen.queryByRole('heading', { name: 'Second question' })).not.toBeInTheDocument()

            const calls = (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls
            expect(
                calls.filter(([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-1/finalize')
            ).toHaveLength(0)
        }
    )

    it('resumes a saved attempt at the first unanswered question with session headers', async () => {
        window.sessionStorage.setItem(
            'apps-template-mui:guest-session:app-1:demo-content',
            JSON.stringify({ participantId: 'student-1', sessionToken: 'token-1' })
        )
        window.sessionStorage.setItem('apps-template-mui:guest-attempt:app-1:demo-content:student-1:quiz-1', 'attempt-resume')
        const linkRequests: Array<{ url: string; participantId: string | null; sessionToken: string | null }> = []
        const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
            const url = String(input)
            if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
                const headers = new Headers(init?.headers)
                linkRequests.push({
                    url,
                    participantId: headers.get('X-Guest-Participant-Id'),
                    sessionToken: headers.get('X-Guest-Session-Token')
                })
                return {
                    ok: true,
                    json: async () => ({ id: 'link-1', title: 'Demo quiz', targetType: 'quiz', targetId: 'quiz-1' })
                } as Response
            }
            if (url.includes('/public/a/app-1/runtime?')) {
                return {
                    ok: true,
                    json: async () => ({
                        type: 'quiz',
                        id: 'quiz-1',
                        title: 'Quiz title',
                        questionCount: 2,
                        questions: []
                    })
                } as Response
            }
            if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/attempt-resume') {
                const headers = new Headers(init?.headers)
                expect(headers.get('X-Guest-Participant-Id')).toBe('student-1')
                expect(headers.get('X-Guest-Session-Token')).toBe('token-1')
                expect(new URL(url, 'http://localhost').searchParams.has('participantId')).toBe(false)
                return {
                    ok: true,
                    json: async () => ({
                        attemptId: 'attempt-resume',
                        attemptNumber: 1,
                        deadlineAt: null,
                        serverNow: '2030-01-01T00:00:00.000Z',
                        status: 'in_progress',
                        currentQuestionIndex: 1,
                        totalQuestions: 2,
                        answeredCount: 1,
                        questions: [{ id: 'question-2', prompt: 'Question two', options: [{ id: 'option-2', label: 'Second option' }] }]
                    })
                } as Response
            }
            throw new Error(`Unexpected fetch request: ${url}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        const queryClient = createQueryClient()
        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByRole('heading', { name: 'Question two' })).toBeInTheDocument()
        expect(
            screen.getByText('Your saved quiz attempt has been restored. Continue with the next unanswered question.')
        ).toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: 'Question one' })).not.toBeInTheDocument()
        expect(screen.getByText('Question 2 of 2')).toHaveAttribute('role', 'status')
        expect(screen.queryByRole('timer')).not.toBeInTheDocument()
        const attemptResumeCall = fetchMock.mock.calls.find(
            ([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-resume'
        )
        expect(attemptResumeCall).toBeDefined()
        const attemptResumeUrl = new URL(String(attemptResumeCall?.[0]), 'http://localhost')
        expect(attemptResumeUrl.searchParams.has('participantId')).toBe(false)
        expect(attemptResumeUrl.searchParams.get('locale')).toBe('en')
        const attemptResumeHeaders = new Headers(attemptResumeCall?.[1]?.headers)
        expect(attemptResumeHeaders.get('X-Guest-Participant-Id')).toBe('student-1')
        expect(attemptResumeHeaders.get('X-Guest-Session-Token')).toBe('token-1')
        expect(screen.getByText('There is no time limit for this quiz.')).toBeInTheDocument()
        expect(linkRequests).toHaveLength(1)
        expect(linkRequests[0]).toMatchObject({ participantId: 'student-1', sessionToken: 'token-1' })
        expect(linkRequests[0].url).not.toContain('token-1')
        const guestLinkQueryKeys = queryClient
            .getQueryCache()
            .findAll({ queryKey: ['guest-link'] })
            .map((query) => query.queryKey)
        expect(guestLinkQueryKeys).toContainEqual(['guest-link', 'app-1', 'demo-content', null, null, 'en', 'student-1'])
        expect(JSON.stringify(guestLinkQueryKeys)).not.toContain('token-1')
        expect(fetchMock.mock.calls.some(([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/start')).toBe(false)
    })

    it('finalizes a fully answered attempt restored after the last answer response was lost', async () => {
        window.sessionStorage.setItem(
            'apps-template-mui:guest-session:app-1:demo-content',
            JSON.stringify({ participantId: 'student-1', sessionToken: 'token-1' })
        )
        window.sessionStorage.setItem('apps-template-mui:guest-attempt:app-1:demo-content:student-1:quiz-1', 'attempt-resume')
        let answerPersisted = false
        const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
            const url = String(input)
            const pathname = getRequestPathname(url)

            if (url.endsWith('/api/v1/auth/csrf')) {
                return { ok: true, json: async () => ({ csrfToken: 'csrf-token' }) } as Response
            }
            if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
                return {
                    ok: true,
                    json: async () => ({ id: 'link-1', title: 'Demo quiz', targetType: 'quiz', targetId: 'quiz-1' })
                } as Response
            }
            if (url.includes('/public/a/app-1/runtime?')) {
                return {
                    ok: true,
                    json: async () => ({ type: 'quiz', id: 'quiz-1', title: 'Quiz title', questionCount: 2, questions: [] })
                } as Response
            }
            if (pathname === '/public/a/app-1/runtime/attempts/attempt-resume') {
                const currentQuestionIndex = answerPersisted ? 2 : 1
                return {
                    ok: true,
                    json: async () => ({
                        attemptId: 'attempt-resume',
                        attemptNumber: 1,
                        deadlineAt: null,
                        serverNow: '2030-01-01T00:00:00.000Z',
                        status: 'in_progress',
                        currentQuestionIndex,
                        totalQuestions: 2,
                        answeredCount: currentQuestionIndex,
                        questions: answerPersisted
                            ? []
                            : [{ id: 'question-2', prompt: 'Question two', options: [{ id: 'option-2', label: 'Second option' }] }]
                    })
                } as Response
            }
            if (pathname === '/public/a/app-1/runtime/attempts/attempt-resume/answers') {
                answerPersisted = true
                return { ok: false, status: 500, json: async () => ({}) } as Response
            }
            if (pathname === '/public/a/app-1/runtime/attempts/attempt-resume/finalize') {
                expect(answerPersisted).toBe(true)
                return {
                    ok: true,
                    json: async () => ({
                        attemptId: 'attempt-resume',
                        attemptNumber: 1,
                        status: 'completed',
                        currentQuestionIndex: 2,
                        totalQuestions: 2,
                        answeredCount: 2,
                        questions: [],
                        result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' }
                    })
                } as Response
            }
            throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByRole('heading', { name: 'Question two' })).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Second option'))
        expect(await screen.findByText('Failed to save your answer.')).toBeInTheDocument()

        window.dispatchEvent(new Event('online'))

        expect(await screen.findByRole('heading', { name: enApps.guest.quizResultTitle })).toBeInTheDocument()
        expect(await screen.findByText('Correct answers: 1 of 2')).toBeInTheDocument()
        expect(screen.queryByText('Failed to save your answer.')).not.toBeInTheDocument()
        const finalizeCalls = fetchMock.mock.calls.filter(
            ([input]) => getRequestPathname(input) === '/public/a/app-1/runtime/attempts/attempt-resume/finalize'
        )
        expect(finalizeCalls).toHaveLength(1)
    })

    it('refetches runtime only after the guest session is created', async () => {
        let runtimeRequestCount = 0
        const runtimeUrls: string[] = []
        const runtimeHeaders: Array<{ participantId: string | null; sessionToken: string | null }> = []

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL, init?: RequestInit) => {
                const url = String(input)

                if (url.endsWith('/api/v1/auth/csrf')) {
                    return {
                        ok: true,
                        json: async () => ({
                            csrfToken: 'csrf-token'
                        })
                    } as Response
                }

                if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
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
                    runtimeRequestCount += 1
                    runtimeUrls.push(url)
                    const headers = new Headers(init?.headers)
                    runtimeHeaders.push({
                        participantId: headers.get('X-Guest-Participant-Id'),
                        sessionToken: headers.get('X-Guest-Session-Token')
                    })
                    return {
                        ok: true,
                        json: async () => ({
                            type: 'content',
                            id: 'content-1',
                            title: 'Content title',
                            contentItems: [
                                {
                                    id: 'item-1',
                                    itemType: 'text',
                                    itemTitle: 'Intro',
                                    itemContent: 'Content body',
                                    sortOrder: 0
                                }
                            ]
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

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        expect(runtimeRequestCount).toBe(0)

        fillGuestIntake('Guest learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
            expect(screen.getByText('Content body')).toBeInTheDocument()
        })

        expect(runtimeRequestCount).toBe(1)
        expect(runtimeUrls[0]).not.toContain('studentId=student-1')
        expect(runtimeUrls[0]).not.toContain('participantId=student-1')
        expect(runtimeUrls[0]).not.toContain('sessionToken=token-1')
        expect(runtimeHeaders[0]).toEqual({
            participantId: 'student-1',
            sessionToken: 'token-1'
        })
    })

    it('does not reuse a previous guest session after navigating to another public link', async () => {
        const runtimeUrls: string[] = []

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL, init?: RequestInit) => {
                const url = String(input)

                if (url.endsWith('/api/v1/auth/csrf')) {
                    return {
                        ok: true,
                        json: async () => ({ csrfToken: 'csrf-token' })
                    } as Response
                }

                if (url.includes('/public/a/app-1/links/demo-content?locale=en')) {
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

                if (url.includes('/public/a/app-1/links/docking-drill?locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({
                            id: 'link-2',
                            title: 'Docking content',
                            targetType: 'content',
                            targetId: 'content-2'
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
                    runtimeUrls.push(url)
                    const headers = new Headers(init?.headers)
                    expect(headers.get('X-Guest-Participant-Id')).toBe('student-1')
                    expect(headers.get('X-Guest-Session-Token')).toBe('token-1')
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

                if (url.includes('/public/a/app-1/runtime?') && url.includes('slug=docking-drill')) {
                    throw new Error(`The previous guest session must not trigger runtime loading for a new slug: ${url}`)
                }

                throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
            })
        )

        const queryClient = createQueryClient()
        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        expect(await screen.findByText('Content title')).toBeInTheDocument()
        expect(runtimeUrls).toHaveLength(1)

        rerender(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='docking-drill' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Docking content')).toBeInTheDocument()
        await waitFor(() => {
            expect(screen.getByLabelText(/First name/)).toBeInTheDocument()
        })
        expect(screen.queryByText('Content title')).not.toBeInTheDocument()
        expect(runtimeUrls).toHaveLength(1)
    })
})
