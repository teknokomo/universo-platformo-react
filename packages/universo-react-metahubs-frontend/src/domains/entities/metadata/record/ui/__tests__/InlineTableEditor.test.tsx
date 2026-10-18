import { beforeAll, beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import enMetahubs from '../../../../../../i18n/locales/en/metahubs.json'
import ruMetahubs from '../../../../../../i18n/locales/ru/metahubs.json'

import InlineTableEditor from '../InlineTableEditor'

const i18n = createInstance()

beforeAll(async () => {
    await i18n.init({
        lng: 'en',
        fallbackLng: 'en',
        defaultNS: 'metahubs',
        ns: ['metahubs', 'common'],
        resources: {
            en: { metahubs: enMetahubs, common: { save: 'Save' } },
            ru: { metahubs: ruMetahubs, common: { save: 'Сохранить' } }
        },
        interpolation: { escapeValue: false }
    })
})

beforeEach(async () => {
    await i18n.changeLanguage('en')
})

const renderWithI18n = (ui: ReactElement) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)

describe('InlineTableEditor', () => {
    it('stores localized child strings in the canonical VLC format', async () => {
        const user = userEvent.setup()
        const handleChange = vi.fn()

        const Wrapper = () => {
            const [rows, setRows] = useState<Record<string, unknown>[]>([])

            return (
                <InlineTableEditor
                    label='Resources'
                    value={rows}
                    onChange={(nextRows) => {
                        setRows(nextRows)
                        handleChange(nextRows)
                    }}
                    locale='ru'
                    childFields={[
                        {
                            id: 'resourceName',
                            label: 'Name',
                            type: 'STRING',
                            required: true,
                            validationRules: {
                                localized: true,
                                versioned: true,
                                maxLength: 100
                            }
                        }
                    ]}
                />
            )
        }

        renderWithI18n(<Wrapper />)

        await user.click(screen.getByRole('button', { name: 'Add Row' }))
        await user.type(screen.getByRole('textbox'), 'Сахар')

        const latestRows = handleChange.mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>
        expect(Array.isArray(latestRows)).toBe(true)
        expect(latestRows).toHaveLength(1)
        expect(latestRows[0].resourceName).toMatchObject({
            _schema: '1',
            _primary: 'ru',
            locales: {
                ru: {
                    content: 'Сахар',
                    version: 1,
                    isActive: true
                }
            }
        })
    })

    it('does not render structured child values as object strings', () => {
        renderWithI18n(
            <InlineTableEditor
                label='Media'
                value={[{ __rowId: 'row-1', source: { type: 'file', storageKey: 'marketing/hero.webp' } }]}
                onChange={() => undefined}
                locale='en'
                childFields={[{ id: 'source', label: 'Source', type: 'JSON' }]}
            />
        )

        expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
        expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('edits assessment options as an ordered list and saves one correct choice', async () => {
        const user = userEvent.setup()
        const handleChange = vi.fn()
        const options = [
            { id: '0190a9b5-3cde-7abc-8def-0123456789ab', label: 'First answer', isCorrect: true },
            { id: '0190a9b5-3cde-7abc-8def-0123456789ac', label: 'Second answer', isCorrect: false }
        ]

        renderWithI18n(
            <InlineTableEditor
                label='Questions'
                value={[{ _localId: 'question-1', options }]}
                onChange={handleChange}
                locale='en'
                childFields={[{ id: 'options', label: 'Options', type: 'JSON', uiConfig: { widget: 'assessmentOptions' } }]}
            />
        )

        await user.click(screen.getByRole('button', { name: /Edit answers/ }))
        expect(screen.getByRole('dialog', { name: 'Answer options' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Option 1' })).toHaveAttribute('rows', '2')
        await user.click(screen.getAllByRole('radio', { name: /Option \d+ is correct/ })[1])
        expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Add option' }))
        await user.click(screen.getByRole('button', { name: 'Remove option 3' }))
        expect(screen.getByRole('button', { name: 'Remove option 1' })).toBeDisabled()
        await user.click(screen.getByRole('button', { name: 'Move option 2 up' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        const savedRows = handleChange.mock.calls[0][0] as Array<Record<string, unknown>>
        expect(savedRows[0].options).toEqual([
            { id: '0190a9b5-3cde-7abc-8def-0123456789ac', label: 'Second answer', isCorrect: true },
            { id: '0190a9b5-3cde-7abc-8def-0123456789ab', label: 'First answer', isCorrect: false }
        ])
    })

    it('keeps textarea metadata multiline in display and inserts Enter without closing the editor', async () => {
        const user = userEvent.setup()
        const handleChange = vi.fn()
        const Wrapper = () => {
            const [rows, setRows] = useState<Record<string, unknown>[]>([{ _localId: 'question-1', prompt: 'First line' }])

            return (
                <InlineTableEditor
                    label='Questions'
                    value={rows}
                    onChange={(nextRows) => {
                        setRows(nextRows)
                        handleChange(nextRows)
                    }}
                    locale='en'
                    childFields={[
                        {
                            id: 'prompt',
                            label: 'Prompt',
                            type: 'STRING',
                            validationRules: { localized: true, versioned: true },
                            uiConfig: { widget: 'textarea', rows: 3 }
                        }
                    ]}
                />
            )
        }

        renderWithI18n(<Wrapper />)

        const displayPrompt = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === 'First line')
        expect(displayPrompt).toHaveStyle({ whiteSpace: 'pre-wrap' })
        await user.dblClick(displayPrompt)

        const editor = screen.getByRole('textbox', { name: 'Prompt' })
        expect(editor.tagName).toBe('TEXTAREA')
        expect(editor).toHaveAttribute('rows', '3')
        await user.type(editor, '{end}{enter}Second line')

        expect(screen.getByRole('textbox', { name: 'Prompt' })).toBeInTheDocument()
        expect(editor).toHaveValue('First line\nSecond line')
        await user.keyboard('{Escape}')
        const multilineDisplay = screen.getByText(
            (_, element) => element?.tagName === 'P' && element.textContent === 'First line\nSecond line'
        )
        expect(multilineDisplay).toHaveStyle({ whiteSpace: 'pre-wrap' })
        const latestRows = handleChange.mock.calls.at(-1)?.[0] as Array<Record<string, unknown>>
        expect(latestRows[0].prompt).toMatchObject({
            locales: { en: { content: 'First line\nSecond line' } }
        })
    })

    it('opens a text cell from the keyboard with a localized accessible name', async () => {
        const user = userEvent.setup()

        renderWithI18n(
            <InlineTableEditor
                label='Questions'
                value={[{ _localId: 'question-1', prompt: 'Question prompt' }]}
                onChange={() => undefined}
                locale='en'
                childFields={[{ id: 'prompt', label: 'Prompt', type: 'STRING' }]}
            />
        )

        const promptCell = screen.getByRole('cell', { name: 'Edit Prompt in row 1' })
        expect(promptCell).toHaveAttribute('tabindex', '0')
        expect(promptCell).toHaveAttribute('aria-keyshortcuts', 'Enter Space')
        await user.click(promptCell)
        await user.keyboard('{Enter}')

        expect(screen.getByRole('textbox', { name: 'Prompt' })).toHaveValue('Question prompt')
    })

    it('enforces exactly four options, one correct answer, and localized option actions', async () => {
        await i18n.changeLanguage('ru')
        const user = userEvent.setup()
        const handleChange = vi.fn()
        const options = [1, 2, 3].map((number) => ({
            id: `0190a9b5-3cde-7abc-8def-0123456789a${String.fromCharCode(97 + number)}`,
            label: `Ответ ${number}`,
            isCorrect: false
        }))

        renderWithI18n(
            <InlineTableEditor
                label='Вопросы'
                value={[{ _localId: 'question-1', options }]}
                onChange={handleChange}
                locale='ru'
                childFields={[
                    {
                        id: 'options',
                        label: 'Варианты ответов',
                        type: 'JSON',
                        uiConfig: { widget: 'assessmentOptions', minOptions: 4, maxOptions: 4 }
                    }
                ]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Изменить ответы (3)' }))
        expect(screen.getByRole('dialog', { name: 'Варианты ответа' })).toBeInTheDocument()
        expect(screen.getByRole('alert')).toHaveTextContent('Добавьте ровно 4 непустых вариантов')
        expect(screen.getByRole('button', { name: 'Добавить вариант' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Удалить вариант 1' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Переместить вариант 2 вверх' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Добавить вариант' }))
        await user.type(screen.getByRole('textbox', { name: 'Вариант 4' }), 'Ответ 4')
        expect(screen.getByRole('button', { name: 'Добавить вариант' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Удалить вариант 4' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()

        await user.click(screen.getByRole('button', { name: 'Переместить вариант 2 вверх' }))
        await user.click(screen.getByRole('radio', { name: 'Вариант 1 — правильный ответ' }))
        await user.click(screen.getByRole('button', { name: 'Сохранить' }))

        const savedRows = handleChange.mock.calls[0][0] as Array<Record<string, unknown>>
        expect(savedRows[0].options).toHaveLength(4)
        expect(savedRows[0].options).toEqual([
            { id: '0190a9b5-3cde-7abc-8def-0123456789ac', label: 'Ответ 2', isCorrect: true },
            { id: '0190a9b5-3cde-7abc-8def-0123456789ab', label: 'Ответ 1', isCorrect: false },
            { id: '0190a9b5-3cde-7abc-8def-0123456789ad', label: 'Ответ 3', isCorrect: false },
            expect.objectContaining({ label: 'Ответ 4', isCorrect: false })
        ])
    })

    it('keeps the generic default maximum at twenty options', async () => {
        const user = userEvent.setup()
        const options = Array.from({ length: 20 }, (_, index) => ({
            id: `answer-${index + 1}`,
            label: `Answer ${index + 1}`,
            isCorrect: index === 0
        }))

        renderWithI18n(
            <InlineTableEditor
                label='Questions'
                value={[{ _localId: 'question-1', options }]}
                onChange={() => undefined}
                locale='en'
                childFields={[{ id: 'options', label: 'Options', type: 'JSON', uiConfig: { widget: 'assessmentOptions' } }]}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Edit answers (20)' }))
        expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Remove option 20' })).toBeEnabled()
    })

    it('uses sibling TABLE titles as selector labels and stores the semantic key', async () => {
        const user = userEvent.setup()
        const firstKey = '0199a9b5-3cde-7abc-8def-0123456789ab'
        const secondKey = '0199a9b5-3cde-7abc-8def-0123456789ac'
        const onChange = vi.fn()

        renderWithI18n(
            <InlineTableEditor
                label='Questions'
                value={[{ _localId: 'question-1', BlockKey: firstKey }]}
                onChange={onChange}
                locale='en'
                childFields={[
                    {
                        id: 'BlockKey',
                        codename: 'BlockKey',
                        label: 'Block',
                        type: 'STRING',
                        uiConfig: {
                            siblingRowSelect: {
                                tableCodename: 'Blocks',
                                valueFieldCodename: 'BlockKey',
                                labelFieldCodename: 'Title'
                            }
                        }
                    }
                ]}
                siblingTableValues={{
                    Blocks: {
                        rows: [
                            { BlockKey: firstKey, Title: 'Opening' },
                            { BlockKey: secondKey, Title: 'Practice' }
                        ],
                        childFields: [
                            { id: 'BlockKey', codename: 'BlockKey', label: 'Block key', type: 'STRING' },
                            { id: 'Title', codename: 'Title', label: 'Title', type: 'STRING' }
                        ]
                    }
                }}
            />
        )

        expect(screen.getByRole('combobox', { name: 'Block' })).toHaveTextContent('Opening')
        expect(screen.queryByText(firstKey)).not.toBeInTheDocument()
        await user.click(screen.getByRole('combobox', { name: 'Block' }))
        await user.click(await screen.findByRole('option', { name: 'Practice' }))

        expect(onChange).toHaveBeenCalledWith([{ _localId: 'question-1', BlockKey: secondKey }])
    })

    it('does not expose a raw REF identity when selectable options are missing', () => {
        const rawReferenceId = '0199a9b5-3cde-7abc-8def-0123456789ab'

        renderWithI18n(
            <InlineTableEditor
                label='Resources'
                value={[{ _localId: 'row-1', RelatedRecord: rawReferenceId }]}
                onChange={() => undefined}
                locale='en'
                childFields={[{ id: 'RelatedRecord', label: 'Related record', type: 'REF' }]}
            />
        )

        expect(screen.getByText('Selected reference is unavailable.')).toBeInTheDocument()
        expect(screen.queryByText(rawReferenceId)).not.toBeInTheDocument()
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })

    it('focuses the first visible field when a row starts with a generated UUID key', async () => {
        const user = userEvent.setup()
        const Wrapper = () => {
            const [rows, setRows] = useState<Record<string, unknown>[]>([])
            return (
                <InlineTableEditor
                    label='Blocks'
                    value={rows}
                    onChange={setRows}
                    locale='en'
                    childFields={[
                        {
                            id: 'BlockKey',
                            label: 'Block key',
                            type: 'STRING',
                            uiConfig: { hidden: true, generateUuidV7: true }
                        },
                        { id: 'Title', label: 'Title', type: 'STRING', required: true }
                    ]}
                />
            )
        }

        renderWithI18n(<Wrapper />)

        await user.click(screen.getByRole('button', { name: 'Add Row' }))

        expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument()
    })

    it('keeps generated keys hidden and normalizes SortOrder when rows move', async () => {
        const user = userEvent.setup()
        const firstKey = '0199a9b5-3cde-7abc-8def-0123456789ab'
        const secondKey = '0199a9b5-3cde-7abc-8def-0123456789ac'
        const onChange = vi.fn()

        renderWithI18n(
            <InlineTableEditor
                label='Blocks'
                value={[
                    { _localId: 'block-1', BlockKey: firstKey, Title: 'Opening', SortOrder: 1 },
                    { _localId: 'block-2', BlockKey: secondKey, Title: 'Practice', SortOrder: 2 }
                ]}
                onChange={onChange}
                locale='en'
                rowOrdering={{ orderFieldCodename: 'SortOrder', labelFieldCodename: 'Title' }}
                childFields={[
                    {
                        id: 'BlockKey',
                        codename: 'BlockKey',
                        label: 'Block key',
                        type: 'STRING',
                        uiConfig: { hidden: true, serverOwned: true, generateUuidV7: true }
                    },
                    { id: 'Title', codename: 'Title', label: 'Title', type: 'STRING' },
                    {
                        id: 'SortOrder',
                        codename: 'SortOrder',
                        label: 'Sort order',
                        type: 'NUMBER',
                        uiConfig: { hidden: true, serverOwned: true }
                    }
                ]}
            />
        )

        expect(screen.queryByText('Block key')).not.toBeInTheDocument()
        expect(screen.queryByText('Sort order')).not.toBeInTheDocument()
        expect(screen.queryByText(firstKey)).not.toBeInTheDocument()
        await user.click(screen.getAllByRole('button', { name: 'Actions' })[0])
        await user.click(screen.getByRole('menuitem', { name: 'Move down: Opening' }))

        expect(onChange).toHaveBeenCalledWith([
            { _localId: 'block-2', BlockKey: secondKey, Title: 'Practice', SortOrder: 1 },
            { _localId: 'block-1', BlockKey: firstKey, Title: 'Opening', SortOrder: 2 }
        ])
    })
})
