// Universo Platformo | Bot Router entry point
import { useEffect, useState, Suspense, lazy } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import PropTypes from 'prop-types'

// Project import
import canvasesApi from '@/api/canvases'
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
    const [canvas, setCanvas] = useState(null)

    const getPublicCanvasApi = useApi(canvasesApi.getPublicCanvas)

    useEffect(() => {
        if (botId) {
            getPublicCanvasApi.request(botId)
        } else {
            setError('Bot ID not provided')
            setLoading(false)
        }
    }, [botId])

    useEffect(() => {
        if (getPublicCanvasApi.error) {
            setError(getPublicCanvasApi.error.message)
            setLoading(false)
        }
    }, [getPublicCanvasApi.error])

    useEffect(() => {
        if (getPublicCanvasApi.data) {
            setCanvas(getPublicCanvasApi.data)
            // Determine bot type based on URL and data
            determineBotType(getPublicCanvasApi.data)
            setLoading(false)
        }
    }, [getPublicCanvasApi.data])

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

    if (!canvas) {
        return <div>Invalid Canvas</div>
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
