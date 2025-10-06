import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Breadcrumbs, Card, CircularProgress, Link, Stack, Typography, Button, Tabs, Tab, Box } from '@mui/material'
import { IconArrowLeft, IconPlus } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// ui imports
import ErrorBoundary from '@ui/ErrorBoundary'
import APIEmptySVG from '@ui/assets/images/api_empty.svg'

import { useApi } from '../hooks/useApi'
import * as domainsApi from '../api/domains'
import { Domain, Resource } from '../types'
import ResourceDialog from './ResourceDialog'

interface TabPanelProps {
    children?: React.ReactNode
    index: number
    value: number
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props

    return (
        <div role='tabpanel' hidden={value !== index} id={`domain-tabpanel-${index}`} aria-labelledby={`domain-tab-${index}`} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    )
}

function a11yProps(index: number) {
    return {
        id: `domain-tab-${index}`,
        'aria-controls': `domain-tabpanel-${index}`
    }
}

const DomainDetail: React.FC = () => {
    const { domainId, clusterId } = useParams<{ domainId: string; clusterId?: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('resources')

    const { request: getDomain } = useApi(domainsApi.getDomain)
    const { request: getDomainResources } = useApi(domainsApi.getDomainResources)

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [domain, setDomain] = useState<Domain | null>(null)
    const [resources, setResources] = useState<Resource[]>([])
    const [tabValue, setTabValue] = useState(0)
    const [resourceDialogOpen, setResourceDialogOpen] = useState(false)

    useEffect(() => {
        const fetch = async () => {
            if (!domainId) return
            try {
                setLoading(true)
                setError(null)
                const [domainRes, resourcesRes] = await Promise.all([getDomain(domainId), getDomainResources(domainId)])
                setDomain(domainRes)
                setResources(resourcesRes || [])
            } catch (err: any) {
                setError(err)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [domainId, getDomain, getDomainResources])

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue)
    }

    const handleAddResource = () => {
        setResourceDialogOpen(true)
    }

    const handleResourceDialogSave = () => {
        setResourceDialogOpen(false)
        // Refresh resources list
        if (domainId) {
            getDomainResources(domainId)
                .then((resourcesRes) => setResources(resourcesRes || []))
                .catch((err) => console.error('Failed to refresh resources', err))
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
                            to={clusterId ? `/clusters/${clusterId}/domains` : '/domains'}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <IconArrowLeft size={16} />
                            {t('domains.title')}
                        </Link>
                        <Typography color='text.primary'>{domain?.name || t('domains.detail.info')}</Typography>
                    </Breadcrumbs>

                    {isLoading ? (
                        <Stack direction='row' alignItems='center' justifyContent='center' sx={{ py: 6 }}>
                            <CircularProgress size={24} />
                        </Stack>
                    ) : (
                        <>
                            <Typography variant='h4' gutterBottom>
                                {domain?.name}
                            </Typography>
                            <Typography variant='body1' color='text.secondary'>
                                {domain?.description || '—'}
                            </Typography>

                            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                <Tabs value={tabValue} onChange={handleTabChange} aria-label='domain tabs'>
                                    <Tab label={t('domains.detail.info')} {...a11yProps(0)} />
                                    <Tab label={t('domains.detail.resources')} {...a11yProps(1)} />
                                </Tabs>
                            </Box>

                            <TabPanel value={tabValue} index={0}>
                                <Stack spacing={2}>
                                    <Typography variant='h6'>{t('domains.detail.info')}</Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {domain?.description || '—'}
                                    </Typography>
                                </Stack>
                            </TabPanel>

                            <TabPanel value={tabValue} index={1}>
                                <Stack spacing={2}>
                                    <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                        <Typography variant='h6'>{t('domains.detail.resources')}</Typography>
                                        <Button variant='contained' startIcon={<IconPlus size={16} />} onClick={handleAddResource}>
                                            {t('resources.list.addNew')}
                                        </Button>
                                    </Stack>
                                    <Box>
                                        {resources.length === 0 ? (
                                            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                                <Box sx={{ p: 2, height: 'auto' }}>
                                                    <img
                                                        style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                        src={APIEmptySVG}
                                                        alt='No Resources'
                                                    />
                                                </Box>
                                                <div>{t('resources.list.noResourcesYet')}</div>
                                            </Stack>
                                        ) : (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={2}>
                                                {resources.map((resource) => (
                                                    <Card
                                                        key={resource.id}
                                                        sx={{ p: 2, cursor: 'pointer' }}
                                                        onClick={() =>
                                                            navigate(
                                                                clusterId
                                                                    ? `/clusters/${clusterId}/resources/${resource.id}`
                                                                    : `/resources/${resource.id}`
                                                            )
                                                        }
                                                    >
                                                        <Typography variant='h6'>{resource.name}</Typography>
                                                        <Typography variant='body2' color='text.secondary'>
                                                            {resource.description || '—'}
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
                        <Button variant='outlined' onClick={() => navigate(clusterId ? `/clusters/${clusterId}/domains` : '/domains')}>
                            {t('resources.common.back')}
                        </Button>
                    </Stack>
                </Stack>
            )}

            <ResourceDialog
                open={resourceDialogOpen}
                onClose={() => setResourceDialogOpen(false)}
                onSave={handleResourceDialogSave}
                clusterId={clusterId}
                defaultDomainId={domainId}
            />
        </Card>
    )
}

export default DomainDetail
