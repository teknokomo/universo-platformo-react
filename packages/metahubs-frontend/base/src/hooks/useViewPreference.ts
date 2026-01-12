import { useState, useCallback } from 'react'
import { StorageKey, ViewStyle, DEFAULT_VIEW_STYLE } from '../constants/storage'

/**
 * Hook for managing list view preference (card/table) with localStorage persistence.
 * Centralizes view state management pattern used across list pages.
 *
 * @param storageKey - The localStorage key to persist the view preference
 * @returns [currentView, setView] tuple with automatic localStorage sync
 *
 * @example
 * ```tsx
 * import { useViewPreference } from '../hooks/useViewPreference'
 * import { STORAGE_KEYS } from '../constants/storage'
 *
 * const MyListPage = () => {
 *   const [view, setView] = useViewPreference(STORAGE_KEYS.CATALOG_DISPLAY_STYLE)
 *   return <ToolbarControls view={view} onViewChange={setView} />
 * }
 * ```
 */
export function useViewPreference(storageKey: StorageKey): [ViewStyle, (view: ViewStyle) => void] {
    const [view, setViewState] = useState<ViewStyle>(() => {
        const stored = localStorage.getItem(storageKey)
        return (stored as ViewStyle) || DEFAULT_VIEW_STYLE
    })

    const setView = useCallback(
        (nextView: ViewStyle) => {
            localStorage.setItem(storageKey, nextView)
            setViewState(nextView)
        },
        [storageKey]
    )

    return [view, setView]
}
