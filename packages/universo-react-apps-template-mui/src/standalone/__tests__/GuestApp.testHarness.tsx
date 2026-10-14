import type { ReactNode } from 'react'
import { expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider as QueryClientProviderComponent } from '@tanstack/react-query'
import {
    fireEvent as fireEventApi,
    render as renderComponent,
    screen as screenApi,
    waitFor as waitForComponent
} from '@testing-library/react'
import enAppsJson from '../../i18n/locales/en/apps.json'
import ruAppsJson from '../../i18n/locales/ru/apps.json'
import GuestAppComponent from '../GuestApp'

export const GuestApp = GuestAppComponent
export const enApps = enAppsJson
export const ruApps = ruAppsJson
export const QueryClientProvider = QueryClientProviderComponent
export const fireEvent = fireEventApi
export const render = renderComponent
export const screen = screenApi
export const waitFor = waitForComponent

export const getRequestPathname = (input: RequestInfo | URL) => {
    const pathname = new URL(String(input), 'http://localhost').pathname
    return pathname.startsWith('/api/v1/') ? pathname.slice('/api/v1'.length) : pathname
}

const i18nMockState = vi.hoisted(() => ({
    locale: 'en'
}))
export const i18nState = i18nMockState

const guestMockState = vi.hoisted(() => ({
    deferGuestAnswerResponse: false,
    releaseGuestAnswerResponse: null,
    guestAnswerResponseOverride: null,
    guestSessionUnavailable: false,
    guestSavedAnswerIds: [],
    guestRuntimeMaxAttempts: 3,
    guestConfirmAnswerBeforeNext: false,
    guestDirectQuizLink: false,
    guestAttemptNumber: 1,
    guestAttemptStartCalls: 0,
    guestAttemptStartObserver: null,
    guestAttemptStartResponses: [],
    guestFinalizeResponse: {
        attemptId: 'attempt-1',
        attemptNumber: 1,
        status: 'completed',
        result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
        completionText: 'Well done.'
    },
    guestIntakePolicy: {
        showFirstName: true,
        requireFirstName: true,
        showLastName: true,
        requireLastName: true,
        showEmail: false,
        requireEmail: false,
        showPhone: false,
        requirePhone: false,
        captchaEnabled: false
    },
    guestCaptchaConfig: { enabled: false, siteKey: null as string | null, testMode: false },
    guestCaptchaTokenQueue: [] as string[]
})) as {
    deferGuestAnswerResponse: boolean
    releaseGuestAnswerResponse: (() => void) | null
    guestAnswerResponseOverride: { ok: boolean; payload: unknown } | null
    guestSessionUnavailable: boolean
    guestSavedAnswerIds: string[]
    guestRuntimeMaxAttempts: unknown
    guestConfirmAnswerBeforeNext: boolean
    guestDirectQuizLink: boolean
    guestAttemptNumber: number
    guestAttemptStartCalls: number
    guestAttemptStartObserver: (() => void) | null
    guestAttemptStartResponses: Array<{ ok: boolean; status: number; payload: unknown } | null>
    guestFinalizeResponse: Record<string, unknown>
    guestIntakePolicy: {
        requireFirstName: boolean
        requireLastName: boolean
        requireEmail: boolean
        requirePhone: boolean
        captchaEnabled: boolean
    }
    guestCaptchaConfig: { enabled: boolean; siteKey: string | null; testMode: boolean }
    guestCaptchaTokenQueue: string[]
}
export const guestTestState = guestMockState

