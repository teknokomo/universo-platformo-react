import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import api from '@/api'

const ApiKeyList = ({ unikId }) => {
    const { t } = useTranslation()
    const [apiKeys, setApiKeys] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/apikeys`)
            .then((res) => setApiKeys(res.data))
            .catch((err) => console.error('Error fetching API keys: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const description = prompt(t('Enter API key description') + ':')
        if (!description) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/apikeys`, { description })
            const newKey = res.data
            setApiKeys((prev) => [...prev, newKey])
        } catch (err) {
            alert(t('Failed to create API key'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('API Keys')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {apiKeys.map((key) => (
                    <li key={key.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        {key.description} — {key.api_key}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default ApiKeyList
