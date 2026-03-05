import React from 'react'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { BrowserRouter } from 'react-router-dom'

import { FlowListTable } from '../FlowListTable'

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (_key: string, fallback?: string) => fallback ?? _key
    })
}))

jest.mock('react-redux', () => ({
    useSelector: (selector: (state: { customization: { isDarkMode: boolean } }) => unknown) =>
        selector({ customization: { isDarkMode: false } })
}))

const theme = createTheme()

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <BrowserRouter>
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </BrowserRouter>
)

describe('FlowListTable sortable header behavior', () => {
    const rows = [
        {
            id: 'row-1',
            name: 'First',
            updatedDate: '2026-03-05T00:00:00.000Z'
        }
    ]

    const columns = [
        {
            id: 'name',
            label: 'Name',
            sortable: true,
            render: (row: { name: string }) => row.name
        }
    ]

    it('renders sortable table header controls when sortableRows is disabled', () => {
        const { container } = render(
            <Wrapper>
                <FlowListTable data={rows} customColumns={columns} sortableRows={false} />
            </Wrapper>
        )

        expect(container.querySelector('.MuiTableSortLabel-root')).toBeInTheDocument()
    })

    it('disables sortable table header controls when sortableRows is enabled', () => {
        const { container } = render(
            <Wrapper>
                <FlowListTable data={rows} customColumns={columns} sortableRows />
            </Wrapper>
        )

        expect(container.querySelector('.MuiTableSortLabel-root')).not.toBeInTheDocument()
    })
})
