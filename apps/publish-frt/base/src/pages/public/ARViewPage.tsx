// Universo Platformo | AR.js view page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { UPDLToARJSConverter } from '../../utils/UPDLToARJSConverter'
import { ARJSPublishApi } from '../../api'

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

                // Get publication data through API
                const publicationData = await ARJSPublishApi.getPublicationData(publicationId)
                console.log('📱 [ARViewPage] Publication data loaded:', publicationData)

                if (!publicationData || !publicationData.updlSpace) {
                    throw new Error('No UPDL space data found in publication')
                }

                // Generate HTML using UPDLToARJSConverter
                const html = UPDLToARJSConverter.convertToHTML(publicationData.updlSpace, publicationData.projectId || 'AR.js Experience')

                console.log('📱 [ARViewPage] Generated HTML, length:', html.length)

                // Add generated HTML to DOM
                const container = document.getElementById('ar-container')
                if (container) {
                    // Create iframe for isolation
                    const iframe = document.createElement('iframe')
                    iframe.style.width = '100%'
                    iframe.style.height = '100%'
                    iframe.style.border = 'none'
                    container.appendChild(iframe)

                    // Write HTML to iframe
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                    if (iframeDoc) {
                        iframeDoc.open()
                        iframeDoc.write(html)
                        iframeDoc.close()
                    }
                }

                setLoading(false)
            } catch (error) {
                console.error('📱 [ARViewPage] Error loading AR space:', error)
                setError(error instanceof Error ? error.message : 'Failed to load AR space')
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

            <div id='ar-container' style={{ width: '100%', height: '100%' }}></div>
        </Box>
    )
}

export default ARViewPage
