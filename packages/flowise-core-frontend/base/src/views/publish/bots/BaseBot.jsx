// Universo Platformo | Base Bot component for all bot types
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '@universo/i18n'
import PropTypes from 'prop-types'

// API
import { api } from '@universo/api-client' // Replaced import canvasesApi from '@/api/canvases'

// Hooks
import useApi from '@flowise/template-mui/hooks/useApi'
import { useAuthError } from '@universo/auth-frontend'

// ==============================|| Base Bot Component ||============================== //

const BaseBot = ({ children }) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t } = useTranslation('chatbot')

    const [canvas, setCanvas] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const getPublicCanvasApi = useApi(api.canvases.getPublicCanvas)
    const getCanvasApi = useApi(api.canvases.getCanvasById)
    const { handleAuthError } = useAuthError()

    useEffect(() => {
        if (id) {
            getPublicCanvasApi.request(id)
        } else {
            setError(t('idMissing', 'Bot ID not provided'))
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    useEffect(() => {
        if (getPublicCanvasApi.error) {
            if (getPublicCanvasApi.error?.response?.status === 401) {
                // For public endpoints that return 401, try authenticated endpoint
                getCanvasApi.request(id)
            } else {
                setError(getPublicCanvasApi.error.message)
                setLoading(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getPublicCanvasApi.error])

    useEffect(() => {
        if (getCanvasApi.error) {
            if (!handleAuthError(getCanvasApi.error)) {
                setError(getCanvasApi.error.message)
                setLoading(false)
            }
        }
    }, [getCanvasApi.error, handleAuthError])

    useEffect(() => {
        if (getPublicCanvasApi.data || getCanvasApi.data) {
            const canvasData = getPublicCanvasApi.data || getCanvasApi.data
            setCanvas(canvasData)
            setLoading(false)
        }
    }, [getPublicCanvasApi.data, getCanvasApi.data])

    if (isLoading) {
        return null
    }

    if (error) {
        return <p>{error}</p>
    }

    if (!canvas || canvas.apikeyid) {
        return <p>{t('invalid')}</p>
    }

    return <>{children(canvas)}</>
}

BaseBot.propTypes = {
    children: PropTypes.func.isRequired
}

export default BaseBot
