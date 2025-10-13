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
import { Metaverse, Section } from '../types'
import SectionDialog from './SectionDialog'

const SectionsList = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')

    const [metaverse, setMetaverse] = useState<Metaverse | null>(null)
    const [sections, setSections] = useState<Section[]>([])
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [viewType, setViewType] = useState<'card' | 'list'>('card')
    const [search, setSearch] = useState('')
    const [isSectionDialogOpen, setSectionDialogOpen] = useState(false)
    const [selectedSection, setSelectedSection] = useState<Section | null>(null)

    const normalizedSearch = useMemo(() => search.trim().toLowerCase(), [search])
    const filteredSections = useMemo(() => {
        if (!normalizedSearch) {
            return sections
        }

        return sections.filter((section) =>
            `${section.name ?? ''} ${section.description ?? ''}`.toLowerCase().includes(normalizedSearch)
        )
    }, [sections, normalizedSearch])

    const { request: getMetaverse } = useApi(metaversesApi.getMetaverse)
    const { request: getMetaverseSections } = useApi(metaversesApi.getMetaverseSections)

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

            const [metaverseResult, sectionsResult] = await Promise.all([getMetaverse(metaverseId), getMetaverseSections(metaverseId)])

            setMetaverse(metaverseResult)
            setSections(Array.isArray(sectionsResult) ? sectionsResult : [])
        } catch (err: any) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    const handleAddSection = () => {
        setSelectedSection(null)
        setSectionDialogOpen(true)
    }

    const handleSectionDialogSave = () => {
        setSectionDialogOpen(false)
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
                    <Typography color='error'>{t('common.error', 'Error loading sections')}</Typography>
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
                    title={t('metaverses.sections.title', 'Секции')}
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
                                ? { label: t('common.add', 'Добавить'), onClick: handleAddSection, startIcon: <AddRoundedIcon /> }
                                : undefined
                        }
                    />
                </ViewHeader>

                {/* Sections list */}
                <Box>
                    {sections.length === 0 ? (
                        <Box textAlign='center' p={3}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('metaverses.sections.empty', 'Секций пока нет')}
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
                            {filteredSections.map((section) => (
                                    <ItemCard
                                        key={section.id}
                                        data={section}
                                        images={[]}
                                        onClick={() => navigate(`/metaverses/${metaverseId}/sections/${section.id}`)}
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
                            <Typography>Table view for sections (TODO)</Typography>
                        </Box>
                    )}
                </Box>
            </Stack>

            {isSectionDialogOpen && (
                <SectionDialog
                    open={isSectionDialogOpen}
                    onClose={() => setSectionDialogOpen(false)}
                    onSave={handleSectionDialogSave}
                    section={selectedSection}
                    metaverseId={metaverseId}
                />
            )}
        </MainCard>
    )
}

export default SectionsList
