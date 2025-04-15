// Universo Platformo | Base Bot component for all bot types
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PropTypes from 'prop-types'

// Project import
import LoginDialog from '@/ui-component/dialog/LoginDialog'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// ==============================|| Base Bot Component ||============================== //

const BaseBot = ({ children }) => {
    const { id } = useParams()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const [chatflow, setChatflow] = useState(null)
    const [loginDialogOpen, setLoginDialogOpen] = useState(false)
    const [loginDialogProps, setLoginDialogProps] = useState({})
    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const getSpecificChatflowFromPublicApi = useApi(chatflowsApi.getSpecificChatflowFromPublicEndpoint)
    const getSpecificChatflowApi = useApi(chatflowsApi.getSpecificChatflow)

    const onLoginClick = (username, password) => {
        localStorage.setItem('username', username)
        localStorage.setItem('password', password)
        navigate(0)
    }

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
                if (localStorage.getItem('username') && localStorage.getItem('password')) {
                    getSpecificChatflowApi.request(id)
                } else {
                    setLoginDialogProps({
                        title: t('chatMessage.common.login'),
                        confirmButtonName: t('chatMessage.common.login')
                    })
                    setLoginDialogOpen(true)
                }
            } else {
                setError(getSpecificChatflowFromPublicApi.error.message)
                setLoading(false)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getSpecificChatflowFromPublicApi.error])

    useEffect(() => {
        if (getSpecificChatflowApi.error) {
            if (getSpecificChatflowApi.error?.response?.status === 401) {
                setLoginDialogProps({
                    title: t('chatMessage.common.login'),
                    confirmButtonName: t('chatMessage.common.login')
                })
                setLoginDialogOpen(true)
            } else {
                setError(getSpecificChatflowApi.error.message)
                setLoading(false)
            }
        }
    }, [getSpecificChatflowApi.error, t])

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

    return (
        <>
            {children(chatflow)}
            <LoginDialog show={loginDialogOpen} dialogProps={loginDialogProps} onConfirm={onLoginClick} />
        </>
    )
}

BaseBot.propTypes = {
    children: PropTypes.func.isRequired
}

export default BaseBot
