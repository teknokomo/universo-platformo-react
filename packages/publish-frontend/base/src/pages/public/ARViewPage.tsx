import React, { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ILibraryConfig } from '@universo/types'
import { ARJSBuilder } from '../../builders'
import { normalizeTimerConfig } from '../../utils/timerConfig'

type NullableRecord = Record<string, any> | null | undefined

type PublicationCaptchaConfig = {
    enabled: boolean
    siteKey: string | null
    testMode: boolean
}

interface ARViewPageProps {
    flowData?: any
    renderConfig?: NullableRecord
    libraryConfig?: ILibraryConfig | null
    projectName?: string
    canvasId?: string
    /** Publication slug for server-side rendering (preferred for captcha support) */
    slug?: string
}

const ARViewPage: React.FC<ARViewPageProps> = ({ flowData, renderConfig, libraryConfig, projectName, canvasId, slug }) => {
    const { t } = useTranslation('publish')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const renderARExperience = async () => {
            // If slug is provided, use server-side rendering (recommended for captcha)
            // Server-rendered HTML is served from the same domain, ensuring SmartCaptcha domain validation works
            if (slug) {
                console.log('[ARViewPage] Using server-side rendering for slug:', slug)
                setLoading(true)
                setError(null)

                try {
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
                    // Server-rendered HTML is served from /api/v1/publish/render/:slug
                    // This ensures proper domain origin for Yandex SmartCaptcha
                    iframe.src = `/api/v1/publish/render/${slug}`
                    container.appendChild(iframe)

                    // Wait for iframe to load
                    iframe.onload = () => {
                        console.log('[ARViewPage] Server-rendered iframe loaded')
                        setLoading(false)
                    }
                    iframe.onerror = () => {
                        setError(t('publicFlow.errors.renderFailed', 'Failed to render the AR.js publication'))
                        setLoading(false)
                    }
                } catch (renderError) {
                    const message =
                        renderError instanceof Error && renderError.message
                            ? renderError.message
                            : t('publicFlow.errors.renderFailed', 'Failed to render the AR.js publication')
                    setError(message)
                    setLoading(false)
                }
                return
            }

            // Fallback: client-side rendering (legacy, may have captcha domain issues)
            console.log('[ARViewPage] Using client-side rendering (legacy mode)')
            if (!flowData) {
                setError(t('publicFlow.errors.missingFlow', 'Publication data is missing'))
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const builder = new ARJSBuilder()
                const config = (renderConfig as Record<string, any>) || {}
                const displayType = config.arDisplayType || 'marker'
                const timerConfig = normalizeTimerConfig(config.timerConfig)

                // Load publication captcha config (global), fail-open if unavailable
                let publicationCaptchaConfig: PublicationCaptchaConfig | null = null
                try {
                    const captchaResponse = await fetch('/api/v1/publish/captcha/config', { cache: 'no-store' })
                    if (captchaResponse.ok) {
                        const captchaPayload = await captchaResponse.json()
                        if (captchaPayload?.success && captchaPayload?.data) {
                            publicationCaptchaConfig = captchaPayload.data as PublicationCaptchaConfig
                        }
                    }
                } catch {
                    publicationCaptchaConfig = null
                }

                const buildOptions = {
                    projectName: projectName || 'AR.js Experience',
                    libraryConfig: libraryConfig ?? undefined,
                    canvasId,
                    cameraUsage: config.cameraUsage || 'standard',
                    backgroundColor: config.backgroundColor,
                    timerConfig,
                    interactionMode: config.interactionMode || 'buttons',
                    publicationCaptchaConfig,
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
                // NOTE: blob: URL may cause captcha domain issues, prefer server-side rendering
                const blob = new Blob([html], { type: 'text/html' })
                const blobUrl = URL.createObjectURL(blob)
                iframe.src = blobUrl
                container.appendChild(iframe)

                // Cleanup blob URL when the iframe is removed/re-rendered
                ;(iframe as any).__blobUrl = blobUrl
            } catch (renderError) {
                const message =
                    renderError instanceof Error && renderError.message
                        ? renderError.message
                        : t('publicFlow.errors.renderFailed', 'Failed to render the AR.js publication')
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        renderARExperience()

        return () => {
            const container = document.getElementById('ar-container')
            const iframe = container?.querySelector('iframe') as (HTMLIFrameElement & { __blobUrl?: string }) | null
            if (iframe?.__blobUrl) {
                URL.revokeObjectURL(iframe.__blobUrl)
            }
        }
    }, [canvasId, flowData, libraryConfig, projectName, renderConfig, slug, t])

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
