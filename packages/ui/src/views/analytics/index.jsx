// Universo Platformo | Analytics page for quiz lead data
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import moment from 'moment'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { styled } from '@mui/material/styles'
import { tableCellClasses } from '@mui/material/TableCell'
import {
    Button,
    Box,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Card,
    CardContent,
    Grid,
    useTheme,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert
} from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// API
import leadsApi from '@/api/lead'
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// utils
import useNotifier from '@/utils/useNotifier'

// Icons
import { IconChartBar, IconUsers, IconTrophy, IconCalendar } from '@tabler/icons-react'
import AnalyticsEmptySVG from '@/assets/images/leads_empty.svg'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,
    padding: '6px 16px',

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

// ==============================|| Analytics ||============================== //

const Analytics = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    const dispatch = useDispatch()
    const { unikId } = useParams()
    const { t } = useTranslation()
    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [leads, setLeads] = useState([])
    const [analytics, setAnalytics] = useState({
        totalLeads: 0,
        averagePoints: 0,
        maxPoints: 0,
        totalPoints: 0
    })

    // Universo Platformo | Chatflow selection state
    const [chatflows, setChatflows] = useState([])
    const [selectedChatflowId, setSelectedChatflowId] = useState('')
    const [chatflowsLoading, setChatflowsLoading] = useState(true)

    const getAllLeadsApi = useApi(() => leadsApi.getAllLeads(selectedChatflowId))
    const getAllChatflowsApi = useApi(() => chatflowsApi.getAllChatflows(unikId))

    const [search, setSearch] = useState('')
    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterLeads(data) {
        return data.name?.toLowerCase().indexOf(search.toLowerCase()) > -1 || data.email?.toLowerCase().indexOf(search.toLowerCase()) > -1
    }

    // Universo Platformo | Calculate analytics from leads data
    const calculateAnalytics = (leadsData) => {
        if (!leadsData || leadsData.length === 0) {
            return {
                totalLeads: 0,
                averagePoints: 0,
                maxPoints: 0,
                totalPoints: 0
            }
        }

        const validLeads = leadsData.filter((lead) => lead.phone && !isNaN(parseInt(lead.phone)))
        const points = validLeads.map((lead) => parseInt(lead.phone) || 0)

        return {
            totalLeads: leadsData.length,
            averagePoints: points.length > 0 ? Math.round((points.reduce((a, b) => a + b, 0) / points.length) * 100) / 100 : 0,
            maxPoints: points.length > 0 ? Math.max(...points) : 0,
            totalPoints: points.reduce((a, b) => a + b, 0)
        }
    }

    // Universo Platformo | Handle chatflow selection
    const handleChatflowChange = (event) => {
        const chatflowId = event.target.value
        setSelectedChatflowId(chatflowId)
        setLoading(true)
        setLeads([])
        setAnalytics({
            totalLeads: 0,
            averagePoints: 0,
            maxPoints: 0,
            totalPoints: 0
        })
    }

    const onConfirm = () => {
        if (selectedChatflowId) {
            getAllLeadsApi.request()
        }
    }

    const onCancel = () => {
        setLoading(false)
    }

    // Load chatflows on component mount
    useEffect(() => {
        getAllChatflowsApi.request()
    }, [])

    // Load leads when chatflow is selected
    useEffect(() => {
        if (selectedChatflowId) {
            getAllLeadsApi.request()
        }
    }, [selectedChatflowId])

    useEffect(() => {
        if (getAllLeadsApi.data) {
            try {
                const leadsData = getAllLeadsApi.data
                setLeads(leadsData)
                setAnalytics(calculateAnalytics(leadsData))
                setLoading(false)
            } catch (error) {
                console.error('[Analytics] Error processing leads data:', error)
                setError(error)
                setLoading(false)
            }
        }
    }, [getAllLeadsApi.data])

    useEffect(() => {
        if (getAllLeadsApi.error) {
            console.error('[Analytics] Error loading leads:', getAllLeadsApi.error)
            setError(getAllLeadsApi.error)
            setLoading(false)
        }
    }, [getAllLeadsApi.error])

    // Handle chatflows loading
    useEffect(() => {
        if (getAllChatflowsApi.data) {
            try {
                const chatflowsData = getAllChatflowsApi.data
                setChatflows(chatflowsData)
                setChatflowsLoading(false)

                // Auto-select first chatflow if available
                if (chatflowsData.length > 0 && !selectedChatflowId) {
                    setSelectedChatflowId(chatflowsData[0].id)
                }
            } catch (error) {
                console.error('[Analytics] Error processing chatflows data:', error)
                setChatflowsLoading(false)
            }
        }
    }, [getAllChatflowsApi.data])

    useEffect(() => {
        if (getAllChatflowsApi.error) {
            console.error('[Analytics] Error loading chatflows:', getAllChatflowsApi.error)
            setChatflowsLoading(false)
        }
    }, [getAllChatflowsApi.error])

    return (
        <>
            <MainCard sx={{ p: 2 }}>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={search}
                        searchPlaceholder='Поиск по имени или email...'
                        title='Аналитика квизов'
                    />

                    {/* Universo Platformo | Chatflow Selector */}
                    <Box sx={{ mb: 3 }}>
                        <FormControl fullWidth>
                            <InputLabel id='chatflow-select-label'>Выберите квиз для анализа</InputLabel>
                            <Select
                                labelId='chatflow-select-label'
                                id='chatflow-select'
                                value={selectedChatflowId}
                                label='Выберите квиз для анализа'
                                onChange={handleChatflowChange}
                                disabled={chatflowsLoading}
                            >
                                {chatflows.map((chatflow) => (
                                    <MenuItem key={chatflow.id} value={chatflow.id}>
                                        {chatflow.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {chatflows.length === 0 && !chatflowsLoading && (
                            <Alert severity='info' sx={{ mt: 2 }}>
                                Квизы не найдены. Создайте квиз с функцией сбора лидов для просмотра аналитики.
                            </Alert>
                        )}
                    </Box>

                    {/* Universo Platformo | Analytics Cards */}
                    <Grid container spacing={3}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display='flex' alignItems='center' gap={2}>
                                        <IconUsers size={40} color={theme.palette.primary.main} />
                                        <Box>
                                            <Typography variant='h4'>{analytics.totalLeads}</Typography>
                                            <Typography variant='body2' color='textSecondary'>
                                                Всего участников
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display='flex' alignItems='center' gap={2}>
                                        <IconTrophy size={40} color={theme.palette.warning.main} />
                                        <Box>
                                            <Typography variant='h4'>{analytics.averagePoints}</Typography>
                                            <Typography variant='body2' color='textSecondary'>
                                                Средний балл
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display='flex' alignItems='center' gap={2}>
                                        <IconChartBar size={40} color={theme.palette.success.main} />
                                        <Box>
                                            <Typography variant='h4'>{analytics.maxPoints}</Typography>
                                            <Typography variant='body2' color='textSecondary'>
                                                Максимальный балл
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display='flex' alignItems='center' gap={2}>
                                        <IconCalendar size={40} color={theme.palette.info.main} />
                                        <Box>
                                            <Typography variant='h4'>{analytics.totalPoints}</Typography>
                                            <Typography variant='body2' color='textSecondary'>
                                                Общая сумма баллов
                                            </Typography>
                                        </Box>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Universo Platformo | Leads Table */}
                    {!selectedChatflowId ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                    src={AnalyticsEmptySVG}
                                    alt='AnalyticsEmptySVG'
                                />
                            </Box>
                            <Typography variant='h6' color='textSecondary'>
                                Выберите квиз для просмотра аналитики
                            </Typography>
                        </Stack>
                    ) : isLoading ? (
                        <Box display='flex' flexDirection='column' alignItems='center'>
                            <Skeleton variant='text' />
                            <Skeleton variant='text' />
                            <Skeleton variant='text' />
                        </Box>
                    ) : (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            {leads?.length <= 0 ? (
                                <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                    <Box sx={{ p: 2, height: 'auto' }}>
                                        <img
                                            style={{ objectFit: 'cover', height: '20vh', width: 'auto' }}
                                            src={AnalyticsEmptySVG}
                                            alt='AnalyticsEmptySVG'
                                        />
                                    </Box>
                                    <Typography variant='h6' color='textSecondary'>
                                        Данные аналитики отсутствуют для выбранного квиза
                                    </Typography>
                                </Stack>
                            ) : (
                                <TableContainer component={Paper}>
                                    <Table sx={{ minWidth: 650 }} size='small' aria-label='analytics table'>
                                        <TableHead>
                                            <TableRow>
                                                <StyledTableCell>Имя</StyledTableCell>
                                                <StyledTableCell>Email</StyledTableCell>
                                                <StyledTableCell>Баллы</StyledTableCell>
                                                <StyledTableCell>Дата прохождения</StyledTableCell>
                                                <StyledTableCell>Chatflow ID</StyledTableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {leads?.filter(filterLeads)?.map((row, index) => (
                                                <StyledTableRow key={index}>
                                                    <StyledTableCell>
                                                        <Typography variant='body1'>{row.name || 'Не указано'}</Typography>
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Typography variant='body1'>{row.email || 'Не указано'}</Typography>
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Typography
                                                            variant='body1'
                                                            sx={{
                                                                fontWeight: 'bold',
                                                                color: theme.palette.primary.main
                                                            }}
                                                        >
                                                            {row.phone && !isNaN(parseInt(row.phone)) ? row.phone : '0'}
                                                        </Typography>
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Typography variant='body2'>
                                                            {moment(row.createdDate).format('DD.MM.YYYY HH:mm')}
                                                        </Typography>
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Typography variant='body2' sx={{ fontFamily: 'monospace' }}>
                                                            {row.chatflowid?.substring(0, 8)}...
                                                        </Typography>
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </Stack>
                    )}
                </Stack>
            </MainCard>
        </>
    )
}

export default Analytics
