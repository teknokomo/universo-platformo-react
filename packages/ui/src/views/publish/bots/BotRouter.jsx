// Universo Platformo | Bot Router with AR support
import { useParams } from 'react-router-dom'
import BaseBot from './BaseBot'
import ChatBotViewer from './ChatBotViewer'
import ARBotViewer from './ARBotViewer'

const BotRouter = () => {
    const { id } = useParams()

    const renderBot = (chatflow) => {
        if (!chatflow) return null

        // Universo Platformo | Check bot configuration for AR type
        if (chatflow.chatbotConfig) {
            try {
                const config = JSON.parse(chatflow.chatbotConfig)
                if (config?.botType === 'ar' || config?.displayMode === 'ar') {
                    return <ARBotViewer />
                }
            } catch (error) {
                console.error('Ошибка парсинга chatbotConfig:', error)
            }
        }

        // Universo Platformo | Check legacy arbotConfig format for backward compatibility
        if (chatflow.arbotConfig) {
            try {
                const config = JSON.parse(chatflow.arbotConfig)
                if (config?.botType === 'ar' || config?.displayMode === 'ar') {
                    return <ARBotViewer />
                }
            } catch (error) {
                console.error('Ошибка парсинга arbotConfig:', error)
            }
        }

        // Universo Platformo | Check chatflow type
        switch (chatflow.type) {
            case 'CHATBOT':
                return <ChatBotViewer />
            case 'MULTIAGENT':
                return <ChatBotViewer />
            case 'ARBOT':
                return <ARBotViewer />
            default:
                return <ChatBotViewer /> // Default to chatbot
        }
    }

    return <BaseBot id={id}>{renderBot}</BaseBot>
}

export default BotRouter
