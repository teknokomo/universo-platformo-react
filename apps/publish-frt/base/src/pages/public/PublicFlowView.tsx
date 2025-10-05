import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ILibraryConfig } from '@universo-platformo/types'
import ARViewPage from './ARViewPage'
import PlayCanvasViewPage from './PlayCanvasViewPage'

type PublishTechnology = 'arjs' | 'playcanvas'

type PublicationPayload = {
    flowData: any
    renderConfig?: Record<string, any> | null
    playcanvasConfig?: Record<string, any> | null
    libraryConfig?: ILibraryConfig | null
    projectName?: string
    canvasId?: string
}

const PublicFlowView: React.FC = () => {
    const { slug } = useParams<{ slug?: string }>()
    const { t } = useTranslation('publish')

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')
    const [publication, setPublication] = useState<PublicationPayload | null>(null)
    const [activeTechnology, setActiveTechnology] = useState<PublishTechnology | ''>('')

    useEffect(() => {
        const loadPublication = async () => {
            if (!slug) {
                setError(t('publish.publicFlow.errors.missingSlug', 'Slug не указан'))
                setLoading(false)
                return
            }

            setLoading(true)
            setError('')

            try {
                const response = await fetch(`/api/v1/publish/public/${slug}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch publication: ${response.status}`)
                }

                const payload = await response.json()
                if (!payload?.success || !payload?.flowData) {
                    throw new Error(payload?.error || 'Publication data not found')
                }

                const nextPublication: PublicationPayload = {
                    flowData: payload.flowData,
                    renderConfig: payload.renderConfig,
                    playcanvasConfig: payload.playcanvasConfig,
                    libraryConfig: (payload.libraryConfig ?? null) as ILibraryConfig | null,
                    projectName: payload.projectName,
                    canvasId: payload.canvasId
                }

                const technologies: PublishTechnology[] = []
                if (payload.renderConfig || payload.libraryConfig) {
                    technologies.push('arjs')
                }
                if (payload.playcanvasConfig) {
                    technologies.push('playcanvas')
                }

                if (technologies.length === 0) {
                    throw new Error(t('publish.publicFlow.errors.noPublicTech', 'Нет опубликованных технологий'))
                }

                const preferredTech = technologies[0]

                setPublication(nextPublication)
                setActiveTechnology(preferredTech)
            } catch (loadError) {
                const message =
                    loadError instanceof Error && loadError.message
                        ? loadError.message
                        : t('publish.publicFlow.errors.loadFailed', 'Не удалось загрузить публикацию')
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        loadPublication()
    }, [slug, t])

    if (loading) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5'
                }}
            >
                <CircularProgress size={60} />
                <Typography variant='h6' sx={{ mt: 2, color: '#666' }}>
                    {t('general.loading', 'Загрузка приложения...')}
                </Typography>
            </Box>
        )
    }

    if (error) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                    p: 3
                }}
            >
                <Alert severity='error' sx={{ maxWidth: 600 }}>
                    <Typography variant='h6' gutterBottom>
                        {t('general.applicationNotAvailable', 'Приложение недоступно')}
                    </Typography>
                    <Typography variant='body1'>{error}</Typography>
                </Alert>
            </Box>
        )
    }

    if (!publication) {
        return null
    }

    switch (activeTechnology) {
        case 'arjs':
            return (
                <ARViewPage
                    flowData={publication.flowData}
                    renderConfig={publication.renderConfig}
                    libraryConfig={publication.libraryConfig}
                    projectName={publication.projectName}
                    canvasId={publication.canvasId}
                />
            )
        case 'playcanvas':
            return (
                <PlayCanvasViewPage
                    flowData={publication.flowData}
                    config={publication.playcanvasConfig}
                    projectName={publication.projectName}
                />
            )
        default:
            return (
                <Box
                    sx={{
                        width: '100%',
                        height: '100vh',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f5f5f5',
                        p: 3
                    }}
                >
                    <Alert severity='warning' sx={{ maxWidth: 600 }}>
                        <Typography variant='h6' gutterBottom>
                            {t('publish.publicFlow.errors.unsupportedTechnology', 'Технология не поддерживается')}
                        </Typography>
                        <Typography variant='body1'>{t('publish.publicFlow.errors.noRenderer', 'Нет подходящего просмотрщика для этой публикации.')}</Typography>
                    </Alert>
                </Box>
            )
    }
}

export default PublicFlowView
