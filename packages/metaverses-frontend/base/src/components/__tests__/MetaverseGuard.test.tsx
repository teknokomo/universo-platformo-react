import React from 'react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MetaverseGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('wires ResourceGuard with metaverse-specific configuration', async () => {
        const ResourceGuard = vi.fn(({ children }: any) => <div data-testid='rg'>{children}</div>)

        vi.doMock('@universo/template-mui', () => ({
            ResourceGuard
        }))

        const getMetaverse = vi.fn().mockResolvedValue({ data: { id: 'm1', name: 'Test' } })
        vi.doMock('../../api/metaverses', () => ({
            getMetaverse
        }))

        const { default: MetaverseGuard } = await import('../MetaverseGuard')

        render(
            <MetaverseGuard accessDeniedRedirectTo='/x'>
                <div>child</div>
            </MetaverseGuard>
        )

        expect(screen.getByTestId('rg')).toHaveTextContent('child')
        expect(ResourceGuard).toHaveBeenCalledTimes(1)

        const props = ResourceGuard.mock.calls[0][0]
        expect(props.resourceType).toBe('metaverse')
        expect(props.resourceIdParam).toBe('metaverseId')
        expect(props.accessDeniedRedirectTo).toBe('/x')

        await expect(props.fetchResource('m1')).resolves.toEqual({ id: 'm1', name: 'Test' })
        expect(getMetaverse).toHaveBeenCalledWith('m1')
    })
})
