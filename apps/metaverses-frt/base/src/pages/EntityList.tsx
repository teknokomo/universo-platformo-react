import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Stack, CircularProgress } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'

// project imports
import { ViewHeaderMUI as ViewHeader, TemplateMainCard as MainCard } from '@universo/template-mui'
import { ItemCard, ToolbarControls } from '@universo/template-mui'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse, Entity } from '../types'
import EntityDialog from './EntityDialog'

const EntityList = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')

    const [metaverse, setMetaverse] = useState<Metaverse | null>(null)
    const [entities, setEntities] = useState<Entity[]>([])
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [viewType, setViewType] = useState<'card' | 'list'>('card')
    const [search, setSearch] = useState('')
    const [isEntityDialogOpen, setEntityDialogOpen] = useState(false)
    const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null)

    const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search])
    const filteredEntities = useMemo(() => {
        if (!normalizedSearch) {
            return entities
        }

        return entities.filter((entity) =>
            `${entity.name ?? ''} ${entity.description ?? ''}`.toLowerCase().includes(normalizedSearch)
        )
    }, [entities, normalizedSearch])

    const { request: getMetaverse } = useApi(metaversesApi.getMetaverse)
    const { request: getMetaverseEntities } = useApi(metaversesApi.getMetaverseEntities)

    useEffect(() => {
        if (metaverseId) {
            fetchData()
        }
    }, [metaverseId])

    const fetchData = async () => {
        if (!metaverseId) return

        try {
            setLoading(true)
            setError(null)

            const [metaverseResult, entitiesResult] = await Promise.all([getMetaverse(metaverseId), getMetaverseEntities(metaverseId)])

            setMetaverse(metaverseResult)
            setEntities(Array.isArray(entitiesResult) ? entitiesResult : [])
        } catch (err: any) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    const handleAddEntity = () => {
        setSelectedEntity(null)
        setEntityDialogOpen(true)
    }

    const handleEntityDialogSave = () => {
        setEntityDialogOpen(false)
        fetchData() // Reload data
    }

    const canCreateContent = metaverse?.permissions?.createContent ?? false

    if (isLoading) {
        return (
            <MainCard disableHeader disableContentPadding border={false} shadow={false} content={false}>
                <Box display='flex' justifyContent='center' p={3}>
                    <CircularProgress size={24} />
                </Box>
            </MainCard>
        )
    }

    if (error) {
        return (
            <MainCard disableHeader disableContentPadding border={false} shadow={false} content={false}>
                <Stack spacing={3} sx={{ p: 2 }}>
                    <Typography color='error'>{t('common.error', 'Error loading entities')}</Typography>
                    <Button variant='outlined' onClick={() => navigate('/metaverses')}>
                        {t('common.back')}
                    </Button>
                </Stack>
            </MainCard>
        )
    }

    return (
        <MainCard disableHeader disableContentPadding border={false} shadow={false} content={false}>
            <Stack spacing={3} sx={{ p: 2 }}>
                <ViewHeader
                    title={t('metaverses.entities.title', 'Сущности')}
                    search={true}
                    searchPlaceholder={t('common.search', 'Search')}
                    onSearchChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setSearch(e.target.value)}
                >
                    <ToolbarControls
                        viewToggleEnabled
                        viewMode={viewType}
                        onViewModeChange={setViewType}
                        primaryAction={
                            canCreateContent
                                ? { label: t('common.add', 'Добавить'), onClick: handleAddEntity, startIcon: <AddRoundedIcon /> }
                                : undefined
                        }
                    />
                </ViewHeader>

                {/* Entities list */}
                <Box>
                    {entities.length === 0 ? (
                        <Box textAlign='center' p={3}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('metaverses.entities.empty', 'Сущностей пока нет')}
                            </Typography>
                        </Box>
                    ) : viewType === 'card' ? (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                gap: 2
                            }}
                        >
                            {filteredEntities.map((entity) => (
                                    <ItemCard
                                        key={entity.id}
                                        data={entity}
                                        images={[]}
                                        onClick={() => navigate(`/metaverses/${metaverseId}/entities/${entity.id}`)}
                                        sx={{
                                            cursor: 'pointer',
                                            '&:hover': {
                                                boxShadow: 3
                                            }
                                        }}
                                    />
                                ))}
                        </Box>
                    ) : (
                        <Box>
                            {/* Table view can be implemented here */}
                            <Typography>Table view for entities (TODO)</Typography>
                        </Box>
                    )}
                </Box>
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
        </MainCard>
    )
}

export default EntityList
