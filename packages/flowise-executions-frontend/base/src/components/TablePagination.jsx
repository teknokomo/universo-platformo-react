import PropTypes from 'prop-types'
import { Box, TablePagination as MuiTablePagination } from '@mui/material'

export const DEFAULT_ITEMS_PER_PAGE = 10

const TablePagination = ({ currentPage, limit, total, onChange }) => {
    const page = Math.max(0, (currentPage || 1) - 1)
    const rowsPerPage = limit || DEFAULT_ITEMS_PER_PAGE

    return (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <MuiTablePagination
                component='div'
                count={total || 0}
                page={page}
                onPageChange={(_, newPage) => {
                    onChange && onChange(newPage + 1, rowsPerPage)
                }}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(event) => {
                    const nextLimit = Number(event.target.value) || DEFAULT_ITEMS_PER_PAGE
                    onChange && onChange(1, nextLimit)
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
            />
        </Box>
    )
}

TablePagination.propTypes = {
    currentPage: PropTypes.number,
    limit: PropTypes.number,
    total: PropTypes.number,
    onChange: PropTypes.func
}

export default TablePagination
