import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import QuizWidgetEditorDialog from '../QuizWidgetEditorDialog'

const mocks = vi.hoisted(() => ({
    list: vi.fn()
}))

vi.mock('react-i18next', async (importOriginal) => {
    const actual = await importOriginal<typeof import('react-i18next')>()

    return {
        ...actual,
        useTranslation: () => ({
            t: (_key: string, fallback?: string) => fallback ?? _key,
            i18n: { language: 'en' }
        })
    }
})

vi.mock('../../../modules/api/modulesApi', () => ({
    modulesApi: {
        list: mocks.list
    }
}))

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false
            }
        }
    })

const createVisibleDomRect = (): DOMRect =>
    ({
        x: 0,
        y: 0,
        width: 160,
        height: 40,
        top: 0,
        right: 160,
        bottom: 40,
        left: 0,
        toJSON: () => ({})
    } as DOMRect)

const createModuleRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'module-1',
    version: 1,
    codename: {
        _schema: 'v1',
        _primary: 'en',
        locales: {
            en: { content: 'quiz-widget' }
        }
    },
    presentation: {
        name: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Space Quiz Widget' }
            }
        },
        description: {
            _schema: 'v1',
            _primary: 'en',
            locales: {
                en: { content: 'Runtime space quiz widget' }
            }
        }
    },
    attachedToKind: 'metahub',
    attachedToId: null,
    moduleRole: 'widget',
    sourceKind: 'embedded',
    sdkApiVersion: '1.0.0',
    sourceCode: 'export default class SpaceQuizWidget extends ExtensionModule {}',
    manifest: {
        className: 'SpaceQuizWidget',
        sdkApiVersion: '1.0.0',
        moduleRole: 'widget',
        sourceKind: 'embedded',
        capabilities: ['rpc.client'],
        methods: [
            { name: 'mount', target: 'client' },
            { name: 'submit', target: 'server_and_client' }
        ]
    },
    serverBundle: 'server bundle',
    clientBundle: 'client bundle',
    checksum: 'checksum-1',
    isActive: true,
    ...overrides
})

const renderDialog = (props: Partial<ComponentProps<typeof QuizWidgetEditorDialog>> = {}) => {
    const queryClient = createQueryClient()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
        <QueryClientProvider client={queryClient}>
            <QuizWidgetEditorDialog open metahubId='metahub-1' onSave={onSave} onCancel={onCancel} {...props} />
        </QueryClientProvider>
    )

    return { onSave, onCancel }
}

describe('QuizWidgetEditorDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(createVisibleDomRect)
        mocks.list.mockResolvedValue([createModuleRecord()])
    })

    it('loads active widget modules for the selected attachment kind and saves normalized config', async () => {
        const user = userEvent.setup()
        const { onSave } = renderDialog()

        await waitFor(() => {
            expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'metahub' })
        })

        expect(screen.getByRole('combobox', { name: 'Quiz module' })).toBeInTheDocument()
        expect(screen.queryByLabelText(/Module codename/i)).not.toBeInTheDocument()
        expect(screen.queryByLabelText(/Mount method/i)).not.toBeInTheDocument()

        await user.click(screen.getByRole('combobox', { name: 'Quiz module' }))
        await user.click(screen.getByRole('option', { name: 'Space Quiz Widget (quiz-widget)' }))
        await user.type(screen.getByLabelText('Widget title override'), 'Mission Control Quiz')
        await user.click(screen.getByRole('button', { name: 'Advanced actions' }))
        await user.type(screen.getByLabelText('Content loader'), 'mountQuiz')
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({
            title: 'Mission Control Quiz',
            moduleCodename: 'quiz-widget',
            attachedToKind: 'metahub',
            mountMethodName: 'mountQuiz'
        })
    })

    it('reloads module options when the attachment kind changes', async () => {
        const user = userEvent.setup()

        mocks.list.mockResolvedValueOnce([createModuleRecord()]).mockResolvedValueOnce([
            createModuleRecord({
                id: 'module-2',
                codename: {
                    _schema: 'v1',
                    _primary: 'en',
                    locales: {
                        en: { content: 'object-quiz-widget' }
                    }
                },
                presentation: {
                    name: {
                        _schema: 'v1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'ObjectCollectionEntity Quiz Widget' }
                        }
                    }
                },
                attachedToKind: 'object',
                attachedToId: 'object-1'
            })
        ])

        renderDialog()

        await waitFor(() => {
            expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'metahub' })
        })

        await user.click(screen.getAllByRole('combobox')[0])
        await user.click(screen.getByRole('option', { name: 'Current object' }))

        await waitFor(() => {
            expect(mocks.list).toHaveBeenCalledWith('metahub-1', { attachedToKind: 'object' })
        })

        await user.click(screen.getAllByRole('combobox')[1])
        expect(screen.getByRole('option', { name: 'ObjectCollectionEntity Quiz Widget (object-quiz-widget)' })).toBeInTheDocument()
    })
})
