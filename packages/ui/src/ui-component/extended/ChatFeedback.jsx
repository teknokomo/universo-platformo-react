import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'

// material-ui
import { Button, Box } from '@mui/material'
import { IconX } from '@tabler/icons-react'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'
import { SwitchInput } from '@/ui-component/switch/Switch'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'
import useNotifier from '@/utils/useNotifier'

// API
import canvasesApi from '@/api/canvases'

const ChatFeedback = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const chatflow = dialogProps?.chatflow || {}
    const unikId = chatflow.unik_id || chatflow.unikId || dialogProps?.unikId || null
    const spaceId =
        dialogProps?.spaceId !== undefined ? dialogProps.spaceId : chatflow.spaceId || chatflow.space_id || null
    const canvasId = chatflow.id || dialogProps?.chatflowid

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
            const saveResp = await canvasesApi.updateCanvas(
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
                dispatch({ type: SET_CHATFLOW, chatflow: saveResp.data })
            }
        } catch (error) {
            const errorMessage =
                typeof error?.response?.data === 'object' ? error?.response?.data?.message : error?.response?.data
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
        if (dialogProps.chatflow && dialogProps.chatflow.chatbotConfig) {
            let chatbotConfig = JSON.parse(dialogProps.chatflow.chatbotConfig)
            setChatbotConfig(chatbotConfig || {})
            if (chatbotConfig.chatFeedback) {
                setChatFeedbackStatus(chatbotConfig.chatFeedback.status)
            }
        }

        return () => {}
    }, [dialogProps])

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
