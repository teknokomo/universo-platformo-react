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
    ToggleButtonGroup,
    Chip
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
import * as metaversesApi from '../api/metaverses'
// import * as sectionsApi from '../api/sections'
import { Metaverse, Entity, Section } from '../types'
import EntityDialog from './EntityDialog'
import SectionDialog from './SectionDialog'
import MetaverseAccess from './MetaverseAccess'

const MetaverseDetail = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')
    const theme = useTheme()

    // Section UI state (consistent with MetaverseList)
    const [entitiesSearch, setEntitiesSearch] = useState('')
    const [entitiesView, setEntitiesView] = useState<string>(localStorage.getItem('entitiesMetaverseEntitiesDisplayStyle') || 'card')

    const [sectionsSearch, setSectionsSearch] = useState('')
    const [sectionsView, setSectionsView] = useState<string>(localStorage.getItem('entitiesMetaverseSectionsDisplayStyle') || 'card')

    const [metaverse, setMetaverse] = useState<Metaverse | null>(null)
    const [entities, setEntities] = useState<Entity[]>([])
    const [sections, setSections] = useState<Section[]>([])
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const location = useLocation()
    const pathname = location.pathname
    const section: 'board' | 'entities' | 'sections' | 'access' = pathname.endsWith('/entities')
        ? 'entities'
        : pathname.endsWith('/sections')
        ? 'sections'
        : pathname.endsWith('/access')
        ? 'access'
        : 'board'

    const [isEntityDialogOpen, setEntityDialogOpen] = useState(false)
    const [isSectionDialogOpen, setSectionDialogOpen] = useState(false)
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)
    const [selectedSection] = useState<Section | null>(null)

    const { request: getMetaverse } = useApi(metaversesApi.getMetaverse)
    const { request: getMetaverseEntities } = useApi(metaversesApi.getMetaverseEntities)
    const { request: getMetaverseSections } = useApi(metaversesApi.getMetaverseSections)

    useEffect(() => {
        if (metaverseId) {
            fetchMetaverseData()
        }
    }, [metaverseId])

    const fetchMetaverseData = async () => {
        if (!metaverseId) return

        try {
            setLoading(true)
            setError(null)

            const [metaverseResult, entitiesResult, sectionsResult] = await Promise.all([
                getMetaverse(metaverseId),
                getMetaverseEntities(metaverseId),
                getMetaverseSections(metaverseId)
            ])

            setMetaverse(metaverseResult)
            setEntities(Array.isArray(entitiesResult) ? entitiesResult : [])
            setSections(Array.isArray(sectionsResult) ? sectionsResult : [])
        } catch (err: any) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    const handleAddEntity = () => {
        if (!canCreateContent) return
        setSelectedEntity(null)
        setEntityDialogOpen(true)
    }

    const handleEntityDialogSave = () => {
        setEntityDialogOpen(false)
        fetchMetaverseData()
    }

    const handleSectionDialogSave = () => {
        setSectionDialogOpen(false)
        fetchMetaverseData()
    }

    const goToEntity = (entity: Entity) => {
        if (metaverseId) navigate(`/metaverses/${metaverseId}/entities/${entity.id}`)
        else navigate(`/entities/${entity.id}`)
    }

    // For entities we don't need to calculate images – pass empty array for each entity
    const images: any = {}
    if (Array.isArray(entities)) {
        entities.forEach((entity) => {
            if (entity && entity.id) {
                images[entity.id] = []
            }
        })
    }

    // For sections we also pass empty images
    const sectionImages: any = {}
    if (Array.isArray(sections)) {
        sections.forEach((section) => {
            if (section && section.id) {
                sectionImages[section.id] = []
            }
        })
    }

    // Search handlers
    const onEntitiesSearchChange = (event: any) => setEntitiesSearch(event?.target?.value || '')
    const onSectionsSearchChange = (event: any) => setSectionsSearch(event?.target?.value || '')

    // View toggles
    const handleEntitiesViewChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesMetaverseEntitiesDisplayStyle', nextView)
        setEntitiesView(nextView)
    }
    const handleSectionsViewChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        localStorage.setItem('entitiesMetaverseSectionsDisplayStyle', nextView)
        setSectionsView(nextView)
    }

    // Filters
    const filterEntities = (data: any) => {
        const q = (entitiesSearch || '').toLowerCase()
        return (data?.name || '').toLowerCase().includes(q) || (data?.description || '').toLowerCase().includes(q)
    }
    const filterSections = (data: any) => {
        const q = (sectionsSearch || '').toLowerCase()
        return (data?.name || '').toLowerCase().includes(q) || (data?.description || '').toLowerCase().includes(q)
    }

    // Update callbacks for list view table (just refetch)
    const updateEntitiesApi = async () => fetchMetaverseData()
    const updateSectionsApi = async () => fetchMetaverseData()

    const canCreateContent = metaverse?.permissions?.createContent ?? false

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
                <Breadcrumbs aria-label='breadcrumb'>
                    <Link component={RouterLink} to='/metaverses' sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconArrowLeft size={16} />
                        {t('metaverses.title')}
                    </Link>
                    <Typography color='text.primary'>{metaverse?.name || t('metaverses.detail.info')}</Typography>
                </Breadcrumbs>

                {isLoading ? (
                    <Stack direction='row' alignItems='center' justifyContent='center' sx={{ py: 6 }}>
                        <CircularProgress size={24} />
                    </Stack>
                ) : (
                    <>
                        <Stack direction='row' justifyContent='space-between' alignItems='center'>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Typography variant='h4' gutterBottom>
                                    {metaverse?.name}
                                </Typography>
                                {metaverse?.role && (
                                    <Chip
                                        size='small'
                                        color='primary'
                                        variant='outlined'
                                        label={t(`metaverses.roles.${metaverse.role}`)}
                                    />
                                )}
                            </Stack>
                        </Stack>

                        {metaverse?.description && (
                            <Typography variant='body1' color='text.secondary'>
                                {metaverse.description}
                            </Typography>
                        )}

                        {section === 'board' && (
                            <Stack spacing={2}>
                                <ViewHeader search={false} title={t('metaverses.detail.metaverseboard')} />
                                <Typography variant='body2' color='text.secondary'>
                                    Здесь будет аналитика и статистика кластера (в разработке)
                                </Typography>
                            </Stack>
                        )}

                        {section === 'entities' && (
                            <Stack spacing={2}>
                                <ViewHeader
                                    onSearchChange={onEntitiesSearchChange}
                                    search={true}
                                    searchPlaceholder={t('entities.list.searchPlaceholder')}
                                    title={`${t('metaverses.detail.entities')} (${entities.length})`}
                                >
                                    <ToggleButtonGroup
                                        sx={{ borderRadius: 2, maxHeight: 40 }}
                                        value={entitiesView}
                                        color='primary'
                                        exclusive
                                        onChange={handleEntitiesViewChange}
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
                                    <Button
                                        variant='contained'
                                        startIcon={<IconPlus size={16} />}
                                        onClick={handleAddEntity}
                                        sx={{ borderRadius: 2, height: 40 }}
                                        disabled={!canCreateContent}
                                    >
                                        {t('entities.list.addNew')}
                                    </Button>
                                </ViewHeader>

                                {!Array.isArray(entities) || entities.length === 0 ? (
                                    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                        <Box sx={{ p: 2, height: 'auto' }}>
                                            <img
                                                style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                src={APIEmptySVG}
                                                alt='No Entities'
                                            />
                                        </Box>
                                        <div>{t('entities.list.noEntitiesYet', 'No entities found in this metaverse')}</div>
                                    </Stack>
                                ) : entitiesView === 'card' ? (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        {entities.filter(filterEntities).map((entity) => (
                                            <ItemCard
                                                key={entity.id}
                                                data={entity}
                                                images={images[entity.id] || []}
                                                onClick={() => goToEntity(entity)}
                                            />
                                        ))}
                                    </Box>
                                ) : (
                                    <FlowListTable
                                        data={entities.filter(filterEntities)}
                                        images={images}
                                        isLoading={false}
                                        filterFunction={filterEntities}
                                        updateFlowsApi={updateEntitiesApi}
                                        setError={setError}
                                    />
                                )}
                            </Stack>
                        )}

                        {section === 'sections' && (
                            <Stack spacing={2}>
                                <ViewHeader
                                    onSearchChange={onSectionsSearchChange}
                                    search={true}
                                    searchPlaceholder={t('sections.list.searchPlaceholder')}
                                    title={`${t('metaverses.detail.sections')} (${sections.length})`}
                                >
                                    <ToggleButtonGroup
                                        sx={{ borderRadius: 2, maxHeight: 40 }}
                                        value={sectionsView}
                                        color='primary'
                                        exclusive
                                        onChange={handleSectionsViewChange}
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
                                    <Button
                                        variant='contained'
                                        startIcon={<IconPlus size={16} />}
                                        onClick={() => {
                                            if (!canCreateContent) return
                                            setSectionDialogOpen(true)
                                        }}
                                        sx={{ borderRadius: 2, height: 40 }}
                                        disabled={!canCreateContent}
                                    >
                                        {t('sections.list.addNew')}
                                    </Button>
                                </ViewHeader>

                                {!Array.isArray(sections) || sections.length === 0 ? (
                                    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                        <Box sx={{ p: 2, height: 'auto' }}>
                                            <img
                                                style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                src={APIEmptySVG}
                                                alt='No Sections'
                                            />
                                        </Box>
                                        <div>{t('sections.list.noSectionsYet', 'No sections found')}</div>
                                    </Stack>
                                ) : sectionsView === 'card' ? (
                                    <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                        {sections.filter(filterSections).map((section) => (
                                            <ItemCard
                                                key={section.id}
                                                data={section}
                                                images={sectionImages[section.id] || []}
                                                onClick={() => navigate(`/metaverses/${metaverseId}/sections/${section.id}`)}
                                            />
                                        ))}
                                    </Box>
                                ) : (
                                    <FlowListTable
                                        data={sections.filter(filterSections)}
                                        images={sectionImages}
                                        isLoading={false}
                                        filterFunction={filterSections}
                                        updateFlowsApi={updateSectionsApi}
                                        setError={setError}
                                    />
                                )}
                            </Stack>
                        )}

                        {section === 'access' && (
                            <Stack spacing={2}>
                                <MetaverseAccess metaverse={metaverse} />
                            </Stack>
                        )}
                    </>
                )}

                <Stack direction='row' spacing={1}>
                    <Button variant='outlined' onClick={() => navigate('/metaverses')}>
                        {t('common.back')}
                    </Button>
                </Stack>
            </Stack>

            {isEntityDialogOpen && (
                <EntityDialog
                    open={isEntityDialogOpen}
                    onClose={() => setEntityDialogOpen(false)}
                    onSave={handleEntityDialogSave}
                    entity={selectedEntity}
                    metaverseId={metaverseId}
                />
            )}

            {isSectionDialogOpen && (
                <SectionDialog
                    open={isSectionDialogOpen}
                    onClose={() => setSectionDialogOpen(false)}
                    onSave={handleSectionDialogSave}
                    section={selectedSection}
                    metaverseId={metaverseId}
                />
            )}
        </Card>
    )
}

export default MetaverseDetail
