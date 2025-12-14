import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import { MainCard } from '@flowise/template-mui'
import { ItemCard } from '@flowise/template-mui'
import { gridSpacing } from '@flowise/template-mui'
import AgentsEmptySVG from '@flowise/template-mui/assets/images/agents_empty.svg'
import { ConfirmDialog } from '@flowise/template-mui'
import { FlowListTable } from '@flowise/template-mui'
import { StyledButton } from '@flowise/template-mui'
import ViewHeader from '@flowise/template-mui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@flowise/template-mui/ErrorBoundary'

// API
import { api } from '@universo/api-client' // Replaced import canvasesApi from '@/api/canvases'
// import spacesApi from '@/api/spaces' // Replaced with shared api import

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'
import { useAuthError } from '@universo/auth-frontend'

// const
import { baseURL, AGENTFLOW_ICONS } from '@flowise/template-mui'

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
    const icons = {}
    items.forEach((canvas) => {
        if (!canvas?.id) return
        images[canvas.id] = []
        icons[canvas.id] = []
        if (!canvas.flowData) return
        try {
            const flowData = typeof canvas.flowData === 'string' ? JSON.parse(canvas.flowData) : canvas.flowData
            const nodes = flowData?.nodes || []
            nodes.forEach((node) => {
                const nodeName = node?.data?.name
                if (!nodeName) return
                // Skip sticky notes
                if (nodeName === 'stickyNote' || nodeName === 'stickyNoteAgentflow') return
                
                // Check if this is an agentflow node with a built-in icon
                const foundIcon = AGENTFLOW_ICONS.find((icon) => icon.name === nodeName)
                if (foundIcon) {
                    // Check if icon is not already added (avoid duplicates)
                    if (!icons[canvas.id].some((ic) => ic.name === foundIcon.name)) {
                        icons[canvas.id].push(foundIcon)
                    }
                } else {
                    // Use API for regular nodes
                    const imageSrc = `${baseURL}/api/v1/node-icon/${nodeName}`
                    if (!images[canvas.id].some((img) => img.imageSrc === imageSrc)) {
                        images[canvas.id].push({
                            imageSrc,
                            label: node?.data?.label || nodeName
                        })
                    }
                }
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn('[Agentflows] Failed to parse flowData for canvas preview', { canvasId: canvas.id, error })
        }
    })
    return { images, icons }
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
    const [icons, setIcons] = useState({})
    const [search, setSearch] = useState('')
    const [spaces, setSpaces] = useState([])
    const [canvases, setCanvases] = useState([])
    const [aggregating, setAggregating] = useState(false)

    const getSpacesApi = useApi(api.spaces.getSpaces)
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
        const { images: newImages, icons: newIcons } = buildImageMap(aggregated)
        setImages(newImages)
        setIcons(newIcons)
        setError(null)
        return aggregated
    }, [loadAgentCanvases, spaces])

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            if (!spaces || spaces.length === 0) {
                setCanvases([])
                setImages({})
                setIcons({})
                setError(null)
                return
            }
            setAggregating(true)
            try {
                const aggregated = await loadAgentCanvases(spaces)
                if (!cancelled) {
                    setCanvases(aggregated)
                    const { images: newImages, icons: newIcons } = buildImageMap(aggregated)
                    setImages(newImages)
                    setIcons(newIcons)
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
                        searchPlaceholder={t('agents.searchPlaceholder')}
                        title={t('agents.title')}
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
                                        <ItemCard key={data.id} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} icons={icons[data.id]} />
                                    ))}
                                </Box>
                            )}
                        </>
                    ) : (
                        <FlowListTable
                            isAgentCanvas={true}
                            data={canvases}
                            images={images}
                            icons={icons}
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
                            <div>{t('agents.noAgentsYet')}</div>
                        </Stack>
                    )}
                </Stack>
            )}

            <ConfirmDialog />
        </MainCard>
    )
}

export default Agentflows
