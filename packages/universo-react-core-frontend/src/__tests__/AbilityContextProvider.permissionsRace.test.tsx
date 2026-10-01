// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, Fragment } from 'react'
import { AbilityContextProvider, useAbility } from '@universo-react/store'

const deferred = <T,>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((resolvePromise) => {
        resolve = resolvePromise
    })
    return { promise, resolve }
}

const createAuthenticatedPermissionsResponse = () =>
    new Response(JSON.stringify({ permissions: [{ subject: 'metahubs', action: 'read' }], globalRoles: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })

const PermissionProbe = () => {
    const { ability, loading, refreshAbility, clearAbility } = useAbility()

    return createElement(
        Fragment,
        null,
        createElement('output', { 'data-testid': 'permission-state' }, ability.can('read', 'Metahub') ? 'allowed' : 'denied'),
        createElement('output', { 'data-testid': 'permission-loading' }, loading ? 'loading' : 'ready'),
        createElement('button', { onClick: () => void refreshAbility() }, 'Refresh permissions'),
        createElement('button', { onClick: clearAbility }, 'Clear permissions')
    )
}

const renderAbilityProvider = () => render(createElement(AbilityContextProvider, null, createElement(PermissionProbe)))

describe('AbilityContextProvider permission request ordering', () => {
    afterEach(() => {
        cleanup()
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('ignores stale permission responses after refresh and after clearing access', async () => {
        const initialPermissions = deferred<Response>()
        const postLogoutRefresh = deferred<Response>()
        const requestSignals: Array<AbortSignal | undefined> = []
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            requestSignals.push(init?.signal as AbortSignal | undefined)
            if (requestSignals.length === 1) return initialPermissions.promise
            if (requestSignals.length === 2) return Promise.resolve(createAuthenticatedPermissionsResponse())
            if (requestSignals.length === 3) return postLogoutRefresh.promise
            throw new Error(`Unexpected permissions request ${requestSignals.length}`)
        })
        vi.stubGlobal('fetch', fetchMock)
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        renderAbilityProvider()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }))
        })
        await waitFor(() => expect(screen.getByTestId('permission-state')).toHaveTextContent('allowed'))
        expect(requestSignals[0]?.aborted).toBe(true)

        await act(async () => {
            initialPermissions.resolve(new Response(null, { status: 401 }))
        })
        expect(screen.getByTestId('permission-state')).toHaveTextContent('allowed')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }))
        })
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
        expect(screen.getByTestId('permission-state')).toHaveTextContent('allowed')

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Clear permissions' }))
        })
        expect(screen.getByTestId('permission-state')).toHaveTextContent('denied')
        expect(screen.getByTestId('permission-loading')).toHaveTextContent('ready')
        expect(requestSignals[2]?.aborted).toBe(true)

        await act(async () => {
            postLogoutRefresh.resolve(createAuthenticatedPermissionsResponse())
        })
        expect(screen.getByTestId('permission-state')).toHaveTextContent('denied')
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('aborts the initial permission request when the provider unmounts without reporting a navigation abort', async () => {
        let requestSignal: AbortSignal | undefined
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            requestSignal = init?.signal as AbortSignal | undefined
            if (!requestSignal) throw new Error('The permission request did not receive an AbortSignal')
            return new Promise((_resolve, reject) => {
                requestSignal?.addEventListener('abort', () => reject(new TypeError('Failed to fetch')), { once: true })
            })
        })
        vi.stubGlobal('fetch', fetchMock)
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
        const { unmount } = renderAbilityProvider()

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(requestSignal?.aborted).toBe(false)

        unmount()

        await waitFor(() => expect(requestSignal?.aborted).toBe(true))
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('aborts pending permission requests on pagehide before navigation cancels fetch', async () => {
        let requestSignal: AbortSignal | undefined
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            requestSignal = init?.signal as AbortSignal | undefined
            if (!requestSignal) throw new Error('The permission request did not receive an AbortSignal')
            return new Promise((_resolve, reject) => {
                requestSignal?.addEventListener('abort', () => reject(new TypeError('Failed to fetch')), { once: true })
            })
        })
        vi.stubGlobal('fetch', fetchMock)
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        renderAbilityProvider()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
        expect(requestSignal?.aborted).toBe(false)

        await act(async () => {
            window.dispatchEvent(new Event('pagehide'))
            await new Promise((resolve) => setTimeout(resolve, 0))
        })

        expect(requestSignal?.aborted).toBe(true)
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('revalidates permissions after a BFCache restore when pagehide aborted the initial load', async () => {
        const requestSignals: Array<AbortSignal | undefined> = []
        const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const signal = init?.signal as AbortSignal | undefined
            requestSignals.push(signal)
            if (!signal) throw new Error('The permission request did not receive an AbortSignal')
            if (requestSignals.length === 1) {
                return new Promise((_resolve, reject) => {
                    signal.addEventListener('abort', () => reject(new TypeError('Failed to fetch')), { once: true })
                })
            }
            if (requestSignals.length === 2) return Promise.resolve(createAuthenticatedPermissionsResponse())
            throw new Error(`Unexpected permissions request ${requestSignals.length}`)
        })
        vi.stubGlobal('fetch', fetchMock)
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        renderAbilityProvider()
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

        await act(async () => {
            window.dispatchEvent(new Event('pagehide'))
            await new Promise((resolve) => setTimeout(resolve, 0))
        })
        expect(requestSignals[0]?.aborted).toBe(true)

        const pageshow = new Event('pageshow')
        Object.defineProperty(pageshow, 'persisted', { value: true })
        await act(async () => {
            window.dispatchEvent(pageshow)
        })

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(screen.getByTestId('permission-state')).toHaveTextContent('allowed'))
        expect(screen.getByTestId('permission-loading')).toHaveTextContent('ready')
        expect(consoleError).not.toHaveBeenCalled()
    })
})
