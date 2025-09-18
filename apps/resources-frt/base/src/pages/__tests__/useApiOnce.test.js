import React, { useEffect, useState } from 'react'
import { describe, test, expect, vi } from 'vitest'
import { renderWithProviders, waitFor, screen } from '@testing/frontend'
import useApi from 'flowise-ui/src/hooks/useApi'

const apiFunc = vi.fn(async () => ({ data: null }))

function TestComponent() {
    const { request } = useApi(apiFunc)
    const [, setTick] = useState(0)
    useEffect(() => {
        request()
    }, [request])
    useEffect(() => {
        setTick(1)
    }, [])
    return null
}

describe('useApi', () => {
    test('useApi request fires only once on mount', async () => {
        await renderWithProviders(React.createElement(TestComponent), {
            withTheme: false,
            withI18n: false,
            withRouter: false,
            withRedux: false,
        })

        await waitFor(() => {
            expect(apiFunc).toHaveBeenCalledTimes(1)
        })
    })

    test('useApi resolves data for consumers', async () => {
        const successResponse = { data: { message: 'ok' } }
        const successApi = vi.fn(async () => successResponse)

        function SuccessComponent() {
            const { request } = useApi(successApi)
            const [message, setMessage] = useState('loading')

            useEffect(() => {
                request().then((result) => {
                    setMessage(result?.message ?? 'missing')
                })
            }, [request])

            return React.createElement('div', null, message)
        }

        await renderWithProviders(React.createElement(SuccessComponent), {
            withTheme: false,
            withI18n: false,
            withRouter: false,
            withRedux: false,
        })

        await waitFor(() => expect(successApi).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument())
    })

    test('useApi ignores state updates after unmount', async () => {
        let resolve = () => {}
        const delayedApi = vi.fn(
            () =>
                new Promise((res) => {
                    resolve = res
                })
        )

        function UnmountComponent() {
            const { request } = useApi(delayedApi)
            useEffect(() => {
                request()
            }, [request])
            return null
        }

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const { unmount } = await renderWithProviders(React.createElement(UnmountComponent), {
            withTheme: false,
            withI18n: false,
            withRouter: false,
            withRedux: false,
        })
        unmount()
        resolve({ data: null })
        await waitFor(() => {
            expect(consoleErrorSpy).not.toHaveBeenCalled()
        })

        consoleErrorSpy.mockRestore()
    })
})
