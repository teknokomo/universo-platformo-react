import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction, SET_CHATFLOW } from '@/store/actions'
import { SketchPicker } from 'react-color'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { Card, Box, Typography, Button, Switch, OutlinedInput, Popover, Stack, IconButton, Tabs, Tab } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { CopyBlock, atomOneDark } from 'react-code-blocks'

// Project import
import { StyledButton } from '@/ui-component/button/StyledButton'
import { TooltipWithParser } from '@/ui-component/tooltip/TooltipWithParser'
import { CheckboxInput } from '@/ui-component/checkbox/Checkbox'

// Icons
import { IconX, IconCopy, IconArrowUpRightCircle } from '@tabler/icons-react'

// API
import chatflowsApi from '@/api/chatflows'

// utils
import useNotifier from '@/utils/useNotifier'

// Const
import { baseURL } from '@/store/constant'

const defaultConfig = {
    backgroundColor: '#ffffff',
    fontSize: 16,
    poweredByTextColor: '#303235',
    titleBackgroundColor: '#3B81F6',
    titleTextColor: '#ffffff',
    botMessage: {
        backgroundColor: '#f7f8ff',
        textColor: '#303235'
    },
    userMessage: {
        backgroundColor: '#3B81F6',
        textColor: '#ffffff'
    },
    textInput: {
        backgroundColor: '#ffffff',
        textColor: '#303235',
        sendButtonColor: '#3B81F6'
    }
}

