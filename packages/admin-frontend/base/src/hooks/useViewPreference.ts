import { useCallback, useState } from 'react'

/**
 * Supported view styles for list pages.
 *
 * Kept local to avoid bundler chunk cycles between host router package and feature modules.
 */
export type ViewStyle = 'card' | 'table' | 'list'

/**
 * Default view style when no preference is stored.
 */
export const DEFAULT_VIEW_STYLE: ViewStyle = 'card'

/**
 * Check if localStorage is available (SSR-safe).
 */
const isLocalStorageAvailable = (): boolean => {
    if (typeof window === 'undefined') return false
    try {
        const testKey = '__test_localStorage__'
        window.localStorage.setItem(testKey, testKey)
        window.localStorage.removeItem(testKey)
        return true
    } catch {
        // localStorage is disabled (private mode, quota exceeded, etc.)
        return false
    }
}

/**
 * Hook for managing list view preference (card/table/list) with localStorage persistence.
 */
export function useViewPreference(storageKey: string, defaultView: ViewStyle = DEFAULT_VIEW_STYLE): [ViewStyle, (view: ViewStyle) => void] {
    const [view, setViewState] = useState<ViewStyle>(() => {
        if (!isLocalStorageAvailable()) return defaultView
        try {
            const stored = localStorage.getItem(storageKey)
            if (stored && (stored === 'card' || stored === 'table' || stored === 'list')) {
                return stored
            }
        } catch {
            // Ignore localStorage read errors
        }
        return defaultView
    })

    const setView = useCallback(
        (nextView: ViewStyle) => {
            setViewState(nextView)
            if (isLocalStorageAvailable()) {
                try {
                    localStorage.setItem(storageKey, nextView)
                } catch {
                    // Ignore localStorage write errors (quota exceeded, etc.)
                }
            }
        },
        [storageKey]
    )

    return [view, setView]
}
