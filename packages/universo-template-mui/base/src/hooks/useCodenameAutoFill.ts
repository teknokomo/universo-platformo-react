import { useEffect, useRef } from 'react'

export interface UseCodenameAutoFillOptions {
    /**
     * Current codename value from form state
     */
    codename: string

    /**
     * Whether the codename field has been manually touched by user
     */
    codenameTouched: boolean

    /**
     * Suggested codename derived from name (sanitized/slugified)
     */
    nextCodename: string

    /**
     * Current name value (used to detect empty state)
     */
    nameValue: string

    /**
     * Function to update form field values
     * @param field - The field name to update
     * @param value - The new value
     */
    setValue: (field: 'codename' | 'codenameTouched', value: string | boolean) => void
}

/**
 * Hook for auto-filling codename field based on localized name input.
 *
 * This hook implements the following logic:
 * 1. If the user has manually touched the codename field, auto-fill is disabled
 * 2. If both codename and name become empty while touched, reset touch state
 * 3. If name changes, automatically update codename with sanitized version
 * 4. If name is cleared, clear the codename as well
 *
 * The hook is designed to work with VLC (Versioned Localized Content) forms
 * where the name field may have multiple locale values and the codename
 * should be derived from the primary locale.
 *
 * @example
 * ```tsx
 * const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null
 * const codename = values.codename ?? ''
 * const codenameTouched = Boolean(values.codenameTouched)
 * const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
 * const nameValue = getVLCString(nameVlc, primaryLocale)
 * const nextCodename = sanitizeCodename(nameValue)
 *
 * useCodenameAutoFill({
 *     codename,
 *     codenameTouched,
 *     nextCodename,
 *     nameValue,
 *     setValue
 * })
 * ```
 */
export function useCodenameAutoFill({ codename, codenameTouched, nextCodename, nameValue, setValue }: UseCodenameAutoFillOptions): void {
    // Track if this is the first render to avoid unnecessary updates
    const isFirstRender = useRef(true)

    useEffect(() => {
        // Skip first render to avoid resetting initial values
        if (isFirstRender.current) {
            isFirstRender.current = false
            // Still need to sync if there's a mismatch on initial load in untouched state
            if (!codenameTouched && nextCodename && nextCodename !== codename) {
                setValue('codename', nextCodename)
            }
            return
        }

        // Reset touch state if both codename and name are empty
        if (codenameTouched && !codename && !nameValue) {
            setValue('codenameTouched', false)
            return
        }

        // Don't auto-fill if user has manually edited codename
        if (codenameTouched) return

        // Clear codename if name is empty
        if (!nextCodename) {
            if (codename) {
                setValue('codename', '')
            }
            return
        }

        // Update codename if it differs from suggestion
        if (nextCodename === codename) return
        setValue('codename', nextCodename)
    }, [codenameTouched, nextCodename, codename, nameValue, setValue])
}

export default useCodenameAutoFill
