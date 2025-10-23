import React, { useState, useCallback, useEffect } from 'react'
import { Box, Pagination, TextField, InputAdornment, Typography, Stack } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useTranslation } from 'react-i18next'
import type { PaginationState, PaginationActions } from '../../types/pagination'

export interface PaginationControlsProps {
    /**
     * Pagination state from usePaginated hook
     */
    pagination: PaginationState

    /**
     * Pagination actions from usePaginated hook
     */
    actions: PaginationActions

    /**
     * Whether component is in loading state
     */
    isLoading?: boolean

    /**
     * Show search input
     */
    showSearch?: boolean

    /**
     * Search input placeholder
     */
    searchPlaceholder?: string

    /**
     * Debounce delay for search in milliseconds
     */
    debounceMs?: number

    /**
     * Translation namespace (defaults to 'common')
     */
    namespace?: string
}

/**
 * Universal pagination controls component
 *
 * Provides search input with debounce and Material-UI Pagination component.
 * Designed to work with usePaginated hook.
 *
 * @example
 * ```typescript
 * const paginationResult = usePaginated({...})
 *
 * <PaginationControls
 *   pagination={paginationResult.pagination}
 *   actions={paginationResult.actions}
 *   isLoading={paginationResult.isLoading}
 *   searchPlaceholder={t('search.placeholder')}
 * />
 * ```
 */
export function PaginationControls({
    pagination,
    actions,
    isLoading = false,
    showSearch = true,
    searchPlaceholder,
    debounceMs = 300,
    namespace = 'common'
}: PaginationControlsProps) {
    const { t } = useTranslation(namespace)

    // Local state for search input (for debouncing)
    const [localSearch, setLocalSearch] = useState('')

    // Debounced search effect
    useEffect(() => {
        const timer = setTimeout(() => {
            actions.setSearch(localSearch)
        }, debounceMs)

        return () => clearTimeout(timer)
    }, [localSearch, actions, debounceMs])

    const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setLocalSearch(event.target.value)
    }, [])

    const handlePageChange = useCallback(
        (_event: React.ChangeEvent<unknown>, page: number) => {
            actions.goToPage(page)
        },
        [actions]
    )

    return (
        <Box sx={{ mt: 2, mb: 2 }}>
            <Stack spacing={2}>
                {/* Search Input */}
                {showSearch && (
                    <TextField
                        fullWidth
                        size='small'
                        placeholder={searchPlaceholder || t('pagination.search', 'Search...')}
                        value={localSearch}
                        onChange={handleSearchChange}
                        disabled={isLoading}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position='start'>
                                    <SearchIcon />
                                </InputAdornment>
                            )
                        }}
                    />
                )}

                {/* Pagination Info and Controls */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2
                    }}
                >
                    {/* Pagination Info */}
                    <Typography variant='body2' color='text.secondary'>
                        {pagination.totalItems > 0
                            ? t('pagination.showing', {
                                  start: (pagination.currentPage - 1) * pagination.pageSize + 1,
                                  end: Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems),
                                  total: pagination.totalItems,
                                  defaultValue: 'Showing {{start}} to {{end}} of {{total}} results'
                              })
                            : t('pagination.noResults', 'No results found')}
                    </Typography>

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <Pagination
                            count={pagination.totalPages}
                            page={pagination.currentPage}
                            onChange={handlePageChange}
                            disabled={isLoading}
                            color='primary'
                            showFirstButton
                            showLastButton
                        />
                    )}
                </Box>
            </Stack>
        </Box>
    )
}
