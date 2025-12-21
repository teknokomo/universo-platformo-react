import { useParams } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert, Grid, Button, Paper, Chip } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded'
import StorageRoundedIcon from '@mui/icons-material/StorageRounded'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'

// project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG, StatCard, HighlightedCard } from '@universo/template-mui'

import * as metahubsApi from '../api/metahubs'
import { metahubsQueryKeys } from '../api/queryKeys'

/**
 * MetaHub Board Page
 *
 * Displays overview dashboard for a metahub with:
 * - MetaHub info (name, description)
 * - Entity definitions list
 * - Quick statistics
 *
 * Layout:
 * - Desktop: Stats cards in row, entities list below
 * - Mobile: Stacked layout
 */
const MetahubBoard = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')

    // Fetch metahub details
    const {
        data: metahub,
        isLoading: isLoadingMetahub,
        error: metahubError
    } = useQuery({
        queryKey: metahubsQueryKeys.detail(metahubId || ''),
        queryFn: () => metahubsApi.getMetahub(metahubId!),
        enabled: Boolean(metahubId)
    })

    // Fetch entities for this metahub
    const {
        data: entitiesData,
        isLoading: isLoadingEntities,
        error: entitiesError
    } = useQuery({
        queryKey: metahubsQueryKeys.entities(metahubId || ''),
        queryFn: () => metahubsApi.listEntities(metahubId!),
        enabled: Boolean(metahubId)
    })

    const isLoading = isLoadingMetahub || isLoadingEntities
    const error = metahubError || entitiesError
    const entities = entitiesData?.items ?? []

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('board.loading', 'Loading dashboard...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (error || !metahub) {
        const errorMessage = error instanceof Error ? error.message : t('errors.loadFailed')

        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState image={APIEmptySVG} imageAlt='Error loading metahub' title={t('errors.loadFailed')} />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    // Calculate statistics
    const totalEntities = entities.length
    const totalFields = entities.reduce((sum, entity) => sum + (entity.fields?.length || 0), 0)

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={metahub.name}
                    description={metahub.description || t('board.defaultDescription', 'MetaHub overview and entity definitions')}
                    search={false}
                />
            </Box>

            {/* Dashboard Grid */}
            <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                <Grid container spacing={2} columns={12}>
                    {/* Overview Section */}
                    <Grid size={12}>
                        <Typography component='h2' variant='h6'>
                            {t('board.overview')}
                        </Typography>
                    </Grid>

                    {/* Entities Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                        <StatCard
                            title={t('entities')}
                            value={totalEntities}
                            interval={t('board.entitiesInterval', 'Total defined')}
                            description={t('board.entitiesDescription', 'Entity type definitions')}
                            trend='neutral'
                            data={Array(30).fill(totalEntities)}
                        />
                    </Grid>

                    {/* Fields Count */}
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                        <StatCard
                            title={t('fields')}
                            value={totalFields}
                            interval={t('board.fieldsInterval', 'Across all entities')}
                            description={t('board.fieldsDescription', 'Field definitions')}
                            trend='neutral'
                            data={Array(30).fill(totalFields)}
                        />
                    </Grid>

                    {/* Quick Actions Card */}
                    <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
                        <HighlightedCard>
                            <Stack spacing={2} sx={{ p: 2 }}>
                                <Typography variant='subtitle1' fontWeight={600}>
                                    {t('board.quickActions', 'Quick Actions')}
                                </Typography>
                                <Button
                                    variant='outlined'
                                    size='small'
                                    startIcon={<AddRoundedIcon />}
                                    onClick={() => {
                                        /* TODO: Open create entity dialog */
                                    }}
                                >
                                    {t('entity.create')}
                                </Button>
                            </Stack>
                        </HighlightedCard>
                    </Grid>

                    {/* Entities Section */}
                    <Grid size={12}>
                        <Typography component='h2' variant='h6' sx={{ mt: 2 }}>
                            {t('board.entitiesSection')}
                        </Typography>
                    </Grid>

                    {entities.length === 0 ? (
                        <Grid size={12}>
                            <Paper sx={{ p: 4, textAlign: 'center' }}>
                                <DataObjectRoundedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                <Typography variant='body1' color='text.secondary'>
                                    {t('board.noEntities')}
                                </Typography>
                                <Button variant='contained' sx={{ mt: 2 }} startIcon={<AddRoundedIcon />}>
                                    {t('entity.create')}
                                </Button>
                            </Paper>
                        </Grid>
                    ) : (
                        entities.map((entity) => (
                            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={entity.id}>
                                <Paper
                                    sx={{
                                        p: 2,
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: 'action.hover' }
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <Stack direction='row' alignItems='center' spacing={1}>
                                            <StorageRoundedIcon color='primary' />
                                            <Typography variant='subtitle1' fontWeight={600}>
                                                {entity.name}
                                            </Typography>
                                        </Stack>
                                        <Typography variant='caption' color='text.secondary'>
                                            {entity.codename}
                                        </Typography>
                                        {entity.description && (
                                            <Typography variant='body2' color='text.secondary' noWrap>
                                                {entity.description}
                                            </Typography>
                                        )}
                                        <Stack direction='row' spacing={1} flexWrap='wrap'>
                                            <Chip
                                                size='small'
                                                label={t('field.count', {
                                                    count: entity.fields?.length || 0,
                                                    defaultValue: '{{count}} fields'
                                                })}
                                                variant='outlined'
                                            />
                                        </Stack>
                                    </Stack>
                                </Paper>
                            </Grid>
                        ))
                    )}
                </Grid>
            </Box>
        </Stack>
    )
}

export default MetahubBoard
