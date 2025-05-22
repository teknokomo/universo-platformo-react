// Universo Platformo | AR.js view page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { UPDLToARJSConverter } from '../../utils/UPDLToARJSConverter'
import { ARJSPublishApi } from '../../api/ARJSPublishApi'

/**
 * Страница для просмотра AR контента в режиме потоковой генерации
 */
const ARViewPage: React.FC = () => {
    // Поддерживаем оба варианта параметров: flowId и id для совместимости
    const { flowId, id } = useParams<{ flowId?: string; id?: string }>()
    const publicationId = flowId || id

    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Диагностика параметров URL для отладки
        console.log('🧪 [ARViewPage] URL params:', { flowId, id, publicationId })
        console.log('🧪 [ARViewPage] URL path:', window.location.pathname)

        // Функция для загрузки и рендеринга AR сцены
        const loadARScene = async () => {
            try {
                setLoading(true)
                console.log('📱 [ARViewPage] Loading AR scene for publicationId:', publicationId)

                if (!publicationId) {
                    throw new Error('No publication ID provided')
                }

                // Получаем данные публикации через API
                const publicationData = await ARJSPublishApi.getPublicationData(publicationId)
                console.log('📱 [ARViewPage] Publication data loaded:', publicationData)

                if (!publicationData || !publicationData.updlScene) {
                    throw new Error('No UPDL scene data found in publication')
                }

                // Генерируем HTML с помощью UPDLToARJSConverter
                const html = UPDLToARJSConverter.convertToHTML(publicationData.updlScene, publicationData.projectName || 'AR.js Experience')

                console.log('📱 [ARViewPage] Generated HTML, length:', html.length)

                // Добавляем сгенерированный HTML в DOM
                const container = document.getElementById('ar-container')
                if (container) {
                    // Создаем iframe для изоляции
                    const iframe = document.createElement('iframe')
                    iframe.style.width = '100%'
                    iframe.style.height = '100%'
                    iframe.style.border = 'none'
                    container.appendChild(iframe)

                    // Записываем HTML в iframe
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                    if (iframeDoc) {
                        iframeDoc.open()
                        iframeDoc.write(html)
                        iframeDoc.close()
                    }
                }

                setLoading(false)
            } catch (error) {
                console.error('📱 [ARViewPage] Error loading AR scene:', error)
                setError(error instanceof Error ? error.message : 'Failed to load AR scene')
                setLoading(false)
            }
        }

        if (publicationId) {
            loadARScene()
        } else {
            setError('No publication ID provided')
            setLoading(false)
        }
    }, [publicationId])

    return (
        <Box
            sx={{
                width: '100%',
                height: '100vh',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {loading && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        zIndex: 10,
                        color: 'white'
                    }}
                >
                    <CircularProgress color='primary' size={60} />
                    <Typography variant='h6' sx={{ mt: 2 }}>
                        {t('publish.arjs.loading')}
                    </Typography>
                </Box>
            )}

            {error && (
                <Alert severity='error' sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20 }}>
                    {error}
                </Alert>
            )}

            <div id='ar-container' style={{ width: '100%', height: '100%' }}></div>
        </Box>
    )
}

export default ARViewPage
