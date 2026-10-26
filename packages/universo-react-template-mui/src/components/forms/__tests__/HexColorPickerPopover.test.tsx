import { fireEvent, render, screen } from '@testing-library/react'
import { HexColorPickerPopover } from '../HexColorPickerPopover'

describe('HexColorPickerPopover', () => {
    it('shows and accepts the value in HEX form', () => {
        const onChange = jest.fn()
        render(
            <HexColorPickerPopover
                id='cell-color'
                label='Cell color (HEX)'
                pickerLabel='Choose cell color'
                value='#1E88E5'
                onChange={onChange}
            />
        )

        const input = screen.getByRole('textbox', { name: 'Cell color (HEX)' })
        expect(input).toHaveValue('#1E88E5')
        fireEvent.change(input, { target: { value: '#abcdef' } })
        expect(onChange).toHaveBeenCalledWith('#ABCDEF')
    })

    it('opens a HEX-only color picker from the swatch button', () => {
        render(
            <HexColorPickerPopover
                id='cell-color'
                label='Cell color (HEX)'
                pickerLabel='Choose cell color'
                value='#1E88E5'
                onChange={jest.fn()}
            />
        )

        const pickerButton = screen.getByRole('button', { name: 'Choose cell color' })
        expect(pickerButton).toHaveClass('MuiIconButton-sizeSmall')
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px' })
        fireEvent.click(pickerButton)
        expect(screen.getByRole('dialog', { name: 'Choose cell color' })).toBeInTheDocument()
        expect(screen.queryByText('RGB')).not.toBeInTheDocument()
    })

    it('keeps the swatch compact when the HEX input uses the medium field size', () => {
        render(
            <HexColorPickerPopover
                id='cell-color'
                label='Cell color (HEX)'
                pickerLabel='Choose cell color'
                value='#1E88E5'
                size='medium'
                onChange={jest.fn()}
            />
        )

        const input = screen.getByRole('textbox', { name: 'Cell color (HEX)' })
        expect(input.closest('.MuiOutlinedInput-root')).not.toHaveClass('MuiInputBase-sizeSmall')

        const pickerButton = screen.getByRole('button', { name: 'Choose cell color' })
        expect(pickerButton).toHaveClass('MuiIconButton-sizeSmall')
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px' })
    })
})
