// Universo Platformo | Base Bot component for all bot types
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'
import { useAuthError } from '@/hooks/useAuthError'

// ==============================|| Base Bot Component ||============================== //

const BaseBot = ({ children }) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const [chatflow, setChatflow] = useState(null)
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const getSpecificChatflowFromPublicApi = useApi(chatflowsApi.getSpecificChatflowFromPublicEndpoint)
    const getSpecificChatflowApi = useApi(chatflowsApi.getSpecificChatflow)
    const { handleAuthError } = useAuthError()

    useEffect(() => {
        if (id) {
            getSpecificChatflowFromPublicApi.request(id)
        } else {
            setError(t('chatbot.idMissing', 'Bot ID not provided'))
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    useEffect(() => {
        if (getSpecificChatflowFromPublicApi.error) {
            if (getSpecificChatflowFromPublicApi.error?.response?.status === 401) {
                // For public endpoints that return 401, try authenticated endpoint
                getSpecificChatflowApi.request(id)
            } else {
                setError(getSpecificChatflowFromPublicApi.error.message)
                setLoading(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificChatflowFromPublicApi.error])

    useEffect(() => {
        if (getSpecificChatflowApi.error) {
            if (!handleAuthError(getSpecificChatflowApi.error)) {
                setError(getSpecificChatflowApi.error.message)
                setLoading(false)
            }
        }
    }, [getSpecificChatflowApi.error, handleAuthError])

    useEffect(() => {
        if (getSpecificChatflowFromPublicApi.data || getSpecificChatflowApi.data) {
            const chatflowData = getSpecificChatflowFromPublicApi.data || getSpecificChatflowApi.data
            setChatflow(chatflowData)
            setLoading(false)
        }
    }, [getSpecificChatflowFromPublicApi.data, getSpecificChatflowApi.data])

    if (isLoading) {
        return null
    }

    if (error) {
        return <p>{error}</p>
    }

    if (!chatflow || chatflow.apikeyid) {
        return <p>{t('chatbot.invalid')}</p>
    }

    return <>{children(chatflow)}</>
}

BaseBot.propTypes = {
    children: PropTypes.func.isRequired
}

export default BaseBot
