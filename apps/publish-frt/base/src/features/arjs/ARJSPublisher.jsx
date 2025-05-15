// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { publishARJSFlow, getCurrentUrlIds, ensureUnikIdInUrl, getAuthHeaders } from '../../services/api'
import { ARJSExporter } from './ARJSExporter'
import { arjsService } from '../../services/arjsService'

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
import PublicationLink from '../../components/common/PublicationLink'
import PublishToggle from '../../components/common/PublishToggle'

// QR Code component (optional dependency)
let QRCode
try {
    QRCode = require('qrcode.react')
} catch (e) {
    // QRCode component will be undefined if package not available
}

// Добавляем функцию для создания Blob URL вместо data URL
const createBlobURL = (htmlContent) => {
    try {
        const blob = new Blob([htmlContent], { type: 'text/html' })
        return URL.createObjectURL(blob)
    } catch (error) {
        console.error('Error creating blob URL:', error)
        return null
    }
}

/**
 * AR.js Publisher Component
 */
const ARJSPublisher = ({ flow, unikId, onPublish, onCancel, initialConfig }) => {
    const { t } = useTranslation('publish')

    // State for selected scene data
    const [sceneData, setSceneData] = useState(null)
    // State for project title
    const [projectTitle, setProjectTitle] = useState(flow?.name || '')
    // State for marker type
    const [markerType, setMarkerType] = useState('preset')
    // State for marker value
    const [markerValue, setMarkerValue] = useState('hiro')
    // State for loading indicator
    const [loading, setLoading] = useState(false)
    // State for HTML preview
    const [htmlPreview, setHtmlPreview] = useState('')
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
    const [generationMode, setGenerationMode] = useState('streaming')

    // Initialize with flow data when component mounts
    useEffect(() => {
        // Universo Platformo | Логирование URL и извлечение параметров из него для отладки проблемы с GET запросами
        console.log('🧪 [ARJSPublisher] Current URL analysis:')
        console.log('🧪 [ARJSPublisher] window.location.href:', window.location.href)
        console.log('🧪 [ARJSPublisher] window.location.pathname:', window.location.pathname)

        // Извлекаем id и unikId из URL, если они там есть
        const urlPathParts = window.location.pathname.split('/')
        console.log('🧪 [ARJSPublisher] URL path parts:', urlPathParts)

        // Типичный путь: /uniks/{unikId}/chatflows/{id}
        // Ищем индекс "uniks" и "chatflows" в пути
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

        // Проверяем соответствие prop и URL
        console.log('🧪 [ARJSPublisher] Props vs URL comparison:')
        console.log('🧪 [ARJSPublisher] Prop unikId:', unikId)
        console.log('🧪 [ARJSPublisher] Prop flow.id:', flow?.id)
        console.log('🧪 [ARJSPublisher] URL unikId:', urlUnikId)
        console.log('🧪 [ARJSPublisher] URL flowId:', urlFlowId)

        if (flow) {
            setSceneData({
                id: flow.id,
                name: flow.name,
                description: flow.description || '',
                updatedAt: new Date().toISOString()
            })
            setProjectTitle(flow.name || 'AR.js Experience')
            generateHtmlPreview()
        }
    }, [flow])

    // Regenerate HTML preview when settings change
    useEffect(() => {
        if (sceneData) {
            generateHtmlPreview()
        }
    }, [sceneData, projectTitle, markerType, markerValue])

    /**
     * Generate HTML preview using the ARJSExporter
     */
    const generateHtmlPreview = () => {
        try {
            if (!sceneData) return

            const exporter = new ARJSExporter()

            // Determine marker settings based on UI selections
            let markerTypeToUse = 'pattern' // Default pattern type
            let markerValueToUse = markerValue

            if (markerType === 'preset') {
                markerTypeToUse = 'pattern'
                markerValueToUse = markerValue
            } else if (markerType === 'pattern') {
                markerTypeToUse = 'pattern'
                markerValueToUse = markerValue
            } else if (markerType === 'barcode') {
                markerTypeToUse = 'barcode'
                markerValueToUse = markerValue
            }

            // Generate HTML with proper marker settings
            const html = exporter.generateHTML(sceneData, {
                title: projectTitle,
                markerType: markerTypeToUse,
                markerValue: markerValueToUse
            })

            setHtmlPreview(html)
        } catch (error) {
            console.error('Error generating HTML preview:', error)
            setError(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
    }

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
     * Handle public toggle change
     */
    const handlePublicChange = async (value) => {
        setIsPublic(value)

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

                        if (result && result.publicUrl) {
                            const baseUrl = window.location.origin
                            const fullPublicUrl = result.publicUrl.startsWith('http') ? result.publicUrl : `${baseUrl}${result.publicUrl}`
                            setPublishedUrl(fullPublicUrl)
                            setSnackbar({ open: true, message: t('success.published') })
                            console.log('🟢 [ARJSPublisher.handlePublicChange] Publication successful, URL:', fullPublicUrl)
                            if (onPublish) {
                                onPublish({ ...result, publishedUrl: fullPublicUrl })
                            }
                        } else {
                            throw new Error('Publication URL not received')
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
                        setPublishedUrl(result.publicUrl)
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

        console.log('📱 [ARJSPublisher.handlePublish] Starting publish process for flow:', flow.id, flow.name)
        console.log('📱 [ARJSPublisher.handlePublish] unikId at the start of handlePublish:', unikId)
        console.log('📱 [ARJSPublisher.handlePublish] flow object received:', flow)

        const authHeaders = getAuthHeaders()
        console.log('📱 [ARJSPublisher.handlePublish] Auth headers available:', Object.keys(authHeaders).length > 0)

        console.log('🔎 [ARJSPublisher] Button clicked, current state:', {
            projectTitle,
            markerType,
            markerValue,
            isPublic,
            generationMode,
            sceneData: sceneData ? `id: ${sceneData.id}, name: ${sceneData.name}` : 'null'
        })

        if (flow?.flowData) {
            try {
                const parsedFlowData = JSON.parse(flow.flowData)
                console.log('🔎 [ARJSPublisher] Flow data for logging:', {
                    id: flow?.id,
                    nodes: parsedFlowData.nodes ? parsedFlowData.nodes.length : 'unknown',
                    edges: parsedFlowData.edges ? parsedFlowData.edges.length : 'unknown',
                    nodeTypes: parsedFlowData.nodes ? [...new Set(parsedFlowData.nodes.map((n) => n.type))].join(', ') : 'unknown'
                })
            } catch (e) {
                console.warn('🔎 [ARJSPublisher] Unable to parse flow data:', e)
            }
        }

        const urlIds = getCurrentUrlIds()
        console.log('📱 [ARJSPublisher.handlePublish] URL IDs extract result:', urlIds)

        let effectiveUnikId = unikId || urlIds.unikId

        if (!effectiveUnikId) {
            console.error('📱 [ARJSPublisher.handlePublish] CRITICAL ERROR: No unikId found in props or URL!')
            setError('Missing critical information: unikId not found for publishing')
            setIsPublishing(false) // Ensure loading state is reset
            return
        }

        if (effectiveUnikId !== unikId) {
            console.warn('📱 [ARJSPublisher.handlePublish] Using unikId from URL instead of props:', effectiveUnikId)
        }

        setIsPublishing(true)
        setError(null)

        try {
            if (generationMode === 'streaming') {
                console.log('📱 [ARJSPublisher.handlePublish] Publishing in STREAMING mode')

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
                        unikId: effectiveUnikId
                    })
                })

                const result = await response.json()

                if (!response.ok || !result.success) {
                    throw new Error(result.error || `Publication failed: ${response.status}`)
                }

                if (result.publicUrl) {
                    const baseUrl = window.location.origin
                    const fullPublicUrl = result.publicUrl.startsWith('http') ? result.publicUrl : `${baseUrl}${result.publicUrl}`
                    setPublishedUrl(fullPublicUrl)
                    setSnackbar({ open: true, message: t('success.published') })
                    if (onPublish) {
                        onPublish({ ...result, publishedUrl: fullPublicUrl })
                    }
                } else {
                    throw new Error('Publication response missing publicUrl')
                }
            } else {
                // Logic for pregeneration or other modes
                console.log('📱 [ARJSPublisher.handlePublish] Publishing in PREGENERATION or OTHER mode')
                console.log('📱 [ARJSPublisher.handlePublish] unikId directly before options object creation:', effectiveUnikId)
                const options = {
                    marker: markerValue,
                    markerType: markerType,
                    isPublic,
                    title: projectTitle,
                    unikId: effectiveUnikId,
                    generationMode
                }
                console.log('📱 [ARJSPublisher.handlePublish] Publishing with options (unikId included):', options)

                console.log('📱 [ARJSPublisher.handlePublish] Calling publishARJSFlow')
                const result = await publishARJSFlow(flow.id, options)
                console.log('📱 [ARJSPublisher.handlePublish] Publish result:', result)

                if (result.success) {
                    const baseUrl = window.location.origin
                    const publishedUrlResult = result.publishedUrl.startsWith('http')
                        ? result.publishedUrl
                        : `${baseUrl}${result.publishedUrl}`

                    console.log('📱 [ARJSPublisher.handlePublish] Publication successful, URL:', publishedUrlResult)

                    setPublishedUrl(publishedUrlResult) // Use the corrected variable name
                    setSnackbar({
                        open: true,
                        message: t('success.published')
                    })

                    if (result.dataUrl) {
                        console.log('📱 [ARJSPublisher.handlePublish] Data URL available for direct viewing')
                        try {
                            const htmlContent = decodeURIComponent(result.dataUrl.replace('data:text/html;charset=utf-8,', ''))
                            const blobUrl = createBlobURL(htmlContent)
                            localStorage.setItem('arjs-latest-html', htmlContent)
                            localStorage.setItem('arjs-latest-blob-url', blobUrl)
                            console.log('📱 [ARJSPublisher.handlePublish] Created Blob URL for viewing:', blobUrl)
                            result.blobUrl = blobUrl
                        } catch (e) {
                            console.warn('📱 [ARJSPublisher.handlePublish] Could not create Blob URL:', e)
                        }
                        setPublishedUrl((prevState) => ({
                            ...(typeof prevState === 'string' ? { url: prevState } : prevState),
                            dataUrl: result.dataUrl,
                            blobUrl: result.blobUrl
                        }))
                    }

                    if (onPublish) {
                        const publishResponse = {
                            ...result,
                            publishedUrl: publishedUrlResult // Use the corrected variable name
                        }
                        console.log('📱 [ARJSPublisher.handlePublish] Notifying parent with:', publishResponse)
                        onPublish(publishResponse)
                    }
                } else {
                    console.error('📱 [ARJSPublisher.handlePublish] Publication failed:', result.error)
                    setError(result.error || 'Failed to publish AR.js project')

                    if (result.dataUrl) {
                        setSnackbar({
                            open: true,
                            message: 'Публикация на сервере не удалась, но создана локальная версия для просмотра'
                        })
                        setPublishedUrl({
                            url: '#local-preview',
                            dataUrl: result.dataUrl
                        })
                    }
                }
            }
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
