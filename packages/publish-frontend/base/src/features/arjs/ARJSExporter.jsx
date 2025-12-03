// Universo Platformo | AR.js Exporter (Demo)
// Demo component for AR.js export (only for UI display)

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// MUI components
import { Button, Box, Typography, Card, CardContent, Alert, Paper, Snackbar } from '@mui/material'

// Icons
import { IconCopy, IconDownload } from '@tabler/icons-react'

/**
 * Marker types in AR.js
 * @enum {string}
 */
const MarkerType = {
    PATTERN: 'pattern',
    BARCODE: 'barcode',
    CUSTOM: 'custom'
}

/**
 * AR.js Exporter Component
 * Note: This component is a demo and does not have real export functionality.
 * Used only for displaying the "Export" tab interface.
 */
const ARJSExporter = ({ flow }) => {
    const { t } = useTranslation('publish')

    // States for interface
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })

    // Demo HTML for display
    const demoHtml = `<!DOCTYPE html>
<html>
    <script src="https://aframe.io/releases/1.6.0/aframe.min.js"></script>
    <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
    <body style="margin: 0px; overflow: hidden;">
        <a-scene embedded arjs>
            <a-marker preset="hiro">
                <a-box position="0 0.5 0" material="color: #FF0000;" scale="1 1 1"></a-box>
            </a-marker>
            <a-entity camera></a-entity>
        </a-scene>
    </body>
</html>`

    /**
     * Demo function for HTML download
     */
    const handleDownload = () => {
        setSnackbar({
            open: true,
            message: t('success.exported') || 'File exported (demo)'
        })
    }

    /**
     * Demo function for copying HTML
     */
    const handleCopy = () => {
        navigator.clipboard
            .writeText(demoHtml)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: t('success.copied') || 'Code copied'
                })
            })
            .catch((error) => {
                setSnackbar({
                    open: true,
                    message: `Failed to copy HTML: ${error.message}`
                })
            })
    }

    /**
     * Closing notification
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
                {t('tabs.export') || 'Экспорт'}
            </Typography>
            <Typography variant='body2' color='text.secondary' paragraph>
                Export AR.js scene for use on your own server or for further modifications
            </Typography>

            <Card variant='outlined' sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant='h6' gutterBottom>
                        Экспорт AR.js
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                        <Button variant='outlined' startIcon={<IconDownload size={18} />} onClick={handleDownload} sx={{ mr: 1 }}>
                            Скачать HTML
                        </Button>
                        <Button variant='outlined' startIcon={<IconCopy size={18} />} onClick={handleCopy}>
                            Копировать HTML
                        </Button>
                    </Box>

                    <Alert severity='info' sx={{ mb: 2 }}>
                        <Typography variant='subtitle1' gutterBottom>
                            Инструкция по использованию
                        </Typography>
                        <ol>
                            <li>Скачайте или скопируйте HTML-код</li>
                            <li>Загрузите файл на свой сервер или откройте локально</li>
                            <li>Откройте URL на мобильном устройстве с камерой</li>
                            <li>Разрешите доступ к камере</li>
                            <li>Направьте камеру на маркер Hiro</li>
                        </ol>
                    </Alert>

                    <Typography variant='body2' color='text.secondary'>
                        Демонстрационная версия. Полноценный экспорт будет доступен в будущих версиях приложения.
                    </Typography>
                </CardContent>
            </Card>

            {/* HTML Code Preview */}
            <Card variant='outlined'>
                <CardContent>
                    <Typography variant='h6' gutterBottom>
                        HTML код
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
                        {demoHtml}
                    </Paper>
                </CardContent>
            </Card>

            <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={handleSnackbarClose} message={snackbar.message} />
        </Box>
    )
}

// Export MarkerType for backward compatibility
export { MarkerType, ARJSExporter }
export default ARJSExporter
