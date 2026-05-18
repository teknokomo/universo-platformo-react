import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuestApp from '../GuestApp'

const i18nState = vi.hoisted(() => ({
    locale: 'en'
}))

const guestTranslations = {
    en: {
        'guest.displayName': 'Your name',
        'guest.start': 'Start learning',
        'guest.loadingLink': 'Loading access link...',
        'guest.next': 'Next',
        'guest.openQuiz': 'Open quiz',
        'guest.submitQuiz': 'Submit quiz',
        'guest.backToContent': 'Back to content',
        'guest.completeContent': 'Complete content',
        'guest.contentCompleted': 'Content complete. Progress has been recorded for this session.',
        'guest.restartContent': 'Restart content'
    },
    ru: {
        'guest.displayName': 'Ваше имя',
        'guest.start': 'Начать обучение',
        'guest.loadingLink': 'Загрузка ссылки доступа...',
        'guest.next': 'Далее',
        'guest.openQuiz': 'Открыть тест',
        'guest.submitQuiz': 'Отправить тест',
        'guest.backToContent': 'Назад к контенту',
        'guest.completeContent': 'Завершить контент',
        'guest.contentCompleted': 'Контент завершён. Прогресс записан для этой сессии.',
        'guest.restartContent': 'Пройти контент заново'
    }
} as const

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (_key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
            const dictionary = guestTranslations[i18nState.locale as keyof typeof guestTranslations] ?? guestTranslations.en
            const translated = dictionary[_key as keyof typeof dictionary]
            if (translated) {
                return translated
            }
            if (typeof fallbackOrOptions === 'string') {
                return fallbackOrOptions
            }
            if (fallbackOrOptions && typeof fallbackOrOptions === 'object' && 'defaultValue' in fallbackOrOptions) {
                return String(fallbackOrOptions.defaultValue)
                    .replace('{{score}}', String(fallbackOrOptions.score ?? ''))
                    .replace('{{total}}', String(fallbackOrOptions.total ?? ''))
            }
            return _key
        }
    })
}))

vi.mock('../../layouts/AppMainLayout', () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })

