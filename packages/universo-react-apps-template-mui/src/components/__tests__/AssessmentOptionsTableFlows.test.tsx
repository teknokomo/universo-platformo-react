import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@universo-react/i18n'
import '../../i18n'
import { updateTabularRow } from '../../api/api'
import { RuntimeInlineTabularEditor } from '../RuntimeInlineTabularEditor'
import { TabularPartEditor } from '../TabularPartEditor'
import type { FieldConfig } from '../dialogs/FormDialog'
import { buildTabularColumns } from '../../utils/tabularColumns'

const apiState = vi.hoisted(() => ({
    fetchTabularRows: vi.fn(),
    updateTabularRow: vi.fn()
}))

const gridApiState = vi.hoisted(() => ({
    current: {
        setCellFocus: vi.fn(),
        startCellEditMode: vi.fn()
    }
}))

vi.mock('@mui/x-data-grid', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mui/x-data-grid')>()
    const DataGrid = (props: {
        rows: Array<Record<string, unknown>>
        columns: Array<{
            field: string
            renderCell?: (params: unknown) => ReactNode
        }>
    }) => {
        const optionsColumns = props.columns.filter(({ field }) => field === 'Options')

        return (
            <div data-testid='tabular-grid'>
                {props.rows.map((row) =>
                    optionsColumns.map((column) => (
                        <div key={`${String(row.id)}-${column.field}`}>
                            {column.renderCell?.({
                                id: String(row.id),
                                field: column.field,
                                row,
                                value: row[column.field],
                                tabIndex: 0
                            } as never)}
                        </div>
                    ))
                )}
            </div>
        )
    }

    return {
        ...actual,
        DataGrid: DataGrid as typeof actual.DataGrid,
        useGridApiRef: () => gridApiState as ReturnType<typeof actual.useGridApiRef>
    }
})

vi.mock('../../api/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../api/api')>()

    return {
        ...actual,
        fetchTabularRows: apiState.fetchTabularRows,
        updateTabularRow: apiState.updateTabularRow
    }
})

const optionValues = [
    { id: '0190a9b5-3cde-7abc-8def-0123456789ab', label: 'First answer', isCorrect: true },
    { id: '0190a9b5-3cde-7abc-8def-0123456789ac', label: 'Second answer', isCorrect: false }
]

const optionField: FieldConfig = {
    id: 'Options',
    label: 'Answer options',
    type: 'JSON',
    required: true,
    validationRules: {},
    uiConfig: { widget: 'assessmentOptions', minOptions: 2, maxOptions: 4 }
}

const createQueryClient = () =>
    new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0
            }
        }
    })

describe('assessment option table authoring flows', () => {
    beforeEach(async () => {
        apiState.fetchTabularRows.mockReset()
        apiState.updateTabularRow.mockReset()
        gridApiState.current.setCellFocus.mockReset()
        gridApiState.current.startCellEditMode.mockReset()
        await i18n.changeLanguage('en')
    })

    it('builds a non-editable structured JSON column with a safe count and create callback', async () => {
        const onSelectChange = vi.fn()
        const columns = buildTabularColumns({
            childFields: [optionField],
            rowNumberById: new Map([['create-row', 1]]),
            onDeleteRow: vi.fn(),
            onSelectChange,
            locale: 'en'
        })
        const column = columns.find(({ field }) => field === 'Options')

        expect(column?.editable).toBe(false)
        expect(column?.valueFormatter?.(optionValues as never)).toBe(2)

        render(
            <>
                {column?.renderCell?.({
                    id: 'create-row',
                    field: 'Options',
                    row: { Options: optionValues },
                    value: optionValues,
                    tabIndex: 0
                } as never)}
            </>
        )

        const user = userEvent.setup()
        await user.click(screen.getByRole('button', { name: 'Edit answers (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        expect(dialog).not.toHaveTextContent(optionValues[0].id)
        expect(dialog).not.toHaveTextContent(JSON.stringify(optionValues))
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        expect(onSelectChange).toHaveBeenCalledExactlyOnceWith('create-row', 'Options', optionValues)
    })

    it('saves structured answers through the TABLE create flow', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()

        render(
            <TabularPartEditor
                label='Questions'
                value={[{ _localId: 'local-question-1', Options: optionValues }]}
                onChange={onChange}
                childFields={[optionField]}
                locale='en'
            />
        )

        await user.click(screen.getByRole('button', { name: 'Edit answers (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        const firstOption = within(dialog).getByRole('textbox', { name: 'Option 1' })
        await user.clear(firstOption)
        await user.type(firstOption, 'Updated first answer')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
        expect(onChange.mock.calls[0]?.[0]).toEqual([
            {
                _localId: 'local-question-1',
                Options: [{ ...optionValues[0], label: 'Updated first answer' }, optionValues[1]]
            }
        ])
    })

    it('persists structured answers through the TABLE edit flow', async () => {
        const user = userEvent.setup()
        apiState.fetchTabularRows.mockResolvedValue({
            items: [{ id: '0190a9b5-3cde-7abc-8def-0123456789ad', Options: optionValues }],
            total: 1
        })
        apiState.updateTabularRow.mockResolvedValue({})

        render(
            <QueryClientProvider client={createQueryClient()}>
                <RuntimeInlineTabularEditor
                    apiBaseUrl='/api/v1'
                    applicationId='0190a9b5-3cde-7abc-8def-0123456789ae'
                    objectCollectionId='0190a9b5-3cde-7abc-8def-0123456789af'
                    parentRecordId='0190a9b5-3cde-7abc-8def-0123456789b0'
                    componentId='0190a9b5-3cde-7abc-8def-0123456789b1'
                    childFields={[optionField]}
                    label='Questions'
                    locale='en'
                />
            </QueryClientProvider>
        )

        await user.click(await screen.findByRole('button', { name: 'Edit answers (2)' }))
        const dialog = screen.getByRole('dialog', { name: 'Answer options' })
        const firstOption = within(dialog).getByRole('textbox', { name: 'Option 1' })
        await user.clear(firstOption)
        await user.type(firstOption, 'Persisted first answer')
        await user.click(within(dialog).getByRole('button', { name: 'Save' }))

        await waitFor(() =>
            expect(updateTabularRow).toHaveBeenCalledWith(
                expect.objectContaining({
                    childRowId: '0190a9b5-3cde-7abc-8def-0123456789ad',
                    data: {
                        Options: [{ ...optionValues[0], label: 'Persisted first answer' }, optionValues[1]]
                    }
                })
            )
        )
    })
})
