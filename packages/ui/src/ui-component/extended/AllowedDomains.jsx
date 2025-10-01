import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'

// material-ui
import { Button, IconButton, OutlinedInput, Box, InputAdornment, Stack, Typography } from '@mui/material'
import { IconX, IconTrash, IconPlus } from '@tabler/icons-react'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'
import { TooltipWithParser } from '@/ui-component/tooltip/TooltipWithParser'

// store
import useNotifier from '@/utils/useNotifier'

// API
import canvasesApi from '@/api/canvases'

const AllowedDomains = ({ dialogProps }) => {
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

    const [inputFields, setInputFields] = useState([''])
    const [errorMessage, setErrorMessage] = useState('')

    const [chatbotConfig, setChatbotConfig] = useState({})

    const addInputField = () => {
        setInputFields([...inputFields, ''])
    }
    const removeInputFields = (index) => {
        const rows = [...inputFields]
        rows.splice(index, 1)
        setInputFields(rows)
    }

    const handleChange = (index, evnt) => {
        const { value } = evnt.target
        const list = [...inputFields]
        list[index] = value
        setInputFields(list)
    }

    const onSave = async () => {
        try {
            let value = {
                allowedOrigins: [...inputFields],
                allowedOriginsError: errorMessage
            }
            chatbotConfig.allowedOrigins = value.allowedOrigins
            chatbotConfig.allowedOriginsError = value.allowedOriginsError

            chatbotConfig.allowedDomains = value.allowedOrigins
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
                    message: 'Allowed Origins Saved',
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
                message: `Failed to save Allowed Origins: ${errorMessage}`,
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
            try {
                let chatbotConfig = JSON.parse(dialogProps.chatflow.chatbotConfig)
                setChatbotConfig(chatbotConfig || {})
                if (chatbotConfig.allowedOrigins) {
                    let inputFields = [...chatbotConfig.allowedOrigins]
                    setInputFields(inputFields)
                } else {
                    setInputFields([''])
                }
                if (chatbotConfig.allowedOriginsError) {
                    setErrorMessage(chatbotConfig.allowedOriginsError)
                } else {
                    setErrorMessage('')
                }
            } catch (e) {
                setInputFields([''])
                setErrorMessage('')
            }
        }

        return () => {}
    }, [dialogProps])

    return (
        <Stack direction='column' spacing={2} sx={{ alignItems: 'start' }}>
            <Typography variant='h3'>
                {t('canvas.configuration.security.allowedDomains.title')}
                <TooltipWithParser
                    style={{ mb: 1, mt: 2, marginLeft: 10 }}
                    title={'Your chatbot will only work when used from the following domains.'}
                />
            </Typography>
            <Stack direction='column' spacing={2} sx={{ width: '100%' }}>
                <Stack direction='column' spacing={2}>
                    <Typography>{t('canvas.configuration.security.allowedDomains.domains')}</Typography>
                    {inputFields.map((origin, index) => {
                        return (
                            <div key={index} style={{ display: 'flex', width: '100%' }}>
                                <Box sx={{ width: '100%', mb: 1 }}>
                                    <OutlinedInput
                                        sx={{ width: '100%' }}
                                        key={index}
                                        type='text'
                                        onChange={(e) => handleChange(index, e)}
                                        size='small'
                                        value={origin}
                                        name='origin'
                                        placeholder={t('canvas.configuration.security.allowedDomains.placeholder')}
                                        endAdornment={
                                            <InputAdornment position='end' sx={{ padding: '2px' }}>
                                                {inputFields.length > 1 && (
                                                    <IconButton
                                                        sx={{ height: 30, width: 30 }}
                                                        size='small'
                                                        color='error'
                                                        disabled={inputFields.length === 1}
                                                        onClick={() => removeInputFields(index)}
                                                        edge='end'
                                                    >
                                                        <IconTrash />
                                                    </IconButton>
                                                )}
                                            </InputAdornment>
                                        }
                                    />
                                </Box>
                                <Box sx={{ width: '5%', mb: 1 }}>
                                    {index === inputFields.length - 1 && (
                                        <IconButton color='primary' onClick={addInputField}>
                                            <IconPlus />
                                        </IconButton>
                                    )}
                                </Box>
                            </div>
                        )
                    })}
                </Stack>
                <Stack direction='column' spacing={1}>
                    <Typography>
                        {t('canvas.configuration.security.allowedDomains.errorMessage')}
                        <TooltipWithParser
                            style={{ mb: 1, mt: 2, marginLeft: 10 }}
                            title={'Custom error message that will be shown when for unauthorized domain'}
                        />
                    </Typography>
                    <OutlinedInput
                        sx={{ width: '100%' }}
                        type='text'
                        size='small'
                        fullWidth
                        placeholder='Unauthorized domain!'
                        value={errorMessage}
                        onChange={(e) => {
                            setErrorMessage(e.target.value)
                        }}
                    />
                </Stack>
            </Stack>
            <StyledButton variant='contained' onClick={onSave}>
                {t('canvas.configuration.security.allowedDomains.save')}
            </StyledButton>
        </Stack>
    )
}

AllowedDomains.propTypes = {
    dialogProps: PropTypes.object
}

export default AllowedDomains
