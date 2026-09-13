import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { LayoutZoneSettingsDialog } from '../LayoutZoneSettingsDialog'

const labels = {
    inherited: 'Inherited from the base layout',
    customized: 'Customized for this layout',
    cancel: 'Cancel',
    save: 'Save',
    reset: 'Reset',
    saving: 'Saving'
}

const settings = [
    {
        key: 'position',
        kind: 'enum' as const,
        label: 'Header behavior',
        options: [
            { value: 'fixed', label: 'Fixed' },
            { value: 'flow', label: 'Scrolls with page' }
        ]
    }
]

describe('LayoutZoneSettingsDialog', () => {
    it('saves an explicit position and resets a local override through the shared dialog contract', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn().mockResolvedValue(undefined)
        const onReset = jest.fn().mockResolvedValue(undefined)

        render(
            <LayoutZoneSettingsDialog
                open
                title='Marketing header settings'
                settings={settings}
                values={{ position: 'fixed' }}
                inherited={false}
                labels={labels}
                onClose={() => undefined}
                onSave={onSave}
                onReset={onReset}
            />
        )

        await user.click(screen.getByRole('radio', { name: 'Scrolls with page' }))
        await user.click(screen.getByRole('button', { name: 'Save' }))

        expect(onSave).toHaveBeenCalledWith({ position: 'flow' })
        expect(screen.getByTestId('layout-zone-settings-actions')).toHaveClass('MuiDialogActions-root')
        expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled()

        await user.click(screen.getByRole('button', { name: 'Reset' }))
        expect(onReset).toHaveBeenCalledTimes(1)
    })

    it('does not expose mutation controls for an inherited read-only state', () => {
        const onSave = jest.fn()
        const onReset = jest.fn()

        render(
            <LayoutZoneSettingsDialog
                open
                title='Marketing header settings'
                settings={settings}
                values={{ position: 'fixed' }}
                inherited
                readOnly
                labels={labels}
                onClose={() => undefined}
                onSave={onSave}
                onReset={onReset}
            />
        )

        expect(screen.getByRole('radiogroup', { name: 'Header behavior' })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'Fixed' })).toBeDisabled()
        expect(screen.getByRole('radio', { name: 'Scrolls with page' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
        expect(screen.getByText('Inherited from the base layout')).toBeInTheDocument()
    })

    it('does not offer reset for an inherited value even when the dialog is editable', () => {
        render(
            <LayoutZoneSettingsDialog
                open
                title='Marketing header settings'
                settings={settings}
                values={{ position: 'flow' }}
                inherited
                labels={labels}
                onClose={() => undefined}
                onSave={() => undefined}
                onReset={() => undefined}
            />
        )

        expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    })

    it('requires an unsupported persisted value to be corrected before saving', async () => {
        const user = userEvent.setup()
        const onSave = jest.fn()

        render(
            <LayoutZoneSettingsDialog
                open
                title='Marketing header settings'
                settings={settings}
                values={{ position: 'invalid' }}
                inherited={false}
                labels={labels}
                onClose={() => undefined}
                onSave={onSave}
            />
        )

        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
        await user.click(screen.getByRole('radio', { name: 'Fixed' }))
        expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })
})
