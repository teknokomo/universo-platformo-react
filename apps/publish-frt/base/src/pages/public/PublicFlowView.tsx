import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
// No need for chatflowsApi import - using direct fetch like ARViewPage
import ARViewPage from './ARViewPage'
import PlayCanvasViewPage from './PlayCanvasViewPage'

/**
 * Universal dispatcher component for public flow viewing
 * Determines which technology (AR.js, PlayCanvas, etc.) to display
 * based on the chatbotConfig.isPublic flags
 */
const PublicFlowView: React.FC = () => {
    const { flowId } = useParams<{ flowId: string }>()
    const { t } = useTranslation()

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

                if (!flowId) {
                    throw new Error('Flow ID not provided')
                }

                console.log('🔍 [PublicFlowView] Loading public flow for ID:', flowId)

                // Get chatflow data from public API using direct fetch
                const response = await fetch(`/api/v1/public-chatflows/${flowId}`)

                if (!response.ok) {
                    throw new Error(`Failed to fetch chatflow data: ${response.status}`)
                }

                const chatflow = await response.json()
                console.log('📡 [PublicFlowView] Chatflow data received:', {
                    id: chatflow.id,
                    name: chatflow.name,
                    hasFlowData: !!chatflow.flowData,
                    hasChatbotConfig: !!chatflow.chatbotConfig,
                    isPublic: chatflow.isPublic
                })

                // Parse chatbotConfig to find active technology
                let chatbotConfig: Record<string, any> = {}
                if (chatflow.chatbotConfig) {
                    try {
                        chatbotConfig = JSON.parse(chatflow.chatbotConfig)
                    } catch (parseError) {
                        console.error('❌ [PublicFlowView] Failed to parse chatbotConfig:', parseError)
                    }
                }

                console.log('🔧 [PublicFlowView] Parsed chatbotConfig:', chatbotConfig)

                // Find which technology is published
                const activeTech = Object.keys(chatbotConfig).find((tech) => chatbotConfig[tech]?.isPublic === true)

                console.log('🎯 [PublicFlowView] Active technology found:', activeTech)

                if (!activeTech) {
                    // Check for legacy isPublic flag (backward compatibility)
                    if (chatflow.isPublic) {
                        console.log('🔄 [PublicFlowView] Using legacy isPublic flag, defaulting to AR.js')
                        setActiveTechnology('arjs')
                        setFlowConfig({}) // Empty config for legacy support
                        setFlowData(chatflow.flowData || '')
                    } else {
                        throw new Error('Application is not published or not found')
                    }
                } else {
                    setActiveTechnology(activeTech)
                    setFlowConfig(chatbotConfig[activeTech])
                    setFlowData(chatflow.flowData || '')
                }
            } catch (err: any) {
                console.error('💥 [PublicFlowView] Error loading public flow:', err)
                setError(err.message || 'Failed to load application')
            } finally {
                setLoading(false)
            }
        }

        loadPublicFlow()
    }, [flowId])

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
                    {t('common.loading', 'Loading application...')}
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
                        Application Not Available
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
