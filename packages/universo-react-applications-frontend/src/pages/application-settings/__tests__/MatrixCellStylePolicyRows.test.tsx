import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { MatrixSettingsRowsProps } from '../matrixSettingsTypes'
import type { InterpretationNetworkMatrixSettings } from '../matrixSettingsTypes'
import { MatrixCellStylePolicyRows } from '../MatrixCellStylePolicyRows'
import enApplications from '../../../i18n/locales/en/applications.json'
import ruApplications from '../../../i18n/locales/ru/applications.json'

vi.mock('@universo-react/template-mui', async () => {
    const { HexColorPickerPopover } = await import('../../../../../universo-react-template-mui/src/components/forms/HexColorPickerPopover')
    return { HexColorPickerPopover }
})

const settings = {
    cellStylePolicy: {
        allowedColors: ['#000000'],
        allowCustomColors: true,
        editable: {
            fillColor: true,
            textColor: true,
            borderColor: true,
            borderWidth: true,
            borderStyle: true
        }
    }
} as unknown as InterpretationNetworkMatrixSettings

const translate = ((key: string, options?: unknown) => {
    const template =
        typeof options === 'string'
            ? options
            : options && typeof options === 'object' && 'defaultValue' in options
            ? String((options as { defaultValue?: unknown }).defaultValue ?? key)
            : key
    if (!options || typeof options !== 'object') return template
    return Object.entries(options as Record<string, unknown>).reduce(
        (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
        template
    )
}) as MatrixSettingsRowsProps['t']

describe('MatrixCellStylePolicyRows color editing', () => {
    it('uses a HEX text input and a sized HEX picker before adding a normalized allowed color', async () => {
        const user = userEvent.setup()
        const setLocalSettings = vi.fn()
        render(<MatrixCellStylePolicyRows t={translate} isSaving={false} localSettings={settings} setLocalSettings={setLocalSettings} />)

        const input = screen.getByRole('textbox', { name: 'New color (HEX)' }) as HTMLInputElement
        expect(input.type).toBe('text')
        expect(input.closest('.MuiFormControl-root')).toHaveStyle({ width: '100%' })
        fireEvent.change(input, { target: { value: '#ZZZZZZ' } })
        expect(screen.getByText('Enter a valid HEX color, such as #1E88E5.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add color' })).toBeDisabled()

        fireEvent.change(input, { target: { value: '#abcdef' } })
        expect(input).toHaveValue('#ABCDEF')
        const pickerButton = screen.getByRole('button', { name: 'Choose color for New color (HEX)' })
        expect(pickerButton).toHaveStyle({ width: '40px', height: '40px' })
        expect(screen.getByRole('button', { name: 'Add color' })).toHaveStyle({ minHeight: '40px', minWidth: '112px' })
        await user.click(pickerButton)

        const pickerDialog = screen.getByRole('dialog', { name: 'Choose color for New color (HEX)' })
        const hexPicker = pickerDialog.querySelector('.react-colorful') as HTMLElement | null
        expect(hexPicker).not.toBeNull()
        expect(hexPicker).toHaveStyle({ width: '240px', height: '160px' })
        expect(pickerDialog).not.toHaveTextContent('RGB')
        await user.keyboard('{Escape}')

        await user.click(screen.getByRole('button', { name: 'Add color' }))
        const update = setLocalSettings.mock.calls.at(-1)?.[0]
        expect(typeof update).toBe('function')
        if (typeof update === 'function') {
            expect(update(settings).cellStylePolicy.allowedColors).toEqual(['#000000', '#ABCDEF'])
        }
    })

    it('keeps the picker adornment inside the HEX field and vertically aligned to its bounds', () => {
        render(<MatrixCellStylePolicyRows t={translate} isSaving={false} localSettings={settings} setLocalSettings={vi.fn()} />)

        const input = screen.getByRole('textbox', { name: 'New color (HEX)' })
        const field = input.closest('.MuiOutlinedInput-root')
        const adornment = field?.querySelector('.MuiInputAdornment-positionEnd')
        const pickerButton = screen.getByRole('button', { name: 'Choose color for New color (HEX)' })

        expect(field).not.toBeNull()
        expect(adornment?.parentElement).toBe(field)
        expect(pickerButton.parentElement).toBe(adornment)
        expect(field).toHaveStyle({ height: '40px', alignItems: 'center' })
        expect(adornment).toHaveStyle({ height: '100%', maxHeight: 'none', alignItems: 'center' })
        expect(pickerButton).toHaveStyle({ width: '40px', height: '40px', margin: '0px' })
        expect(pickerButton).not.toHaveStyle({ marginRight: '-12px' })
    })

    it('keeps visible HEX color instructions in English and Russian resources', () => {
        for (const resources of [enApplications, ruApplications]) {
            const labels = resources.applications.settings.matrix.cellStylePolicy
            expect(labels.newColor).toContain('HEX')
            expect(labels.colorPicker).toContain('{{label}}')
            expect(labels.invalidHexColor).toBeTruthy()
        }
    })
})
