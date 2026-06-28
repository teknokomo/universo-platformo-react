import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { buildCellStylePreviewSx, buildTabularColumns, isHiddenTabularField } from '../tabularColumns'
import {
    buildInitialTabularRowValues,
    getTabularStringDisplayValue,
    isLocalizedStringField,
    normalizeTabularRowValues
} from '../tabularCellValues'

const localizedChildField = {
    id: 'title',
    label: 'Title',
    type: 'STRING' as const,
    validationRules: {
        localized: true
    }
}

describe('tabularCellValues', () => {
    it('treats versioned string fields as localized even when localized=false is explicit', () => {
        expect(
            isLocalizedStringField({
                id: 'versioned-title',
                type: 'STRING',
                localized: false,
                validationRules: {
                    localized: false,
                    versioned: true
                }
            })
        ).toBe(true)
    })

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

    it('renders metadata-driven cell style preview for TABLE cell values', () => {
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'CellValue',
                    label: 'Cell Value',
                    type: 'STRING' as const,
                    validationRules: { localized: true },
                    uiConfig: {
                        cellStylePreview: {
                            fillColorField: 'CellFillColor',
                            borderTopColorField: 'BorderTopColor',
                            borderTopWidthField: 'BorderTopWidth',
                            borderTopStyleField: 'BorderTopStyle'
                        }
                    }
                },
                {
                    id: 'CellFillColor',
                    label: 'Fill Color',
                    type: 'REF' as const,
                    refOptions: [{ id: 'color-yellow-id', label: 'Yellow', codename: 'yellow' }]
                },
                {
                    id: 'BorderTopColor',
                    label: 'Top Border Color',
                    type: 'REF' as const,
                    refOptions: [{ id: 'color-gray-id', label: 'Gray', codename: 'gray' }]
                },
                { id: 'BorderTopWidth', label: 'Top Border Width', type: 'STRING' as const },
                { id: 'BorderTopStyle', label: 'Top Border Style', type: 'STRING' as const }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'en'
        })

        const cellValueColumn = columns.find((column) => column.field === 'CellValue')
        expect(cellValueColumn?.renderCell).toBeDefined()

        render(
            <>
                {cellValueColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'CellValue',
                    value: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: {
                                content: 'Attraction between masses.',
                                version: 1,
                                isActive: true
                            }
                        }
                    },
                    row: {
                        id: 'row-1',
                        CellFillColor: 'color-yellow-id',
                        BorderTopColor: 'color-gray-id',
                        BorderTopWidth: '2px',
                        BorderTopStyle: 'solid'
                    }
                } as never)}
            </>
        )

        expect(screen.getByTestId('tabular-cell-style-preview')).toBeInTheDocument()
        expect(screen.getByText('Attraction between masses.')).toBeInTheDocument()
    })

    it('resolves cell style preview codenames to physical row field ids', () => {
        const sx = buildCellStylePreviewSx(
            {
                id: 'row-1',
                'field-fill-color-id': 'color-yellow-id',
                'field-border-top-color-id': 'color-gray-id',
                'field-border-top-width-id': '2px',
                'field-border-top-style-id': 'solid'
            },
            {
                fillColorField: 'CellFillColor',
                borderTopColorField: 'BorderTopColor',
                borderTopWidthField: 'BorderTopWidth',
                borderTopStyleField: 'BorderTopStyle'
            },
            new Map([
                [
                    'field-fill-color-id',
                    {
                        id: 'field-fill-color-id',
                        codename: 'CellFillColor',
                        label: 'Fill Color',
                        type: 'REF' as const,
                        refOptions: [{ id: 'color-yellow-id', label: 'Yellow', codename: 'yellow' }]
                    }
                ],
                [
                    'field-border-top-color-id',
                    {
                        id: 'field-border-top-color-id',
                        codename: 'BorderTopColor',
                        label: 'Top Border Color',
                        type: 'REF' as const,
                        refOptions: [{ id: 'color-gray-id', label: 'Gray', codename: 'gray' }]
                    }
                ],
                [
                    'field-border-top-width-id',
                    { id: 'field-border-top-width-id', codename: 'BorderTopWidth', label: 'Top Border Width', type: 'STRING' as const }
                ],
                [
                    'field-border-top-style-id',
                    { id: 'field-border-top-style-id', codename: 'BorderTopStyle', label: 'Top Border Style', type: 'STRING' as const }
                ]
            ])
        )

        expect(sx).toEqual(expect.objectContaining({ bgcolor: '#fdd835', borderTop: '2px solid #9e9e9e' }))
    })

    it('omits metadata-hidden TABLE child fields from tabular columns', () => {
        const columns = buildTabularColumns({
            childFields: [
                { id: 'CellId', label: 'Cell ID', type: 'STRING' as const, uiConfig: { hidden: true, gridHidden: true } },
                { id: 'CellValue', label: 'Cell Value', type: 'STRING' as const }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'en'
        })

        expect(columns.some((column) => column.field === 'CellId')).toBe(false)
        expect(columns.some((column) => column.field === 'CellValue')).toBe(true)
    })

    it('exposes the same hidden TABLE child field predicate used by tabular columns', () => {
        expect(isHiddenTabularField({ id: 'CellId', label: 'Cell ID', type: 'STRING', uiConfig: { hidden: true } })).toBe(true)
        expect(isHiddenTabularField({ id: 'CellValue', label: 'Cell Value', type: 'STRING' })).toBe(false)
    })

    it('generates stable UUID v7 CellId values for new matrix rows without exposing hidden fields', () => {
        const row = buildInitialTabularRowValues([
            {
                id: 'CellId',
                codename: 'CellId',
                label: 'Cell ID',
                type: 'STRING' as const,
                uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
            },
            {
                id: 'ColKey',
                codename: 'ColKey',
                label: 'Column Key',
                type: 'STRING' as const,
                uiConfig: { hidden: true, gridHidden: true, formHidden: true, serverOwned: true }
            },
            { id: 'IsFeatured', label: 'Featured', type: 'BOOLEAN' as const }
        ])

        expect(row.CellId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        expect(row.ColKey).toBeNull()
        expect(row.IsFeatured).toBe(false)
    })

    it('renders bounded selects for metadata-driven cell border width and style values', () => {
        const onSelectChange = vi.fn()
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'BorderTopWidth',
                    label: 'Top Border Width',
                    type: 'STRING' as const,
                    uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'width' }
                },
                {
                    id: 'BorderTopStyle',
                    label: 'Top Border Style',
                    type: 'STRING' as const,
                    uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top', cellStyleValue: 'lineStyle' }
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            onSelectChange,
            locale: 'en'
        })

        const widthColumn = columns.find((column) => column.field === 'BorderTopWidth')
        render(
            <>
                {widthColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'BorderTopWidth',
                    value: '1px'
                } as never)}
            </>
        )

        const widthSelect = screen.getByRole('combobox')
        fireEvent.mouseDown(widthSelect)
        fireEvent.click(screen.getByRole('option', { name: '2px' }))

        expect(onSelectChange).toHaveBeenCalledWith('row-1', 'BorderTopWidth', '2px')
    })

    it('renders safe display labels for object-backed child STRING values', () => {
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
                        id: '017f22e2-79b0-7cc3-98c4-dc0c0c073990',
                        label: {
                            _schema: '1',
                            _primary: 'en',
                            locales: {
                                en: { content: 'Departure window', version: 1, isActive: true },
                                ru: { content: 'Окно отправления', version: 1, isActive: true }
                            }
                        }
                    }
                } as never)}
            </>
        )

        expect(screen.getByText('Окно отправления')).toBeInTheDocument()
        expect(screen.queryByText(/\{/)).not.toBeInTheDocument()
        expect(screen.queryByText(/\[object Object]/)).not.toBeInTheDocument()
    })

    it('uses the same safe display path for non-localized child STRING object values', () => {
        const plainStringField = {
            id: 'plainTitle',
            label: 'Plain title',
            type: 'STRING' as const,
            localized: false,
            validationRules: {}
        }
        const columns = buildTabularColumns({
            childFields: [plainStringField],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'en'
        })

        const titleColumn = columns.find((column) => column.field === 'plainTitle')
        expect(titleColumn?.renderCell).toBeDefined()

        render(
            <>
                {titleColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'plainTitle',
                    value: { label: 'Readable title', raw: { blocks: [] } }
                } as never)}
            </>
        )

        expect(screen.getByText('Readable title')).toBeInTheDocument()
        expect(screen.queryByText(/\{/)).not.toBeInTheDocument()
        expect(screen.queryByText(/\[object Object]/)).not.toBeInTheDocument()
    })

    it('suppresses raw JSON, UUID, and opaque object STRING display values', () => {
        expect(getTabularStringDisplayValue('{"storageKey":"lesson.pdf","mimeType":"application/pdf"}', 'en')).toBe('')
        expect(getTabularStringDisplayValue('017f22e2-79b0-7cc3-98c4-dc0c0c073990', 'en')).toBe('')
        expect(getTabularStringDisplayValue({ status: ['active'], score: { gte: 80 } }, 'en')).toBe('')
    })

    it('suppresses unresolved REF formatter IDs instead of leaking raw values', () => {
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'ProjectId',
                    label: 'Project',
                    type: 'REF' as const,
                    refOptions: [{ id: 'known-project', label: 'Known project' }],
                    validationRules: {}
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'en'
        })

        const projectColumn = columns.find((column) => column.field === 'ProjectId')

        expect(projectColumn?.valueFormatter?.('known-project', {} as never, projectColumn, {} as never)).toBe('Known project')
        expect(projectColumn?.valueFormatter?.('017f22e2-79b0-7cc3-98c4-dc0c0c073990', {} as never, projectColumn, {} as never)).toBe('')
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

    it('renders semantic child long-text STRING editors as multiline textboxes', () => {
        const setEditCellValue = vi.fn()
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'ItemContent',
                    label: 'Item Content',
                    type: 'STRING' as const,
                    validationRules: {
                        localized: true,
                        versioned: true
                    }
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'en'
        })

        const contentColumn = columns.find((column) => column.field === 'ItemContent')
        expect(contentColumn?.renderEditCell).toBeDefined()

        render(
            <>
                {contentColumn?.renderEditCell?.({
                    id: 'row-1',
                    field: 'ItemContent',
                    value: null,
                    api: {
                        setEditCellValue
                    }
                } as never)}
            </>
        )

        const textbox = screen.getByRole('textbox')
        expect(textbox.tagName).toBe('TEXTAREA')

        fireEvent.change(textbox, { target: { value: 'Long content\nwith a second paragraph' } })

        expect(setEditCellValue).toHaveBeenCalledWith(
            expect.objectContaining({
                value: expect.objectContaining({
                    locales: expect.objectContaining({
                        en: expect.objectContaining({
                            content: 'Long content\nwith a second paragraph'
                        })
                    })
                })
            })
        )
    })

    it('adds accessible labels to inline numeric stepper controls', () => {
        const setEditCellValue = vi.fn()
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'SortOrder',
                    label: 'Sort Order',
                    type: 'NUMBER' as const,
                    validationRules: {}
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru',
            numberIncrementAriaLabel: 'Увеличить',
            numberDecrementAriaLabel: 'Уменьшить'
        })

        const sortOrderColumn = columns.find((column) => column.field === 'SortOrder')
        expect(sortOrderColumn?.renderEditCell).toBeDefined()

        render(
            <>
                {sortOrderColumn?.renderEditCell?.({
                    id: 'row-1',
                    field: 'SortOrder',
                    value: 1,
                    api: {
                        setEditCellValue
                    }
                } as never)}
            </>
        )

        expect(screen.getByRole('button', { name: 'Увеличить' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Уменьшить' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Increase value' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Decrease value' })).not.toBeInTheDocument()
    })

    it('renders localized inline numeric validation helper text', () => {
        const setEditCellValue = vi.fn()
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'Amount',
                    label: 'Amount',
                    type: 'NUMBER' as const,
                    validationRules: { max: 10 }
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru',
            numberIncrementAriaLabel: 'Увеличить',
            numberDecrementAriaLabel: 'Уменьшить',
            numberInvalidMessage: 'Некорректное число',
            getNumberValidationMessage: (_field, result) =>
                result.errorKey === 'aboveMaximum' ? 'Максимальное значение: 10' : 'Некорректное число'
        })

        const amountColumn = columns.find((column) => column.field === 'Amount')
        expect(amountColumn?.preProcessEditCellProps).toBeDefined()
        expect(amountColumn?.renderEditCell).toBeDefined()

        const processed = amountColumn?.preProcessEditCellProps?.({
            props: { value: 11 }
        } as never) as { error?: boolean; helperText?: string }

        expect(processed).toMatchObject({
            error: true,
            helperText: 'Максимальное значение: 10'
        })

        render(
            <>
                {amountColumn?.renderEditCell?.({
                    id: 'row-1',
                    field: 'Amount',
                    value: 11,
                    error: processed.error,
                    helperText: processed.helperText,
                    api: {
                        setEditCellValue
                    }
                } as never)}
            </>
        )

        expect(screen.getByRole('alert')).toHaveTextContent('Максимальное значение: 10')
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

    it('normalizes object-backed localized STRING fields from safe display text', () => {
        const normalizedRow = normalizeTabularRowValues(
            {
                title: {
                    label: {
                        _schema: '1',
                        _primary: 'en',
                        locales: {
                            en: { content: 'Safety handoff', version: 1, isActive: true },
                            ru: { content: 'Передача безопасности', version: 1, isActive: true }
                        }
                    }
                }
            },
            [localizedChildField],
            'ru'
        )

        expect(normalizedRow.title).toEqual(
            expect.objectContaining({
                _primary: 'ru',
                locales: expect.objectContaining({
                    ru: expect.objectContaining({
                        content: 'Передача безопасности'
                    })
                })
            })
        )
    })

    it('renders JSON child values as useful text instead of object stringification', () => {
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'Options',
                    label: 'Options',
                    type: 'JSON' as const,
                    validationRules: {}
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru'
        })

        const optionsColumn = columns.find((column) => column.field === 'Options')
        expect(optionsColumn?.renderCell).toBeDefined()

        render(
            <>
                {optionsColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'Options',
                    value: [
                        {
                            id: 'a',
                            label: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Departure window', version: 1, isActive: true },
                                    ru: { content: 'Окно отправления', version: 1, isActive: true }
                                }
                            }
                        },
                        {
                            id: 'b',
                            label: {
                                _schema: '1',
                                _primary: 'en',
                                locales: {
                                    en: { content: 'Docking corridor', version: 1, isActive: true },
                                    ru: { content: 'Коридор стыковки', version: 1, isActive: true }
                                }
                            }
                        }
                    ]
                } as never)}
            </>
        )

        expect(screen.getByText('Окно отправления, Коридор стыковки')).toBeInTheDocument()
        expect(screen.queryByText(/\[object Object]/)).not.toBeInTheDocument()
    })

    it('renders cell line style options as localized labels in tabular editors', () => {
        const columns = buildTabularColumns({
            childFields: [
                {
                    id: 'BorderTopStyle',
                    label: 'Top Border Style',
                    type: 'STRING' as const,
                    validationRules: {},
                    uiConfig: {
                        widget: 'cellStylePicker',
                        cellStyleValue: 'lineStyle'
                    }
                }
            ],
            rowNumberById: new Map([['row-1', 1]]),
            onDeleteRow: vi.fn(),
            locale: 'ru'
        })

        const styleColumn = columns.find((column) => column.field === 'BorderTopStyle')
        expect(styleColumn?.renderCell).toBeDefined()
        expect(styleColumn?.valueFormatter?.('dashed' as never)).toBe('Штриховая')

        render(
            <>
                {styleColumn?.renderCell?.({
                    id: 'row-1',
                    field: 'BorderTopStyle',
                    value: 'dashed'
                } as never)}
            </>
        )

        expect(screen.getByText('Штриховая')).toBeInTheDocument()
        expect(screen.queryByText('dashed')).not.toBeInTheDocument()
    })
})
