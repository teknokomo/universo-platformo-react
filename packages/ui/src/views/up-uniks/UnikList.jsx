import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import APIEmptySVG from '@/assets/images/api_empty.svg'
import LoginDialog from '@/ui-component/dialog/LoginDialog'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// Use existing API helper
import api from '@/api'

// Create local API module for uniks using base axios instance
const uniksApi = {
    getAllUniks: () => api.get('/uniks'),
    createUnik: (data) => api.post('/uniks', data),
    updateUnik: (id, data) => api.put(`/uniks/${id}`, data)
}

// Hooks
import useApi from '@/hooks/useApi'

// Additional: import UnikDialog modal for creating/editing Unik
import UnikDialog from '@/views/up-uniks/UnikDialog'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

const UnikList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation()

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [uniks, setUniks] = useState([])
    const [search, setSearch] = useState('')
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [loginDialogProps, setLoginDialogProps] = useState({})

    // Состояние для модального окна создания/редактирования Unik
    const [unikDialogOpen, setUnikDialogOpen] = useState(false)
    const [unikDialogProps, setUnikDialogProps] = useState({})

    const getAllUniks = useApi(uniksApi.getAllUniks)
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    // Фильтр для поиска по имени и ID
    function filterUniks(data) {
        return data.name.toLowerCase().includes(search.toLowerCase()) || (data.id && data.id.toLowerCase().includes(search.toLowerCase()))
    }

    const onLoginClick = (username, password) => {
        localStorage.setItem('username', username)
        localStorage.setItem('password', password)
        navigate(0)
    }

    // Open modal for adding new Unik
    const openAddUnikDialog = () => {
        setUnikDialogProps({
            title: t('unikList.addNewUnik'),
            confirmButtonName: t('unikList.addUnik'),
            type: 'ADD'
        })
        setUnikDialogOpen(true)
    }

    // Callback after successful creation of Unik through dialog
    const handleDialogConfirm = (newUnik) => {
        setUniks((prev) => [...prev, newUnik])
        setUnikDialogOpen(false)
    }

    const handleDialogCancel = () => {
        setUnikDialogOpen(false)
    }

    const goToUnik = (unik) => {
        navigate(`/uniks/${unik.id}`)
    }

    useEffect(() => {
        getAllUniks.request()
    }, [])

    useEffect(() => {
        if (getAllUniks.error) {
            if (getAllUniks.error?.response?.status === 401) {
                setLoginDialogProps({
                    title: 'Login',
                    confirmButtonName: 'Login'
                })
                setLoginDialogOpen(true)
            } else {
                setError(getAllUniks.error)
            }
        }
    }, [getAllUniks.error])

    useEffect(() => {
        setLoading(getAllUniks.loading)
    }, [getAllUniks.loading])

    useEffect(() => {
        if (getAllUniks.data) {
            setUniks(getAllUniks.data)
        }
    }, [getAllUniks.data])

    // For uniks we don't need to calculate images – pass empty array for each unik
    const images = {}
    uniks.forEach((unik) => {
        images[unik.id] = []
    })

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder={t('unikList.searchPlaceholder')}
                        title={t('unikList.title')}
                    >
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
                                title={t('unikList.cardView')}
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
                                title={t('unikList.listView')}
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledButton
                            variant='contained'
                            onClick={openAddUnikDialog}
                            startIcon={<IconPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            {t('unikList.addUnik')}
                        </StyledButton>
                    </ViewHeader>
                    {!view || view === 'card' ? (
                        <>
                            {isLoading && uniks.length === 0 ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                </Box>
                            ) : (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {uniks.filter(filterUniks).map((unik, index) => (
                                        <ItemCard key={index} onClick={() => goToUnik(unik)} data={unik} images={images[unik.id]} />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            isUnikTable={true}
                            data={uniks.filter(filterUniks)}
                            images={images}
                            isLoading={isLoading}
                            filterFunction={filterUniks}
                            updateFlowsApi={getAllUniks}
                            setError={setError}
                        />
                    )}
                    {!isLoading && uniks.length === 0 && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img style={{ objectFit: 'cover', height: '25vh', width: 'auto' }} src={APIEmptySVG} alt='No Uniks' />
                            </Box>
                            <div>{t('unikList.noUniksFound')}</div>
                        </Stack>
                    )}
                </Stack>
            )}

            <LoginDialog show={loginDialogOpen} dialogProps={loginDialogProps} onConfirm={onLoginClick} />
            <ConfirmDialog />
            <UnikDialog
                show={unikDialogOpen}
                dialogProps={unikDialogProps}
                onCancel={handleDialogCancel}
                onConfirm={handleDialogConfirm}
                setError={setError}
            />
        </MainCard>
    )
}

export default UnikList
