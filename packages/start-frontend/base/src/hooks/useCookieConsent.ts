/**
 * useCookieConsent - Hook for managing cookie consent state in localStorage
 *
 * Manages the cookie consent banner visibility and user preference storage.
 * Uses localStorage to persist user's choice across sessions.
 *
 * SSR-safe implementation: initializes to 'pending' and syncs with localStorage
 * on mount to avoid hydration mismatches.
 */
import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'up_cookie_consent'

export type CookieConsentStatus = 'accepted' | 'rejected' | 'pending' | 'dismissed'

interface UseCookieConsentReturn {
    /** Current consent status */
    status: CookieConsentStatus
    /** Whether the banner should be shown */
    showBanner: boolean
    /** Accept cookies and hide banner permanently */
    acceptCookies: () => void
    /** Reject cookies (banner will reappear on page reload) */
    rejectCookies: () => void
    /** Temporarily dismiss banner until page reload (no localStorage change) */
    dismissTemporarily: () => void
    /** Reset consent (for testing or user request) */
    resetConsent: () => void
}

/**
 * Safely get item from localStorage (handles private browsing mode, disabled storage)
 */
function safeGetItem(key: string): string | null {
    try {
        if (typeof window === 'undefined') return null
        return localStorage.getItem(key)
    } catch {
        // localStorage may be unavailable or disabled
        return null
    }
}

/**
 * Safely set item in localStorage (handles quota exceeded, private browsing mode)
 */
function safeSetItem(key: string, value: string): boolean {
    try {
        if (typeof window === 'undefined') return false
        localStorage.setItem(key, value)
        return true
    } catch {
        // localStorage may be unavailable, disabled, or quota exceeded
        return false
    }
}

/**
 * Safely remove item from localStorage
 */
function safeRemoveItem(key: string): boolean {
    try {
        if (typeof window === 'undefined') return false
        localStorage.removeItem(key)
        return true
    } catch {
        // localStorage may be unavailable or disabled
        return false
    }
}

/**
 * Hook to manage cookie consent state
 * @returns Object with consent status and control functions
 */
export function useCookieConsent(): UseCookieConsentReturn {
    // Initialize to 'pending' - SSR-safe, avoids hydration mismatch
    const [status, setStatus] = useState<CookieConsentStatus>('pending')

    // On mount, check localStorage to sync state (SSR-safe)
    useEffect(() => {
        const stored = safeGetItem(STORAGE_KEY)
        if (stored === 'accepted') {
            setStatus('accepted')
        }
    }, []) // Empty dependency array - runs only once on mount

    const acceptCookies = useCallback(() => {
        safeSetItem(STORAGE_KEY, 'accepted')
        setStatus('accepted')
    }, [])

    const rejectCookies = useCallback(() => {
        // Don't save to localStorage - banner will reappear on page reload
        setStatus('rejected')
    }, [])

    const dismissTemporarily = useCallback(() => {
        // Temporarily hide banner without saving to localStorage
        // Banner will reappear on page reload
        setStatus('dismissed')
    }, [])

    const resetConsent = useCallback(() => {
        safeRemoveItem(STORAGE_KEY)
        setStatus('pending')
    }, [])

    return {
        status,
        // Show banner only if pending (not accepted, rejected, or dismissed)
        showBanner: status === 'pending',
        acceptCookies,
        rejectCookies,
        dismissTemporarily,
        resetConsent
    }
}
