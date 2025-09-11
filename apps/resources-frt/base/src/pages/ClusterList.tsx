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
import * as clustersApi from '../api/clusters'
import { Cluster } from '../types'
import ClusterDialog from './ClusterDialog'

const ClusterList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation('resources')
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [view, setView] = useState(localStorage.getItem('resourcesClusterDisplayStyle') || 'card')

    // State management following Uniks pattern
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [clusters, setClusters] = useState<Cluster[]>([])

    const { request: loadClusters } = useApi(clustersApi.listClusters)

    useEffect(() => {
        const fetchClusters = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadClusters()
                // Ensure result is always an array
                const clustersArray = Array.isArray(result) ? result : []
                setClusters(clustersArray)
            } catch (err: any) {
                setError(err)
                setClusters([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        fetchClusters()
    }, [loadClusters])

    const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)

    // For clusters we don't need to calculate images – pass empty array for each cluster
    const images: any = {}
    if (Array.isArray(clusters)) {
        clusters.forEach((cluster) => {
            if (cluster && cluster.id) {
                images[cluster.id] = []
            }
        })
    }

    const handleAddNew = () => {
        setSelectedCluster(null)
        setDialogOpen(true)
    }



    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleDialogSave = () => {
        setDialogOpen(false)
        // Refresh the list
        const fetchClusters = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadClusters()
                // Ensure result is always an array
                const clustersArray = Array.isArray(result) ? result : []
                setClusters(clustersArray)
            } catch (err: any) {
                setError(err)
                setClusters([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        fetchClusters()
    }

    const goToCluster = (cluster: any) => {
        navigate(`/clusters/${cluster.id}`)
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('resourcesClusterDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (value: string) => {
        setSearch(value)
    }

    const filterClusters = (data: any) => {
        return data.name.toLowerCase().includes(search.toLowerCase()) || (data.description && data.description.toLowerCase().includes(search.toLowerCase()))
    }

    const updateFlowsApi = async () => {
        const fetchClusters = async () => {
            try {
                setLoading(true)
                setError(null)
                const result = await loadClusters()
                // Ensure result is always an array
                const clustersArray = Array.isArray(result) ? result : []
                setClusters(clustersArray)
            } catch (err: any) {
                setError(err)
                setClusters([]) // Set empty array on error
            } finally {
                setLoading(false)
            }
        }
        await fetchClusters()
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
                        searchPlaceholder={t('clusters.searchPlaceholder')}
                        title={t('clusters.title')}
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
                        <Button
                            variant='contained'
                            onClick={handleAddNew}
                            startIcon={<IconPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            {t('clusters.addNew')}
                        </Button>
                    </ViewHeader>

                    {isLoading && (!Array.isArray(clusters) || clusters.length === 0) ? (
                        view === 'card' ? (
                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                                <Skeleton variant='rounded' height={160} />
                            </Box>
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && (!Array.isArray(clusters) || clusters.length === 0) ? (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img style={{ objectFit: 'cover', height: '25vh', width: 'auto' }} src={APIEmptySVG} alt='No Clusters' />
                            </Box>
                            <div>{t('clusters.noClustersFound', 'No clusters found')}</div>
                        </Stack>
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {Array.isArray(clusters) && clusters.filter(filterClusters).map((cluster) => (
                                        <ItemCard
                                            key={cluster.id}
                                            data={cluster}
                                            images={images[cluster.id] || []}
                                            onClick={() => goToCluster(cluster)}
                                        />
                                    ))}
                                </Box>
                            ) : (
                                <FlowListTable
                                    data={Array.isArray(clusters) ? clusters.filter(filterClusters) : []}
                                    images={images}
                                    isLoading={isLoading}
                                    filterFunction={filterClusters}
                                    updateFlowsApi={updateFlowsApi}
                                    setError={setError}
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}

            <ClusterDialog 
                open={isDialogOpen} 
                onClose={handleDialogClose} 
                onSave={handleDialogSave} 
                cluster={selectedCluster}
            />
        </Card>
    )
}

export default ClusterList
