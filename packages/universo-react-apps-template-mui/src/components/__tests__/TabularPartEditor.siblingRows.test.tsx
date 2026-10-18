import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TabularPartEditor } from '../TabularPartEditor'
import type { FieldConfig } from '../dialogs/fieldConfig'

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        i18n: { language: 'en' }
    })
}))

vi.mock('@mui/x-data-grid', async () => {
    const actual = await vi.importActual<typeof import('@mui/x-data-grid')>('@mui/x-data-grid')

    type MockColumn = {
        field: string
        headerName?: string
        renderCell?: (params: { id: string; field: string; value: unknown; row: Record<string, unknown>; tabIndex: number }) => ReactNode
    }
    type MockProps = { rows: Array<Record<string, unknown>>; columns: MockColumn[] }
    const renderMockDataGrid = (props: MockProps): ReactNode => (
        <div role='grid'>
            {props.rows.map((row) => (
                <div role='row' key={String(row.id)}>
                    {props.columns.map((column) => (
                        <div role='gridcell' key={column.field}>
                            {column.renderCell
                                ? column.renderCell({
                                      id: String(row.id),
                                      field: column.field,
                                      value: row[column.field],
                                      row,
                                      tabIndex: 0
                                  })
                                : String(row[column.field] ?? '')}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )

    return {
        ...actual,
        DataGrid: renderMockDataGrid,
        useGridApiRef: () => ({ current: { setCellFocus: vi.fn(), startCellEditMode: vi.fn() } })
    }
})

const blockKeyA = '0199a9b5-3cde-7abc-8def-0123456789ab'
const blockKeyB = '0199a9b5-3cde-7abc-8def-0123456789ac'

const questionFields: FieldConfig[] = [
    { id: 'Prompt', codename: 'Prompt', label: 'Question', type: 'STRING' },
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
    },
    { id: 'SortOrder', codename: 'SortOrder', label: 'Order', type: 'NUMBER' }
]

const siblingTableValues = {
    Blocks: {
        rows: [
            { BlockKey: blockKeyA, Title: 'First block', SortOrder: 1 },
            { BlockKey: blockKeyB, Title: 'Second block', SortOrder: 2 }
        ],
        childFields: [
            { id: 'BlockKey', codename: 'BlockKey' },
            { id: 'Title', codename: 'Title' },
            { id: 'SortOrder', codename: 'SortOrder' }
        ],
        rowOrdering: { orderFieldCodename: 'SortOrder', labelFieldCodename: 'Title' }
    }
}

describe('TabularPartEditor sibling TABLE references', () => {
    it('offers human-readable sibling rows and emits the semantic key in create mode', async () => {
        const onChange = vi.fn()
        render(
            <TabularPartEditor
                label='Questions'
                value={[{ _localId: 'question-1', Prompt: 'Question one', BlockKey: null, SortOrder: 1 }]}
                onChange={onChange}
                childFields={questionFields}
                siblingTableValues={siblingTableValues}
                rowOrdering={{ orderFieldCodename: 'SortOrder', labelFieldCodename: 'Prompt' }}
                locale='en'
            />
        )

        fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Block' }))
        fireEvent.click(await screen.findByRole('option', { name: 'Second block' }))

        expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ Prompt: 'Question one', BlockKey: blockKeyB, SortOrder: 1 })])
        expect(screen.queryByText(blockKeyB)).not.toBeInTheDocument()
    })

    it('reorders create-mode question rows while preserving block keys and canonical order values', async () => {
        const onChange = vi.fn()
        render(
            <TabularPartEditor
                label='Questions'
                value={[
                    { _localId: 'question-1', Prompt: 'Question one', BlockKey: blockKeyA, SortOrder: 1 },
                    { _localId: 'question-2', Prompt: 'Question two', BlockKey: blockKeyB, SortOrder: 2 }
                ]}
                onChange={onChange}
                childFields={questionFields}
                siblingTableValues={siblingTableValues}
                rowOrdering={{ orderFieldCodename: 'SortOrder', labelFieldCodename: 'Prompt' }}
                locale='en'
            />
        )

        fireEvent.click(screen.getAllByRole('button', { name: 'Actions' })[1])
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Move up: Question two' }))

        await waitFor(() => {
            expect(onChange).toHaveBeenLastCalledWith([
                expect.objectContaining({ Prompt: 'Question two', BlockKey: blockKeyB, SortOrder: 1 }),
                expect.objectContaining({ Prompt: 'Question one', BlockKey: blockKeyA, SortOrder: 2 })
            ])
        })
    })
})
