import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Card, Typography, Button, Stack, CircularProgress } from '@mui/material'
import { useTranslation } from 'react-i18next'

// project imports
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { useApi } from '../hooks/useApi'
import * as metaversesApi from '../api/metaverses'
import { Metaverse } from '../types'

const MetaverseBoard = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation('metaverses')

    const [metaverse, setMetaverse] = useState<Metaverse | null>(null)
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState<unknown>(null)

    const { request: getMetaverse } = useApi<Metaverse, [string]>(metaversesApi.getMetaverse)

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

            const metaverseResult = await getMetaverse(metaverseId)
            if (metaverseResult) {
                setMetaverse(metaverseResult)
            }
        } catch (err: unknown) {
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    if (isLoading) {
        return (
            <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', width: '100%' }}>
                <Box display='flex' justifyContent='center' p={3}>
                    <CircularProgress size={24} />
                </Box>
            </Card>
        )
    }

    if (error) {
        return (
            <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', width: '100%' }}>
                <Stack spacing={3} sx={{ p: 2 }}>
                    <Typography color='error'>{t('common.error', 'Error loading metaverse')}</Typography>
                    <Button variant='outlined' onClick={() => navigate('/metaverses')}>
                        {t('common.back')}
                    </Button>
                </Stack>
            </Card>
        )
    }

    return (
        <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', width: '100%' }}>
            <Stack spacing={3} sx={{ p: 2 }}>
                <ViewHeader
                    title={metaverse?.name || t('detail.title')}
                    description={
                        metaverse?.description || t('board.description', 'Здесь будет аналитика и статистика кластера (в разработке)')
                    }
                    search={false}
                />

                {/* Main board content */}
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant='h4' sx={{ mb: 2 }}>
                        {t('board.title', 'Метаверсборд')}
                    </Typography>
                    <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
                        {t('board.description', 'Здесь будет аналитика и статистика кластера (в разработке)')}
                    </Typography>

                    <Button variant='outlined' onClick={() => navigate('/metaverses')} sx={{ mt: 2 }}>
                        {t('common.back', 'Назад')}
                    </Button>
                </Box>
            </Stack>
        </Card>
    )
}

export default MetaverseBoard