export const guestTranslations = {
    en: {
        'guest.firstName': 'First name',
        'guest.lastName': 'Last name',
        'guest.captcha': enApps.guest.captcha,
        'guest.errors.captchaRetry': enApps.guest.errors.captchaRetry,
        'guest.termsConsent': 'I agree to the',
        'guest.termsLink': 'Terms of Service',
        'guest.privacyConsent': 'I have read and accept the',
        'guest.privacyLink': 'Privacy Policy',
        'guest.start': 'Start learning',
        'guest.loadingLink': 'Loading access link...',
        'guest.next': 'Next',
        'guest.openQuiz': 'Open quiz',
        'guest.quizAttemptStarting': 'Loading your quiz attempt...',
        'guest.quizAttemptResumed': 'Your saved quiz attempt has been restored. Continue with the next unanswered question.',
        'guest.quizTimeLimit': 'You have {{minutes}} minutes to complete this quiz.',
        'guest.quizNoTimeLimit': 'There is no time limit for this quiz.',
        'guest.quizTimedOutResult': 'Time expired. Your saved answers were scored.',
        'guest.quizTimeRemaining': 'Time remaining',
        'guest.quizProgress': 'Question {{current}} of {{total}}',
        'guest.quizSelectAnswer': 'Choose an answer to continue.',
        'guest.quizKeyboardSubmitHint': enApps.guest.quizKeyboardSubmitHint,
        'guest.quizChooseAnswerToConfirm': enApps.guest.quizChooseAnswerToConfirm,
        'guest.quizAnswerSelectedToConfirm': enApps.guest.quizAnswerSelectedToConfirm,
        'guest.quizSubmitAnswer': enApps.guest.quizSubmitAnswer,
        'guest.savingAnswer': 'Saving answer...',
        'guest.syncingQuizAttempt': 'Checking your saved progress...',
        'guest.retryAnswerSave': 'Retry saving answer',
        'guest.finishingQuiz': 'Finishing quiz...',
        'guest.retryQuizFinish': 'Retry finishing the quiz',
        'guest.quizTimeExpired': 'Time is up. Your saved answers are being finalized.',
        'guest.quizAllAnswersSaved': 'All answers are saved. Your result is being prepared.',
        'guest.quizResultTitle': enApps.guest.quizResultTitle,
        'guest.quizScore': enApps.guest.quizScore,
        'guest.quizPassed': enApps.guest.quizPassed,
        'guest.quizNotPassed': enApps.guest.quizNotPassed,
        'guest.retryQuiz': enApps.guest.retryQuiz,
        'guest.quizRevokedResult': enApps.guest.quizRevokedResult,
        'guest.backToContent': 'Back to content',
        'guest.completeContent': 'Complete content',
        'guest.contentCompleted': 'Content complete. Progress has been recorded for this session.',
        'guest.restartContent': 'Restart content',
        'guest.errors.linkNotFound': 'Access link was not found or is no longer active.',
        'guest.errors.sessionCreate': 'Failed to create guest session.',
        'guest.errors.sessionMissing': 'Guest session is required to continue this quiz.',
        'guest.errors.quizAttemptUnavailable': enApps.guest.errors.quizAttemptUnavailable,
        'guest.errors.firstNameRequired': 'Enter your first name.',
        'guest.errors.lastNameRequired': 'Enter your last name.',
        'guest.errors.emailInvalid': 'Enter a valid email address.',
        'guest.errors.termsRequired': 'Accept the Terms of Service to continue.',
        'guest.errors.privacyRequired': 'Accept the Privacy Policy to continue.',
        'guest.errors.runtimeLoad': 'Failed to load public learning content.',
        'guest.errors.quizAttemptStart': 'Failed to start the quiz.',
        'guest.errors.quizAttemptLoad': 'Failed to load or resume your quiz attempt.',
        'guest.errors.quizAnswerSave': 'Failed to save your answer.',
        'guest.errors.quizFinalize': 'Failed to finish the quiz.'
    },
    ru: {
        'guest.firstName': 'Имя',
        'guest.lastName': 'Фамилия',
        'guest.captcha': ruApps.guest.captcha,
        'guest.errors.captchaRetry': ruApps.guest.errors.captchaRetry,
        'guest.termsConsent': 'Я принимаю',
        'guest.termsLink': 'Пользовательское соглашение',
        'guest.privacyConsent': 'Я принимаю',
        'guest.privacyLink': 'Политику конфиденциальности',
        'guest.start': 'Начать обучение',
        'guest.loadingLink': 'Загрузка ссылки доступа...',
        'guest.next': 'Далее',
        'guest.openQuiz': 'Открыть тест',
        'guest.quizAttemptStarting': 'Загрузка попытки теста...',
        'guest.quizAttemptResumed': 'Сохранённая попытка восстановлена. Продолжайте со следующего вопроса без ответа.',
        'guest.quizTimeLimit': 'На прохождение теста отведено {{minutes}} мин.',
        'guest.quizNoTimeLimit': 'Для этого теста ограничение по времени не установлено.',
        'guest.quizTimedOutResult': 'Время вышло. Сохранённые ответы учтены при подсчёте результата.',
        'guest.quizTimeRemaining': 'Осталось времени',
        'guest.quizProgress': 'Вопрос {{current}} из {{total}}',
        'guest.quizSelectAnswer': 'Выберите ответ, чтобы продолжить.',
        'guest.quizKeyboardSubmitHint': ruApps.guest.quizKeyboardSubmitHint,
        'guest.quizChooseAnswerToConfirm': ruApps.guest.quizChooseAnswerToConfirm,
        'guest.quizAnswerSelectedToConfirm': ruApps.guest.quizAnswerSelectedToConfirm,
        'guest.quizSubmitAnswer': ruApps.guest.quizSubmitAnswer,
        'guest.savingAnswer': 'Сохранение ответа...',
        'guest.syncingQuizAttempt': 'Проверяем сохранённый прогресс...',
        'guest.retryAnswerSave': 'Повторить сохранение ответа',
        'guest.finishingQuiz': 'Завершение теста...',
        'guest.retryQuizFinish': 'Повторить завершение теста',
        'guest.quizTimeExpired': 'Время вышло. Сохранённые ответы отправляются на проверку.',
        'guest.quizAllAnswersSaved': 'Ответы сохранены. Подготавливаем результат.',
        'guest.quizResultTitle': ruApps.guest.quizResultTitle,
        'guest.quizScore': ruApps.guest.quizScore,
        'guest.quizPassed': ruApps.guest.quizPassed,
        'guest.quizNotPassed': ruApps.guest.quizNotPassed,
        'guest.retryQuiz': ruApps.guest.retryQuiz,
        'guest.quizRevokedResult': ruApps.guest.quizRevokedResult,
        'guest.backToContent': 'Назад к контенту',
        'guest.completeContent': 'Завершить контент',
        'guest.contentCompleted': 'Контент завершён. Прогресс записан для этой сессии.',
        'guest.restartContent': 'Пройти контент заново',
        'guest.errors.linkNotFound': 'Ссылка доступа не найдена или больше не активна.',
        'guest.errors.sessionCreate': 'Не удалось создать гостевую сессию.',
        'guest.errors.sessionMissing': 'Для продолжения теста нужна гостевая сессия.',
        'guest.errors.quizAttemptUnavailable': ruApps.guest.errors.quizAttemptUnavailable,
        'guest.errors.firstNameRequired': 'Введите имя.',
        'guest.errors.lastNameRequired': 'Введите фамилию.',
        'guest.errors.emailInvalid': 'Введите корректный адрес электронной почты.',
        'guest.errors.termsRequired': 'Примите Пользовательское соглашение, чтобы продолжить.',
        'guest.errors.privacyRequired': 'Примите Политику конфиденциальности, чтобы продолжить.',
        'guest.errors.runtimeLoad': 'Не удалось загрузить публичный учебный контент.',
        'guest.errors.quizAttemptStart': 'Не удалось начать тест.',
        'guest.errors.quizAttemptLoad': 'Не удалось загрузить или восстановить попытку теста.',
        'guest.errors.quizAnswerSave': 'Не удалось сохранить ответ.',
        'guest.errors.quizFinalize': 'Не удалось завершить тест.'
    }
} as const

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
            const dictionary = guestTranslations[i18nMockState.locale as keyof typeof guestTranslations] ?? guestTranslations.en
            const translated = dictionary[_key as keyof typeof dictionary]
            if (translated) {
                if (fallbackOrOptions && typeof fallbackOrOptions === 'object') {
                    return Object.entries(fallbackOrOptions).reduce((output, [key, value]) => {
                        return key === 'defaultValue' ? output : output.replaceAll(`{{${key}}}`, String(value))
                    }, translated)
                }
                return translated
            }
            if (typeof fallbackOrOptions === 'string') {
                return fallbackOrOptions
            }
            if (fallbackOrOptions && typeof fallbackOrOptions === 'object' && 'defaultValue' in fallbackOrOptions) {
                return Object.entries(fallbackOrOptions).reduce((output, [key, value]) => {
                    return key === 'defaultValue' ? output : output.replaceAll(`{{${key}}}`, String(value))
                }, String(fallbackOrOptions.defaultValue))
            }
            return _key
        }
    })
}))

