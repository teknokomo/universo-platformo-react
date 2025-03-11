// packages/ui/src/views/up-uniks/ChatflowList.jsx
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '@/api' // ваш API helper, который прикрепляет JWT-токен

const ChatflowList = ({ unikId }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [chatflows, setChatflows] = useState([])

    useEffect(() => {
        // Запрашиваем чатфлоу, принадлежащие конкретному Unik
        api.get(`/api/v1/uniks/${unikId}/chatflows`)
            .then((res) => setChatflows(res.data))
            .catch((err) => console.error('Error fetching chatflows: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const name = prompt(t('Enter chatflow name') + ':')
        if (!name) return
        try {
            // Создаем новый чатflow, привязанный к текущему Unik
            const res = await api.post(`/api/v1/uniks/${unikId}/chatflows`, { name })
            const newFlow = res.data
            setChatflows((prev) => [...prev, newFlow])
            // Перенаправляем пользователя в редактор нового чатflow
            navigate(`/chatflow/${newFlow.id}/edit`)
        } catch (err) {
            alert(t('Failed to create chatflow'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Chatflows')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {chatflows.map((flow) => (
                    <li
                        key={flow.id}
                        onClick={() => navigate(`/chatflow/${flow.id}/edit`)}
                        style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                    >
                        {flow.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ChatflowList
