import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '../../../../../packages/ui/src/ui-component/cards/MainCard'
import { ItemCard, FlowListTable } from '@universo/template-mui'
import { gridSpacing } from '../../../../../packages/ui/src/store/constant'
import APIEmptySVG from '../../../../../packages/ui/src/assets/images/api_empty.svg'
import ConfirmDialog from '../../../../../packages/ui/src/ui-component/dialog/ConfirmDialog'
import BaseEntityMenu from '../../../../../packages/ui/src/ui-component/menu/BaseEntityMenu'
import { unikActions } from './unik/unikActions'
import useConfirm from '../../../../../packages/ui/src/hooks/useConfirm'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '../../../../../packages/ui/src/store/actions'
import { useDispatch } from 'react-redux'
import { StyledButton } from '../../../../../packages/ui/src/ui-component/button/StyledButton'
import ViewHeader from '../../../../../packages/ui/src/layout/MainLayout/ViewHeader'
import ErrorBoundary from '../../../../../packages/ui/src/ErrorBoundary'

// Use existing API helper
import api from '../../../../../packages/ui/src/api'

// Create local API module for uniks using base axios instance
const uniksApi = {
    getAllUniks: () => api.get('/uniks'),
    createUnik: (data) => api.post('/uniks', data),
    updateUnik: (id, data) => api.put(`/unik/${id}`, data)
}

// Hooks
import useApi from '../../../../../packages/ui/src/hooks/useApi'
import { useAuthError } from '../../../../../packages/ui/src/hooks/useAuthError'

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
    const [spacesCounts, setSpacesCounts] = useState({})
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

    useEffect(() => {
        if (!Array.isArray(uniks) || uniks.length === 0) {
            setSpacesCounts({})
            return
        }

        let cancelled = false

        const loadCounts = async () => {
            const results = await Promise.allSettled(
                uniks.map(async (unik) => {
                    const response = await api.get(`/unik/${unik.id}/spaces`)
                    const payload = response?.data

                    const spacesArray = Array.isArray(payload?.data?.spaces)
                        ? payload.data.spaces
                        : Array.isArray(payload?.spaces)
                          ? payload.spaces
                          : Array.isArray(payload?.data)
                              ? payload.data
                              : Array.isArray(payload)
                                  ? payload
                                  : []

                    const count = Array.isArray(spacesArray) ? spacesArray.length : 0
                    return { id: unik.id, count }
                })
            )

            if (cancelled) return

            const next = {}
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    next[result.value.id] = result.value.count
                }
            })
            setSpacesCounts(next)
        }

        loadCounts().catch((err) => {
            if (!cancelled) {
                console.error('Failed to load spaces count for uniks', err)
            }
        })

        return () => {
            cancelled = true
        }
    }, [uniks])

    // For uniks we don't need to calculate images – pass empty array for each unik
    const images = {}
    uniks.forEach((unik) => {
        images[unik.id] = []
    })

    const uniksWithCounts = useMemo(
        () =>
            uniks.map((unik) => {
                const spacesCount = spacesCounts[unik.id] ?? 0
                const updatedDate =
                    unik.updatedDate ??
                    unik.updated_at ??
                    unik.updatedAt ??
                    unik.created_at ??
                    unik.createdAt ??
                    null

                return {
                    ...unik,
                    spacesCount,
                    updatedDate
                }
            }),
        [uniks, spacesCounts]
    )

    const gridRef = useRef(null)
    const [gridConfig, setGridConfig] = useState({ columns: 1, stretch: false })
    const CARD_MIN_WIDTH = 220
    const CARD_MAX_WIDTH = 360

    useEffect(() => {
        const node = gridRef.current
        if (!node) return

        const gapPxRaw = parseFloat(theme.spacing(gridSpacing))
        const gapPx = Number.isNaN(gapPxRaw) ? 0 : gapPxRaw

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return
            const width = entry.contentRect?.width || node.clientWidth || 0
            if (!width) return
            const totalCards = uniksWithCounts.length || 1
            let bestColumns = 1
            let bestLeftover = Number.POSITIVE_INFINITY

            const maxCandidates = Math.min(totalCards, 12)

            for (let candidate = 1; candidate <= maxCandidates; candidate += 1) {
                const trackWidth = (width - gapPx * (candidate - 1)) / candidate
                if (trackWidth < CARD_MIN_WIDTH) {
                    continue
                }

                const clampedWidth = Math.min(trackWidth, CARD_MAX_WIDTH)
                const leftover = width - candidate * clampedWidth - gapPx * (candidate - 1)
                const error = Math.abs(leftover)

                if (error < bestLeftover - 0.5 || (Math.abs(error - bestLeftover) <= 0.5 && candidate > bestColumns)) {
                    bestColumns = candidate
                    bestLeftover = error
                }
            }

            bestColumns = Math.max(1, Math.min(bestColumns, totalCards))
            const stretch = totalCards > bestColumns && bestColumns > 1
            setGridConfig({ columns: bestColumns, stretch })
        })

        observer.observe(node)

        return () => {
            observer.disconnect()
        }
    }, [theme, uniksWithCounts.length])

    const cardGridSx = useMemo(
        () => ({
            display: 'grid',
            gap: gridSpacing,
            justifyContent: 'flex-start',
            justifyItems: 'stretch',
            alignContent: 'flex-start',
            gridTemplateColumns: `repeat(${gridConfig.columns}, minmax(${CARD_MIN_WIDTH}px, ${gridConfig.stretch ? '1fr' : `${CARD_MAX_WIDTH}px`}))`
        }),
        [gridConfig.columns, gridConfig.stretch]
    )

    const dispatch = useDispatch()
    const { confirm } = useConfirm()

    // Provide minimal API adapters for unik actions (same shape as chatflow context expects).
    const createUnikContext = (base) => ({
        ...base,
        api: {
            updateEntity: async (id, patch) => {
                try {
                    await uniksApi.updateUnik(id, patch)
                } catch (e) {
                    throw e
                }
            },
            deleteEntity: async (id) => {
                // Suppose backend supports DELETE /unik/:id
                try {
                    await api.delete(`/unik/${id}`)
                } catch (e) {
                    throw e
                }
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
                                <Box ref={gridRef} sx={cardGridSx}>
                                    {uniksWithCounts.filter(filterUniks).map((unik) => (
                                        <ItemCard
                                            key={unik.id}
                                            onClick={() => goToUnik(unik)}
                                            data={unik}
                                            images={images[unik.id]}
                                            allowStretch={gridConfig.stretch}
                                        />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            isUnikTable={true}
                            data={uniksWithCounts.filter(filterUniks)}
                            images={images}
                            isLoading={isLoading}
                            filterFunction={filterUniks}
                            updateFlowsApi={getAllUniks}
                            setError={setError}
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
