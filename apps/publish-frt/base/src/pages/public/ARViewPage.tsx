// Universo Platformo | AR.js view page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ARJSExporter } from '../../features/arjs/ARJSExporter'
import { UPDLScene } from '../../api/updlApi'

/**
 * Страница для просмотра AR контента в режиме потоковой генерации
 */
const ARViewPage: React.FC = () => {
    const { flowId } = useParams<{ flowId: string }>()
    const { t } = useTranslation()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // Функция для загрузки и рендеринга AR сцены
        const loadARScene = async () => {
            try {
                setLoading(true)
                console.log('📱 [ARViewPage] Loading AR scene for flowId:', flowId)

                // 1. Загрузить данные chatflow
                const response = await fetch(`/api/chatflows/${flowId}`)
                if (!response.ok) {
                    throw new Error(`Failed to load flow data: ${response.status}`)
                }

                const chatflow = await response.json()
                console.log('📱 [ARViewPage] Loaded chatflow data:', chatflow)

                if (!chatflow || !chatflow.flowData) {
                    throw new Error('Could not load chatflow data')
                }

                // 2. Преобразовать данные flowData в UPDL сцену
                const flowData = JSON.parse(chatflow.flowData)
                console.log('📱 [ARViewPage] Parsed flow data, nodes:', flowData.nodes?.length || 0)

                // Подготовить базовую структуру данных с узлами для передачи в экспортер
                const nodeData = {
                    id: chatflow.id,
                    name: chatflow.name,
                    nodes: flowData.nodes || []
                }

                // 3. Сгенерировать HTML с помощью ARJSExporter
                const exporter = new ARJSExporter()

                // ARJSExporter автоматически обрабатывает структуру с nodes, преобразуя ее в UPDLScene
                // Используем явное приведение типа, так как тип содержит узлы, а не стандартную структуру UPDLScene
                const html = exporter.generateHTML(nodeData as any, {
                    title: chatflow.name || 'AR.js Experience',
                    markerType: 'pattern',
                    markerValue: 'hiro'
                })

                console.log('📱 [ARViewPage] Generated HTML, length:', html.length)

                // 4. Добавить сгенерированный HTML в DOM
                const container = document.getElementById('ar-container')
                if (container) {
                    // Создать iframe для изоляции
                    const iframe = document.createElement('iframe')
                    iframe.style.width = '100%'
                    iframe.style.height = '100%'
                    iframe.style.border = 'none'
                    container.appendChild(iframe)

                    // Записать HTML в iframe
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
                    if (iframeDoc) {
                        iframeDoc.open()
                        iframeDoc.write(html)
                        iframeDoc.close()
                    }
                }

                setLoading(false)
            } catch (error) {
                console.error('Error loading AR scene:', error)
                setError(error instanceof Error ? error.message : 'Failed to load AR scene')
                setLoading(false)
            }
        }

        if (flowId) {
            loadARScene()
        } else {
            setError('No flow ID provided')
            setLoading(false)
        }
    }, [flowId])

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
