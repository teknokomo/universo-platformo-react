import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MetahubModulesSurface } from '../MetahubModulesSurface'

const mockEntityModulesTab = vi.fn()

vi.mock('../EntityModulesTab', () => ({
    EntityModulesTab: (props: Record<string, unknown>) => {
        mockEntityModulesTab(props)
        return <div data-testid='entity-modules-tab-content' />
    }
}))

const t = (key: string, defaultValue?: string) => defaultValue ?? key

describe('MetahubModulesSurface', () => {
    it('renders the metahub scope by default and switches to the shared scope', async () => {
        const user = userEvent.setup()
        render(<MetahubModulesSurface metahubId='metahub-1' t={t} />)

        expect(screen.getByTestId('entity-modules-tab-content')).toBeInTheDocument()
        expect(mockEntityModulesTab).toHaveBeenLastCalledWith(
            expect.objectContaining({ metahubId: 'metahub-1', attachedToKind: 'metahub', attachedToId: null })
        )
        expect(screen.getByRole('tab', { name: 'Metahub modules' })).toHaveAttribute('aria-selected', 'true')

        await user.click(screen.getByRole('tab', { name: 'Shared modules' }))

        expect(screen.getByRole('tab', { name: 'Metahub modules' })).toHaveAttribute('aria-selected', 'false')
        expect(screen.getByRole('tab', { name: 'Shared modules' })).toHaveAttribute('aria-selected', 'true')
        expect(mockEntityModulesTab).toHaveBeenLastCalledWith(
            expect.objectContaining({ metahubId: 'metahub-1', attachedToKind: 'general', attachedToId: null })
        )
    })

    it('keeps rendering the surface without a metahub id (creation flow)', () => {
        render(<MetahubModulesSurface metahubId={null} t={t} />)
        expect(mockEntityModulesTab).toHaveBeenLastCalledWith(
            expect.objectContaining({ metahubId: null, attachedToKind: 'metahub', attachedToId: null })
        )
    })
})
