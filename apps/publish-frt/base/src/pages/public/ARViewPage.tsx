import React, { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ILibraryConfig } from '@universo-platformo/types'
import { ARJSBuilder } from '../../builders'

type NullableRecord = Record<string, any> | null | undefined

interface ARViewPageProps {
    flowData?: any
    renderConfig?: NullableRecord
    libraryConfig?: ILibraryConfig | null
    projectName?: string
    canvasId?: string
}

const ARViewPage: React.FC<ARViewPageProps> = ({ flowData, renderConfig, libraryConfig, projectName, canvasId }) => {
    const { t } = useTranslation('publish')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const renderARExperience = async () => {
            if (!flowData) {
                setError(t('publish.publicFlow.errors.missingFlow', 'Publication data is missing'))
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const builder = new ARJSBuilder()
                const config = (renderConfig as Record<string, any>) || {}
                const displayType = config.arDisplayType || 'marker'

                const buildOptions = {
                    projectName: projectName || 'AR.js Experience',
                    libraryConfig: libraryConfig ?? undefined,
                    canvasId,
                    cameraUsage: config.cameraUsage || 'standard',
                    backgroundColor: config.backgroundColor,
                    ...(displayType === 'wallpaper'
                        ? {
                              arDisplayType: 'wallpaper',
                              wallpaperType: config.wallpaperType || 'standard'
                          }
                        : {
                              arDisplayType: 'marker',
                              markerType: config.markerType || 'preset',
                              markerValue: config.markerValue || 'hiro'
                          })
                }

                const { html } = await builder.buildFromFlowData(flowData, buildOptions)
                if (!html) {
                    throw new Error('Empty AR.js build result')
                }

                const container = document.getElementById('ar-container')
                if (!container) {
                    throw new Error('AR container not found')
                }

                container.innerHTML = ''

                const iframe = document.createElement('iframe')
                iframe.style.width = '100%'
                iframe.style.height = '100%'
                iframe.style.border = 'none'
                iframe.title = 'AR.js Application'
                iframe.allow = 'camera; microphone; autoplay; fullscreen; xr-spatial-tracking; accelerometer; gyroscope'
                iframe.srcdoc = html
                container.appendChild(iframe)
            } catch (renderError) {
                const message =
                    renderError instanceof Error && renderError.message
                        ? renderError.message
                        : t('publish.publicFlow.errors.renderFailed', 'Failed to render the AR.js publication')
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        renderARExperience()
    }, [canvasId, flowData, libraryConfig, projectName, renderConfig, t])

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
                        {t('arjs.loading', 'Loading AR scene...')}
                    </Typography>
                </Box>
            )}

            {error && (
                <Alert severity='error' sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20 }}>
                    {error}
                </Alert>
            )}

            <div id='ar-container' style={{ width: '100%', height: '100%' }} />
        </Box>
    )
}

export default ARViewPage
