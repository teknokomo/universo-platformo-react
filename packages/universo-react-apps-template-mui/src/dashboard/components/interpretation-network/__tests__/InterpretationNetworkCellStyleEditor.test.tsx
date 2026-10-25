import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { normalizeInterpretationNetworkCellStylePolicy } from '@universo-react/types'
import type { FieldConfig } from '../../../../components/dialogs/FormDialog'
import { InterpretationNetworkCellStyleEditor } from '../InterpretationNetworkCellStyleEditor'

const t = ((key: string, options?: unknown) => {
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
}) as TFunction<'interpretationNetwork'>

describe('InterpretationNetworkCellStyleEditor HEX color control', () => {
    it('keeps the HEX input before the popover trigger and applies picker changes', async () => {
        const user = userEvent.setup()
        const field: FieldConfig = { id: 'fill-color', codename: 'CellFillColor', label: 'Fill', type: 'STRING' }
        const onChange = vi.fn()
        render(
            <InterpretationNetworkCellStyleEditor
                t={t}
                fields={[field]}
                draft={{ 'fill-color': '#112233' }}
                disabled={false}
                policy={normalizeInterpretationNetworkCellStylePolicy({ allowCustomColors: true })}
                onChange={onChange}
            />
        )

        const input = screen.getByRole('textbox', { name: 'Fill Hex color' }) as HTMLInputElement
        expect(input.type).toBe('text')
        const pickerButton = screen.getByRole('button', { name: 'Fill color picker' })
        expect(input.compareDocumentPosition(pickerButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        await user.click(pickerButton)
        const pickerDialog = screen.getByRole('dialog', { name: 'Fill color picker' })
        const hexPicker = pickerDialog.querySelector('.react-colorful') as HTMLElement | null
        expect(hexPicker).not.toBeNull()
        expect(hexPicker).toHaveStyle({ width: '240px', height: '160px' })

        fireEvent.change(input, { target: { value: '#abcdef' } })
        expect(onChange).toHaveBeenCalledWith(field, '#ABCDEF')
    })
})
