import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Button, Box } from '@mui/material'
import { IconX } from '@tabler/icons-react'

// Project import
import { StyledButton } from '../button/StyledButton'
import { SwitchInput } from '../switch/Switch'
import resolveCanvasContext from '../utils/resolveCanvasContext'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CANVAS } from '@flowise/store'
import useNotifier from '@flowise/template-mui/hooks/useNotifier'

// API
import { api } from '@universo/api-client'

const ChatFeedback = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const { canvas, canvasId, spaceId, unikId } = resolveCanvasContext(dialogProps, { requireCanvasId: false })

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [chatFeedbackStatus, setChatFeedbackStatus] = useState(false)
    const [chatbotConfig, setChatbotConfig] = useState({})

    const handleChange = (value) => {
        setChatFeedbackStatus(value)
    }

    const onSave = async () => {
        try {
            let value = {
                chatFeedback: {
                    status: chatFeedbackStatus
                }
            }
            chatbotConfig.chatFeedback = value.chatFeedback
            if (!canvasId || !unikId) {
                enqueueSnackbar({
                    message: t('canvas.configuration.chatFeedback.missingCanvas'),
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'error'
                    }
                })
                return
            }

            const saveResp = await api.canvases.updateCanvas(
                unikId,
                canvasId,
                {
                    chatbotConfig: JSON.stringify(chatbotConfig)
                },
                { spaceId }
            )
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('canvas.configuration.chatFeedback.settingsSaved'),
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
                dispatch({ type: SET_CANVAS, canvas: saveResp.data })
            }
        } catch (error) {
            const errorMessage = typeof error?.response?.data === 'object' ? error?.response?.data?.message : error?.response?.data
            enqueueSnackbar({
                message: `${t('canvas.configuration.chatFeedback.failedToSave')}: ${errorMessage}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    useEffect(() => {
        if (canvas && canvas.chatbotConfig) {
            let chatbotConfig = JSON.parse(canvas.chatbotConfig)
            setChatbotConfig(chatbotConfig || {})
            if (chatbotConfig.chatFeedback) {
                setChatFeedbackStatus(chatbotConfig.chatFeedback.status)
            }
        }

        return () => {}
    }, [canvas])

    return (
        <>
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <SwitchInput label={t('canvas.configuration.chatFeedback.enable')} onChange={handleChange} value={chatFeedbackStatus} />
            </Box>
            <StyledButton style={{ marginBottom: 10, marginTop: 10 }} variant='contained' onClick={onSave}>
                {t('canvas.configuration.chatFeedback.save')}
            </StyledButton>
        </>
    )
}

ChatFeedback.propTypes = {
    dialogProps: PropTypes.object
}

export default ChatFeedback
