import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Header from '../Header'

describe('Dashboard Header', () => {
    it('omits the header and actions region when both slots are empty', () => {
        const { container } = render(<Header leading={[]} actions={[]} />)

        expect(container.firstChild).toBeNull()
        expect(screen.queryByTestId('runtime-header')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-header-actions')).not.toBeInTheDocument()
    })

    it('right-aligns actions when the leading widget list is empty', () => {
        render(<Header leading={[]} actions={<span>Runtime controls</span>} />)

        expect(screen.getByTestId('runtime-header')).toHaveStyle({ justifyContent: 'flex-end' })
        expect(screen.getByTestId('runtime-header-actions')).toBeVisible()
    })

    it('keeps leading content and actions at opposite edges when both are present', () => {
        render(<Header leading={<span>Page title</span>} actions={<span>Runtime controls</span>} />)

        expect(screen.getByTestId('runtime-header')).toHaveStyle({ justifyContent: 'space-between' })
        expect(screen.getByText('Page title')).toBeVisible()
        expect(screen.getByTestId('runtime-header-actions')).toBeVisible()
        expect(screen.getByTestId('runtime-header-actions')).toHaveStyle({ justifyContent: 'flex-end' })
    })
})
