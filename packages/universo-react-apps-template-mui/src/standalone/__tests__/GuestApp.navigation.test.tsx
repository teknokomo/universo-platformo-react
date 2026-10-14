import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    resetGuestAppTestHarness,
    GuestApp,
    QueryClientProvider,
    createQueryClient,
    fillGuestIntake,
    fireEvent,
    i18nState,
    readGuestProgressRequestBodies,
    render,
    screen,
    waitFor
} from './GuestApp.testHarness'

describe('GuestApp content navigation', () => {
    beforeEach(resetGuestAppTestHarness)

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

        fillGuestIntake('Guest learner')
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

        fireEvent.click(screen.getByRole('button', { name: 'Complete content' }))

        await waitFor(() => {
            expect(screen.getByText('Content complete. Progress has been recorded for this session.')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Restart content' })).toBeInTheDocument()
        })
        await waitFor(() => {
            expect(readGuestProgressRequestBodies()).toHaveLength(2)
        })
        expect(readGuestProgressRequestBodies()[1]).toMatchObject({
            participantId: 'student-1',
            sessionToken: 'token-1',
            contentNodeId: 'content-1',
            action: 'complete'
        })
        expect(readGuestProgressRequestBodies()[1]).not.toHaveProperty('contentItemId')
        expect(readGuestProgressRequestBodies()[1]).not.toHaveProperty('progressPercent')
        expect(readGuestProgressRequestBodies()[1]).not.toHaveProperty('status')
        expect(readGuestProgressRequestBodies()[1]).not.toHaveProperty('lastAccessedItemIndex')
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

        fillGuestIntake('Русский', 'гость')
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

        await screen.findByLabelText(/First name/)
        fillGuestIntake('Guest learner')
        fireEvent.click(screen.getByRole('button', { name: 'Start learning' }))

        expect(await screen.findByText('RU content')).toBeInTheDocument()
        expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/v1/public/a/app-1/links/demo-content?locale=ru')).toBe(true)
        expect(
            fetchMock.mock.calls.some(
                ([input]) => String(input).includes('/public/a/app-1/runtime?') && String(input).includes('locale=ru')
            )
        ).toBe(true)
    })
})
