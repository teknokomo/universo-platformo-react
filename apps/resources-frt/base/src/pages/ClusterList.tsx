import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Card, Button } from '@mui/material'
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'

// project imports
// Migrated to shared template-mui ItemCard (incremental step)
import { ItemCard } from '@universo/template-mui'
import { FlowListTable } from '@universo/template-mui/components/table/FlowListTable'
import { gridSpacing } from '@ui/store/constant'
import ViewHeader from '@ui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@ui/ErrorBoundary'
import BaseEntityMenu from '@ui/ui-component/menu/BaseEntityMenu'
import ConfirmDialog from '@ui/ui-component/dialog/ConfirmDialog'
import useConfirm from '@ui/hooks/useConfirm'

// assets
import APIEmptySVG from '@ui/assets/images/api_empty.svg'

import { useApi } from '../hooks/useApi'
import * as clustersApi from '../api/clusters'
import { Cluster } from '../types'
import ClusterDialog from './ClusterDialog'
import clusterActions from './clusterActions'

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
    // Aggregated counts come directly from backend list response now

    const { request: loadClusters } = useApi(clustersApi.listClusters)
    const updateClusterApi = useApi(clustersApi.updateCluster)
    const deleteClusterApi = useApi(clustersApi.deleteCluster)

    const { confirm } = useConfirm()

    const fetchClusters = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await loadClusters()
            const clustersArray = Array.isArray(result) ? result : []
            setClusters(clustersArray)
        } catch (err: any) {
            setError(err)
            setClusters([])
        } finally {
            setLoading(false)
        }
    }, [loadClusters])

    useEffect(() => {
        fetchClusters()
    }, [fetchClusters])

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
        const name = (data?.name || '').toLowerCase()
        const description = (data?.description || '').toLowerCase()
        const term = search.toLowerCase()
        return name.includes(term) || description.includes(term)
    }

    const updateFlowsApi = fetchClusters

    const clusterColumns = useMemo(
        () => [
            {
                id: 'domains',
                label: t('clusters.table.domains'),
                width: '20%',
                align: 'center',
                render: (row: Cluster) => (typeof row.domainsCount === 'number' ? row.domainsCount : '—')
            },
            {
                id: 'resources',
                label: t('clusters.table.resources'),
                width: '20%',
                align: 'center',
                render: (row: Cluster) => (typeof row.resourcesCount === 'number' ? row.resourcesCount : '—')
            }
        ],
        [t]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createClusterContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    try {
                        await updateClusterApi.request(id, patch)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                },
                deleteEntity: async (id: string) => {
                    try {
                        await deleteClusterApi.request(id)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                }
            },
            helpers: {
                refreshList: async () => {
                    await fetchClusters()
                },
                confirm: async (spec: any) => {
                    const confirmed = await confirm({
                        title: baseContext.t(spec.titleKey, spec.interpolate),
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : undefined,
                        confirmButtonName: baseContext.t('confirm.delete.confirm'),
                        cancelButtonName: baseContext.t('confirm.delete.cancel')
                    })
                    return confirmed
                }
            }
        }),
        [confirm, deleteClusterApi, fetchClusters, setError, updateClusterApi]
    )

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
                        <Button variant='contained' onClick={handleAddNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40 }}>
                            {t('clusters.addNew')}
                        </Button>
                    </ViewHeader>

                    {isLoading && (!Array.isArray(clusters) || clusters.length === 0) ? (
                        view === 'card' ? (
                            <Box
                                sx={{
                                    display: 'grid',
                                    gap: gridSpacing,
                                    gridTemplateColumns: {
                                        xs: 'repeat(1, minmax(0, 1fr))',
                                        sm: 'repeat(2, minmax(220px, 1fr))',
                                        lg: 'repeat(auto-fit, minmax(260px, 1fr))'
                                    }
                                }}
                            >
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
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: gridSpacing,
                                        gridTemplateColumns: {
                                            xs: 'repeat(1, minmax(0, 1fr))',
                                            sm: 'repeat(2, minmax(220px, 1fr))',
                                            lg: 'repeat(auto-fit, minmax(260px, 1fr))'
                                        }
                                    }}
                                >
                                    {Array.isArray(clusters) &&
                                        clusters
                                            .filter(filterClusters)
                                            .map((cluster) => (
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
                                    data={Array.isArray(clusters) ? clusters : []}
                                    images={images}
                                    isLoading={isLoading}
                                    filterFunction={filterClusters}
                                    updateFlowsApi={updateFlowsApi}
                                    setError={setError}
                                    getRowLink={(row: Cluster) => (row?.id ? `/clusters/${row.id}` : undefined)}
                                    customColumns={clusterColumns}
                                    renderActions={(row: Cluster) => (
                                        <BaseEntityMenu
                                            entity={row}
                                            entityKind='cluster'
                                            descriptors={clusterActions}
                                            namespace='flowList'
                                            createContext={createClusterContext}
                                        />
                                    )}
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}

            <ClusterDialog open={isDialogOpen} onClose={handleDialogClose} onSave={handleDialogSave} cluster={selectedCluster} />
            <ConfirmDialog />
        </Card>
    )
}

export default ClusterList
