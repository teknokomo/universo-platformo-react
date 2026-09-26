jest.unmock('@universo-react/i18n')
jest.unmock('react-i18next')

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createTheme, FormControl, InputLabel, MenuItem, TextField, ThemeProvider } from '@mui/material'
import { createRef, useState, type ReactNode } from 'react'
import { getInstance } from '@universo-react/i18n'
import { I18nextProvider } from 'react-i18next'
import { DropdownAutocomplete, DropdownSelect } from '../index'

const i18n = getInstance()
const renderWithI18n = (ui: ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)

describe('shared dropdown controls', () => {
    beforeEach(async () => {
        await i18n.changeLanguage('en')
    })

    it('keeps the standard MUI Select contract and menu interaction', async () => {
        const user = userEvent.setup()
        const onChange = jest.fn()

        renderWithI18n(
            <FormControl fullWidth>
                <InputLabel id='color-label'>Color</InputLabel>
                <DropdownSelect labelId='color-label' id='color-select' label='Color' value='red' onChange={onChange}>
                    <MenuItem value='red'>Red</MenuItem>
                    <MenuItem value='blue'>Blue</MenuItem>
                </DropdownSelect>
            </FormControl>
        )

        await user.click(screen.getByRole('combobox', { name: 'Color' }))
        await user.click(screen.getByRole('option', { name: 'Blue' }))

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: 'blue' }) }),
            expect.anything()
        )
    })

    it('supports keyboard option selection, Escape and focus restoration for Select', async () => {
        const user = userEvent.setup()
        const onChange = jest.fn()

        renderWithI18n(
            <FormControl>
                <InputLabel id='keyboard-color-label'>Color</InputLabel>
                <DropdownSelect labelId='keyboard-color-label' label='Color' value='red' onChange={onChange}>
                    <MenuItem value='red'>Red</MenuItem>
                    <MenuItem value='blue'>Blue</MenuItem>
                </DropdownSelect>
            </FormControl>
        )

        const select = screen.getByRole('combobox', { name: 'Color' })
        await user.click(select)
        await user.keyboard('{ArrowDown}{Enter}')

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: 'blue' }) }),
            expect.anything()
        )
        expect(select).toHaveFocus()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

        await user.click(select)
        await user.keyboard('{Escape}')

        expect(select).toHaveFocus()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('renders localized clear/open labels and optional accessible action buttons', async () => {
        const user = userEvent.setup()
        const onReset = jest.fn()

        const { container } = renderWithI18n(
            <DropdownAutocomplete<string>
                options={['Hero', 'Image']}
                value='Hero'
                onChange={jest.fn()}
                getOptionLabel={(option) => option}
                renderInput={(params) => <TextField {...params} label='Widget' />}
                endActions={[{ key: 'reset', label: 'Reset source', icon: '×', onClick: onReset }]}
            />
        )

        expect(screen.getByRole('button', { name: 'Reset source' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
        expect(screen.getByTitle('Clear')).toBeInTheDocument()
        expect(container.querySelector('.MuiAutocomplete-clearIndicator')).toBeInTheDocument()
        expect(container.querySelector('.MuiAutocomplete-inputRoot')).toHaveStyle({
            paddingRight: 'calc(77px + 32px + 4px + 4px)'
        })

        await user.click(screen.getByRole('button', { name: 'Reset source' }))

        expect(onReset).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

        await act(async () => {
            await i18n.changeLanguage('ru')
        })
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Развернуть' })).toBeInTheDocument()
            expect(screen.getByTitle('Очистить')).toBeInTheDocument()
        })
    })

    it('preserves multiple selection and caller-owned renderValue', async () => {
        const user = userEvent.setup()
        const onChange = jest.fn()

        renderWithI18n(
            <FormControl>
                <InputLabel id='colors-label'>Colors</InputLabel>
                <DropdownSelect
                    multiple
                    labelId='colors-label'
                    label='Colors'
                    value={['red']}
                    onChange={onChange}
                    renderValue={(selected) => selected.join(', ')}
                >
                    <MenuItem value='red'>Red</MenuItem>
                    <MenuItem value='blue'>Blue</MenuItem>
                </DropdownSelect>
            </FormControl>
        )

        expect(screen.getByRole('combobox', { name: 'Colors' })).toHaveTextContent('red')
        await user.click(screen.getByRole('combobox', { name: 'Colors' }))
        await user.click(screen.getByRole('option', { name: 'Blue' }))

        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ target: expect.objectContaining({ value: ['red', 'blue'] }) }),
            expect.anything()
        )
    })

    it('preserves custom autocomplete option rendering and consumer styles', async () => {
        const user = userEvent.setup()
        const onChange = jest.fn()

        renderWithI18n(
            <DropdownAutocomplete<string>
                options={['Hero', 'Image']}
                value={null}
                onChange={onChange}
                getOptionLabel={(option) => option}
                renderInput={(params) => <TextField {...params} label='Widget' />}
                renderOption={(props, option) => (
                    <li {...props} key={option}>
                        {option} widget
                    </li>
                )}
                sx={{ maxWidth: 420 }}
            />
        )

        await user.click(screen.getByRole('combobox', { name: 'Widget' }))
        await user.click(screen.getByRole('option', { name: 'Image widget' }))

        expect(onChange).toHaveBeenCalledWith(expect.anything(), 'Image', 'selectOption', expect.anything())
    })

    it('supports keyboard option selection, Escape and focus restoration', async () => {
        const user = userEvent.setup()
        const KeyboardAutocomplete = () => {
            const [value, setValue] = useState<string | null>(null)
            return (
                <DropdownAutocomplete<string>
                    options={['Hero', 'Image']}
                    value={value}
                    onChange={(_, nextValue) => setValue(nextValue)}
                    getOptionLabel={(option) => option}
                    renderInput={(params) => <TextField {...params} label='Widget' />}
                />
            )
        }
        renderWithI18n(<KeyboardAutocomplete />)

        const input = screen.getByRole('combobox', { name: 'Widget' })
        await user.tab()
        expect(input).toHaveFocus()
        await user.keyboard('{ArrowDown}')
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

        expect(input).toHaveValue('Image')
        expect(input).toHaveFocus()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

        await user.keyboard('{ArrowDown}{Escape}')

        expect(input).toHaveValue('Image')
        expect(input).toHaveFocus()
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('clears selected values through MUI and custom reset actions', async () => {
        const user = userEvent.setup()
        const StatefulAutocomplete = () => {
            const [value, setValue] = useState<string | null>('Hero')
            return (
                <DropdownAutocomplete<string>
                    options={['Hero', 'Image']}
                    value={value}
                    onChange={(_, nextValue) => setValue(nextValue)}
                    getOptionLabel={(option) => option}
                    renderInput={(params) => <TextField {...params} label='Widget' />}
                    endActions={[{ key: 'reset', label: 'Reset source', icon: '×', onClick: () => setValue(null) }]}
                />
            )
        }
        renderWithI18n(<StatefulAutocomplete />)

        const input = screen.getByRole('combobox', { name: 'Widget' })
        fireEvent.click(screen.getByTitle('Clear'))
        expect(input).toHaveValue('')

        await user.click(screen.getByRole('button', { name: 'Expand' }))
        await user.click(screen.getByRole('option', { name: 'Image' }))
        expect(input).toHaveValue('Image')

        const resetButton = screen.getByRole('button', { name: 'Reset source' })
        await user.tab()
        expect(resetButton).toHaveFocus()
        await user.keyboard('{Enter}')
        expect(input).toHaveValue('')
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    })

    it('preserves a custom theme radius and an explicitly hidden popup icon', async () => {
        const user = userEvent.setup()
        const theme = createTheme({ shape: { borderRadius: 8 } })
        const autocompleteRef = createRef<HTMLDivElement>()
        const selectRef = createRef<HTMLDivElement>()

        const { container } = renderWithI18n(
            <ThemeProvider theme={theme}>
                <FormControl>
                    <InputLabel id='ref-select-label'>Color</InputLabel>
                    <DropdownSelect ref={selectRef} labelId='ref-select-label' label='Color' value='red'>
                        <MenuItem value='red'>Red</MenuItem>
                    </DropdownSelect>
                </FormControl>
                <DropdownAutocomplete<string>
                    options={['Hero']}
                    value={null}
                    onChange={jest.fn()}
                    getOptionLabel={(option) => option}
                    renderInput={(params) => <TextField {...params} label='Widget' />}
                    popupIcon={null}
                    ref={autocompleteRef}
                />
            </ThemeProvider>
        )

        expect(selectRef.current).toBeInstanceOf(HTMLDivElement)
        expect(autocompleteRef.current).toBeInstanceOf(HTMLDivElement)
        expect(container.querySelector('.MuiAutocomplete-popupIndicator svg')).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Expand' }))

        const paper = document.querySelector('.MuiAutocomplete-paper')
        const listbox = screen.getByRole('listbox')
        const option = screen.getByRole('option', { name: 'Hero' })
        expect(paper).toHaveStyle({ borderRadius: '8px' })
        expect(listbox).toHaveStyle({ padding: '4px' })
        expect(option).toHaveStyle({ minHeight: '36px', borderRadius: '8px' })
    })
})
