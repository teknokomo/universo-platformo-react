import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { ThemePresetManagerDialog, type ThemePresetManagerItem } from '../ThemePresetManagerDialog'

const item: ThemePresetManagerItem = {
    key: 'file:universo-default',
    label: 'Universo Default',
    source: 'file',
    version: 1,
    archived: false,
    id: 'universo-default',
    codename: 'universo-default'
}

describe('ThemePresetManagerDialog', () => {
    it('provides an explicit close action next to the primary create action', async () => {
        const user = userEvent.setup()
        const onClose = jest.fn()
        const onCreate = jest.fn()

        render(
            <ThemePresetManagerDialog
                open
                onClose={onClose}
                testIdPrefix='appearance-test'
                items={[item]}
                onCreate={onCreate}
                onCopy={jest.fn()}
                onArchive={jest.fn()}
                onDelete={jest.fn()}
                onExport={jest.fn()}
                onRetry={jest.fn()}
            />
        )

        // The metahub/application dialog presentation policy is strict-modal:
        // backdrop clicks and Escape are blocked, so this button is the only
        // way out of the dialog.
        const closeButton = screen.getByTestId('appearance-test-close')
        expect(closeButton).toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-create')).toBeInTheDocument()

        await user.click(closeButton)
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(onCreate).not.toHaveBeenCalled()
    })
})
