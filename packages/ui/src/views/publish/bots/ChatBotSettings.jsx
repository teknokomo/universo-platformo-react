// Universo Platformo | Chat Bot Settings implementation
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { createRoot } from 'react-dom/client'
import { FormControlLabel, Switch } from '@mui/material'
import Grid from '@mui/material/Grid'

// Project import
import BaseBotSettings from './BaseBotSettings'

// ==============================|| Chat Bot Settings ||============================== //

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
    },
    displayMode: 'chat'
}

const ChatBotSettings = ({ isSessionMemory, isAgentCanvas, chatflowid, unikId, chatflow, onSave }) => {
    const [title, setTitle] = useState('')
    const [titleAvatarSrc, setTitleAvatarSrc] = useState('')
    const [titleBackgroundColor, setTitleBackgroundColor] = useState(defaultConfig.titleBackgroundColor)
    const [titleTextColor, setTitleTextColor] = useState(defaultConfig.titleTextColor)
    const [welcomeMessage, setWelcomeMessage] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [backgroundColor, setBackgroundColor] = useState(defaultConfig.backgroundColor)
    const [fontSize, setFontSize] = useState(defaultConfig.fontSize)
    const [poweredByTextColor, setPoweredByTextColor] = useState(defaultConfig.poweredByTextColor)
    const [showAgentMessages, setShowAgentMessages] = useState(isAgentCanvas)
    const [botMessageBackgroundColor, setBotMessageBackgroundColor] = useState(defaultConfig.botMessage.backgroundColor)
    const [botMessageTextColor, setBotMessageTextColor] = useState(defaultConfig.botMessage.textColor)
    const [botMessageAvatarSrc, setBotMessageAvatarSrc] = useState('')
    const [botMessageShowAvatar, setBotMessageShowAvatar] = useState(false)
    const [userMessageBackgroundColor, setUserMessageBackgroundColor] = useState(defaultConfig.userMessage.backgroundColor)
    const [userMessageTextColor, setUserMessageTextColor] = useState(defaultConfig.userMessage.textColor)
    const [userMessageAvatarSrc, setUserMessageAvatarSrc] = useState('')
    const [userMessageShowAvatar, setUserMessageShowAvatar] = useState(false)
    const [textInputBackgroundColor, setTextInputBackgroundColor] = useState(defaultConfig.textInput.backgroundColor)
    const [textInputTextColor, setTextInputTextColor] = useState(defaultConfig.textInput.textColor)
    const [textInputPlaceholder, setTextInputPlaceholder] = useState('')
    const [textInputSendButtonColor, setTextInputSendButtonColor] = useState(defaultConfig.textInput.sendButtonColor)
    const [generateNewSession, setGenerateNewSession] = useState(false)
    const [renderHTML, setRenderHTML] = useState(false)
    const [isUserInputEnabled, setIsUserInputEnabled] = useState(true)

    const formatConfig = () => {
        try {
            // Universo Platformo | Check if chatbotConfig exists and is an object
            const baseChatbotConfig = typeof chatbotConfig === 'object' && chatbotConfig !== null ? chatbotConfig : {}

            // Universo Platformo | Create the base configuration object
            const obj = {
                botMessage: {
                    showAvatar: botMessageShowAvatar
                },
                userMessage: {
                    showAvatar: userMessageShowAvatar
                },
                textInput: {},
                displayMode: 'chat',
                userInputEnabled: isUserInputEnabled
            }

            // Universo Platformo | Add other properties only if they are defined
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

            if (userMessageBackgroundColor) obj.userMessage.backgroundColor = userMessageBackgroundColor
            if (userMessageTextColor) obj.userMessage.textColor = userMessageTextColor
            if (userMessageAvatarSrc) obj.userMessage.avatarSrc = userMessageAvatarSrc

            if (textInputBackgroundColor) obj.textInput.backgroundColor = textInputBackgroundColor
            if (textInputTextColor) obj.textInput.textColor = textInputTextColor
            if (textInputPlaceholder) obj.textInput.placeholder = textInputPlaceholder
            if (textInputSendButtonColor) obj.textInput.sendButtonColor = textInputSendButtonColor

            if (generateNewSession) {
                obj.generateNewSession = generateNewSession
            }

            if (renderHTML !== undefined) {
                obj.renderHTML = renderHTML
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

            console.log('formatConfig результат:', {
                ...baseChatbotConfig,
                ...obj
            })

            return {
                ...baseChatbotConfig,
                ...obj
            }
        } catch (error) {
            console.error('Ошибка в formatConfig:', error)
            // Universo Platformo | Return a minimal working configuration
            return {
                botMessage: { showAvatar: false },
                userMessage: { showAvatar: false },
                textInput: {},
                displayMode: 'chat',
                userInputEnabled: true
            }
        }
    }

    const handleTextChange = (value, fieldName) => {
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
                setFontSize(parseInt(value))
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
            default:
                break
        }
    }

    const handleBooleanChange = (value, fieldName) => {
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
            case 'renderHTML':
                setRenderHTML(value)
                break
            case 'showAgentMessages':
                setShowAgentMessages(value)
                break
            default:
                break
        }
    }

    const handleColorChange = (value, fieldName) => {
        switch (fieldName) {
            case 'titleBackgroundColor':
                setTitleBackgroundColor(value)
                break
            case 'titleTextColor':
                setTitleTextColor(value)
                break
            case 'backgroundColor':
                setBackgroundColor(value)
                break
            case 'poweredByTextColor':
                setPoweredByTextColor(value)
                break
            case 'botMessageBackgroundColor':
                setBotMessageBackgroundColor(value)
                break
            case 'botMessageTextColor':
                setBotMessageTextColor(value)
                break
            case 'userMessageBackgroundColor':
                setUserMessageBackgroundColor(value)
                break
            case 'userMessageTextColor':
                setUserMessageTextColor(value)
                break
            case 'textInputBackgroundColor':
                setTextInputBackgroundColor(value)
                break
            case 'textInputTextColor':
                setTextInputTextColor(value)
                break
            case 'textInputSendButtonColor':
                setTextInputSendButtonColor(value)
                break
            default:
                break
        }
    }

    const renderFields = ({ botConfig, colorField, booleanField, textField }) => {
        // Universo Platformo | Initialize states from configuration if they are not already set
        const config = { ...defaultConfig, ...botConfig }

        if (title === '' && config.title) setTitle(config.title)
        if (titleAvatarSrc === '' && config.titleAvatarSrc) setTitleAvatarSrc(config.titleAvatarSrc)
        if (titleBackgroundColor === defaultConfig.titleBackgroundColor && config.titleBackgroundColor)
            setTitleBackgroundColor(config.titleBackgroundColor)
        if (titleTextColor === defaultConfig.titleTextColor && config.titleTextColor) setTitleTextColor(config.titleTextColor)
        if (welcomeMessage === '' && config.welcomeMessage) setWelcomeMessage(config.welcomeMessage)
        if (errorMessage === '' && config.errorMessage) setErrorMessage(config.errorMessage)
        if (backgroundColor === defaultConfig.backgroundColor && config.backgroundColor) setBackgroundColor(config.backgroundColor)
        if (fontSize === defaultConfig.fontSize && config.fontSize) setFontSize(config.fontSize)
        if (poweredByTextColor === defaultConfig.poweredByTextColor && config.poweredByTextColor)
            setPoweredByTextColor(config.poweredByTextColor)
        if (showAgentMessages === isAgentCanvas && config.showAgentMessages !== undefined) setShowAgentMessages(config.showAgentMessages)
        if (botMessageBackgroundColor === defaultConfig.botMessage.backgroundColor && config.botMessage?.backgroundColor)
            setBotMessageBackgroundColor(config.botMessage.backgroundColor)
        if (botMessageTextColor === defaultConfig.botMessage.textColor && config.botMessage?.textColor)
            setBotMessageTextColor(config.botMessage.textColor)
        if (botMessageAvatarSrc === '' && config.botMessage?.avatarSrc) setBotMessageAvatarSrc(config.botMessage.avatarSrc)
        if (botMessageShowAvatar === false && config.botMessage?.showAvatar !== undefined)
            setBotMessageShowAvatar(config.botMessage.showAvatar)
        if (userMessageBackgroundColor === defaultConfig.userMessage.backgroundColor && config.userMessage?.backgroundColor)
            setUserMessageBackgroundColor(config.userMessage.backgroundColor)
        if (userMessageTextColor === defaultConfig.userMessage.textColor && config.userMessage?.textColor)
            setUserMessageTextColor(config.userMessage.textColor)
        if (userMessageAvatarSrc === '' && config.userMessage?.avatarSrc) setUserMessageAvatarSrc(config.userMessage.avatarSrc)
        if (userMessageShowAvatar === false && config.userMessage?.showAvatar !== undefined)
            setUserMessageShowAvatar(config.userMessage.showAvatar)
        if (textInputBackgroundColor === defaultConfig.textInput.backgroundColor && config.textInput?.backgroundColor)
            setTextInputBackgroundColor(config.textInput.backgroundColor)
        if (textInputTextColor === defaultConfig.textInput.textColor && config.textInput?.textColor)
            setTextInputTextColor(config.textInput.textColor)
        if (textInputPlaceholder === '' && config.textInput?.placeholder) setTextInputPlaceholder(config.textInput.placeholder)
        if (textInputSendButtonColor === defaultConfig.textInput.sendButtonColor && config.textInput?.sendButtonColor)
            setTextInputSendButtonColor(config.textInput.sendButtonColor)
        if (generateNewSession === false && config.generateNewSession !== undefined) setGenerateNewSession(config.generateNewSession)
        if (renderHTML === false && config.renderHTML !== undefined) setRenderHTML(config.renderHTML)

        // Universo Platformo | Initialize isUserInputEnabled
        if (config.overrideConfig?.userInputEnabled !== undefined) {
            setIsUserInputEnabled(config.overrideConfig.userInputEnabled)
        }

        return (
            <>
                <h4>Общие настройки</h4>
                {textField(title, 'title', 'Chat title')}
                {textField(titleAvatarSrc, 'titleAvatarSrc', 'URL avatar in title')}
                {colorField(titleBackgroundColor, 'titleBackgroundColor', 'Title background color')}
                {colorField(titleTextColor, 'titleTextColor', 'Title text color')}
                {textField(welcomeMessage, 'welcomeMessage', 'Welcome message')}
                {textField(errorMessage, 'errorMessage', 'Error message')}
                {colorField(backgroundColor, 'backgroundColor', 'Chat background color')}
                {textField(fontSize, 'fontSize', 'Font size', 'number')}
                {colorField(poweredByTextColor, 'poweredByTextColor', 'Powered by text color')}
                {booleanField(renderHTML, 'renderHTML', 'Allow HTML in messages')}

                {isSessionMemory && booleanField(generateNewSession, 'generateNewSession', 'Generate new session')}

                {isAgentCanvas &&
                    booleanField(showAgentMessages !== undefined ? showAgentMessages : true, 'showAgentMessages', 'Show bot messages')}

                <h4>Bot messages</h4>
                {colorField(botMessageBackgroundColor, 'botMessageBackgroundColor', 'Bot message background color')}
                {colorField(botMessageTextColor, 'botMessageTextColor', 'Bot message text color')}
                {textField(botMessageAvatarSrc, 'botMessageAvatarSrc', 'Bot avatar URL')}
                {booleanField(botMessageShowAvatar, 'botMessageShowAvatar', 'Show bot avatar')}

                <h4>User messages</h4>
                {colorField(userMessageBackgroundColor, 'userMessageBackgroundColor', 'User message background color')}
                {colorField(userMessageTextColor, 'userMessageTextColor', 'User message text color')}
                {textField(userMessageAvatarSrc, 'userMessageAvatarSrc', 'User avatar URL')}
                {booleanField(userMessageShowAvatar, 'userMessageShowAvatar', 'Show user avatar')}

                <h4>Input field</h4>
                {colorField(textInputBackgroundColor, 'textInputBackgroundColor', 'Input field background color')}
                {colorField(textInputTextColor, 'textInputTextColor', 'Input field text color')}
                {textField(textInputPlaceholder, 'textInputPlaceholder', 'Input field placeholder')}
                {colorField(textInputSendButtonColor, 'textInputSendButtonColor', 'Input field send button color')}
            </>
        )
    }

    return (
        <BaseBotSettings
            chatflowid={chatflowid}
            unikId={unikId}
            configKey='chatbotConfig'
            formatConfig={formatConfig}
            renderFields={renderFields}
            defaultConfig={defaultConfig}
            updateTranslationKey='shareChatbot'
            onTextChanged={handleTextChange}
            onBooleanChanged={handleBooleanChange}
            onColorChanged={handleColorChange}
            renderAdditionalSettings={() => (
                <>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={isUserInputEnabled}
                                    onChange={(e) => setIsUserInputEnabled(e.target.checked)}
                                    color='primary'
                                />
                            }
                            label='Allow user input'
                        />
                    </Grid>
                </>
            )}
        />
    )
}

ChatBotSettings.propTypes = {
    isSessionMemory: PropTypes.bool,
    isAgentCanvas: PropTypes.bool,
    chatflowid: PropTypes.string,
    unikId: PropTypes.string,
    chatflow: PropTypes.object,
    onSave: PropTypes.func
}

export default ChatBotSettings
