import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import api from '@/api'

const UnikDetail = () => {
    const { unikId } = useParams()
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [unik, setUnik] = useState(null)

    useEffect(() => {
        api.get(`/uniks/${unikId}`)
            .then((res) => setUnik(res.data))
            .catch((err) => console.error('Error loading Unik:', err))
    }, [unikId])

    if (!unik) return null

    return (
        <Box sx={{ padding: 2 }}>
            <Typography variant='h4' gutterBottom>
                {t('Workspace Dashboard')}
            </Typography>
            <Typography variant='body1' sx={{ mb: 2 }}>
                {t('Welcome to your workspace:')} <strong>{unik.name}</strong>
            </Typography>
            <Typography variant='body2' sx={{ mb: 2 }}>
                {t('Use the left menu to navigate to Chatflows, Agentflows, etc.')}
            </Typography>
            <Button variant='outlined' onClick={() => navigate('/uniks')}>
                {t('Back to Workspaces')}
            </Button>
        </Box>
    )
}

export default UnikDetail
