import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RoleChip } from '../RoleChip'
import type { BaseRole } from '@universo/types'

describe('RoleChip', () => {
    describe('Rendering', () => {
        it('should render with owner role', () => {
            render(<RoleChip role='owner' />)
            expect(screen.getByText('translated.owner')).toBeInTheDocument()
        })

        it('should render with admin role', () => {
            render(<RoleChip role='admin' />)
            expect(screen.getByText('translated.admin')).toBeInTheDocument()
        })

        it('should render with editor role', () => {
            render(<RoleChip role='editor' />)
            expect(screen.getByText('translated.editor')).toBeInTheDocument()
        })

        it('should render with member role', () => {
            render(<RoleChip role='member' />)
            expect(screen.getByText('translated.member')).toBeInTheDocument()
        })
    })

    describe('Color Mapping', () => {
        const testCases: Array<{ role: BaseRole; expectedClass: string }> = [
            { role: 'owner', expectedClass: 'MuiChip-colorError' },
            { role: 'admin', expectedClass: 'MuiChip-colorWarning' },
            { role: 'editor', expectedClass: 'MuiChip-colorInfo' },
            { role: 'member', expectedClass: 'MuiChip-colorDefault' }
        ]

        testCases.forEach(({ role, expectedClass }) => {
            it(`should apply ${expectedClass} color for ${role} role`, () => {
                const { container } = render(<RoleChip role={role} />)
                const chip = container.querySelector(`.${expectedClass}`)
                expect(chip).toBeInTheDocument()
            })
        })
    })

    describe('Size Prop', () => {
        it('should render with small size by default', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-sizeSmall')
            expect(chip).toBeInTheDocument()
        })

        it('should render with medium size when specified', () => {
            const { container } = render(<RoleChip role='owner' size='medium' />)
            const chip = container.querySelector('.MuiChip-sizeMedium')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('Variant Prop', () => {
        it('should render with filled variant by default', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-filled')
            expect(chip).toBeInTheDocument()
        })

        it('should render with outlined variant when specified', () => {
            const { container } = render(<RoleChip role='owner' variant='outlined' />)
            const chip = container.querySelector('.MuiChip-outlined')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('Custom ClassName', () => {
        it('should apply custom className', () => {
            const { container } = render(<RoleChip role='owner' className='custom-class' />)
            const chip = container.querySelector('.custom-class')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('Accessibility', () => {
        it('should render accessible chip element', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-root')
            expect(chip).toBeInTheDocument()
            expect(chip).toHaveClass('MuiChip-root')
        })
    })
})
