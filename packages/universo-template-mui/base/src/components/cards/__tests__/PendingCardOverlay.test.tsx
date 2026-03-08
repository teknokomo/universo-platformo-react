// @ts-nocheck

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { PendingCardOverlay } from '../PendingCardOverlay'

const theme = createTheme()

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => React.createElement(ThemeProvider, { theme }, children)

describe('PendingCardOverlay', () => {
    it('renders a centered spinner for "create" action without text', () => {
        render(React.createElement(Wrapper, null, React.createElement(PendingCardOverlay, { action: 'create' })))
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        // No text label should be present
        expect(screen.queryByText(/creating|updating|deleting|copying/i)).not.toBeInTheDocument()
    })

    it('renders a centered spinner for "copy" action without text', () => {
        render(React.createElement(Wrapper, null, React.createElement(PendingCardOverlay, { action: 'copy' })))
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
        expect(screen.queryByText(/creating|updating|deleting|copying/i)).not.toBeInTheDocument()
    })

    it('renders a CircularProgress spinner', () => {
        render(React.createElement(Wrapper, null, React.createElement(PendingCardOverlay, { action: 'create' })))
        expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })
})
