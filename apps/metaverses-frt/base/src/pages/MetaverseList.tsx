import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Card, Button, Chip } from '@mui/material'
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@mui/material/styles'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
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
import * as metaversesApi from '../api/metaverses'
import { Metaverse, MetaverseRole } from '../types'
import MetaverseDialog from './MetaverseDialog'
import metaverseActions from './metaverseActions'

const MetaverseList = () => {
    const navigate = useNavigate()
    const theme = useTheme()
    const { t } = useTranslation('metaverses')
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [search, setSearch] = useState('')
    const [view, setView] = useState(localStorage.getItem('entitiesMetaverseDisplayStyle') || 'card')

    // State management following Uniks pattern
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [metaverses, setMetaverses] = useState<Metaverse[]>([])
    // Aggregated counts come directly from backend list response now

    const { confirm } = useConfirm()

    const { request: loadMetaverses } = useApi(metaversesApi.listMetaverses)
    const updateMetaverseApi = useApi(metaversesApi.updateMetaverse)
    const deleteMetaverseApi = useApi(metaversesApi.deleteMetaverse)

    const fetchMetaverses = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const result = await loadMetaverses()
            const metaversesArray = Array.isArray(result) ? result : []
            setMetaverses(metaversesArray)
        } catch (err: any) {
            setError(err)
            setMetaverses([])
        } finally {
            setLoading(false)
        }
    }, [loadMetaverses])

    useEffect(() => {
        fetchMetaverses()
    }, [fetchMetaverses])

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
        const name = (data?.name || '').toLowerCase()
        const description = (data?.description || '').toLowerCase()
        const term = search.toLowerCase()
        return name.includes(term) || description.includes(term)
    }

    const updateFlowsApi = fetchMetaverses

    const roleLabel = useCallback(
        (role?: MetaverseRole) => (role ? t(`metaverses.roles.${role}`) : '—'),
        [t]
    )

    const metaverseColumns = useMemo(
        () => [
            {
                id: 'role',
                label: t('metaverses.table.role'),
                width: '20%',
                align: 'center',
                render: (row: Metaverse) => roleLabel(row.role)
            },
            {
                id: 'sections',
                label: t('metaverses.table.sections'),
                width: '20%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.sectionsCount === 'number' ? row.sectionsCount : '—')
            },
            {
                id: 'entities',
                label: t('metaverses.table.entities'),
                width: '20%',
                align: 'center',
                render: (row: Metaverse) => (typeof row.entitiesCount === 'number' ? row.entitiesCount : '—')
            }
        ],
        [roleLabel, t]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetaverseContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    try {
                        await updateMetaverseApi.request(id, patch)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                },
                deleteEntity: async (id: string) => {
                    try {
                        await deleteMetaverseApi.request(id)
                    } catch (err: any) {
                        setError(err)
                        throw err
                    }
                }
            },
            helpers: {
                refreshList: async () => {
                    await fetchMetaverses()
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
        [confirm, deleteMetaverseApi, fetchMetaverses, setError, updateMetaverseApi]
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
                                    {Array.isArray(metaverses) &&
                                        metaverses
                                            .filter(filterMetaverses)
                                            .map((metaverse) => (
                                                <Stack key={metaverse.id} spacing={1}>
                                                    <ItemCard
                                                        data={metaverse}
                                                        images={images[metaverse.id] || []}
                                                        onClick={() => goToMetaverse(metaverse)}
                                                    />
                                                    {metaverse.role && (
                                                        <Chip
                                                            size='small'
                                                            variant='outlined'
                                                            color='primary'
                                                            label={roleLabel(metaverse.role)}
                                                            sx={{ alignSelf: 'flex-start' }}
                                                        />
                                                    )}
                                                </Stack>
                                            ))}
                                </Box>
                            ) : (
                                <FlowListTable
                                    data={Array.isArray(metaverses) ? metaverses : []}
                                    images={images}
                                    isLoading={isLoading}
                                    filterFunction={filterMetaverses}
                                    updateFlowsApi={updateFlowsApi}
                                    setError={setError}
                                    getRowLink={(row: Metaverse) => (row?.id ? `/metaverses/${row.id}` : undefined)}
                                    customColumns={metaverseColumns}
                                    renderActions={(row: Metaverse) => {
                                        const descriptors = metaverseActions.filter((descriptor) => {
                                            if (descriptor.id === 'rename' || descriptor.id === 'delete') {
                                                return row.permissions?.manageMetaverse
                                            }
                                            return true
                                        })

                                        if (!descriptors.length) return null

                                        return (
                                            <BaseEntityMenu
                                                entity={row}
                                                entityKind='metaverse'
                                                descriptors={descriptors}
                                                namespace='flowList'
                                                createContext={createMetaverseContext}
                                            />
                                        )
                                    }}
                                />
                            )}
                        </>
                    )}
                </Stack>
            )}

            <MetaverseDialog open={isDialogOpen} onClose={handleDialogClose} onSave={handleDialogSave} metaverse={selectedMetaverse} />
            <ConfirmDialog />
        </Card>
    )
}

export default MetaverseList
