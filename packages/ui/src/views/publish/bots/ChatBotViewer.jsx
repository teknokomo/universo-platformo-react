// Universo Platformo | Chat Bot Viewer implementation
import { useEffect, useState } from 'react'
import { FullPageChat } from 'flowise-embed-react'
import BaseBot from './BaseBot'
import PropTypes from 'prop-types'

// Const
import { baseURL } from '@/store/constant'

// ==============================|| Chat Bot Viewer ||============================== //

const ChatBotWithTheme = ({ chatflow, theme }) => {
    return <FullPageChat chatflowid={chatflow.id} apiHost={baseURL} theme={theme} />
}

ChatBotWithTheme.propTypes = {
    chatflow: PropTypes.object.isRequired,
    theme: PropTypes.object.isRequired
}

const ChatBotViewer = () => {
    const [theme, setTheme] = useState({
        primaryColor: '#000000',
        secondaryColor: '#ffffff',
        backgroundColor: '#ffffff',
        fontFamily: 'Arial',
        fontSize: '16px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    })

    const renderChatBot = (chatflow) => {
        // Universo Platformo | Process chatbot configuration
        if (chatflow?.chatbotConfig) {
            try {
                const config = JSON.parse(chatflow.chatbotConfig)
                if (config.chatbot) {
                    const newTheme = {
                        ...theme,
                        primaryColor: config.chatbot.primaryColor || theme.primaryColor,
                        secondaryColor: config.chatbot.secondaryColor || theme.secondaryColor,
                        backgroundColor: config.chatbot.backgroundColor || theme.backgroundColor,
                        fontFamily: config.chatbot.fontFamily || theme.fontFamily,
                        fontSize: config.chatbot.fontSize || theme.fontSize,
                        borderRadius: config.chatbot.borderRadius || theme.borderRadius,
                        boxShadow: config.chatbot.boxShadow || theme.boxShadow
                    }

                    return <ChatBotWithTheme chatflow={chatflow} theme={newTheme} />
                }
            } catch (error) {
                console.error('Error parsing chatbot config:', error)
            }
        }

        return <ChatBotWithTheme chatflow={chatflow} theme={theme} />
    }

    return <BaseBot>{renderChatBot}</BaseBot>
}

export default ChatBotViewer
