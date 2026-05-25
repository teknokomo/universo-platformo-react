import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LayoutStateChips } from '../LayoutStateChips'

describe('LayoutStateChips', () => {
    it('renders shared layout provenance and state chips', () => {
        render(
            <LayoutStateChips
                isActive
                isDefault
                sourceKind='application'
                syncState='local_modified'
                labels={{
                    active: 'Active',
                    inactive: 'Inactive',
                    default: 'Default',
                    source: { application: 'Application', metahub: 'Metahub' },
                    syncState: { local_modified: 'Modified' }
                }}
            />
        )

        expect(screen.getByText('Active')).toBeInTheDocument()
        expect(screen.getByText('Default')).toBeInTheDocument()
        expect(screen.getByText('Application')).toBeInTheDocument()
        expect(screen.getByText('Modified')).toBeInTheDocument()
    })
})
