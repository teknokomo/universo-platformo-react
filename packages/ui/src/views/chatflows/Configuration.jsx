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
import canvasesApi from '@/api/canvases'

// utils
import useNotifier from '@/utils/useNotifier'

// Components
import { TooltipWithParser } from '@/ui-component/tooltip/TooltipWithParser'

const Configuration = ({ chatflowid, unikId: propUnikId, displayMode: propDisplayMode, setDisplayMode: propSetDisplayMode }) => {
    const dispatch = useDispatch()
    const chatflow = useSelector((state) => state.canvas.chatflow)
    const { t: tFlow } = useTranslation('canvases')
    const { t: tPub } = useTranslation('publish')
    const { unikId: paramsUnikId } = useParams()
    const unikId = propUnikId || paramsUnikId
    const resolvedSpaceId = chatflow?.spaceId || chatflow?.space_id || null

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
                setError(tFlow('displaySettings.errorLoading', { error: 'missing params' }))
                setIsLoading(false)
                return
            }

            try {
                setIsLoading(true)
                setError(null)

                const res = await canvasesApi.getCanvas(unikId, chatflowid, { spaceId: resolvedSpaceId })

                if (res.data) {
                    // Universo Platformo | Do not update store if data is identical to current
                    if (!chatflow || chatflow.id !== res.data.id) {
                        dispatch({ type: SET_CHATFLOW, chatflow: res.data })
                    }

                    // Universo Platformo | displayMode is now purely local UI state, default to 'chat'
                    updateDisplayMode('chat')
                } else {
                    console.error('API response does not contain data')
                    setError(tFlow('displaySettings.errorLoading', { error: 'empty response' }))
                }
            } catch (error) {
                console.error('Error loading chatflow:', error)
                const fallbackMessage = error?.message || tFlow('displaySettings.errorLoading', { error: 'unknown' })
                setError(fallbackMessage)
                enqueueSnackbar({
                    message: tFlow('displaySettings.errorLoading', { error: error?.message || 'unknown' }),
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
    }, [chatflowid, unikId, propDisplayMode, resolvedSpaceId])

    const handleDisplayModeChange = (event) => {
        const newMode = event.target.value
        updateDisplayMode(newMode)
    }

    if (isLoading) {
        return (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress />
                <Typography>{tFlow('displaySettings.loading')}</Typography>
            </Box>
        )
    }

    if (error) {
        return (
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <Typography color='error' variant='h5'>
                    {tFlow('displaySettings.loadError')}
                </Typography>
                <Typography color='textSecondary'>{error}</Typography>
                <Button variant='contained' onClick={() => window.location.reload()}>
                    {tFlow('displaySettings.tryAgain')}
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
                            disabled
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5' color='text.disabled'>{tPub('technologies.babylonjs')}</Typography>
                                    <Typography variant='caption' color='text.disabled'>({tPub('general.comingSoon')})</Typography>
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
                            disabled
                            label={
                                <Stack direction='row' spacing={1} alignItems='center'>
                                    <Typography variant='h5' color='text.disabled'>{tPub('technologies.aframevr')}</Typography>
                                    <Typography variant='caption' color='text.disabled'>({tPub('general.comingSoon')})</Typography>
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
