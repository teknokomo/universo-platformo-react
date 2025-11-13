import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@flowise/template-mui/ui-components/cards/MainCard'
import ItemCard from '@flowise/template-mui/ui-components/cards/ItemCard'
import { gridSpacing } from '@flowise/template-mui'
import AgentsEmptySVG from '../../assets/images/agents_empty.svg'
import ConfirmDialog from '@flowise/template-mui/ui-components/dialog/ConfirmDialog'
import { FlowListTable } from '@flowise/template-mui/ui-components/table/FlowListTable'
import { StyledButton } from '@flowise/template-mui/ui-components/button/StyledButton'
import ViewHeader from '../../layout/MainLayout/ViewHeader'
import ErrorBoundary from '../../ErrorBoundary'

// API
import { api } from '@universo/api-client' // Replaced: import canvasesApi from '../../api/canvases'
// import spacesApi from '../../api/spaces' // Replaced with shared api import

// Hooks
import useApi from '../../hooks/useApi'
import { useAuthError } from '@universo/auth-frt'

// const
import { baseURL } from '@flowise/template-mui'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

const extractSpaces = (payload) => {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data?.spaces)) return payload.data.spaces
    if (Array.isArray(payload?.spaces)) return payload.spaces
    if (Array.isArray(payload?.data)) return payload.data
    return []
}

const extractCanvases = (payload) => {
    if (!payload) return []
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.canvases)) return payload.canvases
    if (Array.isArray(payload?.data?.canvases)) return payload.data.canvases
    if (Array.isArray(payload?.data)) return payload.data
    return []
}

