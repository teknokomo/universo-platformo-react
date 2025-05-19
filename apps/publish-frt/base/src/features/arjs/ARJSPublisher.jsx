// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
// publishARJSFlow looks like it might be from the deleted services/api.ts, will need to verify if arjsService.publishARJS replaces it
import { /* publishARJSFlow, */ getCurrentUrlIds, /* ensureUnikIdInUrl, */ getAuthHeaders } from '../../services/api' // ensureUnikIdInUrl might also be unused
// import { ARJSExporter } from './ARJSExporter' // Removed as ARJSExporter is part of pre-generation
import { arjsService } from '../../services/arjsService'

// Universo Platformo | Установите в true для демонстрационного режима
const DEMO_MODE = false

// MUI components
import {
    Button,
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
    Paper,
    Snackbar,
    Stack,
    FormGroup,
    Link,
    Divider,
    FormHelperText
} from '@mui/material'

// Icons
import { IconCopy, IconDownload, IconQrcode } from '@tabler/icons-react'

// Import common components
import GenerationModeSelect from '../../components/arjs/GenerationModeSelect'
// PublicationLink from common might be different from the one in components/arjs, keeping common for now
import PublicationLink from '../../components/common/PublicationLink'
import PublishToggle from '../../components/common/PublishToggle'

// QR Code component (optional dependency)
let QRCode
try {
    QRCode = require('qrcode.react')
} catch (e) {
    // QRCode component will be undefined if package not available
}

// Removed createBlobURL as it was likely used with the pre-generated HTML preview
// const createBlobURL = (htmlContent) => { ... }

/**
 * AR.js Publisher Component
 */
