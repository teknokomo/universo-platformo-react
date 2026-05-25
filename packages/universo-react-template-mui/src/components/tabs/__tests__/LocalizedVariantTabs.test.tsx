import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type React from 'react'
import { LocalizedVariantTabs } from '../LocalizedVariantTabs'

const renderWithTheme = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>)

describe('LocalizedVariantTabs', () => {
    it('renders generic localized tabs with a primary marker and aligned action controls', () => {
        const onChange = jest.fn()
        const onAdd = jest.fn()
        const onOpenActions = jest.fn()

        renderWithTheme(
            <LocalizedVariantTabs
                items={[
                    { code: 'en', label: 'English' },
                    { code: 'ru', label: 'Русский' }
                ]}
                value='en'
                primaryValue='en'
                labels={{
                    tabList: 'Content language',
                    add: 'Add content language',
                    primary: 'Primary variant',
                    actions: (language) => `${language} language actions`
                }}
                onChange={onChange}
                onAdd={onAdd}
                onOpenActions={onOpenActions}
            />
        )

        expect(screen.getByRole('tablist', { name: 'Content language' })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /English/ })).toHaveAttribute('aria-selected', 'true')
        expect(screen.getByLabelText('Primary variant')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('tab', { name: /Русский/ }))
        expect(onChange).toHaveBeenCalledWith('ru')

        fireEvent.click(screen.getByRole('button', { name: 'Русский language actions' }))
        expect(onOpenActions).toHaveBeenCalledWith(expect.anything(), 'ru')

        fireEvent.click(screen.getByRole('button', { name: 'Add content language' }))
        expect(onAdd).toHaveBeenCalled()

        const addButton = screen.getByRole('button', { name: 'Add content language' })
        expect(addButton).toHaveStyle({ width: '28px', height: '28px' })
    })
})
