import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tabs, Tab, Box, Button } from '@mui/material'
import api from '@/api' // ваш API helper, который прикрепляет JWT-токен к запросам

// Импортируем компоненты для каждой вкладки.
// Если они ещё не созданы, можно создать базовые заглушки.
import ChatflowList from './ChatflowList'
import AgentFlowList from './AgentFlowList'
import AssistantList from './AssistantList'
import ToolList from './ToolList'
import CredentialList from './CredentialList'
import VariableList from './VariableList'
import ApiKeyList from './ApiKeyList'
import DocumentList from './DocumentList'

const UnikDetail = () => {
    const { unikId } = useParams()
    const navigate = useNavigate()
    const { t } = useTranslation()

    const [unik, setUnik] = useState(null)
    const [tabIndex, setTabIndex] = useState(0)

    useEffect(() => {
        // Функция для загрузки деталей рабочего пространства
        const fetchUnik = async () => {
            try {
                const token = localStorage.getItem('token')
                const res = await api.get(`/api/v1/uniks/${unikId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                setUnik(res.data)
            } catch (error) {
                console.error('Error fetching Unik details:', error)
            }
        }

        fetchUnik()
    }, [unikId])

    const handleTabChange = (event, newValue) => {
        setTabIndex(newValue)
    }

    if (!unik) {
        return <div>{t('Loading...')}</div>
    }

    // Определяем отображаемое название рабочего пространства, учитывая многоязычность
    const displayName = unik.name_translations?.[t('langCode')] || unik.name_translations?.en || unik.name

    return (
        <Box sx={{ padding: 2 }}>
            <Button variant='outlined' onClick={() => navigate('/uniks')}>
                {t('Back to Workspaces')}
            </Button>
            <h1>{displayName}</h1>
            <Tabs value={tabIndex} onChange={handleTabChange} aria-label='Unik Detail Tabs'>
                <Tab label={t('Chatflows')} />
                <Tab label={t('Agentflows')} />
                <Tab label={t('Assistants')} />
                <Tab label={t('Tools')} />
                <Tab label={t('Credentials')} />
                <Tab label={t('Variables')} />
                <Tab label={t('API Keys')} />
                <Tab label={t('Document Store')} />
            </Tabs>
            <Box sx={{ marginTop: 2 }}>
                {tabIndex === 0 && <ChatflowList unikId={unikId} />}
                {tabIndex === 1 && <AgentFlowList unikId={unikId} />}
                {tabIndex === 2 && <AssistantList unikId={unikId} />}
                {tabIndex === 3 && <ToolList unikId={unikId} />}
                {tabIndex === 4 && <CredentialList unikId={unikId} />}
                {tabIndex === 5 && <VariableList unikId={unikId} />}
                {tabIndex === 6 && <ApiKeyList unikId={unikId} />}
                {tabIndex === 7 && <DocumentList unikId={unikId} />}
            </Box>
        </Box>
    )
}

export default UnikDetail