vi.mock('@yandex/smart-captcha', () => ({
    SmartCaptcha: ({ onSuccess }: { onSuccess: (token: string) => void }) => (
        <button type='button' onClick={() => onSuccess(guestMockState.guestCaptchaTokenQueue.shift() ?? 'guest-captcha-token')}>
            Mock CAPTCHA challenge
        </button>
    )
}))

export const fillGuestIntake = (firstName = 'Guest', lastName = 'Learner') => {
    const translations = guestTranslations[i18nState.locale as keyof typeof guestTranslations] ?? guestTranslations.en
    fireEvent.change(screen.getByLabelText(new RegExp(translations['guest.firstName'])), { target: { value: firstName } })
    fireEvent.change(screen.getByLabelText(new RegExp(translations['guest.lastName'])), { target: { value: lastName } })
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(translations['guest.termsLink']) }))
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(translations['guest.privacyLink']) }))
}

export const clickStartLearning = () => {
    const translations = guestTranslations[i18nState.locale as keyof typeof guestTranslations] ?? guestTranslations.en
    fireEvent.click(screen.getByRole('button', { name: translations['guest.start'] }))
}

export const completeGuestQuiz = async () => {
    const translations = guestTranslations[i18nState.locale as keyof typeof guestTranslations] ?? guestTranslations.en
    expect(await screen.findByText('Demo content')).toBeInTheDocument()
    fillGuestIntake()
    clickStartLearning()
    expect(await screen.findByText('Content title')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: translations['guest.next'] }))
    expect(await screen.findByText('Knowledge check')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: translations['guest.openQuiz'] }))
    expect(await screen.findByRole('heading', { name: 'Question prompt' })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Correct option'))
    expect(await screen.findByRole('heading', { name: 'Second question' })).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Second option'))
    expect(await screen.findByRole('heading', { name: translations['guest.quizResultTitle'] })).toBeInTheDocument()
}

