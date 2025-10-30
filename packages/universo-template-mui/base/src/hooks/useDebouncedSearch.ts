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
        return () => {
            debouncedSetSearch.cancel()
        }
    }, [debouncedSetSearch])

    // Handler for input change events
    const handleSearchChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            const newValue = e.target.value
            setSearchValue(newValue)
            debouncedSetSearch(newValue)
        },
        [debouncedSetSearch]
    )

    // Direct setter (for programmatic changes)
    const setSearchValueDirect = useCallback(
        (value: string) => {
            setSearchValue(value)
            debouncedSetSearch(value)
        },
        [debouncedSetSearch]
    )

    return {
        searchValue,
        handleSearchChange,
        setSearchValue: setSearchValueDirect,
        debounced: {
            cancel: debouncedSetSearch.cancel,
            flush: debouncedSetSearch.flush,
            isPending: debouncedSetSearch.isPending
        }
    }
}
