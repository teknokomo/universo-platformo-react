import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import ViewHeader from '../ViewHeader'

const theme = createTheme()

const renderWithTheme = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('ViewHeader mobile search', () => {
    it('preserves the typed mobile search value after collapsing and reopening', async () => {
        const user = userEvent.setup()
        renderWithTheme(<ViewHeader title='Versions' search searchPlaceholder='Search versions' />)

        await user.click(screen.getByRole('button', { name: 'Open search' }))
        const mobileSearchInput = screen.getAllByRole('searchbox').at(-1)

        expect(mobileSearchInput).toBeDefined()
        await user.type(mobileSearchInput!, 'draft')
        await user.click(document.body)

        await user.click(screen.getByRole('button', { name: 'Open search' }))

        expect(screen.getAllByRole('searchbox').at(-1)).toHaveValue('draft')
    })

    it('stays synchronized with a controlled parent search value', async () => {
        const user = userEvent.setup()

        const ControlledHarness = () => {
            const [value, setValue] = React.useState('published')

            return (
                <>
                    <button onClick={() => setValue('archived')} type='button'>
                        Set archived
                    </button>
                    <div data-testid='search-value'>{value}</div>
                    <ViewHeader
                        title='Versions'
                        search
                        searchValue={value}
                        searchPlaceholder='Search versions'
                        onSearchChange={(event) => setValue(event.target.value)}
                    />
                </>
            )
        }

        renderWithTheme(<ControlledHarness />)

        await user.click(screen.getByRole('button', { name: 'Open search' }))
        await user.type(screen.getAllByRole('searchbox').at(-1)!, ' ready')

        expect(screen.getByTestId('search-value')).toHaveTextContent('published ready')

        await user.click(document.body)
        await user.click(screen.getByRole('button', { name: 'Set archived' }))
        await user.click(screen.getByRole('button', { name: 'Open search' }))

        const searchInputs = screen.getAllByRole('searchbox')
        expect(searchInputs[0]).toHaveValue('archived')
        expect(searchInputs.at(-1)).toHaveValue('archived')
    })

    it('pushes embedded end-aligned controls to the right when search is rendered without a title region', () => {
        renderWithTheme(
            <ViewHeader search searchPlaceholder='Search layouts' controlsAlign='end'>
                <button type='button'>Create</button>
            </ViewHeader>
        )

        expect(window.getComputedStyle(screen.getByTestId('view-header-controls-region')).marginLeft).toBe('auto')
        expect(window.getComputedStyle(screen.getByTestId('view-header-actions-region')).marginLeft).toBe('auto')
    })
})
