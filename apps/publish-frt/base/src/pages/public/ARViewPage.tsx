// Universo Platformo | AR.js view page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ARJSBuilder } from '../../builders'
import { StreamingPublicationApi } from '../../api'

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

                // Universo Platformo | Enhanced debugging for libraryConfig flow
                console.log('🔍 [ARViewPage] Loading publication data for:', publicationId)

                const publicationData = await StreamingPublicationApi.getPublicationData(publicationId)

                // Universo Platformo | Detailed API response logging
                console.log('📡 [ARViewPage] API Response received:', {
                    success: !!publicationData,
                    hasUpdlSpace: !!publicationData?.updlSpace,
                    hasMultiScene: !!publicationData?.multiScene,
                    hasLibraryConfig: !!publicationData?.libraryConfig,
                    libraryConfigValue: publicationData?.libraryConfig,
                    publicationDataKeys: Object.keys(publicationData || {}),
                    fullResponse: publicationData
                })

                // Universo Platformo | Support both single space and multi-scene data
                if (!publicationData?.updlSpace && !publicationData?.multiScene) {
                    console.error('❌ [ARViewPage] No UPDL space or multi-scene found in publication data')
                    setError('Publication data not found')
                    return
                }

                // Universo Platformo | Determine data type and log appropriately
                const isMultiScene = !!publicationData.multiScene
                const multiSceneData = publicationData.multiScene
                const singleSpaceData = publicationData.updlSpace

                console.log('✅ [ARViewPage] Publication data loaded successfully:', {
                    projectId: publicationData.projectId,
                    isMultiScene: isMultiScene,
                    spaceObjectCount: isMultiScene
                        ? multiSceneData?.scenes?.reduce((total: number, scene: any) => total + (scene.objectNodes?.length || 0), 0) || 0
                        : singleSpaceData?.objects?.length || 0,
                    sceneCount: isMultiScene ? multiSceneData?.totalScenes || 0 : 1,
                    libraryConfig: publicationData.libraryConfig
                })

                // Generate HTML using new ARJSBuilder
                const arjsBuilder = new ARJSBuilder()

                // Universo Platformo | Prepare build options with detailed logging
                const buildOptions = {
                    projectName: publicationData.projectId || 'AR.js Experience',
                    markerType: 'preset',
                    markerValue: 'hiro',
                    // Universo Platformo | Include libraryConfig for proper library source selection
                    libraryConfig: publicationData.libraryConfig
                }

                console.log('🔧 [ARViewPage] Calling ARJSBuilder with options:', {
                    projectName: buildOptions.projectName,
                    markerType: buildOptions.markerType,
                    markerValue: buildOptions.markerValue,
                    hasLibraryConfig: !!buildOptions.libraryConfig,
                    libraryConfigDetails: buildOptions.libraryConfig,
                    isMultiScene: isMultiScene,
                    dataToProcess: isMultiScene
                        ? { totalScenes: multiSceneData?.totalScenes, scenes: multiSceneData?.scenes?.length }
                        : { name: singleSpaceData?.name, objectCount: singleSpaceData?.objects?.length || 0 }
                })

                // Universo Platformo | Use appropriate builder method based on data type
                let buildResult
                if (isMultiScene && multiSceneData) {
                    buildResult = await arjsBuilder.buildMultiScene(multiSceneData, buildOptions)
                } else if (singleSpaceData) {
                    buildResult = await arjsBuilder.build(singleSpaceData, buildOptions)
                } else {
                    throw new Error('No valid data to process')
                }
                const html = buildResult.html

                console.log('🎯 [ARViewPage] ARJSBuilder completed:', {
                    method: isMultiScene ? 'buildMultiScene' : 'build',
                    htmlLength: html?.length || 0,
                    hasHtml: !!html,
                    metadata: buildResult.metadata,
                    // Check if HTML contains local library paths
                    containsLocalPaths: html?.includes('/assets/libs/') || false,
                    containsOfficialCDN: html?.includes('aframe.io') || html?.includes('githack.com') || false
                })

                // Universo Platformo | Use iframe approach for proper script execution (from working backup)
                console.log('🖼️ [ARViewPage] Rendering HTML in iframe for script isolation')

                const container = document.getElementById('ar-container')
                if (container && html) {
                    // Clear any existing content
                    container.innerHTML = ''

                    // Create iframe for isolation (allows script execution)
                    const iframe = document.createElement('iframe')
                    iframe.style.width = '100%'
                    iframe.style.height = '100%'
                    iframe.style.border = 'none'
                    container.appendChild(iframe)

                    // Write HTML to iframe
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                    if (iframeDoc) {
                        console.log('📝 [ARViewPage] Writing HTML to iframe document')
                        iframeDoc.open()
                        iframeDoc.write(html)
                        iframeDoc.close()

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
                        console.error('❌ [ARViewPage] Could not access iframe document')
                        setError('Failed to initialize AR.js iframe')
                        setLoading(false)
                    }
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
