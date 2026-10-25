import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HexColorField } from '../HexColorField'
import enApps from '../../../i18n/locales/en/apps.json'
import ruApps from '../../../i18n/locales/ru/apps.json'
import enInterpretationNetwork from '../../../i18n/locales/en/interpretationNetwork.json'
import ruInterpretationNetwork from '../../../i18n/locales/ru/interpretationNetwork.json'

describe('HexColorField', () => {
    it('edits HEX text and opens a fixed-width HEX picker in a labeled MUI popover', async () => {
        const user = userEvent.setup()
        const onChange = vi.fn()
        render(
            <HexColorField
                id='matrix-cell-fill'
                label='Fill color (HEX)'
                pickerLabel='Choose fill color'
                value='#1E88E5'
                testId='matrix-cell-fill-hex'
                onChange={onChange}
            />
        )

        const input = screen.getByRole('textbox', { name: 'Fill color (HEX)' }) as HTMLInputElement
        expect(input.type).toBe('text')
        fireEvent.change(input, { target: { value: '#abcdef' } })
        expect(onChange).toHaveBeenCalledWith('#ABCDEF')

        const pickerButton = screen.getByRole('button', { name: 'Choose fill color' })
        expect(pickerButton).toHaveClass('MuiIconButton-sizeSmall')
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px' })
        const inputFrame = input.closest('.MuiOutlinedInput-root')
        const adornment = inputFrame?.querySelector('.MuiInputAdornment-positionEnd')
        expect(inputFrame).not.toBeNull()
        expect(adornment?.parentElement).toBe(inputFrame)
        expect(pickerButton.parentElement).toBe(adornment)
        expect(inputFrame).toHaveStyle({ height: '40px', alignItems: 'center' })
        expect(adornment).toHaveStyle({ height: '32px', maxHeight: '32px', alignSelf: 'center', marginRight: '0px' })
        expect(pickerButton).toHaveStyle({ width: '32px', height: '32px', margin: '0px' })
        await user.click(pickerButton)

        const pickerDialog = screen.getByRole('dialog', { name: 'Choose fill color' })
        const hexPicker = pickerDialog.querySelector('.react-colorful') as HTMLElement | null
        expect(hexPicker).not.toBeNull()
        expect(hexPicker).toHaveStyle({ width: '240px', height: '160px' })
        expect(pickerDialog).not.toHaveTextContent('RGB')
    })

    it('keeps workspace and cell HEX labels localized in English and Russian', () => {
        for (const resources of [enApps, ruApps]) {
            expect(resources.workspace.widgetSettings.colorNumber).toContain('(HEX)')
            expect(resources.workspace.widgetSettings.newColor).toContain('(HEX)')
            expect(resources.workspace.widgetSettings.invalidHexColor).toBeTruthy()
        }
        for (const resources of [enInterpretationNetwork, ruInterpretationNetwork]) {
            expect(resources.workspace.sectionTabs).toBeTruthy()
            expect(resources.cellStyle.hexColorField).toContain('{{label}}')
        }
    })
})
