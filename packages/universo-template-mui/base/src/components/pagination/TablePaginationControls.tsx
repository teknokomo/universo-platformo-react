import { TablePagination, Box } from '@mui/material'
import { useTranslation } from 'react-i18next'
import i18n from '@universo/i18n'
import type { PaginationState, PaginationActions } from '../../types/pagination'

export interface TablePaginationControlsProps {
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
 * Table pagination controls using MUI TablePagination
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
 * <TablePaginationControls
 *   pagination={pagination}
 *   actions={actions}
 *   isLoading={isLoading}
 *   rowsPerPageOptions={[10, 20, 50, 100]}
 *   namespace='common'
 * />
 * ```
 */
export const TablePaginationControls = ({
    pagination,
    actions,
    isLoading = false,
    rowsPerPageOptions = [10, 20, 50, 100],
    namespace = 'common'
}: TablePaginationControlsProps) => {
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
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper'
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
            />
        </Box>
    )
}

