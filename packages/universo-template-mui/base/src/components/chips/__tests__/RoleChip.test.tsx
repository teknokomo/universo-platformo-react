/* eslint-disable jsx-a11y/aria-role */

import { render, screen } from '@testing-library/react'
import { RoleChip } from '../RoleChip'
import type { BaseRole } from '@universo/types'

describe('RoleChip', () => {
    describe('Color Mapping', () => {
        it('should render owner role with error color', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-colorError')
            expect(chip).toBeInTheDocument()
        })

        it('should render admin role with warning color', () => {
            const { container } = render(<RoleChip role='admin' />)
            const chip = container.querySelector('.MuiChip-colorWarning')
            expect(chip).toBeInTheDocument()
        })

        it('should render editor role with info color', () => {
            const { container } = render(<RoleChip role='editor' />)
            const chip = container.querySelector('.MuiChip-colorInfo')
            expect(chip).toBeInTheDocument()
        })

        it('should render member role with default color', () => {
            const { container } = render(<RoleChip role='member' />)
            const chip = container.querySelector('.MuiChip-colorDefault')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('i18n Translation', () => {
        it('should display translated role label', () => {
            render(<RoleChip role='owner' />)
            // Mock returns 'roles.owner'
            expect(screen.getByText('roles.owner')).toBeInTheDocument()
        })

        it('should use roles namespace for translation', () => {
            const roles: BaseRole[] = ['owner', 'admin', 'editor', 'member']

            roles.forEach((role) => {
                const { unmount } = render(<RoleChip role={role} />)
                expect(screen.getByText(`roles.${role}`)).toBeInTheDocument()
                unmount()
            })
        })
    })

    describe('Size Variants', () => {
        it('should render small size by default', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-sizeSmall')
            expect(chip).toBeInTheDocument()
        })

        it('should render medium size when specified', () => {
            const { container } = render(<RoleChip role='owner' size='medium' />)
            const chip = container.querySelector('.MuiChip-sizeMedium')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('Style Variants', () => {
        it('should render filled variant by default', () => {
            const { container } = render(<RoleChip role='owner' />)
            const chip = container.querySelector('.MuiChip-filled')
            expect(chip).toBeInTheDocument()
        })

        it('should render filled variant when specified', () => {
            const { container } = render(<RoleChip role='owner' variant='filled' />)
            const chip = container.querySelector('.MuiChip-filled')
            expect(chip).toBeInTheDocument()
        })
    })

    describe('Custom Props', () => {
        it('should apply custom className', () => {
            const { container } = render(<RoleChip role='owner' className='custom-class' />)
            const chip = container.querySelector('.custom-class')
            expect(chip).toBeInTheDocument()
        })

        it('should combine all props correctly', () => {
            const { container } = render(<RoleChip role='admin' size='medium' variant='outlined' className='test-chip' />)

            const chip = container.querySelector('.test-chip')
            expect(chip).toBeInTheDocument()
            expect(chip).toHaveClass('MuiChip-colorWarning')
            expect(chip).toHaveClass('MuiChip-sizeMedium')
            expect(chip).toHaveClass('MuiChip-outlined')
        })
    })

    describe('Type Safety', () => {
        it('should accept all valid BaseRole values', () => {
            const roles: BaseRole[] = ['owner', 'admin', 'editor', 'member']

            roles.forEach((role) => {
                expect(() => render(<RoleChip role={role} />)).not.toThrow()
            })
        })
    })
})
