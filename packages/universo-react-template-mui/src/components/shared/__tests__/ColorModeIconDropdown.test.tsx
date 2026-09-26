jest.unmock('@universo-react/i18n')
jest.unmock('react-i18next')

jest.mock('@mui/material/styles', () => ({
    ...jest.requireActual('@mui/material/styles'),
    useColorScheme: () => ({ mode: 'light', systemMode: 'light', setMode: jest.fn() })
}))

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactNode } from 'react'
import { getInstance } from '@universo-react/i18n'
import { I18nextProvider } from 'react-i18next'
import ColorModeIconDropdown from '../ColorModeIconDropdown'

const i18n = getInstance()
const renderWithI18n = (ui: ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)

describe('ColorModeIconDropdown accessibility', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

    it('has a localized accessible name and points to its own menu', async () => {
        const user = userEvent.setup()
        const onClick = jest.fn()
        renderWithI18n(<ColorModeIconDropdown onClick={onClick} />)

        const trigger = screen.getByRole('button', { name: 'Color mode switcher' })
        await user.click(trigger)
        expect(onClick).toHaveBeenCalledTimes(1)

        const menu = screen.getByRole('menu')
        const controlledMenuId = trigger.getAttribute('aria-controls')
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(controlledMenuId).toBeTruthy()
        expect(document.getElementById(controlledMenuId!)).toContainElement(menu)
        expect(screen.getByRole('menuitem', { name: 'System' })).toBeInTheDocument()

        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        await waitFor(() => {
            expect(trigger).toHaveAttribute('aria-label', 'Переключатель темы')
            expect(screen.getByRole('menuitem', { name: 'Системная' })).toBeInTheDocument()
        })
    })
})
