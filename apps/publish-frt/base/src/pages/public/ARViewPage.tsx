// Universo Platformo | AR.js view page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ARJSBuilder } from '../../builders'

/**
 * Page for viewing AR content in streaming generation mode
 */
const ARViewPage: React.FC = () => {
    // Support both flowId and id parameters for backward compatibility
    const { flowId, id } = useParams<{ flowId?: string; id?: string }>()
    const publicationId = flowId || id

    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Debug URL parameters
        console.log('🧪 [ARViewPage] URL params:', { flowId, id, publicationId })
        console.log('🧪 [ARViewPage] URL path:', window.location.pathname)

        // Function to load and render AR space
        const loadARSpace = async () => {
            try {
                setLoading(true)
                console.log('📱 [ARViewPage] Loading AR space for publicationId:', publicationId)

                if (!publicationId) {
                    throw new Error('No publication ID provided')
                }

                // UPDATED: Get raw flow data from new API
                console.log('🔍 [ARViewPage] Loading raw flow data for:', publicationId)

                const response = await fetch(`/api/v1/publish/arjs/public/${publicationId}`)
                if (!response.ok) {
                    throw new Error(`Failed to fetch publication data: ${response.status}`)
                }

                const publicationData = await response.json()

                // NEW: API response logging for raw data
                console.log('📡 [ARViewPage] Raw data API Response received:', {
                    success: !!publicationData.success,
                    hasFlowData: !!publicationData?.flowData,
                    hasLibraryConfig: !!publicationData?.libraryConfig,
                    libraryConfigValue: publicationData?.libraryConfig,
                    publicationDataKeys: Object.keys(publicationData || {}),
                    flowDataLength: publicationData?.flowData?.length || 0
                })

                // Check for valid response
                if (!publicationData.success || !publicationData.flowData) {
                    console.error('❌ [ARViewPage] No flow data found in publication response')
                    setError('Publication data not found')
                    return
                }

                console.log('✅ [ARViewPage] Raw flow data loaded successfully:', {
                    projectName: publicationData.projectName,
                    flowDataLength: publicationData.flowData.length,
                    libraryConfig: publicationData.libraryConfig
                })

                // NEW: Generate HTML using buildFromFlowData method
                const arjsBuilder = new ARJSBuilder()

                // NEW: Prepare build options for raw data processing
                const renderConfig = (publicationData && (publicationData.renderConfig || publicationData.flowData?.renderConfig)) || {}
                const displayType = renderConfig.arDisplayType || 'marker' // Fallback to marker for legacy
                const buildOptions = {
                    projectName: publicationData.projectName || 'AR.js Experience',
                    libraryConfig: publicationData.libraryConfig,
                    chatflowId: publicationId,
                    ...(displayType === 'wallpaper'
                        ? { arDisplayType: 'wallpaper', wallpaperType: renderConfig.wallpaperType || 'standard' }
                        : { markerType: renderConfig.markerType || 'preset', markerValue: renderConfig.markerValue || 'hiro' })
                }

                console.log('🔧 [ARViewPage] Calling ARJSBuilder.buildFromFlowData with raw data:', {
                    projectName: buildOptions.projectName,
                    displayType,
                    markerType: displayType === 'marker' ? (renderConfig.markerType || 'preset') : undefined,
                    markerValue: displayType === 'marker' ? (renderConfig.markerValue || 'hiro') : undefined,
                    hasLibraryConfig: !!buildOptions.libraryConfig,
                    libraryConfigDetails: buildOptions.libraryConfig,
                    flowDataLength: publicationData.flowData.length
                })

                // NEW: Use buildFromFlowData method instead of build/buildMultiScene
                const buildResult = await arjsBuilder.buildFromFlowData(publicationData.flowData, buildOptions)
                const html = buildResult.html

                console.log('🎯 [ARViewPage] ARJSBuilder.buildFromFlowData completed:', {
                    method: 'buildFromFlowData',
                    htmlLength: html?.length || 0,
                    hasHtml: !!html,
                    metadata: buildResult.metadata,
                    // Check if HTML contains local library paths
                    containsLocalPaths: html?.includes('/assets/libs/') || false,
                    containsOfficialCDN: html?.includes('aframe.io') || html?.includes('githack.com') || false
                })

                // Universo Platformo | Use modern iframe with srcDoc for proper script execution
                console.log('🖼️ [ARViewPage] Rendering HTML in iframe with srcDoc for script isolation')

                const container = document.getElementById('ar-container')
                if (container && html) {
                    // Clear any existing content
                    container.innerHTML = ''

                    // Create iframe with srcDoc (modern approach)
                    const iframe = document.createElement('iframe')
                    iframe.style.width = '100%'
                    iframe.style.height = '100%'
                    iframe.style.border = 'none'
                    iframe.title = 'AR.js Application'
                    iframe.srcdoc = html
                    container.appendChild(iframe)

                    console.log('📝 [ARViewPage] HTML set via srcDoc')

                    // Monitor iframe loading
                    iframe.onload = () => {
                        console.log('✅ [ARViewPage] Iframe loaded successfully')
                        setLoading(false)
                    }

                    // Fallback: hide loading after 3 seconds
                    setTimeout(() => {
                        console.log('⏰ [ARViewPage] Timeout reached, hiding loading screen')
                        setLoading(false)
                    }, 3000)
                } else {
                    console.error('❌ [ARViewPage] Container not found or no HTML generated')
                    setError('Failed to initialize AR.js container')
                    setLoading(false)
                }
            } catch (error) {
                console.error('💥 [ARViewPage] Error loading publication:', error)
                setError('Failed to load AR.js publication')
                setLoading(false)
            }
        }

        if (publicationId) {
            loadARSpace()
        } else {
            setError('No publication ID provided')
            setLoading(false)
        }
    }, [publicationId])

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
                        {t('publish.arjs.loading')}
                    </Typography>
                </Box>
            )}

            {error && (
                <Alert severity='error' sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20 }}>
                    {error}
                </Alert>
            )}

            {/* Universo Platformo | Container for iframe (replaced dangerouslySetInnerHTML) */}
            <div id='ar-container' style={{ width: '100%', height: '100%' }}></div>
        </Box>
    )
}

export default ARViewPage
