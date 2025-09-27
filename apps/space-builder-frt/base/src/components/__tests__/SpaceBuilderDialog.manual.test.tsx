import React from 'react'
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, screen, waitFor, fireEvent, createTestI18n } from '@testing/frontend'

import { SpaceBuilderDialog, type SpaceBuilderDialogProps } from '../SpaceBuilderDialog'
import type { QuizPlan } from '../../hooks/useSpaceBuilder'
import enTranslations from '../../i18n/locales/en/main.json'

const prepareQuizMock = vi.fn()
const reviseQuizMock = vi.fn()
const generateFlowMock = vi.fn()
const normalizeManualQuizMock = vi.fn()

vi.mock('../../hooks/useSpaceBuilder', async () => {
    const actual = await vi.importActual<typeof import('../../hooks/useSpaceBuilder')>(
        '../../hooks/useSpaceBuilder'
    )
    return {
        ...actual,
        useSpaceBuilder: () => ({
            prepareQuiz: prepareQuizMock,
            reviseQuiz: reviseQuizMock,
            generateFlow: generateFlowMock,
            normalizeManualQuiz: normalizeManualQuizMock
        })
    }
})

const samplePlan: QuizPlan = {
    items: [
        {
            question: 'What is the capital of France?',
            answers: [
                { text: 'Paris', isCorrect: true },
                { text: 'Lyon', isCorrect: false }
            ]
        }
    ]
}

function planToText(plan: QuizPlan): string {
    return plan.items
        .map(
            (item, index) =>
                `${index + 1}. ${item.question}\n${item.answers
                    .map((answer) => `  - ${answer.text}${answer.isCorrect ? ' ✅' : ''}`)
                    .join('\n')}`
        )
        .join('\n\n')
}

const manualBaseline = planToText(samplePlan)

function findManualField(): HTMLTextAreaElement {
    const candidates = screen.getAllByRole('textbox') as HTMLTextAreaElement[]
    const match = candidates.find((el) => el.value.includes('capital of France'))
    if (!match) {
        throw new Error('Manual preview field not found')
    }
    return match
}

function createJsonResponse(data: unknown) {
    return {
        ok: true,
        status: 200,
        json: async () => data,
        text: async () => JSON.stringify(data),
        headers: {
            get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null)
        }
    }
}

async function renderPreview(onClose: () => void) {
    const user = userEvent.setup()
    const i18n = await createTestI18n({
        resources: {
            en: { translation: enTranslations }
        }
    })

    await renderWithProviders(
        <SpaceBuilderDialog
            open
            onClose={onClose}
            onApply={vi.fn()}
            models={[
                { key: 'model-a', label: 'Model A', provider: 'openai', modelName: 'gpt-4', credentialId: 'cred-a' }
            ]}
            onError={vi.fn()}
        />,
        { i18n }
    )

    const sourceField = (await screen.findByLabelText(/Main material/i)) as HTMLTextAreaElement
    await user.type(sourceField, 'Create a simple geography quiz')

    const prepareButton = screen.getByRole('button', { name: /Prepare/i })
    await user.click(prepareButton)

    await waitFor(() => expect(prepareQuizMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: /Edit manually/i })).toBeEnabled())

    return { user }
}

describe('SpaceBuilderDialog manual safeguards', () => {
    beforeEach(() => {
        prepareQuizMock.mockReset()
        reviseQuizMock.mockReset()
        generateFlowMock.mockReset()
        normalizeManualQuizMock.mockReset()
        prepareQuizMock.mockResolvedValue(samplePlan)
        normalizeManualQuizMock.mockResolvedValue(samplePlan)
        vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
            const url = typeof input === 'string' ? input : input.toString()
            if (url.includes('/api/v1/space-builder/config')) {
                return Promise.resolve(createJsonResponse({ testMode: false, disableUserCredentials: false, items: [] }))
            }
            if (url.includes('/api/v1/space-builder/providers')) {
                return Promise.resolve(createJsonResponse({ providers: [] }))
            }
            if (url.includes('/api/v1/auth/refresh')) {
                return Promise.resolve(createJsonResponse({}))
            }
            return Promise.resolve(createJsonResponse({}))
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('keeps hook order stable when opening after an initial closed render', async () => {
        const onClose = vi.fn()
        const onApply = vi.fn()
        const onError = vi.fn()
        const i18n = await createTestI18n({
            resources: {
                en: { translation: enTranslations }
            }
        })

        const dialogProps: Omit<SpaceBuilderDialogProps, 'open'> = {
            onClose,
            onApply,
            models: [
                { key: 'model-a', label: 'Model A', provider: 'openai', modelName: 'gpt-4', credentialId: 'cred-a' }
            ],
            onError
        }

        const initialRender = await renderWithProviders(
            <SpaceBuilderDialog
                open={false}
                {...dialogProps}
            />,
            { i18n }
        )

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

        expect(() => {
            initialRender.rerender(
                <SpaceBuilderDialog
                    open
                    {...dialogProps}
                />
            )
        }).not.toThrow()

        await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    })

    it('disables revise action while manual edits are pending', async () => {
        const onClose = vi.fn()
        const { user } = await renderPreview(onClose)

        await user.click(screen.getByRole('button', { name: /Edit manually/i }))

        const manualField = findManualField()
        await user.type(manualField, ' (edited)')

        const reviseButton = screen.getByRole('button', { name: /Change/i })
        expect(reviseButton).toBeDisabled()

        expect(reviseQuizMock).not.toHaveBeenCalled()
        expect(onClose).not.toHaveBeenCalled()
    })

    it('prevents closing the dialog while manual normalization is running', async () => {
        const onClose = vi.fn()
        let resolveNormalization: ((plan: QuizPlan) => void) | undefined
        normalizeManualQuizMock.mockImplementation(
            () =>
                new Promise<QuizPlan>((resolve) => {
                    resolveNormalization = resolve
                })
        )

        const { user } = await renderPreview(onClose)

        await user.click(screen.getByRole('button', { name: /Edit manually/i }))
        const manualField = findManualField()
        await user.type(manualField, ' update')

        await user.click(screen.getByRole('button', { name: /Apply manual edits/i }))

        const dialog = screen.getByRole('dialog')

        fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape', keyCode: 27 })
        expect(onClose).not.toHaveBeenCalled()

        resolveNormalization?.(samplePlan)

        await waitFor(() => expect(normalizeManualQuizMock).toHaveBeenCalledTimes(1))
        await waitFor(() =>
            expect(screen.getByRole('button', { name: /Apply manual edits/i })).not.toHaveAttribute('disabled')
        )

        fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape', keyCode: 27 })
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    })
})
