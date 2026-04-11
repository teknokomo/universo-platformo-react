import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider, createTheme } from '@mui/material/styles'

import { ConflictResolutionDialog } from '../ConflictResolutionDialog'

jest.mock('react-i18next', () => ({
    __esModule: true,
    useTranslation: () => ({
        t: (key: string, fallback?: string) => (typeof fallback === 'string' ? fallback : key)
    })
}))

const theme = createTheme()

const conflict = {
    expectedVersion: 3,
    actualVersion: 4,
    updatedAt: '2026-04-09T12:00:00.000Z',
    updatedBy: 'user-1'
}

const renderWithTheme = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>)

describe('ConflictResolutionDialog', () => {
    it('rerenders cleanly when conflict payload appears and disappears', () => {
        const { rerender } = renderWithTheme(
            <ConflictResolutionDialog open={false} conflict={null} onOverwrite={() => undefined} onCancel={() => undefined} />
        )

        rerender(
            <ThemeProvider theme={theme}>
                <ConflictResolutionDialog open conflict={conflict} onOverwrite={() => undefined} onCancel={() => undefined} />
            </ThemeProvider>
        )

        expect(screen.getByText('conflict.title')).toBeInTheDocument()

        rerender(
            <ThemeProvider theme={theme}>
                <ConflictResolutionDialog open={false} conflict={null} onOverwrite={() => undefined} onCancel={() => undefined} />
            </ThemeProvider>
        )

        expect(screen.queryByText('conflict.title')).not.toBeInTheDocument()
    })
})
