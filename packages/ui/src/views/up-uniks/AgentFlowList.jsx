import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '@/api'

const AgentFlowList = ({ unikId }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [agentFlows, setAgentFlows] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/agentflows`)
            .then((res) => setAgentFlows(res.data))
            .catch((err) => console.error('Error fetching agent flows: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const name = prompt(t('Enter agent flow name') + ':')
        if (!name) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/agentflows`, { name })
            const newFlow = res.data
            setAgentFlows((prev) => [...prev, newFlow])
            navigate(`/agentflow/${newFlow.id}/edit`)
        } catch (err) {
            alert(t('Failed to create agent flow'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Agentflows')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {agentFlows.map((flow) => (
                    <li
                        key={flow.id}
                        style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                        onClick={() => navigate(`/agentflow/${flow.id}/edit`)}
                    >
                        {flow.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default AgentFlowList
