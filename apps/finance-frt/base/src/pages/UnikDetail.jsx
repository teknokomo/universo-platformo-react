import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import api from '../../../../../packages/ui/src/api'

const UnikDetail = () => {
    const { unikId } = useParams()
    const { t } = useTranslation('uniks')
    const navigate = useNavigate()
    const [unik, setUnik] = useState(null)

    useEffect(() => {
        api.get(`/unik/${unikId}`)
            .then((res) => setUnik(res.data))
            .catch((err) => console.error('Error loading Unik:', err))
    }, [unikId])

    if (!unik) return null

    return (
        <Box sx={{ padding: 2 }}>
            <Typography variant='h4' gutterBottom>
                {t('unikDetail.dashboard')}
            </Typography>
            <Typography variant='body1' sx={{ mb: 2 }}>
                {t('unikDetail.welcome')} <strong>{unik.name}</strong>
            </Typography>
            <Typography variant='body2' sx={{ mb: 2 }}>
                {t('unikDetail.navigation')}
            </Typography>
            <Button variant='outlined' onClick={() => navigate('/uniks')}>
                {t('unikDetail.back')}
            </Button>
        </Box>
    )
}

export default UnikDetail
