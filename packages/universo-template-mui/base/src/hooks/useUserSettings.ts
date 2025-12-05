import { useState, useEffect, useCallback } from 'react'

/**
 * User settings stored in profile (synced across devices)
 */
export interface UserSettingsData {
    /** Admin-only settings (superadmin/supermoderator) */
    admin?: {
        /** Show all items in lists (all users' data) vs only own items */
        showAllItems?: boolean
    }
    /** Display preferences (for all users) */
    display?: {
        /** Default view mode for lists */
        defaultViewMode?: 'card' | 'list'
        /** Items per page */
        itemsPerPage?: number
    }
}

// In-memory cache for settings
let settingsCache: { settings: UserSettingsData; loaded: boolean } = {
    settings: {},
    loaded: false
}

// Subscribers for settings changes
type SettingsSubscriber = (settings: UserSettingsData) => void
const subscribers: Set<SettingsSubscriber> = new Set()

/**
 * Notify all subscribers of settings change
 */
function notifySubscribers(settings: UserSettingsData): void {
    subscribers.forEach((fn) => fn(settings))
}

/**
 * Hook to access and update user settings.
 * Settings are stored server-side in user profile.
 *
 * @returns { settings, updateSettings, loading, error }
 */
export function useUserSettings(): {
    settings: UserSettingsData
    updateSettings: (newSettings: Partial<UserSettingsData>) => Promise<void>
    loading: boolean
    error: string | null
} {
    const [settings, setSettings] = useState<UserSettingsData>(settingsCache.settings)
    const [loading, setLoading] = useState(!settingsCache.loaded)
    const [error, setError] = useState<string | null>(null)

    // Subscribe to settings changes from other hook instances
    useEffect(() => {
        const handleUpdate = (newSettings: UserSettingsData) => {
            setSettings(newSettings)
        }
        subscribers.add(handleUpdate)
        return () => {
            subscribers.delete(handleUpdate)
        }
    }, [])

    // Load settings on mount if not cached
    useEffect(() => {
        if (settingsCache.loaded) {
            setSettings(settingsCache.settings)
            setLoading(false)
            return
        }

        fetch('/api/v1/profile/settings', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        })
            .then((response) => {
                if (!response.ok) {
                    // 401 means not authenticated, 404 means no profile
                    // Both are acceptable - use default empty settings
                    return { success: true, data: {} }
                }
                return response.json()
            })
            .then((data) => {
                const loadedSettings = data?.data || {}
                settingsCache = { settings: loadedSettings, loaded: true }
                setSettings(loadedSettings)
                setLoading(false)
            })
            .catch((err) => {
                setError(err.message || 'Failed to load settings')
                settingsCache = { settings: {}, loaded: true }
                setLoading(false)
            })
    }, [])

    // Update settings
    const updateSettings = useCallback(async (newSettings: Partial<UserSettingsData>) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/v1/profile/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ settings: newSettings })
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Failed to update settings')
            }

            const data = await response.json()
            const updatedSettings = data.data || {}

            // Update cache and notify all subscribers
            settingsCache = { settings: updatedSettings, loaded: true }
            notifySubscribers(updatedSettings)
            setSettings(updatedSettings)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to update settings'
            setError(message)
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    return { settings, updateSettings, loading, error }
}

/**
 * Reset the settings cache. Useful after login/logout.
 */
export function resetUserSettingsCache(): void {
    settingsCache = { settings: {}, loaded: false }
}

/**
 * Get cached showAllItems setting (synchronous, for use in queries)
 * Returns undefined if settings not yet loaded
 */
export function getShowAllItemsSetting(): boolean | undefined {
    if (!settingsCache.loaded) return undefined
    return settingsCache.settings.admin?.showAllItems
}
