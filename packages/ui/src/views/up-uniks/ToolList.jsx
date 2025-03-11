import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '@/api'

const ToolList = ({ unikId }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [tools, setTools] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/tools`)
            .then((res) => setTools(res.data))
            .catch((err) => console.error('Error fetching tools: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const name = prompt(t('Enter tool name') + ':')
        if (!name) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/tools`, { name })
            const newTool = res.data
            setTools((prev) => [...prev, newTool])
            navigate(`/tool/${newTool.id}/edit`)
        } catch (err) {
            alert(t('Failed to create tool'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Tools')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {tools.map((tool) => (
                    <li
                        key={tool.id}
                        style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                        onClick={() => navigate(`/tool/${tool.id}/edit`)}
                    >
                        {tool.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ToolList
