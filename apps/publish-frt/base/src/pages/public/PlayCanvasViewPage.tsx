import React, { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { UPDLProcessor } from '@universo-platformo/utils'
import { TemplateRegistry } from '../../builders/common/TemplateRegistry'

interface PlayCanvasViewPageProps {
    flowData?: string
    config?: Record<string, any> | null
    projectName?: string
}

const DEFAULT_COLYSEUS_SETTINGS = {
    serverHost: 'localhost',
    serverPort: 2567,
    roomName: 'mmoomm_room'
}

const PlayCanvasViewPage: React.FC<PlayCanvasViewPageProps> = ({ flowData, config, projectName }) => {
    const { t } = useTranslation('publish')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [htmlContent, setHtmlContent] = useState<string>('')

    useEffect(() => {
        const renderPlayCanvasExperience = async () => {
            if (!flowData || !config) {
                setError(t('publish.publicFlow.errors.missingFlow', 'Данные публикации отсутствуют'))
                setLoading(false)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const processedData = UPDLProcessor.processFlowData(flowData)

                const templateId =
                    (config.templateId === 'mmoomm' ? 'mmoomm-playcanvas' : config.templateId) || 'mmoomm-playcanvas'
                const builder = TemplateRegistry.createBuilder(templateId)

                const buildOptions = {
                    projectName: config.projectTitle || projectName || 'PlayCanvas Application',
                    libraryConfig: config.libraryConfig || { playcanvas: { version: '2.9.0' } },
                    demoMode: config.demoMode || 'off',
                    gameMode: config.gameMode || 'singleplayer',
                    multiplayer: config.colyseusSettings || DEFAULT_COLYSEUS_SETTINGS
                }

                const generatedHTML = await builder.build(
                    {
                        updlSpace: processedData.updlSpace,
                        multiScene: processedData.multiScene
                    },
                    buildOptions
                )

                if (!generatedHTML) {
                    throw new Error('Failed to generate PlayCanvas HTML')
                }

                setHtmlContent(generatedHTML)
            } catch (renderError) {
                const message =
                    renderError instanceof Error && renderError.message
                        ? renderError.message
                        : t('publish.publicFlow.errors.renderFailed', 'Не удалось отобразить публикацию')
                setError(message)
            } finally {
                setLoading(false)
            }
        }

        renderPlayCanvasExperience()
    }, [config, flowData, projectName, t])

    useEffect(() => {
        if (!htmlContent || loading || error) {
            return
        }

        const container = document.getElementById('playcanvas-container')
        if (!container) {
            setError(t('publish.publicFlow.errors.renderFailed', 'Не удалось отобразить публикацию'))
            return
        }

        container.innerHTML = ''

        const iframe = document.createElement('iframe')
        iframe.style.width = '100%'
        iframe.style.height = '100%'
        iframe.style.border = 'none'
        iframe.title = 'PlayCanvas Application'
        iframe.srcdoc = htmlContent
        container.appendChild(iframe)
    }, [error, htmlContent, loading, t])

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
                        {t('publish.playcanvas.loading', 'Загрузка PlayCanvas приложения...')}
                    </Typography>
                </Box>
            )}

            {error && (
                <Alert severity='error' sx={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 20 }}>
                    {error}
                </Alert>
            )}

            <div id='playcanvas-container' style={{ width: '100%', height: '100%' }} />
        </Box>
    )
}

export default PlayCanvasViewPage
