import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FieldConfig } from '../../components/dialogs/fieldConfig'
import { buildTabularReferenceColumn } from '../tabularReferenceColumns'

const key = '0199a9b5-3cde-7abc-8def-0123456789ab'
const field: FieldConfig = {
    id: 'question-block-key',
    codename: 'BlockKey',
    label: 'Block',
    type: 'STRING',
    uiConfig: {
        siblingRowSelect: {
            tableCodename: 'Blocks',
            valueFieldCodename: 'BlockKey',
            labelFieldCodename: 'Title',
            requiredWithRows: true
        }
    }
}

const buildColumn = (rows: Array<Record<string, unknown>>, onSelectChange = vi.fn()) =>
    buildTabularReferenceColumn(field, {
        locale: 'en',
        siblingTableValues: {
            Blocks: {
                rows,
                childFields: [
                    { id: 'BlockKey', codename: 'BlockKey' },
                    { id: 'Title', codename: 'Title' }
                ]
            }
        },
        onSelectChange,
        siblingSelectPlaceholderLabel: 'Choose a block',
        siblingNoOptionsLabel: 'No available blocks',
        siblingNoSelectableOptionsLabel: 'Blocks exist, but none has a usable label',
        siblingUnavailableLabel: 'Unavailable block'
    })

describe('buildTabularReferenceColumn', () => {
    it('matches UUID keys case-insensitively and keeps required selectors from being cleared while targets exist', async () => {
        const onSelectChange = vi.fn()
        const column = buildColumn([{ BlockKey: key, Title: 'Introduction' }], onSelectChange)
        expect(column?.valueFormatter?.(key.toUpperCase())).toBe('Introduction')
        const cell = column?.renderCell?.({
            id: 'question-row',
            field: field.id,
            value: key.toUpperCase(),
            tabIndex: 0,
            hasFocus: false
        } as never)

        render(<>{cell}</>)
        const select = screen.getByRole('combobox', { name: 'Block' })
        expect(select).toHaveTextContent('Introduction')

        const user = userEvent.setup()
        await user.click(select)
        const emptyOption = screen.getByRole('option', { name: 'Choose a block' })
        expect(emptyOption).toHaveClass('Mui-disabled')
        expect(emptyOption).toHaveAttribute('aria-disabled', 'true')
        await user.keyboard('{Home}{Enter}')
        expect(onSelectChange).not.toHaveBeenCalled()
        expect(select).toHaveTextContent('Introduction')
    })

    it('allows clearing the selector when no target rows remain', async () => {
        const column = buildColumn([])
        const cell = column?.renderCell?.({
            id: 'question-row',
            field: field.id,
            value: key,
            tabIndex: 0,
            hasFocus: false
        } as never)

        render(<>{cell}</>)
        await userEvent.click(screen.getByRole('combobox', { name: 'Block' }))
        const emptyOption = screen.getByRole('option', { name: 'No available blocks' })
        expect(emptyOption).not.toHaveClass('Mui-disabled')
        expect(emptyOption).not.toHaveAttribute('aria-disabled', 'true')
    })

    it('keeps a required selector blocked when source rows exist but none has a safe label', async () => {
        const column = buildColumn([{ BlockKey: key, Title: '{"private":"value"}' }])
        const cell = column?.renderCell?.({
            id: 'question-row',
            field: field.id,
            value: key,
            tabIndex: 0,
            hasFocus: false
        } as never)

        render(<>{cell}</>)
        await userEvent.click(screen.getByRole('combobox', { name: 'Block' }))
        const unavailableOption = screen.getByRole('option', { name: 'Blocks exist, but none has a usable label' })
        expect(unavailableOption).toHaveAttribute('aria-disabled', 'true')
        expect(screen.getByRole('option', { name: 'Unavailable block' })).toHaveAttribute('aria-disabled', 'true')
    })

    it('lets keyboard users select an available sibling row', async () => {
        const user = userEvent.setup()
        const onSelectChange = vi.fn()
        const column = buildTabularReferenceColumn(field, {
            locale: 'en',
            siblingTableValues: {
                Blocks: {
                    rows: [
                        { BlockKey: key, Title: 'Opening' },
                        { BlockKey: '0199a9b5-3cde-7abc-8def-0123456789ac', Title: 'Closing' }
                    ],
                    childFields: [
                        { id: 'BlockKey', codename: 'BlockKey' },
                        { id: 'Title', codename: 'Title' }
                    ]
                }
            },
            onSelectChange,
            siblingSelectPlaceholderLabel: 'Choose a block',
            siblingNoOptionsLabel: 'No available blocks',
            siblingNoSelectableOptionsLabel: 'Blocks exist, but none has a usable label',
            siblingUnavailableLabel: 'Unavailable block'
        })
        const cell = column?.renderCell?.({
            id: 'question-row',
            field: field.id,
            value: '',
            tabIndex: 0,
            hasFocus: false
        } as never)

        render(<>{cell}</>)
        await user.tab()
        await user.keyboard('{ArrowDown}')
        await user.keyboard('{ArrowDown}{Enter}')

        expect(onSelectChange).toHaveBeenCalledWith('question-row', field.id, '0199a9b5-3cde-7abc-8def-0123456789ac')
    })
})
