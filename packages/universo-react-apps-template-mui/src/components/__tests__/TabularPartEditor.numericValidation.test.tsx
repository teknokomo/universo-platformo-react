import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabularPartEditor } from '../TabularPartEditor'
import type { FieldConfig } from '../dialogs/FormDialog'

const i18nState = vi.hoisted(() => ({
    language: 'ru'
}))

const gridApiState = vi.hoisted(() => {
    const focusCalls: unknown[][] = []
    const editCalls: unknown[] = []

    return {
        focusCalls,
        editCalls,
        apiRef: {
            current: {
                setCellFocus: (...args: unknown[]) => focusCalls.push(args),
                startCellEditMode: (args: unknown) => editCalls.push(args)
            }
        }
    }
})

vi.mock('react-i18next', () => {
    const dictionaries = {
        ru: {
            'tabular.addRow': 'Добавить строку',
            'tabular.delete': 'Удалить',
            'tabular.noRows': 'Нет строк',
            'tabular.deleteTitle': 'Удалить строку',
            'tabular.deleteDescription': 'Вы уверены, что хотите удалить эту строку?',
            'tabular.cancel': 'Отмена',
            'app.actions': 'Действия',
            'app.edit': 'Редактировать',
            'number.increment': 'Увеличить',
            'number.decrement': 'Уменьшить',
            'validation.invalidNumber': 'Некорректное число',
            'validation.maxValue': 'Максимальное значение: {{max}}'
        }
    }

    return {
        useTranslation: () => ({
            t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
                const template =
                    dictionaries[i18nState.language as keyof typeof dictionaries]?.[
                        key as keyof (typeof dictionaries)[keyof typeof dictionaries]
                    ] ?? (typeof fallbackOrOptions === 'string' ? fallbackOrOptions : key)

                if (typeof fallbackOrOptions === 'object' && typeof fallbackOrOptions.max === 'number') {
                    return template.replace('{{max}}', String(fallbackOrOptions.max))
                }

                return template
            },
            i18n: { language: i18nState.language }
        })
    }
})

vi.mock('@mui/x-data-grid', async () => {
    const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid')

    return {
        ...actual,
        DataGrid: (props: {
            processRowUpdate: (
                newRow: Record<string, unknown>,
                oldRow: Record<string, unknown>
            ) => Record<string, unknown> | Promise<Record<string, unknown>>
            onProcessRowUpdateError?: (error: Error) => void
        }) => (
            <button
                type='button'
                onClick={async () => {
                    try {
                        await props.processRowUpdate({ id: 'row-1', Amount: 11 }, { id: 'row-1', Amount: 5 })
                    } catch (error) {
                        props.onProcessRowUpdateError?.(error as Error)
                    }
                }}
            >
                commit invalid number
            </button>
        ),
        useGridApiRef: () => gridApiState.apiRef
    }
})

const childFields: FieldConfig[] = [
    {
        id: 'Amount',
        label: 'Amount',
        type: 'NUMBER',
        validationRules: { max: 10 }
    }
]

describe('TabularPartEditor numeric validation', () => {
    beforeEach(() => {
        i18nState.language = 'ru'
        gridApiState.focusCalls.length = 0
        gridApiState.editCalls.length = 0
    })

    it('shows localized user-facing error instead of silently accepting rollback', async () => {
        const onChange = vi.fn()

        render(
            <TabularPartEditor
                label='Rows'
                value={[{ _localId: 'row-1', Amount: 5 }]}
                onChange={onChange}
                childFields={childFields}
                locale='ru'
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'commit invalid number' }))

        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Максимальное значение: 10'))
        expect(onChange).not.toHaveBeenCalled()
        expect(screen.queryByText('Maximum value: 10')).not.toBeInTheDocument()
    })

    it('starts editing the first visible field after adding a row with hidden generated fields', async () => {
        const originalRequestAnimationFrame = window.requestAnimationFrame
        window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
            callback(0)
            return 0
        }) as typeof window.requestAnimationFrame

        const Wrapper = () => {
            const [rows, setRows] = useState<Record<string, unknown>[]>([])

            return (
                <TabularPartEditor
                    label='Rows'
                    value={rows}
                    onChange={setRows}
                    childFields={[
                        {
                            id: 'CellId',
                            label: 'Cell ID',
                            type: 'STRING',
                            uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
                        },
                        {
                            id: 'Name',
                            label: 'Name',
                            type: 'STRING'
                        }
                    ]}
                    locale='ru'
                />
            )
        }

        try {
            render(<Wrapper />)

            fireEvent.click(screen.getByRole('button', { name: 'Добавить строку' }))

            await waitFor(() =>
                expect(gridApiState.editCalls).toContainEqual({
                    id: '__local_new_1',
                    field: 'Name'
                })
            )
            expect(gridApiState.focusCalls).toContainEqual(['__local_new_1', 'Name'])
            expect(gridApiState.editCalls).not.toContainEqual({
                id: '__local_new_1',
                field: 'CellId'
            })
        } finally {
            window.requestAnimationFrame = originalRequestAnimationFrame
        }
    })
})
