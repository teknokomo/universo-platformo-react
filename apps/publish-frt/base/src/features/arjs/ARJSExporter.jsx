// Universo Platformo | AR.js Exporter
// React component for exporting AR.js experiences

import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// MUI components
import { Button, Box, Typography, Card, CardContent, Alert, Paper, Snackbar, Link, Stack } from '@mui/material'

// Icons
import { IconCopy, IconDownload } from '@tabler/icons-react'

/**
 * AR.js Exporter Component
 */
const ARJSExporter = ({ flow, unikId }) => {
    const { t } = useTranslation('publish')

    // State for HTML preview
    const [htmlPreview, setHtmlPreview] = useState('')
    // State for scene data
    const [sceneData, setSceneData] = useState(null)
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
            generateHtmlPreview()
        }
    }, [flow])

    /**
     * Generate HTML preview using the ARJSExporter utility
     */
    const generateHtmlPreview = () => {
        try {
            if (!sceneData) return

            // This is a simplified HTML generation for demonstration
            // In a real implementation, you would use the actual ARJSExporter utility
            const html = `<!DOCTYPE html>
<html>
    <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <body style="margin : 0px; overflow: hidden;">
        <a-scene embedded arjs>
            <a-marker preset="hiro">
                <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>
    </body>
</html>`

            setHtmlPreview(html)
        } catch (error) {
            console.error('Error generating HTML preview:', error)
            setSnackbar({
                open: true,
                message: `Ошибка генерации HTML: ${error.message || 'Неизвестная ошибка'}`
            })
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
        element.download = `${sceneData?.name || 'ar-scene'}.html`
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)

        setSnackbar({
            open: true,
            message: t('success.exported')
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
                    message: t('success.copied')
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
     * Handle snackbar close
     */
    const handleSnackbarClose = () => {
        setSnackbar({
            ...snackbar,
            open: false
        })
    }

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant='h4' gutterBottom>
                {t('tabs.export')}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                {t('export.description')}
            </Typography>

            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant='h6' gutterBottom>
                        {t('export.title') || 'Экспорт'}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                        <Button
                            variant='outlined'
                            startIcon={<IconDownload size={18} />}
                            onClick={handleDownload}
                            disabled={!htmlPreview}
                            sx={{ mr: 1 }}
                        >
                            {t('actions.download')}
                        </Button>
                        <Button variant='outlined' startIcon={<IconCopy size={18} />} onClick={handleCopy} disabled={!htmlPreview}>
                            {t('actions.copy')}
                        </Button>
                    </Box>

                    <Alert severity='info' sx={{ mb: 2 }}>
                        <Typography variant='subtitle1' gutterBottom>
                            {t('export.instructions')}
                        </Typography>
                        <ol>
                            <li>{t('export.downloadInstructions')}</li>
                            <li>Откройте URL на мобильном устройстве с камерой</li>
                            <li>Разрешите доступ к камере</li>
                            <li>Направьте камеру на маркер Hiro</li>
                        </ol>
                    </Alert>
                </CardContent>
            </Card>

            {/* HTML Code Preview */}
            <Card variant='outlined'>
                <CardContent>
                    <Typography variant='h6' gutterBottom>
                        {t('export.html')}
                    </Typography>
                    <Paper
                        elevation={0}
                        variant='outlined'
                        sx={{
                            p: 2,
                            maxHeight: '400px',
                            overflow: 'auto',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all'
                        }}
                    >
                        {htmlPreview}
                    </Paper>
                </CardContent>
            </Card>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

export { ARJSExporter }
export default ARJSExporter

// Universo Platformo | Runtime export for MarkerType enum
export const MarkerType = {
    PATTERN: 'pattern',
    BARCODE: 'barcode',
    CUSTOM: 'custom'
}
