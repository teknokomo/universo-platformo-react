import { useEffect, useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'

import { ConfirmContextProvider } from '../../contexts/ConfirmContextProvider'
import { useConfirm } from '../useConfirm'

jest.useFakeTimers()

const TriggerConfirm = ({ onResolved }: { onResolved: (value: boolean) => void }) => {
    const { confirm } = useConfirm()

    return (
        <button
            type='button'
            onClick={async () => {
                const result = await confirm({
                    title: 'Delayed confirmation',
                    description: 'Wait for the dialog to mount'
                })
                onResolved(result)
            }}
        >
            Open confirm
        </button>
    )
}

const DelayedConfirmRenderer = () => {
    const { confirmState, onConfirm } = useConfirm()
    const [ready, setReady] = useState(false)

    useEffect(() => {
        const timerId = window.setTimeout(() => setReady(true), 2100)
        return () => window.clearTimeout(timerId)
    }, [])

    if (!ready || !confirmState.show) {
        return null
    }

    return (
        <div data-confirm-dialog-request-id={confirmState.requestId || undefined}>
            <button type='button' onClick={onConfirm}>
                Confirm delayed dialog
            </button>
        </div>
    )
}

describe('useConfirm', () => {
    afterEach(() => {
        jest.clearAllTimers()
        jest.restoreAllMocks()
    })

    it('waits for a delayed confirm dialog mount before auto-cancelling the request', async () => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
        const onResolved = jest.fn()
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

        render(
            <ConfirmContextProvider>
                <TriggerConfirm onResolved={onResolved} />
                <DelayedConfirmRenderer />
            </ConfirmContextProvider>
        )

        await user.click(screen.getByRole('button', { name: 'Open confirm' }))

        act(() => {
            jest.advanceTimersByTime(2100)
        })

        expect(onResolved).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Confirm delayed dialog' })).toBeInTheDocument()

        await user.click(screen.getByRole('button', { name: 'Confirm delayed dialog' }))

        expect(onResolved).toHaveBeenCalledWith(true)
        expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
})
