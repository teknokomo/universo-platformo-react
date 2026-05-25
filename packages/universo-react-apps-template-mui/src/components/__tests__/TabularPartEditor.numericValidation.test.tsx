import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TabularPartEditor } from '../TabularPartEditor'
import type { FieldConfig } from '../dialogs/FormDialog'

const i18nState = vi.hoisted(() => ({
    language: 'ru'
}))

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
        useGridApiRef: () => ({ current: {} })
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
})
