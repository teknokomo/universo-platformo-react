import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Breadcrumbs, Card, CircularProgress, Link, Stack, Typography, Button, Tabs, Tab, Box } from '@mui/material'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// ui imports
import ErrorBoundary from '@ui/ErrorBoundary'
import APIEmptySVG from '@ui/assets/images/api_empty.svg'

import { useApi } from '../hooks/useApi'
import * as sectionsApi from '../api/sections'
import { Section, Entity } from '../types'
import EntityDialog from './EntityDialog'

interface TabPanelProps {
    children?: React.ReactNode
    index: number
    value: number
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props

    return (
        <div role='tabpanel' hidden={value !== index} id={`section-tabpanel-${index}`} aria-labelledby={`section-tab-${index}`} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    )
}

function a11yProps(index: number) {
    return {
        id: `section-tab-${index}`,
        'aria-controls': `section-tabpanel-${index}`
    }
}

const SectionDetail: React.FC = () => {
    const { sectionId, metaverseId } = useParams<{ sectionId: string; metaverseId?: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('entities')

    const { request: getSection } = useApi(sectionsApi.getSection)
    const { request: getSectionEntities } = useApi(sectionsApi.getSectionEntities)

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [section, setSection] = useState<Section | null>(null)
    const [entities, setEntities] = useState<Entity[]>([])
    const [tabValue, setTabValue] = useState(0)
    const [entityDialogOpen, setEntityDialogOpen] = useState(false)

    useEffect(() => {
        const fetch = async () => {
            if (!sectionId) return
            try {
                setLoading(true)
                setError(null)
                const [sectionRes, entitiesRes] = await Promise.all([getSection(sectionId), getSectionEntities(sectionId)])
                setSection(sectionRes)
                setEntities(entitiesRes || [])
            } catch (err: any) {
                setError(err)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [sectionId, getSection, getSectionEntities])

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue)
    }

    const handleAddEntity = () => {
        setEntityDialogOpen(true)
    }

    const handleEntityDialogSave = () => {
        setEntityDialogOpen(false)
        // Refresh entities list
        if (sectionId) {
            getSectionEntities(sectionId)
                .then((entitiesRes) => setEntities(entitiesRes || []))
                .catch((err) => console.error('Failed to refresh entities', err))
        }
    }

    return (
        <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', p: 1.25 }}>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack spacing={2}>
                    <Breadcrumbs aria-label='breadcrumb'>
                        <Link
                            component={RouterLink}
                            to={metaverseId ? `/metaverses/${metaverseId}/sections` : '/sections'}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <IconArrowLeft size={16} />
                            {t('sections.title')}
                        </Link>
                        <Typography color='text.primary'>{section?.name || t('sections.detail.info')}</Typography>
                    </Breadcrumbs>

                    {isLoading ? (
                        <Stack direction='row' alignItems='center' justifyContent='center' sx={{ py: 6 }}>
                            <CircularProgress size={24} />
                        </Stack>
                    ) : (
                        <>
                            <Typography variant='h4' gutterBottom>
                                {section?.name}
                            </Typography>
                            <Typography variant='body1' color='text.secondary'>
                                {section?.description || '—'}
                            </Typography>

                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs value={tabValue} onChange={handleTabChange} aria-label='section tabs'>
                                    <Tab label={t('sections.detail.info')} {...a11yProps(0)} />
                                    <Tab label={t('sections.detail.entities')} {...a11yProps(1)} />
                                </Tabs>
                            </Box>

                            <TabPanel value={tabValue} index={0}>
                                <Stack spacing={2}>
                                    <Typography variant='h6'>{t('sections.detail.info')}</Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {section?.description || '—'}
                                    </Typography>
                                </Stack>
                            </TabPanel>

                            <TabPanel value={tabValue} index={1}>
                                <Stack spacing={2}>
                                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                        <Typography variant='h6'>{t('sections.detail.entities')}</Typography>
                                        <Button variant='contained' startIcon={<IconPlus size={16} />} onClick={handleAddEntity}>
                                            {t('entities.list.addNew')}
                                        </Button>
                                    </Stack>
                                    <Box>
                                        {entities.length === 0 ? (
                                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                                <Box sx={{ p: 2, height: 'auto' }}>
                                                    <img
                                                        style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                        src={APIEmptySVG}
                                                        alt='No Entities'
                                                    />
                                                </Box>
                                                <div>{t('entities.list.noEntitiesYet')}</div>
                                            </Stack>
                                        ) : (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={2}>
                                                {entities.map((entity) => (
                                                    <Card
                                                        key={entity.id}
                                                        sx={{ p: 2, cursor: 'pointer' }}
                                                        onClick={() =>
                                                            navigate(
                                                                metaverseId
                                                                    ? `/metaverses/${metaverseId}/entities/${entity.id}`
                                                                    : `/entities/${entity.id}`
                                                            )
                                                        }
                                                    >
                                                        <Typography variant='h6'>{entity.name}</Typography>
                                                        <Typography variant='body2' color='text.secondary'>
                                                            {entity.description || '—'}
                                                        </Typography>
                                                    </Card>
                                                ))}
                                            </Box>
                                        )}
                                    </Box>
                                </Stack>
                            </TabPanel>
                        </>
                    )}

                    <Stack direction='row' spacing={1}>
                        <Button
                            variant='outlined'
                            onClick={() => navigate(metaverseId ? `/metaverses/${metaverseId}/sections` : '/sections')}
                        >
                            {t('entities.common.back')}
                        </Button>
                    </Stack>
                </Stack>
            )}

            <EntityDialog
                open={entityDialogOpen}
                onClose={() => setEntityDialogOpen(false)}
                onSave={handleEntityDialogSave}
                metaverseId={metaverseId}
                defaultSectionId={sectionId}
            />
        </Card>
    )
}

export default SectionDetail
