import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import ARViewPage from './ARViewPage'
import PlayCanvasViewPage from './PlayCanvasViewPage'

/**
 * Universal dispatcher component for public flow viewing
 * Determines which technology (AR.js, PlayCanvas, etc.) to display
 * based on the chatbotConfig.isPublic flags
 */
const PublicFlowView: React.FC = () => {
    const { flowId, canvasId } = useParams<{ flowId?: string; canvasId?: string }>()
    const { t } = useTranslation('publish')

    const [activeTechnology, setActiveTechnology] = useState<string>('')
    const [flowConfig, setFlowConfig] = useState<any>(null)
    const [flowData, setFlowData] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string>('')

    useEffect(() => {
        const loadPublicFlow = async () => {
            try {
                setLoading(true)
                setError('')

                // Determine the ID to use (priority: canvasId > flowId)
                const targetId = canvasId || flowId
                if (!targetId) {
                    throw new Error('Canvas/Flow ID not provided')
                }

                console.log('🔍 [PublicFlowView] Loading public flow for ID:', targetId, {
                    canvasId,
                    flowId,
                    targetId
                })

                const response = await fetch(`/api/v1/publish/canvas/public/${targetId}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch canvas data: ${response.status}`)
                }
                const canvas = await response.json()
                console.log('📡 [PublicFlowView] Canvas data received from publication API:', {
                    id: canvas.canvasId || canvas.currentCanvasId,
                    projectName: canvas.projectName,
                    hasFlowData: !!canvas.flowData
                })

                // Handle different response formats
                let chatbotConfig: Record<string, any> = {}
                let flowDataContent = ''

                if (canvas.flowData) {
                    // New Canvas API format
                    flowDataContent = canvas.flowData
                    // For new API, we might need to parse config from flowData or use separate config
                    if (canvas.libraryConfig || canvas.renderConfig || canvas.playcanvasConfig) {
                        // Reconstruct chatbotConfig from separate configs
                        if (canvas.renderConfig || canvas.libraryConfig) {
                            chatbotConfig.arjs = {
                                ...canvas.renderConfig,
                                libraryConfig: canvas.libraryConfig,
                                isPublic: true // Assume public if we got the data
                            }
                        }
                        if (canvas.playcanvasConfig) {
                            chatbotConfig.playcanvas = {
                                ...canvas.playcanvasConfig,
                                isPublic: true // Assume public if we got the data
                            }
                        }
                    }
                }

                console.log('🔧 [PublicFlowView] Parsed chatbotConfig:', chatbotConfig)

                // Find which technology is published
                const activeTech = Object.keys(chatbotConfig).find((tech) => chatbotConfig[tech]?.isPublic === true)

                console.log('🎯 [PublicFlowView] Active technology found:', activeTech)

                if (!activeTech) {
                    throw new Error('Application is not published or not found')
                } else {
                    setActiveTechnology(activeTech)
                    setFlowConfig(chatbotConfig[activeTech])
                    setFlowData(flowDataContent)
                }
            } catch (err: any) {
                console.error('💥 [PublicFlowView] Error loading public flow:', err)
                setError(err.message || 'Failed to load application')
            } finally {
                setLoading(false)
            }
        }

        loadPublicFlow()
    }, [flowId, canvasId])

    // Loading state
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

    // Error state
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

    // Technology dispatcher
    console.log('🚀 [PublicFlowView] Rendering technology:', activeTechnology)

    switch (activeTechnology) {
        case 'arjs':
            return <ARViewPage />
        case 'playcanvas':
            return <PlayCanvasViewPage flowData={flowData} config={flowConfig} />
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
                            Unsupported Technology
                        </Typography>
                        <Typography variant='body1'>Technology &quot;{activeTechnology}&quot; is not supported yet.</Typography>
                    </Alert>
                </Box>
            )
    }
}

export default PublicFlowView
