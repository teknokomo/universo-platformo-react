import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import { createLocalizedContent, generateUuidV7, getVLCString, isUuidV7, updateLocalizedContentLocale } from '@universo-react/utils'
import '../../i18n'
import { AssessmentOptionsCell } from '../AssessmentOptionsCell'
import { AssessmentOptionsEditorDialog } from '../AssessmentOptionsEditorDialog'
import * as assessmentOptionUtils from '../../utils/assessmentOptions'
import type { AssessmentOptionDraft } from '../../utils/assessmentOptions'

const optionIdOne = '0190a9b5-3cde-7abc-8def-0123456789ab'
const optionIdTwo = '0190a9b5-3cde-7abc-8def-0123456789ac'

const localizedLabel = (english: string, russian: string) =>
    updateLocalizedContentLocale(createLocalizedContent('en', english), 'ru', russian)

const makeOptions = (correctIndex: number | null = 0) => [
    { id: optionIdOne, label: localizedLabel('Red', 'Красный'), isCorrect: correctIndex === 0 },
    { id: optionIdTwo, label: localizedLabel('Blue', 'Синий'), isCorrect: correctIndex === 1 }
]

describe('published runtime assessment option editor', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('normalizes missing, duplicate, and non-UUID v7 IDs while preserving valid unique IDs', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const invalidDrafts: AssessmentOptionDraft[] = [
            { id: optionIdOne, label: localizedLabel('First', 'Первый'), text: 'First', isCorrect: true },
            { id: optionIdOne, label: localizedLabel('Duplicate', 'Дубликат'), text: 'Duplicate', isCorrect: false },
            { id: optionIdTwo, label: localizedLabel('Valid', 'Верный'), text: 'Valid', isCorrect: false },
            { id: 'legacy-option-id', label: localizedLabel('Legacy', 'Старый'), text: 'Legacy', isCorrect: false },
            { id: undefined as unknown as string, label: localizedLabel('Missing', 'Без ID'), text: 'Missing', isCorrect: false }
        ]
        const readDrafts = vi.spyOn(assessmentOptionUtils, 'readAssessmentOptionDrafts').mockReturnValue(invalidDrafts)

        render(
            <AssessmentOptionsEditorDialog open value={[]} locale='en' minOptions={5} maxOptions={5} onClose={vi.fn()} onSave={onSave} />
        )

        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        expect(readDrafts).toHaveBeenCalledOnce()
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const saved = onSave.mock.calls[0]?.[0]
        const savedIds = saved.map((option: { id: string }) => option.id)

        expect(savedIds[0]).toBe(optionIdOne)
        expect(savedIds[2]).toBe(optionIdTwo)
        expect(savedIds[1]).not.toBe(optionIdOne)
        expect(savedIds).not.toContain('legacy-option-id')
        expect(savedIds.every((id: string) => isUuidV7(id))).toBe(true)
        expect(new Set(savedIds.map((id: string) => id.toLowerCase())).size).toBe(savedIds.length)
    })

    it('keeps order, the selected correct answer, and other localized labels when saving', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(<AssessmentOptionsCell value={makeOptions(null)} locale='en' minOptions={2} maxOptions={2} tabIndex={0} onSave={onSave} />)

        await user.click(screen.getByRole('button', { name: 'Edit answers (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        const correctGroup = within(dialog).getByRole('radiogroup', { name: 'Correct answer' })

        expect(within(dialog).getByText('Add exactly 2 non-empty options and mark exactly one correct answer.')).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled()
        const invalidCorrectGroup = within(dialog).getByRole('radiogroup', { name: 'Correct answer' })
        expect(invalidCorrectGroup).toHaveAttribute('aria-invalid', 'true')
        expect(invalidCorrectGroup).toHaveAttribute('aria-describedby')
        expect(within(dialog).getByText('Select exactly one correct answer.', { exact: true })).toBeInTheDocument()
        await user.click(within(correctGroup).getByRole('radio', { name: 'Option 1 is correct' }))
        await user.click(within(dialog).getByRole('button', { name: 'Move option 1 down' }))
        expect(within(correctGroup).getByRole('radio', { name: 'Option 2 is correct' })).toBeChecked()

        const firstOption = within(dialog).getByRole('textbox', { name: 'Option 1' })
        await user.clear(firstOption)
        await user.type(firstOption, 'Azure')
        expect(within(dialog).getByRole('button', { name: 'Save' })).toBeEnabled()
        expect(within(dialog).queryByText('Select exactly one correct answer.', { exact: true })).not.toBeInTheDocument()
        expect(dialog).not.toHaveTextContent(optionIdOne)
        expect(dialog).not.toHaveTextContent(optionIdTwo)
        expect(dialog).not.toHaveTextContent(JSON.stringify(makeOptions(null)))

        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const saved = onSave.mock.calls[0]?.[0]
        expect(saved.map((option: { id: string }) => option.id)).toEqual([optionIdTwo, optionIdOne])
        expect(saved.map((option: { isCorrect: boolean }) => option.isCorrect)).toEqual([false, true])
        expect(getVLCString(saved[0].label, 'en')).toBe('Azure')
        expect(getVLCString(saved[0].label, 'ru')).toBe('Синий')
        expect(getVLCString(saved[1].label, 'en')).toBe('Red')
        expect(getVLCString(saved[1].label, 'ru')).toBe('Красный')
        expect(screen.queryByRole('dialog', { name: 'Answer options' })).not.toBeInTheDocument()
    })

    it('caps the add control at twenty options even when metadata exceeds the server limit', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()
        const value = Array.from({ length: 20 }, (_, index) => ({
            id: generateUuidV7(),
            label: localizedLabel(`Answer ${index + 1}`, `Ответ ${index + 1}`),
            isCorrect: index === 0
        }))

        render(<AssessmentOptionsCell value={value} locale='en' minOptions={2} maxOptions={80} tabIndex={0} onSave={onSave} />)
        await user.click(screen.getByRole('button', { name: 'Edit answers (20)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })

        expect(within(dialog).getByRole('textbox', { name: 'Option 20' })).toBeInTheDocument()
        expect(within(dialog).queryByRole('textbox', { name: 'Option 21' })).not.toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Add option' })).toBeDisabled()
        expect(onSave).not.toHaveBeenCalled()
    })

    it('creates UUID v7 identities and localized labels for newly added options', async () => {
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(<AssessmentOptionsCell value={makeOptions()} locale='en' minOptions={2} maxOptions={3} tabIndex={0} onSave={onSave} />)
        await user.click(screen.getByRole('button', { name: 'Edit answers (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })

        await user.click(within(dialog).getByRole('button', { name: 'Add option' }))
        await user.type(within(dialog).getByRole('textbox', { name: 'Option 3' }), 'New localized answer')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
        const saved = onSave.mock.calls[0]?.[0]
        expect(saved).toHaveLength(3)
        expect(saved.every((option: { id: string }) => isUuidV7(option.id))).toBe(true)
        expect(getVLCString(saved[2].label, 'en')).toBe('New localized answer')
        expect(getVLCString(saved[2].label, 'ru')).toBe('')
        expect(new Set(saved.map((option: { id: string }) => option.id)).size).toBe(3)
    })

    it('uses the Russian accessible contract and cancels without saving', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()
        const onSave = vi.fn()

        render(<AssessmentOptionsCell value={makeOptions()} locale='ru' minOptions={2} maxOptions={2} tabIndex={0} onSave={onSave} />)

        await user.click(screen.getByRole('button', { name: 'Изменить варианты (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Варианты ответа' })
        expect(within(dialog).getByRole('textbox', { name: 'Вариант 1' })).toHaveValue('Красный')
        expect(within(dialog).getByRole('radiogroup', { name: 'Правильный ответ' })).toBeInTheDocument()
        expect(
            within(dialog).getByText(
                'Количество вариантов должно быть равно 2. Заполните каждый вариант и отметьте ровно один правильный ответ.'
            )
        ).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: 'Добавить вариант' })).toBeDisabled()
        await user.click(within(dialog).getByRole('button', { name: 'Отмена' }))

        expect(onSave).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog', { name: 'Варианты ответа' })).not.toBeInTheDocument()
    })

    it('associates an empty answer field with localized required feedback', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()

        render(<AssessmentOptionsCell value={[]} locale='ru' minOptions={1} maxOptions={1} tabIndex={0} onSave={vi.fn()} />)
        await user.click(screen.getByRole('button', { name: 'Изменить варианты (0)' }))
        const dialog = screen.getByRole('dialog', { name: 'Варианты ответа' })
        await user.click(within(dialog).getByRole('button', { name: 'Добавить вариант' }))

        const emptyOption = within(dialog).getByRole('textbox', { name: 'Вариант 1' })
        expect(emptyOption).toHaveAttribute('aria-invalid', 'true')
        const describedBy = emptyOption.getAttribute('aria-describedby')
        expect(describedBy).toBeTruthy()
        expect(within(dialog).getByText('Введите вариант ответа.').id).toBe(describedBy)
    })
})
