// Universo Platformo | Bot Router
import { useParams } from 'react-router-dom'
import BaseBot from './BaseBot'
import ChatBotViewer from './ChatBotViewer'

const BotRouter = () => {
    const { id } = useParams()

    const renderBot = (canvas) => {
        if (!canvas) return null

        // Universo Platformo | Since AR.js is now handled via streaming publication
        // and served directly as HTML, we only need ChatBotViewer for configuration
        return <ChatBotViewer />
    }

    return <BaseBot id={id}>{renderBot}</BaseBot>
}

export default BotRouter
