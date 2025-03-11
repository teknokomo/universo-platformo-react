import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import api from '@/api'

const CredentialList = ({ unikId }) => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [credentials, setCredentials] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/credentials`)
            .then((res) => setCredentials(res.data))
            .catch((err) => console.error('Error fetching credentials: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const name = prompt(t('Enter credential name') + ':')
        if (!name) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/credentials`, { name })
            const newCredential = res.data
            setCredentials((prev) => [...prev, newCredential])
            navigate(`/credential/${newCredential.id}/edit`)
        } catch (err) {
            alert(t('Failed to create credential'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Credentials')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {credentials.map((cred) => (
                    <li
                        key={cred.id}
                        style={{ cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid #eee' }}
                        onClick={() => navigate(`/credential/${cred.id}/edit`)}
                    >
                        {cred.name}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default CredentialList
