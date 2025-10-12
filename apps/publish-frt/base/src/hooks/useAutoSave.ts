import { useEffect, useRef, useState, useCallback } from 'react'

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseAutoSaveOptions<T> {
    data: T
    onSave: (data: T) => Promise<void>
    delay?: number
    enableBeforeUnload?: boolean
    enabled?: boolean
}

export interface UseAutoSaveReturn {
    status: AutoSaveStatus
    hasUnsavedChanges: boolean
    triggerSave: () => Promise<void>
}

/**
 * Auto-save hook with debouncing, status indication, and beforeunload protection
 *
 * @template T - Type of data being saved
 * @param options - Configuration options
 * @param options.data - Data to auto-save (changes trigger debounced save)
 * @param options.onSave - Async function to perform the save operation
 * @param options.delay - Debounce delay in milliseconds (default: 500)
 * @param options.enableBeforeUnload - Show warning on page close with unsaved changes (default: false)
 *
 * @returns Object with status, hasUnsavedChanges flag, and manual triggerSave function
 *
 * @example
 * ```tsx
 * const { status, hasUnsavedChanges } = useAutoSave({
 *   data: settingsData,
 *   onSave: async (data) => await api.saveSettings(data),
 *   delay: 500,
 *   enableBeforeUnload: true
 * })
 * ```
 */
export function useAutoSave<T>({
    data,
    onSave,
    delay = 500,
    enableBeforeUnload = false,
    enabled = true
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
    const [status, setStatus] = useState<AutoSaveStatus>('idle')
    const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isFirstRenderRef = useRef(true)
    const isSavingRef = useRef(false)
    const pendingSaveRef = useRef(false)
    const latestDataRef = useRef(data)
    const latestOnSaveRef = useRef(onSave)
    const hasUnsavedChangesRef = useRef(false)

    const setHasUnsavedChanges = useCallback((value: boolean) => {
        hasUnsavedChangesRef.current = value
        setHasUnsavedChangesState(value)
    }, [])

    useEffect(() => {
        latestDataRef.current = data
    }, [data])

    useEffect(() => {
        latestOnSaveRef.current = onSave
    }, [onSave])

    useEffect(() => {
        if (!enabled) {
            pendingSaveRef.current = false

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
        }
    }, [enabled])

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])

    const triggerSave = useCallback(async () => {
        if (!enabled) {
            return
        }

        if (isSavingRef.current) {
            pendingSaveRef.current = true
            return
        }

        setStatus('saving')
        isSavingRef.current = true
        // Mark current unsaved changes as being processed while keeping the state value
        // until we know whether new changes arrived during the save.
        hasUnsavedChangesRef.current = false

        try {
            await latestOnSaveRef.current(latestDataRef.current)
            const hasQueuedChanges = pendingSaveRef.current || hasUnsavedChangesRef.current

            if (hasQueuedChanges) {
                setHasUnsavedChanges(true)
            } else {
                setHasUnsavedChanges(false)
            }
            setStatus('saved')
            // Reset to idle after 2 seconds
            setTimeout(() => {
                setStatus('idle')
            }, 2000)
        } catch (error) {
            console.error('useAutoSave: save failed', error)
            setStatus('error')
            setHasUnsavedChanges(true)
        } finally {
            isSavingRef.current = false

            if (!enabled) {
                pendingSaveRef.current = false
            } else if (pendingSaveRef.current || hasUnsavedChangesRef.current) {
                pendingSaveRef.current = false
                triggerSave()
            }
        }
    }, [enabled, setHasUnsavedChanges])

    useEffect(() => {
        if (!enabled) {
            setHasUnsavedChanges(false)
            setStatus('idle')
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
            }
            return
        }

        // Skip first render (initialization)
        if (isFirstRenderRef.current) {
            isFirstRenderRef.current = false
            return
        }

        // Clear previous timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        setHasUnsavedChanges(true)
        setStatus('idle')

        // Schedule debounced save
        timeoutRef.current = setTimeout(() => {
            triggerSave()
        }, delay)

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [data, delay, enabled, triggerSave, setHasUnsavedChanges])

    // beforeunload protection
    useEffect(() => {
        if (!enableBeforeUnload || !enabled) {
            return
        }

        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (hasUnsavedChanges || status === 'saving') {
                event.preventDefault()
                // Modern browsers show generic message, but setting returnValue is required
                event.returnValue = ''
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [enableBeforeUnload, enabled, hasUnsavedChanges, status])

    return {
        status,
        hasUnsavedChanges,
        triggerSave
    }
}
