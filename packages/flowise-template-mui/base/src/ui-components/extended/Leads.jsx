import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'

// material-ui
import { Button, Box, OutlinedInput, Typography } from '@mui/material'
import { IconX } from '@tabler/icons-react'

// Project import
import { StyledButton } from '../button/StyledButton'
import { SwitchInput } from '../switch/Switch'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CANVAS } from '@flowise/store'
import useNotifier from '@flowise/template-mui/hooks/useNotifier'

// API
import { api } from '@universo/api-client'
import resolveCanvasContext from '../utils/resolveCanvasContext'

const formTitle = `Hey 👋 thanks for your interest!
Let us know where we can reach you`

const endTitle = `Thank you!
What can I do for you?`

const Leads = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const { canvas, canvasId, spaceId, unikId } = resolveCanvasContext(dialogProps, { requireCanvasId: false })

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [leadsConfig, setLeadsConfig] = useState({})
    const [chatbotConfig, setChatbotConfig] = useState({})

    const handleChange = (key, value) => {
        setLeadsConfig({
            ...leadsConfig,
            [key]: value
        })
    }

    const onSave = async () => {
        try {
            let value = {
                leads: leadsConfig
            }
            chatbotConfig.leads = value.leads
            if (!canvasId || !unikId) {
                enqueueSnackbar({
                    message: t('canvas:configuration.leads.missingCanvas'),
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
                    message: t('canvas:configuration.leads.configSaved'),
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
            const errorData = error?.response?.data || `${error?.response?.status}: ${error?.response?.statusText || 'Unknown Error'}`
            enqueueSnackbar({
                message: `${t('canvas:configuration.leads.failedToSave')}: ${errorData}`,
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
            if (chatbotConfig.leads) {
                setLeadsConfig(chatbotConfig.leads)
            }
        }

        return () => {}
    }, [canvas])

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
                <SwitchInput
                    label={t('canvas:configuration.leads.enable')}
                    onChange={(value) => handleChange('status', value)}
                    value={leadsConfig.status}
                />
                {leadsConfig && leadsConfig['status'] && (
                    <>
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                            <Typography>{t('canvas:configuration.leads.formTitle')}</Typography>
                            <OutlinedInput
                                id='form-title'
                                type='text'
                                fullWidth
                                multiline={true}
                                minRows={4}
                                value={leadsConfig.title}
                                placeholder={formTitle}
                                name='form-title'
                                size='small'
                                onChange={(e) => {
                                    handleChange('title', e.target.value)
                                }}
                            />
                        </Box>
                        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                            <Typography>{t('canvas:configuration.leads.messageAfterCapture')}</Typography>
                            <OutlinedInput
                                id='success-message'
                                type='text'
                                fullWidth
                                multiline={true}
                                minRows={4}
                                value={leadsConfig.successMessage}
                                placeholder={endTitle}
                                name='form-title'
                                size='small'
                                onChange={(e) => {
                                    handleChange('successMessage', e.target.value)
                                }}
                            />
                        </Box>
                        <Typography variant='h4'>{t('canvas:configuration.leads.formFields')}</Typography>
                        <Box sx={{ width: '100%' }}>
                            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                                <SwitchInput
                                    label={t('canvas:configuration.leads.name')}
                                    onChange={(value) => handleChange('name', value)}
                                    value={leadsConfig.name}
                                />
                                <SwitchInput
                                    label={t('canvas:configuration.leads.email')}
                                    onChange={(value) => handleChange('email', value)}
                                    value={leadsConfig.email}
                                />
                                <SwitchInput
                                    label={t('canvas:configuration.leads.phone')}
                                    onChange={(value) => handleChange('phone', value)}
                                    value={leadsConfig.phone}
                                />
                            </Box>
                        </Box>
                    </>
                )}
            </Box>
            <StyledButton
                disabled={!leadsConfig['name'] && !leadsConfig['phone'] && !leadsConfig['email'] && leadsConfig['status']}
                style={{ marginBottom: 10, marginTop: 10 }}
                variant='contained'
                onClick={onSave}
            >
                {t('canvas:configuration.leads.save')}
            </StyledButton>
        </>
    )
}

Leads.propTypes = {
    dialogProps: PropTypes.object
}

export default Leads
