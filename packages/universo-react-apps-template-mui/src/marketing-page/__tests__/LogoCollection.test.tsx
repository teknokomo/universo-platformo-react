import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LogoCollection from '../components/LogoCollection'

describe('LogoCollection', () => {
    it('keeps approved partner categories visible when no logo media is configured', () => {
        render(
            <LogoCollection
                section={{ title: 'Partner ecosystem', showTitle: true }}
                items={[
                    {
                        semanticKey: 'development-institutions',
                        name: 'Development institutions'
                    }
                ]}
            />
        )

        expect(screen.getByText('Development institutions')).toBeVisible()
    })
})
