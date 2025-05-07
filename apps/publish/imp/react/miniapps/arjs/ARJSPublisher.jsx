// Universo Platformo | AR.js Publisher
// React component for publishing AR.js experiences

import React, { useState, useEffect } from 'react'
import { publishARJSFlow } from '../../services/api'
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
    FormGroup
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
    const handleCopyUrl = () => {
        if (publishedUrl) {
            navigator.clipboard.writeText(window.location.origin + publishedUrl)
            setSnackbar({
                open: true,
                message: 'URL скопирован в буфер обмена'
            })
        }
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

        setIsPublishing(true)
        setError(null)

        try {
            // Prepare options
            const options = {
                marker: markerValue,
                markerType: markerType === 'preset' ? 'pattern' : markerType,
                isPublic,
                title: projectTitle,
                unikId
            }

            // Call API to publish AR.js flow
            const result = await publishARJSFlow(flow.id, options)

            if (result.success) {
                // Set published URL
                setPublishedUrl(result.publishedUrl)
                setSnackbar({
                    open: true,
                    message: 'Проект опубликован успешно!'
                })

                // Switch to Published tab
                setTabValue(2)

                // Notify parent component
                if (onPublish) {
                    onPublish(result)
                }
            } else {
                throw new Error(result.error || 'Failed to publish AR.js experience')
            }
        } catch (err) {
            setError(err?.message || 'Failed to publish AR.js experience')
            console.error('Error publishing AR.js flow:', err)
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
                {publishedUrl ? (
                    <Card variant='outlined'>
                        <CardContent>
                            <Stack spacing={3}>
                                <div>
                                    <Typography variant='subtitle2'>Название проекта:</Typography>
                                    <Typography variant='body1'>{projectTitle}</Typography>
                                </div>

                                <div>
                                    <Typography variant='subtitle2'>Публичный URL:</Typography>
                                    <TextField
                                        value={window.location.origin + publishedUrl}
                                        fullWidth
                                        InputProps={{
                                            readOnly: true,
                                            endAdornment: (
                                                <Button onClick={handleCopyUrl} startIcon={<IconCopy size={18} />}>
                                                    Копировать
                                                </Button>
                                            )
                                        }}
                                    />
                                </div>

                                <div>
                                    <Typography variant='subtitle2'>QR-код:</Typography>
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            p: 3,
                                            bgcolor: 'white',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: 1,
                                            mt: 1
                                        }}
                                    >
                                        {QRCode ? (
                                            <QRCode value={window.location.origin + publishedUrl} size={200} className='qrcode-container' />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: 200,
                                                    height: 200,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                            >
                                                <IconQrcode size={100} color='text.secondary' />
                                            </Box>
                                        )}
                                        <Button
                                            variant='outlined'
                                            startIcon={<IconDownload size={18} />}
                                            sx={{ mt: 2 }}
                                            // Скачивание QR-кода отключено, если библиотека не загружена
                                            disabled={!QRCode}
                                            onClick={() => {
                                                const canvas = document.querySelector('.qrcode-container canvas')
                                                if (canvas) {
                                                    const link = document.createElement('a')
                                                    link.download = `${projectTitle}-qrcode.png`
                                                    link.href = canvas.toDataURL('image/png')
                                                    link.click()
                                                }
                                            }}
                                        >
                                            Скачать QR-код
                                        </Button>
                                    </Box>
                                </div>

                                <Button
                                    variant='contained'
                                    href={window.location.origin + publishedUrl}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    Открыть публикацию
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                ) : (
                    <Alert severity='info'>Проект еще не опубликован. Сначала опубликуйте ваш AR.js проект.</Alert>
                )}
            </TabPanel>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// Export as both default and named export
export { ARJSPublisher }
export default ARJSPublisher
