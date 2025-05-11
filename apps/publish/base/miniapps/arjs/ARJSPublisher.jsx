// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences

import React, { useState, useEffect } from 'react'
import { publishARJSFlow, getCurrentUrlIds, ensureUnikIdInUrl, getAuthHeaders } from '../../services/api'
import { ARJSExporter } from './ARJSExporter'

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
    Tabs,
    Tab,
    Paper,
    Snackbar,
    Stack,
    FormGroup,
    Link
} from '@mui/material'

// Icons
import { IconCopy, IconDownload, IconQrcode } from '@tabler/icons-react'

// QR Code component (optional dependency)
let QRCode
try {
    QRCode = require('qrcode.react')
} catch (e) {
    // QRCode component will be undefined if package not available
}

// Tab Panel component
function TabPanel(props) {
    const { children, value, index, ...other } = props

    return (
        <div role='tabpanel' hidden={value !== index} id={`ar-tabpanel-${index}`} aria-labelledby={`ar-tab-${index}`} {...other}>
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    )
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
    // State for active tab
    const [tabValue, setTabValue] = useState(0)
    // State for publishing status
    const [isPublishing, setIsPublishing] = useState(false)
    // State for public toggle
    const [isPublic, setIsPublic] = useState(true)
    // State for error message
    const [error, setError] = useState(null)
    // State for snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })

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
     * Handle downloading HTML
     */
    const handleDownload = () => {
        if (!htmlPreview) return

        const element = document.createElement('a')
        const file = new Blob([htmlPreview], { type: 'text/html' })
        element.href = URL.createObjectURL(file)
        element.download = `${projectTitle || 'ar-scene'}.html`
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)

        setSnackbar({
            open: true,
            message: 'HTML файл успешно скачан'
        })
    }

    /**
     * Handle copying HTML to clipboard
     */
    const handleCopy = () => {
        if (!htmlPreview) return

        navigator.clipboard
            .writeText(htmlPreview)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: 'HTML скопирован в буфер обмена'
                })
            })
            .catch((error) => {
                setSnackbar({
                    open: true,
                    message: `Не удалось скопировать HTML: ${error.message}`
                })
            })
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
    const handlePublicChange = (event) => {
        setIsPublic(event.target.checked)
    }

    /**
     * Handle URL copying
     */
    const handleCopyUrl = (url) => {
        navigator.clipboard.writeText(url)
        setSnackbar({
            open: true,
            message: 'URL скопирован в буфер обмена'
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
     * Handle tab change
     */
    const handleTabChange = (event, newValue) => {
        setTabValue(newValue)
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

        // Проверка наличия токена авторизации
        const authHeaders = getAuthHeaders()
        console.log('📱 [ARJSPublisher.handlePublish] Auth headers available:', Object.keys(authHeaders).length > 0)

        // Более подробное логирование для отладки
        console.log('🔎 [ARJSPublisher] Button clicked, current state:', {
            projectTitle,
            markerType,
            markerValue,
            isPublic,
            sceneData: sceneData ? `id: ${sceneData.id}, name: ${sceneData.name}` : 'null'
        })

        // Подробное логирование перед публикацией
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

        // Universo Platformo | Проверяем URL на наличие параметров и используем их для подстраховки
        const urlIds = getCurrentUrlIds()
        console.log('📱 [ARJSPublisher.handlePublish] URL IDs extract result:', urlIds)

        // Если unikId отсутствует в props, но есть в URL, используем его из URL
        let effectiveUnikId = unikId || urlIds.unikId

        if (!effectiveUnikId) {
            console.error('📱 [ARJSPublisher.handlePublish] CRITICAL ERROR: No unikId found in props or URL!')
            setError('Missing critical information: unikId not found')
            return
        }

        if (effectiveUnikId !== unikId) {
            console.warn('📱 [ARJSPublisher.handlePublish] Using unikId from URL instead of props:', effectiveUnikId)
        }

        setIsPublishing(true)
        setError(null)

        try {
            console.log('📱 [ARJSPublisher.handlePublish] unikId directly before options object creation:', effectiveUnikId)
            const options = {
                marker: markerValue,
                markerType: markerType, // Passing actual marker type directly
                isPublic,
                title: projectTitle,
                unikId: effectiveUnikId // Использовать эффективный unikId
            }
            console.log('📱 [ARJSPublisher.handlePublish] Publishing with options (unikId included):', options)

            // Call API to publish AR.js flow
            console.log('📱 [ARJSPublisher.handlePublish] Calling publishARJSFlow')
            const result = await publishARJSFlow(flow.id, options)
            console.log('📱 [ARJSPublisher.handlePublish] Publish result:', result)

            if (result.success) {
                // Determine published URL with proper environment prefix
                const baseUrl = window.location.origin
                const publishedUrl = result.publishedUrl.startsWith('http') ? result.publishedUrl : `${baseUrl}${result.publishedUrl}`

                console.log('📱 [ARJSPublisher.handlePublish] Publication successful, URL:', publishedUrl)

                // Update state with published URL
                setPublishedUrl(publishedUrl)
                setSnackbar({
                    open: true,
                    message: 'Проект опубликован успешно!'
                })

                // Switch to Published tab
                setTabValue(2)

                // Check if we received a data URL (local HTML) for direct viewing
                if (result.dataUrl) {
                    console.log('📱 [ARJSPublisher.handlePublish] Data URL available for direct viewing')

                    // Конвертируем data URL в Blob URL для безопасного открытия
                    try {
                        // Извлекаем HTML из data URL
                        const htmlContent = decodeURIComponent(result.dataUrl.replace('data:text/html;charset=utf-8,', ''))

                        // Создаем Blob URL
                        const blobUrl = createBlobURL(htmlContent)

                        // Сохраняем в localStorage для дальнейшего использования
                        localStorage.setItem('arjs-latest-html', htmlContent)
                        localStorage.setItem('arjs-latest-blob-url', blobUrl)

                        console.log('📱 [ARJSPublisher.handlePublish] Created Blob URL for viewing:', blobUrl)

                        // Обновляем URL в результате
                        result.blobUrl = blobUrl
                    } catch (e) {
                        console.warn('📱 [ARJSPublisher.handlePublish] Could not create Blob URL:', e)
                    }

                    // Add dataUrl to publishedUrl state
                    setPublishedUrl((prevState) => ({
                        ...prevState,
                        dataUrl: result.dataUrl,
                        blobUrl: result.blobUrl
                    }))
                }

                // Notify parent component
                if (onPublish) {
                    const publishResponse = {
                        ...result,
                        publishedUrl: publishedUrl
                    }
                    console.log('📱 [ARJSPublisher.handlePublish] Notifying parent with:', publishResponse)
                    onPublish(publishResponse)
                }
            } else {
                console.error('📱 [ARJSPublisher.handlePublish] Publication failed:', result.error)
                setError(result.error || 'Failed to publish AR.js project')

                // If we have a dataUrl from the error fallback, we can still offer viewing
                if (result.dataUrl) {
                    setSnackbar({
                        open: true,
                        message: 'Публикация на сервере не удалась, но создана локальная версия для просмотра'
                    })

                    // Add dataUrl to state for display
                    setPublishedUrl({
                        url: '#local-preview',
                        dataUrl: result.dataUrl
                    })

                    // Switch to the Published tab
                    setTabValue(2)
                }
            }
        } catch (error) {
            console.error('📱 [ARJSPublisher.handlePublish] Error during publication:', error)
            setError(error instanceof Error ? error.message : 'Unknown error occurred during publication')
        } finally {
            setIsPublishing(false)
        }
    }

    /**
     * Handle cancel button click
     */
    const handleCancel = () => {
        if (onCancel) {
            onCancel()
        }
    }

    // TabPanel for Published content
    const PublishedContent = () => {
        if (!publishedUrl) {
            return (
                <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Typography variant='body1'>Проект ещё не опубликован</Typography>
                </Box>
            )
        }

        const url = typeof publishedUrl === 'object' ? publishedUrl.url : publishedUrl
        const dataUrl = typeof publishedUrl === 'object' ? publishedUrl.dataUrl : null
        const blobUrl = typeof publishedUrl === 'object' ? publishedUrl.blobUrl : null

        return (
            <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant='h6' gutterBottom>
                    AR.js проект опубликован
                </Typography>

                <Paper elevation={2} sx={{ p: 2, mb: 3, wordBreak: 'break-all', bgcolor: 'background.paper' }}>
                    <Typography variant='body2'>URL проекта:</Typography>
                    <Link href={url} target='_blank' rel='noopener' sx={{ wordBreak: 'break-all' }}>
                        {url}
                    </Link>

                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button variant='outlined' size='small' startIcon={<IconCopy />} onClick={() => handleCopyUrl(url)}>
                            Копировать URL
                        </Button>

                        {blobUrl && (
                            <Button
                                variant='outlined'
                                size='small'
                                color='secondary'
                                startIcon={<IconDownload />}
                                onClick={() => window.open(blobUrl, '_blank')}
                            >
                                Открыть HTML
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
                                Открыть HTML (резервный)
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
                AR.js Publisher
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                Создание AR опыта с помощью AR.js
            </Typography>

            <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tab label='Настройка' />
                <Tab label='Предпросмотр' />
                <Tab label='Опубликовано' />
            </Tabs>

            {/* Settings Tab */}
            <TabPanel value={tabValue} index={0}>
                <Card variant='outlined'>
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
                                <TextField
                                    label='Название проекта'
                                    variant='outlined'
                                    fullWidth
                                    value={projectTitle}
                                    onChange={(e) => setProjectTitle(e.target.value)}
                                />

                                <FormControl fullWidth>
                                    <InputLabel id='marker-type-label'>Тип маркера</InputLabel>
                                    <Select
                                        labelId='marker-type-label'
                                        value={markerType}
                                        label='Тип маркера'
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
                                            <MenuItem value='hiro'>Hiro (Стандартный)</MenuItem>
                                            <MenuItem value='kanji'>Kanji</MenuItem>
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

                                <FormGroup>
                                    <FormControlLabel
                                        control={<Switch checked={isPublic} onChange={handlePublicChange} />}
                                        label='Сделать публичным'
                                    />
                                </FormGroup>
                            </Stack>
                        </Box>

                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                            <Button variant='outlined' onClick={handleCancel}>
                                Отмена
                            </Button>
                            <Button variant='contained' onClick={() => setTabValue(1)}>
                                Далее: Предпросмотр
                            </Button>
                        </Box>
                    </CardContent>
                </Card>
            </TabPanel>

            {/* Preview Tab */}
            <TabPanel value={tabValue} index={1}>
                {sceneData ? (
                    <>
                        <Card variant='outlined' sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant='h6' gutterBottom>
                                    HTML предпросмотр
                                </Typography>
                                <Box sx={{ mb: 2 }}>
                                    <Button
                                        variant='outlined'
                                        startIcon={<IconDownload size={18} />}
                                        onClick={handleDownload}
                                        disabled={!htmlPreview}
                                        sx={{ mr: 1 }}
                                    >
                                        Скачать HTML
                                    </Button>
                                    <Button
                                        variant='outlined'
                                        startIcon={<IconCopy size={18} />}
                                        onClick={handleCopy}
                                        disabled={!htmlPreview}
                                    >
                                        Копировать HTML
                                    </Button>
                                </Box>
                                <Alert severity='info' sx={{ mb: 2 }}>
                                    HTML файл с AR.js приложением сгенерирован успешно. Вы можете скачать его или скопировать для размещения
                                    на веб-сервере.
                                </Alert>
                            </CardContent>
                        </Card>

                        <Alert severity='info' sx={{ mb: 3 }}>
                            <Typography variant='subtitle1' gutterBottom>
                                Как протестировать AR опыт
                            </Typography>
                            <ol>
                                <li>Скачайте HTML файл</li>
                                <li>Разместите его на веб-сервере с HTTPS</li>
                                <li>Откройте URL на мобильном устройстве с камерой</li>
                                <li>Направьте камеру на маркер, показанный выше</li>
                            </ol>
                            <Typography variant='body2' color='text.secondary'>
                                Для более простого тестирования вы можете опубликовать проект и поделиться URL
                            </Typography>
                        </Alert>

                        {error && (
                            <Alert severity='error' sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Button variant='outlined' onClick={() => setTabValue(0)}>
                                Назад к настройкам
                            </Button>
                            <Button
                                variant='contained'
                                onClick={handlePublish}
                                disabled={isPublishing}
                                startIcon={isPublishing ? <CircularProgress size={20} /> : null}
                            >
                                {isPublishing ? 'Публикация...' : 'Опубликовать AR.js проект'}
                            </Button>
                        </Box>
                    </>
                ) : (
                    <Alert severity='warning'>Данные сцены не найдены</Alert>
                )}
            </TabPanel>

            {/* Published Tab */}
            <TabPanel value={tabValue} index={2}>
                <PublishedContent />
            </TabPanel>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// Export as both default and named export
export { ARJSPublisher }
export default ARJSPublisher
