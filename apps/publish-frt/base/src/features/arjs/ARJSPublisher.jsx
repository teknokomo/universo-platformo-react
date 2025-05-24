// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences using streaming mode

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentUrlIds } from '../../services/api'
import { ARJSPublishApi } from '../../api/ARJSPublishApi'

// Universo Platformo | Set to true for demo mode
// Activates fixed URL and simplified interface without real requests
const DEMO_MODE = false

// MUI components
import {
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Card,
    CardContent,
    CircularProgress,
    Alert,
    Snackbar,
    FormHelperText
} from '@mui/material'

// Icons
import { IconCopy, IconDownload, IconQrcode } from '@tabler/icons-react'

// Import common components
import GenerationModeSelect from '../../components/GenerationModeSelect'
// CRITICAL: This component is responsible for displaying the publication link
import PublicationLink from '../../components/PublicationLink'

// QR Code component (optional dependency)
let QRCode
try {
    QRCode = require('qrcode.react')
} catch (e) {
    // QRCode component will be undefined if package not available
}

/**
 * AR.js Publisher Component
 * Supports streaming generation of AR.js content
 */
const ARJSPublisher = ({ flow, unikId, onPublish, onCancel, initialConfig }) => {
    const { t } = useTranslation('publish')

    // State for project title
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    // State for marker type
    const [markerType, setMarkerType] = useState('preset')
    // State for marker value
    const [markerValue, setMarkerValue] = useState('hiro')
    // State for loading indicator
    const [loading, setLoading] = useState(false)
    // State for published URL
    const [publishedUrl, setPublishedUrl] = useState('')
    // State for publishing status
    const [isPublishing, setIsPublishing] = useState(false)
    // State for public toggle
    const [isPublic, setIsPublic] = useState(false)
    // State for error message
    const [error, setError] = useState(null)
    // State for snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    // State for generation mode
    const [generationMode, setGenerationMode] = useState('streaming') // Only streaming generation
    // Universo Platformo | State for template type in demo mode
    const [templateType, setTemplateType] = useState('quiz')

    // Initialize with flow data when component mounts
    useEffect(() => {
        if (flow) {
            setProjectTitle(flow.name || 'AR.js Experience')
        }
    }, [flow])

    /**
     * Handle marker type change
     */
    const handleMarkerTypeChange = (event) => {
        setMarkerType(event.target.value)
    }

    /**
     * Handle marker value change
     */
    const handleMarkerValueChange = (event) => {
        setMarkerValue(event.target.value)
    }

    /**
     * Handle template type change (for demo mode)
     */
    const handleTemplateTypeChange = (event) => {
        setTemplateType(event.target.value)
    }

    /**
     * Template selector component for demo mode
     */
    const TemplateSelector = () => {
        if (!DEMO_MODE) return null

        return (
            <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel id='template-type-label'>Автоматические шаблоны</InputLabel>
                <Select
                    labelId='template-type-label'
                    value={templateType}
                    label='Автоматические шаблоны'
                    onChange={handleTemplateTypeChange}
                >
                    <MenuItem value='quiz'>Квиз по школьным предметам</MenuItem>
                </Select>
            </FormControl>
        )
    }

    /**
     * Handle public toggle change
     */
    const handlePublicChange = async (value) => {
        setIsPublic(value)

        // If public toggle is off, reset the URL
        if (!value) {
            setPublishedUrl('')
            return
        }

        // Universo Platformo | Special handling for demo mode
        if (DEMO_MODE) {
            setLoading(true)
            // Simulate request delay in demo mode
            setTimeout(() => {
                setPublishedUrl('https://plano.universo.pro/')
                setSnackbar({ open: true, message: t('success.published') })
                setLoading(false)
            }, 1000)
            return
        }

        // Only streaming mode is supported
        if (generationMode !== 'streaming') {
            setError('Unsupported generation mode: ' + generationMode)
            return
        }

        console.log('📱 [ARJSPublisher.handlePublicChange] Publishing in STREAMING mode for flow:', flow.id)

        setIsPublishing(true)
        setError(null)

        try {
            // Use API client instead of direct request
            const publishResult = await ARJSPublishApi.publishARJS({
                chatflowId: flow.id,
                generationMode: 'streaming',
                isPublic: true,
                projectName: projectTitle,
                flowData: {
                    flowId: flow.id,
                    projectTitle: projectTitle,
                    markerType: markerType,
                    markerValue: markerValue
                }
            })

            // Form local link with consideration for demo mode
            const fullPublicUrl = DEMO_MODE ? 'https://plano.universo.pro/' : `${window.location.origin}/p/${publishResult.publicationId}`
            setPublishedUrl(fullPublicUrl)
            setSnackbar({ open: true, message: t('success.published') })

            if (onPublish) {
                onPublish({ ...publishResult, publishedUrl: fullPublicUrl })
            }
        } catch (error) {
            console.error('📱 [ARJSPublisher.handlePublicChange] Error during publication:', error)
            setError(error instanceof Error ? error.message : 'Unknown error occurred during publication')
            setIsPublic(false) // Reset toggle in case of error
        } finally {
            setIsPublishing(false)
        }
    }

    /**
     * Handle generation mode change
     */
    const handleGenerationModeChange = (mode) => {
        setGenerationMode(mode)
        console.log('📱 [ARJSPublisher] Generation mode changed to:', mode)

        // Reset URL state if mode changed
        if (publishedUrl) {
            setPublishedUrl('')
            setIsPublic(false)
        }
    }

    /**
     * Handle copy URL button click
     */
    const handleCopyUrl = (url) => {
        navigator.clipboard
            .writeText(url)
            .then(() => {
                setSnackbar({ open: true, message: t('success.copied') })
            })
            .catch((error) => {
                console.error('Failed to copy:', error)
            })
    }

    /**
     * Get marker image URL
     */
    const getMarkerImage = () => {
        // Currently only standard markers are supported
        if (markerType === 'preset') {
            return `https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/${markerValue}.png`
        }
        return ''
    }

    /**
     * Handle snackbar close
     */
    const handleSnackbarClose = () => {
        setSnackbar({
            ...snackbar,
            open: false
        })
    }

    const handleError = (message, errorObj) => {
        console.error(message, errorObj)
        setError(errorObj instanceof Error ? errorObj.message : String(errorObj || message))
    }

    // Main interface content
    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant='h4' gutterBottom>
                {t('technologies.arjs')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('technologies.arjsDescription')}
            </Typography>

            {/* Main Content - Scrollable Page */}
            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <Box sx={{ position: 'relative' }}>
                        {loading && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                    zIndex: 10
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        )}

                        {/* Project Title Input */}
                        <TextField
                            label={t('project.title')}
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            fullWidth
                            margin='normal'
                            variant='outlined'
                        />

                        {/* Generation Mode Selector */}
                        <GenerationModeSelect value={generationMode} onChange={handleGenerationModeChange} disabled={!!publishedUrl} />

                        {/* Type of Marker */}
                        <FormControl fullWidth variant='outlined' margin='normal'>
                            <InputLabel>{t('marker.type')}</InputLabel>
                            <Select value={markerType} onChange={handleMarkerTypeChange} label={t('marker.type')} disabled={!!publishedUrl}>
                                <MenuItem value='preset'>{t('marker.standard')}</MenuItem>
                            </Select>
                        </FormControl>

                        {/* Marker Selection */}
                        {markerType === 'preset' && (
                            <FormControl fullWidth variant='outlined' margin='normal'>
                                <InputLabel>{t('marker.presetLabel')}</InputLabel>
                                <Select
                                    value={markerValue}
                                    onChange={handleMarkerValueChange}
                                    label={t('marker.presetLabel')}
                                    disabled={!!publishedUrl}
                                >
                                    <MenuItem value='hiro'>{t('marker.hiro')}</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {/* Demo Templates */}
                        <TemplateSelector />

                        {/* Marker Preview */}
                        <Box sx={{ textAlign: 'center', my: 2 }}>
                            <Typography variant='body2' color='text.secondary' gutterBottom>
                                {t('preview.title')}
                            </Typography>
                            {markerType === 'preset' && markerValue && (
                                <Box
                                    component='img'
                                    src={getMarkerImage()}
                                    alt={t('marker.alt')}
                                    sx={{ maxWidth: '200px', border: '1px solid #eee' }}
                                />
                            )}
                            <Typography variant='caption' display='block' sx={{ mt: 1 }}>
                                {t('marker.instruction')}
                            </Typography>
                        </Box>

                        {/* Make Public Toggle с индикатором загрузки */}
                        <Box sx={{ my: 3, width: '100%' }}>
                            <FormControl fullWidth variant='outlined'>
                                <FormControlLabel
                                    control={
                                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                                            <Switch
                                                checked={isPublic}
                                                onChange={(e) => handlePublicChange(e.target.checked)}
                                                disabled={!!isPublishing}
                                                color='primary'
                                            />
                                            {isPublishing && <CircularProgress size={20} sx={{ ml: 2 }} />}
                                        </Box>
                                    }
                                    label={t('configuration.makePublic')}
                                    sx={{
                                        width: '100%',
                                        margin: 0,
                                        '& .MuiFormControlLabel-label': {
                                            width: '100%',
                                            flexGrow: 1
                                        }
                                    }}
                                    labelPlacement='start'
                                />
                            </FormControl>
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                {t('configuration.description')}
                            </Typography>
                        </Box>

                        {/* Public link display */}
                        {publishedUrl && (
                            <Box sx={{ my: 3 }}>
                                <Typography variant='subtitle1' gutterBottom>
                                    {t('arjs.publishedUrl')}:
                                </Typography>
                                <PublicationLink url={publishedUrl} onCopy={handleCopyUrl} />

                                {/* QR Code если доступен */}
                                {QRCode && (
                                    <Box sx={{ textAlign: 'center', my: 2 }}>
                                        <Typography variant='body2' gutterBottom>
                                            Сканируйте QR-код для доступа с мобильного устройства:
                                        </Typography>
                                        <Box sx={{ display: 'inline-block', p: 1, bgcolor: 'white', borderRadius: 1 }}>
                                            <QRCode value={publishedUrl} size={180} />
                                        </Box>
                                    </Box>
                                )}

                                <Box sx={{ mt: 3 }}>
                                    <Typography variant='body2' gutterBottom>
                                        Инструкция по использованию:
                                    </Typography>
                                    <Box sx={{ textAlign: 'left', pl: 2 }}>
                                        <Typography variant='body2' component='div'>
                                            <ol>
                                                <li>Откройте URL на устройстве с камерой</li>
                                                <li>Разрешите доступ к камере</li>
                                                <li>Наведите камеру на маркер {markerType === 'preset' ? `"${markerValue}"` : ''}</li>
                                                <li>Дождитесь появления 3D объекта</li>
                                            </ol>
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        {/* Error display */}
                        {error && (
                            <Alert severity='error' sx={{ my: 2 }}>
                                {error}
                            </Alert>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* Snackbar for notifications */}
            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

export { ARJSPublisher }
export default ARJSPublisher
