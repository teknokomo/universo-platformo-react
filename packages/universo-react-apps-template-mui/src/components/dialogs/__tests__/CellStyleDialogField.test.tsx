import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CellStyleDialogField } from '../CellStyleDialogField'
import type { FieldConfig } from '../FormDialog'

const theme = createTheme()

const baseField: FieldConfig = {
    id: 'CellFillColor',
    type: 'STRING',
    label: 'Fill Color',
    uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'fill' }
}

const topField: FieldConfig = {
    id: 'BorderTopColor',
    type: 'STRING',
    label: 'Top Border Color',
    uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top' }
}

const renderWithTheme = (ui: React.ReactNode) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('CellStyleDialogField', () => {
    it('renders the fill picker with 12 color chips and a live preview box', () => {
        renderWithTheme(<CellStyleDialogField field={baseField} value='none' onChange={() => undefined} />)

        const picker = screen.getByTestId('cell-style-picker-CellFillColor')
        const colorButtons = within(picker).getAllByRole('button')
        expect(colorButtons).toHaveLength(12)
        expect(within(picker).getByTestId('cell-style-picker-CellFillColor-preview')).toBeInTheDocument()
    })

    it('selects the matching color chip when given an initial value', () => {
        renderWithTheme(<CellStyleDialogField field={baseField} value='red' onChange={() => undefined} />)
        const redChip = screen.getByLabelText(/red/i)
        expect(redChip.getAttribute('aria-pressed')).toBe('true')
    })

    it('calls onChange with the picked color when a chip is clicked', () => {
        const onChange = vi.fn()
        renderWithTheme(<CellStyleDialogField field={baseField} value='none' onChange={onChange} />)

        const blueChip = screen.getByLabelText(/blue/i)
        fireEvent.click(blueChip)

        expect(onChange).toHaveBeenCalledWith('blue')
    })

    it('preserves REF option ids for color fields while rendering codename chips', () => {
        const onChange = vi.fn()
        const refField: FieldConfig = {
            id: 'CellFillColor',
            type: 'REF',
            label: 'Fill Color',
            uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'fill', cellStyleValue: 'color' },
            refOptions: [
                { id: 'color-red-id', label: 'Red', codename: 'red' },
                { id: 'color-blue-id', label: 'Blue', codename: 'blue' }
            ]
        }
        renderWithTheme(<CellStyleDialogField field={refField} value='color-red-id' onChange={onChange} />)

        expect(screen.getByLabelText(/red/i).getAttribute('aria-pressed')).toBe('true')
        fireEvent.click(screen.getByLabelText(/blue/i))

        expect(onChange).toHaveBeenCalledWith('color-blue-id')
    })

    it('keeps color fields scoped to color chips only', () => {
        renderWithTheme(<CellStyleDialogField field={topField} value='none' onChange={() => undefined} />)
        expect(screen.queryByTestId('cell-style-picker-BorderTopColor-width')).not.toBeInTheDocument()
        expect(screen.queryByTestId('cell-style-picker-BorderTopColor-style')).not.toBeInTheDocument()
    })

    it('emits a new width when the width Select changes', () => {
        const onChange = vi.fn()
        const widthField: FieldConfig = {
            id: 'BorderTopWidth',
            type: 'STRING',
            label: 'Top Border Width',
            uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top' }
        }
        renderWithTheme(<CellStyleDialogField field={widthField} value='none' onChange={onChange} />)

        const widthInput = screen.getByTestId('cell-style-picker-BorderTopWidth-width')
        fireEvent.change(widthInput, { target: { value: '2px' } })

        expect(onChange).toHaveBeenCalledWith('2px')
        expect(screen.queryByLabelText(/top red/i)).not.toBeInTheDocument()
    })

    it('emits a new style when the style Select changes', () => {
        const onChange = vi.fn()
        const styleField: FieldConfig = {
            id: 'BorderTopStyle',
            type: 'STRING',
            label: 'Top Border Style',
            uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top' }
        }
        renderWithTheme(<CellStyleDialogField field={styleField} value='none' onChange={onChange} />)

        const styleInput = screen.getByTestId('cell-style-picker-BorderTopStyle-style')
        fireEvent.change(styleInput, { target: { value: 'dashed' } })

        expect(onChange).toHaveBeenCalledWith('dashed')
        expect(screen.queryByLabelText(/top red/i)).not.toBeInTheDocument()
    })

    it('preserves a scalar width value (e.g. "2px") instead of resetting to defaults', () => {
        // Re-rendering the widget for an existing row whose BorderTopWidth
        // was previously set to "2px" must not silently drop the value.
        const widthField: FieldConfig = {
            id: 'BorderTopWidth',
            type: 'STRING',
            label: 'Top Border Width',
            uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top' }
        }
        renderWithTheme(<CellStyleDialogField field={widthField} value='2px' onChange={() => undefined} />)

        const widthInput = screen.getByTestId('cell-style-picker-BorderTopWidth-width')
        expect((widthInput as HTMLInputElement).value).toBe('2px')
    })

    it('preserves a scalar style value (e.g. "dashed") instead of resetting to defaults', () => {
        const styleField: FieldConfig = {
            id: 'BorderTopStyle',
            type: 'STRING',
            label: 'Top Border Style',
            uiConfig: { widget: 'cellStylePicker', cellStyleFor: 'top' }
        }
        renderWithTheme(<CellStyleDialogField field={styleField} value='dashed' onChange={() => undefined} />)

        const styleInput = screen.getByTestId('cell-style-picker-BorderTopStyle-style')
        expect((styleInput as HTMLInputElement).value).toBe('dashed')
    })

    it('renders a full object state when a caller provides one', () => {
        renderWithTheme(
            <CellStyleDialogField
                field={topField}
                value={{
                    fill: 'yellow',
                    borders: {
                        top: { color: 'red', width: '2px', style: 'dashed' },
                        right: { color: 'blue', width: '1px', style: 'solid' },
                        bottom: { color: 'green', width: '3px', style: 'dotted' },
                        left: { color: 'purple', width: '4px', style: 'double' }
                    }
                }}
                onChange={() => undefined}
            />
        )

        expect(screen.getByLabelText(/top red/i).getAttribute('aria-pressed')).toBe('true')
    })

    it('falls back to defaults for null and invalid scalar values', () => {
        renderWithTheme(<CellStyleDialogField field={baseField} value={null} onChange={() => undefined} />)
        expect(screen.getByLabelText(/fill none/i).getAttribute('aria-pressed')).toBe('true')

        renderWithTheme(<CellStyleDialogField field={topField} value='not-a-color' onChange={() => undefined} />)
        const pickers = screen.getAllByTestId('cell-style-picker-BorderTopColor')
        expect(
            within(pickers[0])
                .getByLabelText(/top none/i)
                .getAttribute('aria-pressed')
        ).toBe('true')
    })

    it('auto-detects the controlled side and value kind from the field codename', () => {
        const onChange = vi.fn()
        const widthField: FieldConfig = {
            id: 'BorderRightWidth',
            type: 'STRING',
            label: 'Right Border Width',
            uiConfig: { widget: 'cellStylePicker' }
        }
        renderWithTheme(<CellStyleDialogField field={widthField} value='1px' onChange={onChange} />)

        const widthInput = screen.getByTestId('cell-style-picker-BorderRightWidth-width')
        expect((widthInput as HTMLInputElement).value).toBe('1px')
        fireEvent.change(widthInput, { target: { value: '3px' } })
        expect(onChange).toHaveBeenCalledWith('3px')
    })
})