export const createTabSessionStorage = (): Storage => {
    const values = new Map<string, string>()
    return {
        get length() {
            return values.size
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, String(value))
    } as Storage
}

vi.mock('../../layouts/AppMainLayout', () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}))

export const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

export const readGuestProgressRequestBodies = () =>
    ((globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL, RequestInit?]> } }).mock.calls ?? [])
        .filter(([input]) => String(input).endsWith('/public/a/app-1/runtime/guest-progress'))
        .map(([, init]) => JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)

export const resetGuestAppTestHarness = () => {
    vi.clearAllMocks()
    i18nState.locale = 'en'
    guestTestState.deferGuestAnswerResponse = false
    guestTestState.releaseGuestAnswerResponse = null
    guestTestState.guestAnswerResponseOverride = null
    guestTestState.guestSessionUnavailable = false
    guestTestState.guestSavedAnswerIds = []
    guestTestState.guestRuntimeMaxAttempts = 3
    guestTestState.guestConfirmAnswerBeforeNext = false
    guestTestState.guestDirectQuizLink = false
    guestTestState.guestAttemptNumber = 1
    guestTestState.guestAttemptStartCalls = 0
    guestTestState.guestAttemptStartObserver = null
    guestTestState.guestAttemptStartResponses = []
    guestTestState.guestFinalizeResponse = {
        attemptId: 'attempt-1',
        attemptNumber: 1,
        status: 'completed',
        result: { score: 1, total: 2, passed: false, finishedReason: 'submitted' },
        completionText: 'Well done.'
    }
    guestTestState.guestIntakePolicy = {
        showFirstName: true,
        requireFirstName: true,
        showLastName: true,
        requireLastName: true,
        showEmail: false,
        requireEmail: false,
        showPhone: false,
        requirePhone: false,
        captchaEnabled: false
    }
    guestTestState.guestCaptchaConfig = { enabled: false, siteKey: null, testMode: false }
    guestTestState.guestCaptchaTokenQueue = []
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')

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

            if (url.endsWith('/api/v1/auth/captcha-config')) {
                return {
                    ok: true,
                    json: async () => ({ guest: guestTestState.guestCaptchaConfig })
                } as Response
            }

            if (
                url.includes('/public/a/app-1/links/demo-content?locale=en') ||
                url.includes('/public/a/app-1/links/demo-content?locale=ru')
            ) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'link-1',
                        title: 'Demo content',
                        targetType: guestTestState.guestDirectQuizLink ? 'quiz' : 'content',
                        targetId: guestTestState.guestDirectQuizLink ? 'quiz-1' : 'content-1',
                        intake: guestTestState.guestIntakePolicy
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

            if (
                url.includes('/public/a/app-1/runtime?') &&
                url.includes('slug=demo-content') &&
                ((url.includes('targetType=quiz') && url.includes('targetId=quiz-1')) ||
                    (guestTestState.guestDirectQuizLink && !url.includes('targetType='))) &&
                (url.includes('locale=en') || url.includes('locale=ru'))
            ) {
                return {
                    ok: true,
                    json: async () => ({
                        type: 'quiz',
                        id: 'quiz-1',
                        title: 'Quiz title',
                        maxAttempts: guestTestState.guestRuntimeMaxAttempts,
                        confirmAnswerBeforeNext: guestTestState.guestConfirmAnswerBeforeNext,
                        timeLimitSeconds: 2700,
                        questionCount: 2,
                        questions: []
                    })
                } as Response
            }

            if (
                url.includes('/public/a/app-1/runtime?') &&
                url.includes('slug=demo-content') &&
                (url.includes('locale=en') || url.includes('locale=ru'))
            ) {
                return {
                    ok: true,
                    json: async () => ({
                        type: 'content',
                        id: 'content-1',
                        title: 'Content title',
                        description: 'Content description',
                        contentItems: [
                            {
                                id: 'item-1',
                                itemType: 'text',
                                itemTitle: 'Intro',
                                itemContent: 'Content body',
                                sortOrder: 0
                            },
                            {
                                id: 'item-2',
                                itemType: 'quiz_ref',
                                itemTitle: 'Knowledge check',
                                quizId: 'quiz-1',
                                sortOrder: 1
                            }
                        ]
                    })
                } as Response
            }

            if (url.endsWith('/public/a/app-1/runtime/guest-progress')) {
                return {
                    ok: true,
                    json: async () => ({ ok: true })
                } as Response
            }

            if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/start') {
                guestTestState.guestAttemptStartCalls += 1
                guestTestState.guestAttemptStartObserver?.()
                const customResponse = guestTestState.guestAttemptStartResponses.shift()
                if (customResponse) {
                    return {
                        ok: customResponse.ok,
                        status: customResponse.status,
                        json: async () => customResponse.payload
                    } as Response
                }
                return {
                    ok: true,
                    json: async () => ({
                        attemptId: 'attempt-1',
                        attemptNumber: guestTestState.guestAttemptNumber,
                        deadlineAt: '2030-01-01T00:45:00.000Z',
                        serverNow: '2030-01-01T00:00:00.000Z',
                        status: 'in_progress',
                        currentQuestionIndex: 0,
                        totalQuestions: 2,
                        answeredCount: 0,
                        questions: [
                            {
                                id: 'question-1',
                                prompt: 'Question prompt',
                                options: [
                                    { id: 'option-1', label: 'Correct option' },
                                    { id: 'option-2', label: 'Wrong option' }
                                ]
                            }
                        ]
                    })
                } as Response
            }

            if (/^\/public\/a\/app-1\/runtime\/attempts\/[^/]+$/.test(getRequestPathname(url))) {
                if (guestTestState.guestSessionUnavailable) {
                    return {
                        ok: true,
                        json: async () => ({
                            attemptId: 'attempt-1',
                            attemptNumber: 1,
                            status: 'completed',
                            totalQuestions: 2,
                            answeredCount: 1,
                            questions: [],
                            result: { score: 1, total: 2, passed: false, finishedReason: 'revoked' }
                        })
                    } as Response
                }
                const answeredCount = guestTestState.guestSavedAnswerIds.length
                const questions = [
                    {
                        id: 'question-1',
                        prompt: 'Question prompt',
                        options: [
                            { id: 'option-1', label: 'Correct option' },
                            { id: 'option-2', label: 'Wrong option' }
                        ]
                    },
                    { id: 'question-2', prompt: 'Second question', options: [{ id: 'option-3', label: 'Second option' }] }
                ]
                return {
                    ok: true,
                    json: async () => ({
                        attemptId: 'attempt-1',
                        attemptNumber: guestTestState.guestAttemptNumber,
                        deadlineAt: '2030-01-01T00:45:00.000Z',
                        serverNow: '2030-01-01T00:00:00.000Z',
                        status: 'in_progress',
                        currentQuestionIndex: answeredCount,
                        totalQuestions: questions.length,
                        answeredCount,
                        questions: questions[answeredCount] ? [questions[answeredCount]] : []
                    })
                } as Response
            }

            if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/attempt-1/answers') {
                if (guestTestState.guestSessionUnavailable) {
                    return {
                        ok: false,
                        status: 403,
                        json: async () => ({ error: 'Guest session is invalid or expired' })
                    } as Response
                }
                if (guestTestState.deferGuestAnswerResponse) {
                    guestTestState.deferGuestAnswerResponse = false
                    await new Promise<void>((resolve) => {
                        guestTestState.releaseGuestAnswerResponse = resolve
                    })
                }
                if (guestTestState.guestAnswerResponseOverride) {
                    return {
                        ok: guestTestState.guestAnswerResponseOverride.ok,
                        json: async () => guestTestState.guestAnswerResponseOverride?.payload
                    } as Response
                }
                const requestBody = JSON.parse(String(init?.body ?? '{}')) as { questionId?: string }
                if (requestBody.questionId)
                    guestTestState.guestSavedAnswerIds = [...new Set([...guestTestState.guestSavedAnswerIds, requestBody.questionId])]
                const answeredCount = guestTestState.guestSavedAnswerIds.length
                const questions = [
                    {
                        id: 'question-1',
                        prompt: 'Question prompt',
                        options: [
                            { id: 'option-1', label: 'Correct option' },
                            { id: 'option-2', label: 'Wrong option' }
                        ]
                    },
                    { id: 'question-2', prompt: 'Second question', options: [{ id: 'option-3', label: 'Second option' }] }
                ]
                return {
                    ok: true,
                    json: async () => ({
                        ok: true,
                        attempt: {
                            attemptId: 'attempt-1',
                            attemptNumber: guestTestState.guestAttemptNumber,
                            deadlineAt: '2030-01-01T00:45:00.000Z',
                            serverNow: '2030-01-01T00:00:00.000Z',
                            status: 'in_progress',
                            currentQuestionIndex: answeredCount,
                            totalQuestions: questions.length,
                            answeredCount,
                            questions: questions[answeredCount] ? [questions[answeredCount]] : []
                        }
                    })
                } as Response
            }

            if (getRequestPathname(url) === '/public/a/app-1/runtime/attempts/attempt-1/finalize') {
                return {
                    ok: true,
                    json: async () => guestTestState.guestFinalizeResponse
                } as Response
            }

            throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
        })
    )
}
