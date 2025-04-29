import React, { useState, useEffect } from 'react'
import {
    Container,
    Box,
    Typography,
    Button,
    TextField,
    FormControl,
    FormLabel,
    RadioGroup,
    Radio,
    FormControlLabel,
    CircularProgress,
    Alert,
    Paper,
    Snackbar,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    InputLabel,
    MenuItem,
    Select
} from '@mui/material'
import { fetchUPDLScene, publishARJSProject } from '../api/updlApi'
import { arjsExporter } from '../miniapps/arjs/ARJSExporter'
import FileSaver from 'file-saver'

/**
 * Component for publishing AR.js projects
 */
const ARJSPublisher = ({ sceneId, open, onClose }) => {
    const [scene, setScene] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [generatedHTML, setGeneratedHTML] = useState('')
    const [title, setTitle] = useState('')
    const [publishStatus, setPublishStatus] = useState('')
    const [markerType, setMarkerType] = useState('hiro')
    const [patternFile, setPatternFile] = useState('')
    const [barcodeValue, setBarcodeValue] = useState(0)
    const [snackbarOpen, setSnackbarOpen] = useState(false)
    const [snackbarMessage, setSnackbarMessage] = useState('')

    // Load scene data when component mounts
    useEffect(() => {
        const loadScene = async () => {
            try {
                setLoading(true)
                setError(null)

                const data = await fetchUPDLScene(sceneId)

                if (data && data.scene) {
                    setScene(data.scene)
                    setTitle(data.scene.name || 'AR.js Scene')

                    // Generate HTML with the loaded scene
                    try {
                        const html = arjsExporter.generateHTML(
                            data.scene,
                            markerType,
                            markerType === 'pattern' ? patternFile : undefined,
                            markerType === 'barcode' ? barcodeValue : undefined
                        )
                        setGeneratedHTML(html)
                    } catch (genError) {
                        console.error('Error generating HTML:', genError)
                        setError(`Error generating AR.js HTML: ${genError.message}`)
                    }
                } else {
                    setError('Failed to load scene data: Empty response')
                }
            } catch (err) {
                console.error('Error loading scene:', err)
                setError(`Failed to load scene: ${err.message}`)
            } finally {
                setLoading(false)
            }
        }

        if (open && sceneId) {
            loadScene()
        }
    }, [open, sceneId])

    // Update HTML when marker type or other options change
    useEffect(() => {
        if (scene) {
            try {
                const html = arjsExporter.generateHTML(
                    scene,
                    markerType,
                    markerType === 'pattern' ? patternFile : undefined,
                    markerType === 'barcode' ? parseInt(barcodeValue) : undefined
                )
                setGeneratedHTML(html)
            } catch (err) {
                console.error('Error updating HTML:', err)
                setError(`Error updating AR.js HTML: ${err.message}`)
            }
        }
    }, [scene, markerType, patternFile, barcodeValue])

    // Handle download HTML
    const handleDownloadHTML = () => {
        if (!generatedHTML) {
            setSnackbarMessage('No HTML content to download')
            setSnackbarOpen(true)
            return
        }

        // Create a Blob with the HTML content
        const blob = new Blob([generatedHTML], { type: 'text/html;charset=utf-8' })

        // Use FileSaver to download the file
        FileSaver.saveAs(blob, `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`)

        setSnackbarMessage('HTML файл успешно скачан')
        setSnackbarOpen(true)
    }

    // Handle publish project
    const handlePublish = async () => {
        if (!generatedHTML) {
            setSnackbarMessage('No HTML content to publish')
            setSnackbarOpen(true)
            return
        }

        try {
            setPublishStatus('publishing')

            const response = await publishARJSProject({
                sceneId,
                html: generatedHTML,
                title: title || 'AR.js Scene'
            })

            if (response && response.success) {
                setPublishStatus('success')
                setSnackbarMessage('Проект успешно опубликован!')
                setSnackbarOpen(true)
                onClose(response.data)
            } else {
                setPublishStatus('error')
                setError(`Failed to publish: ${response.message || 'Unknown error'}`)
            }
        } catch (err) {
            console.error('Error publishing project:', err)
            setPublishStatus('error')
            setError(`Failed to publish project: ${err.message}`)
        }
    }

    // Handle marker type change
    const handleMarkerTypeChange = (event) => {
        const newMarkerType = event.target.value
        setMarkerType(newMarkerType)

        // Regenerate HTML with new marker type
        if (scene) {
            try {
                const html = arjsExporter.generateHTML(
                    scene,
                    newMarkerType,
                    newMarkerType === 'pattern' ? patternFile : undefined,
                    newMarkerType === 'barcode' ? parseInt(barcodeValue) : undefined
                )
                setGeneratedHTML(html)
            } catch (err) {
                console.error('Error updating HTML:', err)
                setError(`Error updating AR.js HTML: ${err.message}`)
            }
        }
    }

    // Handle title change
    const handleTitleChange = (event) => {
        const newTitle = event.target.value
        setTitle(newTitle)

        // Regenerate HTML with new title
        if (scene) {
            try {
                const html = arjsExporter.generateHTML(
                    scene,
                    markerType,
                    markerType === 'pattern' ? patternFile : undefined,
                    markerType === 'barcode' ? parseInt(barcodeValue) : undefined
                )
                setGeneratedHTML(html)
            } catch (err) {
                console.error('Error updating HTML:', err)
                setError(`Error updating AR.js HTML: ${err.message}`)
            }
        }
    }

    if (loading) {
        return (
            <Box display='flex' justifyContent='center' alignItems='center' minHeight='300px'>
                <CircularProgress />
            </Box>
        )
    }

    if (error) {
        return (
            <Box p={3}>
                <Alert severity='error'>{error}</Alert>
                <Box mt={2} display='flex' justifyContent='center'>
                    <Button variant='contained' onClick={onClose}>
                        Закрыть
                    </Button>
                </Box>
            </Box>
        )
    }

    return (
        <>
            <Dialog open={open} onClose={() => onClose()} maxWidth='md' fullWidth>
                <DialogTitle>Publish AR.js Project</DialogTitle>

                <DialogContent>
                    {loading && (
                        <Box display='flex' justifyContent='center' my={4}>
                            <CircularProgress />
                        </Box>
                    )}

                    {error && (
                        <Alert severity='error' sx={{ mt: 2, mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {!loading && scene && (
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                label='Project Title'
                                value={title}
                                onChange={handleTitleChange}
                                margin='normal'
                                variant='outlined'
                            />

                            <FormControl fullWidth margin='normal'>
                                <InputLabel>Marker Type</InputLabel>
                                <Select value={markerType} onChange={handleMarkerTypeChange} label='Marker Type'>
                                    <MenuItem value='hiro'>Hiro (Default)</MenuItem>
                                    <MenuItem value='kanji'>Kanji</MenuItem>
                                    <MenuItem value='pattern'>Custom Pattern</MenuItem>
                                    <MenuItem value='barcode'>Barcode</MenuItem>
                                </Select>
                            </FormControl>

                            {markerType === 'pattern' && (
                                <Typography variant='body2' color='textSecondary' sx={{ mt: 1 }}>
                                    Note: Custom pattern marker requires a pattern file URL. You can create patterns at{' '}
                                    <a
                                        href='https://jeromeetienne.github.io/AR.js/three.js/examples/marker-training/examples/generator.html'
                                        target='_blank'
                                        rel='noopener noreferrer'
                                    >
                                        AR.js Pattern Maker
                                    </a>
                                </Typography>
                            )}

                            {markerType === 'barcode' && (
                                <Typography variant='body2' color='textSecondary' sx={{ mt: 1 }}>
                                    Note: Barcode markers are numeric values (0-63). The default is 0.
                                </Typography>
                            )}

                            <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                                <Typography variant='h6' sx={{ mb: 1 }}>
                                    Preview
                                </Typography>
                                <Typography variant='body2' color='textSecondary'>
                                    Scene has {scene.objects?.length || 0} objects, {scene.cameras?.length || 0} cameras, and{' '}
                                    {scene.lights?.length || 0} lights.
                                </Typography>
                                <Typography variant='body2' sx={{ mt: 1 }}>
                                    AR content will be displayed on a{' '}
                                    {markerType === 'hiro' ? 'Hiro' : markerType === 'kanji' ? 'Kanji' : 'custom'} marker.
                                </Typography>
                            </Box>
                        </Box>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => onClose()} color='secondary'>
                        Cancel
                    </Button>

                    <Button onClick={handleDownloadHTML} color='primary' disabled={loading || !scene}>
                        Download HTML
                    </Button>

                    <Button onClick={handlePublish} color='primary' variant='contained' disabled={loading || !scene}>
                        {loading ? <CircularProgress size={24} /> : 'Publish'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={snackbarOpen}
                autoHideDuration={6000}
                onClose={() => setSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbarOpen(false)} severity='success'>
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </>
    )
}

export default ARJSPublisher
