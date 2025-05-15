// Universo Platformo | Public AR.js viewer page
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Box, CircularProgress, Typography, Container, Paper } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { ARJSPublishApi } from '../../api/ARJSPublishApi'
import { UPDLToARJSConverter } from '../../utils/UPDLToARJSConverter'

/**
 * Компонент для публичного просмотра AR.js по UUID публикации
 */
export const ARView: React.FC = () => {
    const { id } = useParams<{ id: string }>()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const { t } = useTranslation()

    useEffect(() => {
        // Функция для загрузки и генерации AR сцены
        const loadARScene = async () => {
            try {
                if (!id) {
                    throw new Error('Publication ID is missing')
                }

                setLoading(true)
                console.log(`[ARView] Loading AR scene for publication ID: ${id}`)

                // Получаем данные публикации и UPDL по UUID
                const publication = await ARJSPublishApi.getPublicationData(id)
                console.log(`[ARView] Retrieved publication data:`, publication)

                // Проверяем режим генерации (по умолчанию streaming)
                const generationMode = publication.generationMode || 'streaming'
                console.log(`[ARView] Publication generation mode: ${generationMode}`)

                if (generationMode === 'streaming') {
                    console.log('[ARView] Using client-side streaming generation')

                    // Генерируем HTML-код AR.js напрямую из UPDL-данных на стороне клиента
                    const htmlCode = UPDLToARJSConverter.convertToHTML(publication.updlScene, publication.projectName)

                    // Внедряем сгенерированный HTML в страницу
                    document.open()
                    document.write(htmlCode)
                    document.close()
                } else {
                    // В будущем здесь будет логика для обработки предварительно сгенерированного HTML
                    console.log('[ARView] Pre-generation mode not yet implemented, falling back to streaming')

                    // Пока используем тот же метод, что и для streaming
                    const htmlCode = UPDLToARJSConverter.convertToHTML(publication.updlScene, publication.projectName)
                    document.open()
                    document.write(htmlCode)
                    document.close()
                }
            } catch (err) {
                console.error('Error loading AR scene:', err)
                setError(t('publish.errors.loadingFailed'))
                setLoading(false)
            }
        }

        loadARScene()
    }, [id, t])

    // Показываем экран загрузки, пока идет процесс
    if (loading && error === null) {
        return (
            <Container
                maxWidth='sm'
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <CircularProgress size={60} thickness={4} sx={{ mb: 3 }} />
                <Typography variant='h6' align='center'>
                    {t('publish.arjs.loading')}
                </Typography>
            </Container>
        )
    }

    // Показываем ошибку, если что-то пошло не так
    if (error) {
        return (
            <Container
                maxWidth='sm'
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}
            >
                <Paper
                    elevation={3}
                    sx={{
                        p: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRadius: 2
                    }}
                >
                    <ErrorOutlineIcon color='error' sx={{ fontSize: 60, mb: 2 }} />
                    <Typography variant='h5' component='h1' gutterBottom>
                        {t('errors.generic')}
                    </Typography>
                    <Typography variant='body1' align='center' color='text.secondary'>
                        {error}
                    </Typography>
                </Paper>
            </Container>
        )
    }

    // Пустой контейнер, т.к. страница будет полностью перезаписана с AR контентом
    return <Box id='ar-container' />
}

export default ARView
