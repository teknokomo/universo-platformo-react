import {
    useDebugValue,
    useEffect,
    useMemo,
    useRef,
    useSyncExternalStore as nativeUseSyncExternalStore
} from 'react'

import { useSyncExternalStore as baseUseSyncExternalStore } from './index'

const objectIs = typeof Object.is === 'function' ? Object.is : (x, y) => (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)

if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[use-sync-external-store] selector shim active')
}

export function useSyncExternalStoreWithSelector(subscribe, getSnapshot, getServerSnapshot, selector, isEqual) {
    const instRef = useRef({ hasValue: false, value: undefined })

    const [getSelectedSnapshot, getSelectedServerSnapshot] = useMemo(() => {
        let hasMemo = false
        let memoizedSnapshot
        let memoizedSelection

        const memoizedSelector = (nextSnapshot) => {
            if (!hasMemo) {
                hasMemo = true
                memoizedSnapshot = nextSnapshot
                const nextSelection = selector(nextSnapshot)
                if (typeof isEqual === 'function' && instRef.current.hasValue) {
                    const currentSelection = instRef.current.value
                    if (isEqual(currentSelection, nextSelection)) {
                        memoizedSelection = currentSelection
                        return memoizedSelection
                    }
                }
                memoizedSelection = nextSelection
                return memoizedSelection
            }

            const currentSelection = memoizedSelection
            if (objectIs(memoizedSnapshot, nextSnapshot)) {
                return currentSelection
            }

            const nextSelection = selector(nextSnapshot)
            if (typeof isEqual === 'function' && isEqual(currentSelection, nextSelection)) {
                memoizedSnapshot = nextSnapshot
                return currentSelection
            }

            memoizedSnapshot = nextSnapshot
            memoizedSelection = nextSelection
            return memoizedSelection
        }

        const maybeServerSnapshot = typeof getServerSnapshot === 'function' ? getServerSnapshot : undefined

        return [
            () => memoizedSelector(getSnapshot()),
            typeof maybeServerSnapshot === 'function' ? () => memoizedSelector(maybeServerSnapshot()) : undefined
        ]
    }, [getSnapshot, getServerSnapshot, selector, isEqual])

    const subscribeFn = nativeUseSyncExternalStore ? nativeUseSyncExternalStore : baseUseSyncExternalStore
    const value = subscribeFn(subscribe, getSelectedSnapshot, getSelectedServerSnapshot)

    useEffect(() => {
        instRef.current.hasValue = true
        instRef.current.value = value
    }, [value])

    useDebugValue(value)
    return value
}

export default useSyncExternalStoreWithSelector
