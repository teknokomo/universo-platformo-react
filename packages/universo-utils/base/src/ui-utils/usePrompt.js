import { useCallback, useContext, useEffect } from 'react'
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom'

// https://stackoverflow.com/questions/71572678/react-router-v-6-useprompt-typescript

export function useBlocker(blocker, when = true) {
    const { navigator } = useContext(NavigationContext)

    useEffect(() => {
        if (!when) return

        // React Router v6 may provide a navigator without `block` in some setups.
        // Guard against undefined and fallback to beforeunload to avoid crashes.
        const canBlock = navigator && typeof navigator.block === 'function'

        if (canBlock) {
            const unblock = navigator.block((tx) => {
                const autoUnblockingTx = {
                    ...tx,
                    retry() {
                        unblock()
                        tx.retry()
                    }
                }

                blocker(autoUnblockingTx)
            })

            return unblock
        }

        // Fallback: warn on page unload/refresh when route-level block is unavailable.
        const beforeUnload = (e) => {
            // Standard way to trigger confirmation dialog in browsers
            e.preventDefault()
            e.returnValue = ''
            return ''
        }

        window.addEventListener('beforeunload', beforeUnload)
        return () => window.removeEventListener('beforeunload', beforeUnload)
    }, [navigator, blocker, when])
}

export function usePrompt(message, when = true) {
    const blocker = useCallback(
        (tx) => {
            if (window.confirm(message)) tx.retry()
        },
        [message]
    )

    useBlocker(blocker, when)
}
