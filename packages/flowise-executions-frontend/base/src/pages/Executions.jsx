import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

// material-ui
import {
    Box,
    Stack,
    TextField,
    MenuItem,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    IconButton,
    Tooltip,
    useTheme
} from '@mui/material'

// project imports
import MainCard from '@flowise/template-mui/ui-components/cards/MainCard'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'

// API
import useApi from '@flowise/template-mui/hooks/useApi'
import { api } from '@universo/api-client'
import { useSelector } from 'react-redux'

// icons
import execution_empty from '@flowise/template-mui/assets/images/workflow_empty.svg'
import { IconTrash } from '@tabler/icons-react'

// Local components
import { ExecutionDetails } from './ExecutionDetails'
import { ExecutionsListTable } from '../components/ExecutionsListTable'
import Available from '../components/Available'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '../components/TablePagination'
import { omit } from 'lodash'

// ==============================|| AGENT EXECUTIONS ||============================== //

const AgentExecutions = () => {
    const { t } = useTranslation('executions')
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const borderColor = theme.palette.grey[900] + 25
    const { unikId, spaceId, canvasId } = useParams()
    const isCanvasScoped = Boolean(spaceId && canvasId)

    const getAllExecutions = useApi((params) =>
        isCanvasScoped ? api.executions.getExecutions(unikId, spaceId, canvasId, params) : api.executions.getUnikExecutions(unikId, params)
    )
    const deleteExecutionsApi = useApi((executionIds) =>
        isCanvasScoped
            ? api.executions.deleteExecutions(unikId, spaceId, canvasId, { executionIds })
            : api.executions.deleteUnikExecutions(unikId, { executionIds })
    )
    const getExecutionByIdApi = useApi((executionId) =>
        isCanvasScoped
            ? api.executions.getExecutionById(unikId, spaceId, canvasId, executionId)
            : api.executions.getUnikExecutionById(unikId, executionId)
    )

    const [error, setError] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [executions, setExecutions] = useState([])
    const [openDrawer, setOpenDrawer] = useState(false)
    const [selectedExecutionData, setSelectedExecutionData] = useState([])
    const [selectedMetadata, setSelectedMetadata] = useState({})
    const [selectedExecutionIds, setSelectedExecutionIds] = useState([])
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false)
    const [filters, setFilters] = useState({
        state: '',
        startDate: null,
        endDate: null,
        agentflowId: '',
        agentflowName: '',
        sessionId: ''
    })

    const handleFilterChange = (field, value) => {
        setFilters({
            ...filters,
            [field]: value
        })
    }

    const onDateChange = (field, date) => {
        const updatedDate = new Date(date)
        updatedDate.setHours(0, 0, 0, 0)

        setFilters({
            ...filters,
            [field]: updatedDate
        })
    }

    /* Table Pagination */
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)
    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
        applyFilters(page, pageLimit)
    }

    const applyFilters = (page, limit) => {
        setLoading(true)
        // Ensure page and limit are numbers, not objects
        const pageNum = typeof page === 'number' ? page : currentPage
        const limitNum = typeof limit === 'number' ? limit : pageLimit

        const params = {
            page: pageNum,
            limit: limitNum
        }

        if (filters.state) params.state = filters.state

        // Create date strings that preserve the exact date values
        if (filters.startDate) {
            const date = new Date(filters.startDate)
            // Format date as YYYY-MM-DD and set to start of day in UTC
            // This ensures the server sees the same date we've selected regardless of timezone
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            params.startDate = `${year}-${month}-${day}T00:00:00.000Z`
        }

        if (filters.endDate) {
            const date = new Date(filters.endDate)
            // Format date as YYYY-MM-DD and set to end of day in UTC
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            params.endDate = `${year}-${month}-${day}T23:59:59.999Z`
        }

        if (filters.agentflowId) params.agentflowId = filters.agentflowId
        if (filters.agentflowName) params.agentflowName = filters.agentflowName
        if (filters.sessionId) params.sessionId = filters.sessionId

        getAllExecutions.request(params)
    }

    const resetFilters = () => {
        setFilters({
            state: '',
            startDate: null,
            endDate: null,
            agentflowId: '',
            agentflowName: '',
            sessionId: ''
        })
        setCurrentPage(1)
        getAllExecutions.request({ page: 1, limit: pageLimit })
    }

    const handleExecutionSelectionChange = (selectedIds) => {
        setSelectedExecutionIds(selectedIds)
    }

    const handleDeleteDialogOpen = () => {
        if (selectedExecutionIds.length > 0) {
            setOpenDeleteDialog(true)
        }
    }

    const handleDeleteDialogClose = () => {
        setOpenDeleteDialog(false)
    }

    const handleDeleteExecutions = () => {
        deleteExecutionsApi.request(selectedExecutionIds)
        setOpenDeleteDialog(false)
    }

    useEffect(() => {
        getAllExecutions.request({ page: 1, limit: DEFAULT_ITEMS_PER_PAGE })

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (getAllExecutions.data) {
            try {
                const { data, total } = getAllExecutions.data
                if (!Array.isArray(data)) return
                setExecutions(data)
                setTotal(total)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllExecutions.data])

    useEffect(() => {
        setLoading(getAllExecutions.loading)
    }, [getAllExecutions.loading])

    useEffect(() => {
        setError(getAllExecutions.error)
    }, [getAllExecutions.error])

    useEffect(() => {
        if (deleteExecutionsApi.data) {
            // Refresh the executions list
            getAllExecutions.request({
                page: currentPage,
                limit: pageLimit
            })
            setSelectedExecutionIds([])
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deleteExecutionsApi.data])

    useEffect(() => {
        if (getExecutionByIdApi.data) {
            const execution = getExecutionByIdApi.data
            const executionDetails =
                typeof execution.executionData === 'string' ? JSON.parse(execution.executionData) : execution.executionData
            setSelectedExecutionData(executionDetails)
            const newMetadata = {
                ...omit(execution, ['executionData']),
                agentflow: {
                    ...selectedMetadata.agentflow
                }
            }
            setSelectedMetadata(newMetadata)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getExecutionByIdApi.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader title={t('executions.title')} description={t('executions.empty.description')} />

                    {/* Filter Section */}
                    <Box sx={{ mb: 2, width: '100%' }}>
                        <Grid container spacing={2} alignItems='center'>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth size='small'>
                                    <InputLabel id='state-select-label'>{t('executions.filters.state')}</InputLabel>
                                    <Select
                                        labelId='state-select-label'
                                        value={filters.state}
                                        label={t('executions.filters.state')}
                                        onChange={(e) => handleFilterChange('state', e.target.value)}
                                        size='small'
                                        sx={{
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: borderColor
                                            },
                                            '& .MuiSvgIcon-root': {
                                                color: customization.isDarkMode ? '#fff' : 'inherit'
                                            }
                                        }}
                                    >
                                        <MenuItem value=''>{t('executions.states.ALL', 'All')}</MenuItem>
                                        <MenuItem value='INPROGRESS'>{t('executions.states.INPROGRESS')}</MenuItem>
                                        <MenuItem value='FINISHED'>{t('executions.states.FINISHED')}</MenuItem>
                                        <MenuItem value='ERROR'>{t('executions.states.ERROR')}</MenuItem>
                                        <MenuItem value='TERMINATED'>{t('executions.states.TERMINATED')}</MenuItem>
                                        <MenuItem value='TIMEOUT'>{t('executions.states.TIMEOUT')}</MenuItem>
                                        <MenuItem value='STOPPED'>{t('executions.states.STOPPED')}</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <DatePicker
                                    selected={filters.startDate}
                                    onChange={(date) => onDateChange('startDate', date)}
                                    selectsStart
                                    startDate={filters.startDate}
                                    className='form-control'
                                    wrapperClassName='datePicker'
                                    maxDate={new Date()}
                                    customInput={
                                        <TextField
                                            size='small'
                                            label={t('executions.filters.startDate')}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: borderColor
                                                }
                                            }}
                                        />
                                    }
                                />
                            </Grid>
                            <Grid sx={{ ml: -1 }} item xs={12} md={2}>
                                <DatePicker
                                    selected={filters.endDate}
                                    onChange={(date) => onDateChange('endDate', date)}
                                    selectsEnd
                                    endDate={filters.endDate}
                                    className='form-control'
                                    wrapperClassName='datePicker'
                                    minDate={filters.startDate}
                                    maxDate={new Date()}
                                    customInput={
                                        <TextField
                                            size='small'
                                            label={t('executions.filters.endDate')}
                                            fullWidth
                                            sx={{
                                                '& .MuiOutlinedInput-notchedOutline': {
                                                    borderColor: borderColor
                                                }
                                            }}
                                        />
                                    }
                                />
                            </Grid>
                            <Grid sx={{ ml: -1 }} item xs={12} md={2}>
                                <TextField
                                    fullWidth
                                    label={t('executions.filters.canvas')}
                                    value={filters.agentflowName}
                                    onChange={(e) => handleFilterChange('agentflowName', e.target.value)}
                                    size='small'
                                    sx={{
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: borderColor
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid sx={{ ml: -1 }} item xs={12} md={2}>
                                <TextField
                                    fullWidth
                                    label={t('executions.filters.session')}
                                    value={filters.sessionId}
                                    onChange={(e) => handleFilterChange('sessionId', e.target.value)}
                                    size='small'
                                    sx={{
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: borderColor
                                        }
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <Stack direction='row' spacing={1}>
                                    <Button
                                        variant='contained'
                                        color='primary'
                                        onClick={() => applyFilters(currentPage, pageLimit)}
                                        size='small'
                                    >
                                        {t('executions.filters.apply')}
                                    </Button>
                                    <Button variant='outlined' onClick={resetFilters} size='small'>
                                        {t('executions.filters.clear')}
                                    </Button>
                                    <Available permissions={['executions:delete']}>
                                        <Tooltip title={t('executions.actions.deleteSelected')}>
                                            <span>
                                                <IconButton
                                                    sx={{ height: 30, width: 30 }}
                                                    size='small'
                                                    color='error'
                                                    onClick={handleDeleteDialogOpen}
                                                    edge='end'
                                                    disabled={selectedExecutionIds.length === 0}
                                                >
                                                    <IconTrash />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Available>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Box>

                    {executions?.length > 0 && (
                        <>
                            <ExecutionsListTable
                                data={executions}
                                isLoading={isLoading}
                                onSelectionChange={handleExecutionSelectionChange}
                                onExecutionRowClick={(execution) => {
                                    setOpenDrawer(true)
                                    const executionDetails =
                                        typeof execution.executionData === 'string'
                                            ? JSON.parse(execution.executionData)
                                            : execution.executionData
                                    setSelectedExecutionData(executionDetails)
                                    setSelectedMetadata(omit(execution, ['executionData']))
                                }}
                            />

                            {/* Pagination and Page Size Controls */}
                            {!isLoading && total > 0 && (
                                <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                            )}

                            <ExecutionDetails
                                open={openDrawer}
                                execution={selectedExecutionData}
                                metadata={selectedMetadata}
                                onClose={() => setOpenDrawer(false)}
                                onProceedSuccess={() => {
                                    setOpenDrawer(false)
                                    getAllExecutions.request()
                                }}
                                onUpdateSharing={() => {
                                    getAllExecutions.request()
                                }}
                                onRefresh={(executionId) => {
                                    getAllExecutions.request()
                                    getExecutionByIdApi.request(executionId)
                                }}
                            />
                        </>
                    )}

                    {/* Delete Confirmation Dialog */}
                    <Dialog
                        open={openDeleteDialog}
                        onClose={handleDeleteDialogClose}
                        aria-labelledby='alert-dialog-title'
                        aria-describedby='alert-dialog-description'
                    >
                        <DialogTitle id='alert-dialog-title'>{t('executions.delete.title', 'Confirm Deletion')}</DialogTitle>
                        <DialogContent>
                            <DialogContentText id='alert-dialog-description'>
                                {t('executions.delete.confirm', { count: selectedExecutionIds.length })}
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleDeleteDialogClose} color='primary'>
                                {t('executions.delete.cancel', 'Cancel')}
                            </Button>
                            <Button onClick={handleDeleteExecutions} color='error'>
                                {t('executions.actions.delete')}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {!isLoading && (!executions || executions.length === 0) && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                    src={execution_empty}
                                    alt='execution_empty'
                                />
                            </Box>
                            <div>{t('executions.empty.title')}</div>
                        </Stack>
                    )}
                </Stack>
            )}
        </MainCard>
    )
}

export default AgentExecutions
