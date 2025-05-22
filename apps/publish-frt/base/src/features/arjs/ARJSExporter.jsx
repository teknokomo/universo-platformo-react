// Universo Platformo | AR.js Exporter (Demo)
// Демо-компонент экспорта AR.js (только для демонстрации UI)

import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

// MUI components
import { Button, Box, Typography, Card, CardContent, Alert, Paper, Snackbar, Link } from '@mui/material'

// Icons
import { IconCopy, IconDownload } from '@tabler/icons-react'

/**
 * Типы маркеров в AR.js
 * @enum {string}
 */
const MarkerType = {
    PATTERN: 'pattern',
    BARCODE: 'barcode',
    CUSTOM: 'custom'
}

/**
 * AR.js Exporter Component
 * Внимание: Этот компонент является демонстрационным и не имеет реальной функциональности экспорта.
 * Используется только для отображения интерфейса вкладки "Экспорт".
 */
const ARJSExporter = ({ flow }) => {
    const { t } = useTranslation('publish')

    // Состояния для интерфейса
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })

    // Пример HTML для демонстрации
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
     * Демо функция загрузки HTML
     */
    const handleDownload = () => {
        setSnackbar({
            open: true,
            message: t('success.exported') || 'Файл экспортирован (демо)'
        })
    }

    /**
     * Демо функция копирования HTML
     */
    const handleCopy = () => {
        navigator.clipboard
            .writeText(demoHtml)
            .then(() => {
                setSnackbar({
                    open: true,
                    message: t('success.copied') || 'Код скопирован'
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
     * Закрытие уведомления
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
                Экспортируйте AR.js сцену для использования на собственном сервере или для дальнейших модификаций
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

// Экспортируем MarkerType для обратной совместимости
export { MarkerType, ARJSExporter }
export default ARJSExporter
