import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('ApplicationGuard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.resetModules()
    })

    it('wires ResourceGuard with application-specific configuration', async () => {
        const ResourceGuard = vi.fn(({ children }: any) => <div data-testid='rg'>{children}</div>)

        vi.doMock('@universo/template-mui', () => ({
            ResourceGuard
        }))

        const getApplication = vi.fn().mockResolvedValue({ data: { id: 'm1', name: 'Test' } })
        vi.doMock('../../api/applications', () => ({
            getApplication
        }))

        const { default: ApplicationGuard } = await import('../ApplicationGuard')

        render(
            <ApplicationGuard accessDeniedRedirectTo='/x'>
                <div>child</div>
            </ApplicationGuard>
        )

        expect(screen.getByTestId('rg')).toHaveTextContent('child')
        expect(ResourceGuard).toHaveBeenCalledTimes(1)

        const props = ResourceGuard.mock.calls[0][0]
        expect(props.resourceType).toBe('application')
        expect(props.reconnectorIdParam).toBe('applicationId')
        expect(props.accessDeniedRedirectTo).toBe('/x')

        await expect(props.fetchResource('m1')).resolves.toEqual({ id: 'm1', name: 'Test' })
        expect(getApplication).toHaveBeenCalledWith('m1')
    })
})
