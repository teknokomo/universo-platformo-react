// Universo Platformo | Notifications and Error Handling Utility
// Centralized module for displaying notifications and logging errors

import type { TFunction } from 'i18next'

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'success' | 'info' | 'warning' | 'error'

/**
 * Notification options
 */
export interface NotificationOptions {
    /** Notification message */
    message: string
    /** Severity level */
    severity?: NotificationSeverity
    /** Duration in milliseconds (0 for persistent) */
    duration?: number
    /** Additional context for logging */
    context?: Record<string, any>
}

/**
 * Error logging options
 */
export interface ErrorLogOptions {
    /** Error object or message */
    error: Error | string
    /** Context identifier (e.g., component name) */
    context: string
    /** Additional metadata */
    metadata?: Record<string, any>
    /** Whether to show user notification */
    notify?: boolean
    /** Translation function for user-facing messages */
    t?: TFunction
}

/**
 * Notification callback type
 * This should be set by the application to handle notifications
 */
export type NotificationCallback = (options: NotificationOptions) => void

/**
 * Global notification handler
 * Set this in your app initialization to handle notifications
 */
let notificationHandler: NotificationCallback | null = null

/**
 * Set the global notification handler
 * @param handler - Function to handle notifications
 */
export function setNotificationHandler(handler: NotificationCallback): void {
    notificationHandler = handler
}

/**
 * Show a notification to the user
 * @param options - Notification options
 */
export function showNotification(options: NotificationOptions): void {
    if (notificationHandler) {
        notificationHandler(options)
    } else {
        // Fallback to console if no handler is set
        console.log(`[Notification ${options.severity || 'info'}]:`, options.message)
    }
}

/**
 * Show a success notification
 * @param message - Success message
 * @param duration - Duration in milliseconds
 */
export function showSuccess(message: string, duration = 3000): void {
    showNotification({ message, severity: 'success', duration })
}

/**
 * Show an info notification
 * @param message - Info message
 * @param duration - Duration in milliseconds
 */
export function showInfo(message: string, duration = 5000): void {
    showNotification({ message, severity: 'info', duration })
}

/**
 * Show a warning notification
 * @param message - Warning message
 * @param duration - Duration in milliseconds
 */
export function showWarning(message: string, duration = 5000): void {
    showNotification({ message, severity: 'warning', duration })
}

/**
 * Show an error notification
 * @param message - Error message
 * @param duration - Duration in milliseconds (0 for persistent)
 */
export function showError(message: string, duration = 0): void {
    showNotification({ message, severity: 'error', duration })
}

/**
 * Log an error with context and optionally notify the user
 * @param options - Error logging options
 */
export function logError(options: ErrorLogOptions): void {
    const { error, context, metadata, notify = false, t } = options

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    // Log to console with full context
    console.error(`[${context}] Error:`, {
        message: errorMessage,
        stack: errorStack,
        metadata
    })

    // Optionally notify user
    if (notify) {
        const userMessage = t ? translateError(errorMessage, t) : errorMessage

        showError(userMessage)
    }
}

/**
 * Translate common error messages to user-friendly text
 * @param errorMessage - Raw error message
 * @param t - Translation function
 * @returns Translated user-friendly message
 */
function translateError(errorMessage: string, t: TFunction): string {
    // Network errors
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
        return t('errors.network', 'Network error. Please check your connection and try again.')
    }

    // Authentication errors
    if (errorMessage.includes('auth') || errorMessage.includes('401') || errorMessage.includes('403')) {
        return t('errors.authentication', 'Authentication error. Please log in again.')
    }

    // Not found errors
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        return t('errors.notFound', 'The requested resource was not found.')
    }

    // Server errors
    if (errorMessage.includes('500') || errorMessage.includes('server')) {
        return t('errors.server', 'Server error. Please try again later.')
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return t('errors.validation', 'Invalid input. Please check your data and try again.')
    }

    // Default: return original message
    return errorMessage
}

/**
 * Handle API errors with consistent logging and notification
 * @param error - Error object
 * @param context - Context identifier
 * @param t - Translation function
 * @param notify - Whether to show user notification
 */
export function handleApiError(error: unknown, context: string, t?: TFunction, notify = true): void {
    const errorObj = error instanceof Error ? error : new Error(String(error))

    logError({
        error: errorObj,
        context,
        metadata: {
            timestamp: new Date().toISOString()
        },
        notify,
        t
    })
}

/**
 * Create a retry handler for failed operations
 * @param operation - Operation to retry
 * @param maxRetries - Maximum number of retries
 * @param delay - Delay between retries in milliseconds
 * @returns Promise that resolves when operation succeeds or max retries reached
 */
export async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (attempt < maxRetries) {
                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)))
            }
        }
    }

    // All retries failed
    throw lastError || new Error('Operation failed after retries')
}

/**
 * Check if the browser is online
 * @returns True if online, false otherwise
 */
export function isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Set up online/offline event listeners
 * @param onOnline - Callback when connection is restored
 * @param onOffline - Callback when connection is lost
 * @returns Cleanup function to remove listeners
 */
export function setupOnlineListeners(onOnline?: () => void, onOffline?: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {}
    }

    const handleOnline = () => {
        showSuccess('Connection restored')
        onOnline?.()
    }

    const handleOffline = () => {
        showWarning('No internet connection. Some features may be unavailable.')
        onOffline?.()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Return cleanup function
    return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
    }
}
