import { useState, useCallback, useEffect } from 'react'
import { useDebouncedCallback } from 'use-debounce'

export interface UseDebouncedSearchOptions {
    /**
     * Search setter function from usePaginated
     */
    onSearchChange: (search: string) => void

    /**
     * Initial search value
     * @default ''
     */
    initialValue?: string

    /**
     * Debounce delay in milliseconds
     * @default 300
     */
    delay?: number
}

export interface UseDebouncedSearchReturn {
    /**
     * Current local search value (for controlled input)
     */
    searchValue: string

    /**
     * Input change handler for search field
     */
    handleSearchChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void

    /**
     * Direct search value setter
     */
    setSearchValue: (value: string) => void

    /**
     * Debounced callback utilities
     */
    debounced: {
        cancel: () => void
        flush: () => void
        isPending: () => boolean
    }
}

/**
 * Universal debounced search hook for list views
 *
 * Integrates with usePaginated.actions.setSearch with automatic debouncing.
 *
 * @example
 * ```tsx
 * const paginationResult = usePaginated({...})
 *
 * const { searchValue, handleSearchChange } = useDebouncedSearch({
 *   onSearchChange: paginationResult.actions.setSearch,
 *   delay: 300
 * })
 *
 * <ViewHeader
 *   search={true}
 *   searchValue={searchValue}
 *   onSearchChange={handleSearchChange}
 * />
 * ```
 */
export function useDebouncedSearch({
    onSearchChange,
    initialValue = '',
    delay = 300
}: UseDebouncedSearchOptions): UseDebouncedSearchReturn {
    const [searchValue, setSearchValue] = useState(initialValue)
    const shouldDebounce = delay > 0

    // Debounced callback with use-debounce library
    const debouncedSetSearch = useDebouncedCallback(
        (value: string) => {
            onSearchChange(value)
        },
        delay,
        { leading: false, trailing: true }
    )

    // Cleanup on unmount
    useEffect(() => {
        if (!shouldDebounce) return undefined
        return () => {
            debouncedSetSearch.cancel()
        }
    }, [debouncedSetSearch, shouldDebounce])

    // Handler for input change events
    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value
            setSearchValue(newValue)
            if (shouldDebounce) {
                debouncedSetSearch(newValue)
                return
            }
            onSearchChange(newValue)
        },
        [debouncedSetSearch, onSearchChange, shouldDebounce]
    )

    // Direct setter (for programmatic changes)
    const setSearchValueDirect = useCallback(
        (value: string) => {
            setSearchValue(value)
            if (shouldDebounce) {
                debouncedSetSearch(value)
                return
            }
            onSearchChange(value)
        },
        [debouncedSetSearch, onSearchChange, shouldDebounce]
    )

    return {
        searchValue,
        handleSearchChange,
        setSearchValue: setSearchValueDirect,
        debounced: {
            cancel: shouldDebounce ? debouncedSetSearch.cancel : () => undefined,
            flush: shouldDebounce ? debouncedSetSearch.flush : () => undefined,
            isPending: shouldDebounce ? debouncedSetSearch.isPending : () => false
        }
    }
}