const buildImageMap = (items) => {
    const images = {}
    items.forEach((canvas) => {
        if (!canvas?.id) return
        images[canvas.id] = []
        if (!canvas.flowData) return
        try {
            const flowData = typeof canvas.flowData === 'string' ? JSON.parse(canvas.flowData) : canvas.flowData
            const nodes = flowData?.nodes || []
            nodes.forEach((node) => {
                const imageSrc = `${baseURL}/api/v1/node-icon/${node?.data?.name}`
                if (imageSrc && !images[canvas.id].includes(imageSrc)) {
                    images[canvas.id].push(imageSrc)
                }
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[Agentflows] Failed to parse flowData for canvas preview', { canvasId: canvas.id, error })
        }
    })
    return images
}

// ==============================|| MULTI-AGENT CANVASES LIST ||============================== //

const Agentflows = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation('chatbot')
    const { unikId } = useParams()
    const location = useLocation()

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [images, setImages] = useState({})
    const [search, setSearch] = useState('')
    const [spaces, setSpaces] = useState([])
    const [canvases, setCanvases] = useState([])
    const [aggregating, setAggregating] = useState(false)

    const getSpacesApi = useApi((unikId) => api.spaces.getAll(unikId))
    const getCanvasesApi = useApi(api.canvases.getCanvases)
    const getCanvasesRequestRef = useRef(getCanvasesApi.request)
    useEffect(() => {
        getCanvasesRequestRef.current = getCanvasesApi.request
    }, [getCanvasesApi.request])
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')
    const { handleAuthError } = useAuthError()

    useEffect(() => {
        if (!unikId) {
            console.error('Unik ID is missing in URL')
            setError(new Error('Missing unikId'))
            return
        }
        localStorage.setItem('parentUnikId', unikId)
        if (location.state?.templateFlowData) {
            navigate(`/unik/${unikId}/agentcanvas`, { state: { templateFlowData: location.state.templateFlowData } })
            return
        }
        getSpacesApi.request(unikId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unikId, location.state, navigate])

    useEffect(() => {
        if (getSpacesApi.error && !handleAuthError(getSpacesApi.error)) {
            setError(getSpacesApi.error)
        }
    }, [getSpacesApi.error, handleAuthError])

    useEffect(() => {
        setLoading(getSpacesApi.loading || aggregating)
    }, [getSpacesApi.loading, aggregating])

    useEffect(() => {
        const normalizedSpaces = extractSpaces(getSpacesApi.data)
        setSpaces(normalizedSpaces)
    }, [getSpacesApi.data])

    const loadAgentCanvases = useCallback(
        async (spaceList) => {
            if (!unikId || !Array.isArray(spaceList) || spaceList.length === 0) return []
            const aggregated = []
            const failures = []

            const requestCanvases = getCanvasesRequestRef.current

            await Promise.all(
                spaceList.map(async (space) => {
                    try {
                        const data = await requestCanvases(unikId, space.id, { type: 'MULTIAGENT' })
                        const list = extractCanvases(data)
                        list.forEach((canvas) => {
                            aggregated.push({ ...canvas, spaceId: space.id, spaceName: space.name, unikId })
                        })
                    } catch (err) {
                        if (!handleAuthError(err)) {
                            failures.push(err)
                        }
                    }
                })
            )

            if (failures.length > 0) {
                throw failures[0]
            }

            return aggregated.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        },
        [handleAuthError, unikId]
    )

    const refreshCanvases = useCallback(async () => {
        const aggregated = await loadAgentCanvases(spaces)
        setCanvases(aggregated)
        setImages(buildImageMap(aggregated))
        setError(null)
        return aggregated
    }, [loadAgentCanvases, spaces])

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!spaces || spaces.length === 0) {
                setCanvases([])
                setImages({})
                setError(null)
                return
            }
            setAggregating(true)
            try {
                const aggregated = await loadAgentCanvases(spaces)
                if (!cancelled) {
                    setCanvases(aggregated)
                    setImages(buildImageMap(aggregated))
                    setError(null)
                }
            } catch (err) {
                if (!cancelled && !handleAuthError(err)) {
                    setError(err)
                }
            } finally {
                if (!cancelled) setAggregating(false)
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [spaces, loadAgentCanvases, handleAuthError])

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    const filterFlows = useCallback(
        (data) => {
            if (!data) return false
            const target = search.toLowerCase()
            return (
                (data.name || '').toLowerCase().includes(target) ||
                (data.spaceName || '').toLowerCase().includes(target) ||
                (data.category || '').toLowerCase().includes(target) ||
                (data.id || '').toLowerCase().includes(target)
            )
        },
        [search]
    )

    const addNew = () => {
        navigate(`/unik/${unikId}/agentcanvas`)
    }

    const goToCanvas = (selectedCanvas) => {
        navigate(`/unik/${unikId}/agentcanvas/${selectedCanvas.id}`)
    }

    const tableRefreshAdapter = useMemo(() => ({ request: refreshCanvases }), [refreshCanvases])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder={t('canvas:searchPlaceholder')}
                        title={t('canvas:title')}
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
                                title={t('common:cardView')}
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
                                title={t('common:listView')}
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledButton variant='contained' onClick={addNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40 }}>
                            {t('common:addNew')}
                        </StyledButton>
                    </ViewHeader>
                    {!view || view === 'card' ? (
                        <>
                            {isLoading && canvases.length === 0 ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                    <Skeleton variant='rounded' height={160} />
                                </Box>
                            ) : (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {canvases.filter(filterFlows).map((data) => (
                                        <ItemCard key={data.id} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            isAgentCanvas={true}
                            data={canvases}
                            images={images}
                            isLoading={isLoading}
                            filterFunction={filterFlows}
                            updateFlowsApi={tableRefreshAdapter}
                            setError={setError}
                        />
                    )}
                    {!isLoading && canvases.length === 0 && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '12vh', width: 'auto' }}
                                    src={AgentsEmptySVG}
                                    alt='AgentsEmptySVG'
                                />
                            </Box>
                            <div>{t('canvas:noAgentsYet')}</div>
                        </Stack>
                    )}
                </Stack>
            )}

            <ConfirmDialog />
        </MainCard>
    )
}

export default Agentflows
