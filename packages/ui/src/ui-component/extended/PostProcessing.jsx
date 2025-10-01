import { useDispatch } from 'react-redux'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

// material-ui
import { IconButton, Button, Box, Typography } from '@mui/material'
import { IconArrowsMaximize, IconBulb, IconX } from '@tabler/icons-react'
import { useTheme } from '@mui/material/styles'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'
import { SwitchInput } from '@/ui-component/switch/Switch'
import { CodeEditor } from '@/ui-component/editor/CodeEditor'
import ExpandTextDialog from '@/ui-component/dialog/ExpandTextDialog'

// store
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'
import useNotifier from '@/utils/useNotifier'

// API
import canvasesApi from '@/api/canvases'

const sampleFunction = `return $flow.rawOutput + " This is a post processed response!";`

const PostProcessing = ({ dialogProps }) => {
    const dispatch = useDispatch()
    const { t } = useTranslation()

    const chatflow = dialogProps?.chatflow || {}
    const unikId = chatflow.unik_id || chatflow.unikId || dialogProps?.unikId || null
    const spaceId =
        dialogProps?.spaceId !== undefined ? dialogProps.spaceId : chatflow.spaceId || chatflow.space_id || null
    const canvasId = chatflow.id || dialogProps?.chatflowid

    useNotifier()
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [postProcessingEnabled, setPostProcessingEnabled] = useState(false)
    const [postProcessingFunction, setPostProcessingFunction] = useState('')
    const [chatbotConfig, setChatbotConfig] = useState({})
    const [showExpandDialog, setShowExpandDialog] = useState(false)
    const [expandDialogProps, setExpandDialogProps] = useState({})

    const handleChange = (value) => {
        setPostProcessingEnabled(value)
    }

    const onExpandDialogClicked = (value) => {
        const dialogProps = {
            value,
            inputParam: {
                label: t('canvas.configuration.postProcessing.jsFunction'),
                name: 'postProcessingFunction',
                type: 'code',
                placeholder: sampleFunction,
                hideCodeExecute: true
            },
            languageType: 'js',
            confirmButtonName: t('canvas.configuration.postProcessing.save'),
            cancelButtonName: t('common.cancel')
        }
        setExpandDialogProps(dialogProps)
        setShowExpandDialog(true)
    }

    const onSave = async () => {
        try {
            const value = {
                postProcessing: {
                    enabled: postProcessingEnabled,
                    customFunction: JSON.stringify(postProcessingFunction)
                }
            }
            chatbotConfig.postProcessing = value.postProcessing
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
                    message: t('canvas.configuration.postProcessing.configSaved'),
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
                message: `${t('canvas.configuration.postProcessing.failedToSave')}: ${errorMessage}`,
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
            if (chatbotConfig.postProcessing) {
                setPostProcessingEnabled(chatbotConfig.postProcessing.enabled)
                if (chatbotConfig.postProcessing.customFunction) {
                    setPostProcessingFunction(JSON.parse(chatbotConfig.postProcessing.customFunction))
                }
            }
        }

        return () => { }
    }, [dialogProps])

    return (
        <>
            <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <SwitchInput label={t('canvas.configuration.postProcessing.enable')} onChange={handleChange} value={postProcessingEnabled} />
            </Box>
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
                    <Typography>{t('canvas.configuration.postProcessing.jsFunction')}</Typography>
                    <Button
                        sx={{ ml: 2 }}
                        variant='outlined'
                        onClick={() => {
                            setPostProcessingFunction(sampleFunction)
                        }}
                    >
                        {t('canvas.configuration.postProcessing.seeExample')}
                    </Button>
                    <div style={{ flex: 1 }} />
                    <IconButton
                        size='small'
                        sx={{
                            height: 25,
                            width: 25
                        }}
                        title={t('canvas.configuration.postProcessing.expand')}
                        color='primary'
                        onClick={() => onExpandDialogClicked(postProcessingFunction)}
                    >
                        <IconArrowsMaximize />
                    </IconButton>
                </Box>

                <div
                    style={{
                        marginTop: '10px',
                        border: '1px solid',
                        borderColor: theme.palette.grey['300'],
                        borderRadius: '6px',
                        height: '200px',
                        width: '100%'
                    }}
                >
                    <CodeEditor
                        value={postProcessingFunction}
                        height='200px'
                        theme={customization.isDarkMode ? 'dark' : 'light'}
                        lang={'js'}
                        placeholder={sampleFunction}
                        onValueChange={(code) => setPostProcessingFunction(code)}
                        basicSetup={{ highlightActiveLine: false, highlightActiveLineGutter: false }}
                    />
                </div>
            </Box>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 10,
                    background: '#d8f3dc',
                    padding: 10,
                    marginTop: 10
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingTop: 10
                    }}
                >
                    <IconBulb size={30} color='#2d6a4f' />
                    <span style={{ color: '#2d6a4f', marginLeft: 10, fontWeight: 500 }}>
                        {t('canvas.configuration.postProcessing.variables')}{' '}
                        <pre>$flow.rawOutput, $flow.input, $flow.canvasId, $flow.sessionId, $flow.chatId</pre>
                    </span>
                </div>
            </div>
            <StyledButton
                style={{ marginBottom: 10, marginTop: 10 }}
                variant='contained'
                disabled={!postProcessingFunction || postProcessingFunction?.trim().length === 0}
                onClick={onSave}
            >
                {t('canvas.configuration.postProcessing.save')}
            </StyledButton>
            <ExpandTextDialog
                show={showExpandDialog}
                dialogProps={expandDialogProps}
                onCancel={() => setShowExpandDialog(false)}
                onConfirm={(newValue) => {
                    setPostProcessingFunction(newValue)
                    setShowExpandDialog(false)
                }}
            ></ExpandTextDialog>
        </>
    )
}

PostProcessing.propTypes = {
    dialogProps: PropTypes.object
}

export default PostProcessing