const ARJSPublisher = ({ flow, unikId, onPublish, onCancel, initialConfig }) => {
    const { t } = useTranslation('publish')

    // State for selected scene data
    // const [sceneData, setSceneData] = useState(null) // sceneData was used for pre-generation
    // State for project title
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    // State for marker type
    const [markerType, setMarkerType] = useState('preset') // Defaulting to preset, as custom pattern upload might be complex without pre-gen
    // State for marker value
    const [markerValue, setMarkerValue] = useState('hiro')
    // State for loading indicator
    const [loading, setLoading] = useState(false)
    // State for HTML preview - REMOVED
    // const [htmlPreview, setHtmlPreview] = useState('')
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
    const [generationMode, setGenerationMode] = useState('streaming') // Default to streaming as it's the focus
    // Universo Platformo | State for template type in demo mode
    const [templateType, setTemplateType] = useState('quiz')

    // Initialize with flow data when component mounts
    useEffect(() => {
        console.log('🧪 [ARJSPublisher] Current URL analysis:')
        console.log('🧪 [ARJSPublisher] window.location.href:', window.location.href)
        console.log('🧪 [ARJSPublisher] window.location.pathname:', window.location.pathname)

        const urlPathParts = window.location.pathname.split('/')
        console.log('🧪 [ARJSPublisher] URL path parts:', urlPathParts)

        const uniksIndex = urlPathParts.findIndex((p) => p === 'uniks')
        const chatflowsIndex = urlPathParts.findIndex((p) => p === 'chatflows')

        let urlUnikId = null
        let urlFlowId = null

        if (uniksIndex >= 0 && uniksIndex + 1 < urlPathParts.length) {
            urlUnikId = urlPathParts[uniksIndex + 1]
            console.log('🧪 [ARJSPublisher] Found unikId in URL:', urlUnikId)
        }

        if (chatflowsIndex >= 0 && chatflowsIndex + 1 < urlPathParts.length) {
            urlFlowId = urlPathParts[chatflowsIndex + 1]
            console.log('🧪 [ARJSPublisher] Found flowId in URL:', urlFlowId)
        }

        console.log('🧪 [ARJSPublisher] Props vs URL comparison:')
        console.log('🧪 [ARJSPublisher] Prop unikId:', unikId)
        console.log('🧪 [ARJSPublisher] Prop flow.id:', flow?.id)
        console.log('🧪 [ARJSPublisher] URL unikId:', urlUnikId)
        console.log('🧪 [ARJSPublisher] URL flowId:', urlFlowId)

        if (flow) {
            // setSceneData({
            //     id: flow.id,
            //     name: flow.name,
            //     description: flow.description || '',
            //     updatedAt: new Date().toISOString()
            // })
            setProjectTitle(flow.name || 'AR.js Experience')
            // generateHtmlPreview() // Removed call
        }
    }, [flow])

    // Regenerate HTML preview when settings change - REMOVED
    // useEffect(() => {
    //     if (sceneData) {
    //         generateHtmlPreview()
    //     }
    // }, [sceneData, projectTitle, markerType, markerValue])

    // Generate HTML preview using the ARJSExporter - REMOVED
    // const generateHtmlPreview = () => { ... }

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
     * Компонент выбора шаблона для демо-режима
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

        // Universo Platformo | Специальная обработка для демо-режима
        if (DEMO_MODE && value) {
            setLoading(true)
            // Имитация задержки запроса в демо-режиме
            setTimeout(() => {
                setPublishedUrl('https://plano.universo.pro/')
                setSnackbar({ open: true, message: t('success.published') })
                setLoading(false)
            }, 800)
            return
        }

        if (flow?.id && unikId) {
            try {
                setLoading(true)
                console.log('🔹 [ARJSPublisher.handlePublicChange] Changing public status to:', value)

                // Если выбран режим потоковой генерации и включен переключатель публичности,
                // автоматически создаем публикацию и показываем ссылку
                if (generationMode === 'streaming' && value) {
                    console.log('🔹 [ARJSPublisher.handlePublicChange] Auto-publishing with streaming mode')

                    try {
                        // Используем API-клиент вместо fetch для унификации запросов
                        const result = await arjsService.publishARJS({
                            chatflowId: flow.id,
                            generationMode: 'streaming',
                            isPublic: true,
                            projectName: projectTitle,
                            unikId: unikId || getCurrentUrlIds().unikId
                        })

                        if (result && result.success) {
                            // Universo Platformo | Формируем ссылку на клиенте с учетом демо-режима
                            const fullPublicUrl = DEMO_MODE ? 'https://plano.universo.pro/' : `${window.location.origin}/p/${flow.id}`
                            setPublishedUrl(fullPublicUrl)
                            setSnackbar({ open: true, message: t('success.published') })
                            console.log('🟢 [ARJSPublisher.handlePublicChange] Publication successful, URL:', fullPublicUrl)
                            if (onPublish) {
                                onPublish({ ...result, publishedUrl: fullPublicUrl })
                            }
                        } else {
                            throw new Error(result.error || 'Publication failed')
                        }
                    } catch (error) {
                        console.error('🔴 [ARJSPublisher.handlePublicChange] Error during auto-publishing:', error)
                        setError(error instanceof Error ? error.message : 'Auto-publication failed')
                    }
                } else if (!value) {
                    // Если отключаем публичный доступ, скрываем ссылку
                    setPublishedUrl('')
                } else {
                    // Для не-потоковых режимов, только сохраняем настройки без публикации
                    const result = await arjsService.saveARJSPublication(flow.id, value, unikId, {
                        generationMode,
                        markerType,
                        markerValue,
                        title: projectTitle
                    })

                    if (result.success) {
                        // Universo Platformo | Формируем ссылку на клиенте с учетом демо-режима
                        const fullPublicUrl = DEMO_MODE ? 'https://plano.universo.pro/' : `${window.location.origin}/p/${flow.id}`
                        setPublishedUrl(fullPublicUrl)
                        setSnackbar({
                            open: true,
                            message: t('arPublication.configSaved', 'AR.js publication settings saved')
                        })
                    } else {
                        setError(result.error || 'Failed to update publication status')
                    }
                }
            } catch (error) {
                console.error('Error changing public status:', error)
                setError(error instanceof Error ? error.message : String(error))
            } finally {
                setLoading(false)
            }
        }
    }

    /**
     * Handle generation mode change
     */
    const handleGenerationModeChange = (mode) => {
        setGenerationMode(mode)

        // Если меняем на режим "не потоковый", сбросить URL публикации
        if (mode !== 'streaming' && publishedUrl) {
            setPublishedUrl('')
        }

        // Если включаем потоковый режим и публикация уже публична,
        // автоматически пытаемся получить ссылку на публикацию
        if (mode === 'streaming' && isPublic && flow?.id) {
            handlePublicChange(true)
        }
    }

    /**
     * Handle URL copying
     */
    const handleCopyUrl = (url) => {
        navigator.clipboard.writeText(url)
        setSnackbar({
            open: true,
            message: t('success.copied')
        })
    }

    /**
     * Get marker image for preview
     */
    const getMarkerImage = () => {
        if (markerType === 'preset') {
            if (markerValue === 'hiro') {
                return 'https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png'
            } else if (markerValue === 'kanji') {
                return 'https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/kanji.png'
            } else {
                return `https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/pattern-${markerValue}.png`
            }
        }

        // For other types, show a placeholder
        return 'https://via.placeholder.com/200?text=Marker+Preview'
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

    /**
     * Handle publish button click
     */
    const handlePublish = async () => {
        if (!flow || !flow.id) {
            setError('No flow data available')
            return
        }

        // Universo Platformo | Специальная обработка для демо-режима
        if (DEMO_MODE) {
            // В демо-режиме сразу устанавливаем фиксированную ссылку без запроса
            setIsPublishing(true)
            setTimeout(() => {
                setPublishedUrl('https://plano.universo.pro/')
                setSnackbar({ open: true, message: t('success.published') })
                setIsPublishing(false)
                if (onPublish) onPublish({ success: true, publishedUrl: 'https://plano.universo.pro/' })
            }, 1000) // Имитация задержки запроса
            return
        }

        // Поддерживается только streaming режим
        if (generationMode !== 'streaming') {
            setError('Unsupported generation mode: ' + generationMode)
            return
        }

        console.log('📱 [ARJSPublisher.handlePublish] Publishing in STREAMING mode for flow:', flow.id)

        setIsPublishing(true)
        setError(null)

        try {
            const authHeaders = getAuthHeaders()

            const response = await fetch('/api/publish/arjs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders
                },
                body: JSON.stringify({
                    chatflowId: flow.id,
                    generationMode: 'streaming',
                    isPublic: isPublic,
                    projectName: projectTitle,
                    unikId: unikId || getCurrentUrlIds().unikId
                })
            })

            const result = await response.json()

            if (!response.ok || !result.success) {
                throw new Error(result.error || `Publication failed: ${response.status}`)
            }

            // Universo Platformo | Формируем ссылку локально с учетом демо-режима
            const fullPublicUrl = DEMO_MODE ? 'https://plano.universo.pro/' : `${window.location.origin}/p/${flow.id}`
            setPublishedUrl(fullPublicUrl)
            setSnackbar({ open: true, message: t('success.published') })
            if (onPublish) onPublish({ ...result, publishedUrl: fullPublicUrl })
        } catch (error) {
            console.error('📱 [ARJSPublisher.handlePublish] Error during publication:', error)
            setError(error instanceof Error ? error.message : 'Unknown error occurred during publication')
        } finally {
            setIsPublishing(false)
        }
    }

    const handleError = (message, errorObj) => {
        console.error(message, errorObj)
        setError(errorObj instanceof Error ? errorObj.message : String(errorObj || message))
    }

    // Component for Published content (conditionally rendered)
    const PublishedContent = () => {
        if (!publishedUrl) {
            return null
        }

        const url = typeof publishedUrl === 'object' ? publishedUrl.url : publishedUrl
        const dataUrl = typeof publishedUrl === 'object' ? publishedUrl.dataUrl : null
        const blobUrl = typeof publishedUrl === 'object' ? publishedUrl.blobUrl : null

        return (
            <Box sx={{ textAlign: 'center', p: 2, mt: 3 }}>
                <Typography variant='h6' gutterBottom>
                    {t('success.published')}
                </Typography>

                <Paper elevation={2} sx={{ p: 2, mb: 3, wordBreak: 'break-all', bgcolor: 'background.paper' }}>
                    <Typography variant='body2'>URL проекта:</Typography>
                    <Link href={url} target='_blank' rel='noopener' sx={{ wordBreak: 'break-all' }}>
                        {url}
                    </Link>

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        {blobUrl && (
                            <Button
                                variant='outlined'
                                size='small'
                                color='secondary'
                                startIcon={<IconDownload />}
                                onClick={() => window.open(blobUrl, '_blank')}
                            >
                                {t('actions.view')}
                            </Button>
                        )}

                        {!blobUrl && dataUrl && (
                            <Button
                                variant='outlined'
                                size='small'
                                color='warning'
                                startIcon={<IconDownload />}
                                onClick={() => {
                                    // Если нет blobUrl, но есть dataUrl, создаем blob URL на лету
                                    try {
                                        const htmlContent = decodeURIComponent(dataUrl.replace('data:text/html;charset=utf-8,', ''))
                                        const newBlobUrl = createBlobURL(htmlContent)
                                        if (newBlobUrl) {
                                            window.open(newBlobUrl, '_blank')
                                        } else {
                                            alert('Не удалось создать URL для предпросмотра HTML')
                                        }
                                    } catch (error) {
                                        console.error('Ошибка при создании Blob URL:', error)
                                        alert('Ошибка при открытии HTML: ' + (error.message || 'Неизвестная ошибка'))
                                    }
                                }}
                            >
                                {t('actions.view')}
                            </Button>
                        )}
                    </Box>
                </Paper>

                {QRCode && (
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant='body2' gutterBottom>
                            Сканируйте QR-код для доступа с мобильного устройства:
                        </Typography>
                        <Box sx={{ display: 'inline-block', p: 1, bgcolor: 'white', borderRadius: 1 }}>
                            <QRCode value={url} size={180} />
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

                {markerType === 'preset' && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant='body2' gutterBottom>
                            Маркер для печати:
                        </Typography>
                        <Box sx={{ display: 'inline-block', p: 1, bgcolor: 'white', borderRadius: 1 }}>
                            <img src={getMarkerImage()} alt={`Маркер ${markerValue}`} style={{ maxWidth: '200px' }} />
                        </Box>
                    </Box>
                )}
            </Box>
        )
    }

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
                                    bgcolor: 'rgba(255,255,255,0.7)',
                                    zIndex: 1
                                }}
                            >
                                <CircularProgress />
                            </Box>
                        )}

                        <Stack spacing={3}>
                            <Typography variant='h6'>{t('configuration.title')}</Typography>

                            <TextField
                                label='Название проекта'
                                variant='outlined'
                                fullWidth
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                            />

                            {/* Generation Mode Selector */}
                            <GenerationModeSelect value={generationMode} onChange={handleGenerationModeChange} disabled={isPublishing} />

                            {/* Universo Platformo | Selector for automatic templates in demo mode */}
                            <TemplateSelector />

                            <FormControl fullWidth>
                                <InputLabel id='marker-type-label'>{t('marker.type')}</InputLabel>
                                <Select
                                    labelId='marker-type-label'
                                    value={markerType}
                                    label={t('marker.type')}
                                    onChange={handleMarkerTypeChange}
                                >
                                    <MenuItem value='preset'>Стандартный маркер</MenuItem>
                                    <MenuItem value='pattern'>Свой паттерн</MenuItem>
                                    <MenuItem value='barcode'>Штрих-код</MenuItem>
                                </Select>
                            </FormControl>

                            {markerType === 'preset' && (
                                <FormControl fullWidth>
                                    <InputLabel id='preset-marker-label'>Предустановленный маркер</InputLabel>
                                    <Select
                                        labelId='preset-marker-label'
                                        value={markerValue}
                                        label='Предустановленный маркер'
                                        onChange={handleMarkerValueChange}
                                    >
                                        <MenuItem value='hiro'>{t('marker.hiro')}</MenuItem>
                                        <MenuItem value='kanji'>{t('marker.kanji')}</MenuItem>
                                        <MenuItem value='a'>Буква A</MenuItem>
                                        <MenuItem value='b'>Буква B</MenuItem>
                                        <MenuItem value='c'>Буква C</MenuItem>
                                    </Select>
                                </FormControl>
                            )}

                            {markerType === 'pattern' && (
                                <TextField
                                    label='URL паттерна'
                                    variant='outlined'
                                    fullWidth
                                    value={markerValue}
                                    onChange={(e) => setMarkerValue(e.target.value)}
                                    helperText='URL до .patt файла или изображения для использования в качестве маркера'
                                />
                            )}

                            {markerType === 'barcode' && (
                                <TextField
                                    label='Значение штрих-кода'
                                    variant='outlined'
                                    fullWidth
                                    value={markerValue}
                                    onChange={(e) => setMarkerValue(e.target.value)}
                                    type='number'
                                    inputProps={{ min: 0, max: 63 }}
                                    helperText='Введите значение от 0 до 63'
                                />
                            )}

                            <Paper
                                elevation={0}
                                variant='outlined'
                                sx={{
                                    p: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center'
                                }}
                            >
                                <img
                                    src={getMarkerImage()}
                                    alt='Маркер'
                                    style={{
                                        maxWidth: '200px',
                                        maxHeight: '200px',
                                        margin: '10px 0'
                                    }}
                                />
                                <Typography variant='caption' color='text.secondary'>
                                    Покажите этот маркер камере для активации AR
                                </Typography>
                            </Paper>

                            {/* PublishToggle component for streaming mode */}
                            {generationMode === 'streaming' && (
                                <Box>
                                    <PublishToggle
                                        isPublic={isPublic}
                                        onChange={handlePublicChange}
                                        helperText={t('settings.publicHelp')}
                                    />
                                    {isPublic && publishedUrl && typeof publishedUrl === 'string' && (
                                        <PublicationLink url={publishedUrl} onCopy={handleCopyUrl} />
                                    )}
                                </Box>
                            )}

                            {/* Publish button for non-streaming modes */}
                            {generationMode !== 'streaming' && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                    <Button
                                        variant='contained'
                                        color='primary'
                                        onClick={handlePublish}
                                        disabled={isPublishing || !sceneData}
                                        startIcon={isPublishing ? <CircularProgress size={20} color='inherit' /> : null}
                                    >
                                        {isPublishing ? t('actions.publishing') : t('actions.publish')}
                                    </Button>
                                </Box>
                            )}
                        </Stack>
                    </Box>
                </CardContent>
            </Card>

            {/* Error messages */}
            {error && (
                <Alert severity='error' sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* Published Result - only show for non-streaming mode */}
            {generationMode !== 'streaming' && <PublishedContent />}

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// Export as both default and named export
export { ARJSPublisher }
export default ARJSPublisher
