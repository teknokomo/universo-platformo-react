import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    resetGuestAppTestHarness,
    GuestApp,
    QueryClientProvider,
    clickStartLearning,
    completeGuestQuiz,
    createQueryClient,
    createTabSessionStorage,
    enApps,
    fillGuestIntake,
    fireEvent,
    getRequestPathname,
    guestTranslations,
    guestTestState,
    i18nState,
    makeGuestAttemptDto,
    render,
    ruApps,
    screen,
    waitFor
} from './GuestApp.testHarness'

describe('GuestApp intake and errors', () => {
    beforeEach(resetGuestAppTestHarness)

    it('shows optional configured fields, validates supplied email, and omits hidden or blank fields from intake', async () => {
        guestTestState.guestIntakePolicy = {
            showFirstName: false,
            requireFirstName: false,
            showLastName: false,
            requireLastName: false,
            showEmail: true,
            requireEmail: false,
            showPhone: false,
            requirePhone: false,
            captchaEnabled: false
        }
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        expect(screen.queryByLabelText(/First name/)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/Last name/)).not.toBeInTheDocument()
        const emailField = await screen.findByLabelText(/Email address/)
        expect(emailField).not.toBeRequired()

        const consents = screen.getAllByRole('checkbox')
        expect(consents).toHaveLength(2)
        fireEvent.click(consents[0]!)
        fireEvent.click(consents[1]!)
        fireEvent.change(emailField, { target: { value: 'not-an-email' } })
        expect(screen.getByRole('button', { name: 'Start learning' })).toBeDisabled()
        expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
        expect(vi.mocked(globalThis.fetch).mock.calls.some(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))).toBe(
            false
        )

        fireEvent.change(emailField, { target: { value: '' } })
        expect(screen.getByRole('button', { name: 'Start learning' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))
        await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())
        const sessionCall = vi
            .mocked(globalThis.fetch)
            .mock.calls.find(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))
        expect(JSON.parse(String(sessionCall?.[1]?.body))).toEqual({
            accessLinkId: 'link-1',
            termsAccepted: true,
            privacyAccepted: true
        })
    })

    it('keeps guest intake disabled until required identity fields and both consent checkboxes are complete', async () => {
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        const startButton = screen.getByRole('button', { name: 'Start learning' })
        const firstName = screen.getByLabelText(/First name/)
        const lastName = screen.getByLabelText(/Last name/)
        const [terms, privacy] = screen.getAllByRole('checkbox')

        expect(startButton).toBeDisabled()
        fireEvent.change(firstName, { target: { value: '   ' } })
        fireEvent.change(lastName, { target: { value: 'Lovelace' } })
        expect(startButton).toBeDisabled()

        fireEvent.change(firstName, { target: { value: 'Ada' } })
        expect(startButton).toBeDisabled()
        fireEvent.click(terms!)
        expect(startButton).toBeDisabled()
        fireEvent.click(privacy!)
        expect(startButton).toBeEnabled()
    })

    it('creates a guest session and renders public content', async () => {
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
            expect(screen.getByText('Content body')).toBeInTheDocument()
        })

        expect(window.sessionStorage.getItem('apps-template-mui:guest-session:app-1:demo-content')).toContain('student-1')
        const guestSessionCall = (
            globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }
        ).mock.calls.find(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))
        expect(JSON.parse(String(guestSessionCall?.[1]?.body))).toEqual({
            accessLinkId: 'link-1',
            firstName: 'Guest learner',
            lastName: 'Learner',
            termsAccepted: true,
            privacyAccepted: true
        })
        const idempotencyKey = new Headers(guestSessionCall?.[1]?.headers).get('Idempotency-Key')
        expect(idempotencyKey).toMatch(/^[A-Za-z0-9_-]{43}$/u)
        expect(window.sessionStorage.getItem('apps-template-mui:guest-intake-idempotency:app-1:link-1')).toBeNull()
        expect(window.localStorage.getItem('apps-template-mui:guest-intake-idempotency:app-1:link-1')).toBeNull()
    })

    it('keeps a global-link workspace scope in API requests and isolates browser session state', async () => {
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' workspaceId={workspaceId} locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        expect(
            vi
                .mocked(globalThis.fetch)
                .mock.calls.some(([input]) =>
                    String(input).endsWith(`/public/a/app-1/links/demo-content?locale=en&workspaceId=${workspaceId}`)
                )
        ).toBe(true)
        expect(window.location.search).not.toContain(workspaceId)

        fillGuestIntake('Scoped learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))
        await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())

        const guestSessionCall = vi
            .mocked(globalThis.fetch)
            .mock.calls.find(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))
        expect(JSON.parse(String(guestSessionCall?.[1]?.body))).toMatchObject({
            accessLinkId: 'link-1',
            workspaceId,
            firstName: 'Scoped learner',
            lastName: 'Learner'
        })
        expect(window.sessionStorage.getItem(`apps-template-mui:guest-session:app-1:demo-content:${workspaceId}`)).toContain('student-1')
    })

    it('pins the guest-link lookup to the immutable access-link identity for global short links', async () => {
        const accessLinkId = '018f8a78-7b8f-7c1d-a111-222233334420'
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' accessLinkId={accessLinkId} locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        const linkRequest = vi
            .mocked(globalThis.fetch)
            .mock.calls.find(([input]) => String(input).includes('/public/a/app-1/links/demo-content?'))
        expect(linkRequest).toBeDefined()
        expect(new URL(String(linkRequest?.[0]), 'http://localhost').searchParams.get('accessLinkId')).toBe(accessLinkId)
    })

    it('keeps retries stable across reloads and isolates idempotency keys by tab', async () => {
        const originalSessionStorage = window.sessionStorage
        const tabAStorage = createTabSessionStorage()
        const tabBStorage = createTabSessionStorage()
        const storageKey = 'apps-template-mui:guest-intake-idempotency:app-1:link-1'
        const defaultFetch = vi.mocked(globalThis.fetch).getMockImplementation()
        if (!defaultFetch) throw new Error('Expected the default GuestApp fetch mock')
        const requestKeys: string[] = []
        let guestRequestCount = 0

        vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith('/public/a/app-1/guest-session')) {
                requestKeys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '')
                guestRequestCount += 1
                if (guestRequestCount <= 2) throw new TypeError('Network request failed')
            }
            return defaultFetch(input, init)
        })

        const renderGuestApp = () =>
            render(
                <QueryClientProvider client={createQueryClient()}>
                    <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
                </QueryClientProvider>
            )
        const selectTabStorage = (storage: Storage) =>
            Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage })

        try {
            selectTabStorage(tabAStorage)
            const firstTab = renderGuestApp()
            expect(await screen.findByText('Demo content')).toBeInTheDocument()
            fillGuestIntake('Guest learner')
            clickStartLearning()
            await waitFor(() => expect(requestKeys).toHaveLength(1))
            expect(await screen.findByRole('alert')).toBeInTheDocument()
            const tabAKey = tabAStorage.getItem(storageKey)
            expect(tabAKey).toMatch(/^[A-Za-z0-9_-]{43}$/u)
            expect(window.localStorage.getItem(storageKey)).toBeNull()
            firstTab.unmount()

            selectTabStorage(tabBStorage)
            const secondTab = renderGuestApp()
            expect(await screen.findByText('Demo content')).toBeInTheDocument()
            fillGuestIntake('Guest learner')
            clickStartLearning()
            expect(await screen.findByRole('alert')).toBeInTheDocument()
            const tabBKey = tabBStorage.getItem(storageKey)
            expect(tabBKey).toMatch(/^[A-Za-z0-9_-]{43}$/u)
            expect(tabBKey).not.toBe(tabAKey)
            secondTab.unmount()

            selectTabStorage(tabAStorage)
            renderGuestApp()
            expect(await screen.findByText('Demo content')).toBeInTheDocument()
            fillGuestIntake('Guest learner')
            clickStartLearning()
            await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())

            expect(requestKeys).toEqual([tabAKey, tabBKey, tabAKey])
            expect(tabAStorage.getItem(storageKey)).toBeNull()
        } finally {
            Object.defineProperty(window, 'sessionStorage', { configurable: true, value: originalSessionStorage })
        }
    })

    it('collects configured contact fields and verifies CAPTCHA before guest intake', async () => {
        guestTestState.guestIntakePolicy = {
            showFirstName: true,
            requireFirstName: true,
            showLastName: true,
            requireLastName: true,
            showEmail: true,
            requireEmail: true,
            showPhone: true,
            requirePhone: true,
            captchaEnabled: true
        }
        guestTestState.guestCaptchaConfig = { enabled: true, siteKey: 'public-site-key', testMode: false }
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        await waitFor(() => {
            expect(queryClient.getQueryData(['guest-link', 'app-1', 'demo-content', null, null, 'en', null])).toMatchObject({
                intake: { showEmail: true, requireEmail: true, showPhone: true, requirePhone: true, captchaEnabled: true }
            })
        })
        expect(await screen.findByLabelText(/Email address/)).toBeInTheDocument()
        expect(screen.getByLabelText(/Phone number/)).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'not-an-email' } })
        fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '+1 555 0100' } })
        expect(screen.getByRole('button', { name: 'Start learning' })).toBeDisabled()
        expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
        expect(
            (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls.some(([input]) =>
                String(input).endsWith('/public/a/app-1/guest-session')
            )
        ).toBe(false)
        fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: 'learner@example.test' } })
        expect(screen.getByRole('button', { name: 'Start learning' })).toBeDisabled()
        fireEvent.click(await screen.findByRole('button', { name: 'Mock CAPTCHA challenge' }))
        expect(screen.getByRole('button', { name: 'Start learning' })).toBeEnabled()
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())
        const guestSessionCall = (
            globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }
        ).mock.calls.find(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))
        expect(JSON.parse(String(guestSessionCall?.[1]?.body))).toEqual({
            accessLinkId: 'link-1',
            firstName: 'Guest learner',
            lastName: 'Learner',
            email: 'learner@example.test',
            phone: '+1 555 0100',
            termsAccepted: true,
            privacyAccepted: true,
            captchaToken: 'guest-captcha-token'
        })
    })

    it.each([
        { locale: 'en', captchaLabel: enApps.guest.captcha, retryError: enApps.guest.errors.captchaRetry },
        { locale: 'ru', captchaLabel: ruApps.guest.captcha, retryError: ruApps.guest.errors.captchaRetry }
    ])('remounts CAPTCHA and requires a fresh token after a rejected $locale submission', async ({ locale, captchaLabel, retryError }) => {
        i18nState.locale = locale
        guestTestState.guestIntakePolicy = {
            showFirstName: true,
            requireFirstName: true,
            showLastName: true,
            requireLastName: true,
            showEmail: false,
            requireEmail: false,
            showPhone: false,
            requirePhone: false,
            captchaEnabled: true
        }
        guestTestState.guestCaptchaConfig = { enabled: true, siteKey: 'public-site-key', testMode: false }
        guestTestState.guestCaptchaTokenQueue = ['captcha-token-first', 'captcha-token-retry']

        const defaultFetch = vi.mocked(globalThis.fetch).getMockImplementation()
        if (!defaultFetch) throw new Error('Expected the default GuestApp fetch mock')
        const sessionBodies: Array<Record<string, unknown>> = []
        let sessionRequestCount = 0
        vi.mocked(globalThis.fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            if (String(input).endsWith('/public/a/app-1/guest-session')) {
                sessionBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
                sessionRequestCount += 1
                if (sessionRequestCount === 1) {
                    return { ok: false, status: 400, json: async () => ({}) } as Response
                }
            }
            return defaultFetch(input, init)
        })

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale={locale} apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        const initialCaptchaButton = await screen.findByRole('button', { name: 'Mock CAPTCHA challenge' })
        fireEvent.click(initialCaptchaButton)
        fireEvent.click(screen.getByRole('button', { name: guestTranslations[locale]['guest.start'] }))

        expect(await screen.findByText(retryError)).toBeInTheDocument()
        const captchaGroup = screen.getByRole('group', { name: captchaLabel })
        expect(captchaGroup).toHaveAttribute('aria-describedby', 'guest-captcha-error')
        expect(document.getElementById('guest-captcha-error')).toHaveTextContent(retryError)
        await waitFor(() => expect(screen.getByRole('button', { name: 'Mock CAPTCHA challenge' })).not.toBe(initialCaptchaButton))

        fireEvent.click(screen.getByRole('button', { name: 'Mock CAPTCHA challenge' }))
        fireEvent.click(screen.getByRole('button', { name: guestTranslations[locale]['guest.start'] }))

        await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())
        expect(sessionBodies.map((body) => body.captchaToken)).toEqual(['captcha-token-first', 'captcha-token-retry'])
    })

    it('requires both names and both legal consents before creating a session', async () => {
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')

        const startButton = screen.getByRole('button', { name: 'Start learning' })
        expect(startButton).toBeDisabled()
        fireEvent.submit(startButton.closest('form')!)
        expect(screen.getByLabelText(/First name/)).toHaveFocus()
        expect(screen.getByText('Enter your first name.')).toBeInTheDocument()
        expect(screen.getByText('Enter your last name.')).toBeInTheDocument()
        expect(screen.getByText('Accept the Terms of Service to continue.')).toBeInTheDocument()
        expect(screen.getByText('Accept the Privacy Policy to continue.')).toBeInTheDocument()
        expect(
            (globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls.some(([input]) =>
                String(input).endsWith('/public/a/app-1/guest-session')
            )
        ).toBe(false)

        fillGuestIntake('Ada', 'Lovelace')
        clickStartLearning()
        await waitFor(() => expect(screen.getByText('Content title')).toBeInTheDocument())
    })

    it('shows localized Russian errors for missing names and legal consents before creating a guest session', async () => {
        i18nState.locale = 'ru'
        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='ru' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        const startButton = screen.getByRole('button', { name: guestTranslations.ru['guest.start'] })
        fireEvent.submit(startButton.closest('form')!)

        expect(screen.getByLabelText(/^Имя/u)).toHaveFocus()
        expect(screen.getByText(guestTranslations.ru['guest.errors.firstNameRequired'])).toBeInTheDocument()
        expect(screen.getByText(guestTranslations.ru['guest.errors.lastNameRequired'])).toBeInTheDocument()
        expect(screen.getByText(guestTranslations.ru['guest.errors.termsRequired'])).toBeInTheDocument()
        expect(screen.getByText(guestTranslations.ru['guest.errors.privacyRequired'])).toBeInTheDocument()
        expect(vi.mocked(globalThis.fetch).mock.calls.some(([input]) => String(input).endsWith('/public/a/app-1/guest-session'))).toBe(
            false
        )
    })

    it('loads the published guest copy from both supported locale resources', () => {
        expect(enApps.guest.termsLink).toBe('Terms of Service')
        expect(enApps.guest.privacyLink).toBe('Privacy Policy')
        expect(enApps.guest.quizTimeLimit).toContain('{{minutes}}')
        expect(enApps.guest.quizPassed).toBe('Passed')
        expect(enApps.guest.quizNotPassed).toBe('Not passed')
        expect(enApps.guest.quizRevokedResult).toContain('access link was revoked')
        expect(enApps.reports.booleanValues).toEqual({ yes: 'Yes', no: 'No' })
        expect(ruApps.guest.termsLink).toBe('Пользовательское соглашение')
        expect(ruApps.guest.privacyLink).toBe('Политику конфиденциальности')
        expect(ruApps.guest.quizTimeLimit).toContain('{{minutes}}')
        expect(ruApps.guest.quizPassed).toBe('Пройдено')
        expect(ruApps.guest.quizNotPassed).toBe('Не пройдено')
        expect(ruApps.guest.quizRevokedResult).toContain('ссылка доступа была отозвана')
        expect(ruApps.reports.booleanValues).toEqual({ yes: 'Да', no: 'Нет' })
    })

    it.each([
        { locale: 'en', passed: true, expectedStatus: enApps.guest.quizPassed, severity: 'Success', nested: false },
        { locale: 'en', passed: false, expectedStatus: enApps.guest.quizNotPassed, severity: 'Error', nested: false },
        { locale: 'en', passed: null, expectedStatus: null, severity: 'Info', nested: false },
        { locale: 'ru', passed: true, expectedStatus: ruApps.guest.quizPassed, severity: 'Success', nested: true },
        { locale: 'ru', passed: false, expectedStatus: ruApps.guest.quizNotPassed, severity: 'Error', nested: false },
        { locale: 'ru', passed: undefined, expectedStatus: null, severity: 'Info', nested: false }
    ])('renders the $locale quiz result with $severity severity', async ({ locale, passed, expectedStatus, severity, nested }) => {
        i18nState.locale = locale
        const serverResult: Record<string, unknown> = { score: 1, total: 2, finishedReason: 'submitted' }
        if (nested) {
            serverResult.result = { passed }
        } else if (passed !== undefined) {
            serverResult.passed = passed
        }
        guestTestState.guestFinalizeResponse = {
            attemptId: 'attempt-1',
            status: 'completed',
            result: serverResult,
            completionText: 'Well done.'
        }

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale={locale} apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )
        await completeGuestQuiz()

        const translations = guestTranslations[locale as keyof typeof guestTranslations]
        const scoreText = translations['guest.quizScore'].replace('{{score}}', '1').replace('{{total}}', '2')
        const resultAlert = screen.getByText(scoreText).closest('[role="status"]')
        expect(resultAlert).toHaveClass(`MuiAlert-color${severity}`)
        if (expectedStatus) {
            expect(resultAlert).toHaveTextContent(expectedStatus)
        } else {
            expect(resultAlert).not.toHaveTextContent(/Passed|Not passed|Пройдено|Не пройдено/)
        }
    })

    it.each([
        { locale: 'en', copy: enApps.guest.quizRevokedResult },
        { locale: 'ru', copy: ruApps.guest.quizRevokedResult }
    ])('renders a neutral localized revoked completion notice in $locale', async ({ locale, copy }) => {
        i18nState.locale = locale
        window.sessionStorage.setItem(
            'apps-template-mui:guest-session:app-1:demo-content',
            JSON.stringify({ participantId: 'student-1', sessionToken: 'token-1' })
        )
        window.sessionStorage.setItem('apps-template-mui:guest-attempt:app-1:demo-content:student-1:quiz-1', 'attempt-revoked')

        const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
            const url = String(input)
            if (url.includes(`/public/a/app-1/links/demo-content?locale=${locale}`)) {
                const headers = new Headers(init?.headers)
                expect(headers.get('X-Guest-Participant-Id')).toBe('student-1')
                expect(headers.get('X-Guest-Session-Token')).toBe('token-1')
                return {
                    ok: true,
                    json: async () => ({ id: 'link-1', title: 'Demo quiz', targetType: 'quiz', targetId: 'quiz-1' })
                } as Response
            }
            if (url.includes('/public/a/app-1/runtime?')) {
                return {
                    ok: true,
                    json: async () => ({ type: 'quiz', id: 'quiz-1', title: 'Quiz title', questionCount: 0, questions: [] })
                } as Response
            }
            if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/attempt-revoked') {
                expect(new URL(url, 'http://localhost').searchParams.has('participantId')).toBe(false)
                const headers = new Headers(init?.headers)
                expect(headers.get('X-Guest-Participant-Id')).toBe('student-1')
                expect(headers.get('X-Guest-Session-Token')).toBe('token-1')
                return {
                    ok: true,
                    json: async () =>
                        makeGuestAttemptDto({
                            attemptId: 'attempt-revoked',
                            status: 'completed',
                            result: { result: { passed: null, finishedReason: 'revoked' } }
                        })
                } as Response
            }
            throw new Error(`Unexpected fetch request: ${url}`)
        })
        vi.stubGlobal('fetch', fetchMock)

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale={locale} apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(
            await screen.findByRole('heading', { name: locale === 'en' ? enApps.guest.quizResultTitle : ruApps.guest.quizResultTitle })
        ).toBeInTheDocument()
        const revokedNotice = await screen.findByText(copy)
        expect(revokedNotice.closest('[role="status"]')).toHaveClass('MuiAlert-colorInfo')
        expect(screen.queryByText(/Correct answers|Правильных ответов/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Passed|Not passed|Пройдено|Не пройдено/)).not.toBeInTheDocument()
    })

    it('sanitizes public guest link errors before rendering alerts', async () => {
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
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
                throw new Error(`SQL relation public_links does not exist for ${leakedUuid}`)
            })
        )

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Access link was not found or is no longer active.')).toBeInTheDocument()
        expect(screen.queryByText(new RegExp(leakedUuid, 'i'))).not.toBeInTheDocument()
        expect(screen.queryByText(/SQL relation|public_links/i)).not.toBeInTheDocument()
    })

    it('sanitizes public guest session creation errors before rendering alerts', async () => {
        const leakedUuid = '018f8a78-7b8f-7c1d-a111-2222333346ff'
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
                            title: 'Demo content',
                            targetType: 'content',
                            targetId: 'content-1'
                        })
                    } as Response
                }
                if (url.endsWith('/public/a/app-1/guest-session')) {
                    throw new Error(`SQL relation guest_sessions does not exist for ${leakedUuid}`)
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()
        fillGuestIntake('Guest learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        expect(await screen.findByText('Failed to create guest session.')).toBeInTheDocument()
        expect(screen.queryByText(new RegExp(leakedUuid, 'i'))).not.toBeInTheDocument()
        expect(screen.queryByText(/SQL relation|guest_sessions/i)).not.toBeInTheDocument()
    })

    it('sanitizes public runtime load errors before rendering alerts', async () => {
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
                            title: 'Demo content',
                            targetType: 'content',
                            targetId: 'content-1'
                        })
                    } as Response
                }
                if (url.includes('/public/a/app-1/runtime?')) {
                    throw new Error(`SQL relation public_runtime does not exist for ${leakedUuid}`)
                }
                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        render(
            <QueryClientProvider client={createQueryClient()}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Failed to load public learning content.')).toBeInTheDocument()
        expect(screen.queryByText(new RegExp(leakedUuid, 'i'))).not.toBeInTheDocument()
        expect(screen.queryByText(/SQL relation|public_runtime/i)).not.toBeInTheDocument()
    })
})
