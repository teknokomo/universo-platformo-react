/**
 * useCookieConsent - Hook for managing cookie consent state in localStorage
 *
 * Manages the cookie consent banner visibility and user preference storage.
 * Uses localStorage to persist user's choice across sessions.
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
 * Hook to manage cookie consent state
 * @returns Object with consent status and control functions
 */
export function useCookieConsent(): UseCookieConsentReturn {
    const [status, setStatus] = useState<CookieConsentStatus>(() => {
        // Initialize from localStorage on first render
        if (typeof window === 'undefined') return 'pending'

        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'accepted') return 'accepted'
        // rejected is not stored permanently - always show banner on reload
        return 'pending'
    })

    // Sync with localStorage on mount (for SSR hydration)
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored === 'accepted' && status !== 'accepted') {
            setStatus('accepted')
        }
    }, [status])

    const acceptCookies = useCallback(() => {
        localStorage.setItem(STORAGE_KEY, 'accepted')
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
        localStorage.removeItem(STORAGE_KEY)
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

export default useCookieConsent
