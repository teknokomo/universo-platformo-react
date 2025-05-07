// Universo Platformo | Configuration component for selecting bot mode
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Box, Typography, Button, FormControl, FormControlLabel, Radio, RadioGroup, Paper, Stack, CircularProgress } from '@mui/material'

// Icons
import { IconX } from '@tabler/icons-react'

// API
import chatflowsApi from '@/api/chatflows'

// utils
import useNotifier from '@/utils/useNotifier'

// Components
import { TooltipWithParser } from '@/ui-component/tooltip/TooltipWithParser'

const Configuration = ({ chatflowid, unikId: propUnikId, displayMode: propDisplayMode, setDisplayMode: propSetDisplayMode }) => {
    const dispatch = useDispatch()
    const chatflow = useSelector((state) => state.canvas.chatflow)
    const { t: tFlow } = useTranslation('chatflows')
    const { t: tPub } = useTranslation('publish')
    const { unikId: paramsUnikId } = useParams()
    const unikId = propUnikId || paramsUnikId

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    // Universo Platformo | Local state or from props
    const [localDisplayMode, setLocalDisplayMode] = useState(propDisplayMode || 'chat')
    const [isLoading, setIsLoading] = useState(!propDisplayMode) // If propDisplayMode is set, do not load
    const [error, setError] = useState(null)

    // Universo Platformo | Use either the passed function from props or local update logic
    const updateDisplayMode = (mode) => {
        if (propSetDisplayMode) {
            propSetDisplayMode(mode) // Update parent state
        }
        setLocalDisplayMode(mode) // Update local state
    }

    // Universo Platformo | Get the current value of displayMode
    const displayMode = propDisplayMode !== undefined ? propDisplayMode : localDisplayMode

    useEffect(() => {
        // Universo Platformo | If displayMode is passed via props, do not load
        if (propDisplayMode !== undefined) {
            setIsLoading(false)
            return
        }

        const fetchChatflow = async () => {
            if (!chatflowid || !unikId) {
                console.error('Missing required parameters:', { chatflowid, unikId })
                setError('Отсутствуют необходимые параметры для загрузки настроек')
                setIsLoading(false)
                return
            }

            try {
                setIsLoading(true)
                setError(null)

                console.log(`Выполняем запрос chatflowsApi.getChatflowById(${unikId}, ${chatflowid})`)
                const res = await chatflowsApi.getChatflowById(unikId, chatflowid)

                console.log('Получен ответ от API:', res)

                if (res.data) {
                    // Universo Platformo | Do not update store if data is identical to current
                    if (!chatflow || chatflow.id !== res.data.id) {
                        dispatch({ type: SET_CHATFLOW, chatflow: res.data })
                    }

                    // Universo Platformo | Determine the current display mode
                    let mode = 'chat' // Default

                    if (res.data.chatbotConfig) {
                        try {
                            const botConfig = JSON.parse(res.data.chatbotConfig)
                            if (botConfig.botType === 'ar') {
                                mode = 'ar'
                            }
                        } catch (error) {
                            console.error('Ошибка при парсинге chatbotConfig:', error)
                        }
                    }

                    updateDisplayMode(mode)
                } else {
                    console.error('Ответ API не содержит данных')
                    setError('Ошибка загрузки данных: ответ API не содержит данных')
                }
            } catch (error) {
                console.error('Ошибка при загрузке chatflow:', error)

                setError(error.message || 'Ошибка при загрузке настроек отображения')

                enqueueSnackbar({
                    message: 'Ошибка загрузки настроек: ' + (error.message || 'Неизвестная ошибка'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchChatflow()
    }, [chatflowid, unikId, propDisplayMode])

    const handleDisplayModeChange = async (event) => {
        const newMode = event.target.value
        updateDisplayMode(newMode)

        try {
            // Universo Platformo | Get the current bot configuration or create a new one
            let botConfig = {}
            if (chatflow && chatflow.chatbotConfig) {
                try {
                    botConfig = JSON.parse(chatflow.chatbotConfig)
                } catch (error) {
                    console.error('Ошибка при парсинге chatbotConfig:', error)
                }
            }

            // Universo Platformo | Update bot type
            botConfig.botType = newMode

            // Universo Platformo | Save the updated configuration
            const saveResp = await chatflowsApi.updateChatflow(unikId, chatflowid, {
                chatbotConfig: JSON.stringify(botConfig)
            })

            if (saveResp.data) {
                dispatch({ type: SET_CHATFLOW, chatflow: saveResp.data })
                enqueueSnackbar({
                    message: tFlow('chatflows.configuration.saveMode'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
            }
        } catch (error) {
            console.error('Ошибка при сохранении режима отображения:', error)
            enqueueSnackbar({
                message: tFlow('chatflows.displaySettings.saveError'),
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress />
                <Typography>{tFlow('chatflows.displaySettings.loading')}</Typography>
            </Box>
        )
    }

    if (error) {
        return (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Typography color='error' variant='h5'>
                    {tFlow('chatflows.displaySettings.loadError')}
                </Typography>
                <Typography color='textSecondary'>{error}</Typography>
                <Button variant='contained' onClick={() => window.location.reload()}>
                    {tFlow('chatflows.displaySettings.tryAgain')}
                </Button>
            </Box>
        )
    }

    return (
        <Box sx={{ p: 2 }}>
            <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
                <Typography variant='h4' gutterBottom>
                    {tPub('configuration.title')}
                </Typography>
                <Typography variant='body1' sx={{ mb: 2 }}>
                    {tPub('configuration.description')}
                </Typography>

                <FormControl component='fieldset' sx={{ my: 2 }}>
                    <Typography variant='subtitle1' gutterBottom sx={{ fontWeight: 'bold' }}>
                        {tPub('configuration.chooseMode')}
                    </Typography>
                    <RadioGroup aria-label='display-mode' name='display-mode' value={displayMode} onChange={handleDisplayModeChange}>
                        <FormControlLabel
                            value='chat'
                            control={<Radio />}
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5'>{tPub('technologies.chat')}</Typography>
                                    <TooltipWithParser title={tPub('technologies.chatDescription')}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                bgcolor: 'info.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ?
                                        </Box>
                                    </TooltipWithParser>
                                </Stack>
                            }
                        />
                        <FormControlLabel
                            value='arjs'
                            control={<Radio />}
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5'>{tPub('technologies.arjs')}</Typography>
                                    <TooltipWithParser title={tPub('technologies.arjsDescription')}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                bgcolor: 'info.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ?
                                        </Box>
                                    </TooltipWithParser>
                                </Stack>
                            }
                        />
                        <FormControlLabel
                            value='playcanvas'
                            control={<Radio />}
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5'>{tPub('technologies.playcanvas')}</Typography>
                                    <TooltipWithParser title={tPub('technologies.playcanvasDescription')}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                bgcolor: 'info.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ?
                                        </Box>
                                    </TooltipWithParser>
                                </Stack>
                            }
                        />
                        <FormControlLabel
                            value='babylonjs'
                            control={<Radio />}
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5'>{tPub('technologies.babylonjs')}</Typography>
                                    <TooltipWithParser title={tPub('technologies.babylonjsDescription')}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                bgcolor: 'info.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ?
                                        </Box>
                                    </TooltipWithParser>
                                </Stack>
                            }
                        />
                        <FormControlLabel
                            value='aframevr'
                            control={<Radio />}
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5'>{tPub('technologies.aframevr')}</Typography>
                                    <TooltipWithParser title={tPub('technologies.aframevrDescription')}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: '50%',
                                                bgcolor: 'info.main',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            ?
                                        </Box>
                                    </TooltipWithParser>
                                </Stack>
                            }
                        />
                    </RadioGroup>
                </FormControl>
            </Paper>
        </Box>
    )
}

Configuration.propTypes = {
    chatflowid: PropTypes.string.isRequired,
    unikId: PropTypes.string,
    displayMode: PropTypes.string,
    setDisplayMode: PropTypes.func
}

export default Configuration
