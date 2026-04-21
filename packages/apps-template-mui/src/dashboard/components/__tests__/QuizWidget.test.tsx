import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import QuizWidget from '../QuizWidget'
import { DashboardDetailsProvider } from '../../DashboardDetailsContext'

const mocks = vi.hoisted(() => ({
    executeClientScriptMethod: vi.fn()
}))

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, options?: string | Record<string, unknown>) => {
            if (typeof options === 'string') {
                return options
            }

            if (options && typeof options === 'object' && 'defaultValue' in options) {
                return String(options.defaultValue)
                    .replace('{{score}}', String(options.score ?? ''))
                    .replace('{{total}}', String(options.total ?? ''))
                    .replace('{{current}}', String(options.current ?? ''))
                    .replace('{{level}}', String(options.level ?? ''))
            }

            return key
        },
        i18n: {
            language: 'en'
        }
    })
}))

vi.mock('../../runtime/browserScriptRuntime', () => ({
    executeClientScriptMethod: mocks.executeClientScriptMethod
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            },
            mutations: {
                retry: false
            }
        }
    })

const renderWidget = (details?: Record<string, unknown>) => {
    const queryClient = createQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <DashboardDetailsProvider value={details as never}>
                <QuizWidget config={{ attachedToKind: 'catalog', scriptCodename: 'quiz-widget' }} />
            </DashboardDetailsProvider>
        </QueryClientProvider>
    )
}

