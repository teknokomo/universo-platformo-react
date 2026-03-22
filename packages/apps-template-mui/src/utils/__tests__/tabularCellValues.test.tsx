import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildTabularColumns } from '../tabularColumns'
import { normalizeTabularRowValues } from '../tabularCellValues'

const localizedChildField = {
    id: 'title',
    label: 'Title',
    type: 'STRING' as const,
    validationRules: {
        localized: true
    }
}

describe('tabularCellValues', () => {
    it('renders localized child STRING values as text instead of object stringification', () => {
        const columns = buildTabularColumns({
            childFields: [localizedChildField],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru'
        })

        const titleColumn = columns.find((column) => column.field === 'title')
        expect(titleColumn?.renderCell).toBeDefined()

        render(
            <>
                {titleColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'title',
                    value: {
                        _schema: '1',
                        _primary: 'ru',
                        locales: {
                            ru: {
                                content: 'Лимоны',
                                version: 1,
                                isActive: true
                            }
                        }
                    }
                } as never)}
            </>
        )

        expect(screen.getByText('Лимоны')).toBeInTheDocument()
    })

    it('serializes edited localized child STRING values as VLC objects', () => {
        const setEditCellValue = vi.fn()
        const columns = buildTabularColumns({
            childFields: [localizedChildField],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru'
        })

        const titleColumn = columns.find((column) => column.field === 'title')
        expect(titleColumn?.renderEditCell).toBeDefined()

        render(
            <>
                {titleColumn?.renderEditCell?.({
                    id: 'row-1',
                    field: 'title',
                    value: null,
                    api: {
                        setEditCellValue
                    }
                } as never)}
            </>
        )

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Лимоны' } })

        expect(setEditCellValue).toHaveBeenCalledWith(
            expect.objectContaining({
                value: expect.objectContaining({
                    _primary: 'ru',
                    locales: expect.objectContaining({
                        ru: expect.objectContaining({
                            content: 'Лимоны'
                        })
                    })
                })
            })
        )
    })

    it('normalizes child rows before submit for localized STRING fields', () => {
        const normalizedRow = normalizeTabularRowValues(
            {
                title: 'Чистая вода',
                amount: 0.7
            },
            [
                localizedChildField,
                {
                    id: 'amount',
                    label: 'Amount',
                    type: 'NUMBER' as const,
                    validationRules: {}
                }
            ],
            'ru'
        )

        expect(normalizedRow.title).toEqual(
            expect.objectContaining({
                _primary: 'ru',
                locales: expect.objectContaining({
                    ru: expect.objectContaining({
                        content: 'Чистая вода'
                    })
                })
            })
        )
        expect(normalizedRow.amount).toBe(0.7)
    })
})
