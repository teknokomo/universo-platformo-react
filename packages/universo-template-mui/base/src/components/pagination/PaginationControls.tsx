import { TablePagination, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
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
     * Whether data is currently loading
     */
    isLoading?: boolean

    /**
     * Available page size options
     * @default [10, 20, 50, 100]
     */
    rowsPerPageOptions?: number[]

    /**
     * i18n namespace for translations
     * @default 'common'
     */
    namespace?: string
}

/**
 * Universal pagination controls using MUI TablePagination
 *
 * Integrates with usePaginated hook and provides:
 * - Page size selection (rows per page)
 * - Page navigation (first/prev/next/last)
 * - Current page info
 * - Full i18n support
 *
 * @example
 * ```tsx
 * const { data, pagination, actions, isLoading } = usePaginated({...})
 *
 * <PaginationControls
 *   pagination={pagination}
 *   actions={actions}
 *   isLoading={isLoading}
 *   rowsPerPageOptions={[10, 20, 50, 100]}
 *   namespace='common'
 * />
 * ```
 */
export const PaginationControls = ({
    pagination,
    actions,
    isLoading = false,
    rowsPerPageOptions = [10, 20, 50, 100],
    namespace = 'common'
}: PaginationControlsProps) => {
    const { t } = useTranslation(namespace, { i18n })

    // Convert 1-based currentPage (usePaginated) to 0-based page (MUI TablePagination)
    const muiPage = pagination.currentPage - 1

    // Handle page change from MUI (0-based) → convert to 1-based for usePaginated
    const handlePageChange = (_event: unknown, newPage: number) => {
        actions.goToPage(newPage + 1)
    }

    // Handle rows per page change
    const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newPageSize = parseInt(event.target.value, 10)
        actions.setPageSize(newPageSize)
    }

    return (
        <Box
            sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                overflow: 'hidden'
            }}
        >
            <TablePagination
                component='div'
                count={pagination.totalItems}
                page={muiPage}
                onPageChange={handlePageChange}
                rowsPerPage={pagination.pageSize}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={rowsPerPageOptions}
                labelRowsPerPage={t('pagination.rowsPerPage')}
                // Style rows-per-page Select to look like navigation buttons
                SelectProps={{
                    variant: 'outlined',
                    size: 'small',
                    sx: {
                        height: 36,
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        boxShadow: 'none', // Remove any shadow that makes border look thicker
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'divider',
                            borderWidth: '1px' // Thinner border like navigation buttons
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'divider',
                            borderWidth: '1px'
                        },
                        '&.Mui-focused': {
                            boxShadow: 'none', // Remove focus shadow
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'primary.main',
                                borderWidth: '1px'
                            }
                        },
                        // Reduce inner padding for select text
                        '& .MuiSelect-select': {
                            py: 0.25, // 2px vertical padding
                            px: 0, // 0px horizontal padding (minimal)
                            paddingRight: '12px !important' // Reserve space for dropdown icon (half of 24px)
                        },
                        // Remove icon outline/shadow effects
                        '& .MuiSelect-icon': {
                            color: 'text.secondary'
                        }
                    }
                }}
                labelDisplayedRows={({ from, to, count }) => {
                    if (count !== -1) {
                        return t('pagination.displayedRows', { from, to, count })
                    }
                    // When total count is unknown, show "more than X"
                    return `${from}–${to} ${t('pagination.moreThan')} ${to}`
                }}
                disabled={isLoading}
                showFirstButton
                showLastButton
                sx={{
                    // Hide "Rows per page" label on mobile devices
                    '& .MuiTablePagination-selectLabel': {
                        display: { xs: 'none', sm: 'block' }
                    },
                    // Add explicit margins to Select - override MUI's calc(0 * spacing)
                    '& .MuiTablePagination-select': {
                        marginLeft: { xs: '0 !important', sm: '16px !important' }, // 16px spacing from label
                        marginRight: '16px !important' // 16px spacing before displayedRows
                    },
                    // Normalize spacing for other elements
                    '& .MuiTablePagination-input': {
                        marginRight: 0
                    },
                    '& .MuiTablePagination-selectRoot': {
                        marginRight: 0
                    },
                    '& .MuiTablePagination-displayedRows': {
                        marginLeft: 0
                    }
                }}
            />
        </Box>
    )
}
