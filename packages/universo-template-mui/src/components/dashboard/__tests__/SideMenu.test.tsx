import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import SideMenu from '../SideMenu'
import SideMenuMobile from '../SideMenuMobile'

const mockLogout = jest.fn(async () => undefined)
const mockConfirm = jest.fn(async () => true)

jest.mock('@universo/auth-frontend', () => ({
    __esModule: true,
    useAuth: () => ({
        logout: mockLogout
    })
}))

jest.mock('../../../hooks/useConfirm', () => ({
    __esModule: true,
    default: () => ({
        confirm: mockConfirm
    })
}))

jest.mock('../MenuContent', () => ({
    __esModule: true,
    default: () => <div>Menu Content</div>
}))

const theme = createTheme()

const renderWithTheme = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('SideMenu logout flows', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockConfirm.mockResolvedValue(true)
    })

    it('confirms before logging out from the desktop side menu', async () => {
        const user = userEvent.setup()
        renderWithTheme(<SideMenu />)

        await user.click(screen.getByRole('button', { name: 'common:logout' }))

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalledWith({
                title: 'common:logoutConfirmTitle',
                description: 'common:logoutConfirmMessage',
                confirmButtonName: 'common:logout'
            })
        })
        expect(mockLogout).toHaveBeenCalledTimes(1)
    })

    it('does not log out from the mobile side menu when confirmation is rejected', async () => {
        const user = userEvent.setup()
        const toggleDrawer = jest.fn(() => jest.fn())
        mockConfirm.mockResolvedValue(false)

        renderWithTheme(<SideMenuMobile open toggleDrawer={toggleDrawer} />)

        expect(screen.getByText('Menu Content')).toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'common:logout' }))

        await waitFor(() => {
            expect(mockConfirm).toHaveBeenCalledWith({
                title: 'common:logoutConfirmTitle',
                description: 'common:logoutConfirmMessage',
                confirmButtonName: 'common:logout'
            })
        })
        expect(mockLogout).not.toHaveBeenCalled()
    })
})
