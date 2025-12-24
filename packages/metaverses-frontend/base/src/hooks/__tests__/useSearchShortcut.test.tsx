import React, { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('useSearchShortcut', () => {
    it('focuses input on Cmd+F on mac when onFocus is not provided', async () => {
        vi.doMock('../../utils/genericHelper', () => ({
            getOS: () => 'macos'
        }))

        const { default: useSearchShortcut } = await import('../useSearchShortcut')

        function Test() {
            const inputRef = useRef<HTMLInputElement>(null)
            useSearchShortcut({ inputRef })
            return <input ref={inputRef} data-testid='input' />
        }

        const { getByTestId } = render(<Test />)
        const input = getByTestId('input') as HTMLInputElement

        expect(document.activeElement).not.toBe(input)

        const ev = new KeyboardEvent('keydown', { key: 'f', metaKey: true, cancelable: true })
        const dispatched = document.dispatchEvent(ev)

        expect(dispatched).toBe(false)
        expect(document.activeElement).toBe(input)
    })

    it('calls onFocus on Ctrl+F on non-mac and removes listener on unmount', async () => {
        vi.doMock('../../utils/genericHelper', () => ({
            getOS: () => 'windows'
        }))

        const { default: useSearchShortcut } = await import('../useSearchShortcut')

        const onFocus = vi.fn()

        function Test() {
            const inputRef = useRef<HTMLInputElement>(null)
            useSearchShortcut({ inputRef, onFocus })
            return <input ref={inputRef} data-testid='input' />
        }

        const { unmount } = render(<Test />)

        const ev = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
        const dispatched = document.dispatchEvent(ev)

        expect(dispatched).toBe(false)
        expect(onFocus).toHaveBeenCalledTimes(1)

        unmount()

        const ev2 = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
        document.dispatchEvent(ev2)

        expect(onFocus).toHaveBeenCalledTimes(1)
    })

    it('blurs input on Escape', async () => {
        vi.doMock('../../utils/genericHelper', () => ({
            getOS: () => 'linux'
        }))

        const { default: useSearchShortcut } = await import('../useSearchShortcut')

        function Test() {
            const inputRef = useRef<HTMLInputElement>(null)
            useSearchShortcut({ inputRef })
            return <input ref={inputRef} data-testid='input' />
        }

        const { getByTestId } = render(<Test />)
        const input = getByTestId('input') as HTMLInputElement

        input.focus()
        expect(document.activeElement).toBe(input)

        fireEvent.keyDown(input, { key: 'Escape' })
        expect(document.activeElement).not.toBe(input)
    })
})
