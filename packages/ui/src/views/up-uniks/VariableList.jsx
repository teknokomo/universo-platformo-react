import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'
import api from '@/api'

const VariableList = ({ unikId }) => {
    const { t } = useTranslation()
    const [variables, setVariables] = useState([])

    useEffect(() => {
        api.get(`/api/v1/uniks/${unikId}/variables`)
            .then((res) => setVariables(res.data))
            .catch((err) => console.error('Error fetching variables: ', err))
    }, [unikId])

    const handleCreate = async () => {
        const key = prompt(t('Enter variable key') + ':')
        const value = prompt(t('Enter variable value') + ':')
        if (!key || !value) return
        try {
            const res = await api.post(`/api/v1/uniks/${unikId}/variables`, { key, value })
            const newVariable = res.data
            setVariables((prev) => [...prev, newVariable])
        } catch (err) {
            alert(t('Failed to create variable'))
        }
    }

    return (
        <div style={{ padding: '16px' }}>
            <h3>{t('Variables')}</h3>
            <Button variant='contained' color='primary' onClick={handleCreate}>
                {t('Add New')}
            </Button>
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {variables.map((variable) => (
                    <li key={variable.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                        {variable.key}: {variable.value}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default VariableList
