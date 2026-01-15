import { useState, useCallback } from 'react'

/**
 * Supported view styles for list pages
 */
export type ViewStyle = 'card' | 'table' | 'list'

/**
 * Default view style when no preference is stored
 */
export const DEFAULT_VIEW_STYLE: ViewStyle = 'card'

/**
 * Check if localStorage is available (SSR-safe)
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
 * Centralizes view state management pattern used across list pages.
 *
 * Features:
 * - SSR-safe: Works in server-side rendering environments
 * - Error-safe: Handles localStorage unavailability (private mode, quota exceeded)
 * - Type-safe: Full TypeScript support with ViewStyle union type
 * - Memoized: setView callback is stable across re-renders
 *
 * @param storageKey - The localStorage key to persist the view preference
 * @param defaultView - Optional default view style (defaults to 'card')
 * @returns [currentView, setView] tuple with automatic localStorage sync
 *
 * @example
 * ```tsx
 * import { useViewPreference } from '@universo/template-mui'
 *
 * const MyListPage = () => {
 *   const [view, setView] = useViewPreference('myListDisplayStyle')
 *   return <ToolbarControls view={view} onViewChange={setView} />
 * }
 * ```
 */
export function useViewPreference(
    storageKey: string,
    defaultView: ViewStyle = DEFAULT_VIEW_STYLE
): [ViewStyle, (view: ViewStyle) => void] {
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
