import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { BrowserRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'

import { FlowListTable } from '../FlowListTable'

let capturedSortableItemIds: string[][] = []

jest.mock('../FlowListTableDnd', () => ({
    SortableTableRow: ({ id, children }: { id: string; children: React.ReactNode }) => <tr data-sortable-id={id}>{children}</tr>,
    SortableTableBody: ({ itemIds, children }: { itemIds: string[]; children: React.ReactNode }) => {
        capturedSortableItemIds.push([...itemIds])
        return <tbody data-testid='sortable-body'>{children}</tbody>
    },
    InternalDndWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

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
    beforeEach(() => {
        localStorage.clear()
        capturedSortableItemIds = []
    })

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

    it('keeps sortable table header controls when sortableRows is enabled', () => {
        const { container } = render(
            <Wrapper>
                <FlowListTable data={rows} customColumns={columns} sortableRows />
            </Wrapper>
        )

        expect(container.querySelector('.MuiTableSortLabel-root')).toBeInTheDocument()
    })

    it('sorts rows by the selected column even when sortableRows is enabled', async () => {
        const user = userEvent.setup()
        const sortableRows = [
            {
                id: 'row-1',
                name: 'Zulu',
                updatedDate: '2026-03-05T00:00:00.000Z'
            },
            {
                id: 'row-2',
                name: 'Alpha',
                updatedDate: '2026-03-04T00:00:00.000Z'
            },
            {
                id: 'row-3',
                name: 'Mike',
                updatedDate: '2026-03-03T00:00:00.000Z'
            }
        ]

        render(
            <Wrapper>
                <FlowListTable data={sortableRows} customColumns={columns} sortableRows />
            </Wrapper>
        )

        const getBodyNames = () =>
            screen
                .getAllByRole('row')
                .slice(1)
                .map((row) => within(row).getByText(/Zulu|Alpha|Mike/).textContent)

        expect(getBodyNames()).toEqual(['Zulu', 'Alpha', 'Mike'])

        await user.click(screen.getByRole('button', { name: 'Name' }))

        expect(getBodyNames()).toEqual(['Alpha', 'Mike', 'Zulu'])
    })

    it('keeps filterFunction applied and reorders SortableContext ids with the visible sorted rows', async () => {
        const user = userEvent.setup()
        const sortableRows = [
            {
                id: 'row-1',
                name: 'Zulu',
                updatedDate: '2026-03-05T00:00:00.000Z'
            },
            {
                id: 'row-2',
                name: 'Alpha',
                updatedDate: '2026-03-04T00:00:00.000Z'
            },
            {
                id: 'row-3',
                name: 'Hidden',
                updatedDate: '2026-03-03T00:00:00.000Z'
            }
        ]

        render(
            <Wrapper>
                <FlowListTable
                    data={sortableRows}
                    customColumns={columns}
                    sortableRows
                    sortableItemIds={sortableRows.map((row) => row.id)}
                    filterFunction={(row) => row.name !== 'Hidden'}
                />
            </Wrapper>
        )

        const getBodyNames = () =>
            screen
                .getAllByRole('row')
                .slice(1)
                .map((row) => within(row).getByText(/Zulu|Alpha/).textContent)

        expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
        expect(getBodyNames()).toEqual(['Zulu', 'Alpha'])
        expect(capturedSortableItemIds.at(-1)).toEqual(['row-1', 'row-2'])

        await user.click(screen.getByRole('button', { name: 'Name' }))

        expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
        expect(getBodyNames()).toEqual(['Alpha', 'Zulu'])
        expect(capturedSortableItemIds.at(-1)).toEqual(['row-2', 'row-1'])
    })

    it('reveals pending-row interaction feedback from custom-column cells, not only from action buttons', async () => {
        const user = userEvent.setup()
        const onPendingInteractionAttempt = jest.fn()
        const pendingRows = [
            {
                id: 'row-1',
                name: 'Pending publication',
                updatedDate: '2026-03-05T00:00:00.000Z',
                __pending: true,
                __pendingAction: 'create'
            }
        ]

        render(
            <Wrapper>
                <FlowListTable
                    data={pendingRows}
                    customColumns={columns}
                    sortableRows={false}
                    onPendingInteractionAttempt={onPendingInteractionAttempt}
                />
            </Wrapper>
        )

        await user.click(screen.getByText('Pending publication'))

        expect(onPendingInteractionAttempt).toHaveBeenCalledTimes(1)
        expect(onPendingInteractionAttempt).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1' }))
    })
})
