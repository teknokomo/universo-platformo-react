import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Breadcrumbs, Card, CircularProgress, Link, Stack, Typography, Button } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import { useTranslation } from 'react-i18next'

// ui imports
import ErrorBoundary from '@ui/ErrorBoundary'

import { useApi } from '../hooks/useApi'
import * as entitiesApi from '../api/entities'
import { Entity } from '../types'

const EntityDetail: React.FC = () => {
    const { entityId, metaverseId } = useParams<{ entityId: string; metaverseId?: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')

    const { request: getEntity } = useApi(entitiesApi.getEntity)

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<any>(null)
    const [entity, setEntity] = useState<Entity | null>(null)

    useEffect(() => {
        const fetch = async () => {
            if (!entityId) return
            try {
                setLoading(true)
                setError(null)
                const res = await getEntity(entityId)
                setEntity(res)
            } catch (err: any) {
                setError(err)
            } finally {
                setLoading(false)
            }
        }
        fetch()
    }, [entityId, getEntity])

    return (
        <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', p: 1.25 }}>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack spacing={2}>
                    <Breadcrumbs aria-label='breadcrumb'>
                        <Link
                            component={RouterLink}
                            to={metaverseId ? `/metaverses/${metaverseId}/entities` : '/entities'}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <ArrowBackRoundedIcon fontSize='small' />
                            {t('entities.title')}
                        </Link>
                        <Typography color='text.primary'>{entity?.name || t('entities.detail.info')}</Typography>
                    </Breadcrumbs>

                    {isLoading ? (
                        <Stack direction='row' alignItems='center' justifyContent='center' sx={{ py: 6 }}>
                            <CircularProgress size={24} />
                        </Stack>
                    ) : (
                        <>
                            <Typography variant='h4' gutterBottom>
                                {entity?.name}
                            </Typography>
                            <Typography variant='body1' color='text.secondary'>
                                {entity?.description || '\u2014'}
                            </Typography>
                        </>
                    )}

                    <Stack direction='row' spacing={1}>
                        <Button variant='outlined' onClick={() => navigate(-1)}>
                            {t('common.back')}
                        </Button>
                    </Stack>
                </Stack>
            )}
        </Card>
    )
}

export default EntityDetail
