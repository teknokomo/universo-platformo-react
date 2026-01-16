import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MetahubGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('wires ResourceGuard with metahub-specific configuration', async () => {
        const ResourceGuard = vi.fn(({ children }: any) => <div data-testid='rg'>{children}</div>)

        vi.doMock('@universo/template-mui', () => ({
            ResourceGuard
        }))

        const getMetahub = vi.fn().mockResolvedValue({ data: { id: 'm1', name: 'Test' } })
        vi.doMock('../../domains/metahubs', () => ({
            getMetahub
        }))

        const { default: MetahubGuard } = await import('../MetahubGuard')

        render(
            <MetahubGuard accessDeniedRedirectTo='/x'>
                <div>child</div>
            </MetahubGuard>
        )

        expect(screen.getByTestId('rg')).toHaveTextContent('child')
        expect(ResourceGuard).toHaveBeenCalledTimes(1)

        const props = ResourceGuard.mock.calls[0][0]
        expect(props.resourceType).toBe('metahub')
        expect(props.resourceIdParam).toBe('metahubId')
        expect(props.accessDeniedRedirectTo).toBe('/x')

        await expect(props.fetchResource('m1')).resolves.toEqual({ id: 'm1', name: 'Test' })
        expect(getMetahub).toHaveBeenCalledWith('m1')
    })
})
