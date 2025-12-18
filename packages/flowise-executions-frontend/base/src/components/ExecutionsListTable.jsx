import PropTypes from 'prop-types'
import { DataGrid } from '@mui/x-data-grid'
import { Chip, Box } from '@mui/material'
import moment from 'moment'

const getStateColor = (state) => {
    switch (state) {
        case 'FINISHED':
            return 'success'
        case 'ERROR':
        case 'TIMEOUT':
            return 'error'
        case 'TERMINATED':
        case 'STOPPED':
            return 'error'
        case 'INPROGRESS':
            return 'warning'
        default:
            return 'default'
    }
}

export const ExecutionsListTable = ({ data, isLoading, onSelectionChange, onExecutionRowClick }) => {
    const columns = [
        {
            field: 'sessionId',
            headerName: 'Session ID',
            flex: 1,
            minWidth: 200
        },
        {
            field: 'state',
            headerName: 'State',
            width: 130,
            renderCell: (params) => <Chip label={params.value} color={getStateColor(params.value)} size='small' />
        },
        {
            field: 'createdDate',
            headerName: 'Created',
            width: 180,
            valueFormatter: (value) => moment(value).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            field: 'updatedDate',
            headerName: 'Updated',
            width: 180,
            valueFormatter: (value) => moment(value).format('YYYY-MM-DD HH:mm:ss')
        }
    ]

    return (
        <Box sx={{ height: 500, width: '100%' }}>
            <DataGrid
                rows={data || []}
                columns={columns}
                loading={isLoading}
                checkboxSelection
                disableRowSelectionOnClick
                onRowSelectionModelChange={(newSelection) => {
                    onSelectionChange && onSelectionChange(newSelection)
                }}
                onRowClick={(params) => {
                    onExecutionRowClick && onExecutionRowClick(params.row)
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                sx={{
                    '& .MuiDataGrid-row': {
                        cursor: 'pointer'
                    }
                }}
            />
        </Box>
    )
}

ExecutionsListTable.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool,
    onSelectionChange: PropTypes.func,
    onExecutionRowClick: PropTypes.func
}
