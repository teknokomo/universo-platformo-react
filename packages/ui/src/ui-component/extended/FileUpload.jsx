import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'
import parser from 'html-react-parser'
import { useTranslation } from 'react-i18next'

// material-ui
import { Button, Box } from '@mui/material'
import { IconX, IconBulb } from '@tabler/icons-react'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'
import { SwitchInput } from '@/ui-component/switch/Switch'

// store
import useNotifier from '@/utils/useNotifier'

// API
import chatflowsApi from '@/api/chatflows'

const FileUpload = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    useNotifier()

    const message = `${t('canvas.configuration.fileUpload.info')}
<br /><br />
${t('canvas.configuration.fileUpload.refer')} <a href='https://docs.flowiseai.com/using-flowise/uploads#files' target='_blank'>${t('canvas.configuration.fileUpload.docs')}</a> ${t('canvas.configuration.fileUpload.moreDetails')}`

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [fullFileUpload, setFullFileUpload] = useState(false)
    const [chatbotConfig, setChatbotConfig] = useState({})

    const handleChange = (value) => {
        setFullFileUpload(value)
    }

    const onSave = async () => {
        try {
            const value = {
                status: fullFileUpload
            }
            chatbotConfig.fullFileUpload = value
            chatbotConfig.fileConfig = value.fileConfig
            const saveResp = await chatflowsApi.updateChatflow(dialogProps.chatflow.unik_id, dialogProps.chatflow.id, {
                chatbotConfig: JSON.stringify(chatbotConfig)
            })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('canvas.configuration.fileUpload.configSaved'),
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
            enqueueSnackbar({
                message: `${t('canvas.configuration.fileUpload.failedToSave')}: ${
                    typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }`,
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
        if (dialogProps.chatflow) {
            if (dialogProps.chatflow.chatbotConfig) {
                try {
                    let chatbotConfig = JSON.parse(dialogProps.chatflow.chatbotConfig)
                    setChatbotConfig(chatbotConfig || {})
                    if (chatbotConfig.fullFileUpload) {
                        setFullFileUpload(chatbotConfig.fullFileUpload.status)
                    }
                } catch (e) {
                    setChatbotConfig({})
                }
            }
        }

        return () => {}
    }, [dialogProps])

    return (
        <>
            <Box
                sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'start',
                    justifyContent: 'start',
                    gap: 3,
                    mb: 2
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 10,
                        background: '#d8f3dc',
                        width: '100%',
                        padding: 10
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center'
                        }}
                    >
                        <IconBulb size={30} color='#2d6a4f' />
                        <span style={{ color: '#2d6a4f', marginLeft: 10, fontWeight: 500 }}>{parser(message)}</span>
                    </div>
                </div>
                <SwitchInput label={t('canvas.configuration.fileUpload.enable')} onChange={handleChange} value={fullFileUpload} />
            </Box>
            {/* TODO: Allow selection of allowed file types*/}
            <StyledButton style={{ marginBottom: 10, marginTop: 10 }} variant='contained' onClick={onSave}>
                {t('canvas.configuration.fileUpload.save')}
            </StyledButton>
        </>
    )
}

FileUpload.propTypes = {
    dialogProps: PropTypes.object
}

export default FileUpload
