import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { UPDLProcessor } from '../../builders/common/UPDLProcessor'
import { TemplateRegistry } from '../../builders/common/TemplateRegistry'

// Feature flag for backend fetch - set to false as default per user requirements
const ENABLE_BACKEND_FETCH = false

interface PlayCanvasViewPageProps {
    flowData?: string
    config?: any
}

/**
 * Page for viewing PlayCanvas applications in streaming generation mode
 */
const PlayCanvasViewPage: React.FC<PlayCanvasViewPageProps> = ({ flowData: propFlowData, config: propConfig }) => {
    // Support both URL params and props
    const { flowId, id } = useParams<{ flowId?: string; id?: string }>()
    const publicationId = flowId || id

    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [htmlContent, setHtmlContent] = useState<string>('')

    useEffect(() => {
        // Debug URL parameters
        console.log('🎮 [PlayCanvasViewPage] URL params:', { flowId, id, publicationId })
        console.log('🎮 [PlayCanvasViewPage] Props:', { hasFlowData: !!propFlowData, hasConfig: !!propConfig })

        const loadPlayCanvasSpace = async () => {
            try {
                setLoading(true)
                console.log('🎮 [PlayCanvasViewPage] Loading PlayCanvas space')

                let flowData: string
                let config: any

                // Use props if available, otherwise fetch from API (if enabled)
                if (propFlowData && propConfig) {
                    flowData = propFlowData
                    config = propConfig
                    console.log('🎮 [PlayCanvasViewPage] Using provided props data')
                } else if (ENABLE_BACKEND_FETCH && publicationId) {
                    console.log('🎮 [PlayCanvasViewPage] Fetching data for publicationId:', publicationId)

                    const response = await fetch(`/api/v1/publish/playcanvas/public/${publicationId}`)
                    if (!response.ok) {
                        throw new Error(`Failed to fetch publication data: ${response.status}`)
                    }

                    const publicationData = await response.json()
                    console.log('🎮 [PlayCanvasViewPage] API Response:', {
                        success: !!publicationData.success,
                        hasFlowData: !!publicationData?.flowData,
                        hasConfig: !!publicationData?.config
                    })

                    if (!publicationData.success || !publicationData.flowData) {
                        throw new Error('Publication data not found')
                    }

                    flowData = publicationData.flowData
                    config = publicationData.config || {}
                } else {
                    throw new Error('No flow data provided - component expects props or ENABLE_BACKEND_FETCH must be enabled')
                }

                // Process flow data using UPDLProcessor
                console.log('🔧 [PlayCanvasViewPage] Processing flow data with UPDLProcessor')
                const processedData = UPDLProcessor.processFlowData(flowData)

                console.log('🔧 [PlayCanvasViewPage] UPDLProcessor result:', {
                    hasUpdlSpace: !!processedData.updlSpace,
                    hasMultiScene: !!processedData.multiScene
                })

                // Generate HTML using TemplateRegistry
                console.log('🏗️ [PlayCanvasViewPage] Generating HTML with TemplateRegistry')
                const templateId = (config.templateId === 'mmoomm' ? 'mmoomm-playcanvas' : config.templateId) || 'mmoomm-playcanvas'
                const builder = TemplateRegistry.createBuilder(templateId)

                // Use default values from server environment when settings not configured
                const defaultColyseusSettings = {
                    serverHost: 'localhost', // Default from MULTIPLAYER_SERVER_HOST
                    serverPort: 2567,       // Default from MULTIPLAYER_SERVER_PORT
                    roomName: 'mmoomm_room'
                }

                const buildOptions = {
                    projectName: config.projectTitle || 'PlayCanvas Application',
                    libraryConfig: config.libraryConfig || { playcanvas: { version: '2.9.0' } },
                    demoMode: config.demoMode || 'off',
                    gameMode: config.gameMode || 'singleplayer',
                    multiplayer: config.colyseusSettings || defaultColyseusSettings
                }

                const generatedHTML = await builder.build(
                    {
                        updlSpace: processedData.updlSpace,
                        multiScene: processedData.multiScene
                    },
                    buildOptions
                )

                console.log('🏗️ [PlayCanvasViewPage] HTML generation completed:', {
                    htmlLength: generatedHTML?.length || 0,
                    hasHTML: !!generatedHTML
                })

                if (!generatedHTML) {
                    throw new Error('Failed to generate PlayCanvas HTML')
                }

                setHtmlContent(generatedHTML)
                setLoading(false)
            } catch (error) {
                console.error('💥 [PlayCanvasViewPage] Error loading PlayCanvas space:', error)
                setError(`Failed to load PlayCanvas application: ${(error as Error).message}`)
                setLoading(false)
            }
        }

        loadPlayCanvasSpace()
    }, [publicationId, propFlowData, propConfig])

    // Render iframe when HTML is ready
    useEffect(() => {
        if (htmlContent && !loading && !error) {
            console.log('🖼️ [PlayCanvasViewPage] Rendering HTML in iframe with srcDoc')

            const container = document.getElementById('playcanvas-container')
            if (container) {
                // Clear any existing content
                container.innerHTML = ''

                // Create iframe with srcDoc (modern approach)
                const iframe = document.createElement('iframe')
                iframe.style.width = '100%'
                iframe.style.height = '100%'
                iframe.style.border = 'none'
                iframe.title = 'PlayCanvas Application'
                iframe.srcdoc = htmlContent
                container.appendChild(iframe)

                console.log('📝 [PlayCanvasViewPage] HTML set via srcDoc')

                // Monitor iframe loading
                iframe.onload = () => {
                    console.log('✅ [PlayCanvasViewPage] Iframe loaded successfully')
                }
            } else {
                console.error('❌ [PlayCanvasViewPage] Container not found')
                setError('Failed to find PlayCanvas container')
            }
        }
    }, [htmlContent, loading, error])

    return (
        <Box
            sx={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {loading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 10,
                        color: 'white'
                    }}
                >
                    <CircularProgress color='primary' size={60} />
                    <Typography variant='h6' sx={{ mt: 2 }}>
                        {t('publish.playcanvas.loading', 'Loading PlayCanvas Application...')}
                    </Typography>
                </Box>
            )}

            {error && (
                <Alert severity='error' sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20 }}>
                    {error}
                </Alert>
            )}

            {/* PlayCanvas container */}
            <div
                id='playcanvas-container'
                style={{
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#000'
                }}
            />
        </Box>
    )
}

export default PlayCanvasViewPage
