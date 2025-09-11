import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link as RouterLink, useLocation } from 'react-router-dom'
import {
    Box,
    Card,
    Typography,
    Button,
    Stack,
    Skeleton,
    Breadcrumbs,
    Link,
    CircularProgress,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { IconPlus, IconArrowLeft, IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// project imports
import ViewHeader from '@ui/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@ui/ErrorBoundary'
import ItemCard from '@ui/ui-component/cards/ItemCard'
import { gridSpacing } from '@ui/store/constant'
import { FlowListTable } from '@ui/ui-component/table/FlowListTable'

// assets
import APIEmptySVG from '@ui/assets/images/api_empty.svg'

import { useApi } from '../hooks/useApi'
import * as clustersApi from '../api/clusters'
// import * as domainsApi from '../api/domains'
import { Cluster, Resource, Domain } from '../types'
import ResourceDialog from './ResourceDialog'
import DomainDialog from './DomainDialog'



const ClusterDetail = () => {
    const { clusterId } = useParams<{ clusterId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('resources')
    const theme = useTheme()

    // Section UI state (consistent with ClusterList)
    const [resourcesSearch, setResourcesSearch] = useState('')
    const [resourcesView, setResourcesView] = useState<string>(localStorage.getItem('resourcesClusterResourcesDisplayStyle') || 'card')

    const [domainsSearch, setDomainsSearch] = useState('')
    const [domainsView, setDomainsView] = useState<string>(localStorage.getItem('resourcesClusterDomainsDisplayStyle') || 'card')


    const [cluster, setCluster] = useState<Cluster | null>(null)
    const [resources, setResources] = useState<Resource[]>([])
    const [domains, setDomains] = useState<Domain[]>([])
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const location = useLocation()
    const pathname = location.pathname
    const section: 'board' | 'resources' | 'domains' = pathname.endsWith('/resources') ? 'resources' : pathname.endsWith('/domains') ? 'domains' : 'board'

    const [isResourceDialogOpen, setResourceDialogOpen] = useState(false)
    const [isDomainDialogOpen, setDomainDialogOpen] = useState(false)
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null)
    const [selectedDomain] = useState<Domain | null>(null)


    const { request: getCluster } = useApi(clustersApi.getCluster)
    const { request: getClusterResources } = useApi(clustersApi.getClusterResources)
    const { request: getClusterDomains } = useApi(clustersApi.getClusterDomains)

    useEffect(() => {
        if (clusterId) {
            fetchClusterData()
        }
    }, [clusterId])

    const fetchClusterData = async () => {
        if (!clusterId) return

        try {
            setLoading(true)
            setError(null)

            const [clusterResult, resourcesResult, domainsResult] = await Promise.all([
                getCluster(clusterId),
                getClusterResources(clusterId),
                getClusterDomains(clusterId)
            ])

            setCluster(clusterResult)
            setResources(Array.isArray(resourcesResult) ? resourcesResult : [])
            setDomains(Array.isArray(domainsResult) ? domainsResult : [])
        } catch (err: any) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }



    const handleAddResource = () => {
        setSelectedResource(null)
        setResourceDialogOpen(true)
    }




    const handleResourceDialogSave = () => {
        setResourceDialogOpen(false)
        fetchClusterData()
    }

    const handleDomainDialogSave = () => {
        setDomainDialogOpen(false)
        fetchClusterData()
    }

    const goToResource = (resource: Resource) => {
        if (clusterId) navigate(`/clusters/${clusterId}/resources/${resource.id}`)
        else navigate(`/resources/${resource.id}`)
    }

    // For resources we don't need to calculate images – pass empty array for each resource
    const images: any = {}
    if (Array.isArray(resources)) {
        resources.forEach((resource) => {
            if (resource && resource.id) {
                images[resource.id] = []
            }
        })
    }

    // For domains we also pass empty images
    const domainImages: any = {}
    if (Array.isArray(domains)) {
        domains.forEach((domain) => {
            if (domain && domain.id) {
                domainImages[domain.id] = []
            }
        })
    }

    // Search handlers
    const onResourcesSearchChange = (event: any) => setResourcesSearch(event?.target?.value || '')
    const onDomainsSearchChange = (event: any) => setDomainsSearch(event?.target?.value || '')

    // View toggles
    const handleResourcesViewChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('resourcesClusterResourcesDisplayStyle', nextView)
        setResourcesView(nextView)
    }
    const handleDomainsViewChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('resourcesClusterDomainsDisplayStyle', nextView)
        setDomainsView(nextView)
    }

    // Filters
    const filterResources = (data: any) => {
        const q = (resourcesSearch || '').toLowerCase()
        return (data?.name || '').toLowerCase().includes(q) || (data?.description || '').toLowerCase().includes(q)
    }
    const filterDomains = (data: any) => {
        const q = (domainsSearch || '').toLowerCase()
        return (data?.name || '').toLowerCase().includes(q) || (data?.description || '').toLowerCase().includes(q)
    }

    // Update callbacks for list view table (just refetch)
    const updateResourcesApi = async () => fetchClusterData()
    const updateDomainsApi = async () => fetchClusterData()


    if (isLoading) {
        return (
            <Card sx={{ background: 'transparent', maxWidth: '1280px', mx: 'auto' }}>
                <Stack flexDirection='column' sx={{ gap: 3, p: 1.25 }}>
                    <Skeleton variant='rectangular' height={60} />
                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                        <Skeleton variant='rounded' height={160} />
                        <Skeleton variant='rounded' height={160} />
                        <Skeleton variant='rounded' height={160} />
                    </Box>
                </Stack>
            </Card>
        )
    }

    if (error) {
        return (
            <Card sx={{ background: 'transparent', maxWidth: '1280px', mx: 'auto' }}>
                <ErrorBoundary>
                    <div>Error: {error.message || error}</div>
                </ErrorBoundary>
            </Card>
        )
    }

    return (
        <Card sx={{ background: 'transparent', maxWidth: '1280px', mx: 'auto', p: 1.25 }}>
            <Stack spacing={2}>
                <Breadcrumbs aria-label="breadcrumb">
                    <Link
                        component={RouterLink}
                        to="/clusters"
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                        <IconArrowLeft size={16} />
                        {t('clusters.title')}
                    </Link>
                    <Typography color="text.primary">{cluster?.name || t('clusters.detail.info')}</Typography>
                </Breadcrumbs>

                {isLoading ? (
                    <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 6 }}>
                        <CircularProgress size={24} />
                    </Stack>
                ) : (
                    <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="h4" gutterBottom>
                                {cluster?.name}
                            </Typography>
                        </Stack>

                        {cluster?.description && (
                            <Typography variant="body1" color="text.secondary">
                                {cluster.description}
                            </Typography>
                        )}

                        {section === 'board' && (
                            <Stack spacing={2}>
                                <ViewHeader
                                    search={false}
                                    title={t('clusters.detail.clusterboard')}
                                />
                                <Typography variant="body2" color="text.secondary">
                                    Здесь будет аналитика и статистика кластера (в разработке)
                                </Typography>
                            </Stack>
                        )}

                        {section === 'resources' && (
                            <Stack spacing={2}>
                                <ViewHeader
                                    onSearchChange={onResourcesSearchChange}
                                    search={true}
                                    searchPlaceholder={t('resources.list.searchPlaceholder')}
                                    title={`${t('clusters.detail.resources')} (${resources.length})`}
                                >
                                    <ToggleButtonGroup
                                        sx={{ borderRadius: 2, maxHeight: 40 }}
                                        value={resourcesView}
                                        color='primary'
                                        exclusive
                                        onChange={handleResourcesViewChange}
                                    >
                                        <ToggleButton
                                            sx={{ borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                                            value='card'
                                            title={t('common.cardView', 'Card View')}
                                        >
                                            <IconLayoutGrid />
                                        </ToggleButton>
                                        <ToggleButton
                                            sx={{ borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                                            value='list'
                                            title={t('common.listView', 'List View')}
                                        >
                                            <IconList />
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                    <Button variant='contained' startIcon={<IconPlus size={16} />} onClick={handleAddResource} sx={{ borderRadius: 2, height: 40 }}>
                                        {t('resources.list.addNew')}
                                    </Button>
                                </ViewHeader>

                                {(!Array.isArray(resources) || resources.length === 0) ? (
                                    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                        <Box sx={{ p: 2, height: 'auto' }}>
                                            <img style={{ objectFit: 'cover', height: '25vh', width: 'auto' }} src={APIEmptySVG} alt='No Resources' />
                                        </Box>
                                        <div>{t('resources.list.noResourcesYet', 'No resources found in this cluster')}</div>
                                    </Stack>
                                ) : resourcesView === 'card' ? (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        {resources.filter(filterResources).map((resource) => (
                                            <ItemCard key={resource.id} data={resource} images={images[resource.id] || []} onClick={() => goToResource(resource)} />
                                        ))}
                                    </Box>
                                ) : (
                                    <FlowListTable
                                        data={resources.filter(filterResources)}
                                        images={images}
                                        isLoading={false}
                                        filterFunction={filterResources}
                                        updateFlowsApi={updateResourcesApi}
                                        setError={setError}
                                    />
                                )}
                            </Stack>
                        )}

                        {section === 'domains' && (
                            <Stack spacing={2}>
                                <ViewHeader
                                    onSearchChange={onDomainsSearchChange}
                                    search={true}
                                    searchPlaceholder={t('domains.list.searchPlaceholder')}
                                    title={`${t('clusters.detail.domains')} (${domains.length})`}
                                >
                                    <ToggleButtonGroup
                                        sx={{ borderRadius: 2, maxHeight: 40 }}
                                        value={domainsView}
                                        color='primary'
                                        exclusive
                                        onChange={handleDomainsViewChange}
                                    >
                                        <ToggleButton
                                            sx={{ borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                                            value='card'
                                            title={t('common.cardView', 'Card View')}
                                        >
                                            <IconLayoutGrid />
                                        </ToggleButton>
                                        <ToggleButton
                                            sx={{ borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}
                                            value='list'
                                            title={t('common.listView', 'List View')}
                                        >
                                            <IconList />
                                        </ToggleButton>
                                    </ToggleButtonGroup>
                                    <Button variant='contained' startIcon={<IconPlus size={16} />} onClick={() => setDomainDialogOpen(true)} sx={{ borderRadius: 2, height: 40 }}>
                                        {t('domains.list.addNew')}
                                    </Button>
                                </ViewHeader>

                                {(!Array.isArray(domains) || domains.length === 0) ? (
                                    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                        <Box sx={{ p: 2, height: 'auto' }}>
                                            <img style={{ objectFit: 'cover', height: '25vh', width: 'auto' }} src={APIEmptySVG} alt='No Domains' />
                                        </Box>
                                        <div>{t('domains.list.noDomainsYet', 'No domains found')}</div>
                                    </Stack>
                                ) : domainsView === 'card' ? (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        {domains.filter(filterDomains).map((domain) => (
                                            <ItemCard key={domain.id} data={domain} images={domainImages[domain.id] || []} onClick={() => navigate(`/clusters/${clusterId}/domains/${domain.id}`)} />
                                        ))}
                                    </Box>
                                ) : (
                                    <FlowListTable
                                        data={domains.filter(filterDomains)}
                                        images={domainImages}
                                        isLoading={false}
                                        filterFunction={filterDomains}
                                        updateFlowsApi={updateDomainsApi}
                                        setError={setError}
                                    />
                                )}
                            </Stack>
                        )}
                    </>
                )}

                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        onClick={() => navigate('/clusters')}
                    >
                        {t('resources.common.back')}
                    </Button>
                </Stack>
            </Stack>


            {isResourceDialogOpen && (
                <ResourceDialog
                    open={isResourceDialogOpen}
                    onClose={() => setResourceDialogOpen(false)}
                    onSave={handleResourceDialogSave}
                    resource={selectedResource}
                    clusterId={clusterId}
                />
            )}

            {isDomainDialogOpen && (
                <DomainDialog
                    open={isDomainDialogOpen}
                    onClose={() => setDomainDialogOpen(false)}
                    onSave={handleDomainDialogSave}
                    domain={selectedDomain}
                    clusterId={clusterId}
                />
            )}
        </Card>
    )
}

export default ClusterDetail