describe('QuizWidget', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        vi.stubGlobal(
            'fetch',
            vi.fn(async (input: string | URL) => {
                const url = String(input)

                if (url.includes('/runtime/scripts?attachedToKind=catalog&attachedToId=catalog-1')) {
                    return {
                        ok: true,
                        json: async () => ({
                            items: [
                                {
                                    id: 'script-1',
                                    codename: 'quiz-widget',
                                    attachedToKind: 'catalog',
                                    attachedToId: 'catalog-1',
                                    moduleRole: 'widget',
                                    sourceKind: 'embedded',
                                    sdkApiVersion: '1.0.0',
                                    isActive: true,
                                    checksum: 'checksum-1',
                                    presentation: {
                                        name: {
                                            _schema: 'v1',
                                            _primary: 'en',
                                            locales: { en: { content: 'Quiz widget' } }
                                        }
                                    },
                                    manifest: {
                                        moduleRole: 'widget',
                                        capabilities: ['metadata.read', 'rpc.client'],
                                        methods: [
                                            { name: 'mount', target: 'client' },
                                            { name: 'submit', target: 'client' }
                                        ]
                                    }
                                }
                            ]
                        })
                    } as Response
                }

                if (url.endsWith('/runtime/scripts/script-1/client')) {
                    return {
                        ok: true,
                        text: async () => 'module.exports = class QuizWidgetRuntime {}'
                    } as Response
                }

                throw new Error(`Unexpected fetch request: ${url}`)
            })
        )

        mocks.executeClientScriptMethod.mockImplementation(async ({ methodName }: { methodName: string }) => {
            if (methodName === 'mount') {
                return {
                    title: 'Space Quiz',
                    description: 'One question runtime quiz.',
                    submitLabel: 'Check answer',
                    nextLabel: 'Next question',
                    questions: [
                        {
                            id: 'question-1',
                            prompt: 'Which planet is known as the Red Planet?',
                            difficulty: 1,
                            options: [
                                { id: 'mars', label: 'Mars' },
                                { id: 'venus', label: 'Venus' }
                            ]
                        }
                    ]
                }
            }

            if (methodName === 'submit') {
                return {
                    questionId: 'question-1',
                    correct: true,
                    completed: true,
                    message: 'Correct!',
                    explanation: 'Mars looks red because of iron oxide dust.',
                    score: 1,
                    total: 1,
                    correctOptionIds: {
                        'question-1': ['mars']
                    }
                }
            }

            throw new Error(`Unexpected client method: ${methodName}`)
        })
    })

    it('renders an informative state when the runtime context is missing', () => {
        renderWidget(undefined)

        expect(screen.getByText('Quiz widget is available only inside the application runtime surface.')).toBeInTheDocument()
    })

    it('renders quiz questions, submits the current answer payload, and shows the completion score', async () => {
        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText((content) => content.includes('Which planet is known as the Red Planet?'))).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Mars'))
        fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

        await waitFor(() => {
            expect(screen.getByText('Quiz complete!')).toBeInTheDocument()
            expect(screen.getByText('Score: 1 / 1')).toBeInTheDocument()
        })

        expect(mocks.executeClientScriptMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                methodName: 'mount',
                args: ['en']
            })
        )

        expect(mocks.executeClientScriptMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                methodName: 'submit',
                args: [
                    {
                        questionId: 'question-1',
                        answerIds: ['mars'],
                        responses: {
                            'question-1': ['mars']
                        },
                        locale: 'en'
                    }
                ]
            })
        )
    })

    it('shows a manual next action after an incorrect answer', async () => {
        mocks.executeClientScriptMethod.mockImplementation(async ({ methodName }: { methodName: string; args?: unknown[] }) => {
            if (methodName === 'mount') {
                return {
                    title: 'Space Quiz',
                    submitLabel: 'Check answer',
                    nextLabel: 'Next question',
                    questions: [
                        {
                            id: 'question-1',
                            prompt: 'Which planet is known as the Red Planet?',
                            options: [
                                { id: 'mars', label: 'Mars' },
                                { id: 'venus', label: 'Venus' }
                            ]
                        },
                        {
                            id: 'question-2',
                            prompt: 'Which planet is famous for its rings?',
                            options: [
                                { id: 'saturn', label: 'Saturn' },
                                { id: 'mercury', label: 'Mercury' }
                            ]
                        }
                    ]
                }
            }

            if (methodName === 'submit') {
                return {
                    questionId: 'question-1',
                    correct: false,
                    completed: false,
                    message: 'Not quite yet.',
                    explanation: 'Mars is the red planet.',
                    score: 0,
                    total: 2,
                    correctOptionIds: {
                        'question-1': ['mars']
                    }
                }
            }

            throw new Error(`Unexpected client method: ${methodName}`)
        })

        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText((content) => content.includes('Which planet is known as the Red Planet?'))).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Venus'))
        fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

        await waitFor(() => {
            expect(screen.getByText('Next question')).toBeInTheDocument()
            expect(screen.getByText((content) => content.includes('Mars is the red planet.'))).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Next question' }))

        await waitFor(() => {
            expect(screen.getByText('Which planet is famous for its rings?')).toBeInTheDocument()
        })
    })

    it('passes quizId to mount and submit calls when the widget is scoped to a specific quiz reference', async () => {
        const queryClient = createQueryClient()

        render(
            <QueryClientProvider client={queryClient}>
                <DashboardDetailsProvider
                    value={{
                        applicationId: 'app-1',
                        linkedCollectionId: 'catalog-1',
                        apiBaseUrl: '/api/v1'
                    } as never}
                >
                    <QuizWidget config={{ attachedToKind: 'catalog', scriptCodename: 'quiz-widget', quizId: 'quiz-42' }} />
                </DashboardDetailsProvider>
            </QueryClientProvider>
        )

        expect(await screen.findByText((content) => content.includes('Which planet is known as the Red Planet?'))).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Mars'))
        fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

        await waitFor(() => {
            expect(mocks.executeClientScriptMethod).toHaveBeenCalledWith(
                expect.objectContaining({
                    methodName: 'mount',
                    args: [{ locale: 'en', quizId: 'quiz-42' }]
                })
            )
        })

        expect(mocks.executeClientScriptMethod).toHaveBeenCalledWith(
            expect.objectContaining({
                methodName: 'submit',
                args: [
                    expect.objectContaining({
                        quizId: 'quiz-42'
                    })
                ]
            })
        )
    })

    it('allows returning from the completion screen back to the answered questions', async () => {
        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText((content) => content.includes('Which planet is known as the Red Planet?'))).toBeInTheDocument()
        fireEvent.click(screen.getByLabelText('Mars'))
        fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

        await waitFor(() => {
            expect(screen.getByText('Quiz complete!')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Back to questions' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Back to questions' }))

        await waitFor(() => {
            expect(screen.getByText('Which planet is known as the Red Planet?')).toBeInTheDocument()
        })

        expect(screen.getByLabelText('Mars')).toBeChecked()
    })

    it('allows navigating back to a previous question while preserving the selected answer', async () => {
        mocks.executeClientScriptMethod.mockImplementation(async ({ methodName }: { methodName: string; args?: unknown[] }) => {
            if (methodName === 'mount') {
                return {
                    title: 'Space Quiz',
                    submitLabel: 'Check answer',
                    nextLabel: 'Next question',
                    questions: [
                        {
                            id: 'question-1',
                            prompt: 'Which planet is known as the Red Planet?',
                            options: [
                                { id: 'mars', label: 'Mars' },
                                { id: 'venus', label: 'Venus' }
                            ]
                        },
                        {
                            id: 'question-2',
                            prompt: 'Which planet is famous for its rings?',
                            options: [
                                { id: 'saturn', label: 'Saturn' },
                                { id: 'mercury', label: 'Mercury' }
                            ]
                        }
                    ]
                }
            }

            if (methodName === 'submit') {
                return {
                    questionId: 'question-1',
                    correct: false,
                    completed: false,
                    message: 'Not quite yet.',
                    explanation: 'Mars is the red planet.',
                    score: 0,
                    total: 2,
                    correctOptionIds: {
                        'question-1': ['mars']
                    }
                }
            }

            throw new Error(`Unexpected client method: ${methodName}`)
        })

        renderWidget({
            applicationId: 'app-1',
            linkedCollectionId: 'catalog-1',
            apiBaseUrl: '/api/v1'
        })

        expect(await screen.findByText((content) => content.includes('Which planet is known as the Red Planet?'))).toBeInTheDocument()

        fireEvent.click(screen.getByLabelText('Venus'))
        fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Next question' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Next question' }))

        await waitFor(() => {
            expect(screen.getByText('Which planet is famous for its rings?')).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Previous question' })).toBeInTheDocument()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Previous question' }))

        await waitFor(() => {
            expect(screen.getByText('Which planet is known as the Red Planet?')).toBeInTheDocument()
        })

        expect(screen.getByLabelText('Venus')).toBeChecked()
    })
})
