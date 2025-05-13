// Universo Platformo | AR.js Publisher Component
// Component for publishing AR.js projects from UPDL flows

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
    Select,
    Switch,
    IconButton,
    Tooltip
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import QrCodeIcon from '@mui/icons-material/QrCode'
import { fetchUPDLScene, publishARJSProject } from '../api/updlApi'
import { arjsExporter } from '../features/arjs/ARJSExporter'
import FileSaver from 'file-saver'

/**
 * Component for publishing AR.js projects
 */
const ARJSPublisher = ({ sceneId, open, onClose }) => {
    // State
    const [scene, setScene] = useState(null)
    const [loading, setLoading] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)
    const [publishUrl, setPublishUrl] = useState('')
    const [snackbarOpen, setSnackbarOpen] = useState(false)
    const [snackbarMessage, setSnackbarMessage] = useState('')
    const [showQRCode, setShowQRCode] = useState(false)

    // Publication options
    const [title, setTitle] = useState('')
    const [markerType, setMarkerType] = useState('pattern')
    const [markerValue, setMarkerValue] = useState('hiro')
    const [isPublic, setIsPublic] = useState(true)

    // Available markers
    const patternMarkers = [
        { value: 'hiro', label: 'Hiro' },
        { value: 'kanji', label: 'Kanji' },
        { value: 'a', label: 'Letter A' },
        { value: 'b', label: 'Letter B' },
        { value: 'c', label: 'Letter C' },
        { value: 'f', label: 'Letter F' }
    ]

    const barcodeMarkers = Array.from({ length: 10 }, (_, i) => ({
        value: `${i}`,
        label: `Barcode ${i}`
    }))

    // Load scene when dialog opens
    useEffect(() => {
        if (open && sceneId) {
            loadScene()
        }
    }, [open, sceneId])

    // Load scene data
    const loadScene = async () => {
        try {
            setLoading(true)
            setError(null)

            const sceneData = await fetchUPDLScene(sceneId)
            setScene(sceneData)

            // Set default title based on scene name
            if (sceneData && sceneData.name && !title) {
                setTitle(`${sceneData.name} - AR.js`)
            }
        } catch (err) {
            console.error('Error loading scene:', err)
            setError('Failed to load scene data')
        } finally {
            setLoading(false)
        }
    }

    // Handle publish button click
    const handlePublish = async () => {
        if (!title) {
            setError('Please enter a title for your publication')
            return
        }

        try {
            setPublishing(true)
            setError(null)

            // Generate HTML using AR.js exporter
            const html = arjsExporter.generateHTML(scene, {
                markerType,
                markerValue,
                title
            })

            // Publish to server
            const result = await publishARJSProject(sceneId, {
                title,
                html,
                markerType,
                markerValue,
                isPublic
            })

            setSuccess('Project published successfully!')
            setPublishUrl(result.data.url)
        } catch (err) {
            console.error('Error publishing:', err)
            setError('Failed to publish AR.js project')
        } finally {
            setPublishing(false)
        }
    }

    // Copy URL to clipboard
    const copyToClipboard = () => {
        const fullUrl = window.location.origin + publishUrl
        navigator.clipboard
            .writeText(fullUrl)
            .then(() => {
                setSnackbarMessage('URL copied to clipboard!')
                setSnackbarOpen(true)
            })
            .catch((err) => {
                console.error('Failed to copy URL:', err)
                setSnackbarMessage('Failed to copy URL')
                setSnackbarOpen(true)
            })
    }

    // Generate QR code
    const generateQRCode = () => {
        setShowQRCode(true)
    }

    // Render QR code dialog
    const renderQRCodeDialog = () => {
        const fullUrl = window.location.origin + publishUrl
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}`

        return (
            <Dialog open={showQRCode} onClose={() => setShowQRCode(false)}>
                <DialogTitle>QR Code for AR.js Project</DialogTitle>
                <DialogContent>
                    <Box display='flex' flexDirection='column' alignItems='center' p={2}>
                        <img src={qrCodeUrl} alt='QR Code' style={{ width: 200, height: 200 }} />
                        <Typography variant='body2' mt={2}>
                            Scan this QR code with your mobile device to access the AR.js project
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowQRCode(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
            <DialogTitle>Publish to AR.js</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Box display='flex' justifyContent='center' alignItems='center' p={4}>
                        <CircularProgress />
                    </Box>
                ) : error ? (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : success ? (
                    <Box mt={2}>
                        <Alert severity='success' sx={{ mb: 2 }}>
                            {success}
                        </Alert>
                        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
                            <Typography variant='subtitle1' gutterBottom>
                                Your AR.js project is published!
                            </Typography>
                            <Box display='flex' alignItems='center' mt={1}>
                                <TextField
                                    fullWidth
                                    variant='outlined'
                                    size='small'
                                    value={window.location.origin + publishUrl}
                                    InputProps={{ readOnly: true }}
                                />
                                <Tooltip title='Copy URL'>
                                    <IconButton onClick={copyToClipboard} sx={{ ml: 1 }}>
                                        <ContentCopyIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title='Generate QR Code'>
                                    <IconButton onClick={generateQRCode} sx={{ ml: 1 }}>
                                        <QrCodeIcon />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        </Paper>
                    </Box>
                ) : (
                    <Box>
                        {!scene ? (
                            <Alert severity='info'>No scene data available</Alert>
                        ) : (
                            <Box component='form' noValidate autoComplete='off'>
                                <TextField
                                    fullWidth
                                    label='Publication Title'
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    margin='normal'
                                    required
                                    error={!title}
                                    helperText={!title ? 'Title is required' : ''}
                                />

                                <FormControl component='fieldset' margin='normal'>
                                    <FormLabel component='legend'>Marker Type</FormLabel>
                                    <RadioGroup row value={markerType} onChange={(e) => setMarkerType(e.target.value)}>
                                        <FormControlLabel value='pattern' control={<Radio />} label='Pattern' />
                                        <FormControlLabel value='barcode' control={<Radio />} label='Barcode' />
                                    </RadioGroup>
                                </FormControl>

                                <FormControl fullWidth margin='normal'>
                                    <InputLabel id='marker-select-label'>Marker</InputLabel>
                                    <Select
                                        labelId='marker-select-label'
                                        value={markerValue}
                                        onChange={(e) => setMarkerValue(e.target.value)}
                                        label='Marker'
                                    >
                                        {(markerType === 'pattern' ? patternMarkers : barcodeMarkers).map((marker) => (
                                            <MenuItem key={marker.value} value={marker.value}>
                                                {marker.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Box display='flex' alignItems='center' mt={2}>
                                    <FormControlLabel
                                        control={
                                            <Switch checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} color='primary' />
                                        }
                                        label='Make Public'
                                    />
                                    <Typography variant='body2' color='textSecondary'>
                                        {isPublic ? 'Anyone with the link can access' : 'Only you can access'}
                                    </Typography>
                                </Box>

                                <Box mt={2}>
                                    <Typography variant='body2' color='textSecondary' paragraph>
                                        This will publish your UPDL scene as an AR.js application. Users will be able to view it using the
                                        selected marker in their camera.
                                    </Typography>

                                    <Alert severity='info' sx={{ mb: 2 }}>
                                        Make sure your scene has at least one object to display in AR.
                                    </Alert>
                                </Box>
                            </Box>
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{success ? 'Close' : 'Cancel'}</Button>
                {!success && (
                    <Button onClick={handlePublish} disabled={publishing || !scene} variant='contained' color='primary'>
                        {publishing ? <CircularProgress size={24} /> : 'Publish'}
                    </Button>
                )}
            </DialogActions>

            {/* Snackbar for notifications */}
            <Snackbar open={snackbarOpen} autoHideDuration={4000} onClose={() => setSnackbarOpen(false)} message={snackbarMessage} />

            {/* QR Code Dialog */}
            {renderQRCodeDialog()}
        </Dialog>
    )
}

export default ARJSPublisher