function TabPanel(props) {
    const { children, value, index, ...other } = props
    return (
        <div
            role='tabpanel'
            hidden={value !== index}
            id={`attachment-tabpanel-${index}`}
            aria-labelledby={`attachment-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 1 }}>{children}</Box>}
        </div>
    )
}

TabPanel.propTypes = {
    children: PropTypes.node,
    index: PropTypes.number.isRequired,
    value: PropTypes.number.isRequired
}

function a11yProps(index) {
    return {
        id: `attachment-tab-${index}`,
        'aria-controls': `attachment-tabpanel-${index}`
    }
}

const shareChatbotHtmlCode = (chatflowid, mode = 'chat') => {
    return `<iframe
    src="${baseURL}/api/v1/prediction/${chatflowid}?mode=${mode}"
    width="100%"
    height="600"
    style="border: none;"
></iframe>`
}

const shareChatbotReactCode = (chatflowid, mode = 'chat') => {
    return `import { Chatbot } from 'flowise-embed-react'

const App = () => {
    return (
        <Chatbot
            chatflowid="${chatflowid}"
            apiHost="${baseURL}"
            mode="${mode}"
        />
    );
};`
}

const ShareChatbot = ({ isSessionMemory, isAgentCanvas, chatflowid, unikId: propUnikId, mode = 'chat' }) => {
    const dispatch = useDispatch()
    const theme = useTheme()
    const chatflow = useSelector((state) => state.canvas.chatflow)
    const chatbotConfig = chatflow.chatbotConfig ? JSON.parse(chatflow.chatbotConfig) : {}
    const { t } = useTranslation('chatflows')
    const { unikId: paramsUnikId } = useParams()
    const unikId = propUnikId || paramsUnikId

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [isPublicChatflow, setChatflowIsPublic] = useState(chatflow.isPublic ?? false)
    const [generateNewSession, setGenerateNewSession] = useState(chatbotConfig?.generateNewSession ?? false)
    const [renderHTML, setRenderHTML] = useState(chatbotConfig?.renderHTML ?? false)

    const [title, setTitle] = useState(chatbotConfig?.title ?? '')
    const [titleAvatarSrc, setTitleAvatarSrc] = useState(chatbotConfig?.titleAvatarSrc ?? '')
    const [titleBackgroundColor, setTitleBackgroundColor] = useState(
        chatbotConfig?.titleBackgroundColor ?? defaultConfig.titleBackgroundColor
    )
    const [titleTextColor, setTitleTextColor] = useState(chatbotConfig?.titleTextColor ?? defaultConfig.titleTextColor)

    const [welcomeMessage, setWelcomeMessage] = useState(chatbotConfig?.welcomeMessage ?? '')
    const [errorMessage, setErrorMessage] = useState(chatbotConfig?.errorMessage ?? '')
    const [backgroundColor, setBackgroundColor] = useState(chatbotConfig?.backgroundColor ?? defaultConfig.backgroundColor)
    const [fontSize, setFontSize] = useState(chatbotConfig?.fontSize ?? defaultConfig.fontSize)
    const [poweredByTextColor, setPoweredByTextColor] = useState(chatbotConfig?.poweredByTextColor ?? defaultConfig.poweredByTextColor)

    const getShowAgentMessagesStatus = () => {
        if (chatbotConfig?.showAgentMessages !== undefined) {
            return chatbotConfig?.showAgentMessages
        } else {
            return isAgentCanvas ? true : undefined
        }
    }
    const [showAgentMessages, setShowAgentMessages] = useState(getShowAgentMessagesStatus())

    const [botMessageBackgroundColor, setBotMessageBackgroundColor] = useState(
        chatbotConfig?.botMessage?.backgroundColor ?? defaultConfig.botMessage.backgroundColor
    )
    const [botMessageTextColor, setBotMessageTextColor] = useState(
        chatbotConfig?.botMessage?.textColor ?? defaultConfig.botMessage.textColor
    )
    const [botMessageAvatarSrc, setBotMessageAvatarSrc] = useState(chatbotConfig?.botMessage?.avatarSrc ?? '')
    const [botMessageShowAvatar, setBotMessageShowAvatar] = useState(chatbotConfig?.botMessage?.showAvatar ?? false)

    const [userMessageBackgroundColor, setUserMessageBackgroundColor] = useState(
        chatbotConfig?.userMessage?.backgroundColor ?? defaultConfig.userMessage.backgroundColor
    )
    const [userMessageTextColor, setUserMessageTextColor] = useState(
        chatbotConfig?.userMessage?.textColor ?? defaultConfig.userMessage.textColor
    )
    const [userMessageAvatarSrc, setUserMessageAvatarSrc] = useState(chatbotConfig?.userMessage?.avatarSrc ?? '')
    const [userMessageShowAvatar, setUserMessageShowAvatar] = useState(chatbotConfig?.userMessage?.showAvatar ?? false)

    const [textInputBackgroundColor, setTextInputBackgroundColor] = useState(
        chatbotConfig?.textInput?.backgroundColor ?? defaultConfig.textInput.backgroundColor
    )
    const [textInputTextColor, setTextInputTextColor] = useState(chatbotConfig?.textInput?.textColor ?? defaultConfig.textInput.textColor)
    const [textInputPlaceholder, setTextInputPlaceholder] = useState(chatbotConfig?.textInput?.placeholder ?? '')
    const [textInputSendButtonColor, setTextInputSendButtonColor] = useState(
        chatbotConfig?.textInput?.sendButtonColor ?? defaultConfig.textInput.sendButtonColor
    )

    const [colorAnchorEl, setColorAnchorEl] = useState(null)
    const [selectedColorConfig, setSelectedColorConfig] = useState('')
    const [sketchPickerColor, setSketchPickerColor] = useState('')
    const openColorPopOver = Boolean(colorAnchorEl)

    const [copyAnchorEl, setCopyAnchorEl] = useState(null)
    const openCopyPopOver = Boolean(copyAnchorEl)

    const [codes] = ['Html', 'React']
    const [value, setValue] = useState(0)
    const [shareChatbotCheckboxVal, setShareChatbotCheckbox] = useState(false)

    const formatObj = () => {
        const obj = {
            botMessage: {
                showAvatar: false
            },
            userMessage: {
                showAvatar: false
            },
            textInput: {}
        }
        if (title) obj.title = title
        if (titleAvatarSrc) obj.titleAvatarSrc = titleAvatarSrc
        if (titleBackgroundColor) obj.titleBackgroundColor = titleBackgroundColor
        if (titleTextColor) obj.titleTextColor = titleTextColor

        if (welcomeMessage) obj.welcomeMessage = welcomeMessage
        if (errorMessage) obj.errorMessage = errorMessage
        if (backgroundColor) obj.backgroundColor = backgroundColor
        if (fontSize) obj.fontSize = fontSize
        if (poweredByTextColor) obj.poweredByTextColor = poweredByTextColor

        if (botMessageBackgroundColor) obj.botMessage.backgroundColor = botMessageBackgroundColor
        if (botMessageTextColor) obj.botMessage.textColor = botMessageTextColor
        if (botMessageAvatarSrc) obj.botMessage.avatarSrc = botMessageAvatarSrc
        if (botMessageShowAvatar) obj.botMessage.showAvatar = botMessageShowAvatar

        if (userMessageBackgroundColor) obj.userMessage.backgroundColor = userMessageBackgroundColor
        if (userMessageTextColor) obj.userMessage.textColor = userMessageTextColor
        if (userMessageAvatarSrc) obj.userMessage.avatarSrc = userMessageAvatarSrc
        if (userMessageShowAvatar) obj.userMessage.showAvatar = userMessageShowAvatar

        if (textInputBackgroundColor) obj.textInput.backgroundColor = textInputBackgroundColor
        if (textInputTextColor) obj.textInput.textColor = textInputTextColor
        if (textInputPlaceholder) obj.textInput.placeholder = textInputPlaceholder
        if (textInputSendButtonColor) obj.textInput.sendButtonColor = textInputSendButtonColor

        if (isSessionMemory) obj.generateNewSession = generateNewSession

        if (renderHTML) {
            obj.renderHTML = true
        } else {
            obj.renderHTML = false
        }

        if (isAgentCanvas) {
            // if showAgentMessages is undefined, default to true
            if (showAgentMessages === undefined || showAgentMessages === null) {
                obj.showAgentMessages = true
            } else {
                obj.showAgentMessages = showAgentMessages
            }
        }

        return {
            ...chatbotConfig,
            ...obj
        }
    }

    const onSave = async () => {
        try {
            const saveResp = await chatflowsApi.updateChatflow(unikId, chatflowid, {
                chatbotConfig: JSON.stringify(formatObj())
            })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('chatflows.shareChatbot.configSaved'),
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
                message: t('chatflows.shareChatbot.saveError', {
                    error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }),
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

    const onSwitchChange = async (checked) => {
        try {
            const saveResp = await chatflowsApi.updateChatflow(unikId, chatflowid, { isPublic: checked })
            if (saveResp.data) {
                enqueueSnackbar({
                    message: t('chatflows.shareChatbot.configSaved'),
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
                message: t('chatflows.shareChatbot.saveError', {
                    error: typeof error.response.data === 'object' ? error.response.data.message : error.response.data
                }),
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

    const handleClosePopOver = () => {
        setColorAnchorEl(null)
    }

    const handleCloseCopyPopOver = () => {
        setCopyAnchorEl(null)
    }

    const onColorSelected = (hexColor) => {
        switch (selectedColorConfig) {
            case 'backgroundColor':
                setBackgroundColor(hexColor)
                break
            case 'poweredByTextColor':
                setPoweredByTextColor(hexColor)
                break
            case 'botMessageBackgroundColor':
                setBotMessageBackgroundColor(hexColor)
                break
            case 'botMessageTextColor':
                setBotMessageTextColor(hexColor)
                break
            case 'userMessageBackgroundColor':
                setUserMessageBackgroundColor(hexColor)
                break
            case 'userMessageTextColor':
                setUserMessageTextColor(hexColor)
                break
            case 'textInputBackgroundColor':
                setTextInputBackgroundColor(hexColor)
                break
            case 'textInputTextColor':
                setTextInputTextColor(hexColor)
                break
            case 'textInputSendButtonColor':
                setTextInputSendButtonColor(hexColor)
                break
            case 'titleBackgroundColor':
                setTitleBackgroundColor(hexColor)
                break
            case 'titleTextColor':
                setTitleTextColor(hexColor)
                break
        }
        setSketchPickerColor(hexColor)
    }

    const onTextChanged = (value, fieldName) => {
        switch (fieldName) {
            case 'title':
                setTitle(value)
                break
            case 'titleAvatarSrc':
                setTitleAvatarSrc(value)
                break
            case 'welcomeMessage':
                setWelcomeMessage(value)
                break
            case 'errorMessage':
                setErrorMessage(value)
                break
            case 'fontSize':
                setFontSize(value)
                break
            case 'botMessageAvatarSrc':
                setBotMessageAvatarSrc(value)
                break
            case 'userMessageAvatarSrc':
                setUserMessageAvatarSrc(value)
                break
            case 'textInputPlaceholder':
                setTextInputPlaceholder(value)
                break
        }
    }

    const onBooleanChanged = (value, fieldName) => {
        switch (fieldName) {
            case 'botMessageShowAvatar':
                setBotMessageShowAvatar(value)
                break
            case 'userMessageShowAvatar':
                setUserMessageShowAvatar(value)
                break
            case 'generateNewSession':
                setGenerateNewSession(value)
                break
            case 'showAgentMessages':
                setShowAgentMessages(value)
                break
            case 'renderHTML':
                setRenderHTML(value)
                break
        }
    }

    const colorField = (color, fieldName, fieldLabel) => {
        return (
            <Box sx={{ pt: 2, pb: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ mb: 1 }}>{fieldLabel}</Typography>
                    <Box
                        sx={{
                            cursor: 'pointer',
                            width: '30px',
                            height: '30px',
                            border: '1px solid #616161',
                            marginRight: '10px',
                            backgroundColor: color ?? '#ffffff',
                            borderRadius: '5px'
                        }}
                        onClick={(event) => {
                            setSelectedColorConfig(fieldName)
                            setSketchPickerColor(color ?? '#ffffff')
                            setColorAnchorEl(event.currentTarget)
                        }}
                    ></Box>
                </div>
            </Box>
        )
    }

    const booleanField = (value, fieldName, fieldLabel) => {
        return (
            <Box sx={{ pt: 2, pb: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ mb: 1 }}>{fieldLabel}</Typography>
                    <Switch
                        id={fieldName}
                        checked={value}
                        onChange={(event) => {
                            onBooleanChanged(event.target.checked, fieldName)
                        }}
                    />
                </div>
            </Box>
        )
    }

    const textField = (message, fieldName, fieldLabel, fieldType = 'string', placeholder = '') => {
        return (
            <Box sx={{ pt: 2, pb: 2 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Typography sx={{ mb: 1 }}>{fieldLabel}</Typography>
                    <OutlinedInput
                        id={fieldName}
                        type={fieldType}
                        fullWidth
                        value={message}
                        placeholder={placeholder}
                        name={fieldName}
                        onChange={(e) => {
                            onTextChanged(e.target.value, fieldName)
                        }}
                    />
                </div>
            </Box>
        )
    }

    const onCheckBoxShareChatbotChanged = (newVal) => {
        setShareChatbotCheckbox(newVal)
    }

    const handleChange = (event, newValue) => {
        setValue(newValue)
    }

    const getCode = (codeLang) => {
        switch (codeLang) {
            case 'Html':
                return shareChatbotHtmlCode(chatflowid, mode)
            case 'React':
                return shareChatbotReactCode(chatflowid, mode)
            default:
                return ''
        }
    }

    useEffect(() => {
        const fetchChatflow = async () => {
            try {
                const resp = await chatflowsApi.getSpecificChatflow(unikId, chatflowid)
                if (resp.data) {
                    dispatch({ type: SET_CHATFLOW, chatflow: resp.data })
                }
            } catch (error) {
                console.error('Error fetching chatflow:', error)
            }
        }

        if (chatflowid !== chatflow.id) {
            fetchChatflow()
        }
    }, [chatflowid, chatflow.id, dispatch, unikId])

    return (
        <>
            <Stack direction='row'>
                <Typography
                    sx={{
                        p: 1,
                        borderRadius: 10,
                        backgroundColor: theme.palette.primary.light,
                        width: 'max-content',
                        height: 'max-content'
                    }}
                    variant='h5'
                >
                    {`${baseURL}/chatbot/${chatflowid}`}
                </Typography>
                <IconButton
                    title={t('chatflows.shareChatbot.copyLink')}
                    color='success'
                    onClick={(event) => {
                        navigator.clipboard.writeText(`${baseURL}/chatbot/${chatflowid}`)
                        setCopyAnchorEl(event.currentTarget)
                        setTimeout(() => {
                            handleCloseCopyPopOver()
                        }, 1500)
                    }}
                >
                    <IconCopy />
                </IconButton>
                <IconButton title={t('chatflows.shareChatbot.openNewTab')} color='primary' onClick={() => window.open(`${baseURL}/chatbot/${chatflowid}`, '_blank')}>
                    <IconArrowUpRightCircle />
                </IconButton>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Switch
                        checked={isPublicChatflow}
                        onChange={(event) => {
                            setChatflowIsPublic(event.target.checked)
                            onSwitchChange(event.target.checked)
                        }}
                    />
                    <Typography>{t('chatflows.shareChatbot.makePublic')}</Typography>
                    <TooltipWithParser
                        style={{ marginLeft: 10 }}
                        title={t('chatflows.shareChatbot.makePublicTooltip')}
                    />
                </div>
            </Stack>

            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 3, mt: 2 }} variant='outlined'>
                <Stack sx={{ mt: 1, mb: 2, alignItems: 'center' }} direction='row' spacing={2}>
                    <Typography variant='h4'>{t('chatflows.shareChatbot.titleSettings')}</Typography>
                </Stack>
                {textField(title, 'title', t('chatflows.shareChatbot.title'), 'string', t('chatflows.shareChatbot.titlePlaceholder'))}
                {textField(
                    titleAvatarSrc,
                    'titleAvatarSrc',
                    t('chatflows.shareChatbot.titleAvatarLink'),
                    'string',
                    `https://raw.githubusercontent.com/FlowiseAI/Flowise/main/assets/FloWiseAI_dark.png`
                )}
                {colorField(titleBackgroundColor, 'titleBackgroundColor', t('chatflows.shareChatbot.titleBackgroundColor'))}
                {colorField(titleTextColor, 'titleTextColor', t('chatflows.shareChatbot.titleTextColor'))}
            </Card>

            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 3, mt: 2 }} variant='outlined'>
                <Stack sx={{ mt: 1, mb: 2, alignItems: 'center' }} direction='row' spacing={2}>
                    <Typography variant='h4'>{t('chatflows.shareChatbot.generalSettings')}</Typography>
                </Stack>
                {textField(welcomeMessage, 'welcomeMessage', t('chatflows.shareChatbot.welcomeMessage'), 'string', t('chatflows.shareChatbot.welcomeMessagePlaceholder'))}
                {textField(errorMessage, 'errorMessage', t('chatflows.shareChatbot.errorMessage'), 'string', t('chatflows.shareChatbot.errorMessagePlaceholder'))}
                {colorField(backgroundColor, 'backgroundColor', t('chatflows.shareChatbot.backgroundColor'))}
                {textField(fontSize, 'fontSize', t('chatflows.shareChatbot.fontSize'), 'number')}
                {colorField(poweredByTextColor, 'poweredByTextColor', t('chatflows.shareChatbot.poweredByTextColor'))}
                {isAgentCanvas && booleanField(showAgentMessages, 'showAgentMessages', t('chatflows.shareChatbot.showAgentMessages'))}
                {booleanField(renderHTML, 'renderHTML', t('chatflows.shareChatbot.renderHTML'))}
                {isSessionMemory &&
                    booleanField(generateNewSession, 'generateNewSession', t('chatflows.shareChatbot.generateNewSession'))}
            </Card>

            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 3, mt: 2 }} variant='outlined'>
                <Stack sx={{ mt: 1, mb: 2, alignItems: 'center' }} direction='row' spacing={2}>
                    <Typography variant='h4'>{t('chatflows.shareChatbot.botMessage')}</Typography>
                </Stack>
                {colorField(botMessageBackgroundColor, 'botMessageBackgroundColor', t('chatflows.shareChatbot.backgroundColor'))}
                {colorField(botMessageTextColor, 'botMessageTextColor', t('chatflows.shareChatbot.textColor'))}
                {textField(
                    botMessageAvatarSrc,
                    'botMessageAvatarSrc',
                    t('chatflows.shareChatbot.avatarLink'),
                    'string',
                    `https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/parroticon.png`
                )}
                {booleanField(botMessageShowAvatar, 'botMessageShowAvatar', t('chatflows.shareChatbot.showAvatar'))}
            </Card>

            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 3, mt: 2 }} variant='outlined'>
                <Stack sx={{ mt: 1, mb: 2, alignItems: 'center' }} direction='row' spacing={2}>
                    <Typography variant='h4'>{t('chatflows.shareChatbot.userMessage')}</Typography>
                </Stack>
                {colorField(userMessageBackgroundColor, 'userMessageBackgroundColor', t('chatflows.shareChatbot.backgroundColor'))}
                {colorField(userMessageTextColor, 'userMessageTextColor', t('chatflows.shareChatbot.textColor'))}
                {textField(
                    userMessageAvatarSrc,
                    'userMessageAvatarSrc',
                    t('chatflows.shareChatbot.avatarLink'),
                    'string',
                    `https://raw.githubusercontent.com/zahidkhawaja/langchain-chat-nextjs/main/public/usericon.png`
                )}
                {booleanField(userMessageShowAvatar, 'userMessageShowAvatar', t('chatflows.shareChatbot.showAvatar'))}
            </Card>

            <Card sx={{ borderColor: theme.palette.primary[200] + 75, p: 3, mt: 2 }} variant='outlined'>
                <Stack sx={{ mt: 1, mb: 2, alignItems: 'center' }} direction='row' spacing={2}>
                    <Typography variant='h4'>{t('chatflows.shareChatbot.textInput')}</Typography>
                </Stack>
                {colorField(textInputBackgroundColor, 'textInputBackgroundColor', t('chatflows.shareChatbot.backgroundColor'))}
                {colorField(textInputTextColor, 'textInputTextColor', t('chatflows.shareChatbot.textColor'))}
                {textField(textInputPlaceholder, 'textInputPlaceholder', t('chatflows.shareChatbot.textInputPlaceholder'), 'string', t('chatflows.shareChatbot.typeQuestion'))}
                {colorField(textInputSendButtonColor, 'textInputSendButtonColor', t('chatflows.shareChatbot.textInputSendButtonColor'))}
            </Card>

            <StyledButton
                fullWidth
                style={{
                    borderRadius: 20,
                    marginBottom: 10,
                    marginTop: 10,
                    background: 'linear-gradient(45deg, #673ab7 30%, #1e88e5 90%)'
                }}
                variant='contained'
                onClick={() => onSave()}
            >
                {t('chatflows.shareChatbot.saveChanges')}
            </StyledButton>
            <Popover
                open={openColorPopOver}
                anchorEl={colorAnchorEl}
                onClose={handleClosePopOver}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <SketchPicker color={sketchPickerColor} onChange={(color) => onColorSelected(color.hex)} />
            </Popover>
            <Popover
                open={openCopyPopOver}
                anchorEl={copyAnchorEl}
                onClose={handleCloseCopyPopOver}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right'
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left'
                }}
            >
                <Typography variant='h6' sx={{ pl: 1, pr: 1, color: 'white', background: theme.palette.success.dark }}>
                    {t('chatflows.shareChatbot.copied')}
                </Typography>
            </Popover>

            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <div style={{ flex: 80 }}>
                    <Tabs value={value} onChange={handleChange} aria-label='tabs'>
                        {codes.map((codeLang, index) => (
                            <Tab key={index} label={codeLang} {...a11yProps(index)}></Tab>
                        ))}
                    </Tabs>
                </div>
            </div>
            <div style={{ marginTop: 10 }}></div>
            {codes.map((codeLang, index) => (
                <TabPanel key={index} value={value} index={index}>
                    {(value === 0 || value === 1) && (
                        <>
                            <span>
                                {t('chatflows.shareChatbot.pasteHtmlBody')}
                                <p>
                                    {t('chatflows.shareChatbot.specifyVersion')}&nbsp;
                                    <a
                                        rel='noreferrer'
                                        target='_blank'
                                        href='https://www.npmjs.com/package/flowise-embed?activeTab=versions'
                                    >
                                        {t('chatflows.common.version')}
                                    </a>
                                    :&nbsp;<code>{`https://cdn.jsdelivr.net/npm/flowise-embed@<version>/dist/web.js`}</code>
                                </p>
                            </span>
                            <div style={{ height: 10 }}></div>
                        </>
                    )}
                    <CopyBlock theme={atomOneDark} text={getCode(codeLang)} language='javascript' showLineNumbers={false} wrapLines />

                    <CheckboxInput label={t('chatflows.shareChatbot.showConfig')} value={shareChatbotCheckboxVal} onChange={onCheckBoxShareChatbotChanged} />

                    {shareChatbotCheckboxVal && (
                        <CopyBlock
                            theme={atomOneDark}
                            text={getCode(codeLang)}
                            language='javascript'
                            showLineNumbers={false}
                            wrapLines
                        />
                    )}
                </TabPanel>
            ))}
        </>
    )
}

ShareChatbot.propTypes = {
    isSessionMemory: PropTypes.bool,
    isAgentCanvas: PropTypes.bool,
    chatflowid: PropTypes.string.isRequired,
    unikId: PropTypes.string,
    mode: PropTypes.oneOf(['chat', 'ar'])
}

export default ShareChatbot
