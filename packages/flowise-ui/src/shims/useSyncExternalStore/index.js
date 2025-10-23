import {
    useDebugValue,
    useEffect,
    useLayoutEffect,
    useState,
    useSyncExternalStore as nativeUseSyncExternalStore
} from 'react'

const objectIs = typeof Object.is === 'function' ? Object.is : (x, y) => (x === y && (x !== 0 || 1 / x === 1 / y)) || (x !== x && y !== y)

if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.info('[use-sync-external-store] custom shim active')
}

const isServer = typeof window === 'undefined' || typeof window.document === 'undefined' || typeof window.document.createElement === 'undefined'

const useSyncExternalStoreServer = (subscribe, getSnapshot) => {
    void subscribe
    return getSnapshot()
}

const useSyncExternalStoreClient = (subscribe, getSnapshot) => {
    const [inst, forceUpdate] = useState({ value: getSnapshot(), getSnapshot })

    const checkForUpdates = () => {
        const latestValue = inst.getSnapshot()
        if (!objectIs(inst.value, latestValue)) {
            forceUpdate({ value: latestValue, getSnapshot })
        }
    }

    useLayoutEffect(() => {
        inst.value = getSnapshot()
        inst.getSnapshot = getSnapshot
        checkForUpdates()
        // subscribe returns unsubscribe function
        return subscribe(() => {
            inst.value = inst.getSnapshot()
            checkForUpdates()
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subscribe, getSnapshot])

    useEffect(checkForUpdates, [checkForUpdates])
    useDebugValue(inst.value)
    return inst.value
}

const fallbackHook = isServer ? useSyncExternalStoreServer : useSyncExternalStoreClient

export function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
    if (typeof nativeUseSyncExternalStore === 'function') {
        return nativeUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot ?? getSnapshot)
    }

    const snapshotFn = isServer && typeof getServerSnapshot === 'function' ? getServerSnapshot : getSnapshot
    return fallbackHook(subscribe, snapshotFn)
}

export default useSyncExternalStore
