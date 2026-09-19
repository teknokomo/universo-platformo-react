import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

const access = { isSuperuser: false }

jest.mock('@universo-react/store', () => ({
    useHasGlobalAccess: () => ({ isSuperuser: access.isSuperuser })
}))

jest.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: () => {} },
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key
    })
}))

jest.mock('@universo-react/i18n', () => ({
    useCommonTranslations: () => ({ t: (key: string) => (key === 'close' ? 'Close' : key) })
}))

jest.mock('../../dialogs/SettingsDialog', () => ({
    SettingsDialog: () => <div data-testid='shared-settings-dialog' />
}))

import ToolbarControls from '../ToolbarControls'

describe('ToolbarControls settings access', () => {
    beforeEach(() => {
        access.isSuperuser = false
    })

    it('hides the shared settings button from non-superusers without page settings content', () => {
        render(<ToolbarControls settingsEnabled />)

        expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument()
    })

    it('shows the shared settings button to superusers', () => {
        access.isSuperuser = true
        render(<ToolbarControls settingsEnabled />)

        // The shared user-settings dialog is covered elsewhere; this assertion
        // only pins the button visibility contract.
        expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument()
    })

    it('opens a page-scoped settings dialog for non-superusers when content is provided', async () => {
        const user = userEvent.setup()
        render(
            <ToolbarControls
                settingsEnabled
                settingsTitle='Settings'
                settingsContent={<label htmlFor='released'>Show released addresses</label>}
            />
        )

        await user.click(screen.getByRole('button', { name: 'Settings' }))

        expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
        expect(screen.getByText('Show released addresses')).toBeInTheDocument()
        expect(screen.getByTestId('page-settings-actions')).toHaveClass('MuiDialogActions-root')

        await user.click(screen.getByRole('button', { name: 'Close' }))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
})
