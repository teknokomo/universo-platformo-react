import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { LayoutAuthoringList } from '../LayoutAuthoringList'

jest.mock('../../../assets', () => ({ APIEmptySVG: 'mock-api-empty.svg' }))
jest.mock('../../toolbar/ToolbarControls', () => ({ __esModule: true, default: () => null }))
jest.mock('../../headers/ViewHeader', () => ({
    __esModule: true,
    default: ({ children }: { children: ReactNode }) => children
}))

const theme = createTheme()

describe('LayoutAuthoringList card actions', () => {
    it('opens a named layout card with Enter and Space while keeping its header action usable', async () => {
        const user = userEvent.setup()
        const openLayout = jest.fn()
        const runHeaderAction = jest.fn()

        render(
            <ThemeProvider theme={theme}>
                <LayoutAuthoringList
                    viewMode='card'
                    onViewModeChange={() => undefined}
                    cardViewTitle='Card view'
                    listViewTitle='List view'
                    items={[
                        {
                            id: 'layout-1',
                            title: 'Marketing layout',
                            statusContent: <span>Published</span>,
                            onClick: openLayout,
                            headerAction: <button onClick={runHeaderAction}>Layout options</button>
                        }
                    ]}
                    errorTitle='Could not load layouts'
                    emptyTitle='No layouts'
                    metaColumnLabel='Meta'
                    statusColumnLabel='Status'
                    listContentTestId='layout-list'
                />
            </ThemeProvider>
        )

        const layoutAction = screen.getByRole('button', { name: 'Marketing layout' })
        const headerAction = screen.getByRole('button', { name: 'Layout options' })

        expect(layoutAction).toHaveAttribute('tabindex', '0')

        for (let index = 0; index < 5 && document.activeElement !== layoutAction; index += 1) {
            await user.tab()
        }
        expect(layoutAction).toHaveFocus()
        await user.keyboard('{Enter}')
        await user.keyboard(' ')

        expect(openLayout).toHaveBeenCalledTimes(2)

        await user.tab()
        expect(headerAction).toHaveFocus()
        await user.keyboard('{Enter}')

        expect(runHeaderAction).toHaveBeenCalledTimes(1)
        expect(openLayout).toHaveBeenCalledTimes(2)
    })
})
