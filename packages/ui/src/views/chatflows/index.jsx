import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import LoginDialog from '@/ui-component/dialog/LoginDialog'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { baseURL } from '@/store/constant'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

// ==============================|| CHATFLOWS ||============================== //

const Chatflows = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation()
    const { unikId } = useParams() // Get Unik ID
    const location = useLocation() // Get location object for access to state
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [images, setImages] = useState({})
    const [search, setSearch] = useState('')
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [loginDialogProps, setLoginDialogProps] = useState({})

    const getAllChatflowsApi = useApi(() => chatflowsApi.getAllChatflows(unikId))
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterFlows(data) {
        return (
            data.name.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
            (data.category && data.category.toLowerCase().indexOf(search.toLowerCase()) > -1) ||
            data.id.toLowerCase().indexOf(search.toLowerCase()) > -1
        )
    }

    const onLoginClick = (username, password) => {
        localStorage.setItem('username', username)
        localStorage.setItem('password', password)
        navigate(0)
    }

    const addNew = () => {
        localStorage.setItem('parentUnikId', unikId)
        navigate(`/uniks/${unikId}/chatflows/new`)
    }

    const goToCanvas = (selectedChatflow) => {
        navigate(`/uniks/${unikId}/chatflows/${selectedChatflow.id}`)
    }

    useEffect(() => {
        // Check if location.state has templateFlowData - redirect to the new chatflow page
        if (location.state && location.state.templateFlowData) {
            navigate(`/uniks/${unikId}/chatflows/new`, { state: { templateFlowData: location.state.templateFlowData } })
            return
        }
        
        if (unikId) {
            getAllChatflowsApi.request()
        } else {
            console.error('Unik ID is missing in URL')
        }
    }, [unikId, location.state, navigate])

    useEffect(() => {
        if (getAllChatflowsApi.error) {
            if (getAllChatflowsApi.error?.response?.status === 401) {
                setLoginDialogProps({
                    title: t('common.login'),
                    confirmButtonName: t('common.login')
                })
                setLoginDialogOpen(true)
            } else {
                setError(getAllChatflowsApi.error)
            }
        }
    }, [getAllChatflowsApi.error, t])

    useEffect(() => {
        setLoading(getAllChatflowsApi.loading)
    }, [getAllChatflowsApi.loading])

    useEffect(() => {
        if (getAllChatflowsApi.data) {
            try {
                const chatflows = getAllChatflowsApi.data
                const images = {}
                for (let i = 0; i < chatflows.length; i += 1) {
                    const flowDataStr = chatflows[i].flowData
                    const flowData = JSON.parse(flowDataStr)
                    const nodes = flowData.nodes || []
                    images[chatflows[i].id] = []
                    for (let j = 0; j < nodes.length; j += 1) {
                        const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                        if (!images[chatflows[i].id].includes(imageSrc)) {
                            images[chatflows[i].id].push(imageSrc)
                        }
                    }
                }
                setImages(images)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllChatflowsApi.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader onSearchChange={onSearchChange} search={true} searchPlaceholder={t('chatflows.searchPlaceholder')} title={t('chatflows.title')}>
                        <ToggleButtonGroup
                            sx={{ borderRadius: 2, maxHeight: 40 }}
                            value={view}
                            color='primary'
                            exclusive
                            onChange={handleChange}
                        >
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='card'
                                title={t('common.cardView')}
                            >
                                <IconLayoutGrid />
                            </ToggleButton>
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='list'
                                title={t('common.listView')}
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledButton variant='contained' onClick={addNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40 }}>
                            {t('common.addNew')}
                        </StyledButton>
                    </ViewHeader>
                    {!view || view === 'card' ? (
                        <>
                            {isLoading && !getAllChatflowsApi.data ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                </Box>
                            ) : (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {getAllChatflowsApi.data?.filter(filterFlows).map((data, index) => (
                                        <ItemCard key={index} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            data={getAllChatflowsApi.data}
                            images={images}
                            isLoading={isLoading}
                            filterFunction={filterFlows}
                            updateFlowsApi={getAllChatflowsApi}
                            setError={setError}
                        />
                    )}
                    {!isLoading && (!getAllChatflowsApi.data || getAllChatflowsApi.data.length === 0) && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                    src={WorkflowEmptySVG}
                                    alt='WorkflowEmptySVG'
                                />
                            </Box>
                            <div>No Chatflows Yet</div>
                        </Stack>
                    )}
                </Stack>
            )}

            {loginDialogOpen && (
                <LoginDialog
                    show={loginDialogOpen}
                    dialogProps={loginDialogProps}
                    onConfirm={onLoginClick}
                    onCancel={() => setLoginDialogOpen(false)}
                />
            )}
            <ConfirmDialog />
        </MainCard>
    )
}

export default Chatflows
