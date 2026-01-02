import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ILibraryConfig } from '@universo/types'
import ARViewPage from './ARViewPage'
import PlayCanvasViewPage from './PlayCanvasViewPage'

type PublishTechnology = 'arjs' | 'playcanvas'
type PublicationTechnology = PublishTechnology | 'generic'

type PublicationPayload = {
    flowData: any
    renderConfig?: Record<string, any> | null
    playcanvasConfig?: Record<string, any> | null
    libraryConfig?: ILibraryConfig | null
    projectName?: string
    canvasId?: string
    technology?: PublicationTechnology | null
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
                setError(t('publicFlow.errors.missingSlug', 'Slug is missing'))
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
                    canvasId: payload.canvasId,
                    technology: (payload.technology ?? null) as PublicationTechnology | null
                }

                const technologies: PublishTechnology[] = []
                if (nextPublication.playcanvasConfig) {
                    technologies.push('playcanvas')
                }
                if (nextPublication.renderConfig) {
                    technologies.push('arjs')
                }

                if (technologies.length === 0) {
                    throw new Error(t('publicFlow.errors.noPublicTech', 'No published technologies are available'))
                }

                const normalizedTechnology =
                    nextPublication.technology === 'arjs' || nextPublication.technology === 'playcanvas' ? nextPublication.technology : null

                const preferredTech =
                    normalizedTechnology && technologies.includes(normalizedTechnology) ? normalizedTechnology : technologies[0]

                setPublication(nextPublication)
                setActiveTechnology(preferredTech)
            } catch (loadError) {
                const message =
                    loadError instanceof Error && loadError.message
                        ? loadError.message
                        : t('publicFlow.errors.loadFailed', 'Failed to load publication')
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
                    {t('general.loading', 'Loading application...')}
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
                        {t('general.applicationNotAvailable', 'Application is unavailable')}
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
                    slug={slug}
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
                            {t('publicFlow.errors.unsupportedTechnology', 'Technology is not supported')}
                        </Typography>
                        <Typography variant='body1'>
                            {t('publicFlow.errors.noRenderer', 'No compatible viewer is available for this publication.')}
                        </Typography>
                    </Alert>
                </Box>
            )
    }
}

export default PublicFlowView
