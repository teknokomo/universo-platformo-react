import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Card, Button } from '@mui/material'
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'

// project imports
import ItemCard from '@ui/ui-component/cards/ItemCard'
import { gridSpacing } from '@ui/store/constant'
import { FlowListTable } from '@ui/ui-component/table/FlowListTable'
import ViewHeader from '@ui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@ui/ErrorBoundary'

// assets
import APIEmptySVG from '@ui/assets/images/api_empty.svg'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse } from '../types'
import MetaverseDialog from './MetaverseDialog'

const MetaverseList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation('entities')
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [view, setView] = useState(localStorage.getItem('entitiesMetaverseDisplayStyle') || 'card')

    // State management following Uniks pattern
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [metaverses, setMetaverses] = useState<Metaverse[]>([])

    const { request: loadMetaverses } = useApi(metaversesApi.listMetaverses)

    useEffect(() => {
        const fetchMetaverses = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadMetaverses()
                // Ensure result is always an array
                const metaversesArray = Array.isArray(result) ? result : []
                setMetaverses(metaversesArray)
            } catch (err: any) {
                setError(err)
                setMetaverses([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        fetchMetaverses()
    }, [loadMetaverses])

    const [selectedMetaverse, setSelectedMetaverse] = useState<Metaverse | null>(null)

    // For metaverses we don't need to calculate images – pass empty array for each metaverse
    const images: any = {}
    if (Array.isArray(metaverses)) {
        metaverses.forEach((metaverse) => {
            if (metaverse && metaverse.id) {
                images[metaverse.id] = []
            }
        })
    }

    const handleAddNew = () => {
        setSelectedMetaverse(null)
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
        // Refresh the list
        const fetchMetaverses = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadMetaverses()
                // Ensure result is always an array
                const metaversesArray = Array.isArray(result) ? result : []
                setMetaverses(metaversesArray)
            } catch (err: any) {
                setError(err)
                setMetaverses([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        fetchMetaverses()
    }

    const goToMetaverse = (metaverse: any) => {
        navigate(`/metaverses/${metaverse.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesMetaverseDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (value: string) => {
        setSearch(value)
    }

    const filterMetaverses = (data: any) => {
        return (
            data.name.toLowerCase().includes(search.toLowerCase()) ||
            (data.description && data.description.toLowerCase().includes(search.toLowerCase()))
        )
    }

    const updateFlowsApi = async () => {
        const fetchMetaverses = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadMetaverses()
                // Ensure result is always an array
                const metaversesArray = Array.isArray(result) ? result : []
                setMetaverses(metaversesArray)
            } catch (err: any) {
                setError(err)
                setMetaverses([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        await fetchMetaverses()
    }

    return (
        <Card sx={{ background: 'transparent', maxWidth: '1280px', mx: 'auto' }}>
            {error ? (
                <ErrorBoundary>
                    <div>Error: {error.message || error}</div>
                </ErrorBoundary>
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3, p: 1.25 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder={t('metaverses.searchPlaceholder')}
                        title={t('metaverses.title')}
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
                                    borderRadius: 2
                                }}
                                value='card'
                                title={t('common.cardView', 'Card View')}
                            >
                                <IconLayoutGrid />
                            </ToggleButton>
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2
                                }}
                                value='list'
                                title={t('common.listView', 'List View')}
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <Button variant='contained' onClick={handleAddNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40 }}>
                            {t('metaverses.addNew')}
                        </Button>
                    </ViewHeader>

                    {isLoading && (!Array.isArray(metaverses) || metaverses.length === 0) ? (
                        view === 'card' ? (
                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                            </Box>
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && (!Array.isArray(metaverses) || metaverses.length === 0) ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img style={{ objectFit: 'cover', height: '25vh', width: 'auto' }} src={APIEmptySVG} alt='No Metaverses' />
                            </Box>
                            <div>{t('metaverses.noMetaversesFound', 'No metaverses found')}</div>
                        </Stack>
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {Array.isArray(metaverses) &&
                                        metaverses
                                            .filter(filterMetaverses)
                                            .map((metaverse) => (
                                                <ItemCard
                                                    key={metaverse.id}
                                                    data={metaverse}
                                                    images={images[metaverse.id] || []}
                                                    onClick={() => goToMetaverse(metaverse)}
                                                />
                                            ))}
                                </Box>
                            ) : (
                                <FlowListTable
                                    data={Array.isArray(metaverses) ? metaverses.filter(filterMetaverses) : []}
                                    images={images}
                                    isLoading={isLoading}
                                    filterFunction={filterMetaverses}
                                    updateFlowsApi={updateFlowsApi}
                                    setError={setError}
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}

            <MetaverseDialog open={isDialogOpen} onClose={handleDialogClose} onSave={handleDialogSave} metaverse={selectedMetaverse} />
        </Card>
    )
}

export default MetaverseList