describe('GuestApp', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        i18nState.locale = 'en'
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

                if (
                    url.includes('/public/a/app-1/links/demo-content?locale=en') ||
                    url.includes('/public/a/app-1/links/demo-content?locale=ru')
                ) {
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

                if (
                    url.includes('/public/a/app-1/runtime?') &&
                    url.includes('slug=demo-content') &&
                    url.includes('targetType=quiz') &&
                    url.includes('targetId=quiz-1') &&
                    (url.includes('locale=en') || url.includes('locale=ru'))
                ) {
                    return {
                        ok: true,
                        json: async () => ({
                            type: 'quiz',
                            id: 'quiz-1',
                            title: 'Quiz title',
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

                if (url.endsWith('/public/a/app-1/runtime/guest-submit')) {
                    return {
                        ok: true,
                        json: async () => ({ score: 1, total: 1, passed: true })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
            })
        )
    })

    it('creates a guest session and renders public content', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
            expect(screen.getByText('Content body')).toBeInTheDocument()
        })

        expect(window.sessionStorage.getItem('apps-template-mui:guest-session:app-1:demo-content')).toContain('student-1')
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

        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner' } })
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

    it('re-resolves public path params when rendered without explicit props', async () => {
        const seenLinkRequests: string[] = []

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
                    seenLinkRequests.push(url)
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

                if (url.includes('/public/a/app-2/links/demo-content?locale=en')) {
                    seenLinkRequests.push(url)
                    return {
                        ok: true,
                        json: async () => ({
                            id: 'link-2',
                            title: 'Second content',
                            targetType: 'content',
                            targetId: 'content-2'
                        })
                    } as Response
                }

                if (url.endsWith('/public/a/app-1/guest-session')) {
                    return {
                        ok: true,
                        json: async () => ({ studentId: 'student-1', sessionToken: 'token-1' })
                    } as Response
                }

                if (url.endsWith('/public/a/app-2/guest-session')) {
                    return {
                        ok: true,
                        json: async () => ({ studentId: 'student-2', sessionToken: 'token-2' })
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

                if (url.includes('/public/a/app-2/runtime?') && url.includes('slug=demo-content') && url.includes('locale=en')) {
                    return {
                        ok: true,
                        json: async () => ({
                            type: 'content',
                            id: 'content-2',
                            title: 'Second content runtime',
                            contentItems: []
                        })
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url} ${init?.method ?? 'GET'}`)
            })
        )

        window.history.replaceState({}, '', '/public/a/app-1/links/demo-content')

        const queryClient = createQueryClient()
        const { rerender } = render(
            <QueryClientProvider client={queryClient}>
                <GuestApp locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        window.history.replaceState({}, '', '/public/a/app-2/links/demo-content')
        rerender(
            <QueryClientProvider client={queryClient}>
                <GuestApp locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Second content')).toBeInTheDocument()
        expect(seenLinkRequests).toEqual([
            '/api/v1/public/a/app-1/links/demo-content?locale=en',
            '/api/v1/public/a/app-2/links/demo-content?locale=en'
        ])
    })

    it('shows a completion screen after the last content item is explicitly completed', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Complete content' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Complete content' }))

        await waitFor(() => {
            expect(screen.getByText('Content complete. Progress has been recorded for this session.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Restart content' })).toBeInTheDocument()
        })
    })

    it('renders localized completion controls for the Russian guest flow', async () => {
        i18nState.locale = 'ru'
        const queryClient = createQueryClient()
        window.history.replaceState({}, '', '/public/a/app-1/links/demo-content?locale=ru')

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Русский гость' } })
        fireEvent.click(screen.getByRole('button', { name: 'Начать обучение' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Далее' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Далее' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Завершить контент' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Завершить контент' }))

        await waitFor(() => {
            expect(screen.getByText('Контент завершён. Прогресс записан для этой сессии.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Пройти контент заново' })).toBeInTheDocument()
        })
    })

    it('prefers the explicit locale from the public URL over a stale locale prop for runtime requests', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url.includes('/auth/csrf')) {
                return {
                    ok: true,
                    json: async () => ({ csrfToken: 'csrf-token' })
                }
            }

            if (url.includes('/public/a/app-1/links/demo-content?locale=ru')) {
                return {
                    ok: true,
                    json: async () => ({
                        id: 'link-1',
                        title: 'RU link',
                        targetType: 'content',
                        targetId: 'content-1'
                    })
                }
            }

            if (url.endsWith('/public/a/app-1/guest-session')) {
                return {
                    ok: true,
                    json: async () => ({
                        studentId: 'student-1',
                        sessionToken: 'guest-token'
                    })
                }
            }

            if (url.includes('/public/a/app-1/runtime?') && url.includes('slug=demo-content') && url.includes('locale=ru')) {
                return {
                    ok: true,
                    json: async () => ({
                        type: 'content',
                        id: 'content-1',
                        title: 'RU content',
                        description: 'RU description',
                        contentItems: [
                            {
                                id: 'item-1',
                                itemType: 'text',
                                itemTitle: 'RU item',
                                itemContent: 'RU body',
                                sortOrder: 0
                            }
                        ]
                    })
                }
            }

            if (url.endsWith('/public/a/app-1/runtime/guest-progress')) {
                return {
                    ok: true,
                    json: async () => ({ ok: true })
                }
            }

            throw new Error(`Unexpected fetch request: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)
        window.history.replaceState({}, '', '/public/a/app-1/links/demo-content?locale=ru')
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        fireEvent.change(await screen.findByLabelText('Your name'), { target: { value: 'Guest learner' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        expect(await screen.findByText('RU content')).toBeInTheDocument()
        expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/a/app-1/links/demo-content?locale=ru')
        expect(
            fetchMock.mock.calls.some(
                ([input]) => String(input).includes('/public/a/app-1/runtime?') && String(input).includes('locale=ru')
            )
        ).toBe(true)
    })

    it('keeps the quiz result visible until the guest explicitly returns to the content', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <GuestApp applicationId='app-1' slug='demo-content' locale='en' apiBaseUrl='/api/v1' />
            </QueryClientProvider>
        )

        expect(await screen.findByText('Demo content')).toBeInTheDocument()

        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Next' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Open quiz' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Open quiz' }))

        await waitFor(() => {
            expect(screen.getByText('Question prompt')).toBeInTheDocument()
        })

        fireEvent.click(screen.getByLabelText('Correct option'))
        fireEvent.click(screen.getByRole('button', { name: 'Submit quiz' }))

        await waitFor(() => {
            expect(screen.getByText('Score 1 / 1')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Back to content' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Back to content' }))

        await waitFor(() => {
            expect(screen.getByText('Knowledge check')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Open quiz' })).toBeInTheDocument()
        })
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
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner' } })

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
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner 1' } })
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
        fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Guest learner 2' } })
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))
        await waitFor(() => {
            expect(screen.getByText('Content title')).toBeInTheDocument()
        })

        expect(csrfHeaders).toEqual(['csrf-token-1', 'csrf-token-2'])
    })
})
