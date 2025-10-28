import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports - from template-mui
import { MainCard, ItemCard, FlowListTable, gridSpacing, ConfirmDialog, BaseEntityMenu, StyledButton } from '@flowise/template-mui'
import APIEmptySVG from '@flowise/template-mui/assets/images/api_empty.svg'
import useConfirm from '@flowise/template-mui/hooks/useConfirm'

// project imports - from flowise-ui
import { unikActions } from './unik/unikActions'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@flowise/store'
import { useDispatch } from 'react-redux'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'

// Use existing API helper
import api from '@ui/api'

// Create local API module for uniks using base axios instance
const uniksApi = {
    getAllUniks: () => api.get('/uniks'),
    createUnik: (data) => api.post('/uniks', data),
    updateUnik: (id, data) => api.put(`/unik/${id}`, data)
}

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'
import { useAuthError } from '@universo/auth-frt'

// Additional: import UnikDialog modal for creating/editing Unik
import UnikDialog from './UnikDialog'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

const UnikList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation('uniks')

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [uniks, setUniks] = useState([])

    const [search, setSearch] = useState('')

    // State for modal window for creating/editing Unik
    const [unikDialogOpen, setUnikDialogOpen] = useState(false)
    const [unikDialogProps, setUnikDialogProps] = useState({})

    const getAllUniks = useApi(uniksApi.getAllUniks)
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')
    const { handleAuthError } = useAuthError()

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    // Filter for searching by name and ID
    function filterUniks(data) {
        return data.name.toLowerCase().includes(search.toLowerCase()) || (data.id && data.id.toLowerCase().includes(search.toLowerCase()))
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
        navigate(`/unik/${unik.id}`)
    }

    useEffect(() => {
        getAllUniks.request()
    }, [])

    useEffect(() => {
        if (getAllUniks.error) {
            if (!handleAuthError(getAllUniks.error)) {
                setError(getAllUniks.error)
            }
        }
    }, [getAllUniks.error, handleAuthError])

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

    const cardGridSx = useMemo(
        () => ({
            display: 'grid',
            gap: gridSpacing,
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
            justifyContent: 'flex-start',
            alignContent: 'flex-start'
        }),
        []
    )

    const dispatch = useDispatch()
    const { confirm } = useConfirm()

    // Provide minimal API adapters for unik actions (matching canvas context shape).
    const createUnikContext = (base) => ({
        ...base,
        api: {
            updateEntity: async (id, patch) => {
                await uniksApi.updateUnik(id, patch)
            },
            deleteEntity: async (id) => {
                // Suppose backend supports DELETE /unik/:id
                await api.delete(`/unik/${id}`)
            }
        },
        helpers: {
            enqueueSnackbar: (payload) => dispatch(enqueueSnackbarAction(payload)),
            closeSnackbar: (key) => dispatch(closeSnackbarAction(key)),
            confirm,
            openWindow: (url) => window.open(url, '_blank'),
            refreshList: async () => {
                await getAllUniks.request()
            }
        },
        runtime: { isDarkMode: theme?.customization?.isDarkMode }
    })

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
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
                                <Box sx={cardGridSx}>
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                </Box>
                            ) : (
                                <Box sx={cardGridSx}>
                                    {uniks.filter(filterUniks).map((unik) => (
                                        <ItemCard key={unik.id} onClick={() => goToUnik(unik)} data={unik} images={images[unik.id]} />
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
                            i18nNamespace='uniks'
                            // Custom render override for actions cell for unik rows.
                            renderActions={(row) => (
                                <BaseEntityMenu
                                    entity={row}
                                    entityKind='unik'
                                    descriptors={unikActions}
                                    createContext={createUnikContext}
                                    namespace='flowList'
                                />
                            )}
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
