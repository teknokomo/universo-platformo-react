import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from '@universo/i18n'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CANVAS } from '@flowise/store'

// material-ui
import { Button, IconButton, OutlinedInput, Box, List, InputAdornment } from '@mui/material'
import { IconX, IconTrash, IconPlus, IconBulb } from '@tabler/icons-react'

// Project import
import { StyledButton } from '../button/StyledButton'
import resolveCanvasContext from '../utils/resolveCanvasContext'

// store
import useNotifier from '@flowise/template-mui/hooks/useNotifier'

// API
import { api } from '@universo/api-client'

const StarterPrompts = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const { canvas, canvasId, spaceId, unikId } = resolveCanvasContext(dialogProps, { requireCanvasId: false })

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [inputFields, setInputFields] = useState([
        {
            prompt: ''
        }
    ])

    const [chatbotConfig, setChatbotConfig] = useState({})

    const addInputField = () => {
        setInputFields([
            ...inputFields,
            {
                prompt: ''
            }
        ])
    }
    const removeInputFields = (index) => {
        const rows = [...inputFields]
        rows.splice(index, 1)
        setInputFields(rows)
    }

    const handleChange = (index, evnt) => {
        const { name, value } = evnt.target
        const list = [...inputFields]
        list[index][name] = value
        setInputFields(list)
    }

    const onSave = async () => {
        try {
            let value = {
                starterPrompts: {
                    ...inputFields
                }
            }
            chatbotConfig.starterPrompts = value.starterPrompts

            if (!canvasId || !unikId) {
                enqueueSnackbar({
                    message: 'Missing canvas context',
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
                    message: 'Conversation Starter Prompts Saved',
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
                message: `Failed to save Conversation Starter Prompts: ${errorMessage}`,
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
            try {
                let chatbotConfig = JSON.parse(canvas.chatbotConfig)
                setChatbotConfig(chatbotConfig || {})
                if (chatbotConfig.starterPrompts) {
                    let inputFields = []
                    Object.getOwnPropertyNames(chatbotConfig.starterPrompts).forEach((key) => {
                        if (chatbotConfig.starterPrompts[key]) {
                            inputFields.push(chatbotConfig.starterPrompts[key])
                        }
                    })
                    setInputFields(inputFields)
                } else {
                    setInputFields([
                        {
                            prompt: ''
                        }
                    ])
                }
            } catch (e) {
                setInputFields([
                    {
                        prompt: ''
                    }
                ])
                setChatbotConfig({})
            }
        }

        return () => {}
    }, [canvas])

    return (
        <>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 10,
                    background: '#d8f3dc',
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
                    <span style={{ color: '#2d6a4f', marginLeft: 10, fontWeight: 500 }}>
                        {t('canvas.configuration.starterPrompts.info')}
                    </span>
                </div>
            </div>
            <Box sx={{ '& > :not(style)': { m: 1 }, pt: 2 }}>
                <List>
                    {inputFields.map((data, index) => {
                        return (
                            <div key={index} style={{ display: 'flex', width: '100%' }}>
                                <Box sx={{ width: '95%', mb: 1 }}>
                                    <OutlinedInput
                                        sx={{ width: '100%' }}
                                        key={index}
                                        type='text'
                                        onChange={(e) => handleChange(index, e)}
                                        size='small'
                                        value={data.prompt}
                                        name='prompt'
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
                </List>
            </Box>
            <StyledButton variant='contained' onClick={onSave}>
                {t('canvas.configuration.starterPrompts.save')}
            </StyledButton>
        </>
    )
}

StarterPrompts.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default StarterPrompts
