import { render, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { vi, expect, test } from 'vitest'
import useApi from 'flowise-ui/src/hooks/useApi'

const apiFunc = vi.fn(async () => ({ data: null }))

function TestComponent() {
    const { request } = useApi(apiFunc)
    const [_, setTick] = useState(0)
    useEffect(() => {
        request()
    }, [request])
    useEffect(() => {
        setTick(1)
    }, [])
    return null
}

test('useApi request fires only once on mount', async () => {
    render(<TestComponent />)
    await waitFor(() => {
        expect(apiFunc).toHaveBeenCalledTimes(1)
    })
})

test('useApi ignores state updates after unmount', async () => {
    let resolve
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

    const { unmount } = render(<UnmountComponent />)
    unmount()
    resolve({ data: null })
    await waitFor(() => {
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    consoleErrorSpy.mockRestore()
})
