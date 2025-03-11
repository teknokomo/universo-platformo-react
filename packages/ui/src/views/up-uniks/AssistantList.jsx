import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '@/api'

const AssistantList = ({ unikId }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [assistants, setAssistants] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/assistants`)
            .then((res) => setAssistants(res.data))
            .catch((err) => console.error('Error fetching assistants: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const name = prompt(t('Enter assistant name') + ':')
        if (!name) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/assistants`, { name })
            const newAssistant = res.data
            setAssistants((prev) => [...prev, newAssistant])
            navigate(`/assistant/${newAssistant.id}/edit`)
        } catch (err) {
            alert(t('Failed to create assistant'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Assistants')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {assistants.map((assistant) => (
                    <li
                        key={assistant.id}
                        style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                        onClick={() => navigate(`/assistant/${assistant.id}/edit`)}
                    >
                        {assistant.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default AssistantList
