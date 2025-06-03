// Universo Platformo | Bot Router entry point
import { useEffect, useState, Suspense, lazy } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'

// Project import
import chatflowsApi from '@/api/chatflows'
import useApi from '@/hooks/useApi'
import { Backdrop, CircularProgress } from '@mui/material'

// Lazy loaded components
const BotRouter = lazy(() => import('./BotRouter'))

// Universo Platformo | Removed debug logging setup

const BotLoader = ({ botId: propBotId, type: propType }) => {
    const { id: routeId } = useParams()
    const location = useLocation()
    const botId = propBotId || routeId
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [botType, setBotType] = useState(propType || null)
    const [chatflow, setChatflow] = useState(null)

    const getSpecificChatflowFromPublicApi = useApi(chatflowsApi.getSpecificChatflowFromPublicEndpoint)

    useEffect(() => {
        if (botId) {
            getSpecificChatflowFromPublicApi.request(botId)
        } else {
            setError('Bot ID not provided')
            setLoading(false)
        }
    }, [botId])

    useEffect(() => {
        if (getSpecificChatflowFromPublicApi.error) {
            setError(getSpecificChatflowFromPublicApi.error.message)
            setLoading(false)
        }
    }, [getSpecificChatflowFromPublicApi.error])

    useEffect(() => {
        if (getSpecificChatflowFromPublicApi.data) {
            setChatflow(getSpecificChatflowFromPublicApi.data)
            // Determine bot type based on URL and data
            determineBotType(getSpecificChatflowFromPublicApi.data)
            setLoading(false)
        }
    }, [getSpecificChatflowFromPublicApi.data])

    const determineBotType = (flowData) => {
        const params = new URLSearchParams(location.search)
        const urlType = params.get('type')


        if (urlType) {
            setBotType(urlType)
            return
        }

        if (flowData?.chatbotConfig) {
            try {
                const config = JSON.parse(flowData.chatbotConfig)
                if (config?.botType === 'ar' || config?.displayMode === 'ar') {
                    setBotType('ar')
                    return
                }
            } catch (error) {
                console.error('Error parsing chatbotConfig:', error)
            }
        }


        setBotType('chat')
    }

    if (loading) {
        return (
            <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={true}>
                <CircularProgress color='inherit' />
            </Backdrop>
        )
    }

    if (error) {
        return <div>Error: {error}</div>
    }

    if (!chatflow) {
        return <div>Invalid Chatflow</div>
    }

    return (
        <Suspense
            fallback={
                <Backdrop sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }} open={true}>
                    <CircularProgress color='inherit' />
                </Backdrop>
            }
        >
            {botType === 'ar' ? <BotRouter botType={botType} /> : <BotRouter botType={botType} />}
            {/* Pass type to BotRouter for rendering */}
        </Suspense>
    )
}

BotLoader.propTypes = {
    botId: PropTypes.string,
    type: PropTypes.string
}

export default BotLoader
